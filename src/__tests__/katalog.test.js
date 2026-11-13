import { describe, it, expect, afterEach } from 'vitest'
import {
  hargaProduk, buildEntry, accumulateEntry, selisihInput, katalogSekarang, aturKatalog,
  periksaKatalog, kodeBaru, PRODUCTS, TOKO,
} from '../model.js'

// RENCANA 5.2 — pengaturan harga tanpa mengubah kode, tanpa mengubah riwayat.
const asli = katalogSekarang()
afterEach(() => { aturKatalog(asli) })

const naikHarga = () => {
  const k = katalogSekarang()
  const kopi = k.produk.find(p => p.id === 'kopilain')
  kopi.riwayat = [{ sejak: '2026-11-20', price: 7000, gaji: 1500 }]
  return k
}

describe('harga bertanggal', () => {
  it('harga baru hanya berlaku mulai tanggalnya', () => {
    expect(aturKatalog(naikHarga())).toBe(true)
    const kopi = PRODUCTS.find(p => p.id === 'kopilain')
    expect(hargaProduk(kopi, '2026-11-19')).toEqual({ price: 6000, gaji: 1300 })
    expect(hargaProduk(kopi, '2026-11-20')).toEqual({ price: 7000, gaji: 1500 })
  })

  it('edit hari lama tidak memakai harga baru', () => {
    aturKatalog(naikHarga())
    expect(buildEntry('2026-11-10', { kopilain: 3 }, []).totalPenjualan).toBe(18000)
    expect(buildEntry('2026-11-21', { kopilain: 3 }, []).totalPenjualan).toBe(21000)
  })

  it('selisih yang dikirim ke server memakai harga tanggal itu', () => {
    aturKatalog(naikHarga())
    expect(selisihInput('2026-11-21', { quantities: { kopilain: 2 } }).gaji).toBe(3000)
    expect(accumulateEntry(null, '2026-11-19', { quantities: { kopilain: 2 } }).gaji).toBe(2600)
  })
})

describe('periksaKatalog', () => {
  it('katalog bawaan sah', () => {
    expect(periksaKatalog(asli, asli)).toEqual([])
  })
  it('produk dan toko tidak boleh dihapus, cukup dinonaktifkan', () => {
    const k = katalogSekarang()
    k.produk = k.produk.filter(p => p.id !== 'teh')
    k.toko = k.toko.filter(t => t.id !== 'dio')
    const m = periksaKatalog(k, asli)
    expect(m.some(x => /Teh tidak boleh dihapus/.test(x))).toBe(true)
    expect(m.some(x => /Dio tidak boleh dihapus/.test(x))).toBe(true)
  })
  it('harga awal tidak boleh diubah — harus lewat harga baru bertanggal', () => {
    const k = katalogSekarang()
    k.produk.find(p => p.id === 'vietnam').price = 9000
    expect(periksaKatalog(k, asli).some(x => /harga awal tidak boleh diubah/.test(x))).toBe(true)
  })
  it('tarif voucher lama tidak boleh diubah', () => {
    const k = katalogSekarang()
    k.tarif[0] = { ...k.tarif[0], gaji: 600 }
    expect(periksaKatalog(k, asli)).toContain('Tarif voucher yang sudah dicatat tidak boleh diubah')
  })
  it('gaji tidak boleh melebihi harga; harga harus bulat positif', () => {
    const k = katalogSekarang()
    k.produk.push({ id: 'roti', name: 'Roti', price: 3000, gaji: 3000, aktif: true })
    k.produk.push({ id: 'susu', name: 'Susu', price: 0, gaji: 0, aktif: true })
    const m = periksaKatalog(k, asli)
    expect(m.some(x => /Roti: gaji/.test(x))).toBe(true)
    expect(m.some(x => /Susu: harga/.test(x))).toBe(true)
  })
  it('katalog yang tidak sah tidak dipasang', () => {
    const k = katalogSekarang(); k.produk = []
    expect(aturKatalog(k)).toBe(false)
    expect(PRODUCTS.length).toBe(asli.produk.length)
  })
  it('toko baru dan nonaktif dipasang di tempat', () => {
    const k = katalogSekarang()
    k.toko.push({ id: 'baru', name: 'Toko Baru', aktif: true })
    k.toko.find(t => t.id === 'nahrul').aktif = false
    expect(aturKatalog(k)).toBe(true)
    expect(TOKO.find(t => t.id === 'baru').name).toBe('Toko Baru')
    expect(TOKO.find(t => t.id === 'nahrul').aktif).toBe(false)
  })
})

describe('kodeBaru', () => {
  it('dari nama, unik', () => {
    expect(kodeBaru('Es Teh Manis', [])).toBe('esteh' + 'manis')
    expect(kodeBaru('Teh', ['teh'])).toBe('teh2')
    expect(kodeBaru('!!!', [])).toBe('baru')
  })
})

import { pisahPreset, PRESET_PENGELUARAN } from '../model.js'
describe('pilihan cepat pengeluaran', () => {
  it('koma, titik koma, dan baris baru sama-sama pemisah', () => {
    expect(pisahPreset('Susu, Air;Gelas\nSedotan')).toEqual(['Susu', 'Air', 'Gelas', 'Sedotan'])
  })
  it('teks yang sedang diketik ("Susu, ") tidak menghasilkan chip kosong', () => {
    expect(pisahPreset('Susu, ')).toEqual(['Susu'])
  })
  it('katalog lama berisi satu teks "Susu;Air;…" tampil sebagai chip terpisah', () => {
    const k = katalogSekarang(); k.preset = ['Susu;Air;Gelas;Sedotan;Gas;Kopi']
    expect(aturKatalog(k)).toBe(true)
    expect([...PRESET_PENGELUARAN]).toEqual(['Susu', 'Air', 'Gelas', 'Sedotan', 'Gas', 'Kopi'])
  })
  it('paling banyak 8, tanpa duplikat', () => {
    expect(pisahPreset('a,b,c,d,e,f,g,h,i,A')).toEqual(['a','b','c','d','e','f','g','h'])
  })
})
