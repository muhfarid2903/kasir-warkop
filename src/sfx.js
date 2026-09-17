// Bunyi kasir. Semua nada dibangkitkan Web Audio saat itu juga — tidak ada
// satu pun berkas .mp3 yang harus diunduh. WiFi warkop sering lambat, dan
// bunyi yang baru terdengar setelah filenya sampai bukan umpan balik lagi,
// cuma gema. Sintesis juga membuat tiap ketukan bisa digeser sedikit nadanya,
// jadi menambah sepuluh kopi berturut-turut tidak terdengar seperti mesin.
//
// Dua aturan yang tidak boleh dilanggar:
//   1. AudioContext baru dibangun saat sentuhan PERTAMA. Safari iOS memblokir
//      context yang lahir tanpa gestur, dan yang terblokir tetap bisu seumur
//      halaman — tidak ada cara membangunkannya lagi.
//   2. Semua lewat kompresor. Kasir menekan kartu bertubi-tubi; tanpa itu
//      nada yang menumpuk jadi pecah di speaker HP.

const KUNCI = 'suara';

let ctx = null;
let master = null;
let derau = null;
const terakhir = {};   // nama bunyi -> waktu main terakhir (peredam gebrakan)

// Menyala secara bawaan: yang minta fitur ini mau mendengarnya, bukan mencari
// saklarnya dulu. Yang mematikan sekali, tetap mati di kunjungan berikutnya.
let aktif = (() => {
  try { return localStorage.getItem(KUNCI) !== 'mati'; } catch (e) { return true; }
})();

export function suaraAktif() { return aktif; }

export function setSuaraAktif(nyala) {
  aktif = !!nyala;
  try { localStorage.setItem(KUNCI, aktif ? 'nyala' : 'mati'); } catch (e) {}
  if (aktif) bangunkan();
}

function konteks() {
  if (ctx) return ctx;
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  try { ctx = new AC(); } catch (e) { return null; }
  master = ctx.createGain();
  master.gain.value = .85;              // sengaja keras: warkop itu berisik
  const komp = ctx.createDynamicsCompressor();
  komp.threshold.value = -16; komp.knee.value = 24; komp.ratio.value = 6;
  komp.attack.value = .003; komp.release.value = .14;
  master.connect(komp);
  komp.connect(ctx.destination);
  return ctx;
}

// Dipanggil dari gestur pertama (lihat fx.js). Juga dipakai tiap kali app
// kembali terlihat: Android menidurkan context saat layar mati.
export function bangunkan() {
  if (!aktif) return;          // didiamkan: jangan bangun mesin audio sama sekali
  const c = konteks();
  if (c && c.state !== 'running') { try { c.resume(); } catch (e) {} }
}

// === Dua bahan dasar: nada dan desis ===
// Nada memberi warna (kayu, lonceng), desis memberi hentakan. Hampir semua
// bunyi di bawah cuma campuran keduanya dengan takaran berbeda.

function nada(c, { f, ke = null, jenis = 'sine', vol = .4, mulai = 0, panjang = .16 }) {
  const t0 = c.currentTime + mulai;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = jenis;
  osc.frequency.setValueAtTime(f, t0);
  if (ke) osc.frequency.exponentialRampToValueAtTime(ke, t0 + panjang);
  g.gain.setValueAtTime(.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + .005);   // serangan cepat = terasa seperti benda keras
  g.gain.exponentialRampToValueAtTime(.0001, t0 + panjang);
  osc.connect(g); g.connect(master);
  osc.start(t0); osc.stop(t0 + panjang + .03);
}

// Satu buffer derau dipakai ulang seumur halaman. Membuat Float32Array baru
// tiap ketikan bikin sampah memori di tengah orang mengetik — persis saat
// jeda sekecil apa pun paling kelihatan.
function bufferDerau(c) {
  if (derau) return derau;
  const n = Math.floor(c.sampleRate * .25);
  derau = c.createBuffer(1, n, c.sampleRate);
  const d = derau.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return derau;
}

function desis(c, { vol = .3, mulai = 0, panjang = .04, warna = 2400, q = 1.4 }) {
  const t0 = c.currentTime + mulai;
  const src = c.createBufferSource();
  src.buffer = bufferDerau(c); src.loop = true;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = warna; bp.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(.0001, t0 + panjang);
  src.connect(bp); bp.connect(g); g.connect(master);
  src.start(t0, Math.random() * .2);    // titik mulai acak — tiap ketikan beda
  src.stop(t0 + panjang + .03);
}

const goyang = (f, lebar = .03) => f * (1 + (Math.random() - .5) * lebar);

// === Kamus bunyi ===
// Nama dipakai apa adanya oleh fx.js dan halaman. Semuanya di bawah 0,8 detik:
// umpan balik yang masih berbunyi saat ketukan berikutnya datang bukan umpan
// balik, tapi gangguan.
const RESEP = {
  // +1 produk. Marimba kayu: nada pokok, oktafnya sebagai kilau, ketukan tipis.
  ketuk: (c, k) => {
    const f = goyang(784);
    nada(c, { f, jenis: 'triangle', vol: .50 * k, panjang: .15 });
    nada(c, { f: f * 2, jenis: 'sine', vol: .16 * k, panjang: .09 });
    desis(c, { vol: .10 * k, panjang: .018, warna: 4200, q: .9 });
  },
  // −1. Turun nadanya, supaya telinga tahu arahnya tanpa melihat layar.
  kurang: (c, k) => {
    nada(c, { f: 560, ke: 392, jenis: 'triangle', vol: .34 * k, panjang: .13 });
    desis(c, { vol: .07 * k, panjang: .016, warna: 2600 });
  },
  // Tombol biasa — lebih redup dari ketuk supaya kartu produk tetap yang
  // paling menonjol; itu yang ditekan ratusan kali sehari.
  klik: (c, k) => {
    nada(c, { f: goyang(620), jenis: 'triangle', vol: .34 * k, panjang: .10 });
    desis(c, { vol: .11 * k, panjang: .016, warna: 3400 });
  },
  // Ketikan: hentakan tombol (desis) + badan tuts (nada rendah pendek).
  ketik: (c, k) => {
    desis(c, { vol: .40 * k, panjang: .022, warna: goyang(2600, .25), q: 1.6 });
    nada(c, { f: goyang(168, .12), jenis: 'sine', vol: .30 * k, panjang: .045 });
  },
  hapus: (c, k) => {
    desis(c, { vol: .34 * k, panjang: .030, warna: goyang(1400, .2), q: 1.2 });
    nada(c, { f: goyang(120, .1), jenis: 'sine', vol: .30 * k, panjang: .06 });
  },
  spasi: (c, k) => {
    desis(c, { vol: .30 * k, panjang: .026, warna: goyang(1900, .2), q: 1.1 });
    nada(c, { f: goyang(132, .08), jenis: 'sine', vol: .32 * k, panjang: .055 });
  },
  enter: (c, k) => {
    nada(c, { f: 660, jenis: 'triangle', vol: .34 * k, panjang: .10 });
    nada(c, { f: 988, jenis: 'triangle', vol: .28 * k, mulai: .055, panjang: .13 });
  },
  // Pindah halaman: naik, seperti pintu yang dibuka.
  pindah: (c, k) => {
    nada(c, { f: 523, ke: 784, jenis: 'sine', vol: .36 * k, panjang: .17 });
    nada(c, { f: 1046, jenis: 'sine', vol: .12 * k, mulai: .06, panjang: .18 });
  },
  // Menekan Simpan: berat, rendah — belum selesai, baru ditekan.
  tekan: (c, k) => {
    nada(c, { f: 220, ke: 165, jenis: 'sine', vol: .45 * k, panjang: .18 });
    nada(c, { f: 440, jenis: 'triangle', vol: .22 * k, panjang: .10 });
  },
  // Tersimpan. Satu-satunya bunyi panjang di app ini, dan memang harus:
  // inilah momen yang ditunggu — uang hari itu sudah tercatat.
  simpan: (c, k) => {
    [[784, 0], [1046, .085], [1318, .17]].forEach(([f, t]) => {
      nada(c, { f, jenis: 'triangle', vol: .42 * k, mulai: t, panjang: .30 });
      nada(c, { f: f * 2, jenis: 'sine', vol: .10 * k, mulai: t, panjang: .22 });
    });
    nada(c, { f: 1568, jenis: 'sine', vol: .22 * k, mulai: .25, panjang: .55 });
    nada(c, { f: 110, jenis: 'sine', vol: .40 * k, panjang: .40 });
  },
  gagal: (c, k) => {
    nada(c, { f: 330, jenis: 'triangle', vol: .38 * k, panjang: .14 });
    nada(c, { f: 247, jenis: 'triangle', vol: .38 * k, mulai: .11, panjang: .22 });
    nada(c, { f: 98,  jenis: 'sine',     vol: .30 * k, panjang: .26 });
  },
  alih: (c, k) => {
    nada(c, { f: 880, jenis: 'sine', vol: .34 * k, panjang: .09 });
    nada(c, { f: 1318, jenis: 'sine', vol: .18 * k, mulai: .05, panjang: .10 });
  },
  // Masuk ke kolom isian — nyaris berbisik, cuma penanda kursor mendarat.
  fokus: (c, k) => {
    nada(c, { f: 1200, jenis: 'sine', vol: .14 * k, panjang: .06 });
  },
};

// Pemutar tunggal. `kuat` dipakai untuk menurunkan volume tanpa mengganti
// bunyi — misalnya tombol yang ditahan sampai auto-repeat menyala.
export function bunyi(nama, kuat = 1) {
  if (!aktif) return;
  const resep = RESEP[nama];
  if (!resep) return;
  const c = konteks();
  if (!c) return;
  if (c.state !== 'running') { try { c.resume(); } catch (e) {} }
  // Dua bunyi sama dalam 18ms tidak terdengar sebagai dua, cuma jadi keras.
  // Batasnya sengaja serendah ini: mengetik cepat pun jaraknya 60ms lebih,
  // jadi yang terpotong cuma tumpukan yang memang tidak manusiawi.
  const now = Date.now();
  if (now - (terakhir[nama] || 0) < 18) return;
  terakhir[nama] = now;
  try { resep(c, kuat); } catch (e) {}
}
