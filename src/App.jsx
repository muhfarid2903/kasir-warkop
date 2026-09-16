import { useState, useMemo, useEffect, useRef } from 'react'
import {
  supabaseReady,
  getSession, onAuthChange, signIn, signUp, signOut,
  loadSaldoAwal, saveSaldoAwal,
  loadEntries, saveEntry as dbSaveEntry, deleteEntry as dbDeleteEntry,
  loadVoucherToko, saveVoucherToko as dbSaveVoucherToko,
  subscribeRealtime,
} from './db.js'
import {
  PRODUCTS, TOKO, VOUCHER_TOKO_CUTOFF, V2K, V2K_SETORAN,
  todayISO, getPayPeriods,
  voucherForDate, voucherInRange, voucherStockPerToko, voucherStockBefore,
  draftTotals, buildEntry, entryDayTotals,
  computeKasSummary, computePaydayInfo, periodGaji,
} from './model.js'

const NAV_ITEMS = [
  { id:'input',   icon:'coffee', label:'Hari Ini',     shortLabel:'Hari Ini' },
  { id:'voucher', icon:'signal', label:'Voucher Toko', shortLabel:'Voucher'  },
  { id:'gajian',  icon:'dollar', label:'Gajian',       shortLabel:'Gajian'   },
  { id:'riwayat', icon:'clock',  label:'Riwayat',      shortLabel:'Riwayat'  },
];
const IDR = v => 'Rp' + Math.round(v).toLocaleString('id-ID');
const DAYS = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const MO = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
const ML = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
function fmtDate(d) { const dt = new Date(d+'T00:00:00'); return DAYS[dt.getDay()]+', '+dt.getDate()+' '+MO[dt.getMonth()]+' '+dt.getFullYear(); }
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

const Icon = ({type, size=18}) => {
  const s = {width:size,height:size,fill:"none",stroke:"currentColor",strokeWidth:1.8,strokeLinecap:"round",strokeLinejoin:"round",flexShrink:0,verticalAlign:"middle"};
  const P = {
    coffee:<><path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></>,
    dollar:<><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></>,
    clock:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></>,
    trash:<><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></>,
    download:<><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
    wallet:<><path d="M20 12V8H6a2 2 0 010-4h12v4"/><path d="M4 6v12a2 2 0 002 2h14v-4"/><path d="M18 12a2 2 0 000 4h4v-4z"/></>,
    calendar:<><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
    chart:<><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>,
    'trending-down':<><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/></>,
    banknote:<><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01"/><path d="M18 12h.01"/></>,
    coins:<><circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1110.34 18"/><path d="M7 6h1v4"/><path d="M16.71 13.88l.7.71-2.82 2.82"/></>,
    package:<><path d="M16.5 9.4l-9-5.19"/><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></>,
    store:<><path d="M3 9l1-5h16l1 5"/><path d="M5 9v11h14V9"/><path d="M9 22V13h6v9"/></>,
    signal:<><path d="M2 20l4-4 4 4"/><path d="M6 20V8"/><path d="M14 20l4-4 4 4"/><path d="M18 20V4"/></>,
    inbox:<><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/></>,
    search:<><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>,
    gift:<><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></>,
    'arrow-up':<><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></>,
    pencil:<><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></>,
    'log-out':<><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>,
    sun:<><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="6.34" y2="17.66"/><line x1="17.66" y1="6.34" x2="19.07" y2="4.93"/></>,
    moon:<><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></>,
    alert:<><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
    settings:<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></>,
    lock:<><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></>,
    'user-plus':<><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></>,
    menu:<><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>,
    x:<><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    'panel-left':<><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></>,
    user:<><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
  };
  return <svg viewBox="0 0 24 24" style={s}>{P[type]}</svg>;
};

// Product illustrations — silhouette stroke icons, dirancang per item agar
// identitasnya tetap kebaca di 12px (inline) maupun 24px (tile besar).
const ProductIcon = ({type, size=20}) => {
  const s = {width:size,height:size,fill:"none",stroke:"currentColor",strokeWidth:1.7,strokeLinecap:"round",strokeLinejoin:"round",flexShrink:0,verticalAlign:"middle"};
  const P = {
    // Kopi Vietnam Drip — phin filter di atas gelas
    vietnam: <>
      <rect x="7" y="3" width="10" height="4.5" rx="0.6"/>
      <line x1="8" y1="5.3" x2="16" y2="5.3"/>
      <line x1="12" y1="7.5" x2="12" y2="9.5"/>
      <path d="M5.5 11h13v5.5a4 4 0 01-4 4H9.5a4 4 0 01-4-4z"/>
      <path d="M18.5 13h1.5a1.8 1.8 0 010 3.6h-1.5"/>
    </>,
    // Teh — cup dengan benang + tag tea bag menggantung
    teh: <>
      <path d="M4 9.5h12v5.5a4 4 0 01-4 4H8a4 4 0 01-4-4z"/>
      <path d="M16 11h1.8a1.8 1.8 0 010 3.6H16"/>
      <line x1="10" y1="3" x2="10" y2="9.5"/>
      <rect x="8" y="2" width="4" height="2.4" rx="0.4"/>
    </>,
    // Kopi Lain — mug standar + 2 uap (beda silhouette dari vietnam)
    kopilain: <>
      <path d="M5 8.5h11v8.5a3.5 3.5 0 01-3.5 3.5H8.5A3.5 3.5 0 015 17z"/>
      <path d="M16 10.5h1.7a2 2 0 010 4H16"/>
      <path d="M8 3.5c0 1.2 1 1.2 1 2.4s-1 1.2-1 2.4"/>
      <path d="M12 3c0 1.2 1 1.2 1 2.4s-1 1.2-1 2.4"/>
    </>,
    // Voucher 2000 — bentuk tiket bernotch + WiFi arc kecil di tengah
    v2k: <>
      <path d="M3 7.5v1.7a1.5 1.5 0 010 3v1.6a1.5 1.5 0 010 3v0a2 2 0 002 2h14a2 2 0 002-2v0a1.5 1.5 0 010-3v-1.6a1.5 1.5 0 010-3V7.5a2 2 0 00-2-2H5a2 2 0 00-2 2z"/>
      <path d="M9 14.5a3 3 0 016 0"/>
      <path d="M11 16.6a1 1 0 012 0"/>
    </>,
    // Paket Mingguan Lite — kalender + simbol "1 minggu" (bar 7-day)
    v10k: <>
      <rect x="3" y="5" width="18" height="16" rx="2"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
      <line x1="8" y1="3" x2="8" y2="7"/>
      <line x1="16" y1="3" x2="16" y2="7"/>
      <rect x="6" y="13" width="12" height="4" rx="0.6"/>
    </>,
    // Paket Bulanan — kalender + grid bulan penuh
    v1bln: <>
      <rect x="3" y="5" width="18" height="16" rx="2"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
      <line x1="8" y1="3" x2="8" y2="7"/>
      <line x1="16" y1="3" x2="16" y2="7"/>
      <line x1="3" y1="14.5" x2="21" y2="14.5"/>
      <line x1="3" y1="18" x2="21" y2="18"/>
      <line x1="9" y1="10" x2="9" y2="21"/>
      <line x1="15" y1="10" x2="15" y2="21"/>
    </>,
    // PS4 (1 Jam) — gamepad dengan d-pad kiri + tombol kanan
    ps4: <>
      <path d="M6 9c-2.2 0-4 1.6-4 4.2v2.8a2 2 0 002 2h1.6a1.6 1.6 0 001.5-1.1l.4-1.2A1.6 1.6 0 019 14.7h6a1.6 1.6 0 011.5 1l.4 1.2a1.6 1.6 0 001.5 1.1H20a2 2 0 002-2v-2.8C22 10.6 20.2 9 18 9z"/>
      <line x1="6.5" y1="12.3" x2="9" y2="12.3"/>
      <line x1="7.75" y1="11" x2="7.75" y2="13.6"/>
      <circle cx="16" cy="11.5" r="0.7"/>
      <circle cx="17.8" cy="12.8" r="0.7"/>
      <circle cx="14.2" cy="12.8" r="0.7"/>
      <circle cx="16" cy="14.1" r="0.7"/>
    </>,
  };
  if (!P[type]) return null;
  return <svg viewBox="0 0 24 24" style={s}>{P[type]}</svg>;
};

function downloadCSV(filename, csvContent) {
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function exportRiwayatCSV(entries, voucherToko) {
  // Gabungkan tanggal dari entries + voucher_toko
  const dateSet = new Set(Object.keys(entries));
  Object.keys(voucherToko||{}).forEach(d => { const v = voucherForDate(d, voucherToko); if (v.laku>0||v.drop>0) dateSet.add(d); });
  const sortedDates = [...dateSet].sort();
  if(sortedDates.length===0){ showToast('Belum ada data untuk di-export'); return; }
  const prodHeaders = PRODUCTS.map(p=>p.name);
  const tokoHeaders = TOKO.flatMap(t => [t.name+' Drop', t.name+' Laku']);
  let rows = [['Tanggal','Hari', ...prodHeaders, 'Total Qty', ...tokoHeaders, 'Voucher Laku Total','Voucher Drop Total','Total Penjualan','Gaji','Pengeluaran (Detail)','Total Pengeluaran','Cash Masuk','Sisa Kas']];
  const totals = { prod: PRODUCTS.map(()=>0), toko: TOKO.flatMap(()=>[0,0]), vLaku:0, vDrop:0, sales:0, gaji:0, exp:0, cash:0 };
  sortedDates.forEach(d => {
    const e = entries[d] || { date:d, quantities:{}, expenses:[], totalPenjualan:0, gaji:0, totalPengeluaran:0 };
    const dt = new Date(d+'T00:00:00');
    const prodQtys = PRODUCTS.map(p => e.quantities?.[p.id] || 0);
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

// Hook: animasi angka smooth (easeOutCubic ~500ms)
function useAnimatedNumber(target, duration = 600) {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const rafRef = useRef(null);
  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (target - from) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else { fromRef.current = target; setValue(target); }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);
  return value;
}

const AnimatedIDR = ({ value, className = '' }) => {
  const v = useAnimatedNumber(Number(value) || 0);
  return <span className={"num-anim "+className}>{IDR(v)}</span>;
};

// Skeleton untuk halaman input saat loading data dari Supabase
function SkeletonInput() {
  return (
    <>
      <div className="kas-hero">
        <span className="sk sk-line" style={{width:90,height:11,margin:"0 auto 18px",display:"block"}}/>
        <span className="sk sk-line xl" style={{width:"min(320px,80%)",height:64,margin:"0 auto",display:"block"}}/>
        <div style={{display:"flex",gap:6,justifyContent:"center",marginTop:26,flexWrap:"wrap"}}>
          {[0,1,2].map(i => <span key={i} className="sk sk-line" style={{width:120,height:22,borderRadius:14}}/>)}
        </div>
      </div>
      <div style={{display:"flex",gap:14,marginBottom:18,alignItems:"center"}}>
        <span className="sk" style={{width:170,height:38,borderRadius:11}}/>
        <span className="sk sk-line" style={{width:160,height:11}}/>
      </div>
      <div className="card">
        {[0,1,2,3,4].map(i => (
          <div key={i} className="sk-row">
            <span className="sk sk-circle"/>
            <div style={{flex:1}}>
              <span className="sk sk-line lg" style={{width:'60%'}}/>
              <span className="sk sk-line" style={{width:'35%',marginTop:6,height:9}}/>
            </div>
            <span className="sk" style={{width:140,height:42,borderRadius:13}}/>
          </div>
        ))}
      </div>
    </>
  );
}

function LoginScreen({ onSession }) {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      if (mode === 'signin') {
        onSession(await signIn(email, password));
      } else {
        const session = await signUp(email, password);
        if (session) { onSession(session); }
        else { showToast('Cek email untuk konfirmasi akun'); setMode('signin'); }
      }
    } catch(ex) { setErr(ex.message || 'Gagal'); }
    setBusy(false);
  }

  return (
    <div className="app">
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",padding:"40px 20px"}}>
        <form onSubmit={submit} style={{width:400,maxWidth:"100%"}}>
          <div className="login-hero">
            <div className="login-hero-logo"><Icon type="coffee" size={32}/></div>
            <h1 className="login-hero-title">Warkopsaja</h1>
            <p className="login-hero-tag">Catat hari, lihat hasilnya.</p>
          </div>
          <div className="card" style={{margin:0,padding:"28px 26px"}}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" required autoFocus value={email} onChange={e=>setEmail(e.target.value)} placeholder="nama@contoh.com"/>
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-input" type="password" required minLength={6} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Minimal 6 karakter"/>
            </div>
            {err && <div style={{padding:"10px 12px",background:"var(--red-bg)",color:"var(--red)",border:"1px solid var(--red-border)",borderRadius:10,fontSize:12,marginBottom:12}}>{err}</div>}
            <button type="submit" className="btn-save" disabled={busy} style={{marginTop:4}}>
              {busy ? 'Memproses…' : (mode==='signin' ? 'Masuk' : 'Daftar')}
            </button>
            <div style={{textAlign:"center",marginTop:14,fontSize:12,color:"var(--text2)"}}>
              {mode==='signin' ? 'Belum punya akun? ' : 'Sudah punya akun? '}
              <a href="#" onClick={(e)=>{e.preventDefault();setErr('');setMode(mode==='signin'?'signup':'signin');}} style={{color:"var(--accent)",fontWeight:600,textDecoration:"none"}}>
                {mode==='signin' ? 'Daftar' : 'Masuk'}
              </a>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function App() {
  const [page, setPage] = useState("input");
  const [session, setSession] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [syncStatus, setSyncStatus] = useState(supabaseReady ? "loading" : "not_configured");
  const [loading, setLoading] = useState(supabaseReady);
  const [entries, setEntries] = useState({});
  const [voucherToko, setVoucherToko] = useState({});
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [quantities, setQuantities] = useState(()=>{ const q={}; PRODUCTS.forEach(p=>q[p.id]=0); return q; });
  const [expenses, setExpenses] = useState([]);
  const [cashIns, setCashIns] = useState([]);
  const [saving, setSaving] = useState(false);
  const [openDetail, setOpenDetail] = useState(null);
  // Mode edit entri (dari tab Riwayat) — mengganti nilai, bukan menambah
  const [editingDate, setEditingDate] = useState(null);
  const [editQty, setEditQty] = useState({});
  const [editExpenses, setEditExpenses] = useState([]);
  const [editCashIns, setEditCashIns] = useState([]);
  const [editVoucher, setEditVoucher] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [initialSaldo, setInitialSaldo] = useState(0);
  const [editingSaldo, setEditingSaldo] = useState(false);
  const [saldoInput, setSaldoInput] = useState('');
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('theme') || 'light'; } catch(e) { return 'light'; }
  });
  const [voucherDraft, setVoucherDraft] = useState({});
  const [voucherSaving, setVoucherSaving] = useState(false);
  const [voucherInfoOpen, setVoucherInfoOpen] = useState(false);
  const voucherDateRef = useRef(null);
  const hariIniDateRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.innerWidth >= 900;
  });
  // Auto-close sidebar when navigating on mobile; auto-open when crossing into desktop
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 900px)');
    const handler = (e) => setSidebarOpen(e.matches);
    if (mq.addEventListener) mq.addEventListener('change', handler);
    else mq.addListener(handler);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', handler);
      else mq.removeListener(handler);
    };
  }, []);
  const handleNav = (id) => {
    setPage(id);
    if (typeof window !== 'undefined' && window.innerWidth < 900) setSidebarOpen(false);
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('theme', theme); } catch(e) {}
  }, [theme]);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = () => setMenuOpen(false);
    const t = setTimeout(() => document.addEventListener('click', handler), 0);
    return () => { clearTimeout(t); document.removeEventListener('click', handler); };
  }, [menuOpen]);

  // Cegah wheel/scroll mengubah nilai input number
  useEffect(() => {
    const onWheel = (e) => {
      const el = e.target;
      if (el && el.tagName === 'INPUT' && el.type === 'number' && document.activeElement === el) {
        el.blur();
      }
    };
    document.addEventListener('wheel', onWheel, { passive: true });
    return () => document.removeEventListener('wheel', onWheel);
  }, []);

  // Auto-select isi input number saat di-focus, supaya ketikan baru menggantikan nilai lama (0 → 1, bukan 01/10)
  useEffect(() => {
    const onFocusIn = (e) => {
      const el = e.target;
      if (el && el.tagName === 'INPUT' && el.type === 'number') {
        setTimeout(() => { try { el.select(); } catch(_) {} }, 0);
      }
    };
    document.addEventListener('focusin', onFocusIn);
    return () => document.removeEventListener('focusin', onFocusIn);
  }, []);

  // Auth: cek session awal + listen perubahan
  useEffect(() => {
    if (!supabaseReady) { setAuthChecked(true); return; }
    getSession().then(s => {
      setSession(s);
      setAuthChecked(true);
    });
    return onAuthChange(s => setSession(s));
  }, []);

  // Load data + realtime subscribe — hanya setelah login
  useEffect(() => {
    if (!supabaseReady || !session) { if (!session) { setEntries({}); setVoucherToko({}); setInitialSaldo(0); } setLoading(false); return; }
    setLoading(true);
    let cancelled = false;
    (async () => {
      // Saldo awal
      const saldo = await loadSaldoAwal();
      if (!cancelled && saldo != null) setInitialSaldo(saldo);
      // Entries
      const { data: map, error } = await loadEntries();
      if (cancelled) return;
      if (error) { setSyncStatus('offline'); setLoading(false); return; }
      setEntries(map);
      // Voucher Toko (opsional — abaikan error jika tabel belum ada)
      const { data: vmap, error: vtErr } = await loadVoucherToko();
      if (!cancelled && !vtErr) setVoucherToko(vmap);
      setSyncStatus('online');
      setLoading(false);
    })();
    // Realtime
    const unsubscribe = subscribeRealtime({
      onEntry: (ev) => {
        setEntries(prev => {
          const next = { ...prev };
          if (ev.type === 'delete') delete next[ev.date];
          else next[ev.entry.date] = ev.entry;
          return next;
        });
      },
      onSaldoAwal: (value) => setInitialSaldo(value),
      onVoucher: (ev) => {
        setVoucherToko(prev => {
          const next = { ...prev };
          if (ev.type === 'delete') {
            if (next[ev.date]) { const dm = { ...next[ev.date] }; delete dm[ev.tokoId]; if (Object.keys(dm).length===0) delete next[ev.date]; else next[ev.date] = dm; }
          } else {
            next[ev.date] = { ...(next[ev.date]||{}), [ev.tokoId]: ev.cell };
          }
          return next;
        });
      },
    });
    return () => { cancelled = true; unsubscribe(); };
  }, [session]);

  async function saveInitialSaldo(val) {
    const v = parseInt(val) || 0;
    setInitialSaldo(v);
    setEditingSaldo(false);
    try {
      if (session) await saveSaldoAwal(v);
      showToast('Saldo awal disimpan: '+IDR(v));
    } catch(e) { showToast('Gagal simpan saldo: '+e.message); }
  }

  const existingEntry = entries[selectedDate] || null;
  const inputTotals = useMemo(
    () => draftTotals(quantities, expenses, cashIns),
    [quantities, expenses, cashIns]
  );

  // Sinkronkan draft voucher dari data tersimpan saat tanggal/voucherToko berubah
  useEffect(() => {
    const day = voucherToko[selectedDate] || {};
    const next = {};
    TOKO.forEach(t => {
      const r = day[t.id] || { drop:0, laku:0 };
      next[t.id] = { drop: String(r.drop||0), laku: String(r.laku||0) };
    });
    setVoucherDraft(next);
  }, [selectedDate, voucherToko]);

  function setDraft(tokoId, field, val) {
    setVoucherDraft(prev => ({ ...prev, [tokoId]: { ...(prev[tokoId]||{drop:'0',laku:'0'}), [field]: val } }));
  }

  async function saveVoucherTokoDay() {
    if (selectedDate < VOUCHER_TOKO_CUTOFF) { showToast('Voucher Toko hanya untuk 1 Mei 2026 dan setelahnya'); return; }
    const stockBefore = voucherStockBefore(selectedDate, voucherToko);
    const rows = TOKO.map(t => {
      const d = voucherDraft[t.id] || { drop:'0', laku:'0' };
      return { tokoId: t.id, drop: parseInt(d.drop)||0, laku: parseInt(d.laku)||0 };
    });
    // Pengaman: tolak bila ada toko dengan laku melebihi stok (stok awal + drop hari ini)
    const over = rows.find(r => { const sB = stockBefore[r.tokoId]; return r.laku > ((sB.drop||0)-(sB.laku||0)) + r.drop; });
    if (over) { const t = TOKO.find(x=>x.id===over.tokoId); showToast('Laku '+(t?t.name:over.tokoId)+' melebihi stok — perbaiki dulu'); return; }
    setVoucherSaving(true);
    try {
      if (session) await dbSaveVoucherToko(selectedDate, rows);
      // Optimistic local update
      setVoucherToko(prev => {
        const next = { ...prev }; const dayMap = { ...(next[selectedDate]||{}) };
        rows.forEach(r => { dayMap[r.tokoId] = { drop: r.drop, laku: r.laku }; });
        next[selectedDate] = dayMap; return next;
      });
      showToast('Voucher tersimpan · '+fmtDate(selectedDate));
    } catch(e) { showToast('Gagal simpan voucher: '+e.message); }
    setVoucherSaving(false);
  }

  function changeQty(id, delta) { setQuantities(prev => ({...prev, [id]: Math.max(0, (prev[id]||0)+delta)})); }
  function setQty(id, val) { setQuantities(prev => ({...prev, [id]: Math.max(0, parseInt(val)||0)})); }
  function addExpense() { setExpenses(prev => [...prev, {desc:'',amount:0}]); }
  function removeExpense(i) { setExpenses(prev => prev.filter((_,idx)=>idx!==i)); }
  function updateExpense(i, field, val) { setExpenses(prev => prev.map((e,idx) => idx===i ? {...e, [field]: field==='amount' ? (parseInt(val)||0) : val} : e)); }
  function addCashIn() { setCashIns(prev => [...prev, {desc:'',amount:0}]); }
  function removeCashIn(i) { setCashIns(prev => prev.filter((_,idx)=>idx!==i)); }
  function updateCashIn(i, field, val) { setCashIns(prev => prev.map((e,idx) => idx===i ? {...e, [field]: field==='amount' ? (parseInt(val)||0) : val} : e)); }

  async function saveEntry() {
    const hasQty = PRODUCTS.some(p => (quantities[p.id]||0) > 0);
    const hasExp = expenses.some(e => (e.amount||0) > 0);
    const hasCash = cashIns.some(e => (e.amount||0) > 0);
    if (!hasQty && !hasExp && !hasCash) { showToast('Belum ada input!'); return; }
    setSaving(true);
    const existing = entries[selectedDate] || null;
    // Menambah, bukan mengganti: qty & catatan hari ini ditumpuk di atas yang sudah tersimpan.
    const accQty = {}; PRODUCTS.forEach(p => { accQty[p.id] = (existing?(existing.quantities?.[p.id]||0):0) + (quantities[p.id]||0); });
    const newExpenses = expenses.filter(e => (e.amount||0)>0 || e.desc.trim()!=='');
    const newCashIns = cashIns.filter(e => (e.amount||0)>0 || e.desc.trim()!=='').map(e => ({...e, type:'cashin'}));
    const accExpenses = [...(existing?(existing.expenses||[]):[]), ...newExpenses, ...newCashIns];
    const entry = buildEntry(selectedDate, accQty, accExpenses);
    try {
      if (session) await dbSaveEntry(entry);
      // Optimistic local update (realtime menyusul) — Kas & "sudah tercatat" langsung kebaca
      setEntries(prev => ({ ...prev, [selectedDate]: entry }));
      showToast((existing?'Ditambahkan':'Tersimpan')+' · '+fmtDate(selectedDate));
      // Reset form HANYA bila simpan berhasil — supaya input tidak hilang saat gagal
      const q = {}; PRODUCTS.forEach(p => q[p.id]=0); setQuantities(q); setExpenses([]); setCashIns([]);
    } catch(e) { showToast('Gagal menyimpan: '+e.message); }
    setSaving(false);
  }

  async function deleteEntry(date) {
    if(!confirm('Yakin hapus data tanggal '+fmtDate(date)+'?')) return;
    try {
      if (session) await dbDeleteEntry(date);
      showToast('Entri dihapus');
    } catch(e) { showToast('Gagal: '+e.message); }
  }

  // === Edit entri dari tab Riwayat (mengganti nilai, bukan menambah) ===
  function startEdit(e) {
    const q = {}; PRODUCTS.forEach(p => q[p.id] = e.quantities?.[p.id] || 0);
    const exp  = (e.expenses||[]).filter(x=>x.type!=='cashin').map(x=>({desc:x.desc||'', amount:x.amount||0}));
    const cash = (e.expenses||[]).filter(x=>x.type==='cashin').map(x=>({desc:x.desc||'', amount:x.amount||0}));
    const vday = voucherToko[e.date] || {};
    const ev = {}; TOKO.forEach(t => { const r = vday[t.id]||{drop:0,laku:0}; ev[t.id] = { drop:String(r.drop||0), laku:String(r.laku||0) }; });
    setEditQty(q); setEditExpenses(exp); setEditCashIns(cash); setEditVoucher(ev); setEditingDate(e.date);
  }
  function cancelEdit() { setEditingDate(null); }
  function changeEditQty(id, d) { setEditQty(prev => ({...prev, [id]: Math.max(0,(prev[id]||0)+d)})); }
  function setEditQtyVal(id, val) { setEditQty(prev => ({...prev, [id]: Math.max(0, parseInt(val)||0)})); }
  function addEditExpense(){ setEditExpenses(prev=>[...prev,{desc:'',amount:0}]); }
  function removeEditExpense(i){ setEditExpenses(prev=>prev.filter((_,idx)=>idx!==i)); }
  function updateEditExpense(i,field,val){ setEditExpenses(prev=>prev.map((e,idx)=>idx===i?{...e,[field]:field==='amount'?(parseInt(val)||0):val}:e)); }
  function addEditCashIn(){ setEditCashIns(prev=>[...prev,{desc:'',amount:0}]); }
  function removeEditCashIn(i){ setEditCashIns(prev=>prev.filter((_,idx)=>idx!==i)); }
  function updateEditCashIn(i,field,val){ setEditCashIns(prev=>prev.map((e,idx)=>idx===i?{...e,[field]:field==='amount'?(parseInt(val)||0):val}:e)); }
  function setEditVoucherVal(tokoId, field, val) { setEditVoucher(prev => ({...prev, [tokoId]: {...(prev[tokoId]||{drop:'0',laku:'0'}), [field]: val}})); }

  async function saveEdit() {
    const date = editingDate; if (!date) return;
    const isVoucherDate = date >= VOUCHER_TOKO_CUTOFF;
    // Voucher: validasi laku > stok sebelum apa pun disimpan
    let voucherRows = null;
    if (isVoucherDate) {
      const stockBefore = voucherStockBefore(date, voucherToko);
      voucherRows = TOKO.map(t => { const dr = editVoucher[t.id]||{drop:'0',laku:'0'}; return { tokoId:t.id, drop:parseInt(dr.drop)||0, laku:parseInt(dr.laku)||0 }; });
      const over = voucherRows.find(r => { const sB = stockBefore[r.tokoId]; return r.laku > ((sB.drop||0)-(sB.laku||0)) + r.drop; });
      if (over) { const t = TOKO.find(x=>x.id===over.tokoId); showToast('Laku '+(t?t.name:over.tokoId)+' melebihi stok — perbaiki dulu'); return; }
    }
    // Mengganti, bukan menambah: nilai lama dibuang, yang tersimpan hasil edit.
    const accQty = {}; PRODUCTS.forEach(p => accQty[p.id] = editQty[p.id]||0);
    const expenses = editExpenses.filter(e => (e.amount||0)>0 || (e.desc||'').trim()!=='').map(e=>({desc:e.desc, amount:e.amount||0}));
    const cashIns  = editCashIns.filter(e => (e.amount||0)>0 || (e.desc||'').trim()!=='').map(e=>({desc:e.desc, amount:e.amount||0, type:'cashin'}));
    const accExpenses = [...expenses, ...cashIns];
    const entry = buildEntry(date, accQty, accExpenses);
    // Hindari membuat baris entri kosong untuk tanggal yang cuma punya data voucher
    const entryExisted = !!entries[date];
    const entryHasData = PRODUCTS.some(p=>(accQty[p.id]||0)>0) || accExpenses.length>0;
    const writeEntry = entryHasData || entryExisted;
    setEditSaving(true);
    try {
      if (session) {
        if (writeEntry) await dbSaveEntry(entry);
        if (isVoucherDate) await dbSaveVoucherToko(date, voucherRows);
      }
      if (writeEntry) setEntries(prev => ({ ...prev, [date]: entry }));
      if (isVoucherDate) setVoucherToko(prev => { const next={...prev}; const dayMap={...(next[date]||{})}; voucherRows.forEach(r=>{dayMap[r.tokoId]={drop:r.drop,laku:r.laku};}); next[date]=dayMap; return next; });
      showToast('Perubahan disimpan · '+fmtDate(date));
      setEditingDate(null);
    } catch(e) { showToast('Gagal menyimpan: '+e.message); }
    setEditSaving(false);
  }

  const kasSummary = useMemo(
    () => computeKasSummary(entries, voucherToko, initialSaldo, new Date()),
    [entries, voucherToko, initialSaldo]
  );

  const paydayInfo = useMemo(
    () => computePaydayInfo(entries, voucherToko, new Date()),
    [entries, voucherToko]
  );

  const sortedEntries = useMemo(() => {
    const map = { ...entries };
    Object.keys(voucherToko||{}).forEach(d => {
      if (!map[d] && d >= VOUCHER_TOKO_CUTOFF) {
        const v = voucherForDate(d, voucherToko);
        if (v.laku>0 || v.drop>0) map[d] = { date:d, quantities:{}, expenses:[], totalPenjualan:0, gaji:0, totalPengeluaran:0, sisaKas:0 };
      }
    });
    return Object.values(map).sort((a,b)=>b.date.localeCompare(a.date));
  }, [entries, voucherToko]);

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sortedEntries;
    return sortedEntries.filter(e => {
      if (e.date.toLowerCase().includes(q)) return true;
      const fmt = fmtDate(e.date).toLowerCase();
      if (fmt.includes(q)) return true;
      const prodMatch = PRODUCTS.some(p => (e.quantities?.[p.id]||0) > 0 && p.name.toLowerCase().includes(q));
      if (prodMatch) return true;
      const expMatch = (e.expenses||[]).some(x => (x.desc||'').toLowerCase().includes(q));
      if (expMatch) return true;
      const v = voucherForDate(e.date, voucherToko);
      if ((v.laku>0||v.drop>0) && ('voucher'.includes(q) || 'v2k'.includes(q))) return true;
      if (v.laku>0||v.drop>0) {
        const dayMap = voucherToko[e.date]||{};
        return TOKO.some(t => (dayMap[t.id]?.drop>0||dayMap[t.id]?.laku>0) && t.name.toLowerCase().includes(q));
      }
      return false;
    });
  }, [sortedEntries, searchQuery, voucherToko]);

  const SplashHeader = () => (
    <div className="header">
      <div className="header-logo" style={{color:"#1a0e05",width:38,height:38,background:"var(--grad-warm)",borderRadius:11,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 14px rgba(184,92,44,.35),inset 0 1px 0 rgba(255,255,255,.25)"}}><Icon type="coffee" size={20}/></div>
      <div className="header-page-title">Warkopsaja</div>
    </div>
  );

  if(syncStatus==="not_configured") return (
    <div className="app">
      <div className="main-area">
        <SplashHeader/>
        <div className="content" style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"70vh",padding:40,textAlign:"center"}}>
          <div style={{marginBottom:24,color:"var(--text3)"}}><Icon type="settings" size={56}/></div>
          <h2 style={{marginBottom:12,fontSize:22}}>Konfigurasi Supabase</h2>
          <p style={{color:"var(--text2)",maxWidth:520,lineHeight:1.8,marginBottom:24}}>Buka file <code style={{background:"var(--bg3)",padding:"3px 10px",borderRadius:6,fontSize:13}}>src/db.js</code>, cari <code style={{background:"var(--bg3)",padding:"3px 10px",borderRadius:6,fontSize:13}}>SUPABASE_URL</code> dan <code style={{background:"var(--bg3)",padding:"3px 10px",borderRadius:6,fontSize:13}}>SUPABASE_ANON_KEY</code>, lalu isi dengan nilai dari Supabase Dashboard → Project Settings → API.</p>
        </div>
      </div>
    </div>
  );

  if (!authChecked) return (
    <div className="app">
      <div className="main-area">
        <SplashHeader/>
        <div className="content" style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"60vh"}}>
          <div style={{width:40,height:40,border:"3px solid var(--border)",borderTopColor:"var(--accent)",borderRadius:"50%",animation:"spin .8s linear infinite"}}></div>
        </div>
      </div>
    </div>
  );

  if (!session) return <LoginScreen onSession={s => setSession(s)}/>;

  if(loading) return (
    <div className="app">
      <div className="main-area">
        <div className="header">
          <button className="sidebar-toggle" aria-label="Menu" disabled><Icon type="menu" size={18}/></button>
          <div className="header-page-title">Warkopsaja</div>
          <div className="header-right">
            <span className="sk" style={{width:120,height:30,borderRadius:99}}/>
          </div>
        </div>
        <div className="content">
          <span className="sk sk-line xl" style={{width:220}}/>
          <span className="sk sk-line" style={{width:300,marginBottom:24}}/>
          <SkeletonInput/>
        </div>
      </div>
    </div>
  );

  const SyncBadge = () => syncStatus==="online" ? null : (<div className="sync-badge sync-offline" title="Tidak terhubung — perubahan tidak tersinkron"><div className="sync-dot offline"/>Offline</div>);
  const today = new Date();

  const currentPage = NAV_ITEMS.find(n=>n.id===page);
  const userEmail = session?.user?.email || '';
  const userInitial = (userEmail[0] || 'W').toUpperCase();

  return (
    <div className={"app"+(sidebarOpen?" sidebar-open":"")}>
      <aside className="sidebar" aria-label="Navigasi">
        <div className="sidebar-header">
          <div className="sidebar-logo"><Icon type="coffee" size={20}/></div>
          <div className="sidebar-brand">
            <div className="sidebar-brand-title">Warkopsaja</div>
            <div className="sidebar-brand-sub">{today.getDate()} {ML[today.getMonth()]} · {DAYS[today.getDay()]}</div>
          </div>
          <button className="sidebar-close" onClick={()=>setSidebarOpen(false)} aria-label="Tutup menu" title="Tutup">
            <Icon type="x" size={16}/>
          </button>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-label">Menu</div>
          {NAV_ITEMS.map(n => (
            <button key={n.id} className={"nav-btn "+(page===n.id?"active":"")} onClick={()=>handleNav(n.id)}>
              <Icon type={n.icon} size={18}/> {n.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          {userEmail && (
            <div className="sidebar-user">
              <div className="sidebar-user-avatar">{userInitial}</div>
              <div className="sidebar-user-email" title={userEmail}>{userEmail}</div>
            </div>
          )}
          <button className="nav-btn" onClick={()=>setTheme(theme==='dark'?'light':'dark')}>
            <Icon type={theme==='dark'?'sun':'moon'} size={16}/> Mode {theme==='dark'?'terang':'gelap'}
          </button>
          <button className="nav-btn" onClick={async()=>{ await signOut(); }}>
            <Icon type="log-out" size={16}/> Logout
          </button>
        </div>
      </aside>

      <div className="sidebar-backdrop" onClick={()=>setSidebarOpen(false)}/>

      <div className="main-area">
        <div className="header">
          <button className="sidebar-toggle" onClick={()=>setSidebarOpen(!sidebarOpen)} aria-label={sidebarOpen?"Tutup menu":"Buka menu"} title={sidebarOpen?"Tutup menu":"Buka menu"}>
            <Icon type="menu" size={18}/>
          </button>
          <div style={{display:"flex",flexDirection:"column",justifyContent:"center",minWidth:0,flex:"0 1 auto"}}>
            <div className="header-page-title">{currentPage?.label || 'Warkopsaja'}</div>
          </div>
          <div className="header-right">
            <SyncBadge/>
          </div>
        </div>

        <div className="content">
          {page==="input" && <>
            <div className="kas-hero">
              <div className="kas-hero-label">Kas Saat Ini</div>
              <div className={"kas-hero-value"+(kasSummary.kasSekarang<0?" neg":"")}><AnimatedIDR value={kasSummary.kasSekarang}/></div>
              <div className="kas-hero-delta">
                {kasSummary.hasToday
                  ? <>Hari ini <span className={kasSummary.todayKas>=0?'pos':'neg'}>{kasSummary.todayKas>=0?'+':''}{IDR(kasSummary.todayKas)}</span></>
                  : <span style={{color:"var(--text3)",fontStyle:"italic"}}>Hari ini belum input</span>}
              </div>
            </div>

            {paydayInfo && (
              <div className={"payday-banner "+paydayInfo.show}>
                <div className="payday-main">
                  {paydayInfo.show==='today'
                    ? <><Icon type="gift" size={16}/><span className="label">Hari Ini Gajian!</span></>
                    : <><Icon type="calendar" size={15}/><span className="label">Gajian H−{paydayInfo.daysLeft}</span></>
                  }
                  <span className="sub">{paydayInfo.period.label} {ML[paydayInfo.month]}{paydayInfo.show==='upcoming' && ' · sementara'}</span>
                </div>
                <div className="payday-amount">{IDR(paydayInfo.totalGaji)}</div>
              </div>
            )}

            <div className="date-inline">
              <button type="button" className="date-display-btn" onClick={() => { const i = hariIniDateRef.current; if (!i) return; if (typeof i.showPicker === 'function') i.showPicker(); else i.focus(); }}>
                <Icon type="calendar" size={15}/>
                <span>{(() => { const dt = new Date(selectedDate+'T00:00:00'); return dt.getDate()+' '+MO[dt.getMonth()]+' '+dt.getFullYear(); })()}</span>
                <span className="chev">▾</span>
              </button>
              <input ref={hariIniDateRef} type="date" className="date-input-hidden" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)}/>
              {(() => {
                const v = voucherForDate(selectedDate, voucherToko);
                const hasVoucher = v.laku>0 || v.drop>0;
                if (!existingEntry && !hasVoucher) return null;
                const items = existingEntry ? PRODUCTS.filter(p=>(existingEntry.quantities?.[p.id]||0)>0).map(p=>p.name+' ×'+existingEntry.quantities[p.id]).join(', ') : '';
                const summary = items || (hasVoucher ? 'voucher ×'+v.laku : '–');
                return (
                  <span className="date-hint">
                    <Icon type="package" size={13}/> Sudah tercatat <strong>{summary}</strong>
                  </span>
                );
              })()}
            </div>

            <div className="card">
              {PRODUCTS.filter(p => !(p.id==='v2k' && selectedDate >= VOUCHER_TOKO_CUTOFF)).map(p => (
                <div key={p.id} className="product-row">
                  <div className="product-emoji"><ProductIcon type={p.id} size={24}/></div>
                  <div className="product-info">
                    <div className="product-name">{p.name}</div>
                    <div className="product-meta">{IDR(p.price)}</div>
                  </div>
                  <div className="qty-control">
                    <button className="qty-btn" onClick={()=>changeQty(p.id,-1)}>−</button>
                    <input className="qty-display" type="number" inputMode="numeric" min="0" value={quantities[p.id]} onChange={e=>setQty(p.id,e.target.value)}/>
                    <button className="qty-btn" onClick={()=>changeQty(p.id,1)}>+</button>
                  </div>
                </div>
              ))}
              {(inputTotals.totalQty>0 || inputTotals.totalExpense>0 || inputTotals.totalCashIn>0) && (
                <div className="inline-summary">
                  <span className="seg">Penjualan <strong>{IDR(inputTotals.totalSales)}</strong></span>
                  <span className="seg">Gaji <strong>{IDR(inputTotals.totalGaji)}</strong></span>
                  <span className={"seg profit"+(inputTotals.sisaKas<0?" neg":"")}>{inputTotals.sisaKas>=0?'Untung':'Rugi'} <strong>{IDR(inputTotals.sisaKas)}</strong></span>
                </div>
              )}
            </div>

            <div className="card">
              <div className="add-pill-row">
                <button className="add-pill" onClick={addExpense}><Icon type="trending-down" size={14}/> Pengeluaran</button>
                <button className="add-pill green" onClick={addCashIn}><Icon type="banknote" size={14}/> Cash Masuk</button>
              </div>
              {expenses.length===0 && cashIns.length===0 && (
                <div className="catatan-empty">Belum ada catatan.</div>
              )}
              {expenses.length>0 && (
                <div className="catatan-section">
                  <div className="catatan-section-label"><Icon type="trending-down" size={11}/> Pengeluaran</div>
                  {expenses.map((exp, i) => (
                    <div key={i} className="expense-row">
                      <input className="expense-input" type="text" placeholder="Keterangan…" value={exp.desc} onChange={e=>updateExpense(i,'desc',e.target.value)}/>
                      <input className="expense-amount" type="number" inputMode="numeric" placeholder="Jumlah" value={exp.amount||''} onChange={e=>updateExpense(i,'amount',e.target.value)}/>
                      <button className="del-btn" onClick={()=>removeExpense(i)}>×</button>
                    </div>
                  ))}
                </div>
              )}
              {cashIns.length>0 && (
                <div className="catatan-section">
                  <div className="catatan-section-label"><Icon type="banknote" size={11}/> Cash Masuk</div>
                  {cashIns.map((exp, i) => (
                    <div key={i} className="expense-row">
                      <input className="expense-input" type="text" placeholder="Cth: Pak Budi bayar hutang…" value={exp.desc} onChange={e=>updateCashIn(i,'desc',e.target.value)}/>
                      <input className="expense-amount" type="number" inputMode="numeric" placeholder="Jumlah" value={exp.amount||''} onChange={e=>updateCashIn(i,'amount',e.target.value)}/>
                      <button className="del-btn" onClick={()=>removeCashIn(i)}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button className="btn-save" disabled={saving} onClick={saveEntry}><Icon type="coffee" size={16}/> Simpan</button>
          </>}

          {page==="voucher" && <>
            <div style={{marginBottom:8}}></div>

            <div className="voucher-date-row">
              <button type="button" className="date-display-btn" onClick={() => { const i = voucherDateRef.current; if (!i) return; if (typeof i.showPicker === 'function') i.showPicker(); else i.focus(); }}>
                <Icon type="calendar" size={15}/>
                <span>{(() => { const dt = new Date(selectedDate+'T00:00:00'); return dt.getDate()+' '+MO[dt.getMonth()]+' '+dt.getFullYear(); })()}</span>
                <span className="chev">▾</span>
              </button>
              <input ref={voucherDateRef} type="date" className="date-input-hidden" min={VOUCHER_TOKO_CUTOFF} value={selectedDate} onChange={e=>setSelectedDate(e.target.value)}/>
              <button type="button" className={"info-toggle"+(voucherInfoOpen?" active":"")} onClick={()=>setVoucherInfoOpen(v=>!v)} title="Info Drop & Laku" aria-label="Info">
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:14,fontWeight:700,lineHeight:1}}>?</span>
              </button>
            </div>
            {selectedDate < VOUCHER_TOKO_CUTOFF && (
              <div className="date-hint" style={{color:"var(--red)",margin:"8px 0 0"}}>
                <Icon type="alert" size={13}/> Voucher Toko mulai 1 Mei 2026
              </div>
            )}
            {voucherInfoOpen && (
              <div className="voucher-info" style={{margin:"10px 0 0"}}>
                <strong>Drop</strong> = titip stok ke toko · <strong>Laku</strong> = laporan setoran toko. Harga jual {IDR(V2K.price)} (toko ambil komisi {IDR(V2K.komisi_toko)}, setor ke kas {IDR(V2K_SETORAN)}) · Gaji Jaya {IDR(V2K.gaji)}/voucher laku.
              </div>
            )}
            <div style={{marginBottom:18}}></div>

            {selectedDate >= VOUCHER_TOKO_CUTOFF && (() => {
              const stockBefore = voucherStockBefore(selectedDate, voucherToko);
              let dayDrop=0, dayLaku=0, anyOverLaku=false;
              TOKO.forEach(t => {
                const d = voucherDraft[t.id]||{drop:'0',laku:'0'};
                const dDrop = parseInt(d.drop)||0, dLaku = parseInt(d.laku)||0;
                dayDrop += dDrop; dayLaku += dLaku;
                const sB = stockBefore[t.id]; const stokAwal = (sB.drop||0) - (sB.laku||0);
                if (dLaku > stokAwal + dDrop) anyOverLaku = true;
              });
              return (
                <>
                  {(dayDrop>0 || dayLaku>0) && (
                    <div className="voucher-day-summary">
                      <span className="seg">Total drop <strong>{dayDrop}</strong></span>
                      <span className="seg">Total laku <strong>{dayLaku}</strong></span>
                      <span className="seg gaji">Gaji Jaya <strong>{IDR(dayLaku*V2K.gaji)}</strong></span>
                      <span className="seg setoran">Setoran kas <strong>{IDR(dayLaku*V2K_SETORAN)}</strong></span>
                    </div>
                  )}

                  {TOKO.map(t => {
                    const sBefore = stockBefore[t.id];
                    const stokAwal = (sBefore.drop||0) - (sBefore.laku||0);
                    const draft = voucherDraft[t.id] || { drop:'0', laku:'0' };
                    const dDrop = parseInt(draft.drop)||0;
                    const dLaku = parseInt(draft.laku)||0;
                    const stokAkhir = stokAwal + dDrop - dLaku;
                    const overLaku = dLaku > (stokAwal + dDrop);
                    const hasAction = dDrop>0 || dLaku>0;
                    const pillClass = overLaku ? 'over' : (stokAkhir > stokAwal ? 'up' : (stokAkhir < stokAwal ? 'down' : ''));
                    return (
                      <div key={t.id} className={"toko-card"+(overLaku?" over":(hasAction?" has-action":""))}>
                        <div className="toko-head">
                          <span className="toko-head-name"><Icon type="store" size={16}/> {t.name}</span>
                          <span className={"toko-stok-pill "+pillClass}>
                            {stokAkhir === stokAwal
                              ? <>Stok <span className="end">{stokAwal}</span></>
                              : <>Stok {stokAwal} <span className="arrow">→</span> <span className="end">{stokAkhir}</span></>}
                          </span>
                        </div>
                        <div className="toko-inputs">
                          <div className={"toko-input-group drop"+(dDrop===0?" empty":"")}>
                            <label>+ Drop</label>
                            <input type="number" inputMode="numeric" min="0" placeholder="0" value={draft.drop} onChange={e=>setDraft(t.id,'drop',e.target.value)}/>
                          </div>
                          <div className={"toko-input-group laku"+(dLaku===0?" empty":"")}>
                            <label>− Laku</label>
                            <input type="number" inputMode="numeric" min="0" placeholder="0" value={draft.laku} onChange={e=>setDraft(t.id,'laku',e.target.value)}/>
                          </div>
                        </div>
                        {(overLaku || dLaku > 0) && (
                          <div className="toko-footer">
                            {overLaku
                              ? <span className="error"><Icon type="alert" size={13}/> Laku melebihi stok</span>
                              : <>
                                  <span className="seg setoran">Setoran <strong>{IDR(dLaku*V2K_SETORAN)}</strong></span>
                                  <span className="seg gaji">Gaji Jaya <strong>{IDR(dLaku*V2K.gaji)}</strong></span>
                                </>
                            }
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <button className="btn-save" disabled={voucherSaving || anyOverLaku} onClick={saveVoucherTokoDay}>
                    {voucherSaving ? 'Menyimpan…' : <><Icon type="signal" size={16}/> Simpan Voucher Hari Ini</>}
                  </button>
                  {anyOverLaku && (
                    <div className="date-hint" style={{color:"var(--red)",justifyContent:"center",margin:"8px 0 0"}}>
                      <Icon type="alert" size={13}/> Ada toko dengan laku melebihi stok — perbaiki dulu sebelum simpan
                    </div>
                  )}

                  {/* Rekap periode berjalan */}
                  {(() => {
                    const sd = new Date(selectedDate+'T00:00:00');
                    const sy = sd.getFullYear(), sm = sd.getMonth(), sday = sd.getDate();
                    const periodsForSelected = getPayPeriods(sy, sm);
                    const p = sday<=14 ? periodsForSelected[0] : periodsForSelected[1];
                    const range = voucherInRange(p.start, p.end, voucherToko);
                    return (
                      <div className="card" style={{marginTop:24}}>
                        <div className="card-title"><Icon type="calendar" size={16}/> Rekap Periode {ML[sm]} · {p.label} (tgl {p.startDay}–{p.endDay})</div>
                        <div className="voucher-day-summary" style={{margin:"0 0 16px"}}>
                          <span className="seg">Total drop <strong>{range.drop}</strong></span>
                          <span className="seg">Total laku <strong>{range.laku}</strong></span>
                          <span className="seg gaji">Gaji periode <strong>{IDR(range.gaji)}</strong></span>
                          <span className="seg setoran">Penjualan <strong>{IDR(range.penjualan)}</strong></span>
                        </div>
                        <div style={{fontSize:11,color:"var(--text3)",marginBottom:8}}>
                          Sisa stok per toko (kumulatif sampai {fmtDate(p.end)}):
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:8}}>
                          {(() => {
                            const stokEnd = voucherStockPerToko(p.end, voucherToko);
                            return TOKO.map(t => {
                              const s = stokEnd[t.id]; const sisa = (s.drop||0) - (s.laku||0);
                              return (
                                <div key={t.id} className="gajian-stat">
                                  <div className="gajian-stat-label" style={{display:"inline-flex",alignItems:"center",gap:5}}><Icon type="store" size={10}/> {t.name}</div>
                                  <div className="gajian-stat-value" style={{color:sisa<0?"var(--red)":"var(--text)"}}>{sisa}</div>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    );
                  })()}
                </>
              );
            })()}
          </>}

          {page==="gajian" && <>
            <div style={{marginBottom:8}}></div>

            {(()=>{
              const currentMonth = today.getMonth(); const currentYear = today.getFullYear(); const currentDay = today.getDate();
              const monthsToShow = [{ year:currentYear, month:currentMonth }, currentMonth===0?{year:currentYear-1,month:11}:{year:currentYear,month:currentMonth-1}];
              return monthsToShow.map(({year, month}) => {
                const periods = getPayPeriods(year, month);
                const isCurrentMonth = (year===currentYear && month===currentMonth);
                const monthLabel = ML[month]+' '+year;
                // Newest period first; sembunyikan periode yang belum mulai
                const indexed = periods.map((p,pi) => ({p,pi}));
                const ordered = indexed.slice().reverse().filter(({p}) => !(isCurrentMonth && currentDay < p.startDay));
                return ordered.map(({p,pi}) => {
                  const mainEntries = Object.values(entries).filter(e=>e.date>=p.start&&e.date<=p.end);
                  const overflowEntries = (p.overflowStart&&p.overflowEnd) ? Object.values(entries).filter(e=>e.date>=p.overflowStart&&e.date<=p.overflowEnd) : [];
                  const periodEntries = [...overflowEntries, ...mainEntries];
                  const totalGaji = periodGaji(entries, voucherToko, p);
                  // Hitung hari kerja: gabungan tanggal dari entries + voucher_toko (yang punya laku/drop)
                  const periodDateSet = new Set(periodEntries.map(e=>e.date));
                  Object.keys(voucherToko||{}).forEach(d => {
                    if ((d>=p.start && d<=p.end) || (p.overflowStart && d>=p.overflowStart && d<=p.overflowEnd)) {
                      const v = voucherForDate(d, voucherToko); if (v.laku>0 || v.drop>0) periodDateSet.add(d);
                    }
                  });
                  const totalDays = periodDateSet.size;
                  const isPast = !isCurrentMonth || (isCurrentMonth && currentDay > p.payday);
                  const isCurrent = isCurrentMonth && ((p.payday===14 && currentDay>=1 && currentDay<=14) || (p.payday===28 && currentDay>=15 && currentDay<=28));
                  let statusClass, statusText;
                  if (isPast && !isCurrent) { statusClass='paid'; statusText='Sudah gajian'; }
                  else if (isCurrent) { statusClass='pending'; statusText='Lagi jalan'; }
                  else { statusClass='future'; statusText='Nanti'; }
                  const overflowLabel = overflowEntries.length>0 ? ' (+tgl '+p.overflowDays[0]+'–'+p.overflowDays[p.overflowDays.length-1]+' '+MO[p.prevMonth]+')' : '';
                  // Hero: hitung countdown & progress (khusus periode berjalan)
                  const periodLength = p.endDay - p.startDay + 1;
                  const daysToPayday = isCurrent ? Math.max(0, p.payday - currentDay) : 0;
                  const daysElapsed = isCurrent ? Math.max(1, Math.min(periodLength, currentDay - p.startDay + 1)) : periodLength;
                  const progressPct = isCurrent ? Math.min(100, Math.round((daysElapsed / periodLength) * 100)) : 100;
                  const countdownText = daysToPayday === 0 ? 'Hari ini gajian!' : daysToPayday === 1 ? 'Besok gajian!' : 'Tinggal '+daysToPayday+' hari lagi';
                  const countdownUrgent = daysToPayday <= 2;

                  return (
                    <div key={year+'-'+month+'-'+pi} className={"gajian-card"+(isCurrent?" active-period":"")}>
                      {isCurrent ? (
                        <div className="gajian-hero-active">
                          <div className="gajian-hero-meta">
                            <div>
                              <div className="gajian-period-label">{monthLabel} · {p.label}</div>
                            </div>
                            <span className={"gajian-countdown-pill"+(countdownUrgent?" urgent":"")}>
                              <Icon type={daysToPayday<=1?"gift":"clock"} size={13}/> {countdownText}
                            </span>
                          </div>
                          <div className="gajian-hero-amount">
                            <div className="gajian-hero-amount-label">Gajiku</div>
                            <div className="gajian-hero-amount-value"><AnimatedIDR value={totalGaji}/></div>
                          </div>
                          <div className="gajian-hero-progress">
                            <div className="gajian-hero-progress-bar"><div className="gajian-hero-progress-fill" style={{width:progressPct+'%'}}/></div>
                            <div className="gajian-hero-progress-meta">
                              <span>{totalDays>0 ? 'Sudah '+totalDays+' hari kerja · '+progressPct+'% jalan' : 'Belum mulai catat'}</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="gajian-header">
                          <div>
                            <div className="gajian-period-label">{monthLabel} · {p.label}</div>
                          </div>
                          <div className="gajian-total-box">
                            <div className="gajian-total-label">Gajiku</div>
                            <div className="gajian-total-value"><AnimatedIDR value={totalGaji}/></div>
                            <span className={"gajian-status-badge "+statusClass}>{statusText}</span>
                          </div>
                        </div>
                      )}

                      {overflowEntries.length>0 && (
                        <div style={{borderBottom:"1px dashed var(--border)",marginBottom:4,paddingBottom:4}}>
                          <div style={{fontSize:10,fontWeight:700,color:"var(--orange)",letterSpacing:".06em",textTransform:"uppercase",padding:"4px 0 6px",display:"flex",alignItems:"center",gap:6}}><Icon type="arrow-up" size={11}/> Sisa dari {ML[p.prevMonth]}</div>
                          {p.overflowDays.map(d => {
                            const dd = String(d).padStart(2,'0');
                            const dateStr = p.prevYear+'-'+String(p.prevMonth+1).padStart(2,'0')+'-'+dd;
                            const entry = entries[dateStr]; const dt = new Date(dateStr+'T00:00:00'); const dayName = DAYS[dt.getDay()];
                            const v = voucherForDate(dateStr, voucherToko);
                            if (!(entry || v.laku>0 || v.drop>0)) return null;
                            const totalDayGaji = (entry?.gaji||0) + v.gaji;
                            return (
                              <div key={dateStr} className="gajian-day-row" style={{background:"rgba(251,146,60,.04)"}}>
                                <div className="gajian-day-date">{d} {MO[p.prevMonth]} <span className="day-name">{dayName}</span></div>
                                <div className="gajian-day-amount">{IDR(totalDayGaji)}</div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {(() => {
                        const days = Array.from({length:p.endDay-p.startDay+1},(_,i)=>p.startDay+i);
                        const rows = days.map(d => {
                          const dd = String(d).padStart(2,'0');
                          const dateStr = year+'-'+String(month+1).padStart(2,'0')+'-'+dd;
                          const entry = entries[dateStr]; const dt = new Date(dateStr+'T00:00:00'); const dayName = DAYS[dt.getDay()];
                          const v = voucherForDate(dateStr, voucherToko);
                          if (!(entry || v.laku>0 || v.drop>0)) return null;
                          const totalDayGaji = (entry?.gaji||0) + v.gaji;
                          return (
                            <div key={dateStr} className="gajian-day-row">
                              <div className="gajian-day-date">{d} {MO[month]} <span className="day-name">{dayName}</span></div>
                              <div className="gajian-day-amount">{IDR(totalDayGaji)}</div>
                            </div>
                          );
                        }).filter(Boolean);
                        if (rows.length === 0) return <div className="gajian-empty-state">Periode ini masih kosong</div>;
                        return rows;
                      })()}
                    </div>
                  );
                });
              });
            })()}
          </>}

          {page==="riwayat" && <>
            <div style={{marginBottom:8}}></div>

            {/* Saldo Awal: titik nol kas warkop, anchor di atas timeline */}
            {!searchQuery && (
              <div className="saldo-awal-bar" style={{margin:"0 0 10px"}}>
                <span className="lbl"><Icon type="coins" size={14}/> Saldo Awal</span>
                {editingSaldo ? (
                  <>
                    <input className="expense-amount" style={{maxWidth:150,textAlign:"left"}} type="number" inputMode="numeric" autoFocus placeholder="0" value={saldoInput} onChange={e=>setSaldoInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')saveInitialSaldo(saldoInput)}}/>
                    <button className="btn btn-primary btn-sm" onClick={()=>saveInitialSaldo(saldoInput)}>Simpan</button>
                    <button className="btn btn-ghost btn-sm" onClick={()=>setEditingSaldo(false)}>Batal</button>
                  </>
                ) : (
                  <>
                    <span className="val">{IDR(initialSaldo)}</span>
                    <button className="btn btn-ghost btn-sm" onClick={()=>{setSaldoInput(String(initialSaldo));setEditingSaldo(true);}}><Icon type="pencil" size={12}/></button>
                  </>
                )}
              </div>
            )}

            {!searchQuery && sortedEntries.length>0 && (
              <div className="riwayat-meta">
                {(() => {
                  const dates = sortedEntries.map(e=>e.date);
                  const first = dates[dates.length-1], last = dates[0];
                  const fmt = (d) => { const dt = new Date(d+'T00:00:00'); return dt.getDate()+' '+MO[dt.getMonth()]; };
                  return sortedEntries.length+' hari tersimpan · '+fmt(first)+(first!==last?' – '+fmt(last):'');
                })()}
              </div>
            )}

            {sortedEntries.length>0 && (
              <div className="riwayat-search-row">
                <div className="search-wrap" style={{flex:1,marginBottom:0}}>
                  <span className="search-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
                  </span>
                  <input
                    className="search-input"
                    type="text"
                    placeholder="Cari tanggal, hari, produk, toko, atau pengeluaran…"
                    value={searchQuery}
                    onChange={e=>setSearchQuery(e.target.value)}
                  />
                  {searchQuery && <button className="search-clear" onClick={()=>setSearchQuery('')} title="Hapus">×</button>}
                </div>
                <button className="btn-export-icon" onClick={()=>exportRiwayatCSV(entries, voucherToko)} title="Export CSV"><Icon type="download" size={16}/></button>
              </div>
            )}
            {searchQuery && (
              <div className="search-meta">
                {filteredEntries.length} dari {sortedEntries.length} entri cocok dengan "{searchQuery}"
              </div>
            )}
            {sortedEntries.length===0 ? (
              <div className="empty"><div className="empty-icon" style={{color:"var(--text3)"}}><Icon type="inbox" size={48}/></div>Belum ada data tersimpan.<br/>Mulai input di tab "Hari Ini".</div>
            ) : filteredEntries.length===0 ? (
              <div className="empty"><div className="empty-icon" style={{color:"var(--text3)"}}><Icon type="search" size={44}/></div>Tidak ada entri yang cocok.<br/>Coba kata kunci lain atau hapus pencarian.</div>
            ) : filteredEntries.map((e) => {
              const sold = PRODUCTS.filter(p=>(e.quantities?.[p.id]||0)>0);
              const { expItems, cashItems, expGross, cashGross, voucher: v,
                      totalPengeluaran: totalExp, totalGaji: totalGajiRow,
                      totalPenjualan: totalPenjualanRow, sisaKas } = entryDayTotals(e, voucherToko);
              const hasVoucher = v.laku>0 || v.drop>0;
              const tokoBreakdown = hasVoucher ? TOKO.map(t => {
                const r = (voucherToko[e.date]||{})[t.id]; if (!r || (!r.drop && !r.laku)) return null;
                return { id:t.id, name:t.name, drop:r.drop||0, laku:r.laku||0 };
              }).filter(Boolean) : [];
              const isOpen = openDetail===e.date;
              const isEditing = editingDate===e.date;
              const kasClass = sisaKas>0?'profit':sisaKas<0?'loss':'';
              const sisaSign = sisaKas>0?'pos':sisaKas<0?'neg':'';
              const sisaLabel = sisaKas>0?'Untung':sisaKas<0?'Rugi':'Impas';
              return (
                <div key={e.date} className={"history-item "+kasClass} onClick={()=>{ if(isEditing) return; setOpenDetail(isOpen?null:e.date); }}>
                  <div className="history-item-header">
                    <span className="history-date">{(() => { const dt = new Date(e.date+'T00:00:00'); return dt.getDate()+' '+MO[dt.getMonth()]+' · '+DAYS[dt.getDay()]; })()}</span>
                    <span className={"history-gaji "+sisaSign}>{sisaKas>0?'+':''}{IDR(sisaKas)}</span>
                  </div>
                  {(sold.length>0 || v.laku>0 || v.drop>0) && (
                    <div className="history-pills">
                      {sold.map(p=><span key={p.id} className="pill" style={{display:"inline-flex",alignItems:"center",gap:5}}><ProductIcon type={p.id} size={11}/>{p.name} ×{e.quantities[p.id]}</span>)}
                      {v.laku>0 && <span className="pill" style={{background:"var(--accent-bg)",color:"var(--accent)",borderColor:"var(--accent-border)",display:"inline-flex",alignItems:"center",gap:5}}><Icon type="signal" size={11}/> Voucher ×{v.laku}</span>}
                      {v.drop>0 && <span className="pill" style={{background:"var(--blue-bg)",color:"var(--blue)",display:"inline-flex",alignItems:"center",gap:5}}><Icon type="package" size={11}/> Drop {v.drop}</span>}
                    </div>
                  )}
                  {(expGross>0 || cashGross>0) && (
                    <div className="history-money">
                      {expGross>0 && <span className="pill" style={{background:"var(--red-bg)",color:"var(--red)",borderColor:"var(--red-border)"}}>−{IDR(expGross)} keluar</span>}
                      {cashGross>0 && <span className="pill" style={{background:"var(--green-bg)",color:"var(--green)",borderColor:"var(--green-border)"}}>+{IDR(cashGross)} cash</span>}
                    </div>
                  )}
                  {isOpen && isEditing && (
                    <div className="history-detail" onClick={ev=>ev.stopPropagation()}>
                      {(() => {
                        const editProducts = PRODUCTS.filter(p => !(p.id==='v2k' && e.date >= VOUCHER_TOKO_CUTOFF));
                        let eSales=0, eGaji=0; editProducts.forEach(p=>{const q=editQty[p.id]||0; eSales+=q*p.price; eGaji+=q*p.gaji;});
                        const eExp = editExpenses.reduce((s,x)=>s+(x.amount||0),0);
                        const eCash = editCashIns.reduce((s,x)=>s+(x.amount||0),0);
                        const eSisa = eSales - eGaji - (eExp - eCash);
                        const isVoucherDate = e.date >= VOUCHER_TOKO_CUTOFF;
                        const vStockBefore = isVoucherDate ? voucherStockBefore(e.date, voucherToko) : null;
                        let editVoucherOver = false;
                        if (isVoucherDate) TOKO.forEach(t => { const sB=vStockBefore[t.id]; const dr=editVoucher[t.id]||{drop:'0',laku:'0'}; const dD=parseInt(dr.drop)||0, dL=parseInt(dr.laku)||0; if (dL > (sB.drop||0)-(sB.laku||0)+dD) editVoucherOver=true; });
                        return <>
                          <div className="detail-section-label">Edit Penjualan</div>
                          {editProducts.map(p=>(
                            <div key={p.id} className="product-row">
                              <div className="product-emoji"><ProductIcon type={p.id} size={24}/></div>
                              <div className="product-info">
                                <div className="product-name">{p.name}</div>
                                <div className="product-meta">{IDR(p.price)}</div>
                              </div>
                              <div className="qty-control">
                                <button className="qty-btn" onClick={()=>changeEditQty(p.id,-1)}>−</button>
                                <input className="qty-display" type="number" inputMode="numeric" min="0" value={editQty[p.id]} onChange={ev=>setEditQtyVal(p.id,ev.target.value)}/>
                                <button className="qty-btn" onClick={()=>changeEditQty(p.id,1)}>+</button>
                              </div>
                            </div>
                          ))}
                          {isVoucherDate && <>
                            <div className="detail-section-label" style={{marginTop:12,display:"flex",alignItems:"center",gap:6}}><Icon type="signal" size={12}/> Voucher Toko</div>
                            {TOKO.map(t => {
                              const sB = vStockBefore[t.id]; const stokAwal = (sB.drop||0)-(sB.laku||0);
                              const dr = editVoucher[t.id]||{drop:'0',laku:'0'};
                              const dD = parseInt(dr.drop)||0, dL = parseInt(dr.laku)||0;
                              const over = dL > stokAwal + dD;
                              return (
                                <div key={t.id} className="expense-row" style={{alignItems:"center"}}>
                                  <span className="detail-item-name" style={{flex:1,display:"inline-flex",alignItems:"center",gap:6,minWidth:0}}>
                                    <Icon type="store" size={13}/> {t.name}
                                    {over && <span style={{color:"var(--red)",fontSize:11,whiteSpace:"nowrap"}}>· &gt; stok</span>}
                                  </span>
                                  <label style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:"var(--text3)"}}>Drop
                                    <input className="expense-amount" style={{maxWidth:64}} type="number" inputMode="numeric" min="0" placeholder="0" value={dr.drop} onChange={ev=>setEditVoucherVal(t.id,'drop',ev.target.value)}/>
                                  </label>
                                  <label style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:"var(--text3)"}}>Laku
                                    <input className="expense-amount" style={{maxWidth:64,...(over?{borderColor:"var(--red)",color:"var(--red)"}:{})}} type="number" inputMode="numeric" min="0" placeholder="0" value={dr.laku} onChange={ev=>setEditVoucherVal(t.id,'laku',ev.target.value)}/>
                                  </label>
                                </div>
                              );
                            })}
                          </>}
                          <div className="detail-section-label red" style={{marginTop:12}}>Pengeluaran</div>
                          {editExpenses.map((x,i)=>(
                            <div key={i} className="expense-row">
                              <input className="expense-input" type="text" placeholder="Keterangan…" value={x.desc} onChange={ev=>updateEditExpense(i,'desc',ev.target.value)}/>
                              <input className="expense-amount" type="number" inputMode="numeric" placeholder="Jumlah" value={x.amount||''} onChange={ev=>updateEditExpense(i,'amount',ev.target.value)}/>
                              <button className="del-btn" onClick={()=>removeEditExpense(i)}>×</button>
                            </div>
                          ))}
                          <button className="add-pill" onClick={addEditExpense} style={{marginTop:6}}><Icon type="trending-down" size={14}/> Tambah Pengeluaran</button>
                          <div className="detail-section-label green" style={{marginTop:12,display:"flex",alignItems:"center",gap:6}}><Icon type="banknote" size={12}/> Cash Masuk</div>
                          {editCashIns.map((x,i)=>(
                            <div key={i} className="expense-row">
                              <input className="expense-input" type="text" placeholder="Cth: bayar hutang…" value={x.desc} onChange={ev=>updateEditCashIn(i,'desc',ev.target.value)}/>
                              <input className="expense-amount" type="number" inputMode="numeric" placeholder="Jumlah" value={x.amount||''} onChange={ev=>updateEditCashIn(i,'amount',ev.target.value)}/>
                              <button className="del-btn" onClick={()=>removeEditCashIn(i)}>×</button>
                            </div>
                          ))}
                          <button className="add-pill green" onClick={addEditCashIn} style={{marginTop:6}}><Icon type="banknote" size={14}/> Tambah Cash Masuk</button>
                          <div className="inline-summary" style={{marginTop:14}}>
                            <span className="seg">Penjualan <strong>{IDR(eSales)}</strong></span>
                            <span className="seg">Gaji <strong>{IDR(eGaji)}</strong></span>
                            <span className={"seg profit"+(eSisa<0?" neg":"")}>{eSisa>=0?'Untung':'Rugi'} <strong>{IDR(eSisa)}</strong></span>
                          </div>
                          {editVoucherOver && (
                            <div className="date-hint" style={{color:"var(--red)",margin:"10px 0 0"}}>
                              <Icon type="alert" size={13}/> Ada toko dengan laku melebihi stok — perbaiki dulu
                            </div>
                          )}
                          <div style={{display:"flex",gap:8,marginTop:14}}>
                            <button className="btn btn-primary" style={{flex:1,padding:"10px"}} disabled={editSaving||editVoucherOver} onClick={saveEdit}>{editSaving?'Menyimpan…':'Simpan Perubahan'}</button>
                            <button className="btn btn-ghost" style={{padding:"10px 16px"}} disabled={editSaving} onClick={cancelEdit}>Batal</button>
                          </div>
                        </>;
                      })()}
                    </div>
                  )}
                  {isOpen && !isEditing && (
                    <div className="history-detail">
                      <div className="history-summary">
                        <div className="summary-row add"><span className="summary-label">Pemasukan</span><span className="summary-value">{IDR(totalPenjualanRow)}</span></div>
                        <div className="summary-row sub"><span className="summary-label">Gaji</span><span className="summary-value">−{IDR(totalGajiRow)}</span></div>
                        {expGross>0 && <div className="summary-row sub"><span className="summary-label">Pengeluaran</span><span className="summary-value">−{IDR(expGross)}</span></div>}
                        {cashGross>0 && <div className="summary-row cash"><span className="summary-label">Cash Masuk</span><span className="summary-value">+{IDR(cashGross)}</span></div>}
                        <div className="summary-row total">
                          <span className="summary-label">{sisaLabel} Hari Ini</span>
                          <span className={"summary-value "+sisaSign}>{IDR(sisaKas)}</span>
                        </div>
                      </div>
                      {(sold.length>0 || tokoBreakdown.length>0) && <>
                        <div className="detail-section-label">Rincian Gaji</div>
                        {sold.map(p=>(<div key={p.id} className="detail-row"><span className="detail-item-name" style={{display:"inline-flex",alignItems:"center",gap:6}}><ProductIcon type={p.id} size={13}/>{p.name} ×{e.quantities[p.id]}</span><span className="detail-item-value">{IDR(e.quantities[p.id]*p.gaji)}</span></div>))}
                        {tokoBreakdown.map(t => {
                          const hasLaku = t.laku>0, hasDrop = t.drop>0;
                          let dropNote = '';
                          if (hasDrop && hasLaku) {
                            if (t.laku === t.drop) dropNote = ' · semua terjual hari ini';
                            else if (t.laku < t.drop) dropNote = ' · sisa '+(t.drop-t.laku)+' di toko';
                            else dropNote = ' · ada laku dari stok sebelumnya';
                          }
                          return (
                            <div key={t.id} className="detail-row toko-detail-row">
                              <div className="toko-info">
                                <div className="toko-main" style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                                  <Icon type="store" size={12}/> <span>{t.name}</span>
                                  {hasLaku && <> · <strong>{t.laku}</strong> laku × {IDR(V2K.gaji)}</>}
                                  {!hasLaku && hasDrop && <span style={{color:"var(--text3)"}}> · drop saja, belum laku</span>}
                                </div>
                                {hasDrop && <div className="toko-sub"><Icon type="package" size={11}/> Drop {t.drop} voucher ke toko{dropNote}</div>}
                              </div>
                              <span className="detail-item-value">{hasLaku ? IDR(t.laku*V2K.gaji) : <span style={{color:"var(--text3)"}}>—</span>}</span>
                            </div>
                          );
                        })}
                      </>}
                      {expItems.length>0 && <>
                        <div className="detail-section-label red">Rincian Pengeluaran</div>
                        {expItems.map((x,xi)=>(<div key={xi} className="detail-row"><span className="detail-item-name">{x.desc||'Pengeluaran'}</span><span style={{color:"var(--red)",fontWeight:600}}>−{IDR(x.amount)}</span></div>))}
                      </>}
                      {cashItems.length>0 && <>
                        <div className="detail-section-label green" style={{display:"flex",alignItems:"center",gap:6}}><Icon type="banknote" size={12}/> Cash Masuk</div>
                        {cashItems.map((x,xi)=>(<div key={xi} className="detail-row"><span className="detail-item-name">{x.desc||'Cash Masuk'}</span><span style={{color:"var(--green)",fontWeight:600}}>+{IDR(x.amount)}</span></div>))}
                      </>}
                      <div style={{display:"flex",gap:8,marginTop:14}}>
                        <button className="btn btn-primary" style={{flex:1,padding:"10px"}} onClick={(ev)=>{ev.stopPropagation();startEdit(e);}}><Icon type="pencil" size={14}/> Edit</button>
                        <button className="btn btn-danger" style={{flex:1,padding:"10px"}} onClick={(ev)=>{ev.stopPropagation();deleteEntry(e.date);}}><Icon type="trash" size={14}/> Hapus</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </>}
        </div>
      </div>
    </div>
  );
}

export default App
