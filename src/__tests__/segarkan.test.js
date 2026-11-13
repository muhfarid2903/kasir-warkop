import { describe, it, expect } from 'vitest'
import { gabungRingkasan, hasDetail } from '../model.js'

// Penyegaran data dari server tidak boleh membuang detail yang sudah ada
// (RENCANA 1.1: rincian Riwayat kosong setelah app kembali ke layar).
const lengkap = (date, penjualan, gaji = 0, pengeluaran = 0) => ({
  date, quantities: { kopilain: penjualan / 6000 }, expenses: [],
  totalPenjualan: penjualan, gaji, totalPengeluaran: pengeluaran, sisaKas: penjualan - gaji - pengeluaran,
})
const ringkas = (date, penjualan, gaji = 0, pengeluaran = 0) => ({ date, totalPenjualan: penjualan, gaji, totalPengeluaran: pengeluaran })

describe('gabungRingkasan', () => {
  it('detail bertahan kalau angkanya sama dengan server', () => {
    const lama = { '2026-11-10': lengkap('2026-11-10', 12000, 2600) }
    const { entries, perluDetail } = gabungRingkasan(lama, { '2026-11-10': ringkas('2026-11-10', 12000, 2600) })
    expect(hasDetail(entries['2026-11-10'])).toBe(true)
    expect(entries['2026-11-10']).toBe(lama['2026-11-10'])
    expect(perluDetail).toEqual([])
  })

  it('angka berbeda: ringkasan baru dipakai dan tanggalnya diminta ditarik ulang', () => {
    const lama = { '2026-11-10': lengkap('2026-11-10', 12000, 2600) }
    const { entries, perluDetail } = gabungRingkasan(lama, { '2026-11-10': ringkas('2026-11-10', 18000, 3900) })
    expect(entries['2026-11-10'].totalPenjualan).toBe(18000)
    expect(hasDetail(entries['2026-11-10'])).toBe(false)
    expect(perluDetail).toEqual(['2026-11-10'])
  })

  it('tanggal yang sudah dihapus di server hilang', () => {
    const lama = { '2026-11-09': lengkap('2026-11-09', 6000), '2026-11-10': lengkap('2026-11-10', 12000) }
    const { entries } = gabungRingkasan(lama, { '2026-11-10': ringkas('2026-11-10', 12000) })
    expect(Object.keys(entries)).toEqual(['2026-11-10'])
  })

  it('tanggal baru dari server ikut masuk sebagai ringkasan, tanpa diminta detailnya', () => {
    const { entries, perluDetail } = gabungRingkasan({}, { '2026-11-11': ringkas('2026-11-11', 8000) })
    expect(entries['2026-11-11'].totalPenjualan).toBe(8000)
    expect(perluDetail).toEqual([])
  })

  it('baris ringkas lama diganti ringkasan baru tanpa diminta detailnya', () => {
    const { entries, perluDetail } = gabungRingkasan({ '2026-11-10': ringkas('2026-11-10', 6000) }, { '2026-11-10': ringkas('2026-11-10', 12000) })
    expect(entries['2026-11-10'].totalPenjualan).toBe(12000)
    expect(perluDetail).toEqual([])
  })
})
