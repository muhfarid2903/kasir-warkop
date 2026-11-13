import { test, expect } from '@playwright/test'

// Alur utama kasir dari ujung ke ujung: masuk → ketuk 2 kopi → simpan →
// muncul di Riwayat → edit → hapus. Kalau ini patah, kasir tidak bisa bekerja.

const MO = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
const DAYS = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu']

test('masuk, simpan 2 kopi, lihat di Riwayat, edit, hapus', async ({ page }) => {
  // Tanggal "hari ini" menurut browser uji (zona Asia/Makassar).
  const hari = await page.evaluate(() => { const d = new Date(); return [d.getDate(), d.getMonth(), d.getDay()] })
  const labelHari = `${hari[0]} ${MO[hari[1]]} · ${DAYS[hari[2]]}`

  await page.goto('/')
  await expect(page.getByText('DATA TIRUAN')).toBeVisible()

  // Masuk dengan akun pemilik tiruan
  await page.getByRole('button', { name: 'Farid (pemilik)' }).click()
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()
  await expect(page.getByText('Kas Toko', { exact: true })).toBeVisible()

  // Data tiruan: kopi libur 45 hari terakhir, jadi kartunya terlipat dulu.
  const lipat = page.getByRole('button', { name: /Kopi & lainnya · sedang libur/ })
  if (await lipat.isVisible()) await lipat.click()

  const kopi = page.getByRole('button', { name: 'Tambah Kopi Lain' })
  await kopi.click()
  await kopi.click()
  await expect(page.locator('.produk-kartu .angka').first()).toHaveText('2')

  await page.getByRole('button', { name: /^Simpan/ }).click()
  await expect(page.locator('#toast')).toContainText(/Tersimpan|Ditambahkan/)
  await expect(page.locator('.date-hint')).toContainText('Kopi Lain ×2')

  // Riwayat: baris hari ini memuat kopinya
  await page.locator('.tab-btn', { hasText: 'Riwayat' }).click()
  const baris = page.locator('.history-item').filter({ hasText: labelHari })
  await expect(baris).toContainText('Kopi Lain ×2')

  // Edit tanpa perubahan → tersimpan, isinya tetap
  await baris.locator('.history-buka').click()
  await baris.getByRole('button', { name: 'Edit' }).click()
  await baris.getByRole('button', { name: 'Simpan Perubahan' }).click()
  await expect(page.locator('#toast')).toContainText('Perubahan disimpan')
  await expect(baris).toContainText('Kopi Lain ×2')

  // Hapus lewat lembar konfirmasi
  await baris.getByRole('button', { name: 'Hapus' }).click()
  const lembar = page.getByRole('dialog')
  await expect(lembar).toContainText('Hapus data')
  await lembar.getByRole('button', { name: 'Hapus' }).click()
  await expect(page.locator('#toast')).toContainText('dihapus')
  await expect(page.locator('.history-item').filter({ hasText: labelHari }).filter({ hasText: 'Kopi Lain ×2' })).toHaveCount(0)
})
