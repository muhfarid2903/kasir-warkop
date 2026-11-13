import { createClient } from '@supabase/supabase-js'
import { accumulateEntry, selisihInput, todayISO } from './model.js'

// Satu-satunya file yang menyentuh Supabase. Komponen tidak pernah memanggil
// sb.from(...) atau sb.auth langsung — supaya kalau nanti mau menambah retry,
// antrian offline, atau ganti backend, cukup satu tempat yang diubah, bukan
// delapan pemanggilan yang tersebar di dalam handler tombol.

// === Konfigurasi Supabase ===
// Nilainya di berkas .env (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY), dari
// Supabase Dashboard → Project Settings → API. Dipindah dari sini supaya
// `npm run dev` tidak lagi otomatis tersambung ke database produksi: dev
// memakai src/db.tiruan.js, dan berkas ini hanya ikut saat build atau
// `npm run dev:asli` (lihat vite.config.js).
const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Pasangan db.tiruan.js. Di sini selalu kosong/salah — yang dipakai app untuk
// memasang pita "DATA TIRUAN" dan petunjuk akun di layar masuk.
export const modeTiruan = false
export const AKUN_TIRUAN = []

export const supabaseReady =
  SUPABASE_URL.startsWith("http") &&
  SUPABASE_ANON_KEY.length > 20 &&
  !SUPABASE_URL.includes("GANTI_") &&
  !SUPABASE_ANON_KEY.includes("GANTI_")

const sb = supabaseReady
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null

// === Mapper baris DB <-> bentuk yang dipakai UI ===
// Nama kolom (total_penjualan, drop_qty, …) berhenti di file ini. Di atas
// lapisan ini yang beredar cuma bentuk UI: { totalPenjualan }, { drop, laku }.

function rowToEntry(row) {
  return {
    date: row.date,
    quantities: row.quantities || {},
    expenses: row.expenses || [],
    totalPenjualan: Number(row.total_penjualan) || 0,
    gaji: Number(row.gaji) || 0,
    totalPengeluaran: Number(row.total_pengeluaran) || 0,
    sisaKas: Number(row.sisa_kas) || 0,
  }
}

// Baris ringan: hanya kolom angka, tanpa JSON quantities/expenses. Sengaja
// TIDAK memuat kunci quantities/expenses sama sekali — supaya kode yang butuh
// detail gagal terang-terangan, bukan diam-diam membaca {} dan menampilkan nol.
function rowToSummary(row) {
  return {
    date: row.date,
    totalPenjualan: Number(row.total_penjualan) || 0,
    gaji: Number(row.gaji) || 0,
    totalPengeluaran: Number(row.total_pengeluaran) || 0,
  }
}

function entryToRow(e) {
  return {
    date: e.date,
    quantities: e.quantities || {},
    expenses: e.expenses || [],
    total_penjualan: e.totalPenjualan || 0,
    gaji: e.gaji || 0,
    total_pengeluaran: e.totalPengeluaran || 0,
    sisa_kas: e.sisaKas || 0,
  }
}

function voucherCell(row) {
  return { drop: Number(row.drop_qty) || 0, laku: Number(row.laku_qty) || 0, kePemilik: !!row.ke_pemilik }
}

// Kolom/tabel yang belum ada karena migrasinya belum dijalankan. Galat ini
// berarti "fiturnya belum tersedia", bukan "data rusak".
function belumAda(error, nama) {
  if (!error) return false
  const kode = String(error.code || '')
  const m = String(error.message || '')
  return kode === '42703' || kode === 'PGRST204' || kode === '42P01' || kode === 'PGRST205'
    || (nama && m.includes(nama) && /does not exist|could not find/i.test(m))
}

// === Auth ===

export async function getSession() {
  if (!sb) return null
  const { data } = await sb.auth.getSession()
  return data.session || null
}

// Mengembalikan fungsi untuk berhenti mendengarkan.
export function onAuthChange(handler) {
  if (!sb) return () => {}
  const { data: sub } = sb.auth.onAuthStateChange((_e, s) => handler(s || null))
  return () => sub.subscription.unsubscribe()
}

// Tidak ada signUp di sini dengan sengaja: pendaftaran publik dimatikan di
// Supabase, dan fungsi yang dipanggil pun cuma akan ditolak server. Akun baru
// dibuat lewat Supabase Dashboard → Authentication → Add user.
export async function signIn(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data.session
}

export async function signOut() {
  if (!sb) return
  await sb.auth.signOut()
}

// Lupa password: Supabase mengirim email berisi tautan kembali ke situs ini.
// Begitu tautan itu dibuka, supabase-js memancarkan PASSWORD_RECOVERY dan app
// menampilkan formulir password baru (lihat onPemulihanPassword).
// Syarat di Dashboard: Authentication → URL Configuration → Site URL / Redirect
// URLs memuat alamat app ini.
export async function kirimTautanPassword(email) {
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
  if (error) throw error
}

export async function gantiPassword(baru) {
  const { error } = await sb.auth.updateUser({ password: baru })
  if (error) throw error
}

export function onPemulihanPassword(handler) {
  if (!sb) return () => {}
  const { data: sub } = sb.auth.onAuthStateChange((e) => { if (e === 'PASSWORD_RECOVERY') handler() })
  return () => sub.subscription.unsubscribe()
}

// === Saldo awal (tabel config) ===

// null = belum pernah diisi; pemanggil membiarkan nilai lamanya.
export async function loadSaldoAwal() {
  const { data } = await sb.from('config').select('value').eq('key', 'saldo_awal').maybeSingle()
  return data?.value != null ? Number(data.value) || 0 : null
}

export async function saveSaldoAwal(value, jejak) {
  if (!sb) return
  const { error } = await sb.from('config').upsert({ key: 'saldo_awal', value }, { onConflict: 'key' })
  if (error) throw error
  // Saldo awal tidak punya tanggalnya sendiri; dititipkan ke tanggal saat
  // tombol ditekan, supaya tetap punya tempat di urutan waktu.
  await catatJejak(jejak?.date || todayISO(), jejak)
}

// === Entries ===

// Dua tingkat, karena kolom JSON (quantities + expenses) adalah 34,6 KB dari
// 47,8 KB yang dulu ditarik tiap login — padahal yang butuh isinya cuma tab
// Riwayat dan form simpan. Muat awal ambil kolom angka saja; detailnya
// menyusul kalau memang diminta.

// Mengembalikan { data, error }, bukan melempar: pemanggil membedakan gagal
// muat (badge Offline) dari tabel kosong, dan keduanya bukan kondisi fatal.
export async function loadEntrySummaries() {
  const { data, error } = await sb.from('entries').select('date,total_penjualan,gaji,total_pengeluaran')
  if (error) return { data: null, error }
  const map = {}
  ;(data || []).forEach(r => { const e = rowToSummary(r); map[e.date] = e })
  return { data: map, error: null }
}

// Seluruh entri lengkap — dipanggil saat tab Riwayat dibuka.
export async function loadEntryDetails() {
  const { data, error } = await sb.from('entries').select('*')
  if (error) return { data: null, error }
  const map = {}
  ;(data || []).forEach(r => { const e = rowToEntry(r); map[e.date] = e })
  return { data: map, error: null }
}

// Satu entri lengkap — dipakai Hari Ini, yang cuma perlu tanggal terpilih.
// null = tanggal itu memang belum punya entri.
export async function loadEntryDetail(date) {
  const { data, error } = await sb.from('entries').select('*').eq('date', date).maybeSingle()
  if (error) return { data: null, error }
  return { data: data ? rowToEntry(data) : null, error: null }
}

export async function saveEntry(entry, jejak) {
  if (!sb) return
  const { error } = await sb.from('entries').upsert(entryToRow(entry), { onConflict: 'date' })
  if (error) throw error
  await catatJejak(entry.date, jejak)
}

// Menambah input ke entri satu tanggal.
//
// Jalur utama: fungsi database tambah_entri (kiriman_migration.sql) — satu
// langkah atomik, dan kiriman ulang dengan opId yang sama tidak ditambahkan
// dua kali. Tanpa itu, simpan yang balasannya hilang di WiFi putus-nyambung
// akan diantre lalu dikirim ulang, dan penjualannya tercatat ganda.
//
// Jalur lama (baca → tumpuk → tulis) masih dipakai kalau fungsinya belum ada
// di server, atau untuk kiriman lama di antrean yang belum punya opId.
let rpcTambahAda = true

export async function commitEntryAddition(date, input, jejak, opId) {
  if (opId && rpcTambahAda) {
    const s = selisihInput(date, input)
    const { data, error } = await sb.rpc('tambah_entri', {
      p_op_id: opId,
      p_date: date,
      p_qty: s.quantities,
      p_expenses: s.expenses,
      p_penjualan: s.totalPenjualan,
      p_gaji: s.gaji,
      p_pengeluaran: s.totalPengeluaran,
      p_jejak: jejak || {},
    })
    if (!error) return data ? rowToEntry(data) : null
    // PGRST202 = fungsi tidak ditemukan: migrasinya belum dijalankan.
    if (error.code === 'PGRST202' || /could not find the function/i.test(error.message || '')) rpcTambahAda = false
    else throw error
  }
  const { data: existing, error } = await loadEntryDetail(date)
  if (error) throw error
  const entry = accumulateEntry(existing, date, input)
  await saveEntry(entry, jejak)
  return entry
}

export async function deleteEntry(date, jejak) {
  if (!sb) return
  const { error } = await sb.from('entries').delete().eq('date', date)
  if (error) throw error
  await catatJejak(date, jejak)
}

// === Voucher Toko ===

// Opsional: error dikembalikan apa adanya supaya pemanggil bisa mengabaikannya
// kalau tabelnya memang belum ada di project Supabase yang lebih lama.
// Apakah kolom ke_pemilik sudah ada (kas_pemilik_migration.sql)? Ditebak ya;
// galat "kolom tidak ada" yang pertama mengubahnya.
let kePemilikAda = true

export async function loadVoucherToko() {
  // Kolom disebut satu per satu, bukan '*': updated_at tidak pernah dibaca app
  // tapi menyumbang 10,8 KB dari 26,3 KB yang ditarik tiap login.
  let { data, error } = await sb.from('voucher_toko').select(kePemilikAda ? 'date,toko_id,drop_qty,laku_qty,ke_pemilik' : 'date,toko_id,drop_qty,laku_qty')
  if (error && kePemilikAda && belumAda(error, 'ke_pemilik')) {
    kePemilikAda = false
    ;({ data, error } = await sb.from('voucher_toko').select('date,toko_id,drop_qty,laku_qty'))
  }
  if (error) return { data: null, error, kePemilikAda }
  const map = {}
  ;(data || []).forEach(r => {
    if (!map[r.date]) map[r.date] = {}
    map[r.date][r.toko_id] = voucherCell(r)
  })
  return { data: map, error: null, kePemilikAda }
}

// rows berbentuk UI: [{ tokoId, drop, laku, kePemilik }] untuk satu tanggal.
export async function saveVoucherToko(date, rows, jejak) {
  if (!sb) return
  const bentuk = (denganKePemilik) => rows.map(r => ({
    date,
    toko_id: r.tokoId,
    drop_qty: r.drop,
    laku_qty: r.laku,
    ...(denganKePemilik ? { ke_pemilik: !!r.kePemilik } : {}),
  }))
  let { error } = await sb.from('voucher_toko').upsert(bentuk(kePemilikAda), { onConflict: 'date,toko_id' })
  if (error && kePemilikAda && belumAda(error, 'ke_pemilik')) {
    kePemilikAda = false
    ;({ error } = await sb.from('voucher_toko').upsert(bentuk(false), { onConflict: 'date,toko_id' }))
  }
  if (error) throw error
  await catatJejak(date, jejak)
}

// === Pencocokan kas (tabel hitung_kas, kas_pemilik_migration.sql) ===

// { data: { [tanggal]: [baris…] }, error, ada } — ada=false berarti tabelnya
// belum dibuat; tombol Cocokkan kas disembunyikan.
export async function loadHitungKas() {
  const { data, error } = await sb.from('hitung_kas').select('id,date,waktu,oleh,sistem,fisik,selisih,catatan').order('waktu', { ascending: true })
  if (error) return { data: null, error, ada: !belumAda(error, 'hitung_kas') }
  const map = {}
  ;(data || []).forEach(r => { (map[r.date] = map[r.date] || []).push(rowToHitung(r)) })
  return { data: map, error: null, ada: true }
}

function rowToHitung(r) {
  return { id: r.id, date: r.date, waktu: r.waktu, oleh: r.oleh, sistem: Number(r.sistem) || 0, fisik: Number(r.fisik) || 0, selisih: Number(r.selisih ?? (r.fisik - r.sistem)) || 0, catatan: r.catatan || '' }
}

export async function simpanHitungKas({ date, oleh, sistem, fisik, catatan, waktu }) {
  const { data, error } = await sb.from('hitung_kas').insert({ date, oleh, sistem, fisik, catatan: catatan || null, waktu }).select().single()
  if (error) throw error
  return rowToHitung(data)
}

// === Jejak input ===

// Siapa menginput apa, kapan. Bentuk barisnya lihat jejak_migration.sql;
// isinya disusun src/jejak.js, file ini cuma mengantar.

function rowToJejak(row) {
  return {
    id: row.id,
    date: row.date,
    aksi: row.aksi,
    oleh: row.oleh,
    email: row.email,
    rincian: row.rincian || {},
    waktu: row.waktu,
  }
}

// Menulis jejak TIDAK boleh menggagalkan tulisan uangnya. Kalau insert ini
// dibiarkan melempar, kiriman yang uangnya sudah masuk akan dianggap gagal
// lalu diulang dari antrean — dan penjualannya tercatat dua kali. Kehilangan
// satu baris jejak jauh lebih murah daripada itu.
//
// Ikut diam pula kalau tabelnya memang belum dibuat: app lama yang belum
// dimigrasikan tetap jalan, jejaknya saja yang kosong.
async function catatJejak(date, jejak) {
  if (!sb || !jejak) return
  try {
    await sb.from('jejak').insert({
      date,
      aksi: jejak.aksi,
      oleh: jejak.oleh,
      email: jejak.email || null,
      rincian: jejak.rincian || {},
      waktu: jejak.waktu,
    })
  } catch (_) {}
}

// Seluruh jejak, dikelompokkan per tanggal dan urut waktu. Dipanggil saat tab
// Riwayat dibuka — halaman lain tidak menampilkannya, jadi tidak perlu ikut
// ditarik saat login.
export async function loadJejak() {
  const { data, error } = await sb
    .from('jejak')
    .select('id,date,aksi,oleh,email,rincian,waktu')
    .order('waktu', { ascending: true })
  if (error) return { data: null, error }
  const map = {}
  ;(data || []).forEach(r => {
    const j = rowToJejak(r)
    if (!map[j.date]) map[j.date] = []
    map[j.date].push(j)
  })
  return { data: map, error: null }
}

// === Laporan galat (galat_migration.sql) ===
// Sebisanya: tabel belum ada, tanpa sinyal, atau belum masuk — diam saja.
// Laporan galat yang ikut gagal tidak boleh memunculkan galat baru.
export async function catatGalat(laporan) {
  if (!sb) return
  try { await sb.from('galat').insert(laporan) } catch (_) {}
}

// === Cadangan lengkap ===
// Seluruh isi tabel app, mentah (nama kolom database), untuk diunduh sebagai
// JSON dan — kalau perlu — dipulihkan dengan scripts/cadangan-ke-sql.mjs.
// Paket gratis Supabase tidak punya cadangan otomatis; ini satu-satunya.
// Tabel opsional yang belum ada dilewati, bukan menggagalkan seluruhnya.
export async function unduhCadangan() {
  const tabel = { entries: 'date', voucher_toko: 'date', config: 'key', jejak: 'id', hitung_kas: 'id' }
  const isi = {}
  for (const [nama, urut] of Object.entries(tabel)) {
    const { data, error } = await sb.from(nama).select('*').order(urut, { ascending: true })
    if (error) {
      if (nama === 'entries' || nama === 'config') throw error   // wajib ada
      continue
    }
    isi[nama] = data
  }
  return { app: 'kasir-warkop', versi: 1, dibuat: new Date().toISOString(), tabel: isi }
}

// Apakah kegagalan ini karena jaringan, bukan karena datanya ditolak?
// Dipakai memutuskan menyalakan badge Offline atau tidak.
export function isNetworkError(e) {
  if (!e) return false
  const m = String(e.message || e).toLowerCase()
  return m.includes('fetch') || m.includes('network') || m.includes('failed to fetch')
      || m.includes('timeout') || m.includes('load failed')
}

// === Realtime ===

// Satu channel untuk ketiga tabel. Payload mentah Supabase (payload.new,
// drop_qty, eventType) diterjemahkan di sini juga, supaya komponen cuma
// menerima bentuk yang sudah dikenalnya.
// Mengembalikan fungsi untuk berhenti berlangganan.
export function subscribeRealtime({ onEntry, onSaldoAwal, onVoucher, onJejak, onHitung, onStatus }) {
  if (!sb) return () => {}
  const ch = sb.channel('rt-entries')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'entries' }, payload => {
      if (payload.eventType === 'DELETE') {
        const date = payload.old?.date
        if (date) onEntry({ type: 'delete', date })
      } else {
        onEntry({ type: 'upsert', entry: rowToEntry(payload.new) })
      }
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'config' }, payload => {
      if (payload.new?.key === 'saldo_awal') onSaldoAwal(Number(payload.new.value) || 0)
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'voucher_toko' }, payload => {
      if (payload.eventType === 'DELETE') {
        const date = payload.old?.date, tokoId = payload.old?.toko_id
        if (date) onVoucher({ type: 'delete', date, tokoId })
      } else {
        const r = payload.new
        onVoucher({ type: 'upsert', date: r.date, tokoId: r.toko_id, cell: voucherCell(r) })
      }
    })
    // Tanpa callback ini, channel yang mati (WiFi warkop putus) tidak
    // memberi tanda apa pun: layar terus menampilkan angka basi sambil
    // terlihat normal. Untuk pembukuan, diam-diam salah lebih berbahaya
    // daripada jelas-jelas mati.
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') onStatus?.('online')
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') onStatus?.('offline')
    })

  // Jejak sengaja di channel sendiri, bukan menumpang yang di atas: di project
  // yang tabel jejak-nya belum dibuat, binding-nya ditolak server dan seluruh
  // channel ikut mati — entries pun berhenti realtime, hanya karena sebuah
  // catatan tambahan. Statusnya juga tidak ikut menyalakan badge Offline:
  // kasir tidak perlu dibuat cemas oleh tabel yang cuma menyimpan riwayat.
  const chJejak = sb.channel('rt-jejak')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'jejak' }, payload => {
      if (payload.new) onJejak?.(rowToJejak(payload.new))
    })
    .subscribe()

  // Pencocokan kas juga di kanal sendiri, dengan alasan yang sama: tabelnya
  // opsional.
  const chHitung = sb.channel('rt-hitung-kas')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'hitung_kas' }, payload => {
      if (payload.new) onHitung?.(rowToHitung(payload.new))
    })
    .subscribe()

  return () => { sb.removeChannel(ch); sb.removeChannel(chJejak); sb.removeChannel(chHitung) }
}
