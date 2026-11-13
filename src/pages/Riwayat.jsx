import { useState, useMemo, useEffect, Fragment } from 'react'
import { saveEntry as dbSaveEntry, saveVoucherToko as dbSaveVoucherToko } from '../db.js'
import { kirimAtauAntre, idKiriman, batalkanAntrean } from '../outbox.js'
import LembarHapus from '../components/LembarHapus.jsx'
import LaporanBulanan from '../components/LaporanBulanan.jsx'
import {
  PRODUCTS, TOKO, VOUCHER_TOKO_CUTOFF, tarifVoucher,
  voucherForDate, tokoMelebihiStok, buildEntry, entryDayTotals, splitExpenses, todayISO, rekapPerBulan,
} from '../model.js'
import {
  tandaJejak, rincianUbah, rincianHapus, rincianVoucher, entriBerubah,
  ringkasJejak, jamJejak, tglJejak, pelakuHari, banyakPenginput, jejakSaldoTerakhir,
  LABEL_AKSI, IKON_AKSI, khususPemilikTersembunyi,
} from '../jejak.js'
import { IDR, DAYS, MO, ML, fmtDate, pesanGalat } from '../format.js'
import { showToast } from '../toast.js'
import { exportRiwayatCSV } from '../csv.js'
import { useEntryEditor } from '../hooks.js'
import { Icon } from '../components/Icon.jsx'
import { InputNominal } from '../components/InputNominal.jsx'
import { ProductIcon } from '../components/ProductIcon.jsx'
import { SkeletonInput } from '../components/Skeleton.jsx'

const tanggalRingkas = (d) => { const dt = new Date(d+'T00:00:00'); return dt.getDate()+' '+MO[dt.getMonth()]+' · '+DAYS[dt.getDay()]; };

// Siapa menyentuh hari ini, melakukan apa, jam berapa — urut dari pagi.
// Dipakai dua tempat: di dalam detail entri, dan sebagai satu-satunya isi
// baris untuk hari yang datanya sudah dihapus.
function JejakHari({ list }) {
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

// Daftar seluruh hari tersimpan, plus satu-satunya tempat entri bisa diedit
// atau dihapus. Saldo Awal juga di sini karena dia titik nol timeline ini.
export default function Riwayat({ entries, setEntries, voucherToko, setVoucherToko, jejak, initialSaldo, setInitialSaldo, session, loadAllDetails, detailsReady, tandaiTulis, fitur, hitungKas, hariIni }) {
  // Halaman ini satu-satunya yang butuh quantities & expenses SEMUA tanggal,
  // jadi di sinilah detail lengkap ditarik — bukan saat login.
  useEffect(() => { loadAllDetails(); }, [loadAllDetails]);

  const [openDetail, setOpenDetail] = useState(null);
  // Akun karyawan: tanpa tombol hapus hari dan ubah Saldo Awal (keputusan
  // pemilik). Server juga menolaknya — lihat peran_2_aturan.sql.
  const kasir = khususPemilikTersembunyi(session);
  const [tampilan, setTampilan] = useState(() => { try { return localStorage.getItem('riwayat_tampilan') || 'harian'; } catch (_) { return 'harian'; } });
  useEffect(() => { try { localStorage.setItem('riwayat_tampilan', tampilan); } catch (_) {} }, [tampilan]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingSaldo, setEditingSaldo] = useState(false);
  const [saldoInput, setSaldoInput] = useState('');
  const {
    editingDate, setEditingDate,
    editQty, setEditQty,
    editExpenses, setEditExpenses,
    editCashIns, setEditCashIns,
    editSetors, setEditSetors,
    editVoucher, setEditVoucher,
    editSaving, setEditSaving,
  } = useEntryEditor();

  // Tanggal yang cuma punya data voucher tetap muncul sebagai baris kosong,
  // supaya hari yang ada laku voucher tidak hilang dari riwayat.
  const sortedEntries = useMemo(() => {
    const map = { ...entries };
    Object.keys(voucherToko||{}).forEach(d => {
      if (!map[d] && d >= VOUCHER_TOKO_CUTOFF) {
        const v = voucherForDate(d, voucherToko);
        if (v.laku>0 || v.drop>0) map[d] = { date:d, quantities:{}, expenses:[], totalPenjualan:0, gaji:0, totalPengeluaran:0, sisaKas:0 };
      }
    });
    // Hari yang datanya sudah dihapus tetap disebut, cuma sebagai baris jejak.
    // Kalau tidak, justru penghapusan — perbuatan yang paling ingin ditelusuri
    // orang — jadi satu-satunya yang tidak meninggalkan bekas di layar.
    Object.keys(jejak||{}).forEach(d => {
      if (map[d]) return;
      if (!(jejak[d]||[]).some(j => j.aksi === 'hapus')) return;
      map[d] = { date:d, terhapus:true, quantities:{}, expenses:[], totalPenjualan:0, gaji:0, totalPengeluaran:0, sisaKas:0 };
    });
    return Object.values(map).sort((a,b)=>b.date.localeCompare(a.date));
  }, [entries, voucherToko, jejak]);

  // Nama penginput cuma ditampilkan di baris ringkas kalau memang ada lebih
  // dari satu orang yang pernah menginput — di warkop berpenjaga tunggal,
  // mencantumkan nama yang sama di tiap baris cuma jadi derau. Jejak
  // lengkapnya tetap ada di detail, apa pun jawabannya.
  const banyakOrang = useMemo(() => banyakPenginput(jejak), [jejak]);
  const jejakSaldo = useMemo(() => jejakSaldoTerakhir(jejak), [jejak]);

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sortedEntries;
    return sortedEntries.filter(e => {
      if (e.date.toLowerCase().includes(q)) return true;
      const fmt = fmtDate(e.date).toLowerCase();
      if (fmt.includes(q)) return true;
      const prodMatch = PRODUCTS.some(p => (e.quantities?.[p.id]||0) > 0 && p.name.toLowerCase().includes(q));
      if (prodMatch) return true;
      const expMatch = (e.expenses||[]).some(x => (x.desc||'').toLowerCase().includes(q));
      if (expMatch) return true;
      const orangMatch = (jejak?.[e.date]||[]).some(j => (j.oleh||'').toLowerCase().includes(q));
      if (orangMatch) return true;
      const v = voucherForDate(e.date, voucherToko);
      if ((v.laku>0||v.drop>0) && ('voucher'.includes(q) || 'v2k'.includes(q))) return true;
      if (v.laku>0||v.drop>0) {
        const dayMap = voucherToko[e.date]||{};
        return TOKO.some(t => (dayMap[t.id]?.drop>0||dayMap[t.id]?.laku>0) && t.name.toLowerCase().includes(q));
      }
      return false;
    });
  }, [sortedEntries, searchQuery, voucherToko, jejak]);

  // Saring cepat + render bertahap. Dulu ±180 kartu dirender sekaligus, tiap
  // kartu beranimasi masuk sendiri.
  const [saring, setSaring] = useState('semua');
  const [batas, setBatas] = useState(30);
  useEffect(() => { setBatas(30); }, [saring, searchQuery]);
  const SARING = [
    ['semua', 'Semua', () => true],
    ['kopi', 'Ada kopi', (e) => PRODUCTS.some(p => (e.quantities?.[p.id]||0) > 0)],
    ['voucher', 'Voucher', (e) => { const v = voucherForDate(e.date, voucherToko); return v.laku>0 || v.drop>0; }],
    ['pengeluaran', 'Pengeluaran', (e) => splitExpenses(e.expenses).items.length > 0],
    ['dihapus', 'Dihapus', (e) => !!e.terhapus],
  ];
  const tersaring = useMemo(() => {
    const f = (SARING.find(x => x[0] === saring) || SARING[0])[2];
    return filteredEntries.filter(f);
  // SARING dibangun ulang tiap render tapi isinya hanya bergantung pada voucherToko
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredEntries, saring, voucherToko]);
  const rekapBulan = useMemo(() => rekapPerBulan(tersaring, voucherToko), [tersaring, voucherToko]);
  const tampil = tersaring.slice(0, batas);

  async function saveInitialSaldo(val) {
    const v = parseInt(val) || 0;
    setInitialSaldo(v);
    setEditingSaldo(false);
    try {
      // Saldo awal tidak melekat pada hari tertentu, jadi jejaknya dititipkan
      // ke tanggal saat tombol ditekan — dicatat sekarang, bukan saat kiriman
      // akhirnya lolos, supaya tetap benar walau antre semalaman.
      const jejakSimpan = { ...tandaJejak(session, 'saldo', { nilai:v }), date: todayISO() };
      const hasil = await kirimAtauAntre({ type:'simpanSaldo', value:v, jejak:jejakSimpan });
      tandaiTulis(hasil);
      showToast(hasil === 'diantre' ? 'Saldo awal disimpan di HP, terkirim nanti' : 'Saldo awal disimpan: '+IDR(v));
    } catch(e) { showToast('Saldo awal belum tersimpan: '+pesanGalat(e), 'gagal'); }
  }

  const [akanHapus, setAkanHapus] = useState(null);   // tanggal yang sedang dikonfirmasi

  async function deleteEntry(date) {
    setAkanHapus(null);
    // Salinan lengkap diambil SEBELUM dihapus — dipakai Urungkan, dan ikut
    // tersimpan di jejak (rincianHapus) untuk pemulihan manual.
    const salinan = entries[date];
    try {
      const jejakHapus = tandaJejak(session, 'hapus', rincianHapus(salinan));
      const idOp = idKiriman();
      const hasil = await kirimAtauAntre({ type:'hapusEntri', id:idOp, date, jejak:jejakHapus });
      tandaiTulis(hasil);
      setEntries(prev => { const n = { ...prev }; delete n[date]; return n; });
      showToast(hasil === 'diantre' ? 'Penghapusan menunggu sinyal' : 'Data '+fmtDate(date)+' dihapus', 'info',
        { label: 'Urungkan', fn: () => urungkanHapus({ id: idOp, hasil, salinan }) });
    } catch(e) { showToast('Belum terhapus: '+pesanGalat(e), 'gagal'); }
  }

  async function urungkanHapus({ id, hasil, salinan }) {
    const pulihkanLokal = () => setEntries(prev => ({ ...prev, [salinan.date]: salinan }));
    if (hasil === 'diantre' && batalkanAntrean(id)) { pulihkanLokal(); showToast('Penghapusan dibatalkan'); return; }
    try {
      await dbSaveEntry(salinan, tandaJejak(session, 'ubah', rincianUbah(null, salinan, { pulih: true })));
      pulihkanLokal();
      showToast('Data '+fmtDate(salinan.date)+' dipulihkan');
    } catch(e) { showToast('Belum bisa dipulihkan: '+pesanGalat(e), 'gagal'); }
  }

  // === Edit entri (mengganti nilai, bukan menambah) ===
  function startEdit(e) {
    // Salin dulu SEMUA kunci qty yang ada, baru pastikan tiap PRODUCTS punya
    // nilai. Produk yang sudah tidak dijual ikut terbawa apa adanya.
    const q = { ...(e.quantities || {}) }; PRODUCTS.forEach(p => q[p.id] = e.quantities?.[p.id] || 0);
    // Tiga daftar terpisah. Dulu semua yang bukan cashin dianggap
    // pengeluaran — baris 'setor' akan diam-diam berubah jadi pengeluaran
    // biasa begitu hari itu diedit.
    const salinBaris = (x) => ({desc:x.desc||'', amount:x.amount||0});
    const { items, cash, setor } = splitExpenses(e.expenses);
    const vday = voucherToko[e.date] || {};
    const ev = {}; TOKO.forEach(t => { const r = vday[t.id]||{drop:0,laku:0}; ev[t.id] = { drop:String(r.drop||0), laku:String(r.laku||0), kePemilik:!!r.kePemilik }; });
    setEditQty(q); setEditExpenses(items.map(salinBaris)); setEditCashIns(cash.map(salinBaris)); setEditSetors(setor.map(salinBaris)); setEditVoucher(ev); setEditingDate(e.date);
  }
  function cancelEdit() { setEditingDate(null); }
  function changeEditQty(id, d) { setEditQty(prev => ({...prev, [id]: Math.max(0,(prev[id]||0)+d)})); }
  function setEditQtyVal(id, val) { setEditQty(prev => ({...prev, [id]: Math.max(0, parseInt(val)||0)})); }
  function addEditExpense(){ setEditExpenses(prev=>[...prev,{desc:'',amount:0}]); }
  function removeEditExpense(i){ setEditExpenses(prev=>prev.filter((_,idx)=>idx!==i)); }
  function updateEditExpense(i,field,val){ setEditExpenses(prev=>prev.map((e,idx)=>idx===i?{...e,[field]:field==='amount'?Math.max(0,parseInt(val)||0):val}:e)); }
  function addEditCashIn(){ setEditCashIns(prev=>[...prev,{desc:'',amount:0}]); }
  function removeEditCashIn(i){ setEditCashIns(prev=>prev.filter((_,idx)=>idx!==i)); }
  function updateEditCashIn(i,field,val){ setEditCashIns(prev=>prev.map((e,idx)=>idx===i?{...e,[field]:field==='amount'?Math.max(0,parseInt(val)||0):val}:e)); }
  function addEditSetor(){ setEditSetors(prev=>[...prev,{desc:'',amount:0}]); }
  function removeEditSetor(i){ setEditSetors(prev=>prev.filter((_,idx)=>idx!==i)); }
  function updateEditSetor(i,field,val){ setEditSetors(prev=>prev.map((e,idx)=>idx===i?{...e,[field]:field==='amount'?Math.max(0,parseInt(val)||0):val}:e)); }
  function setEditVoucherVal(tokoId, field, val) { setEditVoucher(prev => ({...prev, [tokoId]: {...(prev[tokoId]||{drop:'0',laku:'0'}), [field]: val}})); }

  async function saveEdit() {
    const date = editingDate; if (!date) return;
    const isVoucherDate = date >= VOUCHER_TOKO_CUTOFF;
    // Voucher: validasi laku > stok sebelum apa pun disimpan
    let voucherRows = null;
    if (isVoucherDate) {
      voucherRows = TOKO.map(t => { const dr = editVoucher[t.id]||{drop:'0',laku:'0'}; const laku = parseInt(dr.laku)||0; return { tokoId:t.id, drop:parseInt(dr.drop)||0, laku, kePemilik: !!(fitur?.kePemilik && laku>0 && dr.kePemilik) }; });
      const [lewat] = tokoMelebihiStok(date, voucherRows, voucherToko);
      if (lewat) { const t = TOKO.find(x=>x.id===lewat); showToast('Laku '+(t?t.name:lewat)+' melebihi stok — perbaiki dulu', 'gagal'); return; }
    }
    // Mengganti, bukan menambah: nilai lama dibuang, yang tersimpan hasil edit.
    const accQty = { ...editQty }; PRODUCTS.forEach(p => accQty[p.id] = editQty[p.id]||0);
    const expenses = editExpenses.filter(e => (e.amount||0)>0 || (e.desc||'').trim()!=='').map(e=>({desc:e.desc, amount:e.amount||0}));
    const cashIns  = editCashIns.filter(e => (e.amount||0)>0 || (e.desc||'').trim()!=='').map(e=>({desc:e.desc, amount:e.amount||0, type:'cashin'}));
    const setors   = editSetors.filter(e => (e.amount||0)>0 || (e.desc||'').trim()!=='').map(e=>({desc:e.desc, amount:e.amount||0, type:'setor'}));
    const accExpenses = [...expenses, ...cashIns, ...setors];
    const entry = buildEntry(date, accQty, accExpenses);
    // Hindari membuat baris entri kosong untuk tanggal yang cuma punya data voucher
    const entryExisted = !!entries[date];
    const entryHasData = Object.values(accQty).some(v=>(v||0)>0) || accExpenses.length>0;
    const writeEntry = entryHasData || entryExisted;
    // Dua tulisan, dua jejak — masing-masing hanya kalau memang ada yang
    // berubah. Menekan Simpan Perubahan tanpa menyentuh apa pun tidak boleh
    // meninggalkan baris "mengubah" yang sebenarnya tidak mengubah apa-apa.
    const sebelum = entries[date] || null;
    const jejakUbah = writeEntry && entriBerubah(sebelum, entry)
      ? tandaJejak(session, 'ubah', rincianUbah(sebelum, entry))
      : null;
    const voucherBerubah = isVoucherDate ? rincianVoucher(voucherRows, voucherToko[date]) : null;
    const jejakVoucher = voucherBerubah ? tandaJejak(session, 'voucher', voucherBerubah) : null;
    setEditSaving(true);
    try {
      // Edit MENGGANTI nilai, jadi tidak lewat antrean: mengirim ulang nanti
      // bisa menimpa perubahan yang lebih baru dari perangkat lain. Lebih baik
      // gagal terang-terangan dan diulang sendiri saat sinyal kembali.
      if (session) {
        if (writeEntry) await dbSaveEntry(entry, jejakUbah);
        // Hanya toko yang berubah — sama alasannya dengan Voucher Toko.
        if (voucherBerubah) {
          const idBerubah = new Set(voucherBerubah.toko.map(t => t.id));
          await dbSaveVoucherToko(date, voucherRows.filter(r => idBerubah.has(r.tokoId)), jejakVoucher);
        }
      }
      if (writeEntry) setEntries(prev => ({ ...prev, [date]: entry }));
      if (isVoucherDate) setVoucherToko(prev => { const next={...prev}; const dayMap={...(next[date]||{})}; voucherRows.forEach(r=>{dayMap[r.tokoId]={drop:r.drop,laku:r.laku,kePemilik:r.kePemilik};}); next[date]=dayMap; return next; });
      showToast('Perubahan disimpan · '+fmtDate(date));
      setEditingDate(null);
    } catch(e) { showToast('Perubahan belum tersimpan: '+pesanGalat(e), 'gagal'); }
    setEditSaving(false);
  }

  if (!detailsReady) return (
    <>
      <div style={{marginBottom:8}}></div>
      <SkeletonInput/>
    </>
  );

  return (
    <>
          {/* Harian = daftar hari seperti biasa; Bulanan = laporan per bulan.
              Sengaja di dalam Riwayat, bukan tab kelima: datanya sama. */}
          <div className="tampilan-pilih" role="tablist" aria-label="Tampilan riwayat">
            {[['harian','Harian'],['bulanan','Bulanan']].map(([id,label]) => (
              <button key={id} type="button" role="tab" aria-selected={tampilan===id} className={tampilan===id?'aktif':''} onClick={()=>setTampilan(id)}>{label}</button>
            ))}
          </div>

          {tampilan==='bulanan' ? <LaporanBulanan entries={entries} voucherToko={voucherToko} hariIni={hariIni || todayISO()}/> : <>
          {/* Saldo Awal: titik nol kas warkop, anchor di atas timeline */}
          {!searchQuery && (
            <div className="saldo-awal-bar" style={{margin:"0 0 10px"}}>
              <span className="lbl"><Icon type="coins" size={14}/> Saldo Awal</span>
              {editingSaldo ? (
                <>
                  <InputNominal autoFocus placeholder="0" ariaLabel="Saldo awal" value={saldoInput} onChange={v=>setSaldoInput(v)} onKeyDown={e=>{if(e.key==='Enter')saveInitialSaldo(saldoInput)}}/>
                  <button className="btn btn-primary btn-sm" onClick={()=>saveInitialSaldo(saldoInput)}>Simpan</button>
                  <button className="btn btn-ghost btn-sm" onClick={()=>setEditingSaldo(false)}>Batal</button>
                </>
              ) : (
                <>
                  <span className="val">{IDR(initialSaldo)}</span>
                  {!kasir && <button className="btn btn-ghost btn-sm" aria-label="Ubah saldo awal" onClick={()=>{setSaldoInput(String(initialSaldo));setEditingSaldo(true);}}><Icon type="pencil" size={12}/></button>}
                  {/* Saldo awal satu-satunya angka yang tidak punya baris
                      harinya sendiri, jadi jejaknya ditempel di sini. */}
                  {jejakSaldo && <span className="info">diubah {jejakSaldo.oleh} · {tglJejak(jejakSaldo.waktu)}</span>}
                </>
              )}
            </div>
          )}

          {!searchQuery && sortedEntries.length>0 && (
            <div className="riwayat-meta">
              {(() => {
                const dates = sortedEntries.map(e=>e.date);
                const first = dates[dates.length-1], last = dates[0];
                const fmt = (d) => { const dt = new Date(d+'T00:00:00'); return dt.getDate()+' '+MO[dt.getMonth()]; };
                return sortedEntries.length+' hari tersimpan · '+fmt(first)+(first!==last?' – '+fmt(last):'');
              })()}
            </div>
          )}

          {sortedEntries.length>0 && (
            <div className="riwayat-search-row">
              <div className="search-wrap" style={{flex:1,marginBottom:0}}>
                <span className="search-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
                </span>
                <input
                  className="search-input"
                  type="text"
                  placeholder="Cari tanggal, produk, toko, pengeluaran, atau nama…"
                  value={searchQuery}
                  onChange={e=>setSearchQuery(e.target.value)}
                />
                {searchQuery && <button className="search-clear" onClick={()=>setSearchQuery('')} title="Hapus">×</button>}
              </div>
              <button className="btn-export-icon" onClick={()=>exportRiwayatCSV(entries, voucherToko, jejak)} title="Export CSV"><Icon type="download" size={16}/></button>
            </div>
          )}
          {sortedEntries.length>0 && (
            <div className="saring-row" role="group" aria-label="Saring riwayat">
              {SARING.map(([id, label]) => (
                <button key={id} type="button" className={"chip"+(saring===id?" ada-isi":"")} aria-pressed={saring===id} onClick={()=>setSaring(id)}>{label}</button>
              ))}
            </div>
          )}
          {searchQuery && (
            <div className="search-meta">
              {filteredEntries.length} dari {sortedEntries.length} entri cocok dengan "{searchQuery}"
            </div>
          )}
          {sortedEntries.length===0 ? (
            <div className="empty"><div className="empty-icon" style={{color:"var(--text3)"}}><Icon type="inbox" size={48}/></div>Belum ada data tersimpan.<br/>Mulai input di tab "Hari Ini".</div>
          ) : tersaring.length===0 ? (
            <div className="empty"><div className="empty-icon" style={{color:"var(--text3)"}}><Icon type="search" size={44}/></div>Tidak ada entri yang cocok.<br/>Coba kata kunci lain atau hapus pencarian.</div>
          ) : tampil.map((e, idx) => {
            const jejakHari = jejak?.[e.date] || [];
            // Kepala bulan: menempel di atas saat digulir, dengan subtotalnya.
            const bln = e.date.slice(0, 7);
            const rb = rekapBulan[bln];
            const kepala = (idx === 0 || tampil[idx-1].date.slice(0, 7) !== bln) ? (
              <div className="kepala-bulan">
                <span className="kepala-bulan-nama">{ML[Number(bln.slice(5))-1]} {bln.slice(0,4)}</span>
                {rb && (
                  <span className="kepala-bulan-angka">
                    Jual {IDR(rb.penjualan)} · Keluar {IDR(rb.pengeluaran)}
                    {rb.kePemilik > 0 && <> · Ke pemilik {IDR(rb.kePemilik)}</>}
                    {' · '}<strong className={rb.hasil<0?'neg':'pos'}>{rb.hasil>=0?'Untung ':'Rugi '}{IDR(rb.hasil)}</strong>
                  </span>
                )}
              </div>
            ) : null;
            // Hari yang datanya sudah dihapus: tidak ada uang untuk ditampilkan,
            // yang tersisa cuma catatan siapa yang menghapusnya.
            if (e.terhapus) return (
              <Fragment key={e.date}>
              {kepala}
              <div className="history-item terhapus">
                <div className="history-item-header">
                  <span className="history-date">{tanggalRingkas(e.date)}</span>
                  <span className="pill">Data dihapus</span>
                </div>
                <JejakHari list={jejakHari}/>
              </div>
              </Fragment>
            );
            const sold = PRODUCTS.filter(p=>(e.quantities?.[p.id]||0)>0);
            const { expItems, cashItems, setorItems, expGross, cashGross, voucher: v,
                    totalGaji: totalGajiRow, kePemilik, hasil,
                    totalPenjualan: totalPenjualanRow, sisaKas } = entryDayTotals(e, voucherToko);
            const cocokHari = (hitungKas?.[e.date] || []).slice(-1)[0];
            const hasVoucher = v.laku>0 || v.drop>0;
            const tokoBreakdown = hasVoucher ? TOKO.map(t => {
              const r = (voucherToko[e.date]||{})[t.id]; if (!r || (!r.drop && !r.laku)) return null;
              return { id:t.id, name:t.name, drop:r.drop||0, laku:r.laku||0, kePemilik:!!r.kePemilik };
            }).filter(Boolean) : [];
            const isOpen = openDetail===e.date;
            const isEditing = editingDate===e.date;
            // Yang ditampilkan HASIL usaha, bukan perubahan kas toko: hari
            // yang setorannya masuk ke kas pemilik tidak rugi, uangnya cuma
            // pindah tempat.
            const kasClass = hasil>0?'profit':hasil<0?'loss':'';
            const sisaSign = hasil>0?'pos':hasil<0?'neg':'';
            const sisaLabel = hasil>0?'Untung':hasil<0?'Rugi':'Impas';
            return (
              <Fragment key={e.date}>
              {kepala}
              <div className={"history-item "+kasClass}>
                {/* Seluruh ringkasan baris adalah satu tombol: bisa dijangkau
                    papan ketik dan pembaca layar, dan menyebut terbuka/tidak.
                    Dulu div ber-onClick yang hanya bisa disentuh. */}
                <button type="button" className="history-buka" aria-expanded={isOpen} disabled={isEditing}
                  onClick={()=>setOpenDetail(isOpen?null:e.date)}>
                <span className="history-item-header">
                  <span className="history-date">{tanggalRingkas(e.date)}</span>
                  <span className={"history-gaji "+sisaSign}>{hasil>0?'+':''}{IDR(hasil)}</span>
                </span>
                {/* Semua pil dalam satu baris yang membungkus — dulu empat
                    baris terpisah (produk, uang, orang). */}
                <span className="history-pills">
                {(sold.length>0 || v.laku>0 || v.drop>0) && (
                  <>
                    {sold.map(p=><span key={p.id} className="pill" style={{display:"inline-flex",alignItems:"center",gap:5}}><ProductIcon type={p.id} size={11}/>{p.name} ×{e.quantities[p.id]}</span>)}
                    {v.laku>0 && <span className="pill" style={{background:"var(--accent-bg)",color:"var(--accent)",borderColor:"var(--accent-border)",display:"inline-flex",alignItems:"center",gap:5}}><Icon type="signal" size={11}/> Voucher ×{v.laku}</span>}
                    {v.drop>0 && <span className="pill" style={{background:"var(--blue-bg)",color:"var(--blue)",display:"inline-flex",alignItems:"center",gap:5}}><Icon type="package" size={11}/> Drop {v.drop}</span>}
                  </>
                )}
                {(expGross>0 || cashGross>0 || kePemilik>0 || cocokHari) && (
                  <>
                    {expGross>0 && <span className="pill" style={{background:"var(--red-bg)",color:"var(--red)",borderColor:"var(--red-border)"}}>−{IDR(expGross)} keluar</span>}
                    {kePemilik>0 && <span className="pill pemilik"><Icon type="wallet" size={11}/> {IDR(kePemilik)} ke pemilik</span>}
                    {cocokHari && <span className={"pill "+(cocokHari.selisih===0?"cocok":"selisih")}><Icon type={cocokHari.selisih===0?'check':'alert'} size={11}/> {cocokHari.selisih===0 ? 'Kas cocok' : 'Selisih '+IDR(cocokHari.selisih)}</span>}
                    {cashGross>0 && <span className="pill" style={{background:"var(--green-bg)",color:"var(--green)",borderColor:"var(--green-border)"}}>+{IDR(cashGross)} cash</span>}
                  </>
                )}
                {banyakOrang && jejakHari.length>0 && pelakuHari(jejakHari).map(o => (
                  <span key={o.nama} className="pill orang"><Icon type="user" size={10}/> {o.nama}{o.jumlah>1 ? ' ×'+o.jumlah : ''}</span>
                ))}
                </span>
                </button>
                {isOpen && isEditing && (
                  <div className="history-detail" onClick={ev=>ev.stopPropagation()}>
                    {(() => {
                      const editProducts = PRODUCTS.filter(p => !(p.id==='v2k' && e.date >= VOUCHER_TOKO_CUTOFF));
                      let eSales=0, eGaji=0; editProducts.forEach(p=>{const q=editQty[p.id]||0; eSales+=q*p.price; eGaji+=q*p.gaji;});
                      const eExp = editExpenses.reduce((s,x)=>s+(x.amount||0),0);
                      const eCash = editCashIns.reduce((s,x)=>s+(x.amount||0),0);
                      const eSisa = eSales - eGaji - (eExp - eCash);   // hasil usaha; setoran ke pemilik tidak mengurangi
                      const isVoucherDate = e.date >= VOUCHER_TOKO_CUTOFF;
                      const lewatStok = new Set(isVoucherDate
                        ? tokoMelebihiStok(e.date, TOKO.map(t => { const dr = editVoucher[t.id]||{drop:'0',laku:'0'}; return { tokoId:t.id, drop:parseInt(dr.drop)||0, laku:parseInt(dr.laku)||0 }; }), voucherToko)
                        : []);
                      const editVoucherOver = lewatStok.size > 0;
                      return <>
                        <div className="detail-section-label">Edit Penjualan</div>
                        {editProducts.map(p=>(
                          <div key={p.id} className="product-row">
                            <div className="product-emoji"><ProductIcon type={p.id} size={24}/></div>
                            <div className="product-info">
                              <div className="product-name">{p.name}</div>
                              <div className="product-meta">{IDR(p.price)}</div>
                            </div>
                            <div className="qty-control">
                              <button className="qty-btn" onClick={()=>changeEditQty(p.id,-1)}>−</button>
                              <input className="qty-display" type="number" inputMode="numeric" min="0" value={editQty[p.id]} onChange={ev=>setEditQtyVal(p.id,ev.target.value)}/>
                              <button className="qty-btn" onClick={()=>changeEditQty(p.id,1)}>+</button>
                            </div>
                          </div>
                        ))}
                        {isVoucherDate && <>
                          <div className="detail-section-label" style={{marginTop:12,display:"flex",alignItems:"center",gap:6}}><Icon type="signal" size={12}/> Voucher Toko</div>
                          {TOKO.map(t => {
                            const dr = editVoucher[t.id]||{drop:'0',laku:'0'};
                            const dL = parseInt(dr.laku)||0;
                            const over = lewatStok.has(t.id);
                            return (
                              <div key={t.id} className="expense-row" style={{alignItems:"center"}}>
                                <span className="detail-item-name" style={{flex:1,display:"inline-flex",alignItems:"center",gap:6,minWidth:0}}>
                                  <Icon type="store" size={13}/> {t.name}
                                  {over && <span style={{color:"var(--red)",fontSize:12,whiteSpace:"nowrap"}}>· &gt; stok</span>}
                                </span>
                                <label style={{display:"flex",alignItems:"center",gap:4,fontSize:12,color:"var(--text3)"}}>Drop
                                  <input className="expense-amount" style={{maxWidth:64}} type="number" inputMode="numeric" min="0" placeholder="0" value={dr.drop} onChange={ev=>setEditVoucherVal(t.id,'drop',ev.target.value)}/>
                                </label>
                                <label style={{display:"flex",alignItems:"center",gap:4,fontSize:12,color:"var(--text3)"}}>Laku
                                  <input className="expense-amount" style={{maxWidth:64,...(over?{borderColor:"var(--red)",color:"var(--red)"}:{})}} type="number" inputMode="numeric" min="0" placeholder="0" value={dr.laku} onChange={ev=>setEditVoucherVal(t.id,'laku',ev.target.value)}/>
                                </label>
                                {fitur?.kePemilik && dL>0 && (
                                  <label className="edit-pemilik" title="Setoran masuk ke kas pemilik">
                                    <input type="checkbox" checked={!!dr.kePemilik} onChange={ev=>setEditVoucherVal(t.id,'kePemilik',ev.target.checked)}/> ke pemilik
                                  </label>
                                )}
                              </div>
                            );
                          })}
                        </>}
                        <div className="detail-section-label red" style={{marginTop:12}}>Pengeluaran</div>
                        {editExpenses.map((x,i)=>(
                          <div key={i} className="expense-row">
                            <input className="expense-input" type="text" placeholder="Keterangan…" value={x.desc} onChange={ev=>updateEditExpense(i,'desc',ev.target.value)}/>
                            <InputNominal value={x.amount} onChange={v=>updateEditExpense(i,'amount',v)}/>
                            <button className="del-btn" onClick={()=>removeEditExpense(i)}>×</button>
                          </div>
                        ))}
                        <button className="add-pill" onClick={addEditExpense} style={{marginTop:6}}><Icon type="trending-down" size={14}/> Tambah Pengeluaran</button>
                        <div className="detail-section-label green" style={{marginTop:12,display:"flex",alignItems:"center",gap:6}}><Icon type="banknote" size={12}/> Cash Masuk</div>
                        {editCashIns.map((x,i)=>(
                          <div key={i} className="expense-row">
                            <input className="expense-input" type="text" placeholder="Cth: bayar hutang…" value={x.desc} onChange={ev=>updateEditCashIn(i,'desc',ev.target.value)}/>
                            <InputNominal value={x.amount} onChange={v=>updateEditCashIn(i,'amount',v)}/>
                            <button className="del-btn" onClick={()=>removeEditCashIn(i)}>×</button>
                          </div>
                        ))}
                        <button className="add-pill green" onClick={addEditCashIn} style={{marginTop:6}}><Icon type="banknote" size={14}/> Tambah Cash Masuk</button>
                        <div className="detail-section-label" style={{marginTop:12,display:"flex",alignItems:"center",gap:6}}><Icon type="wallet" size={12}/> Setor ke pemilik</div>
                        {editSetors.map((x,i)=>(
                          <div key={i} className="expense-row">
                            <input className="expense-input" type="text" placeholder="Cth: setor ke kas pemilik…" value={x.desc} onChange={ev=>updateEditSetor(i,'desc',ev.target.value)}/>
                            <InputNominal value={x.amount} onChange={v=>updateEditSetor(i,'amount',v)}/>
                            <button className="del-btn" onClick={()=>removeEditSetor(i)}>×</button>
                          </div>
                        ))}
                        <button className="add-pill" onClick={addEditSetor} style={{marginTop:6}}><Icon type="wallet" size={14}/> Tambah Setor ke pemilik</button>
                        <div className="inline-summary" style={{marginTop:14}}>
                          <span className="seg">Penjualan <strong>{IDR(eSales)}</strong></span>
                          <span className="seg">Gaji <strong>{IDR(eGaji)}</strong></span>
                          <span className={"seg profit"+(eSisa<0?" neg":"")}>{eSisa>=0?'Untung':'Rugi'} <strong>{IDR(eSisa)}</strong></span>
                        </div>
                        {editVoucherOver && (
                          <div className="date-hint" style={{color:"var(--red)",margin:"10px 0 0"}}>
                            <Icon type="alert" size={13}/> Ada toko dengan laku melebihi stok — perbaiki dulu
                          </div>
                        )}
                        <div style={{display:"flex",gap:8,marginTop:14}}>
                          <button className="btn btn-primary" style={{flex:1,padding:"10px"}} disabled={editSaving||editVoucherOver} onClick={saveEdit}>{editSaving?'Menyimpan…':'Simpan Perubahan'}</button>
                          <button className="btn btn-ghost" style={{padding:"10px 16px"}} disabled={editSaving} onClick={cancelEdit}>Batal</button>
                        </div>
                      </>;
                    })()}
                  </div>
                )}
                {isOpen && !isEditing && (
                  <div className="history-detail">
                    <div className="history-summary">
                      <div className="summary-row add"><span className="summary-label">Pemasukan</span><span className="summary-value">{IDR(totalPenjualanRow)}</span></div>
                      <div className="summary-row sub"><span className="summary-label">Gaji</span><span className="summary-value">−{IDR(totalGajiRow)}</span></div>
                      {expGross>0 && <div className="summary-row sub"><span className="summary-label">Pengeluaran</span><span className="summary-value">−{IDR(expGross)}</span></div>}
                      {cashGross>0 && <div className="summary-row cash"><span className="summary-label">Cash Masuk</span><span className="summary-value">+{IDR(cashGross)}</span></div>}
                      <div className="summary-row total">
                        <span className="summary-label">{sisaLabel} Hari Ini</span>
                        <span className={"summary-value "+sisaSign}>{IDR(hasil)}</span>
                      </div>
                      {/* Hanya kalau ada uang yang pindah ke pemilik — selain
                          itu "kas toko" sama persis dengan hasil di atas. */}
                      {kePemilik>0 && <>
                        <div className="summary-row"><span className="summary-label">Ke kas pemilik</span><span className="summary-value">−{IDR(kePemilik)}</span></div>
                        <div className="summary-row"><span className="summary-label">Kas toko</span><span className={"summary-value "+(sisaKas<0?'neg':'')}>{sisaKas>0?'+':''}{IDR(sisaKas)}</span></div>
                      </>}
                    </div>
                    {(sold.length>0 || tokoBreakdown.length>0) && <>
                      <div className="detail-section-label">Rincian Gaji</div>
                      {sold.map(p=>(<div key={p.id} className="detail-row"><span className="detail-item-name" style={{display:"inline-flex",alignItems:"center",gap:6}}><ProductIcon type={p.id} size={13}/>{p.name} ×{e.quantities[p.id]}</span><span className="detail-item-value">{IDR(e.quantities[p.id]*p.gaji)}</span></div>))}
                      {tokoBreakdown.map(t => {
                        const hasLaku = t.laku>0, hasDrop = t.drop>0;
                        let dropNote = '';
                        if (hasDrop && hasLaku) {
                          if (t.laku === t.drop) dropNote = ' · semua terjual hari ini';
                          else if (t.laku < t.drop) dropNote = ' · sisa '+(t.drop-t.laku)+' di toko';
                          else dropNote = ' · ada laku dari stok sebelumnya';
                        }
                        return (
                          <div key={t.id} className="detail-row toko-detail-row">
                            <div className="toko-info">
                              <div className="toko-main" style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                                <Icon type="store" size={12}/> <span>{t.name}</span>
                                {hasLaku && <> · <strong>{t.laku}</strong> laku × {IDR(tarifVoucher(e.date).gaji)}</>}
                                {!hasLaku && hasDrop && <span style={{color:"var(--text3)"}}> · drop saja, belum laku</span>}
                              </div>
                              {hasDrop && <div className="toko-sub"><Icon type="package" size={11}/> Drop {t.drop} voucher ke toko{dropNote}</div>}
                            </div>
                            <span className="detail-item-value">{hasLaku ? IDR(t.laku*tarifVoucher(e.date).gaji) : <span style={{color:"var(--text3)"}}>—</span>}</span>
                          </div>
                        );
                      })}
                    </>}
                    {expItems.length>0 && <>
                      <div className="detail-section-label red">Rincian Pengeluaran</div>
                      {expItems.map((x,xi)=>(<div key={xi} className="detail-row"><span className="detail-item-name">{x.desc||'Pengeluaran'}</span><span style={{color:"var(--red)",fontWeight:600}}>−{IDR(x.amount)}</span></div>))}
                    </>}
                    {(setorItems.length>0 || v.kePemilik>0) && <>
                      <div className="detail-section-label" style={{display:"flex",alignItems:"center",gap:6}}><Icon type="wallet" size={12}/> Ke kas pemilik</div>
                      {tokoBreakdown.filter(t=>t.kePemilik && t.laku>0).map(t=>(<div key={'vp'+t.id} className="detail-row"><span className="detail-item-name">Setoran voucher {t.name} ({t.laku})</span><span className="detail-item-value">{IDR(t.laku*tarifVoucher(e.date).setoran)}</span></div>))}
                      {setorItems.map((x,xi)=>(<div key={'sp'+xi} className="detail-row"><span className="detail-item-name">{x.desc||'Setor ke pemilik'}</span><span className="detail-item-value">{IDR(x.amount)}</span></div>))}
                    </>}
                    {cocokHari && <>
                      <div className="detail-section-label" style={{display:"flex",alignItems:"center",gap:6}}><Icon type="coins" size={12}/> Cocokkan kas</div>
                      {(hitungKas[e.date]||[]).map(h=>(<div key={h.id} className="detail-row"><span className="detail-item-name">{h.oleh} · app {IDR(h.sistem)}, laci {IDR(h.fisik)}{h.catatan ? ' · '+h.catatan : ''}</span><span className="detail-item-value" style={{color:h.selisih===0?'var(--green)':'var(--orange)'}}>{h.selisih===0?'cocok':IDR(h.selisih)}</span></div>))}
                    </>}
                    {cashItems.length>0 && <>
                      <div className="detail-section-label green" style={{display:"flex",alignItems:"center",gap:6}}><Icon type="banknote" size={12}/> Cash Masuk</div>
                      {cashItems.map((x,xi)=>(<div key={xi} className="detail-row"><span className="detail-item-name">{x.desc||'Cash Masuk'}</span><span style={{color:"var(--green)",fontWeight:600}}>+{IDR(x.amount)}</span></div>))}
                    </>}
                    <div className="detail-section-label" style={{display:"flex",alignItems:"center",gap:6}}><Icon type="clock" size={12}/> Jejak Input</div>
                    <JejakHari list={jejakHari}/>
                    <div style={{display:"flex",gap:8,marginTop:14}}>
                      <button className="btn btn-primary" style={{flex:1,padding:"10px"}} onClick={(ev)=>{ev.stopPropagation();startEdit(e);}}><Icon type="pencil" size={14}/> Edit</button>
                      {!kasir && <button className="btn btn-danger" style={{flex:1,padding:"10px"}} onClick={(ev)=>{ev.stopPropagation();setAkanHapus(e.date);}}><Icon type="trash" size={14}/> Hapus</button>}
                    </div>
                  </div>
                )}
              </div>
              </Fragment>
            );
          })}
          {tersaring.length > batas && (
            <button type="button" className="tampil-lagi" onClick={()=>setBatas(b=>b+30)}>
              Tampilkan lebih lama ({tersaring.length - batas} hari lagi)
            </button>
          )}
          </>}
          {akanHapus && entries[akanHapus] && (
            <LembarHapus entry={entries[akanHapus]} voucherToko={voucherToko} onHapus={()=>deleteEntry(akanHapus)} onTutup={()=>setAkanHapus(null)}/>
          )}
    </>
  );
}
