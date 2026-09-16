// Product illustrations — silhouette stroke icons, dirancang per item agar
// identitasnya tetap kebaca di 12px (inline) maupun 24px (tile besar).
export const ProductIcon = ({type, size=20}) => {
  const s = {width:size,height:size,fill:"none",stroke:"currentColor",strokeWidth:1.7,strokeLinecap:"round",strokeLinejoin:"round",flexShrink:0,verticalAlign:"middle"};
  const P = {
    // Kopi Vietnam Drip — phin filter di atas gelas
    vietnam: <>
      <rect x="7" y="3" width="10" height="4.5" rx="0.6"/>
      <line x1="8" y1="5.3" x2="16" y2="5.3"/>
      <line x1="12" y1="7.5" x2="12" y2="9.5"/>
      <path d="M5.5 11h13v5.5a4 4 0 01-4 4H9.5a4 4 0 01-4-4z"/>
      <path d="M18.5 13h1.5a1.8 1.8 0 010 3.6h-1.5"/>
    </>,
    // Teh — cup dengan benang + tag tea bag menggantung
    teh: <>
      <path d="M4 9.5h12v5.5a4 4 0 01-4 4H8a4 4 0 01-4-4z"/>
      <path d="M16 11h1.8a1.8 1.8 0 010 3.6H16"/>
      <line x1="10" y1="3" x2="10" y2="9.5"/>
      <rect x="8" y="2" width="4" height="2.4" rx="0.4"/>
    </>,
    // Kopi Lain — mug standar + 2 uap (beda silhouette dari vietnam)
    kopilain: <>
      <path d="M5 8.5h11v8.5a3.5 3.5 0 01-3.5 3.5H8.5A3.5 3.5 0 015 17z"/>
      <path d="M16 10.5h1.7a2 2 0 010 4H16"/>
      <path d="M8 3.5c0 1.2 1 1.2 1 2.4s-1 1.2-1 2.4"/>
      <path d="M12 3c0 1.2 1 1.2 1 2.4s-1 1.2-1 2.4"/>
    </>,
    // Voucher 2000 — bentuk tiket bernotch + WiFi arc kecil di tengah
    v2k: <>
      <path d="M3 7.5v1.7a1.5 1.5 0 010 3v1.6a1.5 1.5 0 010 3v0a2 2 0 002 2h14a2 2 0 002-2v0a1.5 1.5 0 010-3v-1.6a1.5 1.5 0 010-3V7.5a2 2 0 00-2-2H5a2 2 0 00-2 2z"/>
      <path d="M9 14.5a3 3 0 016 0"/>
      <path d="M11 16.6a1 1 0 012 0"/>
    </>,
    // Paket Mingguan Lite — kalender + simbol "1 minggu" (bar 7-day)
    v10k: <>
      <rect x="3" y="5" width="18" height="16" rx="2"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
      <line x1="8" y1="3" x2="8" y2="7"/>
      <line x1="16" y1="3" x2="16" y2="7"/>
      <rect x="6" y="13" width="12" height="4" rx="0.6"/>
    </>,
    // Paket Bulanan — kalender + grid bulan penuh
    v1bln: <>
      <rect x="3" y="5" width="18" height="16" rx="2"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
      <line x1="8" y1="3" x2="8" y2="7"/>
      <line x1="16" y1="3" x2="16" y2="7"/>
      <line x1="3" y1="14.5" x2="21" y2="14.5"/>
      <line x1="3" y1="18" x2="21" y2="18"/>
      <line x1="9" y1="10" x2="9" y2="21"/>
      <line x1="15" y1="10" x2="15" y2="21"/>
    </>,
    // PS4 (1 Jam) — gamepad dengan d-pad kiri + tombol kanan
    ps4: <>
      <path d="M6 9c-2.2 0-4 1.6-4 4.2v2.8a2 2 0 002 2h1.6a1.6 1.6 0 001.5-1.1l.4-1.2A1.6 1.6 0 019 14.7h6a1.6 1.6 0 011.5 1l.4 1.2a1.6 1.6 0 001.5 1.1H20a2 2 0 002-2v-2.8C22 10.6 20.2 9 18 9z"/>
      <line x1="6.5" y1="12.3" x2="9" y2="12.3"/>
      <line x1="7.75" y1="11" x2="7.75" y2="13.6"/>
      <circle cx="16" cy="11.5" r="0.7"/>
      <circle cx="17.8" cy="12.8" r="0.7"/>
      <circle cx="14.2" cy="12.8" r="0.7"/>
      <circle cx="16" cy="14.1" r="0.7"/>
    </>,
  };
  if (!P[type]) return null;
  return <svg viewBox="0 0 24 24" style={s}>{P[type]}</svg>;
};
