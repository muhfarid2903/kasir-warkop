import { describe, it, expect } from 'vitest'
import {
  PRODUCTS, TOKO, V2K, V2K_SETORAN, VOUCHER_TOKO_CUTOFF,
  getPayPeriods, voucherForDate, voucherInRange, voucherStockBefore, voucherStockPerToko,
  productTotals, splitExpenses, draftTotals, buildEntry, accumulateEntry, entryDayTotals,
  computeKasSummary, computePaydayInfo, periodGaji, hasDetail, dateToISO,
} from '../model.js'
import entriNyata from './entri-nyata.json'

// Voucher toko sintetis: data nyata di repo berhenti sebelum cutoff 1 Mei 2026.
const voucherToko = {
  '2026-04-28': { dadi:{drop:50,laku:10} },            // sebelum cutoff -> diabaikan voucherInRange
  '2026-05-01': { dadi:{drop:100,laku:20}, dio:{drop:50,laku:5} },
  '2026-05-02': { dadi:{drop:0,laku:30},  anci:{drop:40,laku:0} },
  '2026-05-14': { hrahim:{drop:25,laku:25} },
  '2026-05-15': { nahrul:{drop:60,laku:12}, dio:{drop:0,laku:8} },
  '2026-05-28': { dadi:{drop:10,laku:45} },
}

describe('katalog', () => {
  it('tiap produk punya id, nama, harga, gaji', () => {
    for (const p of PRODUCTS) {
      expect(p.id).toBeTruthy()
      expect(p.name).toBeTruthy()
      expect(p.price).toBeGreaterThan(0)
      expect(p.gaji).toBeGreaterThanOrEqual(0)
      expect(p.gaji).toBeLessThan(p.price)   // gaji tidak boleh melebihi harga jual
    }
  })

  it('id produk unik', () => {
    const ids = PRODUCTS.map(p => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('setoran voucher = harga jual dikurangi komisi toko', () => {
    expect(V2K_SETORAN).toBe(V2K.price - V2K.komisi_toko)
    expect(V2K_SETORAN).toBe(1500)
  })
})

describe('periode gajian', () => {
  it('membagi bulan jadi 1-14 dan 15-28', () => {
    const [awal, akhir] = getPayPeriods(2026, 8)   // September
    expect(awal.start).toBe('2026-09-01'); expect(awal.end).toBe('2026-09-14'); expect(awal.payday).toBe(14)
    expect(akhir.start).toBe('2026-09-15'); expect(akhir.end).toBe('2026-09-28'); expect(akhir.payday).toBe(28)
  })

  it('tanggal 29-31 melimpah ke periode Awal Bulan berikutnya', () => {
    const [awal] = getPayPeriods(2026, 8)          // Sep; bulan sebelumnya Agustus (31 hari)
    expect(awal.overflowDays).toEqual([29, 30, 31])
    expect(awal.overflowStart).toBe('2026-08-29')
    expect(awal.overflowEnd).toBe('2026-08-31')
  })

  it('periode Akhir Bulan tidak pernah punya limpahan', () => {
    for (let m = 0; m < 12; m++) {
      const [, akhir] = getPayPeriods(2026, m)
      expect(akhir.overflowDays).toEqual([])
      expect(akhir.overflowStart).toBeNull()
    }
  })

  it('Februari tahun kabisat melimpahkan tgl 29', () => {
    const [awal] = getPayPeriods(2024, 2)          // Maret 2024; Feb 2024 = 29 hari
    expect(awal.overflowDays).toEqual([29])
  })

  it('Februari tahun biasa tidak melimpahkan apa pun', () => {
    const [awal] = getPayPeriods(2026, 2)          // Maret 2026; Feb 2026 = 28 hari
    expect(awal.overflowDays).toEqual([])
    expect(awal.overflowStart).toBeNull()
  })

  it('Januari mengambil limpahan dari Desember tahun sebelumnya', () => {
    const [awal] = getPayPeriods(2026, 0)
    expect(awal.overflowStart).toBe('2025-12-29')
    expect(awal.prevYear).toBe(2025)
  })
})

describe('voucher toko', () => {
  it('menjumlahkan drop & laku seluruh toko pada satu tanggal', () => {
    const v = voucherForDate('2026-05-01', voucherToko)
    expect(v.drop).toBe(150)
    expect(v.laku).toBe(25)
    expect(v.gaji).toBe(25 * V2K.gaji)
    expect(v.penjualan).toBe(25 * V2K_SETORAN)
  })

  it('tanggal tanpa data menghasilkan nol, bukan error', () => {
    expect(voucherForDate('2026-01-01', voucherToko)).toMatchObject({ drop:0, laku:0, gaji:0, penjualan:0 })
    expect(voucherForDate('2026-01-01', null)).toMatchObject({ drop:0, laku:0 })
  })

  it('mengabaikan tanggal sebelum cutoff', () => {
    const r = voucherInRange('2026-04-01', '2026-05-01', voucherToko)
    expect(r.laku).toBe(25)              // 28 Apr tidak dihitung
    expect('2026-04-28' < VOUCHER_TOKO_CUTOFF).toBe(true)
  })

  it('stok sebelum tanggal bersifat eksklusif', () => {
    const s = voucherStockBefore('2026-05-02', voucherToko)
    expect(s.dadi).toEqual({ drop:150, laku:30 })   // 28 Apr + 1 Mei, belum 2 Mei
  })

  it('stok sampai tanggal bersifat inklusif', () => {
    const s = voucherStockPerToko('2026-05-02', voucherToko)
    expect(s.dadi).toEqual({ drop:150, laku:60 })   // termasuk 2 Mei
  })

  it('tiap toko selalu ada di hasil walau tanpa transaksi', () => {
    const s = voucherStockPerToko('2026-05-01', voucherToko)
    for (const t of TOKO) expect(s[t.id]).toBeDefined()
  })
})

describe('hitungan satu hari', () => {
  it('total produk dari qty', () => {
    const t = productTotals({ vietnam:3, teh:2 })
    expect(t.totalQty).toBe(5)
    expect(t.totalSales).toBe(3*8000 + 2*5000)
    expect(t.totalGaji).toBe(3*1500 + 2*1000)
  })

  it('qty tidak dikenal diabaikan dalam total, bukan bikin NaN', () => {
    const t = productTotals({ vietnam:1, entahApa:99 })
    expect(t.totalSales).toBe(8000)
    expect(Number.isNaN(t.totalSales)).toBe(false)
  })

  it('cash masuk mengurangi pengeluaran, bukan menambah penjualan', () => {
    const e = buildEntry('2026-09-17', { vietnam:1 }, [
      { desc:'susu', amount:30000 },
      { desc:'bayar hutang', amount:10000, type:'cashin' },
    ])
    expect(e.totalPenjualan).toBe(8000)          // tidak terpengaruh cash masuk
    expect(e.totalPengeluaran).toBe(20000)       // 30.000 - 10.000
    expect(e.sisaKas).toBe(8000 - 1500 - 20000)
  })

  it('splitExpenses memisahkan berdasarkan type', () => {
    const r = splitExpenses([{amount:5}, {amount:3,type:'cashin'}, {amount:2}])
    expect(r.expGross).toBe(7)
    expect(r.cashGross).toBe(3)
    expect(r.items).toHaveLength(2)
  })

  it('draftTotals memperlakukan pengeluaran & cash sebagai larik terpisah', () => {
    const t = draftTotals({ vietnam:1 }, [{amount:5000}], [{amount:2000}])
    expect(t.sisaKas).toBe(8000 - 1500 - 5000 + 2000)
  })
})

describe('accumulateEntry — jalur simpan Hari Ini', () => {
  it('menambah ke entri yang sudah ada, bukan mengganti', () => {
    const lama = buildEntry('2026-09-17', { vietnam:2 }, [{ desc:'gula', amount:5000 }])
    const baru = accumulateEntry(lama, '2026-09-17', { quantities:{ vietnam:3 }, expenses:[], cashIns:[] })
    expect(baru.quantities.vietnam).toBe(5)
    expect(baru.expenses).toHaveLength(1)          // catatan lama tetap ada
    expect(baru.totalPenjualan).toBe(5 * 8000)
  })

  it('entri baru (existing null) tetap benar', () => {
    const e = accumulateEntry(null, '2026-09-17', { quantities:{ teh:2 }, expenses:[], cashIns:[] })
    expect(e.quantities.teh).toBe(2)
    expect(e.totalPenjualan).toBe(10000)
  })

  it('produk di luar PRODUCTS TIDAK ikut terhapus', () => {
    // Ini bug nyata yang pernah terjadi: accQty dibangun ulang dari PRODUCTS,
    // sehingga qty produk yang sudah dihapus dari katalog lenyap diam-diam.
    const lama = { date:'2026-09-17', quantities:{ vietnam:1, menuLama:4 }, expenses:[] }
    const baru = accumulateEntry(lama, '2026-09-17', { quantities:{ vietnam:1 }, expenses:[], cashIns:[] })
    expect(baru.quantities.menuLama).toBe(4)
    expect(baru.quantities.vietnam).toBe(2)
  })

  it('baris kosong tanpa isi tidak ikut tersimpan', () => {
    const e = accumulateEntry(null, '2026-09-17', {
      quantities:{ vietnam:1 },
      expenses:[{ desc:'', amount:0 }],
      cashIns:[{ desc:'', amount:0 }],
    })
    expect(e.expenses).toHaveLength(0)
  })

  it('cash masuk selalu diberi type cashin', () => {
    const e = accumulateEntry(null, '2026-09-17', {
      quantities:{}, expenses:[], cashIns:[{ desc:'hutang', amount:5000 }],
    })
    expect(e.expenses[0].type).toBe('cashin')
  })
})

describe('entryDayTotals — baris Riwayat & CSV', () => {
  it('menggabungkan setoran voucher toko ke total hari itu', () => {
    const e = buildEntry('2026-05-01', { vietnam:1 }, [])
    const t = entryDayTotals(e, voucherToko)
    expect(t.totalPenjualan).toBe(8000 + 25*V2K_SETORAN)
    expect(t.totalGaji).toBe(1500 + 25*V2K.gaji)
  })

  it('entri lama tanpa kolom totalPengeluaran dihitung ulang dari daftarnya', () => {
    const e = { date:'2026-09-17', quantities:{}, expenses:[{amount:9000}], totalPenjualan:0, gaji:0 }
    expect(entryDayTotals(e, {}).totalPengeluaran).toBe(9000)
  })
})

describe('data nyata dari import_riwayat.sql', () => {
  const tanggal = Object.keys(entriNyata).sort()

  it('memuat 37 entri', () => {
    expect(tanggal).toHaveLength(37)
  })

  it('sisa kas tiap hari = penjualan - gaji - pengeluaran', () => {
    for (const d of tanggal) {
      const t = entryDayTotals(entriNyata[d], {})
      expect(t.sisaKas).toBe(t.totalPenjualan - t.totalGaji - t.totalPengeluaran)
    }
  })

  it('kas all-time = saldo awal + penjualan - gaji - pengeluaran', () => {
    const saldo = 1021300
    const k = computeKasSummary(entriNyata, {}, saldo, new Date('2026-09-17T10:00:00'))
    const jual = tanggal.reduce((s,d)=>s+entriNyata[d].totalPenjualan, 0)
    const gaji = tanggal.reduce((s,d)=>s+entriNyata[d].gaji, 0)
    const keluar = tanggal.reduce((s,d)=>s+entriNyata[d].totalPengeluaran, 0)
    expect(k.kasSekarang).toBe(saldo + jual - gaji - keluar)
  })

  it('kas tidak berubah kalau voucher toko kosong', () => {
    const a = computeKasSummary(entriNyata, {}, 0, new Date('2026-09-17T10:00:00'))
    const b = computeKasSummary(entriNyata, null, 0, new Date('2026-09-17T10:00:00'))
    expect(a.kasSekarang).toBe(b.kasSekarang)
  })
})

describe('computeKasSummary', () => {
  it('cukup dengan baris RINGKAS, tanpa quantities', () => {
    // Inilah yang membuat muat awal bisa mengambil kolom angka saja.
    const ringkas = { '2026-09-17': { date:'2026-09-17', totalPenjualan:50000, gaji:9000, totalPengeluaran:1000 } }
    const k = computeKasSummary(ringkas, {}, 10000, new Date('2026-09-17T10:00:00'))
    expect(k.kasSekarang).toBe(10000 + 50000 - 9000 - 1000)
    expect(k.hasToday).toBe(true)
    expect(k.todayKas).toBe(50000 - 9000 - 1000)
  })

  it('hari tanpa entri sama sekali menandai hasToday false', () => {
    const k = computeKasSummary({}, {}, 0, new Date('2026-09-17T10:00:00'))
    expect(k.hasToday).toBe(false)
    expect(k.todayKas).toBe(0)
  })

  it('hari yang cuma punya voucher tetap terhitung', () => {
    const k = computeKasSummary({}, { '2026-09-17': { dadi:{drop:0,laku:10} } }, 0, new Date('2026-09-17T10:00:00'))
    expect(k.hasToday).toBe(true)
    expect(k.todayKas).toBe(10*V2K_SETORAN - 10*V2K.gaji)
  })
})

describe('computePaydayInfo', () => {
  const hari = (d) => new Date(2026, 8, d, 10, 0, 0)   // September 2026

  it('tampil di H-2 dan H-1 sebelum tanggal 14', () => {
    expect(computePaydayInfo({}, {}, hari(12))?.show).toBe('upcoming')
    expect(computePaydayInfo({}, {}, hari(13))?.daysLeft).toBe(1)
  })

  it('tampil sebagai hari-H tepat di tanggal 14 dan 28', () => {
    expect(computePaydayInfo({}, {}, hari(14))?.show).toBe('today')
    expect(computePaydayInfo({}, {}, hari(28))?.show).toBe('today')
    expect(computePaydayInfo({}, {}, hari(14))?.daysLeft).toBe(0)
  })

  it('tidak tampil di hari-hari lain', () => {
    for (const d of [1, 5, 11, 15, 20, 25, 29, 30]) {
      expect(computePaydayInfo({}, {}, hari(d))).toBeNull()
    }
  })

  it('gaji periode termasuk limpahan tgl 29-31 bulan sebelumnya', () => {
    const entries = {
      '2026-08-30': { date:'2026-08-30', gaji:5000 },   // limpahan
      '2026-09-03': { date:'2026-09-03', gaji:7000 },   // dalam periode
      '2026-09-20': { date:'2026-09-20', gaji:9000 },   // di luar periode
    }
    const [awal] = getPayPeriods(2026, 8)
    expect(periodGaji(entries, {}, awal)).toBe(12000)
  })
})

describe('hasDetail', () => {
  it('membedakan baris ringkas dari baris lengkap', () => {
    expect(hasDetail({ date:'x', totalPenjualan:1 })).toBe(false)       // ringkas
    expect(hasDetail({ date:'x', quantities:{} })).toBe(true)           // lengkap, walau kosong
    expect(hasDetail(null)).toBe(false)
    expect(hasDetail(undefined)).toBe(false)
  })
})

describe('dateToISO memakai waktu lokal, bukan UTC', () => {
  it('jam 00:30 tetap tanggal hari itu', () => {
    // toISOString() akan memundurkan tanggal di zona WIB — ini yang dicegah.
    const d = new Date(2026, 8, 17, 0, 30, 0)
    expect(dateToISO(d)).toBe('2026-09-17')
  })

  it('jam 23:30 tidak maju ke besok', () => {
    expect(dateToISO(new Date(2026, 8, 17, 23, 30, 0))).toBe('2026-09-17')
  })
})
