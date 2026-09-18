-- Migration: tabel jejak — siapa menginput apa, kapan.
-- Jalankan di Supabase: SQL Editor → New Query → paste → Run.
--
-- Satu baris = satu kali tombol simpan ditekan. Tabel entries menyimpan
-- HASILnya (hari ini 96.000), tabel ini menyimpan RIWAYAT PERBUATANnya
-- (jam 14:32 Jaya menambah 3 Kopi Lain). Keduanya perlu: yang pertama untuk
-- menghitung kas, yang kedua untuk menjawab "siapa yang input ini".
--
-- App tetap jalan tanpa tabel ini — jejaknya saja yang kosong. Jadi aman
-- dijalankan kapan pun, termasuk setelah app-nya sudah live.

create table if not exists public.jejak (
  id       bigint generated always as identity primary key,
  -- Tanggal DATA yang disentuh (bukan tanggal orang menyentuhnya), supaya
  -- jejaknya nempel di baris Riwayat yang bersangkutan.
  date     date not null,
  aksi     text not null check (aksi in ('tambah','ubah','hapus','voucher','saldo')),
  -- Nama tampil, diambil app dari user_metadata.nama atau bagian depan email.
  oleh     text not null,
  email    text,
  -- Ini yang sebenarnya dipercaya: diisi server dari token, bukan dari kiriman
  -- app. Kolom `oleh`/`email` cuma untuk dibaca manusia.
  user_id  uuid not null default auth.uid(),
  rincian  jsonb not null default '{}'::jsonb,
  -- Saat tombol ditekan di HP. Bisa jauh lebih awal dari `diterima` kalau
  -- kirimannya sempat mengantre menunggu sinyal.
  waktu    timestamptz not null default now(),
  diterima timestamptz not null default now()
);

create index if not exists ix_jejak_date  on public.jejak (date);
create index if not exists ix_jejak_waktu on public.jejak (waktu);

-- Realtime: Riwayat yang sedang terbuka ikut menampilkan input orang lain
-- tanpa perlu di-refresh.
do $$
begin
  alter publication supabase_realtime add table public.jejak;
exception when duplicate_object then null;
end $$;

alter table public.jejak enable row level security;

drop policy if exists "jejak_select" on public.jejak;
drop policy if exists "jejak_insert" on public.jejak;

create policy "jejak_select" on public.jejak
  for select using (auth.role() = 'authenticated');
-- Hanya boleh menulis jejak atas nama diri sendiri.
create policy "jejak_insert" on public.jejak
  for insert with check (auth.role() = 'authenticated' and user_id = auth.uid());

-- Sengaja TIDAK ada policy update & delete: jejak yang bisa disunting bukan
-- jejak. Kalau suatu saat perlu dibersihkan, lewat Dashboard dengan service
-- role — bukan dari app.
