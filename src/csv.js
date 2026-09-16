// Export riwayat ke CSV. Satu-satunya tempat yang menulis file ke disk.

import { ALL_PRODUCTS, TOKO, todayISO, voucherForDate, entryDayTotals } from './model.js'
import { DAYS } from './format.js'
import { showToast } from './toast.js'

function downloadCSV(filename, csvContent) {
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function exportRiwayatCSV(entries, voucherToko) {
  // Gabungkan tanggal dari entries + voucher_toko
  const dateSet = new Set(Object.keys(entries));
  Object.keys(voucherToko||{}).forEach(d => { const v = voucherForDate(d, voucherToko); if (v.laku>0||v.drop>0) dateSet.add(d); });
  const sortedDates = [...dateSet].sort();
  if(sortedDates.length===0){ showToast('Belum ada data untuk di-export'); return; }
  const prodHeaders = ALL_PRODUCTS.map(p=>p.name);
  const tokoHeaders = TOKO.flatMap(t => [t.name+' Drop', t.name+' Laku']);
  let rows = [['Tanggal','Hari', ...prodHeaders, 'Total Qty', ...tokoHeaders, 'Voucher Laku Total','Voucher Drop Total','Total Penjualan','Gaji','Pengeluaran (Detail)','Total Pengeluaran','Cash Masuk','Sisa Kas']];
  const totals = { prod: ALL_PRODUCTS.map(()=>0), toko: TOKO.flatMap(()=>[0,0]), vLaku:0, vDrop:0, sales:0, gaji:0, exp:0, cash:0 };
  sortedDates.forEach(d => {
    const e = entries[d] || { date:d, quantities:{}, expenses:[], totalPenjualan:0, gaji:0, totalPengeluaran:0 };
    const dt = new Date(d+'T00:00:00');
    const prodQtys = ALL_PRODUCTS.map(p => e.quantities?.[p.id] || 0);
    const totalQty = prodQtys.reduce((s,q)=>s+q,0);
    const tokoCells = []; let vLakuTotal=0, vDropTotal=0;
    TOKO.forEach(t => {
      const r = (voucherToko?.[d]||{})[t.id] || { drop:0, laku:0 };
      tokoCells.push(r.drop||0, r.laku||0); vLakuTotal += r.laku||0; vDropTotal += r.drop||0;
    });
    const { expGross, cashGross, totalPengeluaran: totalExp, totalPenjualan, totalGaji, sisaKas } = entryDayTotals(e, voucherToko);
    const expDetail = (e.expenses||[]).map(x => (x.type==='cashin'?'[CASH MASUK] ':'')+(x.desc||(x.type==='cashin'?'Cash Masuk':'Pengeluaran'))+' '+Math.round(x.amount)).join('; ');
    rows.push([d, DAYS[dt.getDay()], ...prodQtys, totalQty, ...tokoCells, vLakuTotal, vDropTotal, totalPenjualan, totalGaji, expDetail, expGross, cashGross, sisaKas]);
    prodQtys.forEach((q,i)=>totals.prod[i]+=q);
    tokoCells.forEach((c,i)=>totals.toko[i]+=c);
    totals.vLaku+=vLakuTotal; totals.vDrop+=vDropTotal;
    totals.sales+=totalPenjualan; totals.gaji+=totalGaji;
    totals.exp+=expGross; totals.cash+=cashGross;
  });
  const totQty = totals.prod.reduce((s,q)=>s+q,0);
  const totSisa = totals.sales - totals.gaji - (totals.exp - totals.cash);
  rows.push(['TOTAL','', ...totals.prod, totQty, ...totals.toko, totals.vLaku, totals.vDrop, totals.sales, totals.gaji, '', totals.exp, totals.cash, totSisa]);
  // Escape sel + cegah formula injection (=,+,-,@) pada sel teks. Angka murni
  // (mis. Sisa Kas negatif) dibiarkan agar tetap dihitung sebagai angka di Excel.
  const csvCell = (c) => {
    let s = String(c);
    const isNumber = typeof c === 'number' || (s.trim() !== '' && !isNaN(Number(s)));
    if (!isNumber && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g,'""') + '"';
  };
  const csv = rows.map(r => r.map(csvCell).join(',')).join('\n');
  downloadCSV('Riwayat_Warkopsaja_'+todayISO()+'.csv', csv);
  showToast('Riwayat berhasil di-export!');
}
