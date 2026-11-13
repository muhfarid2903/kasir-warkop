import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { modeTiruan } from './db.js'
// Font di-bundle lewat @fontsource — pengganti Google Fonts CDN. Warung kopi
// sering pakai WiFi lambat: satu permintaan ke host pihak ketiga yang gagal
// bikin teks kedip ganti font, atau app terasa menggantung saat dibuka.
//
// Subset latin saja: berkas tanpa awalan memuat @font-face untuk cyrillic,
// greek, vietnamese, dst. — 102 berkas font dan CSS 101 KB untuk aksara yang
// tidak pernah tampil di sini. Inter 800 dibuang: tidak dipakai di mana pun.
// JetBrains Mono juga dibuang: angka kini memakai Inter dengan angka tabular.
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-400-italic.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/latin-700.css'
import './styles.css'

// Versi baru sudah diunduh. Dulu cuma toast 2,6 detik yang mudah terlewat;
// sekarang pita yang menetap sampai orangnya memilih. Memuat ulang aman
// karena draf Hari Ini tersimpan di HP (src/draf.js).
//
// Memuat ulang saja tidak cukup: service worker sengaja tidak mengambil alih
// sendiri (lihat src/sw.js), jadi versi baru menunggu sampai semua jendela
// app tertutup. Tombol ini memintanya mengambil alih sekarang — atas pilihan
// orangnya, bukan diam-diam di tengah input — lalu memuat ulang.
function pasangPitaVersi(reg) {
  if (document.querySelector('.pita-versi')) return
  const pita = document.createElement('div')
  pita.className = 'pita-versi'
  pita.setAttribute('role', 'status')
  const teks = document.createElement('span')
  teks.textContent = 'Versi baru siap dipakai'
  const tombol = document.createElement('button')
  tombol.type = 'button'
  tombol.textContent = 'Muat ulang'
  tombol.onclick = () => {
    tombol.disabled = true
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true })
    if (reg.waiting) reg.waiting.postMessage('pakaiVersiBaru')
    else window.location.reload()
    // Jaring pengaman: kalau pergantiannya tidak terjadi, tetap muat ulang.
    setTimeout(() => window.location.reload(), 3000)
  }
  pita.append(teks, tombol)
  document.body.appendChild(pita)
}

// Pita di atas layar selama memakai database tiruan. Sengaja di luar React
// dan dipasang dari sini, supaya tampil di SEMUA layar — termasuk layar masuk
// dan layar galat — dan tidak ada orang yang mengira sedang melihat angka asli.
if (modeTiruan) {
  const pita = document.createElement('div')
  pita.className = 'pita-tiruan'
  pita.textContent = 'DATA TIRUAN · bukan pembukuan asli'
  document.body.prepend(pita)
}

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
            pasangPitaVersi(reg)
          }
        })
      })
    }).catch(() => {})
  })
}
