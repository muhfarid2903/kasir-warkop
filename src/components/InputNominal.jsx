// Kolom nominal Rupiah. Dulu <input type="number"> polos: "105000" tanpa
// pemisah, dan nol yang kurang atau lebih satu tidak kelihatan. Sekarang
// angkanya tampil "105.000" selagi diketik, dan tombol 000 di dalam kolom
// menghemat tiga ketukan untuk nominal ribuan yang hampir selalu begitu.
//
// value dan onChange selalu angka (bukan teks), jadi pemanggil tidak perlu
// parseInt sendiri.

export const BATAS_YAKIN = 5000000;   // di atas ini Simpan minta ketukan kedua

export function InputNominal({ value, onChange, className = 'expense-amount', placeholder = 'Jumlah', id, autoFocus, onKeyDown, ariaLabel }) {
  const angka = Number(value) || 0;
  const tampil = angka ? angka.toLocaleString('id-ID') : '';
  const ubah = (teks) => {
    const n = parseInt(String(teks).replace(/\D/g, ''), 10);
    onChange(Number.isFinite(n) ? n : 0);
  };
  return (
    <span className="nominal-wrap">
      <input
        id={id}
        className={className + ' nominal'}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoFocus={autoFocus}
        value={tampil}
        onChange={e => ubah(e.target.value)}
        onFocus={e => { const el = e.target; setTimeout(() => { try { el.select(); } catch (_) {} }, 0); }}
        onKeyDown={onKeyDown}
      />
      <button
        type="button"
        className="tombol-000"
        tabIndex={-1}
        aria-label="Tambah tiga nol"
        // pointerdown + preventDefault: kolomnya tidak kehilangan fokus, jadi
        // keyboard HP tidak turun-naik tiap tombol ini diketuk.
        onPointerDown={e => e.preventDefault()}
        onClick={() => onChange(angka * 1000)}
      >000</button>
    </span>
  );
}
