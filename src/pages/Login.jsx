import { useState } from 'react'
import { signIn, kirimTautanPassword, modeTiruan, AKUN_TIRUAN } from '../db.js'
import { pesanGalat } from '../format.js'
import { Logo } from '../components/Logo.jsx'
import { Icon } from '../components/Icon.jsx'

// Hanya masuk, tidak ada daftar. Pendaftaran publik dimatikan di Supabase
// (Authentication → Allow new users to sign up), jadi tombol "Daftar" cuma
// akan menghasilkan error. Akun baru dibuat dari Supabase Dashboard →
// Authentication → Add user.
export default function LoginScreen({ onSession }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [lihat, setLihat] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  // 'masuk' | 'lupa' | 'terkirim'
  const [mode, setMode] = useState('masuk');

  async function submit(e) {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      if (mode === 'lupa') { await kirimTautanPassword(email.trim()); setMode('terkirim'); }
      else onSession(await signIn(email, password));
    } catch(ex) { setErr(pesanGalat(ex)); }
    setBusy(false);
  }

  return (
    <div className="app">
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",padding:"40px 20px"}}>
        <form onSubmit={submit} style={{width:400,maxWidth:"100%"}}>
          <div className="login-hero">
            <div className="login-hero-logo"><Logo size={68} radius={20}/></div>
            <h1 className="login-hero-title">Warkopsaja</h1>
            <p className="login-hero-tag">{mode === 'masuk' ? 'Catat hari, lihat hasilnya.' : 'Atur ulang password'}</p>
          </div>
          <div className="card" style={{margin:0,padding:"28px 26px"}}>
            {mode === 'terkirim' ? (
              <>
                <p className="lembar-pengantar">
                  Kalau <strong>{email}</strong> terdaftar, tautan untuk membuat password baru sudah dikirim ke sana.
                  Buka emailnya di HP ini, lalu ketuk tautannya.
                </p>
                <p className="lembar-pengantar">Tidak ada di kotak masuk? Periksa folder Spam, atau tunggu beberapa menit.</p>
                <button type="button" className="btn-save" onClick={()=>{ setMode('masuk'); setErr(''); }}>Kembali ke Masuk</button>
              </>
            ) : (
              <>
                <div className="form-group">
                  <label className="form-label" htmlFor="login-email">Email</label>
                  <input id="login-email" className="form-input" type="email" name="email" autoComplete="username" required autoFocus value={email} onChange={e=>setEmail(e.target.value)} placeholder="nama@contoh.com"/>
                </div>
                {mode === 'masuk' && (
                  <div className="form-group">
                    <label className="form-label" htmlFor="login-password">Password</label>
                    <div className="password-wrap">
                      <input id="login-password" className="form-input" type={lihat ? 'text' : 'password'} name="password" autoComplete="current-password" required minLength={6} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Minimal 6 karakter"/>
                      <button type="button" className="password-lihat" aria-label={lihat ? 'Sembunyikan password' : 'Lihat password'} aria-pressed={lihat} onClick={()=>setLihat(v=>!v)}>
                        <Icon type={lihat ? 'eye-off' : 'eye'} size={17}/>
                      </button>
                    </div>
                  </div>
                )}
                {mode === 'lupa' && <p className="lembar-pengantar">Tulis email akun Anda. Tautan untuk membuat password baru akan dikirim ke sana.</p>}
                {err && <div className="login-galat" role="alert">{err}</div>}
                <button type="submit" className="btn-save" disabled={busy} style={{marginTop:4}}>
                  {busy ? 'Memproses…' : mode === 'lupa' ? 'Kirim tautan' : 'Masuk'}
                </button>
                <button type="button" className="login-tautan" onClick={()=>{ setMode(mode === 'lupa' ? 'masuk' : 'lupa'); setErr(''); }}>
                  {mode === 'lupa' ? 'Kembali ke Masuk' : 'Lupa password?'}
                </button>
              </>
            )}
          </div>
          {/* Hanya di `npm run dev`: akun tiruan tinggal diketuk, supaya
              mencoba sebagai pemilik atau karyawan tidak perlu menghafal. */}
          {modeTiruan && mode === 'masuk' && (
            <div className="tiruan-akun">
              <div>Database tiruan — masuk sebagai:</div>
              {AKUN_TIRUAN.map(a => (
                <button key={a.email} type="button" onClick={()=>{ setEmail(a.email); setPassword(a.password); }}>
                  {a.nama} ({a.peran})
                </button>
              ))}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
