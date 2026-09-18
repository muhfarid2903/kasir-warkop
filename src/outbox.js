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

let antrean = muat()
let sedangKirim = false
const pendengar = new Set()

function muat() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function simpan() {
  try { localStorage.setItem(KEY, JSON.stringify(antrean)) } catch {}
  pendengar.forEach(f => f(antrean.length))
}

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
    case 'tambahEntri':   return commitEntryAddition(op.date, op.input, op.jejak)
    case 'hapusEntri':    return dbDeleteEntry(op.date, op.jejak)
    case 'simpanVoucher': return dbSaveVoucherToko(op.date, op.rows, op.jejak)
    case 'simpanSaldo':   return dbSaveSaldoAwal(op.value, op.jejak)
    default:              return Promise.resolve()
  }
}

// Kirim ulang isi antrean, berurutan. Berhenti di kegagalan jaringan pertama
// supaya urutannya terjaga — dua "tambah" untuk tanggal sama tidak boleh
// bertukar posisi. Kiriman yang DITOLAK server (bukan masalah jaringan) dibuang,
// karena mengulangnya selamanya cuma akan memacetkan antrean.
export async function flushOutbox() {
  if (sedangKirim || antrean.length === 0) return { terkirim: 0, sisa: antrean.length }
  sedangKirim = true
  let terkirim = 0, dibuang = []
  try {
    while (antrean.length > 0) {
      const op = antrean[0]
      try {
        await kirimSatu(op)
        antrean.shift(); terkirim++; simpan()
      } catch (e) {
        if (isNetworkError(e)) break
        antrean.shift(); dibuang.push({ op, pesan: e?.message || String(e) }); simpan()
      }
    }
  } finally {
    sedangKirim = false
  }
  return { terkirim, sisa: antrean.length, dibuang }
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
      if (!isNetworkError(e)) throw e
    }
  }
  antrean.push(op); simpan()
  return 'diantre'
}

export function clearOutbox() { antrean = []; simpan() }
