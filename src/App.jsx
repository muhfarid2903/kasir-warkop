import { useState, useEffect, useRef } from 'react'
import { signOut } from './db.js'
import { namaPengguna } from './jejak.js'
import { DAYS, ML, fmtDateShort } from './format.js'
import { showToast } from './toast.js'
import { useAuth, useWarkopData, useTheme, useSidebar, useNumberInputGuards, useTodayISO } from './hooks.js'
import { useEfekSentuh } from './fx.js'
import { suaraAktif, setSuaraAktif, bunyi } from './sfx.js'
import { Icon } from './components/Icon.jsx'
import { SkeletonInput } from './components/Skeleton.jsx'
import LoginScreen from './pages/Login.jsx'
import HariIni from './pages/HariIni.jsx'
import VoucherToko from './pages/VoucherToko.jsx'
import Gajian from './pages/Gajian.jsx'
import Riwayat from './pages/Riwayat.jsx'

const NAV_ITEMS = [
  { id:'input',   icon:'coffee', label:'Hari Ini',     shortLabel:'Hari Ini' },
  { id:'voucher', icon:'signal', label:'Voucher Toko', shortLabel:'Voucher'  },
  { id:'gajian',  icon:'dollar', label:'Gajian',       shortLabel:'Gajian'   },
  { id:'riwayat', icon:'clock',  label:'Riwayat',      shortLabel:'Riwayat'  },
];

// Kerangka app: sidebar, header, dan pemilihan halaman. Semua isi halaman ada
// di src/pages/. Yang tinggal di sini cuma state yang dipakai lintas halaman —
// halaman aktif, dan tanggal terpilih (dipakai bareng Hari Ini & Voucher Toko).
function App() {
  const [page, setPage] = useState("input");
  const hariIni = useTodayISO();
  const [selectedDate, setSelectedDate] = useState(hariIni);

  // Saat hari berganti, ikut pindah HANYA kalau pengguna masih duduk di tanggal
  // hari kemarin. Kalau dia sengaja memilih tanggal lain, jangan diseret.
  const hariSebelumnya = useRef(hariIni);
  useEffect(() => {
    if (hariSebelumnya.current === hariIni) return;
    const kemarin = hariSebelumnya.current;
    hariSebelumnya.current = hariIni;
    setSelectedDate(cur => {
      if (cur !== kemarin) return cur;
      showToast('Sudah lewat tengah malam — tanggal pindah ke '+fmtDateShort(hariIni));
      return hariIni;
    });
  }, [hariIni]);
  const { session, setSession, authChecked } = useAuth();
  const {
    entries, setEntries,
    voucherToko, setVoucherToko,
    jejak,
    initialSaldo, setInitialSaldo,
    syncStatus, loading,
    loadAllDetails, detailsReady, ensureDetail,
    pending, tandaiTulis,
  } = useWarkopData(session);
  const [theme, setTheme] = useTheme();
  const [sidebarOpen, setSidebarOpen] = useSidebar();
  useNumberInputGuards();
  // Bunyi + riak untuk seluruh app, satu listener di document (lihat src/fx.js).
  useEfekSentuh();
  const [suara, setSuara] = useState(suaraAktif);

  const handleNav = (id) => {
    setPage(id);
    if (typeof window !== 'undefined' && window.innerWidth < 900) setSidebarOpen(false);
  };

  const SplashHeader = () => (
    <div className="header">
      <div className="header-logo" style={{color:"#1a0e05",width:38,height:38,background:"var(--grad-warm)",borderRadius:11,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 14px rgba(184,92,44,.35),inset 0 1px 0 rgba(255,255,255,.25)"}}><Icon type="coffee" size={20}/></div>
      <div className="header-page-title">Warkopsaja</div>
    </div>
  );

  if(syncStatus==="not_configured") return (
    <div className="app">
      <div className="main-area">
        <SplashHeader/>
        <div className="content" style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"70vh",padding:40,textAlign:"center"}}>
          <div style={{marginBottom:24,color:"var(--text3)"}}><Icon type="settings" size={56}/></div>
          <h2 style={{marginBottom:12,fontSize:22}}>Konfigurasi Supabase</h2>
          <p style={{color:"var(--text2)",maxWidth:520,lineHeight:1.8,marginBottom:24}}>Buka file <code style={{background:"var(--bg3)",padding:"3px 10px",borderRadius:6,fontSize:13}}>src/db.js</code>, cari <code style={{background:"var(--bg3)",padding:"3px 10px",borderRadius:6,fontSize:13}}>SUPABASE_URL</code> dan <code style={{background:"var(--bg3)",padding:"3px 10px",borderRadius:6,fontSize:13}}>SUPABASE_ANON_KEY</code>, lalu isi dengan nilai dari Supabase Dashboard → Project Settings → API.</p>
        </div>
      </div>
    </div>
  );

  if (!authChecked) return (
    <div className="app">
      <div className="main-area">
        <SplashHeader/>
        <div className="content" style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"60vh"}}>
          <div style={{width:40,height:40,border:"3px solid var(--border)",borderTopColor:"var(--accent)",borderRadius:"50%",animation:"spin .8s linear infinite"}}></div>
        </div>
      </div>
    </div>
  );

  if (!session) return <LoginScreen onSession={s => setSession(s)}/>;

  if(loading) return (
    <div className="app">
      <div className="main-area">
        <div className="header">
          <button className="sidebar-toggle" aria-label="Menu" disabled><Icon type="menu" size={18}/></button>
          <div className="header-page-title">Warkopsaja</div>
          <div className="header-right">
            <span className="sk" style={{width:120,height:30,borderRadius:99}}/>
          </div>
        </div>
        <div className="content">
          <span className="sk sk-line xl" style={{width:220}}/>
          <span className="sk sk-line" style={{width:300,marginBottom:24}}/>
          <SkeletonInput/>
        </div>
      </div>
    </div>
  );

  // Tampil kalau tidak online ATAU masih ada kiriman tertunda. Jumlahnya
  // disebutkan supaya kasir tahu ada yang belum sampai, bukan sekadar "offline".
  const SyncBadge = () => {
    if (syncStatus === "online" && pending === 0) return null;
    const judul = pending > 0
      ? pending+' perubahan tersimpan di HP, menunggu sinyal untuk terkirim'
      : 'Tidak terhubung — perubahan tidak tersinkron';
    return (
      <div className="sync-badge sync-offline" title={judul}>
        <div className="sync-dot offline"/>
        {pending > 0 ? pending+' tertunda' : 'Offline'}
      </div>
    );
  };
  const today = new Date();

  const currentPage = NAV_ITEMS.find(n=>n.id===page);
  const userEmail = session?.user?.email || '';
  // Nama inilah yang menempel di tiap jejak input, jadi ditampilkan juga di
  // sini — supaya jelas atas nama siapa yang sedang dicatat, dan ketahuan
  // kalau masih berupa potongan email yang perlu diberi nama asli.
  const userNama = namaPengguna(session);
  const userInitial = (userNama[0] || 'W').toUpperCase();

  return (
    <div className={"app"+(sidebarOpen?" sidebar-open":"")}>
      <aside className="sidebar" aria-label="Navigasi">
        <div className="sidebar-header">
          <div className="sidebar-logo"><Icon type="coffee" size={20}/></div>
          <div className="sidebar-brand">
            <div className="sidebar-brand-title">Warkopsaja</div>
            <div className="sidebar-brand-sub">{today.getDate()} {ML[today.getMonth()]} · {DAYS[today.getDay()]}</div>
          </div>
          <button className="sidebar-close" onClick={()=>setSidebarOpen(false)} aria-label="Tutup menu" title="Tutup">
            <Icon type="x" size={16}/>
          </button>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-label">Menu</div>
          {NAV_ITEMS.map(n => (
            <button key={n.id} className={"nav-btn "+(page===n.id?"active":"")} onClick={()=>handleNav(n.id)}>
              <Icon type={n.icon} size={18}/> {n.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          {userEmail && (
            <div className="sidebar-user">
              <div className="sidebar-user-avatar">{userInitial}</div>
              <div className="sidebar-user-teks">
                <div className="sidebar-user-nama">{userNama}</div>
                <div className="sidebar-user-email" title={userEmail}>{userEmail}</div>
              </div>
            </div>
          )}
          <button className="nav-btn" onClick={()=>setTheme(theme==='dark'?'light':'dark')}>
            <Icon type={theme==='dark'?'sun':'moon'} size={16}/> Mode {theme==='dark'?'terang':'gelap'}
          </button>
          <button className="nav-btn" onClick={async()=>{ await signOut(); }}>
            <Icon type="log-out" size={16}/> Logout
          </button>
        </div>
      </aside>

      <div className="sidebar-backdrop" onClick={()=>setSidebarOpen(false)}/>

      <div className="main-area">
        <div className="header">
          <button className="sidebar-toggle" onClick={()=>setSidebarOpen(!sidebarOpen)} aria-label={sidebarOpen?"Tutup menu":"Buka menu"} title={sidebarOpen?"Tutup menu":"Buka menu"}>
            <Icon type="menu" size={18}/>
          </button>
          <div style={{display:"flex",flexDirection:"column",justifyContent:"center",minWidth:0,flex:"0 1 auto"}}>
            <div className="header-page-title">{currentPage?.label || 'Warkopsaja'}</div>
          </div>
          <div className="header-right">
            <SyncBadge/>
            <button
              className={"sound-toggle"+(suara?"":" mati")}
              onClick={()=>{ const nyala=!suara; setSuaraAktif(nyala); setSuara(nyala); if(nyala) bunyi('alih'); }}
              aria-label={suara?"Matikan bunyi":"Nyalakan bunyi"}
              aria-pressed={suara}
              title={suara?"Bunyi nyala — ketuk untuk mendiamkan":"Bunyi mati"}
            >
              <Icon type={suara?'volume':'volume-x'} size={17}/>
            </button>
          </div>
        </div>

        <div className="content">
         <div className="page-cinema" key={page}>
          {page==="input" && (
            <HariIni
              selectedDate={selectedDate} setSelectedDate={setSelectedDate}
              entries={entries} setEntries={setEntries}
              voucherToko={voucherToko}
              initialSaldo={initialSaldo}
              session={session}
              ensureDetail={ensureDetail}
              tandaiTulis={tandaiTulis}
            />
          )}

          {page==="voucher" && (
            <VoucherToko
              selectedDate={selectedDate} setSelectedDate={setSelectedDate}
              voucherToko={voucherToko} setVoucherToko={setVoucherToko}
              session={session}
              tandaiTulis={tandaiTulis}
            />
          )}

          {page==="gajian" && (
            <Gajian entries={entries} voucherToko={voucherToko}/>
          )}

          {page==="riwayat" && (
            <Riwayat
              entries={entries} setEntries={setEntries}
              voucherToko={voucherToko} setVoucherToko={setVoucherToko}
              jejak={jejak}
              initialSaldo={initialSaldo} setInitialSaldo={setInitialSaldo}
              session={session}
              loadAllDetails={loadAllDetails} detailsReady={detailsReady}
              tandaiTulis={tandaiTulis}
            />
          )}
         </div>
        </div>
      </div>

      {/* Tab bar bawah — hanya tampil di HP (CSS menyembunyikannya di atas
          900px, di mana sidebar yang dipakai). shortLabel ada di NAV_ITEMS
          sejak dulu tapi belum pernah terpakai; di bilah sempit inilah
          tempatnya: "Voucher" muat, "Voucher Toko" tidak. */}
      <nav className="tabbar" aria-label="Navigasi utama">
        {NAV_ITEMS.map(n => (
          <button
            key={n.id}
            className={"tab-btn"+(page===n.id?" active":"")}
            onClick={()=>handleNav(n.id)}
            aria-current={page===n.id ? 'page' : undefined}
          >
            <Icon type={n.icon} size={23}/>
            {n.shortLabel}
          </button>
        ))}
      </nav>
    </div>
  );
}

export default App
