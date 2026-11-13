import { describe, it, expect } from 'vitest'
import {
  V2K, V2K_SETORAN, voucherForDate, voucherInRange, buildEntry, accumulateEntry,
  entryDayTotals, computeKasSummary, draftTotals, splitExpenses,
} from '../model.js'
import entriNyata from './entri-nyata.json'

// RENCANA Fase 2 — kas toko vs kas pemilik. Angka kas toko TIDAK boleh
// berubah; yang berubah hanya cara uang yang pindah ke pemilik dicatat.
const hari = '2026-11-11'
const SEKARANG = new Date('2026-11-11T12:00:00')

describe('setoran voucher bertanda kePemilik', () => {
  it('kas toko sama persis dengan cara lama (pengeluaran "tf …")', () => {
    const baru = computeKasSummary({}, { [hari]: { dadi: { drop: 70, laku: 70, kePemilik: true } } }, 500000, SEKARANG)
    const lamaEntri = { [hari]: buildEntry(hari, {}, [{ desc: 'tf dadi 70', amount: 70 * V2K_SETORAN }]) }
    const lama = computeKasSummary(lamaEntri, { [hari]: { dadi: { drop: 70, laku: 70 } } }, 500000, SEKARANG)
    expect(baru.kasSekarang).toBe(lama.kasSekarang)
    expect(baru.todayKas).toBe(lama.todayKas)
  })

  it('tiga angka hari itu: hasil, ke pemilik, kas toko', () => {
    const vt = { [hari]: { dadi: { drop: 70, laku: 70, kePemilik: true } } }
    const t = entryDayTotals({ date: hari, quantities: {}, expenses: [], totalPenjualan: 0, gaji: 0, totalPengeluaran: 0 }, vt)
    expect(t.totalPenjualan).toBe(105000)
    expect(t.totalGaji).toBe(35000)
    expect(t.hasil).toBe(70000)          // dulu tampil "Rugi −Rp35.000"
    expect(t.kePemilik).toBe(105000)
    expect(t.sisaKas).toBe(-35000)       // kas toko: hanya gaji yang keluar
    expect(t.expGross).toBe(0)           // tidak ada "pengeluaran" palsu
  })

  it('gaji Jaya tidak bergantung ke mana setorannya pergi', () => {
    const a = voucherForDate(hari, { [hari]: { dadi: { drop: 0, laku: 40, kePemilik: true } } })
    const b = voucherForDate(hari, { [hari]: { dadi: { drop: 0, laku: 40 } } })
    expect(a.gaji).toBe(b.gaji)
    expect(a.gaji).toBe(40 * V2K.gaji)
    expect(a.penjualan).toBe(b.penjualan)
    expect(a.masukKas).toBe(0)
    expect(b.masukKas).toBe(b.penjualan)
  })

  it('campuran toko tunai dan ke pemilik dalam satu periode', () => {
    const vt = {
      '2026-11-03': { dadi: { drop: 70, laku: 70, kePemilik: true }, dio: { drop: 0, laku: 20 } },
      '2026-11-06': { anci: { drop: 0, laku: 10, kePemilik: true } },
    }
    const r = voucherInRange('2026-11-01', '2026-11-14', vt)
    expect(r.laku).toBe(100)
    expect(r.kePemilik).toBe(80 * V2K_SETORAN)
    expect(r.masukKas).toBe(20 * V2K_SETORAN)
  })
})

describe('baris "setor ke pemilik"', () => {
  const e = accumulateEntry(null, hari, {
    quantities: { kopilain: 2 },
    expenses: [{ desc: 'Susu', amount: 28000 }],
    cashIns: [],
    setors: [{ desc: 'setor ke pemilik', amount: 50000 }],
  })

  it('mengurangi kas toko tapi tidak mengurangi hasil usaha', () => {
    const t = entryDayTotals(e, {})
    expect(t.hasil).toBe(12000 - 2600 - 28000)
    expect(t.kePemilik).toBe(50000)
    expect(t.sisaKas).toBe(t.hasil - 50000)
    expect(t.expGross).toBe(28000)       // setoran tidak ikut "pengeluaran"
  })

  it('totalPengeluaran tetap berarti bersih keluar dari kas toko', () => {
    expect(e.totalPengeluaran).toBe(28000 + 50000)
    expect(splitExpenses(e.expenses).setor).toHaveLength(1)
  })

  it('ringkasan draf memisahkan hasil dari sisa kas', () => {
    const d = draftTotals({ kopilain: 2 }, [{ amount: 28000 }], [], [{ amount: 50000 }])
    expect(d.hasil).toBe(12000 - 2600 - 28000)
    expect(d.sisaKas).toBe(d.hasil - 50000)
  })
})

describe('data lama tidak berubah', () => {
  it('kas dari entri nyata sama dengan sebelum Fase 2', () => {
    const tanggal = Object.keys(entriNyata)
    const jual = tanggal.reduce((s, d) => s + entriNyata[d].totalPenjualan, 0)
    const gaji = tanggal.reduce((s, d) => s + entriNyata[d].gaji, 0)
    const keluar = tanggal.reduce((s, d) => s + entriNyata[d].totalPengeluaran, 0)
    expect(computeKasSummary(entriNyata, {}, 1000, SEKARANG).kasSekarang).toBe(1000 + jual - gaji - keluar)
  })

  it('hari lama tanpa setor: hasil sama dengan sisa kas', () => {
    Object.values(entriNyata).forEach(en => {
      const t = entryDayTotals(en, {})
      expect(t.hasil).toBe(t.sisaKas)
      expect(t.kePemilik).toBe(0)
    })
  })
})

import { tarifVoucher, tokoTampil, TOKO } from '../model.js'
describe('tarif voucher bertanggal (RENCANA 5.2)', () => {
  const daftar = [
    { sejak: '2026-05-01', harga: 2000, komisi: 500, gaji: 500 },
    { sejak: '2026-12-01', harga: 2500, komisi: 500, gaji: 600 },
  ]
  const vt = { '2026-11-20': { dadi: { drop: 0, laku: 10 } }, '2026-12-05': { dadi: { drop: 0, laku: 10 } } }
  it('tarif baru tidak mengubah tanggal sebelum berlakunya', () => {
    expect(voucherForDate('2026-11-20', vt, daftar).penjualan).toBe(10 * 1500)
    expect(voucherForDate('2026-12-05', vt, daftar).penjualan).toBe(10 * 2000)
    expect(voucherForDate('2026-12-05', vt, daftar).gaji).toBe(10 * 600)
  })
  it('jumlah rentang menjumlahkan tiap tanggal dengan tarifnya sendiri', () => {
    const r = voucherInRange('2026-11-01', '2026-12-31', vt, daftar)
    expect(r.penjualan).toBe(15000 + 20000)
    expect(r.gaji).toBe(5000 + 6000)
  })
  it('tarif yang berlaku = baris terakhir yang sudah dimulai', () => {
    expect(tarifVoucher('2026-11-30', daftar).harga).toBe(2000)
    expect(tarifVoucher('2026-12-01', daftar).harga).toBe(2500)
    expect(tarifVoucher('2026-05-01').setoran).toBe(1500)
  })
})

describe('toko tidak aktif', () => {
  it('semua toko sekarang aktif dan tampil', () => {
    expect(tokoTampil('2026-11-13', {}).length).toBe(TOKO.length)
  })
})
