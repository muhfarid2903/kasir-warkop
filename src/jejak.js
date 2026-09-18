import { PRODUCTS, TOKO } from './model.js'
import { IDR, MO } from './format.js'

// Siapa menginput apa, kapan. Fungsi murni: tidak menyentuh jaringan maupun
// React — yang menulis barisnya db.js, yang menampilkannya Riwayat.
//
// Jejak dibuat SAAT tombol ditekan, bukan saat barisnya sampai server. WiFi
// warkop sering putus dan kiriman bisa menyusul berjam-jam kemudian; yang
// ditanya orang tetap "siapa input jam berapa", bukan "kapan HP-nya dapat
// sinyal lagi". Karena itu `waktu` ikut dititipkan bersama kirimannya.
//
// Kolom `date` = tanggal DATA yang disentuh, bukan tanggal orang menyentuhnya.
// Mengedit entri kemarin dari hari ini tetap meninggalkan jejak di baris
// kemarin — di situlah orang mencarinya.

const namaProduk = (id) => PRODUCTS.find(p => p.id === id)?.name || id
const namaToko   = (id) => TOKO.find(t => t.id === id)?.name || id

// Nama tampil. Email penuh terlalu panjang untuk baris riwayat, jadi yang
// dipakai metadata `nama` kalau ada (diisi lewat Supabase Dashboard →
// Authentication → user → User Metadata), kalau tidak bagian depan email.
export function namaPengguna(session) {
  const u = session?.user
  if (!u) return 'Tanpa nama'
  const m = u.user_metadata || {}
  const nama = m.nama || m.name || m.full_name
  if (nama) return String(nama).trim()
  const email = u.email || ''
  return email.split('@')[0] || 'Tanpa nama'
}

// Tanda tangan satu kiriman. Ikut masuk antrean outbox apa adanya, jadi
// bentuknya harus bisa di-JSON-kan.
export function tandaJejak(session, aksi, rincian) {
  return {
    aksi,
    oleh: namaPengguna(session),
    email: session?.user?.email || null,
    rincian: rincian || {},
    waktu: new Date().toISOString(),
  }
}

// === Rincian per jenis aksi ===

// Input Hari Ini: yang dicatat cuma yang benar-benar diisi. Nol tidak ditulis
// supaya baris jejaknya sependek kalimat, bukan sepanjang katalog.
export function rincianTambah({ quantities, expenses, cashIns }) {
  const qty = {}
  PRODUCTS.forEach(p => { const n = quantities?.[p.id] || 0; if (n > 0) qty[p.id] = n })
  const dipakai = (x) => (x.amount || 0) > 0 || (x.desc || '').trim() !== ''
  const bariskan = (xs) => (xs || []).filter(dipakai).map(x => ({ ket: (x.desc || '').trim(), jumlah: x.amount || 0 }))
  return { qty, keluar: bariskan(expenses), masuk: bariskan(cashIns) }
}

const angkaEntri = (e) => ({
  penjualan: e?.totalPenjualan || 0,
  gaji: e?.gaji || 0,
  pengeluaran: e?.totalPengeluaran || 0,
})

// Edit mengganti nilai, jadi yang berguna dicatat bukan hasil akhirnya saja
// melainkan angka sebelum & sesudah — "berubah dari berapa jadi berapa"
// itulah yang ditanya kalau kas tidak cocok.
export function rincianUbah(sebelum, sesudah) {
  return { sebelum: angkaEntri(sebelum), sesudah: angkaEntri(sesudah) }
}

export function rincianHapus(entry) {
  return { sebelum: angkaEntri(entry) }
}

// Apakah edit ini benar-benar mengubah sesuatu? Tombol Simpan Perubahan bisa
// ditekan tanpa satu pun kolom disentuh — itu tidak layak jadi baris jejak.
// Keterangan pengeluaran ikut dibandingkan: memperbaiki ketikan memang tidak
// menggeser angka, tapi tetap perubahan yang pernah terjadi.
export function entriBerubah(sebelum, sesudah) {
  const ringkas = (e) => {
    const q = e?.quantities || {}
    const kunci = [...new Set([...PRODUCTS.map(p => p.id), ...Object.keys(q)])].sort()
    return JSON.stringify({
      q: kunci.map(id => q[id] || 0),
      x: (e?.expenses || []).map(i => [i.type || '', (i.desc || '').trim(), i.amount || 0]),
    })
  }
  return ringkas(sebelum) !== ringkas(sesudah)
}

// Voucher disimpan lima toko sekaligus tiap kali tombol ditekan, padahal
// biasanya cuma satu yang berubah. Yang dicatat hanya yang berubah; kalau
// tidak ada yang berubah sama sekali, null — simpan yang tidak mengubah apa
// pun tidak layak jadi baris jejak.
export function rincianVoucher(rows, sebelum) {
  const berubah = (rows || []).filter(r => {
    const p = (sebelum || {})[r.tokoId] || { drop: 0, laku: 0 }
    return (p.drop || 0) !== (r.drop || 0) || (p.laku || 0) !== (r.laku || 0)
  })
  if (berubah.length === 0) return null
  return { toko: berubah.map(r => ({ id: r.tokoId, drop: r.drop || 0, laku: r.laku || 0 })) }
}

// === Untuk ditampilkan ===

export const LABEL_AKSI = {
  tambah:  'Input',
  ubah:    'Edit',
  hapus:   'Hapus',
  voucher: 'Voucher',
  saldo:   'Saldo awal',
}

export const IKON_AKSI = {
  tambah:  'coffee',
  ubah:    'pencil',
  hapus:   'trash',
  voucher: 'signal',
  saldo:   'coins',
}

// Jam lokal. Sengaja bukan toLocaleTimeString: hasilnya berbeda-beda antar HP
// (14.32 / 14:32 / 2:32 PM), dan kolom jam yang lebarnya berubah-ubah bikin
// daftar jejak terlihat goyang.
export function jamJejak(waktu) {
  const d = new Date(waktu)
  if (isNaN(d.getTime())) return ''
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
}

// "14 Sep 10:32" — dipakai jejak yang berdiri di luar baris harinya (saldo
// awal), yang tanggalnya perlu ikut disebut.
export function tglJejak(waktu) {
  const d = new Date(waktu)
  if (isNaN(d.getTime())) return ''
  return d.getDate() + ' ' + MO[d.getMonth()] + ' ' + jamJejak(waktu)
}

// Satu kalimat pendek: apa yang orang ini lakukan pada hari itu.
export function ringkasJejak(j) {
  const r = j?.rincian || {}
  switch (j?.aksi) {
    case 'tambah': {
      const bagian = []
      Object.keys(r.qty || {}).forEach(id => { const n = r.qty[id]; if (n > 0) bagian.push(n + ' ' + namaProduk(id)) })
      ;(r.keluar || []).forEach(x => bagian.push('−' + IDR(x.jumlah) + ' ' + (x.ket || 'pengeluaran')))
      ;(r.masuk  || []).forEach(x => bagian.push('+' + IDR(x.jumlah) + ' ' + (x.ket || 'cash masuk')))
      return bagian.join(' · ') || 'tidak ada isinya'
    }
    case 'ubah': {
      const a = r.sebelum || {}, b = r.sesudah || {}
      const ubah = []
      const banding = (label, x, y) => { if ((x || 0) !== (y || 0)) ubah.push(label + ' ' + IDR(x || 0) + ' → ' + IDR(y || 0)) }
      banding('penjualan', a.penjualan, b.penjualan)
      banding('gaji', a.gaji, b.gaji)
      banding('pengeluaran', a.pengeluaran, b.pengeluaran)
      // Keterangan pengeluaran bisa diperbaiki tanpa satu angka pun bergeser;
      // jangan diam-diam, tapi jangan pula mengarang selisih yang tidak ada.
      return ubah.length ? ubah.join(' · ') : 'rincian dirapikan, angka tidak berubah'
    }
    case 'hapus': {
      const a = r.sebelum || {}
      return 'menghapus data hari ini' + (a.penjualan ? ' (penjualan ' + IDR(a.penjualan) + ')' : '')
    }
    case 'voucher': {
      const t = (r.toko || []).map(x => {
        const p = []
        if (x.drop) p.push('drop ' + x.drop)
        if (x.laku) p.push('laku ' + x.laku)
        return namaToko(x.id) + (p.length ? ' ' + p.join(', ') : ' dikosongkan')
      })
      return t.length ? t.join(' · ') : 'voucher toko'
    }
    case 'saldo':
      return 'saldo awal jadi ' + IDR(r.nilai || 0)
    default:
      return j?.aksi || '—'
  }
}

// Siapa saja yang menyentuh satu hari, beserta berapa kali. Urut dari yang
// paling banyak menginput.
export function pelakuHari(list) {
  const hitung = new Map()
  ;(list || []).forEach(j => {
    const nama = j?.oleh || 'Tanpa nama'
    hitung.set(nama, (hitung.get(nama) || 0) + 1)
  })
  return [...hitung.entries()]
    .map(([nama, jumlah]) => ({ nama, jumlah }))
    .sort((a, b) => b.jumlah - a.jumlah || a.nama.localeCompare(b.nama))
}

// Satu sel CSV: "Jaya (3×), Farid (1×)".
export function ringkasPelaku(list) {
  return pelakuHari(list).map(p => p.nama + ' (' + p.jumlah + '×)').join(', ')
}

// Jejak terakhir yang mengubah saldo awal — dipakai bar Saldo Awal di Riwayat,
// karena saldo tidak punya baris harinya sendiri untuk ditumpangi.
export function jejakSaldoTerakhir(jejak) {
  let terakhir = null
  Object.keys(jejak || {}).forEach(d => {
    (jejak[d] || []).forEach(j => {
      if (j.aksi !== 'saldo') return
      if (!terakhir || String(j.waktu) > String(terakhir.waktu)) terakhir = j
    })
  })
  return terakhir
}

// Apakah layar ini memuat lebih dari satu orang? Nama penginput cuma berguna
// kalau memang ada yang dibedakan — di warkop yang penjaganya satu orang,
// mencantumkannya di tiap baris cuma jadi derau. (Detailnya tetap menyimpan
// jejaknya, yang disembunyikan hanya chip di baris ringkas.)
export function banyakPenginput(jejak) {
  const nama = new Set()
  Object.keys(jejak || {}).forEach(d => (jejak[d] || []).forEach(j => nama.add(j?.oleh || 'Tanpa nama')))
  return nama.size > 1
}
