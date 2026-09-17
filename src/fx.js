import { useEffect } from 'react'
import { bunyi, bangunkan } from './sfx.js'

// Umpan balik sentuhan untuk SELURUH app, dipasang sekali di App lewat satu
// listener di document — bukan ditempel satu per satu ke tiap tombol. Alasannya
// sama dengan useNumberInputGuards di hooks.js: yang begini kalau dititipkan ke
// tiap halaman pasti ada yang terlewat, dan tombol yang diam sendirian terasa
// seperti rusak, bukan seperti pilihan desain.
//
// Yang dikerjakan di sini: memilih bunyi yang cocok untuk benda yang disentuh,
// dan menaruh riak cahaya di titik jari mendarat.

// Urutannya penting — yang pertama cocok yang menang. Tombol "−" duduk DI DALAM
// kartu produk, jadi ia harus diperiksa sebelum kartunya, kalau tidak mengurangi
// kopi akan berbunyi seperti menambah.
const PETA = [
  ['.produk-kartu-bawah .kurang, .chip-kurang, .del-btn, .search-clear, .sidebar-close', 'kurang'],
  ['.produk-kartu, .chip', 'ketuk'],
  ['.btn-save', 'tekan'],
  ['.nav-btn, .tab-btn, .date-display-btn, .mobile-nav-btn, .rekap-toggle', 'pindah'],
  ['button, [role="button"], a, summary', 'klik'],
  ['input, select, textarea', 'fokus'],
];

const halus = () => typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// === Riak cahaya ===
// Tinggal di lapisan fixed miliknya sendiri, bukan di dalam elemen yang
// ditekan. Kartu produk punya overflow, border-radius, dan transform sendiri —
// riak yang ditanam di dalamnya akan terpotong atau ikut terdorong.
let lapisan = null;
function lapisanFx() {
  if (lapisan && lapisan.isConnected) return lapisan;
  lapisan = document.createElement('div');
  lapisan.id = 'fx';
  document.body.appendChild(lapisan);
  return lapisan;
}

export function riak(x, y, ukuran = 130) {
  if (halus()) return;
  const el = document.createElement('span');
  el.className = 'fx-riak';
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  el.style.setProperty('--r', ukuran + 'px');
  lapisanFx().appendChild(el);
  // animationend saja tidak cukup: kalau tab disembunyikan di tengah animasi,
  // event-nya tidak pernah datang dan riaknya menumpuk di DOM selamanya.
  const buang = () => el.remove();
  el.addEventListener('animationend', buang);
  setTimeout(buang, 900);
}

// Kilau selebar layar untuk satu momen saja: entri hari itu tersimpan.
export function kilat() {
  if (halus()) return;
  const el = document.createElement('div');
  el.className = 'fx-kilat';
  lapisanFx().appendChild(el);
  const buang = () => el.remove();
  el.addEventListener('animationend', buang);
  setTimeout(buang, 1400);
}

// Menyalakan ulang animasi CSS pada elemen yang sudah memakainya. Tanpa
// paksaan reflow di tengah, browser menggabungkan hapus+pasang jadi tidak
// terjadi apa-apa — ketukan kedua di kartu yang sama akan diam.
export function denyut(el, kelas, ms = 400) {
  if (!el || halus()) return;
  el.classList.remove(kelas);
  void el.offsetWidth;
  el.classList.add(kelas);
  clearTimeout(el._fxTimer);
  el._fxTimer = setTimeout(() => el.classList.remove(kelas), ms);
}

// Dipakai halaman yang menunda aksinya sendiri (kartu & chip Hari Ini menahan
// ketukan sampai yakin jarinya tidak sedang menggulir). Bunyinya ikut ditunda
// ke sini supaya jari yang cuma lewat tidak ikut membunyikan kasir.
export function rayakan(e, nama = 'ketuk') {
  bunyi(nama);
  if (!e) return;
  riak(e.clientX, e.clientY, 190);
  // currentTarget masih terisi selama handler berjalan — itu kartu/chip yang
  // ditekan, dan pantulannya harus datang bersama bunyinya, bukan lebih awal
  // waktu jari baru mendarat.
  denyut(e.currentTarget, 'fx-pop', 360);
}

function sasaran(t) {
  if (!t || typeof t.closest !== 'function') return null;
  for (const [pilih, nama] of PETA) {
    const el = t.closest(pilih);
    if (el) return { el, nama };
  }
  return null;
}

function pasang() {
  const onPointerDown = (e) => {
    bangunkan();
    const hit = sasaran(e.target);
    if (!hit) return;
    // Ditandai halaman sebagai "aku yang membunyikan sendiri" — lihat rayakan().
    if (hit.el.dataset && hit.el.dataset.fx === 'tunda') return;
    bunyi(hit.nama);
    if (hit.nama === 'fokus') return;              // kolom isian tidak perlu riak
    riak(e.clientX, e.clientY, hit.nama === 'ketuk' ? 190 : 130);
    denyut(hit.el, 'fx-pop', 360);
  };

  const onKeyDown = (e) => {
    bangunkan();
    const k = e.key;
    if (!k || e.ctrlKey || e.metaKey || e.altKey) return;
    if (k === 'Shift' || k === 'Control' || k === 'Alt' || k === 'Meta' || k === 'CapsLock') return;
    // Ditahan sampai auto-repeat: tetap berbunyi supaya terasa menyambung,
    // tapi lebih pelan — kalau tidak, menghapus satu baris jadi rentetan.
    const kuat = e.repeat ? .45 : 1;
    if (k === 'Backspace' || k === 'Delete') bunyi('hapus', kuat);
    else if (k === 'Enter') bunyi('enter', kuat);
    else if (k === ' ' || k === 'Spacebar') bunyi('spasi', kuat);
    else if (k === 'Tab') bunyi('fokus', kuat);
    else bunyi('ketik', kuat);

    const el = document.activeElement;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) denyut(el, 'fx-ketik', 260);
  };

  // Android mematikan AudioContext saat layar mati; tanpa ini app yang dibuka
  // lagi dari saku akan bisu sampai di-refresh.
  const onTerlihat = () => { if (!document.hidden) bangunkan(); };

  document.addEventListener('pointerdown', onPointerDown, { passive: true, capture: true });
  document.addEventListener('keydown', onKeyDown, { passive: true, capture: true });
  document.addEventListener('visibilitychange', onTerlihat);
  return () => {
    document.removeEventListener('pointerdown', onPointerDown, { capture: true });
    document.removeEventListener('keydown', onKeyDown, { capture: true });
    document.removeEventListener('visibilitychange', onTerlihat);
  };
}

export function useEfekSentuh() {
  useEffect(pasang, []);
}
