import { useState } from 'react'
import { simpanHitungKas } from '../db.js'
import { kirimAtauAntre, idKiriman } from '../outbox.js'
import { tandaJejak, rincianTambah, namaPengguna } from '../jejak.js'
import { IDR, pesanGalat } from '../format.js'
import { showToast } from '../toast.js'
import { bunyi } from '../sfx.js'
import { Icon } from './Icon.jsx'
import { InputNominal } from './InputNominal.jsx'

// Cocokkan kas: uang di laci dihitung, dibandingkan dengan Kas Toko di app,
// dan hasilnya dicatat (tabel hitung_kas). Karena gaji Jaya dibayar harian dari
// laci, keduanya seharusnya selalu sama — selisih berarti ada yang terlewat
// dicatat, dan itu layak diketahui hari itu juga, bukan akhir bulan.
//
// Kalau berselisih, selisihnya bisa langsung dicatat sebagai pengeluaran atau
// cash masuk "Selisih kas", supaya angka app kembali sama dengan laci.
export default function CocokkanKas({ session, sistem, hariIni, onTutup, onTercatat, tandaiTulis }) {
  const [fisik, setFisik] = useState('');
  const [catatan, setCatatan] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const [hasil, setHasil] = useState(null);   // baris hitung_kas yang barusan tersimpan

  const nilaiFisik = parseInt(String(fisik).replace(/\D/g, ''), 10);
  const adaAngka = Number.isFinite(nilaiFisik);
  const selisih = adaAngka ? nilaiFisik - sistem : 0;

  async function simpan() {
    if (!adaAngka) return;
    setSibuk(true);
    try {
      const baris = await simpanHitungKas({
        date: hariIni, oleh: namaPengguna(session), sistem, fisik: nilaiFisik,
        catatan: catatan.trim(), waktu: new Date().toISOString(),
      });
      onTercatat?.(baris);
      bunyi('simpan');
      if (baris.selisih === 0) { showToast('Kas cocok · ' + IDR(nilaiFisik)); onTutup(); return; }
      setHasil(baris);
    } catch (e) {
      bunyi('gagal');
      showToast('Belum tercatat: ' + pesanGalat(e), 'gagal');
    }
    setSibuk(false);
  }

  // Selisih jadi baris di Hari Ini: laci kurang = pengeluaran, laci lebih =
  // cash masuk. Lewat jalur simpan yang sama dengan Hari Ini (antrean, jejak).
  async function catatSelisih() {
    const s = hasil.selisih;
    const baris = { desc: 'Selisih kas', amount: Math.abs(s) };
    const input = { quantities: {}, expenses: s < 0 ? [baris] : [], cashIns: s > 0 ? [baris] : [], setors: [] };
    setSibuk(true);
    try {
      const jejak = tandaJejak(session, 'tambah', rincianTambah(input));
      const h = await kirimAtauAntre({ type: 'tambahEntri', id: idKiriman(), date: hariIni, input, jejak });
      tandaiTulis?.(h);
      showToast(h === 'diantre' ? 'Selisih disimpan di HP, terkirim nanti' : 'Selisih kas dicatat · Kas Toko kini sama dengan laci');
      onTutup();
    } catch (e) {
      showToast('Belum tercatat: ' + pesanGalat(e), 'gagal');
      setSibuk(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onTutup}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="judul-cocok" onClick={e => e.stopPropagation()}>
        <div className="modal-title">
          <span id="judul-cocok">Cocokkan kas</span>
          <button className="del-btn" aria-label="Tutup" onClick={onTutup}><Icon type="x" size={16}/></button>
        </div>

        {!hasil ? (
          <>
            <p className="lembar-pengantar">Hitung uang di laci, lalu tulis jumlahnya.</p>
            <div className="cocok-baris"><span>Kas Toko menurut app</span><strong>{IDR(sistem)}</strong></div>
            <label className="form-label" htmlFor="kas-fisik">Uang di laci</label>
            <InputNominal
              id="kas-fisik" className="form-input cocok-input" autoFocus placeholder="0"
              value={fisik} onChange={v => setFisik(v ? String(v) : '')}
              onKeyDown={e => { if (e.key === 'Enter') simpan(); }}
            />
            {adaAngka && (
              <div className={'cocok-selisih ' + (selisih === 0 ? 'pas' : selisih < 0 ? 'kurang' : 'lebih')}>
                {selisih === 0 ? 'Cocok' : selisih < 0 ? 'Laci kurang ' + IDR(-selisih) : 'Laci lebih ' + IDR(selisih)}
              </div>
            )}
            <label className="form-label" htmlFor="kas-catatan" style={{ marginTop: 12 }}>Catatan (boleh kosong)</label>
            <input id="kas-catatan" className="form-input" type="text" value={catatan} onChange={e => setCatatan(e.target.value)} placeholder="Cth: dihitung sebelum tutup"/>
            <button className="btn-save" style={{ marginTop: 16 }} disabled={!adaAngka || sibuk} onClick={simpan}>
              {sibuk ? 'Menyimpan…' : 'Catat hasil hitung'}
            </button>
          </>
        ) : (
          <>
            <div className={'cocok-selisih ' + (hasil.selisih < 0 ? 'kurang' : 'lebih')}>
              {hasil.selisih < 0 ? 'Laci kurang ' + IDR(-hasil.selisih) : 'Laci lebih ' + IDR(hasil.selisih)} — sudah dicatat
            </div>
            <p className="lembar-pengantar">
              Supaya Kas Toko di app kembali sama dengan laci, selisih ini bisa dicatat sebagai
              {hasil.selisih < 0 ? ' pengeluaran' : ' cash masuk'} "Selisih kas" hari ini.
              Lewati kalau penyebabnya mau dicari dulu.
            </p>
            <div className="gagal-aksi">
              <button className="btn btn-primary" disabled={sibuk} onClick={catatSelisih}>
                Catat {hasil.selisih < 0 ? 'pengeluaran' : 'cash masuk'} {IDR(Math.abs(hasil.selisih))}
              </button>
              <button className="btn btn-ghost" disabled={sibuk} onClick={onTutup}>Lewati</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
