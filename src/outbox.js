import {
  isNetworkError,
  commitEntryAddition,
  deleteEntry as dbDeleteEntry,
  saveVoucherToko as dbSaveVoucherToko,
  saveSaldoAwal as dbSaveSaldoAwal,
} from './db.js'

// Antrean kiriman yang belum sampai ke server. WiFi warkop sering putus di
// tengah simpan; tanpa ini kasir harus menunggu sinyal lalu menekan Simpan
// lagi, dan itu tidak akan selalu dilakukan.
//
// Isinya bertahan di localStorage supaya app boleh ditutup atau HP mati —
// kiriman tetap menyusul saat dibuka lagi.
//
// Yang diantre INPUT-nya, bukan hasil hitungan. Untuk entri harian ini penting:
// "tambah 3 kopi" tetap benar dikirim jam berapa pun, sedangkan "total hari ini
// 96.000" bisa jadi salah kalau perangkat lain menulis lebih dulu.

const KEY = 'warkop_outbox_v1'
// Kiriman yang DITOLAK server (bukan karena jaringan atau sesi). Dulu dibuang
// begitu saja tanpa memberi tahu siapa pun; sekarang disimpan di sini sampai
// orangnya memilih Coba lagi atau Buang.
const KEY_GAGAL = 'warkop_gagal_v1'

let antrean = muat(KEY)
let gagal = muat(KEY_GAGAL)
let sedangKirim = false
const pendengar = new Set()
const pendengarGagal = new Set()

function muat(kunci) {
  try {
    const raw = localStorage.getItem(kunci)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function simpan() {
  try { localStorage.setItem(KEY, JSON.stringify(antrean)) } catch {}
  pendengar.forEach(f => f(antrean.length))
}

function simpanGagal() {
  try { localStorage.setItem(KEY_GAGAL, JSON.stringify(gagal)) } catch {}
  pendengarGagal.forEach(f => f(gagal.slice()))
}

export function onGagalChange(fn) {
  pendengarGagal.add(fn)
  fn(gagal.slice())
  return () => pendengarGagal.delete(fn)
}

export function daftarGagal() { return gagal.slice() }

// Sesi kedaluwarsa (HP lama tanpa sinyal, token habis sebelum antrean
// terkirim) bukan alasan membuang input — begitu sesi diperbarui, kiriman
// yang sama akan diterima. Diperlakukan seperti jaringan: coba lagi nanti.
// Penolakan RLS (42501) BUKAN galat sesi: itu memang tidak diizinkan.
export function isGalatSesi(e) {
  if (!e) return false
  const kode = String(e.code || '')
  if (kode === 'PGRST301' || kode === 'PGRST302' || kode === 'PGRST303') return true
  if (e.status === 401) return true
  return /jwt|token.*(expired|invalid)|refresh token/i.test(String(e.message || e))
}

const cobaLagiNanti = (e) => isNetworkError(e) || isGalatSesi(e)

export function onOutboxChange(fn) {
  pendengar.add(fn)
  fn(antrean.length)
  return () => pendengar.delete(fn)
}

export function outboxSize() { return antrean.length }

// op.jejak ikut dititipkan ke db: siapa yang menekan tombol dan jam berapa,
// direkam saat itu juga. Kiriman yang baru terkirim besok pagi tetap tercatat
// atas nama orang yang benar-benar menginputnya. Kiriman lama yang tersimpan
// di localStorage sebelum fitur ini ada tidak punya op.jejak — undefined, dan
// db diam saja soal itu.
function kirimSatu(op) {
  switch (op.type) {
    case 'tambahEntri':   return commitEntryAddition(op.date, op.input, op.jejak, op.id)
    case 'hapusEntri':    return dbDeleteEntry(op.date, op.jejak)
    case 'simpanVoucher': return dbSaveVoucherToko(op.date, op.rows, op.jejak)
    case 'simpanSaldo':   return dbSaveSaldoAwal(op.value, op.jejak)
    default:              return Promise.resolve()
  }
}

// Kirim ulang isi antrean, berurutan. Berhenti di kegagalan jaringan atau
// sesi pertama supaya urutannya terjaga — dua "tambah" untuk tanggal sama
// tidak boleh bertukar posisi. Kiriman yang DITOLAK server dikeluarkan dari
// antrean (mengulangnya selamanya cuma memacetkan yang di belakangnya) dan
// dipindah ke daftar gagal, bukan dibuang.
export async function flushOutbox() {
  if (sedangKirim || antrean.length === 0) return { terkirim: 0, sisa: antrean.length, ditolak: 0 }
  sedangKirim = true
  let terkirim = 0, ditolak = 0
  try {
    while (antrean.length > 0) {
      const op = antrean[0]
      try {
        await kirimSatu(op)
        antrean.shift(); terkirim++; simpan()
      } catch (e) {
        if (cobaLagiNanti(e)) break
        antrean.shift(); simpan()
        gagal.push({ op, pesan: e?.message || String(e), waktu: new Date().toISOString() })
        simpanGagal()
        ditolak++
      }
    }
  } finally {
    sedangKirim = false
  }
  return { terkirim, sisa: antrean.length, ditolak }
}

// Batalkan kiriman yang masih menunggu di antrean (tombol Batalkan/Urungkan).
// true = berhasil dikeluarkan sebelum sempat terkirim. false = sudah terkirim
// atau sedang dikirim — pemanggil harus membatalkannya di server.
export function batalkanAntrean(id) {
  if (!id) return false
  const i = antrean.findIndex(op => op.id === id)
  if (i < 0 || (sedangKirim && i === 0)) return false
  antrean.splice(i, 1); simpan()
  return true
}

// Dari lembar "gagal terkirim": kembalikan ke ujung antrean dan coba kirim.
export async function cobaLagiGagal(indeks) {
  const item = gagal[indeks]
  if (!item) return
  gagal.splice(indeks, 1); simpanGagal()
  antrean.push(item.op); simpan()
  return flushOutbox()
}

// Dari lembar "gagal terkirim": orangnya sendiri yang memutuskan membuang.
export function buangGagal(indeks) {
  if (!gagal[indeks]) return
  gagal.splice(indeks, 1); simpanGagal()
}

// Coba kirim sekarang; kalau jaringan gagal, masuk antrean.
// Mengembalikan 'terkirim' atau 'diantre' supaya pemanggil bisa memberi tahu
// pengguna dengan jujur — bukan bilang "tersimpan" padahal belum sampai.
export async function kirimAtauAntre(op) {
  // Masih ada antrean: masuk barisan, jangan menyalip.
  if (antrean.length === 0) {
    try {
      await kirimSatu(op)
      return 'terkirim'
    } catch (e) {
      if (!cobaLagiNanti(e)) throw e
    }
  }
  antrean.push(op); simpan()
  return 'diantre'
}

export function clearOutbox() { antrean = []; simpan(); gagal = []; simpanGagal() }

// Pengenal satu kiriman, dibuat SAAT tombol ditekan dan ikut tersimpan di
// antrean. Kiriman ulang membawa pengenal yang sama, jadi server bisa
// mengenalinya dan tidak menambahkan penjualan yang sama dua kali.
export function idKiriman() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  // Cadangan untuk browser lama: bentuk UUID v4 dari Math.random.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}
