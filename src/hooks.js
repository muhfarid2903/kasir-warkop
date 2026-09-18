import { useState, useEffect, useCallback, useRef } from 'react'
import {
  supabaseReady,
  getSession, onAuthChange,
  loadSaldoAwal, loadEntrySummaries, loadEntryDetails, loadEntryDetail, loadVoucherToko,
  loadJejak, subscribeRealtime,
} from './db.js'
import { flushOutbox, onOutboxChange, outboxSize } from './outbox.js'
import { hasDetail, todayISO } from './model.js'

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
export function useWarkopData(session) {
  const [entries, setEntries] = useState({});
  const [voucherToko, setVoucherToko] = useState({});
  // Jejak input per tanggal. Hanya Riwayat yang menampilkannya, jadi isinya
  // menyusul saat tab itu dibuka — bukan ikut ditarik saat login.
  const [jejak, setJejak] = useState({});
  const [initialSaldo, setInitialSaldo] = useState(0);
  const [syncStatus, setSyncStatus] = useState(supabaseReady ? "loading" : "not_configured");
  const [loading, setLoading] = useState(supabaseReady);

  useEffect(() => {
    // Tanpa sesi: layar Login yang tampil, jadi nilai loading tidak kelihatan.
    // Tetap dibiarkan true supaya saat sesi muncul tidak ada satu render antara
    // di mana halaman sempat tampil dengan data kosong — itu bikin Hari Ini
    // mount lalu unmount lagi, dan ikut menembakkan permintaan yang mubazir.
    if (!supabaseReady || !session) { if (!session) { setEntries({}); setVoucherToko({}); setJejak({}); setInitialSaldo(0); detailsLoaded.current = false; setDetailsReady(false); jejakLoaded.current = false; } setLoading(supabaseReady); return; }
    setLoading(true);
    let cancelled = false;
    (async () => {
      // Saldo awal
      const saldo = await loadSaldoAwal();
      if (!cancelled && saldo != null) setInitialSaldo(saldo);
      // Entries — ringkas dulu; detailnya menyusul saat diminta
      const { data: map, error } = await loadEntrySummaries();
      if (cancelled) return;
      if (error) { setSyncStatus('offline'); setLoading(false); return; }
      setEntries(map);
      // Voucher Toko (opsional — abaikan error jika tabel belum ada)
      const { data: vmap, error: vtErr } = await loadVoucherToko();
      if (!cancelled && !vtErr) setVoucherToko(vmap);
      setSyncStatus('online');
      setLoading(false);
    })();
    // Realtime
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
      onStatus: (st) => setSyncStatus(prev => prev === 'not_configured' ? prev : st),
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
    return () => { cancelled = true; unsubscribe(); };
  }, [session]);

  // === Antrean kiriman tertunda ===
  const [pending, setPending] = useState(outboxSize);
  useEffect(() => onOutboxChange(setPending), []);

  // Coba kirim ulang saat: ada sesi, browser bilang online lagi, app kembali
  // terlihat, dan berkala. WiFi warkop bisa "tersambung" tapi tidak jalan,
  // jadi event online saja tidak cukup diandalkan.
  useEffect(() => {
    if (!session) return;
    let batal = false;
    const coba = async () => {
      if (batal || outboxSize() === 0) return;
      const { terkirim, sisa } = await flushOutbox();
      if (batal) return;
      if (terkirim > 0 && sisa === 0) setSyncStatus('online');
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
  }, [session]);

  // Dipanggil halaman setelah operasi tulis, supaya badge mencerminkan keadaan
  // sebenarnya — bukan cuma hasil muat awal seperti sebelumnya.
  const tandaiTulis = useCallback((hasil) => {
    setSyncStatus(prev => prev === 'not_configured' ? prev : (hasil === 'diantre' ? 'offline' : 'online'));
  }, []);

  // Tarik SEMUA entri lengkap. Dipanggil saat tab Riwayat dibuka. Sekali saja
  // per sesi — realtime yang menjaga tetap segar setelahnya.
  const detailsLoaded = useRef(false);
  const jejakLoaded = useRef(false);
  const [detailsReady, setDetailsReady] = useState(false);

  const loadAllDetails = useCallback(async () => {
    if (detailsLoaded.current) { setDetailsReady(true); return; }
    detailsLoaded.current = true;
    const { data, error } = await loadEntryDetails();
    if (error) { detailsLoaded.current = false; setSyncStatus('offline'); return; }
    // Jejak ikut ditarik di sini karena tempat menampilkannya sama. Gagalnya
    // dibiarkan tanpa suara: tabelnya opsional (lihat jejak_migration.sql),
    // dan riwayat uangnya tetap utuh walau daftar penginputnya kosong.
    //
    // Penanda dinyalakan SEBELUM menarik, lalu hasilnya digabung: input orang
    // lain yang masuk persis selagi halaman ini memuat datang lewat realtime,
    // dan kalau ditunggu sampai selesai, baris itu hilang sampai app dibuka
    // lagi.
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
    // Baris lengkap menimpa yang ringkas; tanggal yang cuma ada di ringkas
    // (mustahil, tapi murah untuk dijaga) tetap dipertahankan.
    setEntries(prev => ({ ...prev, ...data }));
    setDetailsReady(true);
  }, []);

  // Pastikan satu tanggal punya baris lengkap. Dipakai Hari Ini, yang perlu
  // quantities & expenses tanggal terpilih untuk menumpuk input di atasnya.
  const ensureDetail = useCallback(async (date) => {
    // Sudah lengkap: tidak perlu menarik ulang.
    let sudah = false;
    setEntries(prev => { sudah = hasDetail(prev[date]); return prev; });
    if (sudah) return;
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
  };
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
export function useTheme() {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('theme') || 'light'; } catch(e) { return 'light'; }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('theme', theme); } catch(e) {}
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
  const [editVoucher, setEditVoucher] = useState({});
  const [editSaving, setEditSaving] = useState(false);

  return {
    editingDate, setEditingDate,
    editQty, setEditQty,
    editExpenses, setEditExpenses,
    editCashIns, setEditCashIns,
    editVoucher, setEditVoucher,
    editSaving, setEditSaving,
  };
}
