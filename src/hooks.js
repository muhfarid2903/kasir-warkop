import { useState, useEffect, useCallback, useRef } from 'react'
import {
  supabaseReady,
  getSession, onAuthChange,
  loadSaldoAwal, loadEntrySummaries, loadEntryDetails, loadEntryDetail, loadVoucherToko,
  loadJejak, loadHitungKas, loadKatalog, subscribeRealtime,
} from './db.js'
import { flushOutbox, onOutboxChange, outboxSize, onGagalChange } from './outbox.js'
import { showToast } from './toast.js'
import { hasDetail, todayISO, gabungRingkasan, aturKatalog } from './model.js'

// State yang dipakai lebih dari satu halaman, jadi tidak bisa dimiliki salah
// satunya. Yang cuma dipakai satu halaman tinggal di halaman itu.

// === Sesi login ===
export function useAuth() {
  const [session, setSession] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    if (!supabaseReady) { setAuthChecked(true); return; }
    getSession().then(s => {
      setSession(s);
      setAuthChecked(true);
    });
    return onAuthChange(s => setSession(s));
  }, []);

  return { session, setSession, authChecked };
}

// === Data warkop: muat awal + realtime ===
// entries, voucherToko, dan initialSaldo dibaca Hari Ini, Voucher, Gajian, dan
// Riwayat sekaligus, jadi sumbernya harus satu.
//
// entries dua tingkat. Muat awal mengisi baris RINGKAS (cuma kolom angka);
// baris LENGKAP (dengan quantities & expenses) menyusul hanya kalau diminta —
// Riwayat minta semuanya, Hari Ini minta satu tanggal. Bedakan keduanya dengan
// hasDetail(); baris ringkas tidak punya kunci quantities sama sekali.
//
// Muat penuh (dengan layar kerangka) HANYA terjadi saat penggunanya berganti.
// Dulu efek ini bergantung pada objek sesi, padahal supabase-js mengirim objek
// sesi baru tiap app kembali ke layar dan tiap token diperbarui: seluruh app
// berganti kerangka, semua halaman dilepas, dan kopi yang sudah diketuk tapi
// belum disimpan ikut hilang. Penyegaran berikutnya senyap (lihat tarik()).

const KUNCI_SIMPANAN = 'warkop_simpanan_v1';

// Hasil muat terakhir yang berhasil, beserta jamnya. Dipakai HANYA kalau muat
// awal gagal (app dibuka tanpa sinyal) — dan selalu ditampilkan bersama
// keterangan "angka per …", tidak pernah diam-diam seolah angka segar.
function simpanTerakhir(userId, isi) {
  try { localStorage.setItem(KUNCI_SIMPANAN, JSON.stringify({ userId, waktu: new Date().toISOString(), ...isi })); } catch (_) {}
}
function bacaSimpanan(userId) {
  try {
    const s = JSON.parse(localStorage.getItem(KUNCI_SIMPANAN) || 'null');
    return s && s.userId === userId ? s : null;
  } catch (_) { return null; }
}
const keRingkas = (map) => {
  const out = {};
  Object.values(map || {}).forEach(e => { out[e.date] = { date: e.date, totalPenjualan: e.totalPenjualan || 0, gaji: e.gaji || 0, totalPengeluaran: e.totalPengeluaran || 0 }; });
  return out;
};

const JEDA_SEGAR = 30000;

// Katalog (Pengaturan) terakhir yang diterima, disimpan di HP: app yang
// dibuka tanpa sinyal tetap memakai harga & toko yang benar, bukan bawaan.
const KUNCI_KATALOG = 'warkop_katalog_v1';
try { const k = JSON.parse(localStorage.getItem(KUNCI_KATALOG) || 'null'); if (k) aturKatalog(k); } catch (_) {}
function pasangKatalog(k) {
  if (!k || !aturKatalog(k)) return false;
  try { localStorage.setItem(KUNCI_KATALOG, JSON.stringify(k)); } catch (_) {}
  return true;
}

export function useWarkopData(session) {
  const userId = session?.user?.id || null;
  const [entries, setEntries] = useState({});
  const [voucherToko, setVoucherToko] = useState({});
  // Jejak input per tanggal. Hanya Riwayat yang menampilkannya, jadi isinya
  // menyusul saat tab itu dibuka — bukan ikut ditarik saat login.
  const [jejak, setJejak] = useState({});
  const [initialSaldo, setInitialSaldo] = useState(0);
  const [syncStatus, setSyncStatus] = useState(supabaseReady ? "loading" : "not_configured");
  const [loading, setLoading] = useState(supabaseReady);
  // null = angka segar dari server. String waktu = angka dari simpanan HP,
  // ditampilkan karena server tidak terjangkau saat app dibuka.
  const [dataPer, setDataPer] = useState(null);
  // Server tidak terjangkau DAN tidak ada simpanan: jangan tampilkan Rp0.
  const [dataKosong, setDataKosong] = useState(false);
  // Hasil pencocokan kas per tanggal (tabel hitung_kas).
  const [hitungKas, setHitungKas] = useState({});
  // Naik tiap kali katalog berganti, supaya halaman ikut menggambar ulang
  // (larik produk/toko diubah di tempat, React tidak melihatnya sendiri).
  const [versiKatalog, setVersiKatalog] = useState(0);
  // Fitur yang bergantung pada migrasi kas_pemilik_migration.sql. Disembunyikan
  // sampai server menjawab bahwa kolom/tabelnya memang ada.
  const [fitur, setFitur] = useState({ kePemilik: false, hitungKas: false });

  const detailsLoaded = useRef(false);
  const jejakLoaded = useRef(false);
  const [detailsReady, setDetailsReady] = useState(false);

  const entriesRef = useRef(entries);
  useEffect(() => { entriesRef.current = entries; }, [entries]);
  const userAktif = useRef(userId);
  const sedangTarik = useRef(false);
  const segarTerakhir = useRef(0);
  // Pernah putus sejak penarikan terakhir yang berhasil: begitu tersambung
  // lagi, tarik ulang. Realtime tidak mengulang perubahan yang terjadi selagi
  // kanalnya mati — tanpa ini angka basi tampil dengan badge yang sudah hijau.
  const pernahPutus = useRef(false);

  // Tarik saldo, ringkasan entri, dan voucher dari server. `awal` = muat
  // pertama untuk pengguna ini; selain itu senyap dan tidak membuang detail.
  const tarik = useCallback(async ({ awal = false } = {}) => {
    if (!userId || sedangTarik.current) return;
    // Selagi masih ada kiriman tertunda, server belum memuat input itu.
    // Menyegarkan sekarang akan menghapus tebakan lokalnya dari layar; tunggu
    // antrean terkirim (flush memanggil tarik sendiri sesudahnya).
    if (!awal && outboxSize() > 0) return;
    sedangTarik.current = true;
    try {
      const [saldo, ent, vt, hk, kat] = await Promise.all([loadSaldoAwal(), loadEntrySummaries(), loadVoucherToko(), loadHitungKas(), loadKatalog()]);
      // Katalog dipasang LEBIH DULU dari angka lain: tarif & harga dipakai
      // untuk menghitung semuanya.
      if (!kat?.error && kat?.data && pasangKatalog(kat.data)) setVersiKatalog(v => v + 1);
      if (userAktif.current !== userId) return;
      if (ent.error) {
        pernahPutus.current = true;
        setSyncStatus('offline');
        if (awal) {
          const s = bacaSimpanan(userId);
          if (s) {
            setInitialSaldo(s.saldo || 0);
            setEntries(s.entries || {});
            setVoucherToko(s.voucher || {});
            setDataPer(s.waktu);
          } else {
            setDataKosong(true);
          }
        }
        return;
      }
      pernahPutus.current = false;
      segarTerakhir.current = Date.now();
      if (saldo != null) setInitialSaldo(saldo);
      const sebelumnya = entriesRef.current;
      const g = gabungRingkasan(sebelumnya, ent.data);
      entriesRef.current = g.entries;
      setEntries(g.entries);
      // Voucher opsional — abaikan galatnya kalau tabelnya belum ada.
      if (!vt.error) setVoucherToko(vt.data);
      if (!hk.error) setHitungKas(hk.data);
      setFitur({ kePemilik: !vt.error && vt.kePemilikAda !== false, hitungKas: !hk.error && hk.ada });
      setSyncStatus('online');
      setDataPer(null);
      setDataKosong(false);
      simpanTerakhir(userId, { saldo: saldo ?? 0, entries: keRingkas(g.entries), voucher: vt.error ? {} : vt.data });
      // Riwayat sudah memegang detail: tanggal yang ternyata berubah atau baru
      // muncul ditarik detailnya satu per satu, sisanya tetap.
      if (detailsLoaded.current) {
        const tanggalBaru = Object.keys(ent.data).filter(d => !sebelumnya[d]);
        for (const d of [...g.perluDetail, ...tanggalBaru]) {
          const { data } = await loadEntryDetail(d);
          if (data && userAktif.current === userId) setEntries(prev => ({ ...prev, [d]: data }));
        }
        if (!awal && jejakLoaded.current) {
          const { data: jmap, error: jerr } = await loadJejak();
          if (!jerr && userAktif.current === userId) setJejak(jmap);
        }
      }
    } finally {
      sedangTarik.current = false;
      if (awal && userAktif.current === userId) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    userAktif.current = userId;
    // Pengguna berganti (atau keluar): buang semua milik pengguna sebelumnya.
    setEntries({}); entriesRef.current = {};
    setVoucherToko({}); setJejak({}); setInitialSaldo(0); setHitungKas({});
    setDataPer(null); setDataKosong(false);
    detailsLoaded.current = false; jejakLoaded.current = false; setDetailsReady(false);
    pernahPutus.current = false; segarTerakhir.current = 0;
    // Tanpa sesi: layar Login yang tampil, jadi nilai loading tidak kelihatan.
    // Tetap dibiarkan true supaya saat sesi muncul tidak ada satu render antara
    // di mana halaman sempat tampil dengan data kosong.
    setLoading(supabaseReady);
    if (!supabaseReady || !userId) return;
    tarik({ awal: true });
    const unsubscribe = subscribeRealtime({
      onEntry: (ev) => {
        setEntries(prev => {
          const next = { ...prev };
          if (ev.type === 'delete') delete next[ev.date];
          else next[ev.entry.date] = ev.entry;
          return next;
        });
      },
      onSaldoAwal: (value) => setInitialSaldo(value),
      onKatalog: (k) => { if (pasangKatalog(k)) setVersiKatalog(v => v + 1); },
      // Diabaikan selama Riwayat belum pernah memuat jejak: daftar yang cuma
      // berisi kiriman satu jam terakhir lebih menyesatkan daripada kosong.
      onJejak: (j) => {
        if (!jejakLoaded.current) return;
        setJejak(prev => {
          const hari = prev[j.date] || [];
          if (hari.some(x => x.id === j.id)) return prev;
          return { ...prev, [j.date]: [...hari, j].sort((a,b) => String(a.waktu).localeCompare(String(b.waktu))) };
        });
      },
      onHitung: (h) => {
        setHitungKas(prev => {
          const hari = prev[h.date] || [];
          if (hari.some(x => x.id === h.id)) return prev;
          return { ...prev, [h.date]: [...hari, h] };
        });
      },
      onStatus: (st) => {
        if (st === 'offline') pernahPutus.current = true;
        setSyncStatus(prev => prev === 'not_configured' ? prev : st);
        if (st === 'online' && pernahPutus.current) tarik();
      },
      onVoucher: (ev) => {
        setVoucherToko(prev => {
          const next = { ...prev };
          if (ev.type === 'delete') {
            if (next[ev.date]) { const dm = { ...next[ev.date] }; delete dm[ev.tokoId]; if (Object.keys(dm).length===0) delete next[ev.date]; else next[ev.date] = dm; }
          } else {
            next[ev.date] = { ...(next[ev.date]||{}), [ev.tokoId]: ev.cell };
          }
          return next;
        });
      },
    });
    return () => { unsubscribe(); };
  }, [userId, tarik]);

  // Penyegaran senyap saat app kembali ke layar atau sinyal kembali. Dijeda
  // 30 detik supaya bolak-balik ke WhatsApp tidak menembak server terus —
  // kecuali kalau sempat putus, karena justru itu saat datanya paling basi.
  useEffect(() => {
    if (!userId) return;
    const coba = () => {
      if (document.hidden) return;
      if (!pernahPutus.current && Date.now() - segarTerakhir.current < JEDA_SEGAR) return;
      tarik();
    };
    document.addEventListener('visibilitychange', coba);
    window.addEventListener('online', coba);
    return () => {
      document.removeEventListener('visibilitychange', coba);
      window.removeEventListener('online', coba);
    };
  }, [userId, tarik]);

  // === Antrean kiriman tertunda ===
  const [pending, setPending] = useState(outboxSize);
  useEffect(() => onOutboxChange(setPending), []);

  // Coba kirim ulang saat: ada sesi, browser bilang online lagi, app kembali
  // terlihat, dan berkala. WiFi warkop bisa "tersambung" tapi tidak jalan,
  // jadi event online saja tidak cukup diandalkan.
  useEffect(() => {
    if (!userId) return;
    let batal = false;
    const coba = async () => {
      if (batal || outboxSize() === 0) return;
      const { terkirim, sisa, ditolak } = await flushOutbox();
      if (batal) return;
      if (ditolak > 0) showToast(ditolak+' kiriman ditolak server — ketuk "gagal terkirim" di atas', 'gagal');
      // Antrean habis: ambil angka pasti dari server, menggantikan tebakan
      // lokal yang dipasang saat input diantre.
      if (terkirim > 0 && sisa === 0) { setSyncStatus('online'); tarik(); }
    };
    coba();
    const timer = setInterval(coba, 20000);
    window.addEventListener('online', coba);
    document.addEventListener('visibilitychange', coba);
    return () => {
      batal = true; clearInterval(timer);
      window.removeEventListener('online', coba);
      document.removeEventListener('visibilitychange', coba);
    };
  }, [userId, tarik]);

  // Dipanggil halaman setelah operasi tulis, supaya badge mencerminkan keadaan
  // sebenarnya — bukan cuma hasil muat awal seperti sebelumnya.
  const tandaiTulis = useCallback((hasil) => {
    setSyncStatus(prev => prev === 'not_configured' ? prev : (hasil === 'diantre' ? 'offline' : 'online'));
  }, []);

  // Jejak seluruh tanggal, sekali per pengguna. Dipakai Riwayat dan kartu
  // "Tercatat" di Hari Ini; realtime yang menjaga tetap segar setelahnya.
  //
  // Penanda dinyalakan SEBELUM menarik, lalu hasilnya digabung: input orang
  // lain yang masuk persis selagi halaman ini memuat datang lewat realtime,
  // dan kalau ditunggu sampai selesai, baris itu hilang sampai app dibuka
  // lagi. Gagalnya dibiarkan tanpa suara: tabelnya opsional.
  const pastikanJejak = useCallback(() => {
    if (jejakLoaded.current) return;
    jejakLoaded.current = true;
    loadJejak().then(({ data: jmap, error: jerr }) => {
      if (jerr) { jejakLoaded.current = false; return; }
      setJejak(prev => {
        const next = { ...jmap };
        Object.keys(prev).forEach(d => {
          const sudahAda = new Set((next[d] || []).map(j => j.id));
          const susulan = prev[d].filter(j => !sudahAda.has(j.id));
          if (susulan.length) next[d] = [...(next[d] || []), ...susulan].sort((a,b) => String(a.waktu).localeCompare(String(b.waktu)));
        });
        return next;
      });
    });
  }, []);

  // Tarik SEMUA entri lengkap. Dipanggil saat tab Riwayat dibuka. Sekali saja
  // per pengguna — realtime dan tarik() yang menjaga tetap segar setelahnya.
  const loadAllDetails = useCallback(async () => {
    if (detailsLoaded.current) { setDetailsReady(true); return; }
    detailsLoaded.current = true;
    const { data, error } = await loadEntryDetails();
    if (error) {
      detailsLoaded.current = false; setSyncStatus('offline'); pernahPutus.current = true;
      // Tanpa sinyal: tetap tampilkan yang sudah ada (ringkasan), jangan
      // kerangka selamanya.
      setDetailsReady(true);
      return;
    }
    // Jejak ikut ditarik di sini karena tempat menampilkannya sama. Gagalnya
    // dibiarkan tanpa suara: tabelnya opsional (lihat jejak_migration.sql),
    // dan riwayat uangnya tetap utuh walau daftar penginputnya kosong.
    //
    pastikanJejak();
    // Baris lengkap menimpa yang ringkas; tanggal yang cuma ada di ringkas
    // (mustahil, tapi murah untuk dijaga) tetap dipertahankan.
    setEntries(prev => ({ ...prev, ...data }));
    setDetailsReady(true);
  }, [pastikanJejak]);

  // Pastikan satu tanggal punya baris lengkap. Dipakai Hari Ini, yang perlu
  // quantities & expenses tanggal terpilih untuk menumpuk input di atasnya.
  const ensureDetail = useCallback(async (date) => {
    // Sudah lengkap: tidak perlu menarik ulang.
    if (hasDetail(entriesRef.current[date])) return;
    const { data, error } = await loadEntryDetail(date);
    if (error) return;
    setEntries(prev => {
      // Tidak ada entri di server: buang sisa baris ringkas supaya UI tidak
      // menampilkan "sudah tercatat" untuk tanggal yang sebenarnya kosong.
      if (!data) { if (!prev[date]) return prev; const next = { ...prev }; delete next[date]; return next; }
      return { ...prev, [date]: data };
    });
  }, []);

  return {
    entries, setEntries,
    voucherToko, setVoucherToko,
    jejak,
    initialSaldo, setInitialSaldo,
    syncStatus, loading,
    loadAllDetails, detailsReady, ensureDetail,
    pending, tandaiTulis,
    dataPer, dataKosong,
    hitungKas, setHitungKas, fitur,
    pastikanJejak,
    versiKatalog, katalogDisimpan: (k) => { if (pasangKatalog(k)) setVersiKatalog(v => v + 1); },
  };
}

// === Kiriman yang ditolak server ===
// Daftarnya hidup di outbox.js (tersimpan di HP); ini cuma jendela ke sana.
export function useKirimanGagal() {
  const [gagal, setGagal] = useState([]);
  useEffect(() => onGagalChange(setGagal), []);
  return gagal;
}

// === Tanggal hari ini yang ikut berganti saat lewat tengah malam ===
// App kasir sering dibiarkan terbuka semalaman. Tanpa ini tanggalnya macet di
// hari app dibuka, dan penjualan jam 1 pagi masuk ke hari kemarin — diam-diam,
// karena saveEntry MENAMBAH ke entri yang sudah ada.
export function useTodayISO() {
  const [today, setToday] = useState(todayISO);

  useEffect(() => {
    let timer;
    const jadwalkan = () => {
      const now = new Date();
      // 5 detik lewat tengah malam, bukan tepat 00:00 — supaya tidak kebentur
      // pembulatan timer yang membuatnya menyala sedetik terlalu awal.
      const besok = new Date(now.getFullYear(), now.getMonth(), now.getDate()+1, 0, 0, 5);
      timer = setTimeout(() => { setToday(todayISO()); jadwalkan(); }, besok - now);
    };
    jadwalkan();

    // HP menidurkan timer saat layar mati, jadi setTimeout saja tidak cukup:
    // periksa ulang tiap app kembali terlihat.
    const saatTerlihat = () => { if (!document.hidden) setToday(todayISO()); };
    document.addEventListener('visibilitychange', saatTerlihat);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', saatTerlihat); };
  }, []);

  return today;
}

// === Tema gelap/terang ===
// Pertama kali dibuka: ikut setelan terang/gelap HP. Begitu orangnya menekan
// tombol tema, pilihannya disimpan dan menang seterusnya. Sengaja tidak
// disimpan otomatis saat app dibuka — kalau begitu, setelan HP cuma berlaku
// sekali seumur pemasangan.
const temaSistem = () => {
  try { return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; } catch(e) { return 'light'; }
};

export function useTheme() {
  const [theme, setThemeState] = useState(() => {
    try { return localStorage.getItem('theme') || temaSistem(); } catch(e) { return temaSistem(); }
  });
  const setTheme = useCallback((t) => {
    try { localStorage.setItem('theme', t); } catch(e) {}
    setThemeState(t);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    // Bilah status HP ikut warna app. Nilainya sama dengan --bg tiap tema;
    // kalau tidak, app gelap duduk di bawah bilah putih dan terlihat seperti
    // dua aplikasi yang ditempel.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#121110' : '#F5F5F7');
  }, [theme]);

  return [theme, setTheme];
}

// === Sidebar ===
// Menutup sendiri saat pindah halaman di layar HP, membuka lagi saat lebar
// layar melewati 900px.
export function useSidebar() {
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.innerWidth >= 900;
  });

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 900px)');
    const handler = (e) => setSidebarOpen(e.matches);
    if (mq.addEventListener) mq.addEventListener('change', handler);
    else mq.addListener(handler);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', handler);
      else mq.removeListener(handler);
    };
  }, []);

  return [sidebarOpen, setSidebarOpen];
}

// === Perbaikan perilaku input number ===
// Dipasang sekali di App, bukan per halaman: keduanya listener di document.
export function useNumberInputGuards() {
  // Cegah wheel/scroll mengubah nilai input number
  useEffect(() => {
    const onWheel = (e) => {
      const el = e.target;
      if (el && el.tagName === 'INPUT' && el.type === 'number' && document.activeElement === el) {
        el.blur();
      }
    };
    document.addEventListener('wheel', onWheel, { passive: true });
    return () => document.removeEventListener('wheel', onWheel);
  }, []);

  // Auto-select isi input number saat di-focus, supaya ketikan baru menggantikan nilai lama (0 → 1, bukan 01/10)
  useEffect(() => {
    const onFocusIn = (e) => {
      const el = e.target;
      if (el && el.tagName === 'INPUT' && el.type === 'number') {
        setTimeout(() => { try { el.select(); } catch(_) {} }, 0);
      }
    };
    document.addEventListener('focusin', onFocusIn);
    return () => document.removeEventListener('focusin', onFocusIn);
  }, []);
}

// === Form edit entri (dipakai tab Riwayat) ===
// Lima potong state yang selalu berubah bersamaan, dibungkus supaya Riwayat
// tidak menyimpan sepuluh useState sendiri.
export function useEntryEditor() {
  const [editingDate, setEditingDate] = useState(null);
  const [editQty, setEditQty] = useState({});
  const [editExpenses, setEditExpenses] = useState([]);
  const [editCashIns, setEditCashIns] = useState([]);
  const [editSetors, setEditSetors] = useState([]);
  const [editVoucher, setEditVoucher] = useState({});
  const [editSaving, setEditSaving] = useState(false);

  return {
    editingDate, setEditingDate,
    editQty, setEditQty,
    editExpenses, setEditExpenses,
    editCashIns, setEditCashIns,
    editSetors, setEditSetors,
    editVoucher, setEditVoucher,
    editSaving, setEditSaving,
  };
}
