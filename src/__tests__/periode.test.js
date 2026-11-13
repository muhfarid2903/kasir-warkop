import { describe, it, expect } from 'vitest'
import { getPayPeriods, rekapPeriode, tokoMelebihiStok, V2K } from '../model.js'

describe('tokoMelebihiStok', () => {
  const vt = { '2026-11-01': { dadi: { drop: 70, laku: 0 } } }
  it('laku sampai stok + drop hari itu masih aman', () => {
    expect(tokoMelebihiStok('2026-11-05', [{ tokoId: 'dadi', drop: 10, laku: 80 }], vt)).toEqual([])
  })
  it('lebih satu saja sudah ditolak', () => {
    expect(tokoMelebihiStok('2026-11-05', [{ tokoId: 'dadi', drop: 10, laku: 81 }], vt)).toEqual(['dadi'])
  })
  it('stok dihitung SEBELUM tanggal itu', () => {
    expect(tokoMelebihiStok('2026-11-01', [{ tokoId: 'dadi', drop: 0, laku: 1 }], vt)).toEqual(['dadi'])
  })
})

describe('rekapPeriode', () => {
  const entries = { '2026-11-03': { date: '2026-11-03', totalPenjualan: 12000, gaji: 2600, totalPengeluaran: 0 } }
  const vt = { '2026-10-30': { dadi: { drop: 70, laku: 72 } }, '2026-11-06': { dio: { drop: 0, laku: 20 } } }
  const [awal, akhir] = getPayPeriods(2026, 10)   // November 2026

  it('periode berjalan: status, hari ke-, sisa hari', () => {
    const r = rekapPeriode(entries, vt, awal, 2026, 10, new Date('2026-11-13T10:00:00'))
    expect(r.status).toBe('berjalan')
    expect(r.hariKe).toBe(13)
    expect(r.panjang).toBe(14)
    expect(r.sisaHari).toBe(1)
  })
  it('limpahan tgl 29-31 bulan lalu ikut, terpisah dari baris utama', () => {
    const r = rekapPeriode(entries, vt, awal, 2026, 10, new Date('2026-11-13T10:00:00'))
    expect(r.limpahan).toEqual([{ date: '2026-10-30', gaji: 72 * V2K.gaji }])
    expect(r.baris.map(b => b.date)).toEqual(['2026-11-03', '2026-11-06'])
    expect(r.hariTercatat).toBe(3)
    expect(r.totalGaji).toBe(2600 + 72 * V2K.gaji + 20 * V2K.gaji)
  })
  it('periode yang belum mulai dan yang sudah lewat', () => {
    expect(rekapPeriode(entries, vt, akhir, 2026, 10, new Date('2026-11-13T10:00:00')).status).toBe('nanti')
    expect(rekapPeriode(entries, vt, awal, 2026, 10, new Date('2026-11-20T10:00:00')).status).toBe('lalu')
    expect(rekapPeriode(entries, vt, awal, 2026, 9, new Date('2026-11-20T10:00:00')).status).toBe('lalu')
  })
})
