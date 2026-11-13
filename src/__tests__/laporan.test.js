import { describe, it, expect } from 'vitest'
import { rekapBulanan, rekapToko, buildEntry, V2K_SETORAN, V2K } from '../model.js'
import entriNyata from './entri-nyata.json'

describe('rekapBulanan', () => {
  it('jumlah semua bulan = jumlah seluruh entri (data nyata)', () => {
    const r = rekapBulanan(entriNyata, {})
    const jual = Object.values(entriNyata).reduce((s, e) => s + e.totalPenjualan, 0)
    const gaji = Object.values(entriNyata).reduce((s, e) => s + e.gaji, 0)
    expect(r.reduce((s, b) => s + b.penjualanProduk, 0)).toBe(jual)
    expect(r.reduce((s, b) => s + b.gaji, 0)).toBe(gaji)
    expect(r.map(b => b.bulan)).toEqual(['2026-04', '2026-03'])   // terbaru dulu
  })

  it('voucher ke pemilik: hasil positif, kas toko hanya berkurang gaji', () => {
    const vt = { '2026-11-03': { dadi: { drop: 70, laku: 70, kePemilik: true } } }
    const [nov] = rekapBulanan({}, vt)
    expect(nov.setoranVoucher).toBe(70 * V2K_SETORAN)
    expect(nov.kePemilik).toBe(70 * V2K_SETORAN)
    expect(nov.hasil).toBe(70 * V2K_SETORAN - 70 * V2K.gaji)
    expect(nov.kasToko).toBe(-70 * V2K.gaji)
  })

  it('lima pengeluaran terbesar, digabung per keterangan', () => {
    const e = {
      '2026-11-01': buildEntry('2026-11-01', {}, [{ desc: 'Susu', amount: 28000 }, { desc: 'Gelas', amount: 9000 }]),
      '2026-11-02': buildEntry('2026-11-02', {}, [{ desc: 'susu ', amount: 30000 }, { desc: 'ke pemilik', amount: 50000, type: 'setor' }]),
    }
    const [nov] = rekapBulanan(e, {})
    expect(nov.biayaTerbesar[0]).toEqual({ ket: 'susu', jumlah: 58000 })
    expect(nov.pengeluaran).toBe(67000)        // setoran ke pemilik bukan pengeluaran
    expect(nov.kePemilik).toBe(50000)
  })
})

describe('rekapToko', () => {
  it('stok sekarang dan hari sejak setor terakhir', () => {
    const vt = { '2026-11-06': { dadi: { drop: 70, laku: 140 } }, '2026-10-20': { dadi: { drop: 140, laku: 70 } } }
    const dadi = rekapToko(vt, '2026-11-13').find(t => t.id === 'dadi')
    expect(dadi.stok).toBe(0)
    expect(dadi.terakhirSetor).toBe('2026-11-06')
    expect(dadi.hariSejak).toBe(7)
    expect(dadi.lakuPerBulan).toEqual({ '2026-10': 70, '2026-11': 140 })
  })
})
