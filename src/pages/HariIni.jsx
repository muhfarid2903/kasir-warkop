import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
// (akses Supabase lewat outbox — lihat src/outbox.js)
import { kirimAtauAntre } from '../outbox.js'
import {
  PRODUCTS, PRODUK_UTAMA, PRODUK_SEKUNDER, PRESET_PENGELUARAN, VOUCHER_TOKO_CUTOFF,
  voucherForDate, draftTotals, accumulateEntry, computeKasSummary, computePaydayInfo, hasDetail,
} from '../model.js'
import { IDR, ML, fmtDate, fmtDateShort } from '../format.js'
import { showToast } from '../toast.js'
import { Icon } from '../components/Icon.jsx'
import { ProductIcon } from '../components/ProductIcon.jsx'
import { AnimatedIDR } from '../components/AnimatedIDR.jsx'

// Input penjualan harian + kas hari ini. Menyimpan dengan cara MENAMBAH ke
// entri yang sudah ada, bukan mengganti — ganti nilai dilakukan lewat Riwayat.
export default function HariIni({ selectedDate, setSelectedDate, entries, setEntries, voucherToko, initialSaldo, session, ensureDetail, tandaiTulis }) {
  const [quantities, setQuantities] = useState(()=>{ const q={}; PRODUCTS.forEach(p=>q[p.id]=0); return q; });
  const [expenses, setExpenses] = useState([]);
  const [cashIns, setCashIns] = useState([]);
  const [saving, setSaving] = useState(false);
  const [lainnyaTerbuka, setLainnyaTerbuka] = useState(false);
  const hariIniDateRef = useRef(null);

  const existingEntry = entries[selectedDate] || null;

  // Muat awal cuma menarik kolom angka. Tanggal yang sedang dilihat butuh
  // quantities & expenses-nya, jadi diambil satu baris saat tanggal berganti.
  useEffect(() => { ensureDetail(selectedDate); }, [selectedDate, ensureDetail]);

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

  // Peredam salah sentuh: kartu produk itu sasaran besar, jadi jari yang
  // sedang menggulir bisa memicunya. Ketukan baru dihitung kalau jari nyaris
  // tidak bergeser dan tidak ditahan lama — gerakan menggulir diabaikan.
  // Dipasang di sini, bukan mengecilkan kartunya, karena justru luasnya itu
  // yang membuat menambah kopi jadi gampang sambil berdiri.
  const sentuhAwal = useRef(null);
  const mulaiSentuh = useCallback((e) => {
    sentuhAwal.current = { x: e.clientX, y: e.clientY, t: Date.now() };
  }, []);
  const selesaiSentuh = useCallback((e, aksi) => {
    const a = sentuhAwal.current;
    sentuhAwal.current = null;
    if (!a) return;
    const geser = Math.hypot(e.clientX - a.x, e.clientY - a.y);
    if (geser > 12 || Date.now() - a.t > 700) return;   // menggulir atau menahan
    aksi();
  }, []);

  function changeQty(id, delta) { setQuantities(prev => ({...prev, [id]: Math.max(0, (prev[id]||0)+delta)})); }
  function setQty(id, val) { setQuantities(prev => ({...prev, [id]: Math.max(0, parseInt(val)||0)})); }
  // desc diisi lewat chip preset supaya keterangan yang itu-itu saja tidak
  // perlu diketik ulang; kursor langsung mendarat di kolom nominal.
  function addExpense(desc='') { setExpenses(prev => [...prev, {desc, amount:0}]); }
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
    const input = { quantities, expenses, cashIns };
    try {
      // Tebak hasilnya untuk layar: entri lokal dipakai kalau detailnya sudah
      // ada. Angka pasti menyusul dari server / saat antrean terkirim.
      const dasar = hasDetail(existingEntry) ? existingEntry : null;
      const tebakan = accumulateEntry(dasar, selectedDate, input);
      const hasil = await kirimAtauAntre({ type:'tambahEntri', date:selectedDate, input });
      tandaiTulis(hasil);
      setEntries(prev => ({ ...prev, [selectedDate]: tebakan }));
      showToast(hasil === 'diantre'
        ? 'Belum ada sinyal — disimpan di HP, terkirim otomatis nanti'
        : (dasar ? 'Ditambahkan' : 'Tersimpan')+' · '+fmtDate(selectedDate));
      // Reset form HANYA bila tidak gagal — supaya input tidak hilang saat gagal
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
              // Detail tanggal ini belum tiba: diamkan dulu, jangan tampilkan "–"
              // yang bikin seolah harinya kosong padahal ada isinya.
              if (existingEntry && !hasDetail(existingEntry) && !hasVoucher) return null;
              const items = hasDetail(existingEntry) ? PRODUCTS.filter(p=>(existingEntry.quantities?.[p.id]||0)>0).map(p=>p.name+' ×'+existingEntry.quantities[p.id]).join(', ') : '';
              const summary = items || (hasVoucher ? 'voucher ×'+v.laku : '–');
              return (
                <span className="date-hint">
                  <Icon type="package" size={13}/> Sudah tercatat <strong>{summary}</strong>
                </span>
              );
            })()}
          </div>

          {(() => {
            const tersedia = PRODUCTS.filter(p => !(p.id==='v2k' && selectedDate >= VOUCHER_TOKO_CUTOFF));
            const cari = (id) => tersedia.find(p => p.id === id);
            const utama = PRODUK_UTAMA.map(cari).filter(Boolean);
            const sekunder = PRODUK_SEKUNDER.map(cari).filter(Boolean);
            const dipakai = new Set([...utama, ...sekunder].map(p => p.id));
            const lainnya = tersedia.filter(p => !dipakai.has(p.id));

            return (
              <>
                {/* Dua produk yang menyumbang 97% volume: seluruh kartu jadi
                    tombol +1, bukan tombol kecil yang harus dibidik. */}
                <div className="produk-grid">
                  {utama.map(p => {
                    const n = quantities[p.id] || 0;
                    return (
                      <div
                        key={p.id}
                        className={"produk-kartu"+(n>0?" ada-isi":"")}
                        role="button"
                        tabIndex={0}
                        aria-label={"Tambah "+p.name}
                        onPointerDown={mulaiSentuh}
                        onPointerUp={(e)=>selesaiSentuh(e, ()=>changeQty(p.id,1))}
                        onKeyDown={(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); changeQty(p.id,1); } }}
                      >
                        <div className="produk-kartu-atas">
                          <ProductIcon type={p.id} size={21}/>
                          <div className="produk-kartu-nama">
                            <div className="nama">{p.name}</div>
                            <div className="harga">{IDR(p.price)}</div>
                          </div>
                        </div>
                        <div className="produk-kartu-bawah">
                          <span className="angka">{n}</span>
                          {n > 0 && (
                            <button
                              className="kurang"
                              aria-label={"Kurangi "+p.name}
                              onPointerDown={(e)=>e.stopPropagation()}
                              onPointerUp={(e)=>e.stopPropagation()}
                              onClick={(e)=>{ e.stopPropagation(); changeQty(p.id,-1); }}
                            >−</button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="chip-row">
                  {sekunder.map(p => {
                    const n = quantities[p.id] || 0;
                    return (
                      <div
                        key={p.id}
                        className={"chip"+(n>0?" ada-isi":"")}
                        role="button"
                        tabIndex={0}
                        aria-label={"Tambah "+p.name}
                        onPointerDown={mulaiSentuh}
                        onPointerUp={(e)=>selesaiSentuh(e, ()=>changeQty(p.id,1))}
                        onKeyDown={(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); changeQty(p.id,1); } }}
                      >
                        {p.name}
                        {n>0 && <span className="chip-angka">{n}</span>}
                        {/* Tanpa ini chip hanya bisa menambah — kelebihan tap
                            tidak ada jalan pulangnya selain lewat Riwayat. */}
                        {n>0 && (
                          <button
                            className="chip-kurang"
                            aria-label={"Kurangi "+p.name}
                            onPointerDown={(e)=>e.stopPropagation()}
                            onPointerUp={(e)=>e.stopPropagation()}
                            onClick={(e)=>{ e.stopPropagation(); changeQty(p.id,-1); }}
                          >−</button>
                        )}
                      </div>
                    );
                  })}
                  {lainnya.length > 0 && (
                    <button
                      className={"chip"+(lainnyaTerbuka?" ada-isi":"")}
                      aria-expanded={lainnyaTerbuka}
                      onClick={()=>setLainnyaTerbuka(v=>!v)}
                    >
                      {lainnyaTerbuka ? 'Tutup' : 'Lainnya'} ({lainnya.length})
                    </button>
                  )}
                </div>

                {lainnyaTerbuka && lainnya.length > 0 && (
                  <div className="card" style={{marginTop:10}}>
                    {lainnya.map(p => (
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
                  </div>
                )}

                {(inputTotals.totalQty>0 || inputTotals.totalExpense>0 || inputTotals.totalCashIn>0) && (
                  <div className="inline-summary" style={{marginTop:12}}>
                    <span className="seg">Penjualan <strong>{IDR(inputTotals.totalSales)}</strong></span>
                    <span className="seg">Gaji <strong>{IDR(inputTotals.totalGaji)}</strong></span>
                    <span className={"seg profit"+(inputTotals.sisaKas<0?" neg":"")}>{inputTotals.sisaKas>=0?'Untung':'Rugi'} <strong>{IDR(inputTotals.sisaKas)}</strong></span>
                  </div>
                )}
              </>
            );
          })()}

          {/* Pengeluaran naik ke sini: dipakai 89% hari, dulu terkubur di
              bawah delapan baris produk. Chip-nya dari keterangan yang paling
              sering diketik ulang. */}
          <div className="pengeluaran-blok">
            <div className="pengeluaran-label">Pengeluaran</div>
            <div className="chip-row">
              {PRESET_PENGELUARAN.map(nama => (
                <button key={nama} className="chip" onClick={()=>addExpense(nama)}>{nama}</button>
              ))}
              <button className="chip samar" onClick={()=>addExpense('')}>+ Lain</button>
              <button className="chip samar" onClick={addCashIn}>+ Cash Masuk</button>
            </div>

            {expenses.map((exp, i) => (
              <div key={'e'+i} className="expense-row">
                <input className="expense-input" type="text" placeholder="Keterangan…" value={exp.desc} onChange={e=>updateExpense(i,'desc',e.target.value)}/>
                <input className="expense-amount" type="number" inputMode="numeric" placeholder="Jumlah" autoFocus={exp.desc!=='' && !exp.amount} value={exp.amount||''} onChange={e=>updateExpense(i,'amount',e.target.value)}/>
                <button className="del-btn" onClick={()=>removeExpense(i)}>×</button>
              </div>
            ))}

            {cashIns.length>0 && (
              <div className="catatan-section">
                <div className="catatan-section-label green"><Icon type="banknote" size={11}/> Cash Masuk</div>
                {cashIns.map((exp, i) => (
                  <div key={'c'+i} className="expense-row">
                    <input className="expense-input" type="text" placeholder="Cth: Pak Budi bayar hutang…" value={exp.desc} onChange={e=>updateCashIn(i,'desc',e.target.value)}/>
                    <input className="expense-amount" type="number" inputMode="numeric" placeholder="Jumlah" value={exp.amount||''} onChange={e=>updateCashIn(i,'amount',e.target.value)}/>
                    <button className="del-btn" onClick={()=>removeCashIn(i)}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            className={"btn-save simpan-sticky"+((inputTotals.totalQty>0||inputTotals.totalExpense>0||inputTotals.totalCashIn>0)?"":" kosong")}
            disabled={saving}
            onClick={saveEntry}
          >
            <Icon type="coffee" size={16}/> Simpan
            {inputTotals.totalQty>0 && <span className="simpan-total">· {IDR(inputTotals.totalSales)}</span>}
          </button>
  
    </>
  );
}
