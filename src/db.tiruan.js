import { accumulateEntry, buildEntry, dateToISO, todayISO, TOKO, V2K_SETORAN } from './model.js'
import entriNyata from './__tests__/entri-nyata.json'

// Pengganti db.js untuk `npm run dev`. Bentuk ekspornya sama persis dengan
// db.js, jadi tidak ada satu baris pun di halaman yang tahu sedang memakai
// yang mana — vite.config.js yang membelokkan impornya.
//
// Kenapa perlu: sebelum berkas ini ada, `npm run dev` bicara ke Supabase
// produksi, dan menekan Simpan di localhost menulis ke pembukuan asli.
//
// Datanya hidup di localStorage, jadi dua tab browser = dua HP yang memakai
// database yang sama. Perubahan dari satu tab sampai ke tab lain lewat
// BroadcastChannel, menirukan realtime Supabase.
//
// Gangguan bisa dipicu dari console lewat window.__tiruan (lihat paling bawah)
// — sinyal putus, balasan yang hilang, event auth — karena justru keadaan
// itulah yang paling sering salah dan paling sulit dicoba di warkop sungguhan.

export const supabaseReady = true
export const modeTiruan = true

const KUNCI_DB = 'tiruan_db_v1'
const KUNCI_SESI = 'tiruan_sesi_v1'

// Akun tiruan. Hanya ada di localhost; tidak ada hubungannya dengan akun
// Supabase mana pun.
export const AKUN_TIRUAN = [
  { email: 'pemilik@warkop.test', password: 'tiruan-pemilik', nama: 'Farid', peran: 'pemilik', id: '00000000-0000-4000-8000-000000000001' },
  { email: 'jaya@warkop.test',    password: 'tiruan-jaya',    nama: 'Jaya',  peran: 'kasir',   id: '00000000-0000-4000-8000-000000000002' },
]

// === Gangguan ===
// Status putus bertahan lewat muat ulang halaman — supaya "app dibuka tanpa
// sinyal" bisa dicoba: putus(true), lalu muat ulang.
const KUNCI_PUTUS = 'tiruan_putus'
const gangguan = {
  putus: (() => { try { return localStorage.getItem(KUNCI_PUTUS) === '1' } catch (_) { return false } })(),
  hilangBalasan: 0,    // n tulisan berikutnya SAMPAI di "server" tapi balasannya hilang
  tolak: 0,            // n tulisan berikutnya DITOLAK server (seperti pelanggaran RLS)
  jeda: [120, 260],    // ms, acak di antaranya
}

const tidur = (ms) => new Promise(r => setTimeout(r, ms))
const jedaJaringan = () => tidur(gangguan.jeda[0] + Math.random() * (gangguan.jeda[1] - gangguan.jeda[0]))
const galatJaringan = () => new TypeError('Failed to fetch')

// Supabase sungguhan MENGEMBALIKAN galat untuk bacaan dan db.js MELEMPAR untuk
// tulisan; tiruan ini meniru keduanya supaya jalur galat di app ikut teruji.
async function bacaan(fn) {
  await jedaJaringan()
  if (gangguan.putus) return { data: null, error: { message: 'TypeError: Failed to fetch' } }
  return { data: fn(), error: null }
}
async function tulisan(fn) {
  await jedaJaringan()
  if (gangguan.putus) throw galatJaringan()
  if (gangguan.tolak > 0) {
    gangguan.tolak--
    const e = new Error('new row violates row-level security policy for table "entries"')
    e.code = '42501'
    throw e
  }
  const hasil = fn()
  if (gangguan.hilangBalasan > 0) { gangguan.hilangBalasan--; throw galatJaringan() }
  return hasil
}

// === Penyimpanan ===
function muat() {
  try {
    const raw = localStorage.getItem(KUNCI_DB)
    if (raw) return JSON.parse(raw)
  } catch (_) { /* rusak: bibit ulang */ }
  const db = bibit()
  simpan(db)
  return db
}
function simpan(db) {
  try { localStorage.setItem(KUNCI_DB, JSON.stringify(db)) } catch (_) { /* penuh: biarkan */ }
}
// Baca → ubah → simpan dalam satu langkah, supaya dua tab yang menulis
// bergantian tetap melihat isi terbaru.
function ubah(fn) {
  const db = muat()
  const hasil = fn(db)
  simpan(db)
  return hasil
}

// === Data awal ===
// 37 entri nyata Mar–Apr 2026 (sama dengan yang dipakai tes), ditambah data
// sintetis sejak 1 Mei yang meniru pola pemakaian sekarang: voucher dititip
// ke toko, toko menyetor semua stoknya lalu diisi ulang, setorannya dicatat
// sebagai pengeluaran "tf <toko> <jumlah>" karena masuk ke kas pemilik, dan
// kopi libur di 45 hari terakhir.
function bibit() {
  const entries = JSON.parse(JSON.stringify(entriNyata))
  const voucher = {}
  const jejak = []
  let idJejak = 1

  // Pengacak deterministik: isi tiruan sama tiap kali dibibit ulang.
  let benih = 20260501
  const acak = () => { benih = (benih * 1103515245 + 12345) % 2147483648; return benih / 2147483648 }

  const hariIni = new Date()
  const mulai = new Date(2026, 4, 1)
  const kopiBerhenti = new Date(hariIni.getFullYear(), hariIni.getMonth(), hariIni.getDate() - 45)
  const stok = {}; TOKO.forEach(t => { stok[t.id] = 0 })

  const jejakBaru = (date, aksi, oleh, rincian, jam) => {
    jejak.push({ id: idJejak++, date, aksi, oleh, email: oleh === 'Jaya' ? 'jaya@warkop.test' : 'pemilik@warkop.test', rincian, waktu: date + 'T' + jam + ':00+08:00' })
  }

  for (let d = new Date(mulai); d < new Date(hariIni.getFullYear(), hariIni.getMonth(), hariIni.getDate()); d.setDate(d.getDate() + 1)) {
    const date = dateToISO(d)
    const quantities = {}
    const expenses = []
    const kopiBuka = d < kopiBerhenti

    if (kopiBuka && acak() < 0.85) {
      quantities.kopilain = Math.floor(acak() * 8)
      quantities.vietnam = Math.floor(acak() * 7)
      if (acak() < 0.15) quantities.teh = 1 + Math.floor(acak() * 2)
      if (acak() < 0.8) expenses.push({ desc: 'Susu', amount: 26000 + Math.floor(acak() * 4) * 1000 })
      if (acak() < 0.3) expenses.push({ desc: 'Good Day', amount: 12000 })
    }

    // Toko melapor kira-kira tiap lima hari: semua stok laku, lalu diisi ulang.
    const hariVoucher = {}
    TOKO.forEach((t, i) => {
      if (date === '2026-05-01') { hariVoucher[t.id] = { drop: 70, laku: 0 }; stok[t.id] = 70; return }
      if ((d.getDate() + i * 2) % 5 !== 0 || acak() < 0.35) return
      const laku = stok[t.id]
      if (laku <= 0) return
      const drop = acak() < 0.25 ? 140 : 70
      hariVoucher[t.id] = { drop, laku }
      stok[t.id] = stok[t.id] - laku + drop
      expenses.push({ desc: 'tf ' + t.name.toLowerCase() + ' ' + laku, amount: laku * V2K_SETORAN })
    })
    if (Object.keys(hariVoucher).length) {
      voucher[date] = hariVoucher
      jejakBaru(date, 'voucher', 'Farid', { toko: Object.entries(hariVoucher).map(([id, r]) => ({ id, ...r })) }, '16:05')
    }

    const adaQty = Object.values(quantities).some(n => n > 0)
    if (adaQty || expenses.length) {
      entries[date] = buildEntry(date, quantities, expenses)
      const oleh = acak() < 0.3 ? 'Jaya' : 'Farid'
      jejakBaru(date, 'tambah', oleh, { qty: quantities, keluar: expenses.map(x => ({ ket: x.desc, jumlah: x.amount })), masuk: [] }, '16:06')
    }
  }

  return { entries, voucher, config: { saldo_awal: 6000000 }, jejak, idJejak, opDiterima: [] }
}

// === Realtime tiruan ===
// Satu kanal untuk semua tab. Pengirimnya ikut menerima (Supabase juga
// mengirim balik perubahan milik sendiri), jadi tidak ada jalur khusus.
const pendengarRealtime = new Set()
let kanal = null
try { kanal = new BroadcastChannel('warkop-tiruan') } catch (_) { /* browser lama */ }
if (kanal) kanal.onmessage = (e) => pendengarRealtime.forEach(f => f(e.data))
function siarkan(ev) {
  pendengarRealtime.forEach(f => f(ev))
  try { kanal?.postMessage(ev) } catch (_) { /* tab lain tutup */ }
}

// === Auth ===
const pendengarAuth = new Set()

function sesiUntuk(akun) {
  return {
    access_token: 'tiruan.' + akun.id + '.' + Date.now(),
    token_type: 'bearer',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: {
      id: akun.id,
      email: akun.email,
      user_metadata: { nama: akun.nama },
      app_metadata: { peran: akun.peran },
    },
  }
}
function sesiTersimpan() {
  try { const raw = localStorage.getItem(KUNCI_SESI); return raw ? JSON.parse(raw) : null } catch (_) { return null }
}
// Selalu objek BARU — Supabase juga begitu. Tanpa ini bug "draf hilang tiap
// app kembali ke layar" (RENCANA 1.1) tidak akan pernah terlihat di sini.
function siarkanAuth(jenis) {
  const s = sesiTersimpan()
  const salinan = s ? JSON.parse(JSON.stringify(s)) : null
  pendengarAuth.forEach(f => f(jenis, salinan))
}

export async function getSession() {
  return sesiTersimpan()
}

export function onAuthChange(handler) {
  const f = (_jenis, s) => handler(s || null)
  pendengarAuth.add(f)
  return () => pendengarAuth.delete(f)
}

export async function signIn(email, password) {
  await jedaJaringan()
  if (gangguan.putus) throw galatJaringan()
  const akun = AKUN_TIRUAN.find(a => a.email === String(email).trim().toLowerCase() && a.password === password)
  if (!akun) { const e = new Error('Invalid login credentials'); e.status = 400; throw e }
  const sesi = sesiUntuk(akun)
  try { localStorage.setItem(KUNCI_SESI, JSON.stringify(sesi)) } catch (_) { /* abaikan */ }
  siarkanAuth('SIGNED_IN')
  return sesi
}

const pendengarPemulihan = new Set()

export async function kirimTautanPassword(email) {
  await jedaJaringan()
  if (gangguan.putus) throw galatJaringan()
  if (!AKUN_TIRUAN.some(a => a.email === String(email).trim().toLowerCase())) return   // Supabase juga diam untuk email tak dikenal
  console.info('[tiruan] tautan ganti password "terkirim" ke', email, '— picu dengan __tiruan.bukaTautanPassword()')
}

export async function gantiPassword(baru) {
  await jedaJaringan()
  if (gangguan.putus) throw galatJaringan()
  const u = sesiTersimpan()?.user
  const akun = AKUN_TIRUAN.find(a => a.id === u?.id)
  if (!akun) throw new Error('Auth session missing!')
  akun.password = baru   // hanya selama tab ini hidup; database tiruan tidak menyimpan password
}

export function onPemulihanPassword(handler) {
  pendengarPemulihan.add(handler)
  return () => pendengarPemulihan.delete(handler)
}

export async function signOut() {
  try { localStorage.removeItem(KUNCI_SESI) } catch (_) { /* abaikan */ }
  siarkanAuth('SIGNED_OUT')
}

// supabase-js mengirim SIGNED_IN tiap tab kembali terlihat. Ditiru, karena
// justru itulah pemicu bug di produksi.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && sesiTersimpan()) siarkanAuth('SIGNED_IN')
  })
}

function penggunaSekarang() {
  return sesiTersimpan()?.user || null
}

// === Saldo awal ===

export async function loadSaldoAwal() {
  const { data } = await bacaan(() => muat().config.saldo_awal)
  return data != null ? Number(data) || 0 : null
}

export async function saveSaldoAwal(value, jejak) {
  await tulisan(() => ubah(db => { db.config.saldo_awal = value }))
  siarkan({ tabel: 'config', jenis: 'upsert', value })
  catatJejak(jejak?.date || todayISO(), jejak)
}

// === Entries ===

const ringkas = (e) => ({ date: e.date, totalPenjualan: e.totalPenjualan || 0, gaji: e.gaji || 0, totalPengeluaran: e.totalPengeluaran || 0 })
const salin = (x) => JSON.parse(JSON.stringify(x))

export async function loadEntrySummaries() {
  return bacaan(() => {
    const map = {}
    Object.values(muat().entries).forEach(e => { map[e.date] = ringkas(e) })
    return map
  })
}

export async function loadEntryDetails() {
  return bacaan(() => salin(muat().entries))
}

export async function loadEntryDetail(date) {
  return bacaan(() => { const e = muat().entries[date]; return e ? salin(e) : null })
}

export async function saveEntry(entry, jejak) {
  await tulisan(() => ubah(db => { db.entries[entry.date] = salin(entry) }))
  siarkan({ tabel: 'entries', jenis: 'upsert', entry: salin(entry) })
  catatJejak(entry.date, jejak)
}

// Meniru fungsi server tambah_entri (kiriman_migration.sql): atomik, dan
// kiriman ulang dengan opId yang sama tidak ditambahkan dua kali. Kiriman
// tanpa opId (antrean lama) memakai jalur lama: baca, tumpuk, tulis.
export async function commitEntryAddition(date, input, jejak, opId) {
  let dobel = false
  const entry = await tulisan(() => ubah(db => {
    db.opDiterima = db.opDiterima || []
    if (opId && db.opDiterima.includes(opId)) { dobel = true; return db.entries[date] ? salin(db.entries[date]) : null }
    if (opId) db.opDiterima.push(opId)
    const lama = db.entries[date] || null
    const baru = accumulateEntry(lama, date, input)
    db.entries[date] = baru
    return salin(baru)
  }))
  if (dobel) return entry
  siarkan({ tabel: 'entries', jenis: 'upsert', entry })
  catatJejak(date, jejak)
  return entry
}

export async function deleteEntry(date, jejak) {
  await tulisan(() => ubah(db => { delete db.entries[date] }))
  siarkan({ tabel: 'entries', jenis: 'delete', date })
  catatJejak(date, jejak)
}

// === Voucher toko ===

export async function loadVoucherToko() {
  const r = await bacaan(() => salin(muat().voucher))
  return { ...r, kePemilikAda: true }
}

export async function saveVoucherToko(date, rows, jejak) {
  await tulisan(() => ubah(db => {
    db.voucher[date] = db.voucher[date] || {}
    rows.forEach(r => { db.voucher[date][r.tokoId] = { drop: r.drop, laku: r.laku, kePemilik: !!r.kePemilik } })
  }))
  rows.forEach(r => siarkan({ tabel: 'voucher_toko', jenis: 'upsert', date, tokoId: r.tokoId, cell: { drop: r.drop, laku: r.laku, kePemilik: !!r.kePemilik } }))
  catatJejak(date, jejak)
}

// === Pencocokan kas ===

export async function loadHitungKas() {
  const r = await bacaan(() => {
    const map = {}
    ;(muat().hitungKas || []).forEach(h => { (map[h.date] = map[h.date] || []).push(h) })
    return map
  })
  return { ...r, ada: true }
}

export async function simpanHitungKas({ date, oleh, sistem, fisik, catatan, waktu }) {
  const baris = await tulisan(() => ubah(db => {
    db.hitungKas = db.hitungKas || []
    db.idHitung = (db.idHitung || 0) + 1
    const h = { id: db.idHitung, date, waktu: waktu || new Date().toISOString(), oleh, sistem, fisik, selisih: fisik - sistem, catatan: catatan || '' }
    db.hitungKas.push(h)
    return h
  }))
  siarkan({ tabel: 'hitung_kas', jenis: 'insert', hitung: baris })
  return baris
}

// === Jejak ===

function catatJejak(date, jejak) {
  if (!jejak || gangguan.putus) return
  const u = penggunaSekarang()
  const baris = ubah(db => {
    const j = { id: db.idJejak++, date, aksi: jejak.aksi, oleh: jejak.oleh, email: jejak.email || null, rincian: jejak.rincian || {}, waktu: jejak.waktu, user_id: u?.id || null }
    db.jejak.push(j)
    return j
  })
  siarkan({ tabel: 'jejak', jenis: 'insert', jejak: baris })
}

export async function loadJejak() {
  return bacaan(() => {
    const map = {}
    muat().jejak
      .slice()
      .sort((a, b) => String(a.waktu).localeCompare(String(b.waktu)))
      .forEach(j => { (map[j.date] = map[j.date] || []).push(j) })
    return map
  })
}

// Sama persis dengan db.js — app memakainya untuk memilah galat.
export function isNetworkError(e) {
  if (!e) return false
  const m = String(e.message || e).toLowerCase()
  return m.includes('fetch') || m.includes('network') || m.includes('failed to fetch')
      || m.includes('timeout') || m.includes('load failed')
}

// === Realtime ===

const pendengarStatus = new Set()

export function subscribeRealtime({ onEntry, onSaldoAwal, onVoucher, onJejak, onHitung, onStatus }) {
  const f = (ev) => {
    if (gangguan.putus) return            // kanal yang mati tidak menerima apa pun
    if (ev.tabel === 'entries') onEntry?.(ev.jenis === 'delete' ? { type: 'delete', date: ev.date } : { type: 'upsert', entry: ev.entry })
    else if (ev.tabel === 'config') onSaldoAwal?.(Number(ev.value) || 0)
    else if (ev.tabel === 'voucher_toko') onVoucher?.({ type: ev.jenis, date: ev.date, tokoId: ev.tokoId, cell: ev.cell })
    else if (ev.tabel === 'jejak') onJejak?.(ev.jejak)
    else if (ev.tabel === 'hitung_kas') onHitung?.(ev.hitung)
  }
  pendengarRealtime.add(f)
  const st = (s) => onStatus?.(s)
  pendengarStatus.add(st)
  setTimeout(() => st(gangguan.putus ? 'offline' : 'online'), 50)
  return () => { pendengarRealtime.delete(f); pendengarStatus.delete(st) }
}

// === Panel kendali dari console ===
if (typeof window !== 'undefined') {
  window.__tiruan = {
    // __tiruan.putus(true) — semua panggilan gagal; false — sambung lagi
    putus(nyala = true) {
      gangguan.putus = !!nyala
      try { localStorage.setItem(KUNCI_PUTUS, nyala ? '1' : '0') } catch (_) { /* abaikan */ }
      pendengarStatus.forEach(f => f(nyala ? 'offline' : 'online'))
      return 'jaringan ' + (nyala ? 'PUTUS' : 'tersambung')
    },
    // __tiruan.hilangkanBalasan(1) — tulisan berikutnya tersimpan, tapi app
    // menerima "Failed to fetch". Untuk menguji kiriman ganda (RENCANA 1.3).
    hilangkanBalasan(n = 1) { gangguan.hilangBalasan = n; return n + ' balasan tulisan berikutnya akan hilang' },
    // __tiruan.tolak(1) — tulisan berikutnya ditolak server (RENCANA 1.4)
    tolak(n = 1) { gangguan.tolak = n; return n + ' tulisan berikutnya akan ditolak' },
    // __tiruan.kirimAuth() — event auth dengan objek sesi baru, seperti yang
    // dikirim supabase-js saat token diperbarui (RENCANA 1.1).
    kirimAuth(jenis = 'TOKEN_REFRESHED') { siarkanAuth(jenis); return 'terkirim: ' + jenis },
    // __tiruan.bukaTautanPassword() — seolah tautan "lupa password" di email
    // dibuka: masuk sebagai pemilik lalu tampilkan formulir password baru.
    bukaTautanPassword() {
      try { localStorage.setItem(KUNCI_SESI, JSON.stringify(sesiUntuk(AKUN_TIRUAN[0]))) } catch (_) { /* abaikan */ }
      siarkanAuth('SIGNED_IN')
      pendengarPemulihan.forEach(f => f())
      return 'formulir password baru seharusnya tampil'
    },
    // __tiruan.lambat(2000) — jeda jaringan dalam ms
    lambat(ms = 1500) { gangguan.jeda = [ms, ms]; return 'jeda ' + ms + ' ms' },
    // __tiruan.reset() — buang semua data tiruan dan bibit ulang
    reset() { try { localStorage.removeItem(KUNCI_DB) } catch (_) { /* abaikan */ } muat(); return 'dibibit ulang — muat ulang halaman' },
    // __tiruan.isi() — lihat isi database tiruan
    isi() { return muat() },
    akun: AKUN_TIRUAN.map(a => a.email + ' / ' + a.password),
  }
}
