// Tanda warkop: monogram w̲s̅ di atas keping terang. Sumbernya satu berkas,
// public/icon.svg — berkas yang sama dipakai favicon, ikon layar utama HP,
// dan ikon APK (lihat public/manifest.webmanifest). Kalau logonya berganti,
// yang diganti cuma berkas itu.
//
// Dimuat sebagai <img>, bukan disalin jadi JSX seperti ikon lain di Icon.jsx:
// tanda ini punya warnanya sendiri dan tidak pernah mengikuti currentColor,
// jadi tidak ada yang perlu diwariskan dari CSS.
export const Logo = ({ size = 38, radius }) => (
  <img
    src="/icon.svg"
    alt=""
    width={size}
    height={size}
    className="logo-mark"
    style={{ borderRadius: radius ?? Math.round(size * 0.28) }}
    draggable="false"
  />
);
