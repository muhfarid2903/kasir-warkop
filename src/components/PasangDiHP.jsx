import { useEffect, useState } from 'react'
import { Icon } from './Icon.jsx'

// "Pasang di HP". App ini PWA — tidak ada APK. Chrome di Android memberi
// prompt pemasangannya sendiri lewat event beforeinstallprompt; Safari di
// iPhone tidak punya, jadi di sana yang tampil petunjuk dua langkah.

let promptTersimpan = null;
const pendengar = new Set();
if (typeof window !== 'undefined') {
  // Event ini datang sekali, sering sebelum React selesai dipasang — jadi
  // ditangkap di tingkat modul, bukan di dalam komponen.
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    promptTersimpan = e;
    pendengar.forEach(f => f());
  });
  window.addEventListener('appinstalled', () => { promptTersimpan = null; pendengar.forEach(f => f()); });
}

const sudahTerpasang = () => typeof window !== 'undefined' && (
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
);
const iPhone = () => typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

export function usePasang() {
  const [, paksa] = useState(0);
  useEffect(() => { const f = () => paksa(n => n + 1); pendengar.add(f); return () => pendengar.delete(f); }, []);
  return { terpasang: sudahTerpasang(), adaPrompt: !!promptTersimpan };
}

export async function mintaPasang() {
  if (!promptTersimpan) return false;
  const e = promptTersimpan;
  promptTersimpan = null;
  e.prompt();
  try { await e.userChoice; } catch (_) {}
  pendengar.forEach(f => f());
  return true;
}

export function LembarPasang({ onTutup }) {
  return (
    <div className="modal-overlay" onClick={onTutup}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="judul-pasang" onClick={e => e.stopPropagation()}>
        <div className="modal-title">
          <span id="judul-pasang">Pasang di HP</span>
          <button className="del-btn" aria-label="Tutup" onClick={onTutup}><Icon type="x" size={16}/></button>
        </div>
        {iPhone() ? (
          <ol className="langkah-pasang">
            <li>Buka <strong>kasir.balanglompo.com</strong> di <strong>Safari</strong>.</li>
            <li>Ketuk tombol <strong>Bagikan</strong> (kotak dengan panah ke atas).</li>
            <li>Pilih <strong>Tambahkan ke Layar Utama</strong>.</li>
          </ol>
        ) : (
          <ol className="langkah-pasang">
            <li>Buka <strong>kasir.balanglompo.com</strong> di <strong>Chrome</strong>.</li>
            <li>Ketuk menu <strong>⋮</strong> di pojok kanan atas.</li>
            <li>Pilih <strong>Tambahkan ke layar utama</strong> atau <strong>Instal aplikasi</strong>.</li>
          </ol>
        )}
        <p className="lembar-pengantar">Ikon Warkopsaja muncul di layar utama. Bukanya tanpa address bar, dan tetap bisa dibuka waktu sinyal mati.</p>
      </div>
    </div>
  );
}
