import { Icon } from './Icon.jsx'

// Ringkasan MANUAL.md di dalam app — kasir tidak akan membuka berkas di repo.
// Sengaja pendek: hanya yang paling sering ditanyakan. Panduan lengkapnya
// tetap MANUAL.md.
const BAGIAN = [
  ['Kas Toko', 'Angka besar di Hari Ini adalah uang di laci toko. Uang yang masuk ke pemilik tidak dihitung di sini. Gaji Jaya dibayar harian dari laci, jadi Kas Toko seharusnya sama dengan uang fisik — cek dengan Cocokkan kas.'],
  ['Simpan & salah simpan', 'Ketuk kopi atau isi pengeluaran, lalu Simpan. Salah? Ketuk Batalkan di pemberitahuan sesudah simpan — isinya kembali ke draf. Yang lebih lama: Riwayat → tanggalnya → Edit.'],
  ['Voucher toko', 'Isi Drop (titip stok) dan Laku (yang disetor toko). Kalau setorannya langsung ke pemilik, centang "Masuk ke kas pemilik" — tidak perlu lagi mengetik pengeluaran "tf".'],
  ['Setor ke pemilik', 'Uang yang dipindah dari laci ke pemilik: Hari Ini → + Setor ke pemilik. Kas Toko berkurang, untung tidak.'],
  ['Tanpa sinyal', 'Tetap simpan seperti biasa. Badge "N tertunda" berarti masih di HP; terkirim sendiri saat sinyal kembali. Jangan hapus data app selagi badge itu ada.'],
  ['Badge merah', '"N gagal terkirim" berarti server menolak. Ketuk untuk melihat isinya, lalu Coba lagi atau Buang.'],
  ['Mengisi tanggal lain', 'Pilih tanggal atau ketuk Kemarin. Selama bukan hari ini ada pita oranye "Mengisi untuk …" — ketuk Kembali ke hari ini setelah selesai.'],
  ['Cadangan', 'Menu akun → Unduh cadangan, simpan berkasnya di tempat lain. Lakukan minimal sebulan sekali.'],
];

export default function Bantuan({ onTutup }) {
  return (
    <div className="modal-overlay" onClick={onTutup}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="judul-bantuan" onClick={e => e.stopPropagation()}>
        <div className="modal-title">
          <span id="judul-bantuan">Bantuan</span>
          <button className="del-btn" aria-label="Tutup" onClick={onTutup}><Icon type="x" size={16}/></button>
        </div>
        <div className="bantuan-isi">
          {BAGIAN.map(([judul, isi]) => (
            <section key={judul}>
              <h3>{judul}</h3>
              <p>{isi}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
