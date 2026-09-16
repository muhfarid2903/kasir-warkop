// Skeleton untuk halaman input saat loading data dari Supabase
export function SkeletonInput() {
  return (
    <>
      <div className="kas-hero">
        <span className="sk sk-line" style={{width:90,height:11,margin:"0 auto 18px",display:"block"}}/>
        <span className="sk sk-line xl" style={{width:"min(320px,80%)",height:64,margin:"0 auto",display:"block"}}/>
        <div style={{display:"flex",gap:6,justifyContent:"center",marginTop:26,flexWrap:"wrap"}}>
          {[0,1,2].map(i => <span key={i} className="sk sk-line" style={{width:120,height:22,borderRadius:14}}/>)}
        </div>
      </div>
      <div style={{display:"flex",gap:14,marginBottom:18,alignItems:"center"}}>
        <span className="sk" style={{width:170,height:38,borderRadius:11}}/>
        <span className="sk sk-line" style={{width:160,height:11}}/>
      </div>
      <div className="card">
        {[0,1,2,3,4].map(i => (
          <div key={i} className="sk-row">
            <span className="sk sk-circle"/>
            <div style={{flex:1}}>
              <span className="sk sk-line lg" style={{width:'60%'}}/>
              <span className="sk sk-line" style={{width:'35%',marginTop:6,height:9}}/>
            </div>
            <span className="sk" style={{width:140,height:42,borderRadius:13}}/>
          </div>
        ))}
      </div>
    </>
  );
}
