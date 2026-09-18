import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { showToast } from './toast.js'
// Font di-bundle lewat @fontsource — pengganti Google Fonts CDN. Warung kopi
// sering pakai WiFi lambat: satu permintaan ke host pihak ketiga yang gagal
// bikin teks kedip ganti font, atau app terasa menggantung saat dibuka.
import '@fontsource/inter/400.css'
import '@fontsource/inter/400-italic.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/inter/800.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import './styles.css'

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)

// Service worker — kerangka app disimpan di HP supaya tetap bisa dibuka waktu
// sinyal putus (lihat src/sw.js). Hanya di hasil build: saat `npm run dev`
// berkasnya belum dibuat, dan SW yang nyangkut malah menyajikan versi basi ke
// layar yang sedang dikerjakan.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const baru = reg.installing
        if (!baru) return
        baru.addEventListener('statechange', () => {
          // controller ada = ini bukan pemasangan pertama, melainkan versi
          // baru yang menunggu. Sengaja tidak menyela sendiri: yang menentukan
          // kapan bertukar tetap orangnya, bukan app yang tiba-tiba memuat
          // ulang di tengah input.
          if (baru.state === 'installed' && navigator.serviceWorker.controller) {
            showToast('Versi baru sudah diunduh — tutup lalu buka lagi app')
          }
        })
      })
    }).catch(() => {})
  })
}
