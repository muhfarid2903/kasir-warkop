import { describe, it, expect, beforeEach, vi } from 'vitest'
import { accumulateEntry, buildEntry, selisihInput, PRODUCTS } from '../model.js'
import entriNyata from './entri-nyata.json'

// RENCANA 1.3 — penjualan tidak boleh tercatat dua kali saat balasan simpan
// hilang di jalan.

describe('linearitas: server cukup menambah selisih', () => {
  // Kalau ini benar, menambahkan selisihInput() di server sama dengan
  // accumulateEntry() di HP — dasar fungsi tambah_entri di kiriman_migration.sql.
  const input = {
    quantities: { kopilain: 3, vietnam: 2, teh: 1 },
    expenses: [{ desc: 'Susu', amount: 28000 }, { desc: '', amount: 0 }],
    cashIns: [{ desc: 'Pak Budi bayar', amount: 15000 }],
  }
  const tanggal = Object.keys(entriNyata)
  // Hari yang angka tersimpannya cocok dengan harga sekarang.
  const sesuaiHarga = tanggal.filter(d => buildEntry(d, entriNyata[d].quantities, entriNyata[d].expenses).totalPenjualan === entriNyata[d].totalPenjualan)

  it.each(sesuaiHarga)('%s: total sama persis dengan cara lama', (date) => {
    const lama = entriNyata[date]
    const hasil = accumulateEntry(lama, date, input)
    const s = selisihInput(date, input)
    expect(hasil.totalPenjualan).toBe(lama.totalPenjualan + s.totalPenjualan)
    expect(hasil.gaji).toBe(lama.gaji + s.gaji)
    expect(hasil.totalPengeluaran).toBe(lama.totalPengeluaran + s.totalPengeluaran)
    expect(hasil.sisaKas).toBe(lama.sisaKas + s.sisaKas)
  })

  it.each(tanggal)('%s: jumlah per produk dan daftar pengeluaran bertambah tepat sebesar input', (date) => {
    const lama = entriNyata[date]
    const hasil = accumulateEntry(lama, date, input)
    const s = selisihInput(date, input)
    PRODUCTS.forEach(p => expect(hasil.quantities[p.id] || 0).toBe((lama.quantities[p.id] || 0) + (s.quantities[p.id] || 0)))
    expect(hasil.expenses).toEqual([...lama.expenses, ...s.expenses])
  })

  it('ada hari bulan Maret–April yang tersimpan dengan harga lama', () => {
    // Cara lama menghitung ulang SELURUH hari itu dengan harga sekarang tiap
    // ada tambahan, jadi penjualan lamanya ikut berubah. Menambah selisih di
    // server tidak menyentuh angka lama — sengaja, dan lebih benar.
    expect(sesuaiHarga.length).toBeLessThan(tanggal.length)
    expect(sesuaiHarga.length).toBeGreaterThan(0)
  })
})

// Server tiruan yang meniru tambah_entri: tulisan bisa SAMPAI tapi balasannya
// hilang, dan kiriman dengan opId yang sudah diterima diabaikan.
const server = { kopi: 0, diterima: new Set(), hilangBalasan: 0, online: true }
vi.mock('../db.js', () => ({
  isNetworkError: (e) => String(e?.message || e).toLowerCase().includes('fetch'),
  commitEntryAddition: async (_date, input, _jejak, opId) => {
    if (!server.online) throw new Error('Failed to fetch')
    if (!opId || !server.diterima.has(opId)) {
      if (opId) server.diterima.add(opId)
      server.kopi += input.quantities.kopilain || 0
    }
    if (server.hilangBalasan > 0) { server.hilangBalasan--; throw new Error('Failed to fetch') }
  },
  deleteEntry: async () => {}, saveVoucherToko: async () => {}, saveSaldoAwal: async () => {},
}))
const { kirimAtauAntre, flushOutbox, outboxSize, clearOutbox, idKiriman } = await import('../outbox.js')

beforeEach(() => { server.kopi = 0; server.diterima = new Set(); server.hilangBalasan = 0; server.online = true; clearOutbox() })

describe('balasan simpan hilang di jalan', () => {
  it('3 kopi tetap tercatat 3, bukan 6, setelah dikirim ulang', async () => {
    server.hilangBalasan = 1
    const hasil = await kirimAtauAntre({ type: 'tambahEntri', id: idKiriman(), date: '2026-11-13', input: { quantities: { kopilain: 3 } } })
    expect(hasil).toBe('diantre')          // app mengira gagal…
    expect(server.kopi).toBe(3)            // …padahal sudah sampai
    await flushOutbox()
    expect(outboxSize()).toBe(0)
    expect(server.kopi).toBe(3)
  })

  it('dua kali simpan yang berbeda tetap terhitung dua-duanya', async () => {
    await kirimAtauAntre({ type: 'tambahEntri', id: idKiriman(), date: '2026-11-13', input: { quantities: { kopilain: 3 } } })
    await kirimAtauAntre({ type: 'tambahEntri', id: idKiriman(), date: '2026-11-13', input: { quantities: { kopilain: 2 } } })
    expect(server.kopi).toBe(5)
  })

  it('pengenal kiriman unik dan berbentuk UUID', () => {
    const a = idKiriman(), b = idKiriman()
    expect(a).not.toBe(b)
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
})

describe('tebakan layar untuk baris ringkas (RENCANA 1.6)', () => {
  it('menambah ke angka yang ada, bukan menggantinya dengan input saja', async () => {
    const { tambahRingkas } = await import('../model.js')
    const ringkas = { date: '2026-11-13', totalPenjualan: 48000, gaji: 10400, totalPengeluaran: 26000 }
    const t = tambahRingkas(ringkas, '2026-11-13', { quantities: { kopilain: 2 }, expenses: [{ desc: 'Gelas', amount: 9000 }], cashIns: [] })
    expect(t).toEqual({ date: '2026-11-13', totalPenjualan: 60000, gaji: 13000, totalPengeluaran: 35000 })
    expect(t.quantities).toBeUndefined()   // tetap ringkas — detailnya belum ada
  })
})

describe('nominal negatif (RENCANA 1.7)', () => {
  it('tidak pernah membalik arah uang', () => {
    const e = accumulateEntry(null, '2026-11-13', { quantities: {}, expenses: [{ desc: 'Susu', amount: -28000 }], cashIns: [{ desc: 'bayar', amount: -5000 }] })
    expect(e.totalPengeluaran).toBe(0)
    expect(e.expenses.every(x => x.amount >= 0)).toBe(true)
  })
})
