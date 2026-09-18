import { useState } from 'react'
import { signIn } from '../db.js'
import { Logo } from '../components/Logo.jsx'

// Hanya masuk, tidak ada daftar. Pendaftaran publik dimatikan di Supabase
// (Authentication → Allow new users to sign up), jadi tombol "Daftar" cuma
// akan menghasilkan error. Akun baru dibuat dari Supabase Dashboard →
// Authentication → Add user.
export default function LoginScreen({ onSession }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      onSession(await signIn(email, password));
    } catch(ex) { setErr(ex.message || 'Gagal'); }
    setBusy(false);
  }

  return (
    <div className="app">
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",padding:"40px 20px"}}>
        <form onSubmit={submit} style={{width:400,maxWidth:"100%"}}>
          <div className="login-hero">
            <div className="login-hero-logo"><Logo size={68} radius={20}/></div>
            <h1 className="login-hero-title">Warkopsaja</h1>
            <p className="login-hero-tag">Catat hari, lihat hasilnya.</p>
          </div>
          <div className="card" style={{margin:0,padding:"28px 26px"}}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" required autoFocus value={email} onChange={e=>setEmail(e.target.value)} placeholder="nama@contoh.com"/>
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-input" type="password" required minLength={6} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Minimal 6 karakter"/>
            </div>
            {err && <div style={{padding:"10px 12px",background:"var(--red-bg)",color:"var(--red)",border:"1px solid var(--red-border)",borderRadius:10,fontSize:12,marginBottom:12}}>{err}</div>}
            <button type="submit" className="btn-save" disabled={busy} style={{marginTop:4}}>
              {busy ? 'Memproses…' : 'Masuk'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
