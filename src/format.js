// Pemformatan untuk ditampilkan. Dipisah dari model.js: model menghitung angka,
// file ini cuma mengubah angka & tanggal jadi teks yang dibaca orang.

// Negatif ditulis "−Rp35.000", bukan "Rp-35.000": tanda di depan, dan memakai
// tanda minus sungguhan (U+2212) yang sama lebarnya dengan "+".
export const IDR = v => { const n = Math.round(v) || 0; return (n < 0 ? '−' : '') + 'Rp' + Math.abs(n).toLocaleString('id-ID'); };
export const DAYS = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
export const MO = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
export const ML = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
export function fmtDate(d) { const dt = new Date(d+'T00:00:00'); return DAYS[dt.getDay()]+', '+dt.getDate()+' '+MO[dt.getMonth()]+' '+dt.getFullYear(); }

// Tanggal pendek "16 Sep 2026" — dipakai tombol pemilih tanggal.
export function fmtDateShort(d) { const dt = new Date(d+'T00:00:00'); return dt.getDate()+' '+MO[dt.getMonth()]+' '+dt.getFullYear(); }

// Galat dari Supabase/jaringan dalam bahasa yang dipahami kasir. Yang tidak
// dikenali tetap disebut apa adanya di belakang, supaya masih bisa ditanyakan.
export function pesanGalat(e) {
  const m = String(e?.message || e || '');
  const kode = String(e?.code || '');
  if (/invalid login credentials/i.test(m)) return 'Email atau password salah';
  if (/email not confirmed/i.test(m)) return 'Email belum dikonfirmasi';
  if (/failed to fetch|network|load failed|timeout/i.test(m)) return 'Tidak tersambung ke internet';
  if (kode === 'PGRST301' || /jwt|token.*expired/i.test(m)) return 'Sesi habis, silakan masuk lagi';
  if (kode === '42501' || /row-level security/i.test(m)) return 'Akun ini tidak diizinkan melakukannya';
  if (/rate limit|too many/i.test(m)) return 'Terlalu sering dicoba, tunggu sebentar';
  return 'Terjadi kesalahan' + (m ? ' (' + m + ')' : '');
}
