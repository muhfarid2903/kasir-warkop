import { describe, it, expect } from 'vitest'
import { infoToko } from '../model.js'

const vt = {
  '2026-10-01': { dadi: { drop: 70, laku: 0 } },
  '2026-10-12': { dadi: { drop: 70, laku: 70 } },
  '2026-10-20': { dadi: { drop: 140, laku: 70 }, dio: { drop: 200, laku: 0 } },
  '2026-11-06': { dadi: { drop: 70, laku: 140 } },
  '2026-11-13': { dadi: { drop: 0, laku: 70 } },   // tanggal yang sedang diisi — tidak dihitung
}

describe('infoToko', () => {
  it('setor terakhir sebelum tanggal itu, dan jaraknya dalam hari', () => {
    const i = infoToko('dadi', '2026-11-13', vt)
    expect(i.terakhirSetor).toBe('2026-11-06')
    expect(i.hariSejak).toBe(7)
  })
  it('jumlah drop yang paling sering', () => {
    expect(infoToko('dadi', '2026-11-13', vt).dropUmum).toBe(70)
  })
  it('toko yang belum pernah setor', () => {
    const i = infoToko('dio', '2026-11-13', vt)
    expect(i.terakhirSetor).toBeNull()
    expect(i.hariSejak).toBeNull()
    expect(i.dropUmum).toBe(200)
  })
  it('toko tanpa riwayat sama sekali', () => {
    expect(infoToko('anci', '2026-11-13', vt)).toEqual({ terakhirSetor: null, hariSejak: null, dropUmum: null })
  })
})

import { kopiSedangLibur } from '../model.js'
describe('kopiSedangLibur', () => {
  const ringkas = (date, jual) => ({ date, totalPenjualan: jual, gaji: 0, totalPengeluaran: 0 })
  it('14 hari hanya voucher/pengeluaran -> libur', () => {
    const e = { '2026-09-20': ringkas('2026-09-20', 48000), '2026-11-06': ringkas('2026-11-06', 0), '2026-11-11': ringkas('2026-11-11', 0) }
    expect(kopiSedangLibur(e, '2026-11-13')).toBe(true)
  })
  it('ada satu penjualan kemarin -> buka', () => {
    const e = { '2026-11-12': ringkas('2026-11-12', 6000) }
    expect(kopiSedangLibur(e, '2026-11-13')).toBe(false)
  })
  it('penjualan tepat 13 hari lalu masih dihitung buka', () => {
    expect(kopiSedangLibur({ '2026-10-31': ringkas('2026-10-31', 8000) }, '2026-11-13')).toBe(false)
    expect(kopiSedangLibur({ '2026-10-30': ringkas('2026-10-30', 8000) }, '2026-11-13')).toBe(true)
  })
  it('pemakai baru tanpa data sama sekali -> bukan libur', () => {
    expect(kopiSedangLibur({}, '2026-11-13')).toBe(false)
  })
})
