import { useState } from 'react'
import { signIn, signUp } from '../db.js'
import { showToast } from '../toast.js'
import { Icon } from '../components/Icon.jsx'

export default function LoginScreen({ onSession }) {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      if (mode === 'signin') {
        onSession(await signIn(email, password));
      } else {
        const session = await signUp(email, password);
        if (session) { onSession(session); }
        else { showToast('Cek email untuk konfirmasi akun'); setMode('signin'); }
      }
    } catch(ex) { setErr(ex.message || 'Gagal'); }
    setBusy(false);
  }

  return (
    <div className="app">
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",padding:"40px 20px"}}>
        <form onSubmit={submit} style={{width:400,maxWidth:"100%"}}>
          <div className="login-hero">
            <div className="login-hero-logo"><Icon type="coffee" size={32}/></div>
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
              {busy ? 'Memproses…' : (mode==='signin' ? 'Masuk' : 'Daftar')}
            </button>
            <div style={{textAlign:"center",marginTop:14,fontSize:12,color:"var(--text2)"}}>
              {mode==='signin' ? 'Belum punya akun? ' : 'Sudah punya akun? '}
              <a href="#" onClick={(e)=>{e.preventDefault();setErr('');setMode(mode==='signin'?'signup':'signin');}} style={{color:"var(--accent)",fontWeight:600,textDecoration:"none"}}>
                {mode==='signin' ? 'Daftar' : 'Masuk'}
              </a>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
