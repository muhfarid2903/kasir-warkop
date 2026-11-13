import { useRef } from 'react'
import { Icon } from './Icon.jsx'
import { fmtDateShort } from '../format.js'
import { dateToISO } from '../model.js'

// Pemilih tanggal untuk Hari Ini dan Voucher Toko (dulu ditulis dua kali).
// Tombolnya membuka kalender bawaan HP; dua chip di sebelahnya untuk dua
// tanggal yang paling sering dipilih — dan untuk jalan pulang ke hari ini.
export function PilihTanggal({ value, onChange, hariIni, min, children }) {
  const ref = useRef(null);
  const d = new Date(hariIni + 'T00:00:00'); d.setDate(d.getDate() - 1);
  const kemarin = dateToISO(d);
  const pilih = (t) => { if (t && t <= hariIni && (!min || t >= min)) onChange(t); };
  return (
    <div className="pilih-tanggal">
      <button type="button" className="date-display-btn" onClick={() => { const i = ref.current; if (!i) return; if (typeof i.showPicker === 'function') i.showPicker(); else i.focus(); }}>
        <Icon type="calendar" size={15}/>
        <span>{fmtDateShort(value)}</span>
        <span className="chev">▾</span>
      </button>
      <input ref={ref} type="date" className="date-input-hidden" min={min} max={hariIni} value={value} onChange={e => pilih(e.target.value)} aria-label="Pilih tanggal"/>
      <button type="button" className={'chip chip-tanggal' + (value === hariIni ? ' ada-isi' : '')} aria-pressed={value === hariIni} onClick={() => pilih(hariIni)}>Hari ini</button>
      {(!min || kemarin >= min) && (
        <button type="button" className={'chip chip-tanggal' + (value === kemarin ? ' ada-isi' : '')} aria-pressed={value === kemarin} onClick={() => pilih(kemarin)}>Kemarin</button>
      )}
      {children}
    </div>
  );
}
