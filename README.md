# Kasir Warkopsaja

Pencatatan kas harian warung kopi. Live di **https://kasir.balanglompo.com**

Tidak ada backend. Browser bicara langsung ke Supabase. Hosting di GitHub Pages.

## Menjalankan lokal

```bash
npm install
npm run dev      # http://localhost:5173
```

```bash
npm run build    # hasil ke dist/
npm run preview  # cek hasil build sebelum push
```

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
| `csv.js` | export riwayat |
| `pages/` | Login, HariIni, VoucherToko, Gajian, Riwayat |
| `components/` | Icon, ProductIcon, AnimatedIDR, Skeleton |

Aturannya: komponen tidak memanggil Supabase langsung, dan `model.js` tidak
tahu apa-apa soal React maupun jaringan. Kalau butuh menambah retry atau
penanganan offline, tempatnya `db.js` saja.

## Kunci Supabase

Ada di `src/db.js`. Yang dipakai anon key — memang untuk dipublikasikan, yang
menjaga data adalah RLS policy di Supabase, bukan kerahasiaan kunci ini.

Pendaftaran akun publik **dimatikan** di Supabase (Authentication → Allow new
users to sign up). Akun baru dibuat lewat Dashboard → Authentication → Add user.

## Dependency

Versi dipin eksak tanpa `^` atau `~`. Tidak ada backend yang menyaring rilis
baru, jadi tanpa pin, `npm install` yang menarik minor baru bisa mematahkan
kasir yang live tanpa satu baris kode pun berubah. Update = ubah di
`package.json`, jalankan lokal, pastikan jalan, baru push.

## Berkas lain

- `MANUAL.md` — panduan pemakaian untuk yang menjaga warkop
- `import_riwayat.sql` — import riwayat awal dari CSV
- `voucher_toko_migration.sql` — bikin tabel `voucher_toko` + RLS
