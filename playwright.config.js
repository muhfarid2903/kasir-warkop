import { defineConfig, devices } from '@playwright/test'

// Uji asap di browser sungguhan, di atas DATABASE TIRUAN (`vite` = dev =
// src/db.tiruan.js). Tidak pernah menyentuh Supabase. Tiap uji mendapat
// browser bersih, jadi database tiruannya dibibit ulang dari nol.
export default defineConfig({
  testDir: 'e2e',
  timeout: 30000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:5190',
    // Ukuran HP: tab bar bawah dan tombol Simpan mengambang ikut teruji.
    ...devices['Pixel 7'],
    locale: 'id-ID',
    timezoneId: 'Asia/Makassar',
  },
  projects: [{ name: 'hp', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'npx vite --port 5190 --strictPort',
    url: 'http://localhost:5190',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
})
