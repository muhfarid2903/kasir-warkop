# Manual Penggunaan — Kasir Warkopsaja

Aplikasi pencatatan kas harian warung kopi. Mencakup penjualan, pengeluaran, gaji karyawan (Jaya), dan voucher 2000 yang dititipkan ke toko.

URL: **https://kasir.balanglompo.com**

---

## Daftar Isi
1. [Konsep Dasar](#1-konsep-dasar)
2. [Login & Setup Awal](#2-login--setup-awal)
3. [Menu Hari Ini](#3-menu-hari-ini)
4. [Menu Voucher Toko](#4-menu-voucher-toko)
5. [Menu Gajian](#5-menu-gajian)
6. [Menu Riwayat](#6-menu-riwayat)
7. [Export CSV](#7-export-csv)
8. [Tips & Praktik Terbaik](#8-tips--praktik-terbaik)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Konsep Dasar

### Produk yang dijual
| Produk | Harga | Gaji Jaya |
|---|---:|---:|
| Kopi Vietnam Drip | Rp 8.000 | Rp 1.500 |
| Teh | Rp 5.000 | Rp 1.000 |
| Kopi Lain | Rp 6.000 | Rp 1.300 |
| Es Kopi Gula Aren | Rp 15.000 | Rp 2.000 |
| Es Kopi Caramel | Rp 15.000 | Rp 2.000 |
| Voucher 2000 | Rp 2.000 | Rp 500 |
| Paket Mingguan Lite | Rp 14.000 | Rp 1.500 |
| Paket Bulanan | Rp 34.000 | Rp 5.000 |
| PS4 (1 Jam) | Rp 10.000 | Rp 2.000 |

### Periode Gajian
Setiap bulan dibagi 2 periode:
- **Awal Bulan**: tanggal 1–14 (gajian tgl 14)
- **Akhir Bulan**: tanggal 15–28 (gajian tgl 28)

Tanggal 29–31 (kalau ada) otomatis masuk ke **Awal Bulan periode berikutnya** sebagai "Sisa dari [bulan]" (label oranye).

### Rumus Sisa Kas
```
Sisa Kas = Penjualan − Gaji Jaya − Pengeluaran + Cash Masuk
```

`Cash Masuk` = uang masuk yang bukan dari penjualan hari itu (mis. pelanggan bayar hutang lama).

### Voucher 2000 — Aturan Khusus (sejak 1 Mei 2026)
Voucher 2000 dititipkan ke 5 toko: **Dadi, Dio, H Rahim, Anci, Nahrul**. Dipisah dari Hari Ini:
- **Drop** = stok yang dititipkan ke toko (tidak menggerakkan kas/gaji)
- **Laku** = laporan setoran toko (baru ini yang masuk penjualan & gaji Jaya)

Per voucher laku:
- Harga jual Rp 2.000 → toko ambil komisi Rp 500 → **setoran ke kas Rp 1.500**
- Gaji Jaya Rp 500

Tujuannya: gaji Jaya keluar bersamaan dengan uang masuk dari toko, jadi tidak perlu nombok dari modal.

---

## 2. Login & Setup Awal

### Login pertama kali
1. Buka https://kasir.balanglompo.com
2. Klik **Daftar** kalau belum punya akun, isi email & password (min 6 karakter)
3. Cek email untuk konfirmasi akun
4. Login dengan akun yang sudah dikonfirmasi

### Set Saldo Awal
Saldo awal = uang kas yang sudah ada sebelum Anda mulai pakai aplikasi. Anchor titik nol untuk semua perhitungan ke depan.

1. Buka menu **Riwayat**
2. Di bar **Saldo Awal** paling atas, klik ikon pensil
3. Masukkan jumlah → **Simpan**

> Saldo awal otomatis ikut ke perhitungan Kas Saat Ini.

### Mode Tema
Di sidebar (paling bawah), klik **Mode terang** / **Mode gelap** untuk ganti tema.

---

## 3. Menu Hari Ini

Tempat utama mencatat aktivitas harian: penjualan, pengeluaran, dan cash masuk.

### Layout
- **Kas Saat Ini** (hero besar) — total kas warkop sekarang, dengan delta hari ini di bawahnya
- **Banner Gajian** — muncul kalau mendekati / tepat di hari gajian (lihat di bawah)
- **Date picker** — tanggal yang sedang diinput (default hari ini); kalau sudah ada data muncul "Sudah tercatat: …"
- **Kartu produk** — input jumlah laku per produk
- **Inline summary** — Penjualan · Gaji · Untung/Rugi (auto-update)
- **Kartu catatan** — Pengeluaran & Cash Masuk
- **Tombol Simpan** — bawah

### Cara input penjualan
1. Pilih **tanggal** (default hari ini)
2. Klik tombol **+** atau ketik langsung jumlah laku per produk
3. Lihat inline summary di bawah produk: Penjualan · Gaji · Untung/Rugi

> Untuk tanggal **≥ 1 Mei 2026**, baris Voucher 2000 tidak muncul di sini. Pakai menu **Voucher Toko**.

### Cara input pengeluaran
1. Klik pill **Pengeluaran** (warna merah)
2. Isi keterangan (cth: "Susu", "Galon") dan jumlahnya
3. Bisa tambah beberapa pengeluaran sekaligus
4. Klik × untuk hapus baris yang salah

### Cara input Cash Masuk
Catat uang masuk yang **bukan dari penjualan hari itu** — misal pelanggan bayar hutang lama. Uang masuk ke kas tanpa menambah penjualan/gaji.

1. Klik pill **Cash Masuk** (warna hijau)
2. Isi keterangan (cth: "Pak Budi bayar hutang") dan jumlahnya

> Jangan input ini ke jumlah laku produk — nanti gaji Jaya ikut nambah padahal sebenarnya tidak ada penjualan.

### Simpan data
Klik tombol **Simpan** di bawah.

> Kalau tanggal yang dipilih **sudah ada datanya**, input baru akan **DITAMBAHKAN** (akumulasi), bukan menimpa. Cocok untuk shift pagi → sore tanpa harus rekap dulu.

### Banner Gajian (countdown)
Di atas date picker, kalau mendekati tanggal payday muncul banner:
- **Hari Ini Gajian!** — tepat di tgl 14 atau 28
- **Gajian H−N** — N hari sebelum payday

Banner menampilkan total gaji yang harus dibayar di periode tersebut.

---

## 4. Menu Voucher Toko

Khusus untuk pencatatan voucher 2000 yang dititipkan ke 5 toko.

> **Hanya berlaku untuk tanggal ≥ 1 Mei 2026.** Sebelum itu data voucher tetap di Hari Ini seperti biasa.

### Layout
- **Date picker + tombol Info (?)** — di atas, klik `?` untuk munculkan/tutup panel info (Drop vs Laku, komisi toko, gaji)
- **Kartu per toko** — Dadi, Dio, H Rahim, Anci, Nahrul. Tiap kartu punya: Stok Awal · Drop hari ini · Laku hari ini · Stok Akhir
- **Tombol Simpan Voucher Hari Ini**
- **Rekap Periode** — di bawah, lihat ringkasan periode berjalan + sisa stok per toko

### Konsep "Drop" vs "Laku"

| | Drop | Laku |
|---|---|---|
| **Apa?** | Stok yang Anda titipkan ke toko | Voucher yang sudah terjual & toko setor uang |
| **Kas** | TIDAK menggerakkan kas | Setoran masuk = laku × Rp 1.500 |
| **Komisi toko** | — | Rp 500 per voucher (sudah dipotong dari setoran) |
| **Gaji Jaya** | TIDAK menggerakkan gaji | Gaji = laku × Rp 500 |
| **Kapan dicatat** | Di tanggal Anda titip | Di tanggal toko LAPOR / SETOR |

### Cara input
1. Pilih tanggal (≥ 1 Mei 2026)
2. Per toko:
   - **Stok Awal**: otomatis terhitung dari riwayat (drop − laku akumulatif sampai sebelum tanggal ini)
   - **Drop hari ini**: berapa voucher yang dititip hari ini
   - **Laku hari ini**: berapa yang dilaporkan toko
   - **Stok Akhir**: otomatis (Stok Awal + Drop − Laku)
3. Footer kartu memunculkan Setoran kas & Gaji Jaya (hanya muncul kalau ada laku)
4. Klik **Simpan Voucher Hari Ini**

### Skenario lengkap
**1 Mei** — Titip 100 ke Dadi
→ Tgl 1 Mei, Dadi: drop=100, laku=0 → Simpan. Stok Dadi: 100

**5 Mei** — Dadi setor, lapor 30 laku
→ Tgl 5 Mei, Dadi: drop=0, laku=30 → Simpan. Stok Dadi: 70. Setoran kas Rp 45.000, gaji Jaya Rp 15.000

**8 Mei** — Dadi setor lagi, 20 laku
→ Tgl 8 Mei, Dadi: drop=0, laku=20 → Simpan. Stok Dadi: 50

**10 Mei** — Refill 50
→ Tgl 10 Mei, Dadi: drop=50, laku=0 → Simpan. Stok Dadi: 100

**Hari yang sama drop & laku** — pagi titip 50 ke Dio, sorenya 20 laku
→ Tgl tersebut, Dio: drop=50, laku=20 → Simpan. Stok Dio bertambah 30.

### Validasi
- Kalau **Laku > Stok** yang tersedia, muncul **"Laku melebihi stok"** (warna merah)
- Cek apakah salah toko, atau ada drop yang lupa dicatat sebelumnya

### Rekap Periode
Di bawah kartu toko ada rekap untuk periode berjalan (Awal Bulan tgl 1–14 atau Akhir Bulan 15–28):
- Total Drop & Laku periode
- Gaji Jaya periode (laku × Rp 500)
- Penjualan periode (laku × Rp 1.500 ke kas)
- Sisa stok per toko di akhir periode

---

## 5. Menu Gajian

Rekap gaji per periode (2 periode per bulan).

### Periode yang aktif (current)
Kartu hero motivasional dengan:
- Period label: **MEI 2026 · AKHIR BULAN** (atau AWAL BULAN)
- Countdown pill di kanan: **"Tinggal N hari lagi"**, **"Besok gajian!"**, atau **"Hari ini gajian!"**
- **Gajiku** (besar, di tengah) — total yang sudah terkumpul sampai detik ini
- Progress bar + "Sudah N hari kerja · X% jalan"
- Day rows di bawah (per tanggal, dengan nominal harian)

### Periode yang lalu (past)
Kartu header dengan:
- Period label
- **Gajiku** (di kanan)
- Status badge: **Sudah gajian** / **Lagi jalan** / **Nanti**
- Day rows di bawah

### "Sisa dari [bulan]"
Tanggal 29, 30, 31 dari bulan sebelumnya (yang tidak ada di periode reguler) otomatis masuk ke **Awal Bulan periode ini** dengan label oranye **"SISA DARI [BULAN]"**.

### Empty state
Kalau periode belum ada catatan: **"Periode ini masih kosong"** atau **"Belum mulai catat"** (progress meta).

---

## 6. Menu Riwayat

Daftar semua hari yang ada datanya, urut dari terbaru ke terlama.

### Layout
- **Saldo Awal** (bar paling atas) — titik nol kas warkop, bisa di-edit pakai ikon pensil
- **Meta**: "X hari tersimpan · DD MMM – DD MMM"
- **Search + Export CSV** (icon download) — sejajar di atas list
- **List entri** — urut terbaru ke terlama

### Pencarian
Ketik di kotak search untuk filter:
- Tanggal (cth: `2026-04-15` atau `15 Apr`)
- Hari (cth: `senin`, `jumat`)
- Nama produk (cth: `kopi vietnam`, `voucher`)
- Keterangan pengeluaran/cash masuk (cth: `susu`, `galon`, `bayar hutang`)
- Nama toko (cth: `dadi`, `nahrul`)

### Tampilan entri (collapsed)
- Tanggal · Hari (kiri) — Untung/Rugi (kanan, hijau/merah)
- Pills produk yang terjual + voucher laku/drop
- Pills uang: `−Rp X keluar`, `+Rp Y cash`

### Detail entri (klik untuk expand)
- **Ringkasan**: Pemasukan, Gaji, Pengeluaran, Cash Masuk, Untung/Rugi Hari Ini
- **Rincian Gaji** — breakdown per produk, lengkap dengan voucher per toko + catatan drop ("semua terjual hari ini", "sisa N di toko", "ada laku dari stok sebelumnya")
- **Rincian Pengeluaran** — daftar item & total
- **Cash Masuk** — daftar pelanggan yang bayar hutang
- Tombol merah **Hapus Data Ini** — menghapus entri tanggal tersebut

> Hapus entri di Riwayat **TIDAK** menghapus data voucher toko untuk tanggal yang sama. Kalau ingin reset voucher, set ulang drop=0, laku=0 di menu Voucher Toko.

---

## 7. Export CSV

Hanya tersedia di **menu Riwayat** — klik icon download (⬇) di kanan kotak search.

Isi file:
- Per tanggal: qty per produk, kolom drop & laku per toko, total penjualan, gaji, pengeluaran (detail), cash masuk, sisa kas
- Baris **TOTAL** di paling bawah

> File CSV bisa dibuka di Excel, Google Sheets, atau Numbers.

---

## 8. Tips & Praktik Terbaik

### Rutinitas harian
**Pagi (buka warkop):**
- Cek **Kas Saat Ini** di Hari Ini — pastikan match dengan uang fisik

**Sepanjang hari:**
- Input penjualan saat ada waktu (boleh dibatch, akumulasi otomatis)
- Catat pengeluaran segera saat belanja (mudah lupa)

**Tutup warkop:**
- Pastikan semua transaksi sudah masuk
- Cocokkan **Untung/Rugi Hari Ini** dengan uang di laci

### Voucher Toko
- **Selalu** input drop di tanggal Anda titip, BUKAN tanggal lain
- **Selalu** input laku di tanggal toko lapor/setor, BUKAN tanggal voucher actually terjual ke pembeli
- Kalau toko setor sekaligus untuk beberapa hari, masukkan total laku-nya di tanggal setor saja
- Cek stok berjalan tiap minggu lewat Rekap Periode — kalau sisa terlalu banyak di toko tertentu, kurangi drop-nya

### Mendekati gajian
H-2 sebelum tanggal 14 / 28, banner countdown muncul di Hari Ini & kartu hero di Gajian jadi "urgent" (animasi pulsing). Cek total Gajiku & pastikan kas cukup.

### Cash Masuk
Pakai untuk uang masuk yang **bukan dari penjualan hari itu** (misal pelanggan bayar hutang minggu lalu). Jangan dimasukkan ke "jumlah laku produk" karena akan menambah gaji Jaya yang sebenarnya tidak ada.

---

## 9. Troubleshooting

### Status berubah jadi "Offline"
Koneksi internet putus. Badge "Offline" muncul di header. Data yang sudah disimpan tetap aman di server. Refresh halaman setelah internet kembali.

### Tombol "Simpan Voucher" error
Tabel `voucher_toko` belum dibuat di Supabase. Jalankan migrasi:
1. Supabase Dashboard → SQL Editor → New Query
2. Paste isi `voucher_toko_migration.sql` → Run

### Data tidak muncul setelah login
1. Pastikan sudah dikonfirmasi via email
2. Cek koneksi internet
3. Refresh halaman (Ctrl+R / Cmd+R)
4. Coba logout (di sidebar) lalu login ulang

### Salah input — gimana koreksi?
- **Penjualan/Pengeluaran/Cash Masuk**: buka Riwayat, klik entri tanggal yang salah → expand → **Hapus Data Ini** → input ulang dari Hari Ini
- **Voucher**: buka Voucher Toko, pilih tanggal yang salah, edit angka drop/laku → simpan (akan menimpa data lama)

### Kas Saat Ini tidak match dengan uang fisik
1. Cek apakah ada transaksi yang belum diinput
2. Periksa Riwayat 3–7 hari terakhir untuk angka yang janggal
3. Cek apakah **Saldo Awal** sudah benar (menu Riwayat)
4. Cek apakah ada voucher laku yang belum dicatat di Voucher Toko

### Lupa password
Saat ini belum ada flow reset password di app. Hubungi admin (Muhammad Farid).

---

## Kontak & Bantuan
- Repo source: https://github.com/muhfarid2903/kasir-warkop
- Untuk request fitur / report bug: hubungi admin

---

*Dokumen ini di-update 19 Mei 2026 mengikuti perubahan UI Steve Jobs treatment, rename term (Cash Masuk, Awal/Akhir Bulan), penambahan toko Nahrul, dan migrasi Saldo Awal ke menu Riwayat.*
