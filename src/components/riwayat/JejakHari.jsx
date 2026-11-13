import { Icon } from '../Icon.jsx'
import { ringkasJejak, jamJejak, LABEL_AKSI, IKON_AKSI } from '../../jejak.js'

// Siapa menyentuh hari ini, melakukan apa, jam berapa — urut dari pagi.
// Dipakai dua tempat: di dalam detail entri, dan sebagai satu-satunya isi
// baris untuk hari yang datanya sudah dihapus.
export function JejakHari({ list }) {
  if (!list.length) return (
    <div className="jejak-kosong">Tidak ada jejak untuk hari ini — biasanya karena datanya dibuat sebelum jejak dicatat.</div>
  );
  return (
    <div className="jejak-list">
      {list.map((j, i) => (
        <div key={j.id ?? (j.waktu+'-'+i)} className={"jejak-row "+j.aksi}>
          <span className="jejak-ikon"><Icon type={IKON_AKSI[j.aksi]||'clock'} size={12}/></span>
          <div className="jejak-isi">
            <div className="jejak-kepala">
              <strong>{j.oleh}</strong>
              <span className="jejak-aksi">{LABEL_AKSI[j.aksi]||j.aksi}</span>
            </div>
            <div className="jejak-teks">{ringkasJejak(j)}</div>
          </div>
          <span className="jejak-jam">{jamJejak(j.waktu)}</span>
        </div>
      ))}
    </div>
  );
}
