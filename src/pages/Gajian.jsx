import { useState } from 'react'
import { getPayPeriods, rekapPeriode } from '../model.js'
import { akunJaya } from '../jejak.js'
import { IDR, DAYS, MO, ML } from '../format.js'
import { Icon } from '../components/Icon.jsx'
import { AnimatedIDR } from '../components/AnimatedIDR.jsx'

// Rekap gaji dua periode terakhir. Halaman ini tidak punya state sendiri —
// semuanya diturunkan dari entries + voucherToko.
export default function Gajian({ entries, voucherToko, session }) {
  const today = new Date();
  // Dulu hanya bulan ini dan bulan lalu; periode yang lebih tua tidak bisa
  // dilihat sama sekali dari app.
  const [jumlahBulan, setJumlahBulan] = useState(2);
  const labelGaji = akunJaya(session) ? 'Gajiku' : 'Gaji Jaya';

  return (
    <>
          <div style={{marginBottom:8}}></div>

          {(()=>{
            const currentMonth = today.getMonth(); const currentYear = today.getFullYear(); const currentDay = today.getDate();
            const monthsToShow = Array.from({ length: jumlahBulan }, (_, i) => {
              const d = new Date(currentYear, currentMonth - i, 1);
              return { year: d.getFullYear(), month: d.getMonth() };
            });
            return monthsToShow.map(({year, month}) => {
              const periods = getPayPeriods(year, month);
              const isCurrentMonth = (year===currentYear && month===currentMonth);
              const monthLabel = ML[month]+' '+year;
              // Newest period first; sembunyikan periode yang belum mulai
              const indexed = periods.map((p,pi) => ({p,pi}));
              const ordered = indexed.slice().reverse().filter(({p}) => !(isCurrentMonth && currentDay < p.startDay));
              return ordered.map(({p,pi}) => {
                // Semua hitungan periode ada di model.rekapPeriode (bertes);
                // di sini tinggal menampilkan.
                const r = rekapPeriode(entries, voucherToko, p, year, month, today);
                const totalGaji = r.totalGaji, totalDays = r.hariTercatat;
                const isCurrent = r.status === 'berjalan';
                const statusClass = r.status === 'lalu' ? 'paid' : isCurrent ? 'pending' : 'future';
                const statusText = r.status === 'lalu' ? 'Sudah gajian' : isCurrent ? 'Lagi jalan' : 'Nanti';
                const periodLength = r.panjang, daysElapsed = r.hariKe, progressPct = r.persen, daysToPayday = r.sisaHari;
                const countdownText = daysToPayday === 0 ? 'Hari ini gajian!' : daysToPayday === 1 ? 'Besok gajian!' : 'Tinggal '+daysToPayday+' hari lagi';
                const countdownUrgent = daysToPayday <= 2;
                const barisHari = (b, gaya) => {
                  const dt = new Date(b.date+'T00:00:00');
                  return (
                    <div key={b.date} className="gajian-day-row" style={gaya}>
                      <div className="gajian-day-date">{dt.getDate()} {MO[dt.getMonth()]} <span className="day-name">{DAYS[dt.getDay()]}</span></div>
                      <div className="gajian-day-amount">{IDR(b.gaji)}</div>
                    </div>
                  );
                };

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
                          <div className="gajian-hero-amount-label">{labelGaji}</div>
                          <div className="gajian-hero-amount-value"><AnimatedIDR value={totalGaji}/></div>
                        </div>
                        <div className="gajian-hero-progress">
                          <div className="gajian-hero-progress-bar"><div className="gajian-hero-progress-fill" style={{width:progressPct+'%'}}/></div>
                          <div className="gajian-hero-progress-meta">
                            {/* Batangnya mengukur hari kalender, bukan uang — jadi
                                disebut dalam hari, bukan persen. */}
                            <span>Hari ke-{daysElapsed} dari {periodLength}{totalDays>0 ? ' · '+totalDays+' hari tercatat' : ' · belum ada catatan'}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="gajian-header">
                        <div>
                          <div className="gajian-period-label">{monthLabel} · {p.label}</div>
                        </div>
                        <div className="gajian-total-box">
                          <div className="gajian-total-label">{labelGaji}</div>
                          <div className="gajian-total-value"><AnimatedIDR value={totalGaji}/></div>
                          <span className={"gajian-status-badge "+statusClass}>{statusText}</span>
                        </div>
                      </div>
                    )}

                    {r.limpahan.length>0 && (
                      <div style={{borderBottom:"1px dashed var(--border)",marginBottom:4,paddingBottom:4}}>
                        <div style={{fontSize:11,fontWeight:700,color:"var(--orange)",letterSpacing:".06em",textTransform:"uppercase",padding:"4px 0 6px",display:"flex",alignItems:"center",gap:6}}><Icon type="arrow-up" size={11}/> Sisa dari {ML[p.prevMonth]}</div>
                        {r.limpahan.map(b => barisHari(b, {background:"rgba(251,146,60,.04)"}))}
                      </div>
                    )}

                    {r.baris.length === 0
                      ? <div className="gajian-empty-state">Periode ini masih kosong</div>
                      : r.baris.map(b => barisHari(b))}
                  </div>
                );
              });
            });
          })()}
  
          <button type="button" className="tampil-lagi" onClick={()=>setJumlahBulan(n=>n+2)}>Periode lebih lama</button>
    </>
  );
}
