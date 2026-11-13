// Aturan main warkop dalam bentuk fungsi murni: tanpa I/O, tanpa React,
// tanpa menyentuh DOM atau jam dinding sendiri (tanggal "sekarang" selalu
// dioper dari pemanggil). Dipisah supaya rumus uang bisa diuji dan dibaca
// tanpa harus menjalankan seluruh app dulu.

// === Katalog ===

export const PRODUCTS = [
  { id: 'vietnam',  name: 'Kopi Vietnam Drip',  price: 8000,  gaji: 1500 },
  { id: 'teh',      name: 'Teh',                price: 5000,  gaji: 1000 },
  { id: 'kopilain', name: 'Kopi Lain',          price: 6000,  gaji: 1300 },
  { id: 'esaren',   name: 'Es Kopi Gula Aren',  price: 15000, gaji: 2000 },
  { id: 'escaramel',name: 'Es Kopi Caramel',    price: 15000, gaji: 2000 },
  { id: 'v2k',      name: 'Voucher 2000',       price: 2000,  gaji: 500,  komisi_toko: 500 },
  { id: 'v10k',     name: 'Paket Mingguan Lite',price: 14000, gaji: 1500 },
  { id: 'v1bln',    name: 'Paket Bulanan',      price: 34000, gaji: 5000 },
  { id: 'ps4',      name: 'PS4 (1 Jam)',        price: 10000, gaji: 2000 },
]

// === Tata letak input Hari Ini ===
// Diturunkan dari pemakaian NYATA, 72 hari sampai 17 Sep 2026:
//   kopilain  79% hari · 365 gelas
//   vietnam   68% hari · 333 gelas
//   teh       14% hari ·  23 gelas
//   esaren     3% · v1bln 3% · escaramel/v10k/ps4/v2k 0% (belum pernah)
// Rata-rata 1,67 jenis produk per hari, maksimum 3.
//
// Dua teratas dapat kartu besar, teh dapat chip, sisanya dilipat. Daftar ini
// sengaja statis dan bukan dihitung otomatis: muat awal hanya menarik kolom
// angka (lihat Fase 5), jadi quantities tidak tersedia untuk menghitungnya.
// Kalau kebiasaan berubah, ubah di sini — angkanya bisa dicek ulang dari CSV
// export Riwayat.
export const PRODUK_UTAMA = ['kopilain', 'vietnam']
export const PRODUK_SEKUNDER = ['teh']

// Keterangan pengeluaran yang paling sering diketik ulang, dari 112 baris
// dalam 72 hari: susu 47x, good day 18x, gelas 6x, air 5x. Dua teratas saja
// sudah 58% dari seluruh baris. Nominalnya berubah-ubah jadi tidak ikut
// disetel — yang dihemat pengetikan keterangannya.
export const PRESET_PENGELUARAN = ['Susu', 'Good Day', 'Gelas', 'Air']

// Voucher 2000 dititipkan ke toko: drop = stok dititipkan, laku = laporan setoran toko.
// Mulai 1 Mei 2026, gaji & penjualan v2k mengikuti laku per toko (bukan input harian).
export const TOKO = [
  { id: 'dadi',   name: 'Dadi'    },
  { id: 'dio',    name: 'Dio'     },
  { id: 'hrahim', name: 'H Rahim' },
  { id: 'anci',   name: 'Anci'    },
  { id: 'nahrul', name: 'Nahrul'  },
]

export const VOUCHER_TOKO_CUTOFF = '2026-05-01'
export const V2K = PRODUCTS.find(p => p.id === 'v2k')
// Setoran toko per voucher = harga jual − komisi toko (mulai 1 Mei 2026).
// Toko ambil 500/voucher sebagai komisi mereka, hanya menyetor 1500 ke kas warkop.
export const V2K_SETORAN = V2K.price - (V2K.komisi_toko || 0)

// === Tanggal ===

// Tanggal lokal (bukan UTC) — penting: toISOString() memakai UTC, sehingga
// antara 00:00–06:59 WIB tanggalnya mundur sehari. Pakai komponen lokal.
export function dateToISO(dt) { return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0'); }
export function todayISO() { return dateToISO(new Date()); }

// === Periode gajian ===
// Dua periode per bulan: tgl 1–14 (gajian 14) dan 15–28 (gajian 28).
// Tanggal 29–31 tidak punya periodenya sendiri, jadi dilimpahkan ke periode
// "Awal Bulan" bulan berikutnya — itulah overflow* di bawah.
export function getPayPeriods(year, month) {
  const mm = String(month+1).padStart(2,'0');
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear  = month === 0 ? year - 1 : year;
  const pmm = String(prevMonth+1).padStart(2,'0');
  const lastDayPrev = new Date(year, month, 0).getDate();
  const overflowDays = [];
  for (let d = 29; d <= lastDayPrev; d++) overflowDays.push(d);
  return [
    { label:'Awal Bulan', start:year+'-'+mm+'-01', end:year+'-'+mm+'-14', payday:14, startDay:1, endDay:14,
      overflowStart: overflowDays.length>0 ? prevYear+'-'+pmm+'-'+String(overflowDays[0]).padStart(2,'0') : null,
      overflowEnd: overflowDays.length>0 ? prevYear+'-'+pmm+'-'+String(lastDayPrev).padStart(2,'0') : null,
      overflowDays, prevYear, prevMonth },
    { label:'Akhir Bulan', start:year+'-'+mm+'-15', end:year+'-'+mm+'-28', payday:28, startDay:15, endDay:28,
      overflowStart:null, overflowEnd:null, overflowDays:[], prevYear, prevMonth },
  ];
}

// === Voucher toko ===

// Ada dua tempat uang: KAS TOKO (yang dihitung app ini) dan KAS PEMILIK (di
// luar app). Setoran voucher yang ditandai kePemilik adalah penjualan — ikut
// hasil usaha dan gaji Jaya — tapi uangnya tidak pernah masuk laci toko.
//
//   penjualan = semua laku × setoran        (hasil usaha)
//   kePemilik = laku bertanda kePemilik × setoran
//   masukKas  = penjualan − kePemilik       (yang benar-benar masuk kas toko)
function rekapVoucher(drop, laku, lakuKePemilik) {
  const penjualan = laku * V2K_SETORAN;
  const kePemilik = lakuKePemilik * V2K_SETORAN;
  return { drop, laku, gaji: laku * V2K.gaji, penjualan, kePemilik, masukKas: penjualan - kePemilik, komisiToko: laku * (V2K.komisi_toko||0) };
}

// Hitung agregat voucher (drop & laku × harga/gaji v2k) untuk satu tanggal.
// vtData berbentuk: { '2026-05-01': { dadi: {drop, laku, kePemilik}, dio: {...}, ... }, ... }
export function voucherForDate(date, vtData) {
  const dayMap = vtData?.[date] || {};
  let drop = 0, laku = 0, lakuKePemilik = 0;
  TOKO.forEach(t => {
    const r = dayMap[t.id];
    if (!r) return;
    drop += r.drop||0; laku += r.laku||0;
    if (r.kePemilik) lakuKePemilik += r.laku||0;
  });
  return rekapVoucher(drop, laku, lakuKePemilik);
}

// Sum voucher untuk semua tanggal di [start..end] (inklusif), hanya yang >= cutoff.
export function voucherInRange(start, end, vtData) {
  let drop = 0, laku = 0, lakuKePemilik = 0;
  Object.keys(vtData || {}).forEach(d => {
    if (d < VOUCHER_TOKO_CUTOFF) return;
    if (d >= start && d <= end) {
      const r = voucherForDate(d, vtData);
      drop += r.drop; laku += r.laku; lakuKePemilik += r.kePemilik / V2K_SETORAN;
    }
  });
  return rekapVoucher(drop, laku, lakuKePemilik);
}

// Stok berjalan per toko sampai (≤) endDate.
export function voucherStockPerToko(endDate, vtData) {
  const stok = {}; TOKO.forEach(t => stok[t.id] = { drop:0, laku:0 });
  Object.keys(vtData || {}).forEach(d => {
    if (d > endDate) return;
    const dayMap = vtData[d] || {};
    TOKO.forEach(t => { const r = dayMap[t.id]; if (r) { stok[t.id].drop += r.drop||0; stok[t.id].laku += r.laku||0; } });
  });
  return stok;
}

// Stok per toko SEBELUM tanggal (eksklusif).
export function voucherStockBefore(date, vtData) {
  const stok = {}; TOKO.forEach(t => stok[t.id] = { drop:0, laku:0 });
  Object.keys(vtData || {}).forEach(d => {
    if (d >= date) return;
    const dayMap = vtData[d] || {};
    TOKO.forEach(t => { const r = dayMap[t.id]; if (r) { stok[t.id].drop += r.drop||0; stok[t.id].laku += r.laku||0; } });
  });
  return stok;
}

// Kopi sedang libur? Benar bila sudah ada riwayat, tapi tidak ada satu pun
// penjualan produk dalam 14 hari sampai `hariIni`. Cukup baris ringkas:
// totalPenjualan entri hanya memuat produk (voucher toko dihitung terpisah
// sejak 1 Mei 2026). Pemakai baru (belum ada entri sama sekali) bukan libur.
export function kopiSedangLibur(entries, hariIni, jangka = 14) {
  const semua = Object.values(entries || {})
  if (semua.length === 0) return false
  const awal = new Date(hariIni + 'T00:00:00'); awal.setDate(awal.getDate() - (jangka - 1))
  const batas = dateToISO(awal)
  return !semua.some(e => e.date >= batas && e.date <= hariIni && (e.totalPenjualan || 0) > 0)
}

// Kebiasaan satu toko, untuk kartu di Voucher Toko:
//   terakhirSetor — tanggal laku terakhir SEBELUM `tanggal` (null = belum pernah)
//   hariSejak     — berapa hari dari terakhirSetor ke `tanggal`
//   dropUmum      — jumlah drop yang paling sering dipakai toko ini (null = belum ada)
// Dari pola nyata: toko menyetor seluruh stok lalu diisi ulang dengan jumlah
// yang itu-itu saja (70, 140, 200).
export function infoToko(tokoId, tanggal, vtData) {
  let terakhirSetor = null
  const hitungDrop = new Map()
  Object.keys(vtData || {}).forEach(d => {
    if (d >= tanggal) return
    const r = vtData[d]?.[tokoId]
    if (!r) return
    if ((r.laku || 0) > 0 && (!terakhirSetor || d > terakhirSetor)) terakhirSetor = d
    if ((r.drop || 0) > 0) hitungDrop.set(r.drop, (hitungDrop.get(r.drop) || 0) + 1)
  })
  let dropUmum = null, terbanyak = 0
  hitungDrop.forEach((n, jumlah) => { if (n > terbanyak || (n === terbanyak && jumlah > dropUmum)) { terbanyak = n; dropUmum = jumlah } })
  const hariSejak = terakhirSetor
    ? Math.round((new Date(tanggal + 'T00:00:00') - new Date(terakhirSetor + 'T00:00:00')) / 86400000)
    : null
  return { terakhirSetor, hariSejak, dropUmum }
}

// Baris entri ada dua bentuk: RINGKAS (cuma kolom angka, dari muat awal) dan
// LENGKAP (plus quantities & expenses). Yang ringkas tidak punya kunci
// quantities sama sekali, jadi pengecekannya tegas — bukan menebak dari {} kosong.
export function hasDetail(entry) {
  return entry != null && entry.quantities !== undefined;
}

// Menyegarkan daftar entri dari server tanpa membuang detail yang sudah
// ditarik. Dulu tiap penyegaran menimpa baris LENGKAP dengan baris RINGKAS,
// sedangkan penanda "detail sudah dimuat" tetap menyala — rincian Riwayat
// kosong sampai app dimuat ulang.
//
// Baris lengkap dipertahankan selama tiga angkanya masih sama dengan yang di
// server. Kalau berbeda, berarti ada yang menulis sementara app tidak
// mendengar: pakai ringkasan barunya, dan laporkan tanggalnya supaya detailnya
// ditarik ulang. Tanggal yang tidak lagi ada di server dibuang.
export function gabungRingkasan(lama, ringkasan) {
  const entries = {}
  const perluDetail = []
  const sama = (a, b) => (a.totalPenjualan||0) === (b.totalPenjualan||0)
    && (a.gaji||0) === (b.gaji||0)
    && (a.totalPengeluaran||0) === (b.totalPengeluaran||0)
  Object.keys(ringkasan || {}).forEach(d => {
    const r = ringkasan[d]
    const l = lama?.[d]
    if (hasDetail(l) && sama(l, r)) { entries[d] = l; return }
    entries[d] = r
    if (hasDetail(l)) perluDetail.push(d)
  })
  return { entries, perluDetail }
}

// === Hitungan satu hari ===

export function productTotals(quantities) {
  let totalQty=0, totalSales=0, totalGaji=0;
  PRODUCTS.forEach(p => { const q=quantities?.[p.id]||0; totalQty+=q; totalSales+=q*p.price; totalGaji+=q*p.gaji; });
  return { totalQty, totalSales, totalGaji };
}

// Tiga jenis baris tinggal di satu larik `expenses`:
//   (tanpa type) pengeluaran sungguhan — susu, gelas
//   type:'cashin' uang masuk yang bukan penjualan hari itu
//   type:'setor'  uang yang pindah dari kas toko ke kas pemilik. BUKAN biaya:
//                 tidak mengurangi hasil usaha, hanya mengurangi kas toko.
export function splitExpenses(list) {
  const items = (list || []).filter(e => e.type !== 'cashin' && e.type !== 'setor');
  const cash  = (list || []).filter(e => e.type === 'cashin');
  const setor = (list || []).filter(e => e.type === 'setor');
  const sum = (xs) => xs.reduce((s,e) => s+(e.amount||0), 0);
  return { items, cash, setor, expGross: sum(items), cashGross: sum(cash), setorGross: sum(setor) };
}

const jumlahkan = (xs) => (xs || []).reduce((s,e) => s+(e.amount||0), 0);

// Ringkasan form "Hari Ini" sebelum disimpan (tiap jenis baris masih terpisah).
// hasil = untung/rugi usaha; sisaKas = yang tersisa di kas toko sesudah
// setoran ke pemilik.
export function draftTotals(quantities, expenses, cashIns, setors) {
  const { totalQty, totalSales, totalGaji } = productTotals(quantities);
  const totalExpense = jumlahkan(expenses);
  const totalCashIn = jumlahkan(cashIns);
  const totalSetor = jumlahkan(setors);
  const hasil = totalSales - totalGaji - totalExpense + totalCashIn;
  return { totalQty, totalSales, totalGaji, totalExpense, totalCashIn, totalSetor, hasil, sisaKas: hasil - totalSetor };
}

// Entri siap simpan. expenseList sudah gabungan (lihat splitExpenses).
// totalPengeluaran = yang BERSIH keluar dari kas toko: pengeluaran + setoran
// ke pemilik − cash masuk. Artinya kolom ini, baris ringkas, fungsi server
// tambah_entri, dan rumus kas tidak berubah sedikit pun oleh adanya 'setor'.
export function buildEntry(date, quantities, expenseList) {
  const { totalSales, totalGaji } = productTotals(quantities);
  const { expGross, cashGross, setorGross } = splitExpenses(expenseList);
  const totalPengeluaran = expGross + setorGross - cashGross;
  return {
    date,
    quantities,
    expenses: expenseList,
    totalPenjualan: totalSales,
    gaji: totalGaji,
    totalPengeluaran,
    sisaKas: totalSales - totalGaji - totalPengeluaran,
  };
}

// Gabungkan input Hari Ini ke atas entri yang sudah tersimpan. Dipakai dua
// tempat: saat simpan langsung, dan saat kiriman tertunda dikirim ulang —
// keduanya harus menumpuk dengan cara yang sama persis.
//
// existing boleh null (tanggal belum punya entri). Salin qty lama dulu, jangan
// bangun ulang dari PRODUCTS: entri lama bisa memuat produk yang sudah tidak
// ada di daftar, dan membangun ulang akan membuangnya diam-diam.
export function accumulateEntry(existing, date, { quantities, expenses, cashIns, setors }) {
  const accQty = { ...(existing?.quantities || {}) };
  PRODUCTS.forEach(p => { accQty[p.id] = (accQty[p.id]||0) + (quantities?.[p.id]||0); });
  // Nominal negatif tidak pernah sah (arahnya sudah ditentukan jenis barisnya);
  // dipaksa nol supaya baris yang keterangannya terisi tidak membalik arah uang.
  const rapikan = (e) => ({ ...e, amount: Math.max(0, e.amount || 0) });
  const barangKeluar = (expenses || []).map(rapikan).filter(e => e.amount>0 || (e.desc||'').trim()!=='');
  const uangMasuk = (cashIns || []).map(rapikan).filter(e => e.amount>0 || (e.desc||'').trim()!=='').map(e => ({...e, type:'cashin'}));
  const kePemilik = (setors || []).map(rapikan).filter(e => e.amount>0 || (e.desc||'').trim()!=='').map(e => ({...e, type:'setor'}));
  const accExpenses = [...(existing?.expenses || []), ...barangKeluar, ...uangMasuk, ...kePemilik];
  return buildEntry(date, accQty, accExpenses);
}

// Selisih yang ditambahkan SATU kali simpan Hari Ini: entri yang dibangun dari
// input itu saja. Karena semua total linear, menambahkan selisih ini di server
// sama dengan accumulateEntry di HP — itu yang membuat simpan bisa dikirim
// sebagai satu langkah atomik (lihat kiriman_migration.sql).
export function selisihInput(date, input) {
  return accumulateEntry(null, date, input)
}

// Kebalikan satu kali simpan Hari Ini — untuk tombol Batalkan. Jumlah per
// produk dikurangi (tidak pernah di bawah nol), baris yang barusan ditambahkan
// dibuang (yang terakhir cocok, dari belakang), dan TOTAL dikurangi selisih
// input itu — bukan dihitung ulang dengan harga sekarang, supaya hari yang
// tersimpan dengan harga lama tidak ikut berubah.
export function kurangiEntri(kini, date, input) {
  const s = selisihInput(date, input)
  const quantities = { ...(kini?.quantities || {}) }
  Object.keys(s.quantities).forEach(id => {
    if (!s.quantities[id]) return
    quantities[id] = Math.max(0, (quantities[id] || 0) - s.quantities[id])
  })
  const expenses = [...(kini?.expenses || [])]
  const kunci = (x) => [x.type || '', (x.desc || '').trim(), x.amount || 0].join('|')
  s.expenses.forEach(baris => {
    for (let i = expenses.length - 1; i >= 0; i--) {
      if (kunci(expenses[i]) === kunci(baris)) { expenses.splice(i, 1); break }
    }
  })
  const totalPenjualan = (kini?.totalPenjualan || 0) - s.totalPenjualan
  const gaji = (kini?.gaji || 0) - s.gaji
  const totalPengeluaran = (kini?.totalPengeluaran || 0) - s.totalPengeluaran
  return { date, quantities, expenses, totalPenjualan, gaji, totalPengeluaran, sisaKas: totalPenjualan - gaji - totalPengeluaran }
}

// Entri yang tidak berisi apa pun lagi (sesudah dibatalkan) lebih baik dihapus
// daripada dibiarkan sebagai baris nol di Riwayat.
export function entriKosong(e) {
  return !Object.values(e?.quantities || {}).some(n => (n || 0) > 0)
    && (e?.expenses || []).length === 0
    && !(e?.totalPenjualan || 0) && !(e?.gaji || 0) && !(e?.totalPengeluaran || 0)
}

// Tebakan layar sesudah simpan, untuk tanggal yang baru punya baris RINGKAS
// (detailnya belum datang). Dulu baris ringkas dianggap kosong dan diganti
// input ini saja, jadi Kas turun sebesar seluruh isi hari itu sampai angka
// server datang — saat offline bisa berjam-jam. Bentuknya tetap ringkas.
export function tambahRingkas(ringkas, date, input) {
  const s = selisihInput(date, input)
  return {
    date,
    totalPenjualan: (ringkas?.totalPenjualan || 0) + s.totalPenjualan,
    gaji: (ringkas?.gaji || 0) + s.gaji,
    totalPengeluaran: (ringkas?.totalPengeluaran || 0) + s.totalPengeluaran,
  }
}

// Total satu hari termasuk setoran voucher toko — dipakai baris Riwayat & export CSV.
// totalPengeluaran diambil dari entri bila ada; entri lama yang belum punya kolom
// itu dihitung ulang dari daftarnya.
//
// Tiga angka, tiga nama:
//   hasil     = penjualan − gaji − pengeluaran sungguhan + cash masuk
//               (untung/rugi usaha hari itu)
//   kePemilik = setoran voucher bertanda kePemilik + baris 'setor'
//   sisaKas   = hasil − kePemilik  (perubahan kas toko; sama dengan dulu)
export function entryDayTotals(entry, voucherToko) {
  const { items, cash, setor, expGross, cashGross, setorGross } = splitExpenses(entry.expenses);
  const totalPengeluaran = entry.totalPengeluaran != null ? entry.totalPengeluaran : (expGross + setorGross - cashGross);
  const voucher = voucherForDate(entry.date, voucherToko);
  const totalPenjualan = (entry.totalPenjualan||0) + voucher.penjualan;
  const totalGaji = (entry.gaji||0) + voucher.gaji;
  const sisaKas = totalPenjualan - totalGaji - totalPengeluaran - voucher.kePemilik;
  const kePemilik = setorGross + voucher.kePemilik;
  return {
    expItems: items, cashItems: cash, setorItems: setor, expGross, cashGross, setorGross,
    totalPengeluaran, voucher, totalPenjualan, totalGaji,
    kePemilik, hasil: sisaKas + kePemilik, sisaKas,
  };
}

// === Ringkasan lintas hari ===

// `now` dioper masuk supaya fungsinya tetap murni dan bisa diuji dengan
// tanggal apa pun, bukan hanya hari saat tes dijalankan.
//
// `summaries` cukup berisi { date, totalPenjualan, gaji, totalPengeluaran } —
// tidak perlu quantities/expenses. Itu yang membuat muat awal bisa mengambil
// kolom angka saja.
export function computeKasSummary(summaries, voucherToko, initialSaldo, now) {
  const all = Object.values(summaries);

  // Posisi kas riil = saldo awal + seluruh pemasukan − gaji − pengeluaran,
  // sejak hari pertama. Bukan per bulan: yang ditanya kasir "sekarang ada
  // berapa", dan itu tidak mengenal batas bulan.
  const ePenjualanAll = all.reduce((s,e)=>s+(e.totalPenjualan||0),0);
  const eGajiAll = all.reduce((s,e)=>s+(e.gaji||0),0);
  const ePengeluaranAll = all.reduce((s,e)=>s+(e.totalPengeluaran||0),0);
  // Voucher: hanya yang masuk kas toko (masukKas). Setoran yang langsung ke
  // kas pemilik tetap penjualan, tapi tidak pernah ada di laci.
  const vAll = voucherInRange('1900-01-01','9999-12-31', voucherToko);
  const kasSekarang = initialSaldo + (ePenjualanAll + vAll.masukKas) - (eGajiAll + vAll.gaji) - ePengeluaranAll;

  // Selisih hari ini, untuk baris di bawah angka besar.
  const todayStr = dateToISO(now);
  const tE = summaries[todayStr];
  const tV = voucherForDate(todayStr, voucherToko);
  const hasToday = !!tE || tV.drop>0 || tV.laku>0;
  const todayKas = hasToday ? (((tE?.totalPenjualan||0)+tV.masukKas) - ((tE?.gaji||0)+tV.gaji) - (tE?.totalPengeluaran||0)) : 0;

  return { kasSekarang, todayKas, hasToday };
}

// Gaji terkumpul satu periode, termasuk limpahan tgl 29–31 bulan sebelumnya.
export function periodGaji(entries, voucherToko, period) {
  const main = Object.values(entries).filter(e=>e.date>=period.start&&e.date<=period.end).reduce((s,e)=>s+(e.gaji||0),0);
  const overflow = (period.overflowStart&&period.overflowEnd) ? Object.values(entries).filter(e=>e.date>=period.overflowStart&&e.date<=period.overflowEnd).reduce((s,e)=>s+(e.gaji||0),0) : 0;
  const vMain = voucherInRange(period.start, period.end, voucherToko);
  const vOver = (period.overflowStart&&period.overflowEnd) ? voucherInRange(period.overflowStart, period.overflowEnd, voucherToko) : { gaji:0 };
  return main + overflow + vMain.gaji + vOver.gaji;
}

// Banner gajian di halaman Hari Ini. null = tidak ditampilkan hari ini.
export function computePaydayInfo(entries, voucherToko, now) {
  const day = now.getDate(); const year = now.getFullYear(); const month = now.getMonth();
  const periods = getPayPeriods(year, month); let show=null, period=null;
  if (day===14||day===28) { period=day===14?periods[0]:periods[1]; show='today'; }
  else if (day>=12&&day<=13) { period=periods[0]; show='upcoming'; }
  else if (day>=26&&day<=27) { period=periods[1]; show='upcoming'; }
  if (!show||!period) return null;
  return { show, period, totalGaji: periodGaji(entries, voucherToko, period), daysLeft:show==='today'?0:(period.payday-day), month };
}

// === Rekap per bulan ===
// Jumlah tiga angka (dan penjualan/pengeluaran) per 'YYYY-MM' dari daftar
// baris Riwayat. Baris "terhapus" (cuma jejak) dilewati. Dipakai kepala bulan
// di Riwayat.
export function rekapPerBulan(baris, voucherToko) {
  const out = {}
  ;(baris || []).forEach(e => {
    if (!e || e.terhapus) return
    const k = e.date.slice(0, 7)
    const t = entryDayTotals(e, voucherToko)
    const r = out[k] || (out[k] = { hari: 0, penjualan: 0, gaji: 0, pengeluaran: 0, hasil: 0, kePemilik: 0, kasToko: 0 })
    r.hari++
    r.penjualan += t.totalPenjualan
    r.gaji += t.totalGaji
    r.pengeluaran += t.expGross
    r.hasil += t.hasil
    r.kePemilik += t.kePemilik
    r.kasToko += t.sisaKas
  })
  return out
}
