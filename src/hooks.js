import { useState, useEffect } from 'react'
import {
  supabaseReady,
  getSession, onAuthChange,
  loadSaldoAwal, loadEntries, loadVoucherToko,
  subscribeRealtime,
} from './db.js'

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
export function useWarkopData(session) {
  const [entries, setEntries] = useState({});
  const [voucherToko, setVoucherToko] = useState({});
  const [initialSaldo, setInitialSaldo] = useState(0);
  const [syncStatus, setSyncStatus] = useState(supabaseReady ? "loading" : "not_configured");
  const [loading, setLoading] = useState(supabaseReady);

  useEffect(() => {
    if (!supabaseReady || !session) { if (!session) { setEntries({}); setVoucherToko({}); setInitialSaldo(0); } setLoading(false); return; }
    setLoading(true);
    let cancelled = false;
    (async () => {
      // Saldo awal
      const saldo = await loadSaldoAwal();
      if (!cancelled && saldo != null) setInitialSaldo(saldo);
      // Entries
      const { data: map, error } = await loadEntries();
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

  return { entries, setEntries, voucherToko, setVoucherToko, initialSaldo, setInitialSaldo, syncStatus, loading };
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
