import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
// (akses Supabase lewat outbox — lihat src/outbox.js)
import { kirimAtauAntre, idKiriman } from '../outbox.js'
import {
  PRODUCTS, PRODUK_UTAMA, PRODUK_SEKUNDER, PRESET_PENGELUARAN, VOUCHER_TOKO_CUTOFF,
  voucherForDate, draftTotals, accumulateEntry, tambahRingkas, computeKasSummary, computePaydayInfo, hasDetail,
} from '../model.js'
import { tandaJejak, rincianTambah, tglJejak } from '../jejak.js'
import { bacaDraf, tulisDraf, hapusDraf, kurangiDraf, tanggalDrafLain } from '../draf.js'
import CocokkanKas from '../components/CocokkanKas.jsx'
import { IDR, ML, fmtDate, fmtDateShort, pesanGalat } from '../format.js'
import { showToast } from '../toast.js'
import { Icon } from '../components/Icon.jsx'
import { ProductIcon } from '../components/ProductIcon.jsx'
import { AnimatedIDR } from '../components/AnimatedIDR.jsx'
import { rayakan, kilat, denyut } from '../fx.js'
import { bunyi, getar } from '../sfx.js'

const jamSaja = (w) => { const d = new Date(w); return isNaN(d) ? '' : String(d.getHours()).padStart(2,'0')+'.'+String(d.getMinutes()).padStart(2,'0'); };

// Input penjualan harian + kas hari ini. Menyimpan dengan cara MENAMBAH ke
// entri yang sudah ada, bukan mengganti — ganti nilai dilakukan lewat Riwayat.
export default function HariIni({ hariIni, dataPer, dataKosong, fitur, hitungKas, setHitungKas, selectedDate, setSelectedDate, entries, setEntries, voucherToko, initialSaldo, session, ensureDetail, tandaiTulis }) {
  // Draf milik SATU tanggal. Berganti tanggal = berganti draf; draf tanggal
  // lama tetap tersimpan di HP di bawah tanggalnya (lihat src/draf.js).
  const [draf, setDraf] = useState(() => ({ tanggal: selectedDate, ...bacaDraf(selectedDate) }));
  if (draf.tanggal !== selectedDate) setDraf({ tanggal: selectedDate, ...bacaDraf(selectedDate) });
  // bacaDraf/drafKosong selalu mengisi setors, jadi tidak perlu "|| []".
  const { quantities, expenses, cashIns, setors } = draf;
  const ubahBagian = (kunci) => (f) => setDraf(d => ({ ...d, [kunci]: typeof f === 'function' ? f(d[kunci]) : f }));
  const setQuantities = ubahBagian('quantities');
  const setExpenses = ubahBagian('expenses');
  const setCashIns = ubahBagian('cashIns');
  const setSetors = ubahBagian('setors');
  const [lembarCocok, setLembarCocok] = useState(false);
  // Tiap perubahan langsung ditulis ke HP — kalau Android mematikan app di
  // saku, ketukannya masih ada saat dibuka lagi.
  useEffect(() => { tulisDraf(draf.tanggal, draf); }, [draf]);
  // Dibaca langsung tiap render: isinya kecil, dan memo yang keliru di sini
  // berarti petunjuk draf yang basi.
  const drafLain = tanggalDrafLain(selectedDate);
  const [saving, setSaving] = useState(false);
  const [lainnyaTerbuka, setLainnyaTerbuka] = useState(false);
  const hariIniDateRef = useRef(null);
  const simpanRef = useRef(null);

  const existingEntry = entries[selectedDate] || null;

  // Muat awal cuma menarik kolom angka. Tanggal yang sedang dilihat butuh
  // quantities & expenses-nya, jadi diambil satu baris saat tanggal berganti.
  // Ikut jalan lagi kalau baris tanggal ini kembali jadi ringkas (penyegaran
  // menemukan angkanya berubah di HP lain).
  const adaDetail = hasDetail(existingEntry);
  useEffect(() => { ensureDetail(selectedDate); }, [selectedDate, ensureDetail, adaDetail]);

  const inputTotals = useMemo(
    () => draftTotals(quantities, expenses, cashIns, setors),
    [quantities, expenses, cashIns, setors]
  );

  // "Sekarang" diturunkan dari hariIni (useTodayISO), bukan new Date() di
  // dalam memo: memo itu tidak ikut jalan lagi saat lewat tengah malam, jadi
  // "Hari ini +Rp…" dulu masih menunjuk kemarin sampai app dibuka ulang.
  const sekarang = useMemo(() => new Date(hariIni+'T00:00:00'), [hariIni]);

  const kasSummary = useMemo(
    () => computeKasSummary(entries, voucherToko, initialSaldo, sekarang),
    [entries, voucherToko, initialSaldo, sekarang]
  );

  const paydayInfo = useMemo(
    () => computePaydayInfo(entries, voucherToko, sekarang),
    [entries, voucherToko, sekarang]
  );

  // Peredam salah sentuh: kartu produk itu sasaran besar, jadi jari yang
  // sedang menggulir bisa memicunya. Ketukan baru dihitung kalau jari nyaris
  // tidak bergeser dan tidak ditahan lama — gerakan menggulir diabaikan.
  // Dipasang di sini, bukan mengecilkan kartunya, karena justru luasnya itu
  // yang membuat menambah kopi jadi gampang sambil berdiri.
  const sentuhAwal = useRef(null);
  const mulaiSentuh = useCallback((e) => {
    sentuhAwal.current = { x: e.clientX, y: e.clientY, t: Date.now() };
  }, []);
  const selesaiSentuh = useCallback((e, aksi) => {
    const a = sentuhAwal.current;
    sentuhAwal.current = null;
    if (!a) return;
    const geser = Math.hypot(e.clientX - a.x, e.clientY - a.y);
    if (geser > 12 || Date.now() - a.t > 700) return;   // menggulir atau menahan
    // Bunyi & riak ikut menunggu di sini, bukan di pointerdown seperti tombol
    // lain (lihat data-fx="tunda" di bawah): jari yang cuma lewat sambil
    // menggulir tidak boleh ikut membunyikan kasir.
    rayakan(e);
    aksi();
  }, []);

  function changeQty(id, delta) { setQuantities(prev => ({...prev, [id]: Math.max(0, (prev[id]||0)+delta)})); }
  function setQty(id, val) { setQuantities(prev => ({...prev, [id]: Math.max(0, parseInt(val)||0)})); }
  // desc diisi lewat chip preset supaya keterangan yang itu-itu saja tidak
  // perlu diketik ulang; kursor langsung mendarat di kolom nominal.
  function addExpense(desc='') { setExpenses(prev => [...prev, {desc, amount:0}]); }
  function removeExpense(i) { setExpenses(prev => prev.filter((_,idx)=>idx!==i)); }
  // Nominal tidak pernah negatif — arah uangnya sudah ditentukan bloknya
  // (Pengeluaran / Cash Masuk), jadi tanda minus di sini selalu salah ketik.
  function updateExpense(i, field, val) { setExpenses(prev => prev.map((e,idx) => idx===i ? {...e, [field]: field==='amount' ? Math.max(0, parseInt(val)||0) : val} : e)); }
  function addCashIn() { setCashIns(prev => [...prev, {desc:'',amount:0}]); }
  // Uang yang pindah dari kas toko ke kas pemilik. Bukan biaya: tidak
  // mengurangi hasil usaha, hanya mengurangi kas toko.
  function addSetor() { setSetors(prev => [...prev, {desc:'',amount:0}]); }
  function removeSetor(i) { setSetors(prev => prev.filter((_,idx)=>idx!==i)); }
  function updateSetor(i, field, val) { setSetors(prev => prev.map((e,idx) => idx===i ? {...e, [field]: field==='amount' ? Math.max(0, parseInt(val)||0) : val} : e)); }
  function removeCashIn(i) { setCashIns(prev => prev.filter((_,idx)=>idx!==i)); }
  function updateCashIn(i, field, val) { setCashIns(prev => prev.map((e,idx) => idx===i ? {...e, [field]: field==='amount' ? Math.max(0, parseInt(val)||0) : val} : e)); }

  async function saveEntry() {
    const hasQty = PRODUCTS.some(p => (quantities[p.id]||0) > 0);
    const hasExp = expenses.some(e => (e.amount||0) > 0);
    const hasCash = cashIns.some(e => (e.amount||0) > 0);
    const hasSetor = setors.some(e => (e.amount||0) > 0);
    if (!hasQty && !hasExp && !hasCash && !hasSetor) { bunyi('gagal'); showToast('Belum ada input!'); return; }
    setSaving(true);
    const tanggalSimpan = selectedDate;
    const input = { quantities, expenses, cashIns, setors };
    // Siapa & jam berapa dicatat SEKARANG, ikut menumpang kirimannya. Kalau
    // sinyal baru datang besok pagi, jejaknya tetap atas nama orang ini dan
    // jam ini — bukan jam kirimannya akhirnya lolos.
    const jejak = tandaJejak(session, 'tambah', rincianTambah(input));
    try {
      // Tebak hasilnya untuk layar: entri lokal dipakai kalau detailnya sudah
      // ada. Angka pasti menyusul dari server / saat antrean terkirim.
      const dasar = hasDetail(existingEntry) ? existingEntry : null;
      const tebakan = existingEntry && !dasar
        ? tambahRingkas(existingEntry, tanggalSimpan, input)
        : accumulateEntry(dasar, tanggalSimpan, input);
      const hasil = await kirimAtauAntre({ type:'tambahEntri', id:idKiriman(), date:tanggalSimpan, input, jejak });
      tandaiTulis(hasil);
      setEntries(prev => ({ ...prev, [tanggalSimpan]: tebakan }));
      // Terkirim dapat kilau selebar layar; yang baru mengantre di HP dapat
      // nada konfirmasi saja — bedanya harus kedengaran tanpa membaca toast.
      if (hasil === 'diantre') bunyi('enter');
      else { bunyi('simpan'); kilat(); }
      getar([12, 60, 18]);
      denyut(simpanRef.current, 'sukses', 900);
      showToast(hasil === 'diantre'
        ? 'Belum ada sinyal — disimpan di HP, terkirim otomatis nanti'
        : (existingEntry ? 'Ditambahkan' : 'Tersimpan')+' · '+fmtDate(tanggalSimpan));
      // Kurangi draf HANYA bila tidak gagal — supaya input tidak hilang saat
      // gagal. Dikurangi, bukan dikosongkan: ketukan yang masuk selagi
      // kiriman berjalan tetap tinggal.
      setDraf(d => d.tanggal === tanggalSimpan ? { tanggal: d.tanggal, ...kurangiDraf(d, input) } : d);
      if (draf.tanggal !== tanggalSimpan) hapusDraf(tanggalSimpan);
    } catch(e) { bunyi('gagal'); showToast('Belum tersimpan: '+pesanGalat(e), 'gagal'); }
    setSaving(false);
  }

  return (
    <>
          {/* Tanpa sinyal saat app dibuka: angka dari simpanan HP ditampilkan
              redup dengan jamnya, atau "—" kalau belum pernah ada. Dulu yang
              tampil Rp0 — angka yang tampak benar padahal kosong. */}
          <div className={"kas-hero"+(dataPer||dataKosong?" basi":"")}>
            {/* "Kas Toko", bukan "Kas Saat Ini": angka ini uang di laci toko,
                bukan seluruh uang usaha — setoran ke pemilik tidak ada di sini. */}
            <div className="kas-hero-label">Kas Toko</div>
            {dataKosong
              ? <div className="kas-hero-value kosong">—</div>
              : <div className={"kas-hero-value"+(kasSummary.kasSekarang<0?" neg":"")}><AnimatedIDR value={kasSummary.kasSekarang}/></div>}
            <div className="kas-hero-delta">
              {dataKosong
                ? <span className="kas-basi">Belum tersambung — angka belum bisa ditampilkan</span>
                : dataPer
                  ? <span className="kas-basi">Angka per {tglJejak(dataPer)} · belum tersambung</span>
                  : kasSummary.hasToday
                    ? <>Hari ini <span className={kasSummary.todayKas>=0?'pos':'neg'}>{kasSummary.todayKas>=0?'+':''}{IDR(kasSummary.todayKas)}</span></>
                    : <span style={{color:"var(--text3)",fontStyle:"italic"}}>Hari ini belum input</span>}
            </div>
          </div>

          {paydayInfo && !dataKosong && (
            <div className={"payday-banner "+paydayInfo.show}>
              <div className="payday-main">
                {paydayInfo.show==='today'
                  ? <><Icon type="gift" size={16}/><span className="label">Hari Ini Gajian!</span></>
                  : <><Icon type="calendar" size={15}/><span className="label">Gajian H−{paydayInfo.daysLeft}</span></>
                }
                <span className="sub">{paydayInfo.period.label} {ML[paydayInfo.month]}{paydayInfo.show==='upcoming' && ' · sementara'}</span>
              </div>
              <div className="payday-amount">{IDR(paydayInfo.totalGaji)}</div>
            </div>
          )}

          {/* Cocokkan kas: hanya kalau tabelnya sudah ada dan angkanya segar.
              Mencocokkan dengan angka dari simpanan HP tidak ada artinya. */}
          {fitur?.hitungKas && !dataPer && !dataKosong && (() => {
            const terakhir = (hitungKas?.[hariIni] || []).slice(-1)[0];
            return (
              <div className="cocok-bar">
                {terakhir
                  ? <span className={"cocok-status "+(terakhir.selisih===0?'pas':'beda')}>
                      <Icon type={terakhir.selisih===0?'check':'alert'} size={13}/>
                      {terakhir.selisih===0 ? 'Cocok' : 'Selisih '+IDR(terakhir.selisih)} · {terakhir.oleh} {jamSaja(terakhir.waktu)}
                    </span>
                  : <span className="cocok-status">Belum dicocokkan hari ini</span>}
                <button type="button" className="chip samar" onClick={()=>setLembarCocok(true)}>
                  <Icon type="coins" size={13}/> Cocokkan kas
                </button>
              </div>
            );
          })()}

          {lembarCocok && (
            <CocokkanKas
              session={session} sistem={kasSummary.kasSekarang} hariIni={hariIni}
              tandaiTulis={tandaiTulis}
              onTercatat={(h)=>setHitungKas(prev => ({ ...prev, [h.date]: [...(prev[h.date]||[]).filter(x=>x.id!==h.id), h] }))}
              onTutup={()=>setLembarCocok(false)}
            />
          )}

          <div className="date-inline">
            <button type="button" className="date-display-btn" onClick={() => { const i = hariIniDateRef.current; if (!i) return; if (typeof i.showPicker === 'function') i.showPicker(); else i.focus(); }}>
              <Icon type="calendar" size={15}/>
              <span>{fmtDateShort(selectedDate)}</span>
              <span className="chev">▾</span>
            </button>
            <input ref={hariIniDateRef} type="date" className="date-input-hidden" max={hariIni} value={selectedDate} onChange={e=>{ if (e.target.value && e.target.value <= hariIni) setSelectedDate(e.target.value); }}/>
            {(() => {
              const v = voucherForDate(selectedDate, voucherToko);
              const hasVoucher = v.laku>0 || v.drop>0;
              if (!existingEntry && !hasVoucher) return null;
              // Detail tanggal ini belum tiba: diamkan dulu, jangan tampilkan "–"
              // yang bikin seolah harinya kosong padahal ada isinya.
              if (existingEntry && !hasDetail(existingEntry) && !hasVoucher) return null;
              const items = hasDetail(existingEntry) ? PRODUCTS.filter(p=>(existingEntry.quantities?.[p.id]||0)>0).map(p=>p.name+' ×'+existingEntry.quantities[p.id]).join(', ') : '';
              const summary = items || (hasVoucher ? 'voucher ×'+v.laku : '–');
              return (
                <span className="date-hint">
                  <Icon type="package" size={13}/> Sudah tercatat <strong>{summary}</strong>
                </span>
              );
            })()}
            {/* Gaji Jaya dibayar tiap hari dari laci, jadi angkanya perlu
                terlihat di sini — dulu baru ada di Gajian atau Riwayat. */}
            {(() => {
              const g = (existingEntry?.gaji || 0) + voucherForDate(selectedDate, voucherToko).gaji;
              if (!g) return null;
              return (
                <span className="gaji-hari">
                  <Icon type="dollar" size={13}/> Gaji Jaya {selectedDate === hariIni ? 'hari ini' : fmtDateShort(selectedDate)} <strong>{IDR(g)}</strong>
                </span>
              );
            })()}
            {drafLain.length > 0 && (
              <button type="button" className="draf-lain" onClick={() => setSelectedDate(drafLain[0])}>
                <Icon type="pencil" size={12}/> Ada draf belum disimpan · {fmtDateShort(drafLain[0])}
              </button>
            )}
          </div>

          {(() => {
            const tersedia = PRODUCTS.filter(p => !(p.id==='v2k' && selectedDate >= VOUCHER_TOKO_CUTOFF));
            const cari = (id) => tersedia.find(p => p.id === id);
            const utama = PRODUK_UTAMA.map(cari).filter(Boolean);
            const sekunder = PRODUK_SEKUNDER.map(cari).filter(Boolean);
            const dipakai = new Set([...utama, ...sekunder].map(p => p.id));
            const lainnya = tersedia.filter(p => !dipakai.has(p.id));

            return (
              <>
                {/* Dua produk yang menyumbang 97% volume: seluruh kartu jadi
                    tombol +1, bukan tombol kecil yang harus dibidik. */}
                <div className="produk-grid">
                  {utama.map(p => {
                    const n = quantities[p.id] || 0;
                    return (
                      <div
                        key={p.id}
                        className={"produk-kartu"+(n>0?" ada-isi":"")}
                        data-fx="tunda"
                        role="button"
                        tabIndex={0}
                        aria-label={"Tambah "+p.name}
                        onPointerDown={mulaiSentuh}
                        onPointerUp={(e)=>selesaiSentuh(e, ()=>changeQty(p.id,1))}
                        onKeyDown={(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); changeQty(p.id,1); } }}
                      >
                        <div className="produk-kartu-atas">
                          <ProductIcon type={p.id} size={21}/>
                          <div className="produk-kartu-nama">
                            <div className="nama">{p.name}</div>
                            <div className="harga">{IDR(p.price)}</div>
                          </div>
                        </div>
                        <div className="produk-kartu-bawah">
                          {/* key={n} memasang ulang span-nya tiap angka berubah,
                              jadi animasi hitungnya main lagi dari awal — tanpa
                              itu ketukan kedua di kartu yang sama diam saja. */}
                          <span className="angka" key={n}>{n}</span>
                          {n > 0 && (
                            <button
                              className="kurang"
                              aria-label={"Kurangi "+p.name}
                              onPointerDown={(e)=>e.stopPropagation()}
                              onPointerUp={(e)=>e.stopPropagation()}
                              onClick={(e)=>{ e.stopPropagation(); changeQty(p.id,-1); }}
                            >−</button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="chip-row">
                  {sekunder.map(p => {
                    const n = quantities[p.id] || 0;
                    return (
                      <div
                        key={p.id}
                        className={"chip"+(n>0?" ada-isi":"")}
                        data-fx="tunda"
                        role="button"
                        tabIndex={0}
                        aria-label={"Tambah "+p.name}
                        onPointerDown={mulaiSentuh}
                        onPointerUp={(e)=>selesaiSentuh(e, ()=>changeQty(p.id,1))}
                        onKeyDown={(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); changeQty(p.id,1); } }}
                      >
                        {p.name}
                        {n>0 && <span className="chip-angka" key={n}>{n}</span>}
                        {/* Tanpa ini chip hanya bisa menambah — kelebihan tap
                            tidak ada jalan pulangnya selain lewat Riwayat. */}
                        {n>0 && (
                          <button
                            className="chip-kurang"
                            aria-label={"Kurangi "+p.name}
                            onPointerDown={(e)=>e.stopPropagation()}
                            onPointerUp={(e)=>e.stopPropagation()}
                            onClick={(e)=>{ e.stopPropagation(); changeQty(p.id,-1); }}
                          >−</button>
                        )}
                      </div>
                    );
                  })}
                  {lainnya.length > 0 && (
                    <button
                      className={"chip"+(lainnyaTerbuka?" ada-isi":"")}
                      aria-expanded={lainnyaTerbuka}
                      onClick={()=>setLainnyaTerbuka(v=>!v)}
                    >
                      {lainnyaTerbuka ? 'Tutup' : 'Lainnya'} ({lainnya.length})
                    </button>
                  )}
                </div>

                {lainnyaTerbuka && lainnya.length > 0 && (
                  <div className="card" style={{marginTop:10}}>
                    {lainnya.map(p => (
                      <div key={p.id} className="product-row">
                        <div className="product-emoji"><ProductIcon type={p.id} size={24}/></div>
                        <div className="product-info">
                          <div className="product-name">{p.name}</div>
                          <div className="product-meta">{IDR(p.price)}</div>
                        </div>
                        <div className="qty-control">
                          <button className="qty-btn" onClick={()=>changeQty(p.id,-1)}>−</button>
                          <input className="qty-display" type="number" inputMode="numeric" min="0" value={quantities[p.id]} onChange={e=>setQty(p.id,e.target.value)}/>
                          <button className="qty-btn" onClick={()=>changeQty(p.id,1)}>+</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {(inputTotals.totalQty>0 || inputTotals.totalExpense>0 || inputTotals.totalCashIn>0 || inputTotals.totalSetor>0) && (
                  <div className="inline-summary" style={{marginTop:12}}>
                    <span className="seg">Penjualan <strong>{IDR(inputTotals.totalSales)}</strong></span>
                    <span className="seg">Gaji <strong>{IDR(inputTotals.totalGaji)}</strong></span>
                    {inputTotals.totalSetor>0 && <span className="seg">Ke pemilik <strong>{IDR(inputTotals.totalSetor)}</strong></span>}
                    <span className={"seg profit"+(inputTotals.hasil<0?" neg":"")}>{inputTotals.hasil>=0?'Untung':'Rugi'} <strong>{IDR(inputTotals.hasil)}</strong></span>
                  </div>
                )}
              </>
            );
          })()}

          {/* Pengeluaran naik ke sini: dipakai 89% hari, dulu terkubur di
              bawah delapan baris produk. Chip-nya dari keterangan yang paling
              sering diketik ulang. */}
          <div className="pengeluaran-blok">
            <div className="pengeluaran-label">Pengeluaran</div>
            <div className="chip-row">
              {PRESET_PENGELUARAN.map(nama => (
                <button key={nama} className="chip" onClick={()=>addExpense(nama)}>{nama}</button>
              ))}
              <button className="chip samar" onClick={()=>addExpense('')}>+ Lain</button>
            </div>

            {expenses.map((exp, i) => (
              <div key={'e'+i} className="expense-row">
                <input className="expense-input" type="text" placeholder="Keterangan…" value={exp.desc} onChange={e=>updateExpense(i,'desc',e.target.value)}/>
                <input className="expense-amount" type="number" inputMode="numeric" placeholder="Jumlah" autoFocus={exp.desc!=='' && !exp.amount} value={exp.amount||''} onChange={e=>updateExpense(i,'amount',e.target.value)}/>
                <button className="del-btn" onClick={()=>removeExpense(i)}>×</button>
              </div>
            ))}
          </div>

          {/* Cash Masuk keluar dari blok Pengeluaran: uangnya masuk, bukan
              keluar. Dulu chipnya berdiri sebaris dengan Susu/Gelas/Air di
              bawah label PENGELUARAN, jadi terbaca sebagai jenis pengeluaran.
              Tetap samar — dipakai 1 dari 72 hari — tapi hijau dan berdiri
              sendiri supaya arah uangnya tidak salah baca. */}
          <div className="pemasukan-blok">
            <button className="chip samar hijau" onClick={addCashIn}>
              <Icon type="banknote" size={13}/> + Cash Masuk
            </button>

            <button className="chip samar" onClick={addSetor}>
              <Icon type="wallet" size={13}/> + Setor ke pemilik
            </button>

            {cashIns.length>0 && (
              <div className="catatan-section">
                <div className="catatan-section-label green"><Icon type="banknote" size={11}/> Cash Masuk</div>
                {cashIns.map((exp, i) => (
                  <div key={'c'+i} className="expense-row">
                    <input className="expense-input" type="text" placeholder="Cth: Pak Budi bayar hutang…" value={exp.desc} onChange={e=>updateCashIn(i,'desc',e.target.value)}/>
                    <input className="expense-amount" type="number" inputMode="numeric" placeholder="Jumlah" value={exp.amount||''} onChange={e=>updateCashIn(i,'amount',e.target.value)}/>
                    <button className="del-btn" onClick={()=>removeCashIn(i)}>×</button>
                  </div>
                ))}
              </div>
            )}

            {setors.length>0 && (
              <div className="catatan-section">
                <div className="catatan-section-label"><Icon type="wallet" size={11}/> Setor ke pemilik</div>
                {setors.map((exp, i) => (
                  <div key={'s'+i} className="expense-row">
                    <input className="expense-input" type="text" placeholder="Cth: setor ke kas pemilik…" value={exp.desc} onChange={e=>updateSetor(i,'desc',e.target.value)}/>
                    <input className="expense-amount" type="number" inputMode="numeric" placeholder="Jumlah" value={exp.amount||''} onChange={e=>updateSetor(i,'amount',e.target.value)}/>
                    <button className="del-btn" onClick={()=>removeSetor(i)}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            ref={simpanRef}
            className={"btn-save simpan-sticky"+((inputTotals.totalQty>0||inputTotals.totalExpense>0||inputTotals.totalCashIn>0||inputTotals.totalSetor>0)?"":" kosong")}
            disabled={saving}
            onClick={saveEntry}
          >
            <Icon type="coffee" size={16}/> Simpan
            {inputTotals.totalQty>0 && <span className="simpan-total">· {IDR(inputTotals.totalSales)}</span>}
          </button>
  
    </>
  );
}
