// Toast menempel ke <div id="toast"> yang ada di index.html, bukan dirender
// React — supaya bisa dipanggil dari mana saja termasuk dari luar komponen.
//
// Dua jenis. 'info' hilang sendiri setelah 2,6 detik. 'gagal' berwarna merah
// dan BERTAHAN sampai diketuk: dulu keduanya tampil sama persis, jadi pesan
// "Gagal menyimpan" bisa lewat tanpa terbaca sambil melayani pembeli.
//
// Toast boleh membawa satu tombol aksi ({ label, fn }) — dipakai untuk
// Batalkan/Urungkan. Toast beraksi bertahan 8 detik: cukup untuk menyadari
// salah ketuk, tidak cukup lama untuk menghalangi.

let toastTimer;

export function showToast(msg, jenis = 'info', aksi = null) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = '';
  const teks = document.createElement('span');
  teks.textContent = msg;
  t.appendChild(teks);
  t.classList.toggle('gagal', jenis === 'gagal');
  t.classList.toggle('beraksi', !!aksi);
  clearTimeout(toastTimer);
  const tutup = () => { t.classList.remove('show'); clearTimeout(toastTimer); };
  if (aksi) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'toast-aksi';
    b.textContent = aksi.label;
    b.onclick = (e) => { e.stopPropagation(); tutup(); aksi.fn(); };
    t.appendChild(b);
  }
  t.classList.add('show');
  if (jenis === 'gagal') {
    t.setAttribute('role', 'alert');
    t.onclick = tutup;
    return;
  }
  t.setAttribute('role', 'status');
  t.onclick = null;
  toastTimer = setTimeout(tutup, aksi ? 8000 : 2600);
}
