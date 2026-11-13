// Toast menempel ke <div id="toast"> yang ada di index.html, bukan dirender
// React — supaya bisa dipanggil dari mana saja termasuk dari luar komponen.
//
// Dua jenis. 'info' hilang sendiri setelah 2,6 detik. 'gagal' berwarna merah
// dan BERTAHAN sampai diketuk: dulu keduanya tampil sama persis, jadi pesan
// "Gagal menyimpan" bisa lewat tanpa terbaca sambil melayani pembeli.

let toastTimer;

export function showToast(msg, jenis = 'info') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.toggle('gagal', jenis === 'gagal');
  t.classList.add('show');
  clearTimeout(toastTimer);
  if (jenis === 'gagal') {
    t.setAttribute('role', 'alert');
    t.onclick = () => t.classList.remove('show');
    return;
  }
  t.setAttribute('role', 'status');
  t.onclick = null;
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}
