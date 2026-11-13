import { useState } from 'react'
import { gantiPassword } from '../db.js'
import { pesanGalat } from '../format.js'
import { showToast } from '../toast.js'
import { Logo } from '../components/Logo.jsx'

// Tampil sesudah tautan "lupa password" dari email dibuka (event
// PASSWORD_RECOVERY). Orangnya sudah masuk lewat tautan itu; tinggal
// membuat password baru.
export default function PasswordBaru({ onSelesai }) {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault(); setErr('');
    if (pw.length < 6) { setErr('Password minimal 6 karakter'); return; }
    if (pw !== pw2) { setErr('Kedua password tidak sama'); return; }
    setBusy(true);
    try { await gantiPassword(pw); showToast('Password baru tersimpan'); onSelesai(); }
    catch (ex) { setErr(pesanGalat(ex)); setBusy(false); }
  }

  return (
    <div className="app">
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",padding:"40px 20px"}}>
        <form onSubmit={submit} style={{width:400,maxWidth:"100%"}}>
          <div className="login-hero">
            <div className="login-hero-logo"><Logo size={68} radius={20}/></div>
            <h1 className="login-hero-title">Password baru</h1>
            <p className="login-hero-tag">Buat password untuk masuk berikutnya.</p>
          </div>
          <div className="card" style={{margin:0,padding:"28px 26px"}}>
            <div className="form-group">
              <label className="form-label" htmlFor="pw-baru">Password baru</label>
              <input id="pw-baru" className="form-input" type="password" autoComplete="new-password" required minLength={6} autoFocus value={pw} onChange={e=>setPw(e.target.value)}/>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="pw-ulang">Ulangi password</label>
              <input id="pw-ulang" className="form-input" type="password" autoComplete="new-password" required minLength={6} value={pw2} onChange={e=>setPw2(e.target.value)}/>
            </div>
            {err && <div className="login-galat" role="alert">{err}</div>}
            <button type="submit" className="btn-save" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan password'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
