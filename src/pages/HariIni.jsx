import { useState, useMemo, useRef } from 'react'
import { saveEntry as dbSaveEntry } from '../db.js'
import {
  PRODUCTS, VOUCHER_TOKO_CUTOFF,
  voucherForDate, draftTotals, buildEntry, computeKasSummary, computePaydayInfo,
} from '../model.js'
import { IDR, ML, fmtDate, fmtDateShort } from '../format.js'
import { showToast } from '../toast.js'
import { Icon } from '../components/Icon.jsx'
import { ProductIcon } from '../components/ProductIcon.jsx'
import { AnimatedIDR } from '../components/AnimatedIDR.jsx'

// Input penjualan harian + kas hari ini. Menyimpan dengan cara MENAMBAH ke
// entri yang sudah ada, bukan mengganti — ganti nilai dilakukan lewat Riwayat.
export default function HariIni({ selectedDate, setSelectedDate, entries, setEntries, voucherToko, initialSaldo, session }) {
  const [quantities, setQuantities] = useState(()=>{ const q={}; PRODUCTS.forEach(p=>q[p.id]=0); return q; });
  const [expenses, setExpenses] = useState([]);
  const [cashIns, setCashIns] = useState([]);
  const [saving, setSaving] = useState(false);
  const hariIniDateRef = useRef(null);

  const existingEntry = entries[selectedDate] || null;

  const inputTotals = useMemo(
    () => draftTotals(quantities, expenses, cashIns),
    [quantities, expenses, cashIns]
  );

  const kasSummary = useMemo(
    () => computeKasSummary(entries, voucherToko, initialSaldo, new Date()),
    [entries, voucherToko, initialSaldo]
  );

  const paydayInfo = useMemo(
    () => computePaydayInfo(entries, voucherToko, new Date()),
    [entries, voucherToko]
  );

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

  return (
    <>
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
              <span>{fmtDateShort(selectedDate)}</span>
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
  
    </>
  );
}
