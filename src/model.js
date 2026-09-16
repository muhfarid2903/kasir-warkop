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

// Hitung agregat voucher (drop & laku × harga/gaji v2k) untuk satu tanggal.
// vtData berbentuk: { '2026-05-01': { dadi: {drop, laku}, dio: {...}, ... }, ... }
export function voucherForDate(date, vtData) {
  const dayMap = vtData?.[date] || {};
  let drop = 0, laku = 0;
  TOKO.forEach(t => { const r = dayMap[t.id]; if (r) { drop += r.drop||0; laku += r.laku||0; } });
  return { drop, laku, gaji: laku * V2K.gaji, penjualan: laku * V2K_SETORAN, komisiToko: laku * (V2K.komisi_toko||0) };
}

// Sum voucher untuk semua tanggal di [start..end] (inklusif), hanya yang >= cutoff.
export function voucherInRange(start, end, vtData) {
  let drop = 0, laku = 0;
  Object.keys(vtData || {}).forEach(d => {
    if (d < VOUCHER_TOKO_CUTOFF) return;
    if (d >= start && d <= end) {
      const r = voucherForDate(d, vtData); drop += r.drop; laku += r.laku;
    }
  });
  return { drop, laku, gaji: laku * V2K.gaji, penjualan: laku * V2K_SETORAN, komisiToko: laku * (V2K.komisi_toko||0) };
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

// Baris entri ada dua bentuk: RINGKAS (cuma kolom angka, dari muat awal) dan
// LENGKAP (plus quantities & expenses). Yang ringkas tidak punya kunci
// quantities sama sekali, jadi pengecekannya tegas — bukan menebak dari {} kosong.
export function hasDetail(entry) {
  return entry != null && entry.quantities !== undefined;
}

// === Hitungan satu hari ===

export function productTotals(quantities) {
  let totalQty=0, totalSales=0, totalGaji=0;
  PRODUCTS.forEach(p => { const q=quantities?.[p.id]||0; totalQty+=q; totalSales+=q*p.price; totalGaji+=q*p.gaji; });
  return { totalQty, totalSales, totalGaji };
}

// Cash masuk disimpan di larik yang sama dengan pengeluaran, ditandai type:'cashin'.
export function splitExpenses(list) {
  const items = (list || []).filter(e => e.type !== 'cashin');
  const cash  = (list || []).filter(e => e.type === 'cashin');
  const sum = (xs) => xs.reduce((s,e) => s+(e.amount||0), 0);
  return { items, cash, expGross: sum(items), cashGross: sum(cash) };
}

// Ringkasan form "Hari Ini" sebelum disimpan (pengeluaran & cash masih terpisah).
export function draftTotals(quantities, expenses, cashIns) {
  const { totalQty, totalSales, totalGaji } = productTotals(quantities);
  const totalExpense = (expenses || []).reduce((s,e) => s+(e.amount||0), 0);
  const totalCashIn = (cashIns || []).reduce((s,e) => s+(e.amount||0), 0);
  return { totalQty, totalSales, totalGaji, totalExpense, totalCashIn, sisaKas: totalSales-totalGaji-totalExpense+totalCashIn };
}

// Entri siap simpan. expenseList sudah gabungan; cash masuk bertanda type:'cashin'.
// Pengeluaran bersih = kotor − cash masuk, jadi cash masuk mengurangi pengeluaran
// hari itu (bukan menambah penjualan).
export function buildEntry(date, quantities, expenseList) {
  const { totalSales, totalGaji } = productTotals(quantities);
  const { expGross, cashGross } = splitExpenses(expenseList);
  const totalPengeluaran = expGross - cashGross;
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
export function accumulateEntry(existing, date, { quantities, expenses, cashIns }) {
  const accQty = { ...(existing?.quantities || {}) };
  PRODUCTS.forEach(p => { accQty[p.id] = (accQty[p.id]||0) + (quantities?.[p.id]||0); });
  const barangKeluar = (expenses || []).filter(e => (e.amount||0)>0 || (e.desc||'').trim()!=='');
  const uangMasuk = (cashIns || []).filter(e => (e.amount||0)>0 || (e.desc||'').trim()!=='').map(e => ({...e, type:'cashin'}));
  const accExpenses = [...(existing?.expenses || []), ...barangKeluar, ...uangMasuk];
  return buildEntry(date, accQty, accExpenses);
}

// Total satu hari termasuk setoran voucher toko — dipakai baris Riwayat & export CSV.
// totalPengeluaran diambil dari entri bila ada; entri lama yang belum punya kolom
// itu dihitung ulang dari daftarnya.
export function entryDayTotals(entry, voucherToko) {
  const { items, cash, expGross, cashGross } = splitExpenses(entry.expenses);
  const totalPengeluaran = entry.totalPengeluaran != null ? entry.totalPengeluaran : (expGross - cashGross);
  const voucher = voucherForDate(entry.date, voucherToko);
  const totalPenjualan = (entry.totalPenjualan||0) + voucher.penjualan;
  const totalGaji = (entry.gaji||0) + voucher.gaji;
  return {
    expItems: items, cashItems: cash, expGross, cashGross,
    totalPengeluaran, voucher, totalPenjualan, totalGaji,
    sisaKas: totalPenjualan - totalGaji - totalPengeluaran,
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
  const monthStart = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
  const all = Object.values(summaries);

  // All-time → kasSekarang (posisi riil)
  const ePenjualanAll = all.reduce((s,e)=>s+(e.totalPenjualan||0),0);
  const eGajiAll = all.reduce((s,e)=>s+(e.gaji||0),0);
  const ePengeluaranAll = all.reduce((s,e)=>s+(e.totalPengeluaran||0),0);
  const vAll = voucherInRange('1900-01-01','9999-12-31', voucherToko);
  const kasSekarang = initialSaldo + (ePenjualanAll + vAll.penjualan) - (eGajiAll + vAll.gaji) - ePengeluaranAll;

  // Bulan berjalan
  const monthEntries = all.filter(e => e.date >= monthStart);
  const ePenjualan = monthEntries.reduce((s,e)=>s+(e.totalPenjualan||0),0);
  const eGaji = monthEntries.reduce((s,e)=>s+(e.gaji||0),0);
  const totalPengeluaran = monthEntries.reduce((s,e)=>s+(e.totalPengeluaran||0),0);
  const vMonth = voucherInRange(monthStart, '9999-12-31', voucherToko);
  const totalPenjualan = ePenjualan + vMonth.penjualan;
  const totalGaji = eGaji + vMonth.gaji;
  // Saldo awal bulan = kas akhir bulan lalu (carry-over, biar rumus tetap konsisten)
  const saldoAwalBulan = kasSekarang - totalPenjualan + totalGaji + totalPengeluaran;

  const todayStr = dateToISO(now);
  const y = new Date(now.getTime()); y.setDate(y.getDate()-1);
  const yestStr = dateToISO(y);
  const tE = summaries[todayStr], yE = summaries[yestStr];
  const tV = voucherForDate(todayStr, voucherToko); const yV = voucherForDate(yestStr, voucherToko);
  const hasToday = !!tE || tV.drop>0 || tV.laku>0;
  const hasYest = !!yE || yV.drop>0 || yV.laku>0;
  const todayKas = hasToday ? (((tE?.totalPenjualan||0)+tV.penjualan) - ((tE?.gaji||0)+tV.gaji) - (tE?.totalPengeluaran||0)) : 0;
  const yestKas = hasYest ? (((yE?.totalPenjualan||0)+yV.penjualan) - ((yE?.gaji||0)+yV.gaji) - (yE?.totalPengeluaran||0)) : 0;
  return { totalPenjualan, totalGaji, totalPengeluaran, kasSekarang, saldoAwalBulan, monthStart, todayKas, yestKas, hasToday, hasYest };
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
