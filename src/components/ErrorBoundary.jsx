import { Component } from 'react'

// Tanpa ini, satu error render di mana pun = layar putih di HP kasir, tanpa
// jalan keluar selain menutup dan membuka browser. Untuk app yang dipakai
// sebagai kasir, itu berarti warung berhenti mencatat.
//
// Harus class component: React belum punya padanan hook untuk menangkap error
// dari komponen anak.
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // Tidak ada layanan pelaporan error di sini; console sudah cukup untuk
    // dibaca lewat remote debugging kalau memang perlu ditelusuri.
    console.error('[Warkopsaja] render gagal:', error, info?.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="app">
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",padding:"40px 20px"}}>
          <div className="card" style={{maxWidth:420,textAlign:"center",padding:"32px 26px"}}>
            <div style={{fontSize:40,marginBottom:14}}>☕</div>
            <h2 style={{fontSize:19,marginBottom:10}}>Ada yang bermasalah</h2>
            <p style={{color:"var(--text2)",fontSize:13,lineHeight:1.7,marginBottom:20}}>
              Tampilan gagal dimuat. Data yang sudah tersimpan aman — yang belum
              terkirim tetap menunggu di HP dan akan menyusul.
            </p>
            <button className="btn-save" onClick={() => window.location.reload()}>Muat Ulang</button>
            <div style={{marginTop:16,fontSize:11,color:"var(--text3)",fontFamily:"'JetBrains Mono',monospace",wordBreak:"break-word"}}>
              {String(this.state.error?.message || this.state.error)}
            </div>
          </div>
        </div>
      </div>
    )
  }
}
