import { useState } from 'react'
import { cobaLagiGagal, buangGagal } from '../outbox.js'
import { ringkasKiriman } from '../jejak.js'
import { fmtDate } from '../format.js'
import { Icon } from './Icon.jsx'

// Lembar "gagal terkirim". Kiriman yang ditolak server dulu dibuang diam-diam;
// sekarang tinggal di sini sampai orangnya sendiri memilih. Buang sengaja
// butuh dua ketukan — yang hilang di sini tidak bisa dikembalikan.
export default function LembarGagal({ gagal, onTutup }) {
  const [yakinBuang, setYakinBuang] = useState(null);
  const [sibuk, setSibuk] = useState(false);

  async function cobaLagi(i) {
    setSibuk(true);
    try { await cobaLagiGagal(i); } finally { setSibuk(false); setYakinBuang(null); }
  }

  return (
    <div className="modal-overlay" onClick={onTutup}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="judul-gagal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">
          <span id="judul-gagal">Gagal terkirim</span>
          <button className="del-btn" aria-label="Tutup" onClick={onTutup}><Icon type="x" size={16}/></button>
        </div>
        <p className="lembar-pengantar">
          Server menolak kiriman di bawah, jadi isinya <strong>belum tercatat</strong>.
          Coba lagi kalau penyebabnya sudah beres, atau buang kalau memang tidak perlu.
        </p>
        {gagal.length === 0 && <p className="lembar-pengantar">Tidak ada lagi yang tertahan.</p>}
        <div className="gagal-list">
          {gagal.map((g, i) => (
            <div key={(g.op?.id || '') + g.waktu + i} className="gagal-item">
              <div className="gagal-kepala">{g.op?.date ? fmtDate(g.op.date) : 'Saldo awal'}</div>
              <div className="gagal-isi">{ringkasKiriman(g.op)}</div>
              <div className="gagal-pesan">Alasan dari server: {g.pesan}</div>
              <div className="gagal-aksi">
                <button className="btn btn-primary" disabled={sibuk} onClick={() => cobaLagi(i)}>Coba lagi</button>
                {yakinBuang === i
                  ? <button className="btn btn-danger" disabled={sibuk} onClick={() => { buangGagal(i); setYakinBuang(null); }}>Ya, buang</button>
                  : <button className="btn btn-ghost" disabled={sibuk} onClick={() => setYakinBuang(i)}>Buang</button>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
