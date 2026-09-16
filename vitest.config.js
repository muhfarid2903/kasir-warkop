import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Node saja: yang diuji fungsi murni di model.js dan antrean di outbox.js,
    // keduanya tidak menyentuh DOM. Komponen diverifikasi lewat browser.
    environment: 'node',
    // outbox.js menyimpan antrean di localStorage; di Node belum ada, jadi
    // disediakan tiruan sederhana sebelum tiap berkas tes dijalankan.
    setupFiles: ['./src/__tests__/setup.js'],
    include: ['src/__tests__/**/*.test.js'],
  },
})
