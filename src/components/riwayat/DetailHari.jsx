import { Icon } from '../Icon.jsx'
import { ProductIcon } from '../ProductIcon.jsx'
import { IDR } from '../../format.js'
import { tarifVoucher } from '../../model.js'
import { JejakHari } from './JejakHari.jsx'

// Rincian satu hari di Riwayat (bukan mode edit): tiga angka, rincian gaji
// per produk & per toko, pengeluaran, setoran ke pemilik, pencocokan kas,
// cash masuk, dan jejak input. Murni tampilan — semua angkanya datang dari
// entryDayTotals() yang dihitung pemanggil.
export function DetailHari({ e, totals, sold, tokoBreakdown, hitungHari, jejakHari, kasir, onEdit, onHapus }) {
  const { expItems, cashItems, setorItems, expGross, cashGross, voucher: v,
          totalGaji: totalGajiRow, kePemilik, hasil,
          totalPenjualan: totalPenjualanRow, sisaKas } = totals;
  const sisaSign = hasil>0?'pos':hasil<0?'neg':'';
  const sisaLabel = hasil>0?'Untung':hasil<0?'Rugi':'Impas';
  const cocokHari = hitungHari.slice(-1)[0];
  return (
    <div className="history-detail">
      <div className="history-summary">
        <div className="summary-row add"><span className="summary-label">Pemasukan</span><span className="summary-value">{IDR(totalPenjualanRow)}</span></div>
        <div className="summary-row sub"><span className="summary-label">Gaji</span><span className="summary-value">−{IDR(totalGajiRow)}</span></div>
        {expGross>0 && <div className="summary-row sub"><span className="summary-label">Pengeluaran</span><span className="summary-value">−{IDR(expGross)}</span></div>}
        {cashGross>0 && <div className="summary-row cash"><span className="summary-label">Cash Masuk</span><span className="summary-value">+{IDR(cashGross)}</span></div>}
        <div className="summary-row total">
          <span className="summary-label">{sisaLabel} Hari Ini</span>
          <span className={"summary-value "+sisaSign}>{IDR(hasil)}</span>
        </div>
        {/* Hanya kalau ada uang yang pindah ke pemilik — selain
            itu "kas toko" sama persis dengan hasil di atas. */}
        {kePemilik>0 && <>
          <div className="summary-row"><span className="summary-label">Ke kas pemilik</span><span className="summary-value">−{IDR(kePemilik)}</span></div>
          <div className="summary-row"><span className="summary-label">Kas toko</span><span className={"summary-value "+(sisaKas<0?'neg':'')}>{sisaKas>0?'+':''}{IDR(sisaKas)}</span></div>
        </>}
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
                  {hasLaku && <> · <strong>{t.laku}</strong> laku × {IDR(tarifVoucher(e.date).gaji)}</>}
                  {!hasLaku && hasDrop && <span style={{color:"var(--text3)"}}> · drop saja, belum laku</span>}
                </div>
                {hasDrop && <div className="toko-sub"><Icon type="package" size={11}/> Drop {t.drop} voucher ke toko{dropNote}</div>}
              </div>
              <span className="detail-item-value">{hasLaku ? IDR(t.laku*tarifVoucher(e.date).gaji) : <span style={{color:"var(--text3)"}}>—</span>}</span>
            </div>
          );
        })}
      </>}
      {expItems.length>0 && <>
        <div className="detail-section-label red">Rincian Pengeluaran</div>
        {expItems.map((x,xi)=>(<div key={xi} className="detail-row"><span className="detail-item-name">{x.desc||'Pengeluaran'}</span><span style={{color:"var(--red)",fontWeight:600}}>−{IDR(x.amount)}</span></div>))}
      </>}
      {(setorItems.length>0 || v.kePemilik>0) && <>
        <div className="detail-section-label" style={{display:"flex",alignItems:"center",gap:6}}><Icon type="wallet" size={12}/> Ke kas pemilik</div>
        {tokoBreakdown.filter(t=>t.kePemilik && t.laku>0).map(t=>(<div key={'vp'+t.id} className="detail-row"><span className="detail-item-name">Setoran voucher {t.name} ({t.laku})</span><span className="detail-item-value">{IDR(t.laku*tarifVoucher(e.date).setoran)}</span></div>))}
        {setorItems.map((x,xi)=>(<div key={'sp'+xi} className="detail-row"><span className="detail-item-name">{x.desc||'Setor ke pemilik'}</span><span className="detail-item-value">{IDR(x.amount)}</span></div>))}
      </>}
      {cocokHari && <>
        <div className="detail-section-label" style={{display:"flex",alignItems:"center",gap:6}}><Icon type="coins" size={12}/> Cocokkan kas</div>
        {hitungHari.map(h=>(<div key={h.id} className="detail-row"><span className="detail-item-name">{h.oleh} · app {IDR(h.sistem)}, laci {IDR(h.fisik)}{h.catatan ? ' · '+h.catatan : ''}</span><span className="detail-item-value" style={{color:h.selisih===0?'var(--green)':'var(--orange)'}}>{h.selisih===0?'cocok':IDR(h.selisih)}</span></div>))}
      </>}
      {cashItems.length>0 && <>
        <div className="detail-section-label green" style={{display:"flex",alignItems:"center",gap:6}}><Icon type="banknote" size={12}/> Cash Masuk</div>
        {cashItems.map((x,xi)=>(<div key={xi} className="detail-row"><span className="detail-item-name">{x.desc||'Cash Masuk'}</span><span style={{color:"var(--green)",fontWeight:600}}>+{IDR(x.amount)}</span></div>))}
      </>}
      <div className="detail-section-label" style={{display:"flex",alignItems:"center",gap:6}}><Icon type="clock" size={12}/> Jejak Input</div>
      <JejakHari list={jejakHari}/>
      <div style={{display:"flex",gap:8,marginTop:14}}>
        <button className="btn btn-primary" style={{flex:1,padding:"10px"}} onClick={(ev)=>{ev.stopPropagation();onEdit();}}><Icon type="pencil" size={14}/> Edit</button>
        {!kasir && <button className="btn btn-danger" style={{flex:1,padding:"10px"}} onClick={(ev)=>{ev.stopPropagation();onHapus();}}><Icon type="trash" size={14}/> Hapus</button>}
      </div>
    </div>
  );
}
