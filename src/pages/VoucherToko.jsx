import { useState, useEffect, useRef } from 'react'
import { kirimAtauAntre } from '../outbox.js'
import {
  TOKO, VOUCHER_TOKO_CUTOFF, V2K, V2K_SETORAN,
  getPayPeriods, voucherInRange, voucherStockPerToko, voucherStockBefore, infoToko,
} from '../model.js'
import { tandaJejak, rincianVoucher } from '../jejak.js'
import { IDR, ML, fmtDate, pesanGalat } from '../format.js'
import { showToast } from '../toast.js'
import { Icon } from '../components/Icon.jsx'
import { PilihTanggal } from '../components/PilihTanggal.jsx'

// Tanda "ke pemilik" yang terakhir dipakai toko ini sebelum tanggal itu —
// toko yang biasa menyetor ke pemilik hampir selalu begitu lagi.
function pilihanTerakhir(tokoId, tanggal, voucherToko) {
  const tgl = Object.keys(voucherToko || {}).filter(d => d < tanggal && (voucherToko[d][tokoId]?.laku || 0) > 0).sort();
  const d = tgl[tgl.length - 1];
  return d ? !!voucherToko[d][tokoId].kePemilik : false;
}

// Drop & laku voucher 2000 per toko, per hari. selectedDate dipegang App
// karena dipakai bareng halaman Hari Ini.
export default function VoucherToko({ hariIni, fitur, selectedDate, setSelectedDate, voucherToko, setVoucherToko, session, tandaiTulis }) {
  const [voucherDraft, setVoucherDraft] = useState({});
  const [voucherSaving, setVoucherSaving] = useState(false);
  const [voucherInfoOpen, setVoucherInfoOpen] = useState(false);
  const [rekapTerbuka, setRekapTerbuka] = useState(false);

  // Kolom yang sudah diketik orang di tanggal ini ("dadi.laku", …). Dulu tiap
  // event realtime dari HP lain menyetel ulang SEMUA kolom dari server, jadi
  // angka yang sedang diketik hilang. Sekarang yang ikut diperbarui hanya
  // kolom yang belum disentuh.
  const disentuh = useRef(new Set());
  const tanggalDraft = useRef(null);

  useEffect(() => {
    const day = voucherToko[selectedDate] || {};
    const gantiTanggal = tanggalDraft.current !== selectedDate;
    if (gantiTanggal) { disentuh.current = new Set(); tanggalDraft.current = selectedDate; }
    setVoucherDraft(prev => {
      const next = {};
      TOKO.forEach(t => {
        const r = day[t.id] || { drop:0, laku:0, kePemilik: pilihanTerakhir(t.id, selectedDate, voucherToko) };
        const lama = prev[t.id];
        const tetap = (f) => !gantiTanggal && lama && disentuh.current.has(t.id+'.'+f);
        next[t.id] = {
          drop: tetap('drop') ? lama.drop : String(r.drop||0),
          laku: tetap('laku') ? lama.laku : String(r.laku||0),
          kePemilik: tetap('kePemilik') ? lama.kePemilik : !!r.kePemilik,
        };
      });
      return next;
    });
  }, [selectedDate, voucherToko]);

  function setDraft(tokoId, field, val) {
    disentuh.current.add(tokoId+'.'+field);
    setVoucherDraft(prev => ({ ...prev, [tokoId]: { ...(prev[tokoId]||{drop:'0',laku:'0'}), [field]: val } }));
  }

  async function saveVoucherTokoDay() {
    if (selectedDate < VOUCHER_TOKO_CUTOFF) { showToast('Voucher Toko hanya untuk 1 Mei 2026 dan setelahnya'); return; }
    const stockBefore = voucherStockBefore(selectedDate, voucherToko);
    const rows = TOKO.map(t => {
      const d = voucherDraft[t.id] || { drop:'0', laku:'0' };
      const laku = parseInt(d.laku)||0;
      // Tanda ke pemilik hanya berarti kalau ada yang laku.
      return { tokoId: t.id, drop: parseInt(d.drop)||0, laku, kePemilik: !!(fitur?.kePemilik && laku > 0 && d.kePemilik) };
    });
    // Pengaman: tolak bila ada toko dengan laku melebihi stok (stok awal + drop hari ini)
    const over = rows.find(r => { const sB = stockBefore[r.tokoId]; return r.laku > ((sB.drop||0)-(sB.laku||0)) + r.drop; });
    if (over) { const t = TOKO.find(x=>x.id===over.tokoId); showToast('Laku '+(t?t.name:over.tokoId)+' melebihi stok — perbaiki dulu'); return; }
    // Yang dikirim HANYA toko yang benar-benar berubah. Dulu kelima toko
    // dikirim tiap kali; dari antrean offline itu bisa menimpa perubahan HP
    // lain di toko yang tidak disentuh di sini.
    const berubah = rincianVoucher(rows, voucherToko[selectedDate]);
    if (!berubah) { showToast('Tidak ada yang berubah'); return; }
    const idBerubah = new Set(berubah.toko.map(t => t.id));
    const rowsBerubah = rows.filter(r => idBerubah.has(r.tokoId));
    const jejak = tandaJejak(session, 'voucher', berubah);
    setVoucherSaving(true);
    try {
      const hasil = await kirimAtauAntre({ type:'simpanVoucher', date:selectedDate, rows: rowsBerubah, jejak });
      tandaiTulis(hasil);
      // Optimistic local update
      // Sudah tersimpan: kolomnya kembali ikut data server.
      disentuh.current = new Set();
      setVoucherToko(prev => {
        const next = { ...prev }; const dayMap = { ...(next[selectedDate]||{}) };
        rowsBerubah.forEach(r => { dayMap[r.tokoId] = { drop: r.drop, laku: r.laku, kePemilik: r.kePemilik }; });
        next[selectedDate] = dayMap; return next;
      });
      showToast(hasil === 'diantre'
        ? 'Belum ada sinyal — voucher disimpan di HP, terkirim otomatis nanti'
        : 'Voucher tersimpan · '+fmtDate(selectedDate));
    } catch(e) { showToast('Voucher belum tersimpan: '+pesanGalat(e), 'gagal'); }
    setVoucherSaving(false);
  }

  return (
    <>
          <div style={{marginBottom:8}}></div>

          <PilihTanggal value={selectedDate} onChange={setSelectedDate} hariIni={hariIni} min={VOUCHER_TOKO_CUTOFF}>
            <button type="button" className={"info-toggle"+(voucherInfoOpen?" active":"")} onClick={()=>setVoucherInfoOpen(v=>!v)} title="Info Drop & Laku" aria-label="Info">
              <span style={{fontFamily:'var(--font-angka)',fontSize:14,fontWeight:700,lineHeight:1}}>?</span>
            </button>
          </PilihTanggal>
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
            let dayDrop=0, dayLaku=0, dayLakuPemilik=0, anyOverLaku=false;
            TOKO.forEach(t => {
              const d = voucherDraft[t.id]||{drop:'0',laku:'0'};
              const dDrop = parseInt(d.drop)||0, dLaku = parseInt(d.laku)||0;
              dayDrop += dDrop; dayLaku += dLaku;
              if (fitur?.kePemilik && d.kePemilik) dayLakuPemilik += dLaku;
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
                    {dayLaku-dayLakuPemilik > 0 && <span className="seg setoran">Masuk kas toko <strong>{IDR((dayLaku-dayLakuPemilik)*V2K_SETORAN)}</strong></span>}
                    {dayLakuPemilik > 0 && <span className="seg pemilik">Ke pemilik <strong>{IDR(dayLakuPemilik*V2K_SETORAN)}</strong></span>}
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
                  const info = infoToko(t.id, selectedDate, voucherToko);
                  // Stok yang mengendap lama di toko: layak ditagih atau dikurangi dropnya.
                  const mengendap = stokAwal > 0 && (info.hariSejak ?? 0) > 14;
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
                        <div className={"toko-input-group drop"+(dDrop===0?" kosong":"")}>
                          <label>+ Drop</label>
                          <input type="number" inputMode="numeric" min="0" placeholder="0" value={draft.drop==='0'?'':draft.drop} onChange={e=>setDraft(t.id,'drop',e.target.value)}/>
                        </div>
                        <div className={"toko-input-group laku"+(dLaku===0?" kosong":"")}>
                          <label>− Laku</label>
                          <input type="number" inputMode="numeric" min="0" placeholder="0" value={draft.laku==='0'?'':draft.laku} onChange={e=>setDraft(t.id,'laku',e.target.value)}/>
                        </div>
                      </div>
                      {/* Pola nyata: toko menyetor seluruh stok lalu diisi ulang
                          dengan jumlah yang biasa. Dua chip ini mengganti dua
                          ketikan angka yang paling sering. */}
                      {(stokAwal > 0 || info.dropUmum) && (
                        <div className="toko-cepat">
                          {stokAwal > 0 && dLaku !== stokAwal && (
                            <button type="button" className="chip" onClick={()=>setDraft(t.id,'laku',String(stokAwal))}>Laku semua ({stokAwal})</button>
                          )}
                          {info.dropUmum && dDrop !== info.dropUmum && (
                            <button type="button" className="chip" onClick={()=>setDraft(t.id,'drop',String(info.dropUmum))}>Drop {info.dropUmum}</button>
                          )}
                        </div>
                      )}
                      <div className={"toko-setor-terakhir"+(mengendap?" lama":"")}>
                        {info.terakhirSetor
                          ? <>Setor terakhir {fmtDate(info.terakhirSetor).replace(/^\w+, /,'').replace(/ \d{4}$/,'')} · {info.hariSejak===0?'hari ini':info.hariSejak===1?'kemarin':info.hariSejak+' hari lalu'}{mengendap?' — stok mengendap':''}</>
                          : 'Belum pernah setor'}
                      </div>
                      {(overLaku || dLaku > 0) && (
                        <div className="toko-footer">
                          {overLaku
                            ? <span className="error"><Icon type="alert" size={13}/> Laku melebihi stok</span>
                            : <>
                                <span className={"seg "+(fitur?.kePemilik && draft.kePemilik ? "pemilik" : "setoran")}>
                                  {fitur?.kePemilik && draft.kePemilik ? 'Ke pemilik' : 'Masuk kas toko'} <strong>{IDR(dLaku*V2K_SETORAN)}</strong>
                                </span>
                                <span className="seg gaji">Gaji Jaya <strong>{IDR(dLaku*V2K.gaji)}</strong></span>
                              </>
                          }
                        </div>
                      )}
                      {/* Ke mana uang setoran ini pergi. Dulu dicatat terpisah
                          sebagai pengeluaran "tf <toko>" di Hari Ini — dua
                          halaman, dua kali simpan, dan hari itu tampil rugi. */}
                      {fitur?.kePemilik && dLaku > 0 && !overLaku && (
                        <label className="saklar-pemilik">
                          <input type="checkbox" checked={!!draft.kePemilik} onChange={e=>setDraft(t.id,'kePemilik',e.target.checked)}/>
                          <span className="saklar-pemilik-teks">
                            <strong>Masuk ke kas pemilik</strong>
                            <span>{draft.kePemilik ? 'Tidak masuk laci toko' : 'Uangnya masuk laci toko'}</span>
                          </span>
                        </label>
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
                      {/* Rekap itu bacaan, bukan input — dilipat supaya tidak
                          memakan 267px di halaman yang kerjanya mengisi angka.
                          Bagian "sisa stok per toko" di dalamnya juga mengulang
                          pil stok yang sudah ada di tiap kartu toko. */}
                      <button className="rekap-toggle" aria-expanded={rekapTerbuka} onClick={()=>setRekapTerbuka(v=>!v)}>
                        <span className="card-title" style={{marginBottom:0}}><Icon type="calendar" size={16}/> Rekap Periode {ML[sm]} · {p.label}</span>
                        <span className="rekap-chev">{rekapTerbuka ? '\u25B4' : '\u25BE'}</span>
                      </button>
                      {rekapTerbuka && <>
                      <div className="voucher-day-summary" style={{margin:"14px 0 16px"}}>
                        <span className="seg">Total drop <strong>{range.drop}</strong></span>
                        <span className="seg">Total laku <strong>{range.laku}</strong></span>
                        <span className="seg gaji">Gaji periode <strong>{IDR(range.gaji)}</strong></span>
                        <span className="seg setoran">Penjualan <strong>{IDR(range.penjualan)}</strong></span>
                      </div>
                      <div style={{fontSize:12,color:"var(--text3)",marginBottom:8}}>
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
                      </>}
                    </div>
                  );
                })()}
              </>
            );
          })()}
  
    </>
  );
}
