#!/usr/bin/env node
// Ubah berkas cadangan (Menu akun → Unduh cadangan) menjadi SQL pemulihan
// yang tinggal ditempel di Supabase SQL Editor.
//
//   node scripts/cadangan-ke-sql.mjs cadangan-warkopsaja-2026-11-14.json > pulihkan.sql
//
// Sifatnya MENGEMBALIKAN, bukan menghapus: baris yang ada di cadangan ditulis
// ulang (upsert) dengan isi cadangan; baris yang dibuat SESUDAH cadangan
// dibiarkan. Jejak dan pencocokan kas yang sudah ada tidak diduplikasi.
// Baca dulu hasilnya sebelum dijalankan.

import { readFileSync } from 'node:fs'

const berkas = process.argv[2]
if (!berkas) { console.error('Pakai: node scripts/cadangan-ke-sql.mjs <berkas-cadangan.json>'); process.exit(1) }
const c = JSON.parse(readFileSync(berkas, 'utf8'))
if (c.app !== 'kasir-warkop' || !c.tabel) { console.error('Bukan berkas cadangan Warkopsaja.'); process.exit(1) }
if (c.tiruan) console.error('PERINGATAN: berkas ini dari database TIRUAN (npm run dev), bukan data asli.')

// Angka & boolean ditulis sebagai literal berkutip ('1000000'): Postgres
// menyesuaikannya ke tipe kolom apa pun (numeric, text, jsonb, boolean), jadi
// skrip ini tidak perlu tahu tipe tiap kolom.
const lit = (v) => {
  if (v === null || v === undefined) return 'null'
  if (typeof v === 'number' || typeof v === 'boolean') return "'" + String(v) + "'"
  if (typeof v === 'object') return "'" + JSON.stringify(v).replace(/'/g, "''") + "'::jsonb"
  return "'" + String(v).replace(/'/g, "''") + "'"
}

const keluar = []
const tulis = (s) => keluar.push(s)
tulis('-- Pemulihan dari cadangan ' + (c.dibuat || '') + '. Dibuat oleh scripts/cadangan-ke-sql.mjs.')
tulis('begin;')

function upsert(tabel, baris, kunci, kolomUbah) {
  if (!baris?.length) return
  tulis(`\n-- ${tabel}: ${baris.length} baris`)
  const kolom = Object.keys(baris[0])
  for (const b of baris) {
    const set = kolomUbah ? kolomUbah.filter(k => kolom.includes(k)).map(k => `${k} = excluded.${k}`).join(', ') : null
    tulis(`insert into public.${tabel} (${kolom.join(', ')}) values (${kolom.map(k => lit(b[k])).join(', ')})` +
      (set ? ` on conflict (${kunci}) do update set ${set};` : ` on conflict (${kunci}) do nothing;`))
  }
}

upsert('entries', c.tabel.entries, 'date', ['quantities', 'expenses', 'total_penjualan', 'gaji', 'total_pengeluaran', 'sisa_kas'])
upsert('voucher_toko', (c.tabel.voucher_toko || []).map(({ updated_at: _diabaikan, ...r }) => r), 'date, toko_id', ['drop_qty', 'laku_qty', 'ke_pemilik'])
upsert('config', c.tabel.config, 'key', ['value'])

// Kolom identitas (id) dibuat database; tulis ulang id aslinya supaya baris
// yang sama tidak terduplikasi bila pemulihan dijalankan dua kali.
for (const [tabel, buang] of [['jejak', ['diterima']], ['hitung_kas', ['selisih']]]) {
  const baris = (c.tabel[tabel] || []).map(r => { const x = { ...r }; buang.forEach(k => delete x[k]); return x })
  if (!baris.length) continue
  tulis(`\n-- ${tabel}: ${baris.length} baris`)
  const kolom = Object.keys(baris[0])
  for (const b of baris) {
    tulis(`insert into public.${tabel} (${kolom.join(', ')}) overriding system value values (${kolom.map(k => lit(b[k])).join(', ')}) on conflict (id) do nothing;`)
  }
  tulis(`select setval(pg_get_serial_sequence('public.${tabel}', 'id'), greatest((select max(id) from public.${tabel}), 1));`)
}

tulis('\ncommit;')
process.stdout.write(keluar.join('\n') + '\n')
