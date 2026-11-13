import { describe, it, expect } from 'vitest'
import { IDR, pesanGalat } from '../format.js'

describe('IDR', () => {
  it('tanda minus di depan Rp, bukan di tengah', () => {
    expect(IDR(-35000)).toBe('−Rp35.000')
    expect(IDR(35000)).toBe('Rp35.000')
    expect(IDR(0)).toBe('Rp0')
  })
  it('tidak pernah menulis "−Rp0" untuk nol hasil pembulatan', () => {
    expect(IDR(-0.4)).toBe('Rp0')
  })
})

describe('pesanGalat', () => {
  it('menerjemahkan galat yang paling sering', () => {
    expect(pesanGalat(new Error('Invalid login credentials'))).toBe('Email atau password salah')
    expect(pesanGalat(new TypeError('Failed to fetch'))).toBe('Tidak tersambung ke internet')
    expect(pesanGalat({ code: 'PGRST301', message: 'JWT expired' })).toBe('Sesi habis, silakan masuk lagi')
    expect(pesanGalat({ code: '42501', message: 'new row violates row-level security policy' })).toBe('Akun ini tidak diizinkan melakukannya')
  })
  it('yang tidak dikenal tetap menyebut teks aslinya', () => {
    expect(pesanGalat(new Error('duplicate key'))).toBe('Terjadi kesalahan (duplicate key)')
  })
})
