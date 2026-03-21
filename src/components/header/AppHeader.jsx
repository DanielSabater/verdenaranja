import { memo } from "react"
import { C } from "../../constants/colors.js"
import { PAYMENT_METHODS } from "../../constants/data.js"
import { fmt } from "../../utils/appointments.js"
import { MESES_ES, todayKey, fmtDate, nextWorkDay } from "../../utils/dates.js"

export const AppHeader = memo(function AppHeader({
  config, activeView, setActiveView, saveStatus, totalByMethod, grandTotal, grandEarnings, onLogout,
  currentDate, setCurrentDate, calendarOpen, setCalendarOpen, calViewDate, setCalViewDate, allData,
}) {
  const isMobileNav = typeof window !== "undefined" && window.innerWidth <= 900
  const tKey     = todayKey()
  const VIEWS = [
    { id: "turnos",       icon: "📅", label: "Turnos" },
    { id: "contabilidad", icon: "📊", label: "Contabilidad" },
    { id: "clientes",     icon: "👥", label: "Clientes" },
    { id: "config",       icon: "⚙️", label: "Config" },
  ]

  const [vy, vm] = (calViewDate || "2026-01").split("-").map(Number)
  const firstDay = new Date(vy, vm - 1, 1)
  const lastDay  = new Date(vy, vm, 0)
  const startDow = (firstDay.getDay() + 6) % 7
  const cells    = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= lastDay.getDate(); d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const prevMonth = () => { let m=vm-1,y=vy; if(m<1){m=12;y--} setCalViewDate(`${y}-${String(m).padStart(2,"0")}`) }
  const nextMonth = () => { let m=vm+1,y=vy; if(m>12){m=1;y++} setCalViewDate(`${y}-${String(m).padStart(2,"0")}`) }

  const btnNav = { width:30, height:30, borderRadius:"50%", border:`1px solid ${C.border}`, background:C.white, color:C.green, fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }

  return (
    <>
      <header style={{ background:C.white, borderBottom:`2px solid ${C.greenMint}`, padding:"0 14px", display:"flex", alignItems:"center", justifyContent:"space-between", boxShadow:`0 2px 16px ${C.shadow}`, position:"sticky", top:0, zIndex:100, minHeight:56, gap:8 }}>

        {/* Logo */}
        <div style={{ display:"flex", alignItems:"center", gap:9, flexShrink:0 }}>
          <div style={{ width:36, height:36, borderRadius:"50%", background:`linear-gradient(135deg,${C.green},${C.greenLight})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>{config.empresaEmoji}</div>
          <div>
            <div style={{ fontSize:7, letterSpacing:"3px", color:C.orange, textTransform:"uppercase" }}>{config.empresaSubtitulo}</div>
            <div style={{ fontSize:15, color:C.green, letterSpacing:"1px" }}>{config.empresaNombre}</div>
          </div>
        </div>

        {/* Desktop nav */}
        <div className="desktop-nav" style={{ gap:4 }}>
          {VIEWS.map(v => (
            <button key={v.id} onClick={() => setActiveView(v.id)} style={{ padding:"6px 14px", borderRadius:20, cursor:"pointer", border:`2px solid ${activeView===v.id?C.green:C.border}`, background:activeView===v.id?`linear-gradient(135deg,${C.green},${C.greenLight})`:C.white, color:activeView===v.id?"#fff":C.textSoft, fontSize:10, letterSpacing:"1px", textTransform:"uppercase", fontFamily:"Georgia,serif", transition:"all .18s" }}>{v.icon} {v.label}</button>
          ))}
        </div>

        {/* Desktop totals */}
        <div className="desktop-totals" style={{ alignItems:"center", gap:5 }}>
          {PAYMENT_METHODS.map(pm => { const t=totalByMethod(pm.id); return (
            <div key={pm.id} style={{ background:t>0?(pm.id==="mercadopago"?C.mpPale:pm.id==="debito"?C.amberPale:C.greenPale):"#f7f7f7", border:`1px solid ${t>0?(pm.id==="mercadopago"?C.mpMid:pm.id==="debito"?C.amberMid:C.greenMint):"#e8e8e8"}`, borderRadius:9, padding:"5px 9px", textAlign:"center" }}>
              <div style={{ fontSize:8, color:t>0?pm.color:"#bbb", textTransform:"uppercase" }}>{pm.icon} {pm.label}</div>
              <div style={{ fontSize:12, fontWeight:"bold", color:t>0?pm.color:"#ccc" }}>{fmt(t)}</div>
            </div>
          )})}
          <div style={{ background:grandTotal>0?`linear-gradient(135deg,${C.green},${C.greenLight})`:"#f0f0f0", borderRadius:10, padding:"6px 12px", textAlign:"center" }}>
            <div style={{ fontSize:7, color:grandTotal>0?"rgba(255,255,255,.7)":"#bbb", textTransform:"uppercase" }}>Total</div>
            <div style={{ fontSize:15, fontWeight:"bold", color:grandTotal>0?C.white:"#ccc" }}>{fmt(grandTotal)}</div>
          </div>
          <div style={{ background:grandEarnings>0?`linear-gradient(135deg,${C.gold},${C.goldLight})`:"#f0f0f0", borderRadius:10, padding:"6px 12px", textAlign:"center" }}>
            <div style={{ fontSize:7, color:grandEarnings>0?"rgba(255,255,255,.75)":"#bbb", textTransform:"uppercase" }}>{config.comisionPct}%</div>
            <div style={{ fontSize:15, fontWeight:"bold", color:grandEarnings>0?C.white:"#ccc" }}>{fmt(grandEarnings)}</div>
          </div>
        </div>

        {/* Right side */}
        <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
          {onLogout && <button onClick={onLogout} style={{ padding:"4px 10px", borderRadius:16, border:`1px solid ${C.border}`, background:"transparent", color:C.textSoft, fontSize:9, cursor:"pointer", fontFamily:"Georgia,serif" }}>Salir</button>}
          <div className="desktop-savebadge" style={{ padding:"4px 10px", borderRadius:16, minWidth:90, textAlign:"center", background:saveStatus==="saving"?"#f5f5f5":saveStatus==="saved"?C.greenPale:saveStatus==="error"?"#fde8e8":"transparent", border:`1px solid ${saveStatus==="saving"?"#ddd":saveStatus==="saved"?C.greenMint:saveStatus==="error"?"#f4b0b0":"transparent"}`, opacity:saveStatus==="idle"?0:1, transition:"opacity .3s ease" }}>
            <span style={{ fontSize:9, color:saveStatus==="saved"?C.green:saveStatus==="error"?"#c04040":"#aaa" }}>{saveStatus==="saving"?"⏳ Guardando...":saveStatus==="saved"?"✓ Guardado":saveStatus==="error"?"⚠️ Error":"✓ Guardado"}</span>
          </div>
          <div style={{ width:8, height:8, borderRadius:"50%", flexShrink:0, background:saveStatus==="saving"?"#ccc":saveStatus==="saved"?C.green:saveStatus==="error"?"#c04040":"transparent", opacity:saveStatus==="idle"?0:1, transition:"opacity .3s ease" }} />

          {/* Hoy + Calendar buttons */}
          {activeView === "turnos" && (<>
            {currentDate !== tKey && (
              <button onClick={() => setCurrentDate(tKey)} style={{ width:38, height:38, borderRadius:12, flexShrink:0, border:`2px solid ${C.border}`, background:C.white, fontSize:9, fontWeight:"bold", color:C.green, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Georgia,serif", letterSpacing:"1px" }}>HOY</button>
            )}
            <button onClick={() => setCalendarOpen(v => !v)} style={{ width:38, height:38, borderRadius:12, flexShrink:0, border:`2px solid ${calendarOpen?C.green:C.border}`, background:calendarOpen?`linear-gradient(135deg,${C.green},${C.greenLight})`:C.white, fontSize:18, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:calendarOpen?`0 4px 12px rgba(58,125,68,.3)`:"none", transition:"all .18s" }}>📅</button>
          </>)}
        </div>
      </header>

      {/* Mobile: date nav strip */}
      {activeView === "turnos" && currentDate && (
        <div className="date-nav-compact" style={{ background:C.white, borderBottom:`1px solid ${C.border}`, padding:"8px 12px", alignItems:"center", gap:8, justifyContent:"space-between", flexShrink:0 }}>
          <button style={btnNav} onClick={() => setCurrentDate(d => nextWorkDay(d, -1))}>‹</button>
          <div style={{ textAlign:"center", flex:1 }}>
            <div style={{ fontSize:12, color:C.green, fontWeight:"bold" }}>{fmtDate(currentDate)}</div>
            {currentDate === tKey && <div style={{ fontSize:9, color:C.textSoft }}>Hoy</div>}
          </div>
          <button style={btnNav} onClick={() => setCurrentDate(d => nextWorkDay(d, +1))}>›</button>
          {currentDate !== tKey && <button onClick={() => setCurrentDate(tKey)} style={{ width:34, height:34, borderRadius:10, border:`2px solid ${C.border}`, background:C.white, fontSize:8, fontWeight:"bold", color:C.green, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Georgia,serif" }}>HOY</button>}
          <button onClick={() => setCalendarOpen(v => !v)} style={{ width:34, height:34, borderRadius:10, border:`2px solid ${calendarOpen?C.green:C.border}`, background:calendarOpen?`linear-gradient(135deg,${C.green},${C.greenLight})`:C.white, fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>📅</button>
        </div>
      )}

      {/* Mobile totals strip */}
      {activeView === "turnos" && (
        <div className="mobile-totals-strip" style={{ background:C.white, borderBottom:`1px solid ${C.border}`, padding:"8px 12px", gap:6, overflowX:"auto", WebkitOverflowScrolling:"touch", flexShrink:0 }}>
          {PAYMENT_METHODS.map(pm => { const t=totalByMethod(pm.id); return t>0?(
            <div key={pm.id} style={{ background:pm.id==="mercadopago"?C.mpPale:pm.id==="debito"?C.amberPale:C.greenPale, border:`1px solid ${pm.id==="mercadopago"?C.mpMid:pm.id==="debito"?C.amberMid:C.greenMint}`, borderRadius:9, padding:"5px 10px", textAlign:"center", flexShrink:0 }}>
              <div style={{ fontSize:8, color:pm.color }}>{pm.icon} {pm.label}</div>
              <div style={{ fontSize:12, fontWeight:"bold", color:pm.color }}>{fmt(t)}</div>
            </div>
          ):null})}
          {grandTotal>0&&<div style={{ background:`linear-gradient(135deg,${C.green},${C.greenLight})`, borderRadius:9, padding:"5px 10px", textAlign:"center", flexShrink:0 }}><div style={{ fontSize:8, color:"rgba(255,255,255,.8)" }}>Total</div><div style={{ fontSize:12, fontWeight:"bold", color:"#fff" }}>{fmt(grandTotal)}</div></div>}
          {grandEarnings>0&&<div style={{ background:`linear-gradient(135deg,${C.gold},${C.goldLight})`, borderRadius:9, padding:"5px 10px", textAlign:"center", flexShrink:0 }}><div style={{ fontSize:8, color:"rgba(255,255,255,.8)" }}>{config.comisionPct}%</div><div style={{ fontSize:12, fontWeight:"bold", color:"#fff" }}>{fmt(grandEarnings)}</div></div>}
        </div>
      )}

      {/* Calendar popup */}
      {calendarOpen && activeView === "turnos" && (
        <>
          <div onClick={() => setCalendarOpen(false)} style={{ position:"fixed", inset:0, zIndex:299 }} />
          <div onClick={e=>e.stopPropagation()} style={{ position:"fixed", top:64, right:12, zIndex:300, background:C.white, borderRadius:16, border:`1.5px solid ${C.greenMint}`, boxShadow:"0 12px 40px rgba(58,125,68,.18)", padding:"16px 20px 20px", display:"flex", flexDirection:"column", alignItems:"center" }}>
            <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:14 }}>
              <button onClick={prevMonth} style={{ width:30, height:30, borderRadius:"50%", border:`1px solid ${C.border}`, background:C.white, color:C.green, fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>‹</button>
              <div style={{ fontSize:14, color:C.text, fontWeight:"bold", minWidth:160, textAlign:"center" }}>{MESES_ES[vm-1].charAt(0).toUpperCase()+MESES_ES[vm-1].slice(1)} {vy}</div>
              <button onClick={nextMonth} style={{ width:30, height:30, borderRadius:"50%", border:`1px solid ${C.border}`, background:C.white, color:C.green, fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>›</button>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(7,36px)", gap:4, marginBottom:6 }}>
              {["Lu","Ma","Mi","Ju","Vi","Sá","Do"].map(d=><div key={d} style={{ width:36, textAlign:"center", fontSize:9, letterSpacing:"1px", textTransform:"uppercase", color:d==="Do"?"#d0b0b0":C.textSoft, fontFamily:"Georgia,serif" }}>{d}</div>)}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(7,36px)", gap:4 }}>
              {cells.map((day,idx) => {
                if(!day) return <div key={idx}/>
                const dow=idx%7, isSun=dow===6, dk=`${vy}-${String(vm).padStart(2,"0")}-${String(day).padStart(2,"0")}`, isCur=dk===currentDate, isToday=dk===tKey, hasAppts=Object.keys((allData||{})[dk]||{}).length>0
                return (
                  <button key={idx} disabled={isSun} onClick={()=>{setCurrentDate(dk);setCalendarOpen(false)}} style={{ width:36, height:36, borderRadius:10, position:"relative", border:`2px solid ${isCur?C.green:isToday?C.greenMint:"transparent"}`, background:isCur?`linear-gradient(135deg,${C.green},${C.greenLight})`:isToday?C.greenPale:hasAppts?C.cream:"transparent", color:isCur?"#fff":isSun?"#e0cece":isToday?C.green:C.text, fontSize:12, fontWeight:isCur||isToday?"bold":"normal", cursor:isSun?"not-allowed":"pointer", fontFamily:"Georgia,serif", transition:"all .12s" }}>
                    {day}
                    {hasAppts&&<div style={{ position:"absolute", bottom:2, left:"50%", transform:"translateX(-50%)", width:4, height:4, borderRadius:"50%", background:isCur?"rgba(255,255,255,.8)":C.green }}/>}
                  </button>
                )
              })}
            </div>
            <button onClick={()=>setCalendarOpen(false)} style={{ marginTop:14, padding:"5px 20px", borderRadius:20, border:`1px solid ${C.border}`, background:"transparent", color:C.textSoft, fontSize:9, letterSpacing:"1.5px", textTransform:"uppercase", cursor:"pointer", fontFamily:"Georgia,serif" }}>Cerrar</button>
          </div>
        </>
      )}
    </>
  )
})
