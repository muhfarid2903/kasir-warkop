-- Peran akun, LANGKAH 1 dari 2: tandai siapa pemilik.
-- Jalankan di Supabase: SQL Editor → New Query → paste → Run.
--
-- Ganti GANTI_DENGAN_EMAIL_PEMILIK di bawah dengan email akun pemilik.
-- Semua akun lain otomatis ditandai kasir.
--
-- Peran disimpan di app_metadata, BUKAN user_metadata: app_metadata tidak
-- bisa diubah pengguna sendiri dari app, jadi kasir tidak bisa menaikkan
-- perannya sendiri.
--
-- SESUDAH menjalankan ini: keluar (Logout) lalu masuk lagi di app, supaya
-- token Anda membawa peran baru. Baru setelah itu jalankan
-- peran_2_aturan.sql.

do $$
declare
  email_pemilik text := 'GANTI_DENGAN_EMAIL_PEMILIK';
begin
  if not exists (select 1 from auth.users where lower(email) = lower(email_pemilik)) then
    raise exception 'Email pemilik "%" tidak ditemukan di auth.users — periksa ketikannya. Tidak ada yang diubah.', email_pemilik;
  end if;

  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"peran":"pemilik"}'::jsonb
   where lower(email) = lower(email_pemilik);

  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"peran":"kasir"}'::jsonb
   where lower(email) <> lower(email_pemilik);
end $$;

-- Periksa hasilnya:
select email, raw_app_meta_data->>'peran' as peran from auth.users order by email;
