# Kasir Warkopsaja

Pencatatan kas harian warung kopi. Live di **https://kasir.balanglompo.com**

Tidak ada backend. Browser bicara langsung ke Supabase. Hosting di GitHub Pages.

## Menjalankan lokal

```bash
npm install
npm run dev      # http://localhost:5173
```

```bash
npm test         # tes rumus uang + antrean offline
npm run build    # hasil ke dist/
npm run preview  # cek hasil build sebelum push
```

Tes jalan otomatis di CI sebelum build, jadi rumus yang salah tidak ikut
ter-deploy. Datanya memakai 37 entri nyata dari `import_riwayat.sql`.

## Deploy

`git push` ke `main` → GitHub Actions build → live. Lihat `.github/workflows/deploy.yml`.

Yang disajikan adalah isi `dist/`, bukan isi repo — jadi jangan mengedit file
hasil build. `CNAME` ada di `public/` supaya ikut tersalin ke `dist/`; kalau
dipindah, custom domain akan lepas tiap deploy.

## Isi src/

| file | isi |
|---|---|
| `main.jsx` | titik masuk: font, styles, render |
| `App.jsx` | sidebar, header, perpindahan tab |
| `db.js` | **satu-satunya** yang menyentuh Supabase |
| `model.js` | aturan & rumus uang. Fungsi murni, tanpa I/O, tanpa React |
| `hooks.js` | state yang dipakai lintas halaman |
| `format.js` | angka & tanggal jadi teks |
| `toast.js` | notifikasi |
| `sfx.js` | bunyi ketuk/ketik, disintesis Web Audio — tanpa berkas audio |
| `fx.js` | riak & denyut sentuhan, satu listener untuk seluruh app |
| `csv.js` | export riwayat |
| `outbox.js` | antrean kiriman saat sinyal putus |
| `jejak.js` | siapa menginput apa — nama penginput & ringkasannya |
| `sw.js` | service worker: kerangka app disimpan di HP supaya bisa dibuka tanpa sinyal |
| `pages/` | Login, HariIni, VoucherToko, Gajian, Riwayat |
| `components/` | Icon, ProductIcon, Logo, AnimatedIDR, Skeleton |

Aturannya: komponen tidak memanggil Supabase langsung, dan `model.js` tidak
tahu apa-apa soal React maupun jaringan. Kalau butuh menambah retry atau
penanganan offline, tempatnya `db.js` saja.

## App Android

Yang dipasang di HP bukan salinan app, melainkan pembungkus setebal ±20 KB
yang membuka `kasir.balanglompo.com` di mesin Chrome milik HP itu, tanpa
address bar (TWA — Trusted Web Activity). Akibatnya isi app tetap diperbarui
lewat `git push` seperti biasa; APK cuma perlu dibuat ulang kalau nama, ikon,
atau warnanya berubah.

```bash
bash scripts/buat-keystore.sh   # sekali seumur hidup app; butuh Docker
```

Skrip itu membuat kunci penanda tangan, mengisi
`public/.well-known/assetlinks.json` dengan sidik jarinya, dan menyebutkan
tiga `gh secret set` yang perlu dijalankan. Setelah assetlinks-nya ikut
ter-deploy, APK dibuat dari **Actions → Build APK Android → Run workflow**;
hasilnya (APK + AAB) menempel di halaman run itu.

Kuncinya jangan sampai hilang atau bocor: hilang berarti app yang sudah
terpasang tidak bisa di-update, bocor berarti orang lain bisa menerbitkan
"update" atas namanya. Berkasnya sudah masuk `.gitignore` — repo ini publik.

Tanpa APK pun app tetap bisa dipasang: buka situsnya di Chrome HP →
menu → **Tambahkan ke layar utama**.

## Offline

`src/sw.js` menyimpan kerangka app (HTML, JS, CSS) di HP, jadi app tetap
terbuka waktu WiFi warkop putus — input masuk antrean `outbox.js` dan
terkirim sendiri saat sinyal kembali. Data dari Supabase sengaja **tidak**
pernah disajikan dari cache: angka basi yang terlihat seperti angka benar
lebih berbahaya daripada badge Offline yang jujur.

Daftar berkas yang disimpan dibuat saat build oleh plugin kecil di
`vite.config.js` — nama berkas hasil build ber-hash, jadi tidak bisa ditulis
tangan.

## Kunci Supabase

Ada di `src/db.js`. Yang dipakai anon key — memang untuk dipublikasikan, yang
menjaga data adalah RLS policy di Supabase, bukan kerahasiaan kunci ini.

Pendaftaran akun publik **dimatikan** di Supabase (Authentication → Allow new
users to sign up). Akun baru dibuat lewat Dashboard → Authentication → Add user.

Nama yang menempel di jejak input diambil dari User Metadata akun. Isi
`{ "nama": "Jaya" }` di Dashboard → Authentication → pilih user → User
Metadata. Kalau kosong, yang dipakai bagian depan email — jalan, tapi jelek
dibaca di riwayat.

## Dependency

Versi dipin eksak tanpa `^` atau `~`. Tidak ada backend yang menyaring rilis
baru, jadi tanpa pin, `npm install` yang menarik minor baru bisa mematahkan
kasir yang live tanpa satu baris kode pun berubah. Update = ubah di
`package.json`, jalankan lokal, pastikan jalan, baru push.

## Berkas lain

- `MANUAL.md` — panduan pemakaian untuk yang menjaga warkop
- `import_riwayat.sql` — import riwayat awal dari CSV
- `voucher_toko_migration.sql` — bikin tabel `voucher_toko` + RLS
- `jejak_migration.sql` — bikin tabel `jejak` (siapa menginput apa) + RLS.
  Opsional: tanpa tabel ini app tetap jalan, jejaknya saja yang kosong.
- `twa-manifest.json` — konfigurasi pembungkus APK (nama, ikon, warna, paket)
- `scripts/buat-keystore.sh` — bikin kunci penanda tangan APK lewat Docker
- `public/manifest.webmanifest` — identitas app saat dipasang di layar utama;
  dibaca juga oleh Bubblewrap saat membungkus APK
