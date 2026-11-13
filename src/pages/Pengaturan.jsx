import { useMemo, useState } from 'react'
import { simpanKatalog } from '../db.js'
import { katalogSekarang, periksaKatalog, kodeBaru, hargaProduk, tarifVoucher, dateToISO } from '../model.js'
import { tandaJejak } from '../jejak.js'
import { IDR, fmtDateShort, pesanGalat } from '../format.js'
import { showToast } from '../toast.js'
import { laporkanGagalSimpan } from '../galat.js'
import { Icon } from '../components/Icon.jsx'
import { InputNominal } from '../components/InputNominal.jsx'

// Pengaturan harga, toko, dan tarif — tanpa mengubah kode (RENCANA 5.2).
// Khusus pemilik; server juga menolak selain pemilik (RLS config).
//
// Aturannya satu: yang sudah tercatat tidak diubah ke belakang. Harga baru
// selalu "berlaku mulai tanggal X" (bawaan: besok), produk & toko tidak
// dihapus melainkan dinonaktifkan. Dengan begitu Kas dan riwayat lama tidak
// pernah bergeser karena perubahan harga.

const besok = (hariIni) => { const d = new Date(hariIni + 'T00:00:00'); d.setDate(d.getDate() + 1); return dateToISO(d); };

function FormHargaBaru({ awal, hariIni, label = 'Harga jual', denganKomisi = false, onTambah, onBatal }) {
  const [harga, setHarga] = useState(awal.harga);
  const [gaji, setGaji] = useState(awal.gaji);
  const [komisi, setKomisi] = useState(awal.komisi || 0);
  const [sejak, setSejak] = useState(besok(hariIni));
  return (
    <div className="atur-form">
      <label>{label}<InputNominal value={harga} onChange={setHarga} className="form-input"/></label>
      {denganKomisi && <label>Komisi toko<InputNominal value={komisi} onChange={setKomisi} className="form-input"/></label>}
      <label>Gaji Jaya per item<InputNominal value={gaji} onChange={setGaji} className="form-input"/></label>
      <label>Berlaku mulai<input type="date" className="form-input" min={hariIni} value={sejak} onChange={e => setSejak(e.target.value)}/></label>
      <p className="atur-ket">Hari sebelum {sejak ? fmtDateShort(sejak) : '…'} tetap memakai harga lama.</p>
      <div className="gagal-aksi">
        <button type="button" className="btn btn-primary" disabled={!harga || !sejak} onClick={() => onTambah({ sejak, harga, gaji, komisi })}>Tambahkan</button>
        <button type="button" className="btn btn-ghost" onClick={onBatal}>Batal</button>
      </div>
    </div>
  );
}

export default function Pengaturan({ session, hariIni, versiKatalog, katalogDisimpan }) {
  // Salinan kerja. Baru dikirim saat "Simpan pengaturan".
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const lama = useMemo(() => katalogSekarang(), [versiKatalog]);
  const [k, setK] = useState(lama);
  const [buka, setBuka] = useState(null);       // 'harga:<id>' | 'tarif' | 'produkBaru' | 'tokoBaru'
  const [namaBaru, setNamaBaru] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const masalah = periksaKatalog(k, lama);
  const berubah = JSON.stringify(k) !== JSON.stringify(lama);

  const ubahProduk = (id, f) => setK(x => ({ ...x, produk: x.produk.map(p => p.id === id ? f(p) : p) }));
  const ubahToko = (id, f) => setK(x => ({ ...x, toko: x.toko.map(t => t.id === id ? f(t) : t) }));

  async function simpan() {
    if (masalah.length) return;
    setSibuk(true);
    try {
      const jejak = { ...tandaJejak(session, 'ubah', { catatan: 'Pengaturan harga/toko/tarif diubah' }), date: hariIni };
      await simpanKatalog(k, jejak);
      katalogDisimpan(k);
      showToast('Pengaturan tersimpan');
    } catch (e) {
      laporkanGagalSimpan(e, 'pengaturan');
      showToast('Pengaturan belum tersimpan: ' + pesanGalat(e), 'gagal');
    }
    setSibuk(false);
  }

  const tarifKini = tarifVoucher(hariIni, k.tarif);
  const tarifNanti = k.tarif.filter(t => t.sejak > hariIni).sort((a, b) => a.sejak.localeCompare(b.sejak));

  return (
    <div className="pengaturan">
      <p className="lembar-pengantar">
        Perubahan harga selalu berlaku <strong>mulai tanggal tertentu</strong>, jadi riwayat dan Kas lama tidak ikut berubah.
        Produk dan toko tidak bisa dihapus — nonaktifkan saja; riwayatnya tetap utuh.
      </p>

      <section className="laporan-kartu">
        <div className="laporan-judul"><Icon type="coffee" size={15}/> Produk</div>
        {k.produk.map(p => {
          const kini = hargaProduk(p, hariIni);
          const nanti = (p.riwayat || []).filter(r => r.sejak > hariIni).sort((a, b) => a.sejak.localeCompare(b.sejak));
          const aktif = p.aktif !== false;
          return (
            <div key={p.id} className={'atur-baris' + (aktif ? '' : ' nonaktif')}>
              <div className="atur-kepala">
                <strong>{p.name}</strong>
                <span className="atur-angka">{IDR(kini.price)} · gaji {IDR(kini.gaji)}</span>
              </div>
              {nanti.map(r => <div key={r.sejak} className="atur-ket">Mulai {fmtDateShort(r.sejak)}: {IDR(r.price)} · gaji {IDR(r.gaji)}</div>)}
              <div className="atur-aksi">
                <button type="button" className="chip" onClick={() => setBuka(buka === 'harga:' + p.id ? null : 'harga:' + p.id)}>Ubah harga</button>
                <label className="atur-cek"><input type="checkbox" checked={aktif} onChange={e => ubahProduk(p.id, x => ({ ...x, aktif: e.target.checked }))}/> Dijual</label>
                <label className="atur-cek"><input type="checkbox" checked={(k.utama || []).includes(p.id)}
                  onChange={e => setK(x => ({ ...x, utama: e.target.checked ? [...(x.utama || []), p.id] : (x.utama || []).filter(i => i !== p.id) }))}/> Kartu besar</label>
              </div>
              {buka === 'harga:' + p.id && (
                <FormHargaBaru awal={{ harga: kini.price, gaji: kini.gaji }} hariIni={hariIni} onBatal={() => setBuka(null)}
                  onTambah={({ sejak, harga, gaji }) => {
                    ubahProduk(p.id, x => ({ ...x, riwayat: [...(x.riwayat || []).filter(r => r.sejak !== sejak || r.sejak <= hariIni), { sejak, price: harga, gaji }] }));
                    setBuka(null);
                  }}/>
              )}
            </div>
          );
        })}
        {buka === 'produkBaru' ? (
          <div className="atur-form">
            <label>Nama produk<input className="form-input" value={namaBaru} onChange={e => setNamaBaru(e.target.value)} placeholder="Cth: Es Teh"/></label>
            <FormHargaBaru awal={{ harga: 0, gaji: 0 }} hariIni={hariIni} onBatal={() => setBuka(null)}
              onTambah={({ harga, gaji }) => {
                if (!namaBaru.trim()) { showToast('Tulis nama produknya dulu', 'gagal'); return; }
                const id = kodeBaru(namaBaru, k.produk.map(p => p.id));
                setK(x => ({ ...x, produk: [...x.produk, { id, name: namaBaru.trim(), price: harga, gaji, aktif: true }] }));
                setNamaBaru(''); setBuka(null);
              }}/>
          </div>
        ) : (
          <button type="button" className="add-pill" onClick={() => setBuka('produkBaru')}><Icon type="coffee" size={14}/> Tambah produk</button>
        )}
      </section>

      <section className="laporan-kartu">
        <div className="laporan-judul"><Icon type="store" size={15}/> Toko voucher</div>
        {k.toko.map(t => (
          <div key={t.id} className={'atur-baris' + (t.aktif !== false ? '' : ' nonaktif')}>
            <div className="atur-aksi">
              <input className="form-input atur-nama" value={t.name} aria-label={'Nama toko ' + t.name} onChange={e => ubahToko(t.id, x => ({ ...x, name: e.target.value }))}/>
              <label className="atur-cek"><input type="checkbox" checked={t.aktif !== false} onChange={e => ubahToko(t.id, x => ({ ...x, aktif: e.target.checked }))}/> Aktif</label>
            </div>
          </div>
        ))}
        {buka === 'tokoBaru' ? (
          <div className="atur-form">
            <label>Nama toko<input className="form-input" value={namaBaru} onChange={e => setNamaBaru(e.target.value)} autoFocus/></label>
            <div className="gagal-aksi">
              <button type="button" className="btn btn-primary" disabled={!namaBaru.trim()} onClick={() => {
                const id = kodeBaru(namaBaru, k.toko.map(t => t.id));
                setK(x => ({ ...x, toko: [...x.toko, { id, name: namaBaru.trim(), aktif: true }] }));
                setNamaBaru(''); setBuka(null);
              }}>Tambahkan</button>
              <button type="button" className="btn btn-ghost" onClick={() => setBuka(null)}>Batal</button>
            </div>
          </div>
        ) : (
          <button type="button" className="add-pill" onClick={() => setBuka('tokoBaru')}><Icon type="store" size={14}/> Tambah toko</button>
        )}
      </section>

      <section className="laporan-kartu">
        <div className="laporan-judul"><Icon type="signal" size={15}/> Tarif voucher</div>
        <div className="atur-baris">
          <div className="atur-kepala"><strong>Sekarang</strong><span className="atur-angka">{IDR(tarifKini.harga)} · komisi toko {IDR(tarifKini.komisi)} · gaji {IDR(tarifKini.gaji)}</span></div>
          <div className="atur-ket">Setoran ke kas per voucher laku: {IDR(tarifKini.setoran)}</div>
          {tarifNanti.map(t => <div key={t.sejak} className="atur-ket">Mulai {fmtDateShort(t.sejak)}: {IDR(t.harga)} · komisi {IDR(t.komisi)} · gaji {IDR(t.gaji)}</div>)}
        </div>
        {buka === 'tarif' ? (
          <FormHargaBaru awal={{ harga: tarifKini.harga, gaji: tarifKini.gaji, komisi: tarifKini.komisi }} hariIni={hariIni} label="Harga jual voucher" denganKomisi
            onBatal={() => setBuka(null)}
            onTambah={({ sejak, harga, gaji, komisi }) => {
              setK(x => ({ ...x, tarif: [...x.tarif.filter(t => t.sejak !== sejak || t.sejak <= hariIni), { sejak, harga, komisi, gaji }] }));
              setBuka(null);
            }}/>
        ) : (
          <button type="button" className="add-pill" onClick={() => setBuka('tarif')}><Icon type="signal" size={14}/> Tarif baru</button>
        )}
      </section>

      <section className="laporan-kartu">
        <div className="laporan-judul"><Icon type="trending-down" size={15}/> Pilihan cepat pengeluaran</div>
        <input className="form-input" value={(k.preset || []).join(', ')}
          onChange={e => setK(x => ({ ...x, preset: e.target.value.split(',').map(s => s.trim()).filter(Boolean).slice(0, 8) }))}
          aria-label="Pilihan cepat pengeluaran, pisahkan dengan koma"/>
        <p className="atur-ket">Pisahkan dengan koma, paling banyak 8. Tampil sebagai chip di Hari Ini.</p>
      </section>

      {masalah.length > 0 && berubah && (
        <div className="login-galat" role="alert">{masalah.map(m => <div key={m}>{m}</div>)}</div>
      )}
      <div className="gagal-aksi atur-simpan">
        <button type="button" className="btn-save" disabled={!berubah || masalah.length > 0 || sibuk} onClick={simpan}>
          {sibuk ? 'Menyimpan…' : berubah ? 'Simpan pengaturan' : 'Belum ada perubahan'}
        </button>
        {berubah && <button type="button" className="btn btn-ghost" onClick={() => { setK(lama); setBuka(null); }}>Batalkan perubahan</button>}
      </div>
    </div>
  );
}
