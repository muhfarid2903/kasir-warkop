import { useState, useMemo, useEffect } from 'react'
import { saveEntry as dbSaveEntry, saveVoucherToko as dbSaveVoucherToko } from '../db.js'
import { kirimAtauAntre } from '../outbox.js'
import {
  PRODUCTS, TOKO, VOUCHER_TOKO_CUTOFF, V2K,
  voucherForDate, voucherStockBefore, buildEntry, entryDayTotals,
} from '../model.js'
import { IDR, DAYS, MO, fmtDate } from '../format.js'
import { showToast } from '../toast.js'
import { exportRiwayatCSV } from '../csv.js'
import { useEntryEditor } from '../hooks.js'
import { Icon } from '../components/Icon.jsx'
import { ProductIcon } from '../components/ProductIcon.jsx'
import { SkeletonInput } from '../components/Skeleton.jsx'

// Daftar seluruh hari tersimpan, plus satu-satunya tempat entri bisa diedit
// atau dihapus. Saldo Awal juga di sini karena dia titik nol timeline ini.
export default function Riwayat({ entries, setEntries, voucherToko, setVoucherToko, initialSaldo, setInitialSaldo, session, loadAllDetails, detailsReady, tandaiTulis }) {
  // Halaman ini satu-satunya yang butuh quantities & expenses SEMUA tanggal,
  // jadi di sinilah detail lengkap ditarik — bukan saat login.
  useEffect(() => { loadAllDetails(); }, [loadAllDetails]);

  const [openDetail, setOpenDetail] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingSaldo, setEditingSaldo] = useState(false);
  const [saldoInput, setSaldoInput] = useState('');
  const {
    editingDate, setEditingDate,
    editQty, setEditQty,
    editExpenses, setEditExpenses,
    editCashIns, setEditCashIns,
    editVoucher, setEditVoucher,
    editSaving, setEditSaving,
  } = useEntryEditor();

  // Tanggal yang cuma punya data voucher tetap muncul sebagai baris kosong,
  // supaya hari yang ada laku voucher tidak hilang dari riwayat.
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

  async function saveInitialSaldo(val) {
    const v = parseInt(val) || 0;
    setInitialSaldo(v);
    setEditingSaldo(false);
    try {
      const hasil = await kirimAtauAntre({ type:'simpanSaldo', value:v });
      tandaiTulis(hasil);
      showToast(hasil === 'diantre' ? 'Saldo awal disimpan di HP, terkirim nanti' : 'Saldo awal disimpan: '+IDR(v));
    } catch(e) { showToast('Gagal simpan saldo: '+e.message); }
  }

  async function deleteEntry(date) {
    if(!confirm('Yakin hapus data tanggal '+fmtDate(date)+'?')) return;
    try {
      const hasil = await kirimAtauAntre({ type:'hapusEntri', date });
      tandaiTulis(hasil);
      showToast(hasil === 'diantre' ? 'Penghapusan menunggu sinyal' : 'Entri dihapus');
    } catch(e) { showToast('Gagal: '+e.message); }
  }

  // === Edit entri (mengganti nilai, bukan menambah) ===
  function startEdit(e) {
    // Salin dulu SEMUA kunci qty yang ada, baru pastikan tiap PRODUCTS punya
    // nilai. Produk yang sudah tidak dijual ikut terbawa apa adanya.
    const q = { ...(e.quantities || {}) }; PRODUCTS.forEach(p => q[p.id] = e.quantities?.[p.id] || 0);
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
    const accQty = { ...editQty }; PRODUCTS.forEach(p => accQty[p.id] = editQty[p.id]||0);
    const expenses = editExpenses.filter(e => (e.amount||0)>0 || (e.desc||'').trim()!=='').map(e=>({desc:e.desc, amount:e.amount||0}));
    const cashIns  = editCashIns.filter(e => (e.amount||0)>0 || (e.desc||'').trim()!=='').map(e=>({desc:e.desc, amount:e.amount||0, type:'cashin'}));
    const accExpenses = [...expenses, ...cashIns];
    const entry = buildEntry(date, accQty, accExpenses);
    // Hindari membuat baris entri kosong untuk tanggal yang cuma punya data voucher
    const entryExisted = !!entries[date];
    const entryHasData = Object.values(accQty).some(v=>(v||0)>0) || accExpenses.length>0;
    const writeEntry = entryHasData || entryExisted;
    setEditSaving(true);
    try {
      // Edit MENGGANTI nilai, jadi tidak lewat antrean: mengirim ulang nanti
      // bisa menimpa perubahan yang lebih baru dari perangkat lain. Lebih baik
      // gagal terang-terangan dan diulang sendiri saat sinyal kembali.
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

  if (!detailsReady) return (
    <>
      <div style={{marginBottom:8}}></div>
      <SkeletonInput/>
    </>
  );

  return (
    <>
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
    </>
  );
}
