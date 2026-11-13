-- Skema dasar: tabel entries & config beserta aturan aksesnya.
-- Dua tabel ini dulu dibuat lewat Dashboard dan tidak tercatat di repo
-- (RENCANA 0.2). Disusun dari isi database asli, dicek 14 Nov 2026
-- (information_schema.columns + pg_policies).
--
-- Untuk membangun project Supabase BARU dari nol, jalankan berurutan:
--   1. skema_awal.sql            (berkas ini)
--   2. voucher_toko_migration.sql
--   3. jejak_migration.sql
--   4. kiriman_migration.sql
--   5. kas_pemilik_migration.sql
--   6. galat_migration.sql
--   7. peran_1_tandai_akun.sql   → pemilik keluar lalu masuk lagi
--   8. peran_2_aturan.sql
--   9. jejak_server_migration.sql
-- Di project yang sudah berjalan, berkas ini tidak perlu dijalankan; isinya
-- idempoten (create … if not exists), jadi aman kalau terlanjur.

-- Satu baris per tanggal. Angka total disimpan (bukan dihitung ulang saat
-- dibaca) supaya muat awal app cukup menarik kolom angka saja.
create table if not exists public.entries (
  date              date primary key,
  quantities        jsonb not null default '{}'::jsonb,   -- { produkId: jumlah }
  expenses          jsonb not null default '[]'::jsonb,   -- [{ desc, amount, type? }] type: cashin | setor
  total_penjualan   numeric not null default 0,
  gaji              numeric not null default 0,
  total_pengeluaran numeric not null default 0,           -- bersih keluar dari kas toko
  sisa_kas          numeric not null default 0,
  updated_at        timestamptz not null default now()
);

-- Pengaturan sederhana; saat ini hanya key 'saldo_awal' (nilai angka di jsonb).
create table if not exists public.config (
  key        text primary key,
  value      jsonb,
  updated_at timestamptz not null default now()
);

-- Realtime: perubahan dari HP lain langsung tampil.
do $$
begin
  alter publication supabase_realtime add table public.entries;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.config;
exception when duplicate_object then null;
end $$;

alter table public.entries enable row level security;
alter table public.config  enable row level security;

-- Aturan akses: semua akun yang masuk boleh membaca, menambah, dan mengubah.
-- Hapus hari & ubah Saldo Awal khusus pemilik — tapi fungsi public.peran()
-- baru dibuat di peran_2_aturan.sql, jadi di sini dibuat versi longgar dulu,
-- dan peran_2_aturan.sql yang menggantinya dengan versi berperan.
drop policy if exists entries_select on public.entries;
drop policy if exists entries_insert on public.entries;
drop policy if exists entries_update on public.entries;
drop policy if exists entries_delete on public.entries;
create policy entries_select on public.entries for select using (auth.role() = 'authenticated');
create policy entries_insert on public.entries for insert with check (auth.role() = 'authenticated');
create policy entries_update on public.entries for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy entries_delete on public.entries for delete using (auth.role() = 'authenticated');

drop policy if exists config_select on public.config;
drop policy if exists config_insert on public.config;
drop policy if exists config_update on public.config;
drop policy if exists config_delete on public.config;
create policy config_select on public.config for select using (auth.role() = 'authenticated');
create policy config_insert on public.config for insert with check (auth.role() = 'authenticated');
create policy config_update on public.config for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy config_delete on public.config for delete using (auth.role() = 'authenticated');
