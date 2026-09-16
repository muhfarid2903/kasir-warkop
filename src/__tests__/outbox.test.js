import { describe, it, expect, beforeEach, vi } from 'vitest'

// db.js disulih: jaringannya bisa dimatikan sesuka hati, dan tidak ada
// satu pun panggilan sungguhan ke Supabase.
const keadaan = { online: true, tolakSaldo: false, terkirim: [] }

class NetErr extends Error { constructor(){ super('Failed to fetch') } }
const cekJaringan = () => { if (!keadaan.online) throw new NetErr() }

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

const { kirimAtauAntre, flushOutbox, outboxSize, clearOutbox, onOutboxChange } = await import('../outbox.js')

beforeEach(() => {
  keadaan.online = true; keadaan.tolakSaldo = false; keadaan.terkirim = []
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
  it('dibuang, tidak memacetkan sisa antrean', async () => {
    keadaan.online = false
    await kirimAtauAntre({ type:'simpanSaldo', value:1 })
    await kirimAtauAntre({ type:'hapusEntri', date:'2026-09-01' })

    keadaan.online = true; keadaan.tolakSaldo = true
    const r = await flushOutbox()
    expect(r.dibuang).toHaveLength(1)
    expect(outboxSize()).toBe(0)
    expect(keadaan.terkirim.map(t => t[0])).toEqual(['hapusEntri'])
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
