import { describe, it, expect, beforeEach, vi } from 'vitest'

// db.js disulih: jaringannya bisa dimatikan sesuka hati, dan tidak ada
// satu pun panggilan sungguhan ke Supabase.
const keadaan = { online: true, tolakSaldo: false, sesiHabis: false, terkirim: [] }

class NetErr extends Error { constructor(){ super('Failed to fetch') } }
const cekJaringan = () => {
  if (!keadaan.online) throw new NetErr()
  if (keadaan.sesiHabis) { const e = new Error('JWT expired'); e.code = 'PGRST301'; throw e }
}

vi.mock('../db.js', () => ({
  isNetworkError: (e) => String(e?.message || e).toLowerCase().includes('fetch'),
  commitEntryAddition: async (date, input) => { cekJaringan(); keadaan.terkirim.push(['tambahEntri', date, input.quantities?.vietnam ?? 0]) },
  deleteEntry:         async (date) => { cekJaringan(); keadaan.terkirim.push(['hapusEntri', date]) },
  saveVoucherToko:     async (date, rows) => { cekJaringan(); keadaan.terkirim.push(['simpanVoucher', date, rows.length]) },
  saveSaldoAwal:       async (v) => {
    cekJaringan()
    if (keadaan.tolakSaldo) throw new Error('duplicate key violates unique constraint')
    keadaan.terkirim.push(['simpanSaldo', v])
  },
}))

vi.mock('../galat.js', () => ({ laporkanGagalSimpan: () => {} }))

const { kirimAtauAntre, flushOutbox, outboxSize, clearOutbox, onOutboxChange, onGagalChange, daftarGagal, cobaLagiGagal, buangGagal, isGalatSesi } = await import('../outbox.js')

beforeEach(() => {
  keadaan.online = true; keadaan.tolakSaldo = false; keadaan.sesiHabis = false; keadaan.terkirim = []
  clearOutbox()
})

describe('saat jaringan hidup', () => {
  it('langsung terkirim, tidak masuk antrean', async () => {
    const hasil = await kirimAtauAntre({ type:'tambahEntri', date:'2026-09-17', input:{ quantities:{ vietnam:1 } } })
    expect(hasil).toBe('terkirim')
    expect(outboxSize()).toBe(0)
    expect(keadaan.terkirim).toHaveLength(1)
  })
})

describe('saat jaringan mati', () => {
  it('masuk antrean dan TIDAK sampai ke server', async () => {
    keadaan.online = false
    expect(await kirimAtauAntre({ type:'tambahEntri', date:'2026-09-17', input:{ quantities:{ vietnam:2 } } })).toBe('diantre')
    expect(outboxSize()).toBe(1)
    expect(keadaan.terkirim).toHaveLength(0)
  })

  it('flush tidak membuang apa pun selagi masih mati', async () => {
    keadaan.online = false
    await kirimAtauAntre({ type:'hapusEntri', date:'2026-09-01' })
    const r = await flushOutbox()
    expect(r.terkirim).toBe(0)
    expect(outboxSize()).toBe(1)
  })

  it('kiriman berikutnya ikut antre, tidak menyalip', async () => {
    keadaan.online = false
    await kirimAtauAntre({ type:'tambahEntri', date:'2026-09-17', input:{ quantities:{ vietnam:1 } } })
    keadaan.online = true
    // masih ada antrean -> yang baru harus ikut baris, bukan langsung kirim
    expect(await kirimAtauAntre({ type:'hapusEntri', date:'2026-09-02' })).toBe('diantre')
    expect(keadaan.terkirim).toHaveLength(0)
  })
})

describe('saat jaringan kembali', () => {
  it('terkirim semua, berurutan sesuai antrean', async () => {
    keadaan.online = false
    await kirimAtauAntre({ type:'tambahEntri', date:'2026-09-17', input:{ quantities:{ vietnam:1 } } })
    await kirimAtauAntre({ type:'simpanVoucher', date:'2026-09-17', rows:[1,2,3] })
    await kirimAtauAntre({ type:'hapusEntri', date:'2026-09-01' })

    keadaan.online = true
    const r = await flushOutbox()
    expect(r.terkirim).toBe(3)
    expect(outboxSize()).toBe(0)
    expect(keadaan.terkirim.map(t => t[0])).toEqual(['tambahEntri','simpanVoucher','hapusEntri'])
  })

  it('yang diantre INPUT-nya, bukan total hasil hitungan', async () => {
    // Ini yang membuat "tambah 3 kopi" tetap benar dikirim jam berapa pun:
    // totalnya dihitung ulang dari data server saat benar-benar terkirim.
    keadaan.online = false
    await kirimAtauAntre({ type:'tambahEntri', date:'2026-09-17', input:{ quantities:{ vietnam:3 } } })
    keadaan.online = true
    await flushOutbox()
    expect(keadaan.terkirim[0][2]).toBe(3)
  })
})

describe('kiriman yang ditolak server', () => {
  it('pindah ke daftar gagal, tidak memacetkan sisa antrean', async () => {
    keadaan.online = false
    await kirimAtauAntre({ type:'simpanSaldo', value:1 })
    await kirimAtauAntre({ type:'hapusEntri', date:'2026-09-01' })

    keadaan.online = true; keadaan.tolakSaldo = true
    const dilihat = []
    const lepas = onGagalChange(xs => dilihat.push(xs.length))
    const r = await flushOutbox()
    lepas()
    expect(r.ditolak).toBe(1)
    expect(outboxSize()).toBe(0)
    expect(keadaan.terkirim.map(t => t[0])).toEqual(['hapusEntri'])
    // Tidak hilang: tersimpan beserta alasannya, dan pendengar diberi tahu.
    expect(daftarGagal()).toHaveLength(1)
    expect(daftarGagal()[0].op.type).toBe('simpanSaldo')
    expect(daftarGagal()[0].pesan).toMatch(/duplicate key/)
    expect(dilihat[dilihat.length - 1]).toBe(1)
    expect(JSON.parse(localStorage.getItem('warkop_gagal_v1'))).toHaveLength(1)
  })

  it('Coba lagi mengembalikannya ke antrean dan mengirimnya', async () => {
    keadaan.tolakSaldo = true
    keadaan.online = false
    await kirimAtauAntre({ type:'simpanSaldo', value:7 })
    keadaan.online = true
    await flushOutbox()
    expect(daftarGagal()).toHaveLength(1)
    keadaan.tolakSaldo = false
    await cobaLagiGagal(0)
    expect(daftarGagal()).toHaveLength(0)
    expect(keadaan.terkirim).toContainEqual(['simpanSaldo', 7])
  })

  it('Buang benar-benar membuangnya', async () => {
    keadaan.tolakSaldo = true
    keadaan.online = false
    await kirimAtauAntre({ type:'simpanSaldo', value:7 })
    keadaan.online = true
    await flushOutbox()
    buangGagal(0)
    expect(daftarGagal()).toHaveLength(0)
    expect(outboxSize()).toBe(0)
  })
})

describe('sesi kedaluwarsa', () => {
  it('kiriman tetap di antrean, tidak dibuang, tidak masuk daftar gagal', async () => {
    keadaan.online = false
    await kirimAtauAntre({ type:'simpanSaldo', value:3 })
    keadaan.online = true; keadaan.sesiHabis = true
    const r = await flushOutbox()
    expect(r.terkirim).toBe(0)
    expect(outboxSize()).toBe(1)
    expect(daftarGagal()).toHaveLength(0)
    keadaan.sesiHabis = false
    await flushOutbox()
    expect(outboxSize()).toBe(0)
    expect(keadaan.terkirim).toContainEqual(['simpanSaldo', 3])
  })

  it('simpan langsung saat sesi habis ikut diantre, tidak gagal', async () => {
    keadaan.sesiHabis = true
    expect(await kirimAtauAntre({ type:'hapusEntri', date:'2026-09-02' })).toBe('diantre')
    expect(outboxSize()).toBe(1)
  })

  it('penolakan RLS bukan galat sesi', () => {
    expect(isGalatSesi({ code: 'PGRST301', message: 'JWT expired' })).toBe(true)
    expect(isGalatSesi({ code: '42501', message: 'new row violates row-level security policy' })).toBe(false)
  })
})

describe('bertahan lewat restart', () => {
  it('antrean tersimpan di localStorage', async () => {
    keadaan.online = false
    await kirimAtauAntre({ type:'simpanSaldo', value:5000 })
    const mentah = localStorage.getItem('warkop_outbox_v1')
    expect(mentah).toBeTruthy()
    expect(JSON.parse(mentah)).toHaveLength(1)
    expect(JSON.parse(mentah)[0].type).toBe('simpanSaldo')
  })
})

describe('pemberitahuan perubahan', () => {
  it('memberi tahu pendengar saat antrean bertambah dan berkurang', async () => {
    const dilihat = []
    const lepas = onOutboxChange(n => dilihat.push(n))
    keadaan.online = false
    await kirimAtauAntre({ type:'hapusEntri', date:'2026-09-01' })
    keadaan.online = true
    await flushOutbox()
    lepas()
    expect(dilihat[0]).toBe(0)                    // dipanggil langsung saat daftar
    expect(Math.max(...dilihat)).toBe(1)
    expect(dilihat[dilihat.length - 1]).toBe(0)
  })
})
