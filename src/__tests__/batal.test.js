import { describe, it, expect } from 'vitest'
import { accumulateEntry, kurangiEntri, entriKosong } from '../model.js'
import entriNyata from './entri-nyata.json'

// RENCANA 3.3 — Batalkan sesudah simpan mengembalikan hari itu persis seperti
// sebelum simpan.
const input = {
  quantities: { kopilain: 3, vietnam: 1 },
  expenses: [{ desc: 'Susu', amount: 28000 }],
  cashIns: [{ desc: 'Pak Budi', amount: 10000 }],
  setors: [{ desc: 'ke pemilik', amount: 20000 }],
}

describe('kurangiEntri', () => {
  it.each(Object.keys(entriNyata))('%s: tambah lalu batalkan = kembali seperti semula', (date) => {
    const lama = entriNyata[date]
    const sesudah = accumulateEntry(lama, date, input)
    // Server menambah selisih ke angka tersimpan, jadi totalnya dimodelkan begitu.
    const diServer = { ...sesudah, totalPenjualan: lama.totalPenjualan + (sesudah.totalPenjualan - accumulateEntry(lama, date, { quantities:{}, expenses:[], cashIns:[] }).totalPenjualan) }
    const kembali = kurangiEntri(diServer, date, input)
    expect(kembali.expenses).toEqual(lama.expenses)
    Object.keys(lama.quantities).forEach(id => expect(kembali.quantities[id] || 0).toBe(lama.quantities[id] || 0))
    expect(kembali.gaji).toBe(lama.gaji)
    expect(kembali.totalPengeluaran).toBe(lama.totalPengeluaran)
  })

  it('hari yang sebelumnya kosong jadi kosong lagi', () => {
    const e = accumulateEntry(null, '2026-11-13', input)
    const k = kurangiEntri(e, '2026-11-13', input)
    expect(entriKosong(k)).toBe(true)
  })

  it('baris yang sama persis milik input sebelumnya tidak ikut terbuang', () => {
    const a = accumulateEntry(null, '2026-11-13', { quantities: {}, expenses: [{ desc: 'Susu', amount: 28000 }], cashIns: [] })
    const b = accumulateEntry(a, '2026-11-13', { quantities: {}, expenses: [{ desc: 'Susu', amount: 28000 }], cashIns: [] })
    const k = kurangiEntri(b, '2026-11-13', { quantities: {}, expenses: [{ desc: 'Susu', amount: 28000 }], cashIns: [] })
    expect(k.expenses).toHaveLength(1)
    expect(k.totalPengeluaran).toBe(28000)
  })

  it('jumlah produk tidak pernah di bawah nol', () => {
    const k = kurangiEntri({ date: 'x', quantities: { kopilain: 1 }, expenses: [], totalPenjualan: 6000, gaji: 1300, totalPengeluaran: 0 }, 'x', { quantities: { kopilain: 3 } })
    expect(k.quantities.kopilain).toBe(0)
  })
})
