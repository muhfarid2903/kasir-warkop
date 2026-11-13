-- Peran akun, LANGKAH 2 dari 2: aturan siapa boleh apa.
-- Jalankan SESUDAH peran_1_tandai_akun.sql, dan sesudah pemilik keluar-masuk
-- lagi di app.
--
-- Keputusan pemilik (13 Nov 2026): akun karyawan TIDAK boleh menghapus hari
-- dan TIDAK boleh mengubah Saldo Awal. Input, voucher, edit, dan cocokkan kas
-- tetap boleh untuk semua akun yang masuk.
--
-- Akun tanpa peran dianggap kasir. Aman diulang.

-- Pengaman: jangan sampai pemilik ikut terkunci.
do $$
begin
  if not exists (select 1 from auth.users where raw_app_meta_data->>'peran' = 'pemilik') then
    raise exception 'Belum ada akun berperan pemilik. Jalankan peran_1_tandai_akun.sql dulu. Tidak ada yang diubah.';
  end if;
end $$;

create or replace function public.peran() returns text
language sql stable
set search_path = public
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'peran', 'kasir')
$$;

-- entries & config: policy lamanya (yang dibuat lewat Dashboard, tidak ada di
-- repo) diganti seluruhnya dengan yang di bawah. Isinya sama dengan perilaku
-- sebelumnya — semua akun yang masuk boleh membaca, menambah, dan mengubah —
-- kecuali hapus hari dan ubah Saldo Awal yang kini khusus pemilik.
do $$
declare p record;
begin
  for p in select policyname, tablename from pg_policies
           where schemaname = 'public' and tablename in ('entries', 'config')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

alter table public.entries enable row level security;
alter table public.config  enable row level security;

create policy entries_select on public.entries for select using (auth.role() = 'authenticated');
create policy entries_insert on public.entries for insert with check (auth.role() = 'authenticated');
create policy entries_update on public.entries for update
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy entries_delete on public.entries for delete using (public.peran() = 'pemilik');

create policy config_select on public.config for select using (auth.role() = 'authenticated');
-- Simpan Saldo Awal = upsert, jadi butuh insert DAN update.
create policy config_insert on public.config for insert with check (public.peran() = 'pemilik');
create policy config_update on public.config for update
  using (public.peran() = 'pemilik') with check (public.peran() = 'pemilik');
create policy config_delete on public.config for delete using (public.peran() = 'pemilik');

-- voucher_toko: app tidak pernah menghapus baris (mengosongkan = drop/laku 0),
-- tapi pintu hapusnya ikut dikunci untuk pemilik saja.
drop policy if exists "voucher_toko_delete" on public.voucher_toko;
create policy "voucher_toko_delete" on public.voucher_toko for delete using (public.peran() = 'pemilik');

-- Periksa hasilnya:
select tablename, policyname, cmd from pg_policies
 where schemaname = 'public' and tablename in ('entries', 'config', 'voucher_toko')
 order by 1, 2;
