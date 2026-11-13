import { splitExpenses, voucherForDate } from '../model.js'
import { IDR, fmtDate } from '../format.js'
import { Icon } from './Icon.jsx'

// Konfirmasi hapus satu hari. Dulu confirm() bawaan browser: "Yakin hapus
// data tanggal …?" tanpa menyebut apa yang akan hilang. Sekarang isinya
// disebut satu per satu, dan bahwa voucher toko tanggal itu TIDAK ikut
// terhapus — itu yang paling sering disalahpahami.
export default function LembarHapus({ entry, voucherToko, onHapus, onTutup }) {
  const { items, cash, setor } = splitExpenses(entry.expenses);
  const v = voucherForDate(entry.date, voucherToko);
  const bagian = [];
  if (entry.totalPenjualan) bagian.push('penjualan ' + IDR(entry.totalPenjualan));
  if (items.length) bagian.push(items.length + ' pengeluaran');
  if (cash.length) bagian.push(cash.length + ' cash masuk');
  if (setor.length) bagian.push(setor.length + ' setor ke pemilik');
  return (
    <div className="modal-overlay" onClick={onTutup}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="judul-hapus" onClick={e => e.stopPropagation()}>
        <div className="modal-title">
          <span id="judul-hapus">Hapus data {fmtDate(entry.date)}?</span>
          <button className="del-btn" aria-label="Tutup" onClick={onTutup}><Icon type="x" size={16}/></button>
        </div>
        <p className="lembar-pengantar">
          Yang terhapus: <strong>{bagian.length ? bagian.join(', ') : 'baris kosong'}</strong>.
          {(v.drop > 0 || v.laku > 0) && <> Voucher toko tanggal itu <strong>tidak</strong> ikut terhapus — ubah di Voucher Toko kalau perlu.</>}
        </p>
        <p className="lembar-pengantar">Sesudah dihapus masih ada tombol Urungkan selama beberapa detik, dan jejaknya tetap tersimpan.</p>
        <div className="gagal-aksi">
          <button className="btn btn-danger" onClick={onHapus}><Icon type="trash" size={14}/> Hapus</button>
          <button className="btn btn-ghost" onClick={onTutup}>Batal</button>
        </div>
      </div>
    </div>
  );
}
