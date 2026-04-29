-- Migration: tabel voucher_toko untuk pencatatan drop & laku voucher 2000 per toko per hari.
-- Berlaku mulai 2026-05-01 (cutoff). Sebelum tanggal itu data v2k tetap di kolom entries.quantities.
-- Jalankan di Supabase: SQL Editor → New Query → paste → Run.

create table if not exists public.voucher_toko (
  date      date    not null,
  toko_id   text    not null,
  drop_qty  integer not null default 0,
  laku_qty  integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (date, toko_id)
);

-- Realtime publication (agar UI menerima update otomatis)
alter publication supabase_realtime add table public.voucher_toko;

-- Row Level Security: izinkan semua user yang sudah login (sama seperti tabel entries)
alter table public.voucher_toko enable row level security;

drop policy if exists "voucher_toko_select" on public.voucher_toko;
drop policy if exists "voucher_toko_insert" on public.voucher_toko;
drop policy if exists "voucher_toko_update" on public.voucher_toko;
drop policy if exists "voucher_toko_delete" on public.voucher_toko;

create policy "voucher_toko_select" on public.voucher_toko
  for select using (auth.role() = 'authenticated');
create policy "voucher_toko_insert" on public.voucher_toko
  for insert with check (auth.role() = 'authenticated');
create policy "voucher_toko_update" on public.voucher_toko
  for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "voucher_toko_delete" on public.voucher_toko
  for delete using (auth.role() = 'authenticated');

-- (Opsional) Auto-update updated_at saat row di-edit
create or replace function public.touch_voucher_toko_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_voucher_toko_touch on public.voucher_toko;
create trigger trg_voucher_toko_touch
  before update on public.voucher_toko
  for each row execute function public.touch_voucher_toko_updated_at();
