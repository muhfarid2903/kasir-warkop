-- Migration: tulisan + jejaknya dalam SATU transaksi di server.
-- Jalankan di Supabase: SQL Editor → New Query → paste → Run.
-- Butuh: jejak_migration.sql, kas_pemilik_migration.sql, peran_2_aturan.sql.
--
-- Dulu jejak untuk edit, hapus, voucher, dan Saldo Awal ditulis app sebagai
-- langkah TERPISAH sesudah datanya, dan kegagalannya ditelan diam-diam: data
-- bisa berubah tanpa jejak. Fungsi di bawah menulis keduanya sekaligus —
-- berhasil bersama atau gagal bersama.
--
-- Semua SECURITY INVOKER: tetap tunduk pada RLS pengguna yang login, jadi
-- aturan peran (kasir tidak boleh hapus hari / ubah Saldo Awal) tetap berlaku.
--
-- Kolom entries/config ditulis lewat literal berkutip (format %L), jadi
-- fungsi ini tidak bergantung pada tipe persis kolomnya (json/jsonb/numeric/
-- text) — tipe kolom dua tabel itu tidak tercatat di repo.
--
-- App tetap jalan sebelum migrasi ini dijalankan (memakai cara lama). Aman
-- diulang.

create or replace function public._tulis_jejak(p_date date, p_jejak jsonb)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if p_jejak is null or jsonb_typeof(p_jejak) <> 'object' or p_jejak = '{}'::jsonb then
    return;
  end if;
  insert into public.jejak (date, aksi, oleh, email, rincian, waktu)
  values (
    p_date,
    p_jejak->>'aksi',
    coalesce(nullif(p_jejak->>'oleh', ''), 'Tanpa nama'),
    p_jejak->>'email',
    coalesce(p_jejak->'rincian', '{}'::jsonb),
    coalesce((p_jejak->>'waktu')::timestamptz, now())
  );
end $$;

-- Edit satu hari (MENGGANTI isinya).
create or replace function public.ganti_entri(p_entry jsonb, p_jejak jsonb)
returns void language plpgsql security invoker set search_path = public as $$
begin
  execute format(
    'insert into public.entries (date, quantities, expenses, total_penjualan, gaji, total_pengeluaran, sisa_kas)
     values (%L, %L, %L, %L, %L, %L, %L)
     on conflict (date) do update set
       quantities = excluded.quantities, expenses = excluded.expenses,
       total_penjualan = excluded.total_penjualan, gaji = excluded.gaji,
       total_pengeluaran = excluded.total_pengeluaran, sisa_kas = excluded.sisa_kas',
    p_entry->>'date',
    coalesce(p_entry->'quantities', '{}'::jsonb)::text,
    coalesce(p_entry->'expenses', '[]'::jsonb)::text,
    coalesce(p_entry->>'total_penjualan', '0'),
    coalesce(p_entry->>'gaji', '0'),
    coalesce(p_entry->>'total_pengeluaran', '0'),
    coalesce(p_entry->>'sisa_kas', '0'));
  perform public._tulis_jejak((p_entry->>'date')::date, p_jejak);
end $$;

-- Hapus satu hari. DELETE yang ditolak RLS tidak menimbulkan galat di
-- Postgres — ia cuma menghapus nol baris. Tanpa pemeriksaan ini, kasir yang
-- "menghapus" akan melihat berhasil dan meninggalkan jejak hapus palsu.
create or replace function public.hapus_entri(p_date date, p_jejak jsonb)
returns void language plpgsql security invoker set search_path = public as $$
declare n integer;
begin
  delete from public.entries where date = p_date;
  get diagnostics n = row_count;
  if n = 0 then
    if exists (select 1 from public.entries where date = p_date) then
      raise exception 'Akun ini tidak diizinkan menghapus hari' using errcode = '42501';
    end if;
    return;   -- memang sudah tidak ada: tidak ada yang dihapus, tidak ada jejak
  end if;
  perform public._tulis_jejak(p_date, p_jejak);
end $$;

create or replace function public.simpan_saldo(p_nilai numeric, p_tanggal date, p_jejak jsonb)
returns void language plpgsql security invoker set search_path = public as $$
begin
  execute format(
    'insert into public.config (key, value) values (%L, %L)
     on conflict (key) do update set value = excluded.value',
    'saldo_awal', p_nilai::text);
  perform public._tulis_jejak(p_tanggal, p_jejak);
end $$;

-- Voucher satu tanggal; p_rows = [{ toko_id, drop_qty, laku_qty, ke_pemilik }].
create or replace function public.simpan_voucher(p_date date, p_rows jsonb, p_jejak jsonb)
returns void language plpgsql security invoker set search_path = public as $$
declare r jsonb;
begin
  for r in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    insert into public.voucher_toko (date, toko_id, drop_qty, laku_qty, ke_pemilik)
    values (p_date, r->>'toko_id', coalesce((r->>'drop_qty')::int, 0), coalesce((r->>'laku_qty')::int, 0), coalesce((r->>'ke_pemilik')::boolean, false))
    on conflict (date, toko_id) do update set
      drop_qty = excluded.drop_qty, laku_qty = excluded.laku_qty, ke_pemilik = excluded.ke_pemilik;
  end loop;
  perform public._tulis_jejak(p_date, p_jejak);
end $$;

-- Hanya untuk akun yang masuk; fungsi baru di Postgres terbuka untuk semua
-- peran secara bawaan.
revoke execute on function public._tulis_jejak(date, jsonb) from public, anon;
revoke execute on function public.ganti_entri(jsonb, jsonb) from public, anon;
revoke execute on function public.hapus_entri(date, jsonb) from public, anon;
revoke execute on function public.simpan_saldo(numeric, date, jsonb) from public, anon;
revoke execute on function public.simpan_voucher(date, jsonb, jsonb) from public, anon;
grant execute on function public._tulis_jejak(date, jsonb) to authenticated;
grant execute on function public.ganti_entri(jsonb, jsonb) to authenticated;
grant execute on function public.hapus_entri(date, jsonb) to authenticated;
grant execute on function public.simpan_saldo(numeric, date, jsonb) to authenticated;
grant execute on function public.simpan_voucher(date, jsonb, jsonb) to authenticated;
