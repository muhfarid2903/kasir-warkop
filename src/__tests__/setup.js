// localStorage tiruan untuk lingkungan Node.
const isi = new Map()
globalThis.localStorage = {
  getItem: (k) => (isi.has(k) ? isi.get(k) : null),
  setItem: (k, v) => isi.set(k, String(v)),
  removeItem: (k) => isi.delete(k),
  clear: () => isi.clear(),
}
