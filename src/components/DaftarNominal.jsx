import { InputNominal } from './InputNominal.jsx'

// Daftar baris "keterangan + nominal + ×" — pengeluaran, cash masuk, setor ke
// pemilik, di Hari Ini maupun di form edit Riwayat. Dulu ditulis enam kali
// dengan enam pasang fungsi ubah/hapus yang nyaris sama.
//
// rows: [{ desc, amount }]; onChange menerima larik baru (tidak mengubah yang
// lama). Nominal tidak pernah negatif — arah uangnya sudah ditentukan daftar
// mana yang dipakai.
export function DaftarNominal({ rows, onChange, placeholder = 'Keterangan…', fokusPreset = false }) {
  const ubah = (i, field, val) => onChange(rows.map((r, idx) => idx === i
    ? { ...r, [field]: field === 'amount' ? Math.max(0, parseInt(val) || 0) : val }
    : r));
  const hapus = (i) => onChange(rows.filter((_, idx) => idx !== i));
  return rows.map((r, i) => (
    <div key={i} className="expense-row">
      <input className="expense-input" type="text" placeholder={placeholder} value={r.desc} onChange={e => ubah(i, 'desc', e.target.value)}/>
      {/* Baris dari chip preset (Susu, Gelas, …) sudah berketerangan: kursor
          langsung ke nominalnya. */}
      <InputNominal autoFocus={fokusPreset && r.desc !== '' && !r.amount} value={r.amount} onChange={v => ubah(i, 'amount', v)}/>
      <button className="del-btn" aria-label="Hapus baris" onClick={() => hapus(i)}>×</button>
    </div>
  ));
}
