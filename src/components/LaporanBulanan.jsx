import { useMemo, useState } from 'react'
import { rekapBulanan, rekapToko } from '../model.js'
import { IDR, ML, MO } from '../format.js'
import { Icon } from './Icon.jsx'

// Laporan per bulan, di dalam Riwayat (pilihan Harian | Bulanan). Dulu
// pertanyaan "bulan ini untung berapa" hanya bisa dijawab dengan export CSV.

const namaBulan = (k) => ML[Number(k.slice(5)) - 1] + ' ' + k.slice(0, 4);
const singkatBulan = (k) => MO[Number(k.slice(5)) - 1];
// Rupiah ringkas untuk label grafik: "1,2 jt", "350 rb".
const ringkasRp = (v) => {
  const a = Math.abs(v), t = v < 0 ? '−' : '';
  if (a >= 1e6) return t + (a / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' jt';
  if (a >= 1e3) return t + Math.round(a / 1e3) + ' rb';
  return t + a;
};

// Untung/rugi 6 bulan terakhir: satu deret, batang naik dari garis nol (untung)
// atau turun (rugi). Sengaja HTML, bukan SVG: SVG yang direntang selebar layar
// ikut membesarkan hurufnya, sedangkan kolom flex tetap berhuruf 11px di HP
// maupun desktop. Arahkan/ketuk batang untuk angka lengkapnya.
function GrafikHasil({ bulan }) {
  const data = bulan.slice(0, 6).reverse();
  if (data.length === 0) return null;
  const maks = Math.max(0, ...data.map(b => b.hasil));
  const min = Math.min(0, ...data.map(b => b.hasil));
  const rentang = (maks - min) || 1;
  // Garis nol diletakkan sebanding: bagian atas untuk untung, bawah untuk rugi.
  const porsiAtas = maks / rentang;
  return (
    <div className="grafik-hasil" role="img" aria-label="Untung atau rugi per bulan, enam bulan terakhir">
      {data.map(b => {
        const untung = b.hasil >= 0;
        const tinggi = Math.max(1.5, Math.abs(b.hasil) / rentang * 100);
        return (
          <div key={b.bulan} className="grafik-kolom" title={namaBulan(b.bulan) + ': ' + (untung ? 'untung ' : 'rugi ') + IDR(b.hasil)}>
            <div className="grafik-area">
              <div className="grafik-atas" style={{ height: porsiAtas * 100 + '%' }}>
                {untung && <>
                  <span className="grafik-nilai">{ringkasRp(b.hasil)}</span>
                  <div className="grafik-batang untung" style={{ height: (tinggi / (porsiAtas || 1)) + '%' }}/>
                </>}
              </div>
              <div className="grafik-bawah" style={{ height: (1 - porsiAtas) * 100 + '%' }}>
                {!untung && <>
                  <div className="grafik-batang rugi" style={{ height: (tinggi / ((1 - porsiAtas) || 1)) + '%' }}/>
                  <span className="grafik-nilai">{ringkasRp(b.hasil)}</span>
                </>}
              </div>
            </div>
            <span className="grafik-sumbu">{singkatBulan(b.bulan)}</span>
          </div>
        );
      })}
    </div>
  );
}

function Baris({ label, nilai, kelas = '', tanda = '' }) {
  return (
    <div className={'summary-row ' + kelas}>
      <span className="summary-label">{label}</span>
      <span className="summary-value">{tanda}{IDR(nilai)}</span>
    </div>
  );
}

export default function LaporanBulanan({ entries, voucherToko, hariIni }) {
  const bulan = useMemo(() => rekapBulanan(entries, voucherToko), [entries, voucherToko]);
  const toko = useMemo(() => rekapToko(voucherToko, hariIni), [voucherToko, hariIni]);
  const [pilih, setPilih] = useState(null);
  const b = bulan.find(x => x.bulan === pilih) || bulan[0];
  if (!b) return <div className="empty">Belum ada data untuk dilaporkan.</div>;

  return (
    <div className="laporan">
      <div className="laporan-kartu">
        <div className="laporan-judul">Untung / rugi per bulan</div>
        <GrafikHasil bulan={bulan}/>
      </div>

      <div className="saring-row" role="group" aria-label="Pilih bulan">
        {bulan.slice(0, 12).map(x => (
          <button key={x.bulan} type="button" className={'chip' + (x.bulan === b.bulan ? ' ada-isi' : '')} aria-pressed={x.bulan === b.bulan} onClick={() => setPilih(x.bulan)}>
            {namaBulan(x.bulan)}
          </button>
        ))}
      </div>

      <div className="laporan-kartu">
        <div className="laporan-judul">{namaBulan(b.bulan)} · {b.hari} hari tercatat</div>
        <div className="history-summary">
          {b.penjualanProduk > 0 && <Baris label="Penjualan kopi & produk" nilai={b.penjualanProduk} kelas="add"/>}
          {b.setoranVoucher > 0 && <Baris label={'Setoran voucher (' + b.lakuVoucher + ' laku)'} nilai={b.setoranVoucher} kelas="add"/>}
          <Baris label="Gaji Jaya" nilai={b.gaji} kelas="sub" tanda="−"/>
          {b.pengeluaran > 0 && <Baris label="Pengeluaran" nilai={b.pengeluaran} kelas="sub" tanda="−"/>}
          {b.cashMasuk > 0 && <Baris label="Cash masuk" nilai={b.cashMasuk} kelas="cash" tanda="+"/>}
          <div className="summary-row total">
            <span className="summary-label">{b.hasil >= 0 ? 'Untung' : 'Rugi'} bulan ini</span>
            <span className={'summary-value ' + (b.hasil >= 0 ? 'pos' : 'neg')}>{IDR(b.hasil)}</span>
          </div>
          {b.kePemilik > 0 && <>
            <Baris label="Masuk ke kas pemilik" nilai={b.kePemilik} tanda="−"/>
            <Baris label="Perubahan kas toko" nilai={b.kasToko}/>
          </>}
        </div>
        {b.biayaTerbesar.length > 0 && <>
          <div className="detail-section-label red">Pengeluaran terbesar</div>
          {b.biayaTerbesar.map(x => (
            <div key={x.ket} className="detail-row"><span className="detail-item-name" style={{ textTransform: 'capitalize' }}>{x.ket}</span><span className="detail-item-value">{IDR(x.jumlah)}</span></div>
          ))}
        </>}
      </div>

      <div className="laporan-kartu">
        <div className="laporan-judul"><Icon type="store" size={14}/> Toko voucher sekarang</div>
        {toko.map(t => (
          <div key={t.id} className="detail-row toko-laporan">
            <span className="detail-item-name">
              <strong>{t.nama}</strong> · stok {t.stok}
              <span className={'toko-sub' + (t.stok > 0 && (t.hariSejak ?? 0) > 14 ? ' lama' : '')}>
                {t.terakhirSetor ? ' · setor terakhir ' + (t.hariSejak === 0 ? 'hari ini' : t.hariSejak + ' hari lalu') : ' · belum pernah setor'}
              </span>
            </span>
            <span className="detail-item-value">{t.lakuPerBulan[b.bulan] || 0} laku</span>
          </div>
        ))}
      </div>
    </div>
  );
}
