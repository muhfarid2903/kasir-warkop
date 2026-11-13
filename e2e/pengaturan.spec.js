import { test, expect } from '@playwright/test'

// Pengaturan: harga baru berlaku mulai besok, jadi harga hari ini TIDAK
// berubah. Kalau ini patah, mengubah harga bisa diam-diam mengubah Kas.
test('ubah harga mulai besok tidak mengubah harga hari ini', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Farid (pemilik)' }).click()
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()
  await expect(page.getByText('Kas Toko', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Akun' }).click()
  await page.getByRole('menuitem', { name: 'Pengaturan' }).click()
  await expect(page.locator('.header-page-title')).toHaveText('Pengaturan')

  const kopi = page.locator('.atur-baris').filter({ hasText: 'Kopi Lain' })
  await kopi.getByRole('button', { name: 'Ubah harga' }).click()
  const nominal = kopi.locator('.atur-form input.nominal')
  await nominal.nth(0).fill('7000')
  await nominal.nth(1).fill('1500')
  await kopi.getByRole('button', { name: 'Tambahkan' }).click()
  await expect(kopi).toContainText('Rp7.000')

  await page.getByRole('button', { name: 'Simpan pengaturan' }).click()
  await expect(page.locator('#toast')).toContainText('Pengaturan tersimpan')

  // Hari ini: harga lama
  await page.locator('.tab-btn', { hasText: 'Hari Ini' }).click()
  const lipat = page.getByRole('button', { name: /Kopi & lainnya · sedang libur/ })
  if (await lipat.isVisible()) await lipat.click()
  await expect(page.getByRole('button', { name: 'Tambah Kopi Lain' })).toContainText('Rp6.000')
})
