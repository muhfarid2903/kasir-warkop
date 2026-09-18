import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Plugin kecil pengganti vite-plugin-pwa: menyalin src/sw.js ke dist/sw.js
// sambil mengisi daftar berkas hasil build. Nama berkas build ber-hash, jadi
// daftarnya memang tidak bisa ditulis tangan.
//
// Dipisah dari plugin PWA yang sudah jadi karena aturannya cuma dua (lihat
// src/sw.js) sementara plugin itu membawa Workbox — 1 dependensi runtime lagi
// yang harus ikut dijaga versinya di app tanpa backend ini.
function serviceWorker() {
  return {
    name: 'warkop-service-worker',
    apply: 'build',
    generateBundle(_opsi, bundle) {
      // '/' ikut disebut: itu alamat yang benar-benar dibuka orang, dan
      // cache tidak menyamakannya sendiri dengan '/index.html'.
      const aset = ['/', '/index.html', ...Object.keys(bundle)
        .filter(f => f.endsWith('.js') || f.endsWith('.css'))
        .map(f => '/' + f)
        .sort()]
      // Versi = sidik jari daftarnya. Berubah hanya kalau ada berkas yang
      // benar-benar berubah, jadi build yang isinya sama tidak memaksa
      // seluruh HP mengunduh ulang.
      const versi = createHash('sha1').update(aset.join('\n')).digest('hex').slice(0, 12)
      const isi = readFileSync('src/sw.js', 'utf8')
        .replaceAll('__VERSI__', versi)
        .replaceAll('__ASET__', JSON.stringify(aset, null, 2))
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: isi })
    },
  }
}

export default defineConfig({
  plugins: [react(), serviceWorker()],
  server: {
    port: 5173,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
