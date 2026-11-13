-- Migration: simpan Hari Ini jadi satu langkah atomik yang tahan kirim ulang.
-- Jalankan di Supabase: SQL Editor → New Query → paste → Run.
-- Butuh tabel jejak (jejak_migration.sql) sudah ada.
--
-- Masalah yang diperbaiki: simpan Hari Ini dulu = baca baris → hitung di HP →
-- tulis. Kalau tulisannya SAMPAI di server tapi balasannya hilang (WiFi
-- putus-nyambung), app mengira gagal, mengantre, lalu mengirim ulang — dan
-- penjualannya tercatat dua kali. Dua HP yang menyimpan tanggal sama hampir
-- bersamaan juga bisa saling menimpa.
--
-- Fungsi di bawah menerima SELISIH (input satu kali simpan, sudah dihitung app
-- dengan rumus yang sama) dan menambahkannya di server dalam satu transaksi.
-- Tiap kiriman membawa op_id yang dibuat saat tombol ditekan; kiriman ulang
-- dengan op_id yang sama dikenali dan tidak ditambahkan lagi.
--
-- App tetap jalan sebelum migrasi ini dijalankan: kalau fungsinya belum ada,
-- app memakai cara lama. Aman dijalankan kapan pun, dan aman diulang.

alter table public.jejak add column if not exists op_id uuid;
create unique index if not exists ux_jejak_op on public.jejak (op_id) where op_id is not null;

create or replace function public.tambah_entri(
  p_op_id uuid,
  p_date date,
  p_qty jsonb,
  p_expenses jsonb,
  p_penjualan numeric,
  p_gaji numeric,
  p_pengeluaran numeric,
  p_jejak jsonb
) returns public.entries
language plpgsql
security invoker            -- tetap tunduk pada RLS milik pengguna yang login
set search_path = public
as $$
declare
  hasil public.entries;
begin
  -- Jejak ditulis lebih dulu karena dialah penanda "kiriman ini sudah
  -- diterima". Kiriman ulang menabrak op_id yang sama dan berhenti di sini.
  insert into public.jejak (op_id, date, aksi, oleh, email, rincian, waktu)
  values (
    p_op_id, p_date, 'tambah',
    coalesce(nullif(p_jejak->>'oleh', ''), 'Tanpa nama'),
    p_jejak->>'email',
    coalesce(p_jejak->'rincian', '{}'::jsonb),
    coalesce((p_jejak->>'waktu')::timestamptz, now())
  )
  on conflict (op_id) where op_id is not null do nothing;

  if not found then
    select * into hasil from public.entries where date = p_date;
    return hasil;
  end if;

  insert into public.entries as e
    (date, quantities, expenses, total_penjualan, gaji, total_pengeluaran, sisa_kas)
  values
    (p_date, coalesce(p_qty, '{}'::jsonb), coalesce(p_expenses, '[]'::jsonb),
     p_penjualan, p_gaji, p_pengeluaran, p_penjualan - p_gaji - p_pengeluaran)
  on conflict (date) do update set
    quantities = (
      select coalesce(jsonb_object_agg(k,
               coalesce((e.quantities->>k)::int, 0) + coalesce((excluded.quantities->>k)::int, 0)), '{}'::jsonb)
      from jsonb_object_keys(coalesce(e.quantities, '{}'::jsonb) || excluded.quantities) k
    ),
    expenses          = coalesce(e.expenses, '[]'::jsonb) || excluded.expenses,
    total_penjualan   = coalesce(e.total_penjualan, 0)   + excluded.total_penjualan,
    gaji              = coalesce(e.gaji, 0)              + excluded.gaji,
    total_pengeluaran = coalesce(e.total_pengeluaran, 0) + excluded.total_pengeluaran,
    sisa_kas          = coalesce(e.sisa_kas, 0)          + excluded.sisa_kas
  returning * into hasil;

  return hasil;
end;
$$;

grant execute on function public.tambah_entri(uuid, date, jsonb, jsonb, numeric, numeric, numeric, jsonb) to authenticated;

-- Cara mencoba setelah dijalankan (opsional), dari app: simpan satu kopi,
-- lalu periksa baris jejak terbarunya punya op_id:
--   select date, aksi, oleh, op_id from public.jejak order by id desc limit 3;
