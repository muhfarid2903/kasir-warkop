// Pemformatan untuk ditampilkan. Dipisah dari model.js: model menghitung angka,
// file ini cuma mengubah angka & tanggal jadi teks yang dibaca orang.

export const IDR = v => 'Rp' + Math.round(v).toLocaleString('id-ID');
export const DAYS = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
export const MO = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
export const ML = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
export function fmtDate(d) { const dt = new Date(d+'T00:00:00'); return DAYS[dt.getDay()]+', '+dt.getDate()+' '+MO[dt.getMonth()]+' '+dt.getFullYear(); }

// Tanggal pendek "16 Sep 2026" — dipakai tombol pemilih tanggal.
export function fmtDateShort(d) { const dt = new Date(d+'T00:00:00'); return dt.getDate()+' '+MO[dt.getMonth()]+' '+dt.getFullYear(); }
