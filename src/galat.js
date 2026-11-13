import { catatGalat } from './db.js'

// Laporan galat ke server (tabel galat). Dipanggil ErrorBoundary dan dua
// pendengar global di bawah. Paling banyak lima laporan per sesi: satu galat
// yang berulang tiap render tidak boleh membanjiri tabel atau kuota.

export const VERSI_APP = typeof __VERSI_APP__ !== 'undefined' ? __VERSI_APP__ : 'lokal'

let terkirim = 0
let namaSekarang = null
export function setPelapor(nama) { namaSekarang = nama }

export function laporkanGalat(err, halaman = '') {
  if (terkirim >= 5) return
  terkirim++
  const pesan = String(err?.message || err || 'galat tanpa pesan').slice(0, 500)
  catatGalat({
    oleh: namaSekarang,
    pesan,
    tumpukan: String(err?.stack || '').slice(0, 4000) || null,
    versi: VERSI_APP,
    halaman: String(halaman || (typeof location !== 'undefined' ? location.hash || location.pathname : '')).slice(0, 200),
    perangkat: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 300) : null,
  })
}

export function pasangPelaporGalat() {
  if (typeof window === 'undefined') return
  window.addEventListener('error', (e) => laporkanGalat(e.error || e.message, 'window.onerror'))
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason
    // Jaringan putus bukan galat app — itu sudah ditangani antrean & badge.
    if (/fetch|network|load failed/i.test(String(r?.message || r))) return
    laporkanGalat(r, 'promise')
  })
}
