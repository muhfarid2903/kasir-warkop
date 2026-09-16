import { createClient } from '@supabase/supabase-js'

// Satu-satunya file yang menyentuh Supabase. Komponen tidak pernah memanggil
// sb.from(...) atau sb.auth langsung — supaya kalau nanti mau menambah retry,
// antrian offline, atau ganti backend, cukup satu tempat yang diubah, bukan
// delapan pemanggilan yang tersebar di dalam handler tombol.

// === Konfigurasi Supabase ===
// Ganti dua nilai di bawah dengan milik project Supabase Anda.
// Dapatkan di: Supabase Dashboard → Project Settings → API
const SUPABASE_URL      = "https://rhhothozowdxpxeotlad.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJoaG90aG96b3dkeHB4ZW90bGFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMTk1MTYsImV4cCI6MjA5MjY5NTUxNn0.d9U1vvJNTjbVSvV83scDD_RXyHtNcXFvG40uBKgsNpk"

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
  return { drop: Number(row.drop_qty) || 0, laku: Number(row.laku_qty) || 0 }
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

// === Saldo awal (tabel config) ===

// null = belum pernah diisi; pemanggil membiarkan nilai lamanya.
export async function loadSaldoAwal() {
  const { data } = await sb.from('config').select('value').eq('key', 'saldo_awal').maybeSingle()
  return data?.value != null ? Number(data.value) || 0 : null
}

export async function saveSaldoAwal(value) {
  if (!sb) return
  const { error } = await sb.from('config').upsert({ key: 'saldo_awal', value }, { onConflict: 'key' })
  if (error) throw error
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

export async function saveEntry(entry) {
  if (!sb) return
  const { error } = await sb.from('entries').upsert(entryToRow(entry), { onConflict: 'date' })
  if (error) throw error
}

export async function deleteEntry(date) {
  if (!sb) return
  const { error } = await sb.from('entries').delete().eq('date', date)
  if (error) throw error
}

// === Voucher Toko ===

// Opsional: error dikembalikan apa adanya supaya pemanggil bisa mengabaikannya
// kalau tabelnya memang belum ada di project Supabase yang lebih lama.
export async function loadVoucherToko() {
  // Kolom disebut satu per satu, bukan '*': updated_at tidak pernah dibaca app
  // tapi menyumbang 10,8 KB dari 26,3 KB yang ditarik tiap login.
  const { data, error } = await sb.from('voucher_toko').select('date,toko_id,drop_qty,laku_qty')
  if (error) return { data: null, error }
  const map = {}
  ;(data || []).forEach(r => {
    if (!map[r.date]) map[r.date] = {}
    map[r.date][r.toko_id] = voucherCell(r)
  })
  return { data: map, error: null }
}

// rows berbentuk UI: [{ tokoId, drop, laku }] untuk satu tanggal.
export async function saveVoucherToko(date, rows) {
  if (!sb) return
  const payload = rows.map(r => ({
    date,
    toko_id: r.tokoId,
    drop_qty: r.drop,
    laku_qty: r.laku,
  }))
  const { error } = await sb.from('voucher_toko').upsert(payload, { onConflict: 'date,toko_id' })
  if (error) throw error
}

// === Realtime ===

// Satu channel untuk ketiga tabel. Payload mentah Supabase (payload.new,
// drop_qty, eventType) diterjemahkan di sini juga, supaya komponen cuma
// menerima bentuk yang sudah dikenalnya.
// Mengembalikan fungsi untuk berhenti berlangganan.
export function subscribeRealtime({ onEntry, onSaldoAwal, onVoucher }) {
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
    .subscribe()
  return () => sb.removeChannel(ch)
}
