-- Migration Fase 2: kas toko vs kas pemilik, dan pencocokan kas.
-- Jalankan di Supabase: SQL Editor → New Query → paste → Run.
-- Aman dijalankan kapan pun dan aman diulang. App tetap jalan sebelum
-- migrasi ini dijalankan; fiturnya saja yang belum muncul.

-- === 1. Setoran voucher yang langsung masuk ke kas pemilik ================
-- Setoran voucher tetap penjualan (ikut hasil usaha dan gaji Jaya), tapi
-- uangnya tidak pernah masuk laci toko. Dulu dicatat dengan pengeluaran
-- "tf <toko> <jumlah>" supaya kas toko benar; sekarang cukup ditandai di
-- baris vouchernya sendiri. Baris lama tetap false, jadi kas lama tidak
-- berubah satu rupiah pun.
alter table public.voucher_toko
  add column if not exists ke_pemilik boolean not null default false;

-- === 2. Pencocokan kas =====================================================
-- Gaji dibayar harian dari laci, jadi Kas Toko di app seharusnya selalu sama
-- dengan uang fisik. Tiap kali dicocokkan, hasilnya dicatat di sini.
create table if not exists public.hitung_kas (
  id        bigint generated always as identity primary key,
  date      date not null,                 -- tanggal pencocokan (waktu lokal HP)
  waktu     timestamptz not null default now(),
  oleh      text not null,
  user_id   uuid not null default auth.uid(),
  sistem    numeric not null,              -- Kas Toko menurut app saat itu
  fisik     numeric not null,              -- uang yang dihitung di laci
  selisih   numeric generated always as (fisik - sistem) stored,
  catatan   text
);

create index if not exists ix_hitung_kas_date on public.hitung_kas (date);

do $$
begin
  alter publication supabase_realtime add table public.hitung_kas;
exception when duplicate_object then null;
end $$;

alter table public.hitung_kas enable row level security;

drop policy if exists "hitung_kas_select" on public.hitung_kas;
drop policy if exists "hitung_kas_insert" on public.hitung_kas;

create policy "hitung_kas_select" on public.hitung_kas
  for select using (auth.role() = 'authenticated');
create policy "hitung_kas_insert" on public.hitung_kas
  for insert with check (auth.role() = 'authenticated' and user_id = auth.uid());

-- Sengaja tanpa update & delete, sama seperti jejak: catatan pencocokan yang
-- bisa disunting bukan catatan.
