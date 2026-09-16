import { getPayPeriods, voucherForDate, periodGaji } from '../model.js'
import { IDR, DAYS, MO, ML } from '../format.js'
import { Icon } from '../components/Icon.jsx'
import { AnimatedIDR } from '../components/AnimatedIDR.jsx'

// Rekap gaji dua periode terakhir. Halaman ini tidak punya state sendiri —
// semuanya diturunkan dari entries + voucherToko.
export default function Gajian({ entries, voucherToko }) {
  const today = new Date();

  return (
    <>
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
  
    </>
  );
}
