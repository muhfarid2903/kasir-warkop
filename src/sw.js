// Service worker: supaya app tetap bisa DIBUKA waktu sinyal warkop putus.
//
// Antrean di outbox.js sudah menjaga input yang sudah terlanjur diketik, tapi
// itu baru menolong kalau app-nya sempat terbuka. Tanpa berkas ini, membuka
// app tanpa sinyal cuma menghasilkan layar putih — dan kasir tidak punya
// tempat mengetik sama sekali.
//
// Berkas ini template: dua penanda di bawah (versi & daftar aset) diisi saat
// build oleh plugin kecil di vite.config.js, karena nama berkas hasil build
// ber-hash dan berubah tiap kali isinya berubah.
//
// Tidak memakai Workbox atau plugin PWA: yang dibutuhkan cuma dua aturan
// (kerangka app dari cache, data dari jaringan), dan dua aturan itu lebih
// mudah dibaca di sini daripada dicari di balik konfigurasi.

const VERSI = '__VERSI__';
const CACHE = 'warkop-' + VERSI;

// Kerangka app: HTML, JS, CSS. Font TIDAK diprecache — ada 98 berkas, 1,7 MB,
// dan hampir semuanya subset bahasa yang tidak pernah dipakai di sini.
// Font yang benar-benar dipakai ikut tersimpan sendiri lewat aturan
// cacheDulu() di bawah, pada pemakaian online pertama.
const ASET = __ASET__;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASET)));
});

self.addEventListener('activate', (e) => {
  // Sengaja tanpa skipWaiting/clients.claim: halaman yang SEDANG dipakai
  // tetap dilayani versi lamanya sampai ditutup. Menukar berkas di tengah
  // sesi bisa membuat JS baru bertemu HTML lama — di app kasir, layar yang
  // separuh rusak lebih berbahaya daripada versi yang telat satu buka.
  e.waitUntil((async () => {
    const nama = await caches.keys();
    await Promise.all(
      nama.filter(n => n.startsWith('warkop-') && n !== CACHE).map(n => caches.delete(n))
    );
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // Supabase lewat begitu saja. Data pembukuan tidak boleh dilayani dari
  // cache: angka basi yang tampil seperti angka benar itu justru yang paling
  // berbahaya — dan yang menangani kegagalannya sudah ada (badge Offline,
  // antrean outbox).
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') { e.respondWith(jaringanDulu(req)); return; }
  e.respondWith(cacheDulu(req));
});

// Halaman: jaringan dulu, cache sebagai jaring pengaman. Kebalikan dari aset —
// index.html namanya tidak ber-hash, jadi cache-first akan menahan versi lama
// terus-menerus walau sinyalnya sebenarnya bagus.
async function jaringanDulu(req) {
  const c = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) c.put('/index.html', res.clone());
    return res;
  } catch (_) {
    const simpanan = await c.match('/index.html');
    if (simpanan) return simpanan;
    throw _;
  }
}

// Aset: cache dulu. Namanya ber-hash, jadi isinya tidak mungkin berubah —
// yang berubah namanya, dan itu sudah pasti belum ada di cache.
async function cacheDulu(req) {
  const c = await caches.open(CACHE);
  const simpanan = await c.match(req);
  if (simpanan) return simpanan;
  const res = await fetch(req);
  if (res.ok && res.type === 'basic') c.put(req, res.clone());
  return res;
}
