-- Migration: tabel galat — supaya error di HP kasir sampai ke pemilik.
-- Jalankan di Supabase: SQL Editor → New Query → paste → Run.
--
-- Dulu layar galat (ErrorBoundary) hanya menulis ke console HP itu sendiri:
-- tidak ada yang tahu app pernah rusak kecuali kasirnya bercerita. App tetap
-- jalan tanpa tabel ini; laporannya saja yang tidak tersimpan. Aman diulang.

create table if not exists public.galat (
  id         bigint generated always as identity primary key,
  waktu      timestamptz not null default now(),
  user_id    uuid not null default auth.uid(),
  oleh       text,
  pesan      text not null,
  tumpukan   text,
  versi      text,
  halaman    text,
  perangkat  text
);

create index if not exists ix_galat_waktu on public.galat (waktu desc);

alter table public.galat enable row level security;

drop policy if exists "galat_insert" on public.galat;
drop policy if exists "galat_select" on public.galat;

create policy "galat_insert" on public.galat
  for insert with check (auth.role() = 'authenticated' and user_id = auth.uid());
create policy "galat_select" on public.galat
  for select using (auth.role() = 'authenticated');

-- Melihat galat terbaru:
--   select waktu, oleh, versi, halaman, pesan from public.galat order by waktu desc limit 20;
