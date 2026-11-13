import { describe, it, expect, beforeEach, vi } from 'vitest'

// Pengaman fungsi server: kalau tambah_entri (atau fungsi lain) gagal karena
// galat SQL di dalamnya, simpan TIDAK boleh ikut gagal — app beralih ke cara
// lama dan melaporkannya. Kafe buka lagi; kasir harus tetap bisa menyimpan.

const panggilan = []
let galatRpc = null
const pembuat = (tabel) => {
  const q = {
    select: () => q, eq: () => q, order: () => q,
    maybeSingle: async () => { panggilan.push(['baca', tabel]); return { data: null, error: null } },
    upsert: async (row) => { panggilan.push(['upsert', tabel, row]); return { error: null } },
    insert: async (row) => { panggilan.push(['insert', tabel, row]); return { error: null } },
  }
  return q
}
const sbPalsu = {
  rpc: async (nama) => { panggilan.push(['rpc', nama]); return { data: null, error: galatRpc } },
  from: pembuat,
  auth: { getSession: async () => ({ data: {} }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
}
vi.mock('@supabase/supabase-js', () => ({ createClient: () => sbPalsu }))

const db = await import('../db.js')
const dilaporkan = []
db.aturPelaporFungsiRusak((nama, e) => dilaporkan.push([nama, e.code]))

beforeEach(() => { panggilan.length = 0 })

describe('tambah_entri rusak di server', () => {
  it('galat SQL (mis. operator tak dikenal) -> cara lama dipakai, simpan berhasil, dilaporkan', async () => {
    galatRpc = { code: '42883', message: 'operator does not exist: json || json' }
    const e = await db.commitEntryAddition('2026-11-15', { quantities: { kopilain: 2 }, expenses: [], cashIns: [] }, { aksi: 'tambah', oleh: 'Jaya', waktu: new Date().toISOString() }, 'id-1')
    expect(e.quantities.kopilain).toBe(2)
    expect(panggilan.some(p => p[0] === 'upsert' && p[1] === 'entries')).toBe(true)
    expect(dilaporkan).toContainEqual(['tambah_entri', '42883'])
  })

  it('sesudah itu tidak dicoba lagi di sesi yang sama', async () => {
    await db.commitEntryAddition('2026-11-15', { quantities: { kopilain: 1 } }, null, 'id-2')
    expect(panggilan.filter(p => p[0] === 'rpc')).toHaveLength(0)
  })
})

describe('penolakan izin tetap penolakan', () => {
  it('42501 tidak dialihkan ke cara lama', async () => {
    galatRpc = { code: '42501', message: 'Akun ini tidak diizinkan menghapus hari' }
    await expect(db.deleteEntry('2026-11-15', null)).rejects.toMatchObject({ code: '42501' })
  })
})
