import { describe, it, expect } from 'vitest'
import {
  namaPengguna, tandaJejak,
  rincianTambah, rincianUbah, rincianHapus, rincianVoucher, entriBerubah,
  ringkasJejak, jamJejak, pelakuHari, ringkasPelaku, banyakPenginput, jejakSaldoTerakhir,
} from '../jejak.js'

const sesi = (email, meta) => ({ user: { email, user_metadata: meta } })

describe('nama penginput', () => {
  it('pakai nama dari metadata kalau ada', () => {
    expect(namaPengguna(sesi('prof.mf3@gmail.com', { nama: 'Farid' }))).toBe('Farid')
  })

  it('kalau tidak ada, pakai bagian depan email — bukan email penuh', () => {
    expect(namaPengguna(sesi('jaya@warkop.id', {}))).toBe('jaya')
  })

  it('tanpa sesi tetap mengembalikan sesuatu, bukan undefined', () => {
    expect(namaPengguna(null)).toBe('Tanpa nama')
  })
})

describe('tanda jejak', () => {
  it('membawa nama, email, dan waktu penekanan tombol', () => {
    const t = tandaJejak(sesi('jaya@warkop.id', { nama: 'Jaya' }), 'tambah', { qty: { teh: 1 } })
    expect(t.oleh).toBe('Jaya')
    expect(t.email).toBe('jaya@warkop.id')
    expect(t.aksi).toBe('tambah')
    expect(new Date(t.waktu).getTime()).toBeGreaterThan(0)
  })

  it('bisa di-JSON-kan utuh — isinya ikut mengantre di localStorage', () => {
    const t = tandaJejak(sesi('jaya@warkop.id'), 'tambah', rincianTambah({ quantities:{ teh:2 }, expenses:[], cashIns:[] }))
    expect(JSON.parse(JSON.stringify(t))).toEqual(t)
  })
})

describe('rincian input', () => {
  it('hanya mencatat yang benar-benar diisi', () => {
    const r = rincianTambah({
      quantities: { kopilain: 3, teh: 0, vietnam: 0 },
      expenses: [{ desc:'Susu', amount:20000 }, { desc:'', amount:0 }],
      cashIns: [],
    })
    expect(r.qty).toEqual({ kopilain: 3 })
    expect(r.keluar).toEqual([{ ket:'Susu', jumlah:20000 }])
    expect(r.masuk).toEqual([])
  })

  it('voucher: cuma toko yang angkanya berubah', () => {
    const rows = [{ tokoId:'dadi', drop:50, laku:10 }, { tokoId:'dio', drop:0, laku:0 }]
    const sebelum = { dadi: { drop:50, laku:5 }, dio: { drop:0, laku:0 } }
    expect(rincianVoucher(rows, sebelum)).toEqual({ toko: [{ id:'dadi', drop:50, laku:10 }] })
  })

  it('voucher: simpan yang tidak mengubah apa pun tidak berjejak', () => {
    const rows = [{ tokoId:'dadi', drop:50, laku:5 }]
    expect(rincianVoucher(rows, { dadi: { drop:50, laku:5 } })).toBeNull()
    expect(rincianVoucher([{ tokoId:'dadi', drop:0, laku:0 }], undefined)).toBeNull()
  })
})

describe('apakah edit mengubah sesuatu', () => {
  const entri = (q, x) => ({ quantities:q, expenses:x })

  it('angka sama persis = tidak ada yang berubah', () => {
    expect(entriBerubah(entri({ teh:2 }, [{ desc:'Susu', amount:20000 }]),
                        entri({ teh:2 }, [{ desc:'Susu', amount:20000 }]))).toBe(false)
  })

  it('keterangan diperbaiki tanpa menggeser angka tetap terhitung berubah', () => {
    expect(entriBerubah(entri({ teh:2 }, [{ desc:'suus', amount:20000 }]),
                        entri({ teh:2 }, [{ desc:'Susu', amount:20000 }]))).toBe(true)
  })

  it('entri baru (sebelumnya belum ada) terhitung berubah', () => {
    expect(entriBerubah(null, entri({ teh:1 }, []))).toBe(true)
  })
})

describe('ringkasan yang dibaca orang', () => {
  it('input: jumlah per produk dan uangnya, dengan arah yang jelas', () => {
    const teks = ringkasJejak({ aksi:'tambah', rincian: rincianTambah({
      quantities:{ kopilain:3 },
      expenses:[{ desc:'Susu', amount:20000 }],
      cashIns:[{ desc:'Budi bayar hutang', amount:50000 }],
    })})
    expect(teks).toContain('3 Kopi Lain')
    expect(teks).toContain('−Rp20.000 Susu')
    expect(teks).toContain('+Rp50.000 Budi bayar hutang')
  })

  it('edit: menyebut angka sebelum dan sesudah, hanya yang bergeser', () => {
    const teks = ringkasJejak({ aksi:'ubah', rincian: rincianUbah(
      { totalPenjualan:96000, gaji:20000, totalPengeluaran:5000 },
      { totalPenjualan:80000, gaji:20000, totalPengeluaran:5000 },
    )})
    expect(teks).toBe('penjualan Rp96.000 → Rp80.000')
  })

  it('edit yang tidak menggeser angka mengaku apa adanya', () => {
    const sama = { totalPenjualan:96000, gaji:20000, totalPengeluaran:0 }
    expect(ringkasJejak({ aksi:'ubah', rincian: rincianUbah(sama, sama) }))
      .toBe('rincian dirapikan, angka tidak berubah')
  })

  it('hapus: menyebut berapa yang ikut hilang', () => {
    const teks = ringkasJejak({ aksi:'hapus', rincian: rincianHapus({ totalPenjualan:96000 }) })
    expect(teks).toContain('Rp96.000')
  })

  it('voucher: nama toko, bukan id-nya', () => {
    const teks = ringkasJejak({ aksi:'voucher', rincian:{ toko:[{ id:'hrahim', drop:0, laku:12 }] } })
    expect(teks).toBe('H Rahim laku 12')
  })

  it('saldo awal menyebut nilainya', () => {
    expect(ringkasJejak({ aksi:'saldo', rincian:{ nilai:500000 } })).toBe('saldo awal jadi Rp500.000')
  })

  it('aksi yang tidak dikenal tidak membuatnya meledak', () => {
    expect(ringkasJejak({ aksi:'entah', rincian:{} })).toBe('entah')
    expect(ringkasJejak(null)).toBe('—')
  })
})

describe('jam', () => {
  it('dua digit, jam lokal', () => {
    const d = new Date(2026, 8, 17, 9, 5)
    expect(jamJejak(d.toISOString())).toBe('09:05')
  })

  it('waktu rusak tidak menghasilkan "NaN:NaN"', () => {
    expect(jamJejak('bukan tanggal')).toBe('')
  })
})

describe('siapa saja yang menyentuh', () => {
  const jejak = {
    '2026-09-17': [
      { oleh:'Jaya', aksi:'tambah', waktu:'2026-09-17T01:00:00Z' },
      { oleh:'Jaya', aksi:'tambah', waktu:'2026-09-17T03:00:00Z' },
      { oleh:'Farid', aksi:'ubah',  waktu:'2026-09-17T05:00:00Z' },
    ],
    '2026-09-16': [{ oleh:'Jaya', aksi:'saldo', waktu:'2026-09-16T02:00:00Z', rincian:{ nilai:1000 } }],
  }

  it('diurut dari yang paling banyak menginput', () => {
    expect(pelakuHari(jejak['2026-09-17'])).toEqual([
      { nama:'Jaya', jumlah:2 }, { nama:'Farid', jumlah:1 },
    ])
  })

  it('sel CSV menyebut jumlahnya', () => {
    expect(ringkasPelaku(jejak['2026-09-17'])).toBe('Jaya (2×), Farid (1×)')
    expect(ringkasPelaku(undefined)).toBe('')
  })

  it('satu orang saja = nama tidak perlu dipajang di tiap baris', () => {
    expect(banyakPenginput({ '2026-09-16': jejak['2026-09-16'] })).toBe(false)
    expect(banyakPenginput(jejak)).toBe(true)
    expect(banyakPenginput({})).toBe(false)
  })

  it('jejak saldo terakhir diambil dari seluruh tanggal', () => {
    const j = jejakSaldoTerakhir(jejak)
    expect(j.oleh).toBe('Jaya')
    expect(jejakSaldoTerakhir({ '2026-09-17': jejak['2026-09-17'] })).toBeNull()
  })
})
