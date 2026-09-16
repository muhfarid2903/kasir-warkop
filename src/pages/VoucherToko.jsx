import { useState, useEffect, useRef } from 'react'
import { kirimAtauAntre } from '../outbox.js'
import {
  TOKO, VOUCHER_TOKO_CUTOFF, V2K, V2K_SETORAN,
  getPayPeriods, voucherInRange, voucherStockPerToko, voucherStockBefore,
} from '../model.js'
import { IDR, ML, fmtDate, fmtDateShort } from '../format.js'
import { showToast } from '../toast.js'
import { Icon } from '../components/Icon.jsx'

// Drop & laku voucher 2000 per toko, per hari. selectedDate dipegang App
// karena dipakai bareng halaman Hari Ini.
export default function VoucherToko({ selectedDate, setSelectedDate, voucherToko, setVoucherToko, session, tandaiTulis }) {
  const [voucherDraft, setVoucherDraft] = useState({});
  const [voucherSaving, setVoucherSaving] = useState(false);
  const [voucherInfoOpen, setVoucherInfoOpen] = useState(false);
  const voucherDateRef = useRef(null);

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
      const hasil = await kirimAtauAntre({ type:'simpanVoucher', date:selectedDate, rows });
      tandaiTulis(hasil);
      // Optimistic local update
      setVoucherToko(prev => {
        const next = { ...prev }; const dayMap = { ...(next[selectedDate]||{}) };
        rows.forEach(r => { dayMap[r.tokoId] = { drop: r.drop, laku: r.laku }; });
        next[selectedDate] = dayMap; return next;
      });
      showToast(hasil === 'diantre'
        ? 'Belum ada sinyal — voucher disimpan di HP, terkirim otomatis nanti'
        : 'Voucher tersimpan · '+fmtDate(selectedDate));
    } catch(e) { showToast('Gagal simpan voucher: '+e.message); }
    setVoucherSaving(false);
  }

  return (
    <>
          <div style={{marginBottom:8}}></div>

          <div className="voucher-date-row">
            <button type="button" className="date-display-btn" onClick={() => { const i = voucherDateRef.current; if (!i) return; if (typeof i.showPicker === 'function') i.showPicker(); else i.focus(); }}>
              <Icon type="calendar" size={15}/>
              <span>{fmtDateShort(selectedDate)}</span>
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
  
    </>
  );
}
