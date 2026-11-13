# Kasir Warkopsaja

Pencatatan kas harian warung kopi. Live di **https://kasir.balanglompo.com**

Tidak ada backend. Browser bicara langsung ke Supabase. Hosting di GitHub Pages.

## Menjalankan lokal

```bash
npm install
npm run dev        # http://localhost:5173 — DATABASE TIRUAN, aman dicoba
npm run dev:asli   # tersambung ke Supabase produksi — menulis ke pembukuan asli!
```

`npm run dev` memakai `src/db.tiruan.js`: data di localStorage browser,
dibibit dari entri nyata + data voucher sintetis, dengan pita kuning "DATA
TIRUAN" di atas layar. Akun tiruannya tinggal diketuk di layar masuk. Dua tab
= dua HP: perubahan di satu tab sampai ke tab lain seperti realtime.

Gangguan bisa dipicu dari console browser:

| perintah | akibatnya |
|---|---|
| `__tiruan.putus(true)` / `putus(false)` | WiFi mati / nyala lagi |
| `__tiruan.hilangkanBalasan(1)` | tulisan berikutnya tersimpan, tapi app menerima "Failed to fetch" |
| `__tiruan.tolak(1)` | tulisan berikutnya ditolak server, seperti pelanggaran RLS |
| `__tiruan.kirimAuth()` | event auth dengan sesi baru, seperti saat token diperbarui |
| `__tiruan.lambat(2000)` | jaringan lambat |
| `__tiruan.reset()` | buang data tiruan, bibit ulang |

Pemilihannya dilakukan plugin kecil di `vite.config.js` yang membelokkan
impor `db.js`; tidak ada halaman yang tahu sedang memakai yang mana. URL &
anon key Supabase ada di `.env`.

```bash
npm run lint          # ESLint (aturan bawaan + aturan hook React)
npm test              # tes rumus uang + antrean offline
npm run build         # hasil ke dist/ — selalu database asli
npm run build:tiruan  # build berisi database tiruan, untuk dicoba lewat preview
npm run preview       # cek hasil build sebelum push
```

`build:tiruan` tidak bisa ter-deploy: CI menolak `dist/` yang berisi
database tiruan.

Lint dan tes jalan otomatis di CI sebelum build, jadi rumus yang salah tidak ikut
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
| `db.tiruan.js` | pengganti `db.js` untuk `npm run dev` — bentuk ekspornya harus sama |
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

## Pasang di HP

App ini PWA: buka situsnya di Chrome HP → menu → **Tambahkan ke layar
utama** (atau menu akun di app → **Pasang di HP**). Hasilnya ikon sendiri,
layar penuh tanpa address bar, dan tetap bisa dibuka tanpa sinyal. Isinya
ikut diperbarui lewat `git push` seperti biasa.

Pembungkus APK Android (TWA) pernah disiapkan lalu **dihentikan** (13 Nov
2026): ia hanya membungkus situs yang sama, tidak menambah kemampuan, tapi
menambah kunci penanda tangan yang harus dijaga seumur hidup app.

## Offline

`src/sw.js` menyimpan kerangka app (HTML, JS, CSS) di HP, jadi app tetap
terbuka waktu WiFi warkop putus — input masuk antrean `outbox.js` dan
terkirim sendiri saat sinyal kembali. Data dari Supabase sengaja **tidak**
disajikan dari cache service worker: angka basi yang terlihat seperti angka
benar lebih berbahaya daripada badge Offline yang jujur.

Satu pengecualian yang jujur: hasil muat terakhir yang berhasil disimpan di
HP beserta jamnya. Kalau app dibuka tanpa sinyal, Kas ditampilkan dari
simpanan itu — redup, dengan keterangan "Angka per 13 Nov 14.02 · belum
tersambung". Tanpa simpanan sama sekali yang tampil "—", bukan Rp0. Begitu
sinyal kembali, angka segar menggantikannya sendiri.

Kiriman yang **ditolak** server (bukan karena jaringan atau sesi habis) tidak
dibuang: pindah ke daftar "gagal terkirim" di header, dengan pilihan Coba
lagi atau Buang.

Daftar berkas yang disimpan dibuat saat build oleh plugin kecil di
`vite.config.js` — nama berkas hasil build ber-hash, jadi tidak bisa ditulis
tangan.

## Mengubah harga, tarif, atau daftar toko

Semuanya di `src/model.js`, lalu deploy seperti biasa.

- **Tarif voucher berubah** (harga, komisi toko, gaji per voucher): **tambah**
  baris baru di `TARIF_VOUCHER` dengan tanggal mulai berlakunya. Jangan ubah
  baris lama — riwayat dan Kas Toko sebelum tanggal itu tetap memakai tarif lama.
- **Toko berhenti**: beri `aktif: false` di `TOKO`. Jangan dihapus — stok dan
  setoran lamanya masih dihitung dari daftar itu. Toko tidak aktif yang masih
  punya stok tetap tampil sampai stoknya habis.
- **Toko baru**: tambah baris di `TOKO` dengan `id` baru yang tidak pernah
  dipakai sebelumnya.

## Kunci Supabase

Ada di `.env`, dibaca `src/db.js`. Yang dipakai anon key — memang untuk dipublikasikan, yang
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
- `kiriman_migration.sql` — fungsi `tambah_entri`: simpan Hari Ini atomik dan
  tahan kirim ulang (tanpa ini app memakai cara lama)
- `kas_pemilik_migration.sql` — kolom `voucher_toko.ke_pemilik` dan tabel
  `hitung_kas` (Cocokkan kas). Tanpa ini kedua fitur itu tersembunyi.
- `jejak_migration.sql` — bikin tabel `jejak` (siapa menginput apa) + RLS.
  Opsional: tanpa tabel ini app tetap jalan, jejaknya saja yang kosong.
- `public/manifest.webmanifest` — identitas app saat dipasang di layar utama
