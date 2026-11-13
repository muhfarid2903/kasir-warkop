import { PRODUCTS } from './model.js'

// Draf Hari Ini yang belum disimpan, disimpan di HP per TANGGAL.
//
// Dulu draf cuma hidup di state komponen: hilang kalau Android mematikan app,
// kalau halaman dimuat ulang, atau saat pindah tab. Draf juga tidak terikat
// tanggal — lewat tengah malam tanggalnya pindah sendiri dan ketukan kemarin
// yang belum disimpan ikut tersimpan sebagai penjualan hari ini.
//
// Bentuk: { [tanggal]: { quantities, expenses, cashIns, diubah } }

const KUNCI = 'warkop_draf_v1'
const UMUR_MAKS = 3 * 24 * 3600 * 1000   // draf lebih tua dari ini dibuang sendiri

export function drafKosong() {
  const quantities = {}
  PRODUCTS.forEach(p => { quantities[p.id] = 0 })
  return { quantities, expenses: [], cashIns: [], setors: [] }
}

// Draf yang tidak berisi apa pun tidak perlu disimpan, dan tidak perlu
// diumumkan sebagai "draf belum disimpan".
export function drafBerisi(d) {
  if (!d) return false
  const adaQty = Object.values(d.quantities || {}).some(n => (n || 0) > 0)
  const adaBaris = (xs) => (xs || []).some(x => (x.amount || 0) > 0 || (x.desc || '').trim() !== '')
  return adaQty || adaBaris(d.expenses) || adaBaris(d.cashIns) || adaBaris(d.setors)
}

function muatSemua() {
  let semua = {}
  try { semua = JSON.parse(localStorage.getItem(KUNCI) || '{}') || {} } catch (_) { semua = {} }
  const batas = Date.now() - UMUR_MAKS
  let dibuang = false
  Object.keys(semua).forEach(t => { if (!semua[t] || (semua[t].diubah || 0) < batas) { delete semua[t]; dibuang = true } })
  if (dibuang) simpanSemua(semua)
  return semua
}

function simpanSemua(semua) {
  try { localStorage.setItem(KUNCI, JSON.stringify(semua)) } catch (_) {}
}

export function bacaDraf(tanggal) {
  const d = muatSemua()[tanggal]
  if (!d) return drafKosong()
  const kosong = drafKosong()
  return {
    quantities: { ...kosong.quantities, ...(d.quantities || {}) },
    expenses: Array.isArray(d.expenses) ? d.expenses : [],
    cashIns: Array.isArray(d.cashIns) ? d.cashIns : [],
    setors: Array.isArray(d.setors) ? d.setors : [],
  }
}

export function tulisDraf(tanggal, d) {
  const semua = muatSemua()
  if (drafBerisi(d)) semua[tanggal] = { quantities: d.quantities, expenses: d.expenses, cashIns: d.cashIns, setors: d.setors || [], diubah: Date.now() }
  else delete semua[tanggal]
  simpanSemua(semua)
}

export function hapusDraf(tanggal) {
  const semua = muatSemua()
  if (!semua[tanggal]) return
  delete semua[tanggal]
  simpanSemua(semua)
}

// Tanggal lain yang masih punya draf berisi, terbaru dulu — untuk petunjuk
// "Ada draf belum disimpan · 12 Nov" di dekat pemilih tanggal.
export function tanggalDrafLain(tanggalKini) {
  const semua = muatSemua()
  return Object.keys(semua).filter(t => t !== tanggalKini && drafBerisi(semua[t])).sort().reverse()
}

// Kebalikan kurangiDraf: input yang dibatalkan dikembalikan ke draf, supaya
// orangnya tinggal membetulkan lalu menyimpan lagi.
export function tambahKeDraf(d, input) {
  const quantities = { ...d.quantities }
  Object.keys(input.quantities || {}).forEach(id => { quantities[id] = (quantities[id] || 0) + (input.quantities[id] || 0) })
  return {
    quantities,
    expenses: [...(d.expenses || []), ...(input.expenses || [])],
    cashIns: [...(d.cashIns || []), ...(input.cashIns || [])],
    setors: [...(d.setors || []), ...(input.setors || [])],
  }
}

// Sesudah simpan: kurangi draf dengan yang barusan terkirim, bukan
// mengosongkannya. Ketukan yang masuk SELAGI kiriman berjalan tetap tinggal.
// Baris pengeluaran dikenali dari objeknya sendiri — baris yang tidak diubah
// sejak tombol ditekan masih objek yang sama.
export function kurangiDraf(d, terkirim) {
  const quantities = { ...d.quantities }
  Object.keys(terkirim.quantities || {}).forEach(id => {
    quantities[id] = Math.max(0, (quantities[id] || 0) - (terkirim.quantities[id] || 0))
  })
  const sudah = new Set([...(terkirim.expenses || []), ...(terkirim.cashIns || []), ...(terkirim.setors || [])])
  return {
    quantities,
    expenses: (d.expenses || []).filter(x => !sudah.has(x)),
    cashIns: (d.cashIns || []).filter(x => !sudah.has(x)),
    setors: (d.setors || []).filter(x => !sudah.has(x)),
  }
}
