import { unduhCadangan } from './db.js'
import { todayISO } from './model.js'

// Unduh cadangan lengkap ke HP/komputer. Dipisah dari csv.js: CSV untuk
// dibaca di Excel, berkas ini untuk MEMULIHKAN (lihat
// scripts/cadangan-ke-sql.mjs) — isinya mentah, apa adanya dari database.

const KUNCI = 'warkop_cadangan_terakhir'
export const BATAS_HARI = 30

export async function simpanCadangan() {
  const isi = await unduhCadangan()
  const blob = new Blob([JSON.stringify(isi, null, 1)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'cadangan-warkopsaja-' + todayISO() + '.json'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  try { localStorage.setItem(KUNCI, new Date().toISOString()) } catch (_) {}
  const jumlah = Object.values(isi.tabel).reduce((n, t) => n + (t?.length || 0), 0)
  return jumlah
}

// Berapa hari sejak cadangan terakhir diunduh dari HP INI (null = belum
// pernah). Dicatat per HP karena tidak ada tempat lain yang tahu.
export function hariSejakCadangan() {
  try {
    const w = localStorage.getItem(KUNCI)
    if (!w) return null
    return Math.floor((Date.now() - new Date(w).getTime()) / 86400000)
  } catch (_) { return null }
}
