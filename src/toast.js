// Toast menempel ke <div id="toast"> yang ada di index.html, bukan dirender
// React — supaya bisa dipanggil dari mana saja termasuk dari luar komponen.

let toastTimer;

export function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}
