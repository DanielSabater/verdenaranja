import { useState } from "react"
import { C } from "../../constants/colors.js"
import { GhostBtn, SolidBtn, Field, inputStyle } from "../ui/index.jsx"

export default function ClientesView({ clientes, setClientes, allData }) {
  const [search,   setSearch]   = useState("")
  const [selected, setSelected] = useState(null)
  const [modal,    setModal]    = useState(false)
  const [newMode,  setNewMode]  = useState(false)
  const [form,     setForm]     = useState({ name:"", phone:"", notes:"" })
  const [apptName, setApptName] = useState("")
  const [showSug,  setShowSug]  = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)

  const safe  = clientes || []
  const safeD = allData  || {}

  const suggestions = safe.filter(c =>
    apptName.length > 1 && c.name.toLowerCase().includes(apptName.toLowerCase())
  )
  const isNew = apptName.trim().length > 1 &&
    !safe.some(c => c.name.toLowerCase() === apptName.trim().toLowerCase())

  const saveFromField = () => {
    if (!apptName.trim()) return
    setClientes(p => [...(p||[]), { id: Date.now(), name: apptName.trim(), phone:"", notes:"" }])
    setSavedMsg(true); setTimeout(() => setSavedMsg(false), 2200)
    setShowSug(false)
  }

  const filtered = safe.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) || (c.phone||"").includes(search)
  )

  const visitCount = (name) => {
    let n = 0
    Object.values(safeD).forEach(day => Object.values(day).forEach(a => {
      if ((a.client||"").toLowerCase() === name.toLowerCase()) n++
    }))
    return n
  }

  const getHistorial = (name) => {
    const rows = []
    Object.entries(safeD).forEach(([fecha, day]) => {
      Object.values(day).forEach(a => {
        if ((a.client||"").toLowerCase() === name.toLowerCase())
          rows.push({ fecha, servicios:(a.services||[]).map(s=>s.name).join(", ")||"—", total:a.paid?(a.services||[]).reduce((s,x)=>s+(x.price||0),0):null, paid:a.paid })
      })
    })
    return rows.sort((a,b) => b.fecha.localeCompare(a.fecha)).slice(0,15)
  }

  const fmt = (n) => n != null ? `$${Number(n).toLocaleString("es-AR")}` : "—"

  const openNew  = ()    => { setForm({name:"",phone:"",notes:""}); setNewMode(true);  setModal(true) }
  const openEdit = (c,e) => { e.stopPropagation(); setForm({name:c.name,phone:c.phone||"",notes:c.notes||""}); setNewMode(false); setSelected(c); setModal(true) }
  const saveForm = () => {
    if (!form.name.trim()) return
    if (newMode) setClientes(p => [...(p||[]), { id:Date.now(), ...form }])
    else setClientes(p => (p||[]).map(c => c.id===selected.id ? {...c,...form} : c))
    setModal(false)
  }

  return (
    <div style={{ background: C.cream, minHeight:"100vh", paddingBottom:80 }}>
      <div style={{ maxWidth:900, margin:"0 auto", padding:"20px 16px 160px", display:"grid", gridTemplateColumns:"320px 1fr", gap:24, alignItems:"start" }}>

        {/* Panel izq */}
        <div>
          <div style={{ fontSize:8, letterSpacing:"3px", color:C.orange, textTransform:"uppercase", marginBottom:10 }}>✏️ En el modal de turno</div>
          <div style={{ background:C.white, borderRadius:16, padding:20, border:`1px solid ${C.border}`, boxShadow:`0 4px 20px rgba(58,125,68,.07)` }}>
            <div style={{ fontSize:11, color:C.textSoft, marginBottom:12 }}>Al escribir un nombre aparecen las clientas guardadas:</div>
            <Field label="Nombre del cliente">
              <div style={{ position:"relative" }}>
                <input value={apptName} onChange={e=>{setApptName(e.target.value);setShowSug(true)}} onFocus={()=>setShowSug(true)} onBlur={()=>setTimeout(()=>setShowSug(false),150)} placeholder="Ej: María González" style={{...inputStyle, paddingRight:isNew?108:12}}/>
                {isNew && <button onMouseDown={saveFromField} style={{ position:"absolute", right:6, top:"50%", transform:"translateY(-50%)", padding:"4px 9px", borderRadius:8, border:"none", background:`linear-gradient(135deg,${C.green},${C.greenLight})`, color:"#fff", fontSize:9, cursor:"pointer", fontFamily:"Georgia,serif" }}>💾 Guardar</button>}
                {showSug && suggestions.length > 0 && (
                  <div style={{ position:"absolute", top:"calc(100% + 4px)", left:0, right:0, zIndex:50, background:C.white, borderRadius:10, border:`1.5px solid ${C.greenMint}`, boxShadow:"0 8px 24px rgba(58,125,68,.13)", overflow:"hidden" }}>
                    {suggestions.map(c => (
                      <div key={c.id} onMouseDown={()=>{setApptName(c.name);setShowSug(false)}} style={{ padding:"9px 14px", cursor:"pointer", borderBottom:`1px solid ${C.greenPale}`, display:"flex", justifyContent:"space-between", alignItems:"center" }} onMouseEnter={e=>e.currentTarget.style.background=C.greenPale} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                        <div>
                          <div style={{ fontSize:13, color:C.text }}>{c.name}</div>
                          {c.phone && <div style={{ fontSize:10, color:C.textSoft }}>{c.phone}</div>}
                        </div>
                        <div style={{ fontSize:9, color:C.green, background:C.greenPale, padding:"2px 7px", borderRadius:7 }}>{visitCount(c.name)} turnos</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Field>
            {savedMsg && <div style={{ fontSize:11, color:C.green, background:C.greenPale, padding:"7px 11px", borderRadius:8 }}>✅ Clienta guardada</div>}
            {isNew && !savedMsg && <div style={{ fontSize:10, color:C.textSoft, marginTop:4 }}>✨ Clienta nueva — guardá para la próxima</div>}
            <div style={{ marginTop:16, padding:"11px 13px", background:C.cream, borderRadius:10, border:`1px solid ${C.border}`, fontSize:10, color:C.textSoft, lineHeight:1.8 }}>
              <strong style={{ color:C.text }}>Cómo funciona:</strong><br/>
              • Escribís un nombre → sugerencias automáticas<br/>
              • Clic para autocompletar nombre y teléfono<br/>
              • Si es nueva → 💾 para guardarla al instante
            </div>
          </div>
        </div>

        {/* Panel der */}
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <div>
              <div style={{ fontSize:7, letterSpacing:"3px", color:C.orange, textTransform:"uppercase" }}>Perla Verde</div>
              <div style={{ fontSize:18, color:C.text }}>👥 Clientas ({safe.length})</div>
            </div>
            <button onClick={openNew} style={{ padding:"7px 14px", borderRadius:12, border:"none", background:`linear-gradient(135deg,${C.green},${C.greenLight})`, color:"#fff", fontSize:11, cursor:"pointer", fontFamily:"Georgia,serif" }}>+ Nueva clienta</button>
          </div>

          <div style={{ display:"flex", gap:10, marginBottom:14 }}>
            {[["👥","Clientas",safe.length,C.greenPale,C.green,C.greenMint],["📅","Con turnos",safe.filter(c=>visitCount(c.name)>0).length,"#fdf0e8",C.orange,"#f0c8a0"]].map(([icon,lbl,val,bg,col,brd])=>(
              <div key={lbl} style={{ background:bg, border:`1px solid ${brd}`, borderRadius:10, padding:"7px 14px", textAlign:"center" }}>
                <div style={{ fontSize:9, color:col, textTransform:"uppercase", letterSpacing:"1px" }}>{icon} {lbl}</div>
                <div style={{ fontSize:20, color:col, fontWeight:"bold" }}>{val}</div>
              </div>
            ))}
          </div>

          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Buscar por nombre o teléfono..." style={{...inputStyle, marginBottom:12}}/>

          {filtered.length===0 && <div style={{ textAlign:"center", color:C.textSoft, fontSize:13, padding:30 }}>{search?"Sin resultados":"Sin clientas guardadas aún"}</div>}

          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {filtered.map(c => {
              const active = selected?.id === c.id
              const visits = visitCount(c.name)
              return (
                <div key={c.id} onClick={()=>setSelected(active?null:c)} style={{ background:active?C.greenPale:C.white, border:`1.5px solid ${active?C.green:C.border}`, borderRadius:12, padding:"11px 14px", cursor:"pointer", transition:"all .15s" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:14, color:C.text, fontWeight:active?"bold":"normal" }}>{c.name}</div>
                      {c.phone && <div style={{ fontSize:11, color:C.textSoft, marginTop:2 }}>📞 {c.phone}</div>}
                      {c.notes && <div style={{ fontSize:11, color:C.textSoft, marginTop:2, fontStyle:"italic" }}>"{c.notes}"</div>}
                    </div>
                    <div style={{ display:"flex", gap:6, alignItems:"center", flexShrink:0, marginLeft:10 }}>
                      <div style={{ fontSize:9, background:visits>0?C.greenMint:"#f0f0f0", color:visits>0?C.green:C.textSoft, padding:"2px 8px", borderRadius:8 }}>{visits>0?`${visits} turnos`:"sin turnos"}</div>
                      <button onClick={e=>openEdit(c,e)} style={{ padding:"3px 8px", borderRadius:8, border:`1px solid ${C.border}`, background:C.white, color:C.textSoft, fontSize:10, cursor:"pointer", fontFamily:"Georgia,serif" }}>✏️</button>
                      <button onClick={e=>{e.stopPropagation();setClientes(p=>p.filter(x=>x.id!==c.id));if(selected?.id===c.id)setSelected(null)}} style={{ padding:"3px 8px", borderRadius:8, border:"none", background:"#fde8e8", color:"#c04040", fontSize:10, cursor:"pointer" }}>🗑️</button>
                    </div>
                  </div>
                  {active && (
                    <div style={{ marginTop:12, borderTop:`1px solid ${C.greenMint}`, paddingTop:12 }}>
                      <div style={{ fontSize:8, letterSpacing:"2px", color:C.textSoft, textTransform:"uppercase", marginBottom:8 }}>Historial</div>
                      {getHistorial(c.name).length===0
                        ? <div style={{ fontSize:11, color:C.textSoft, fontStyle:"italic" }}>Sin turnos registrados aún</div>
                        : getHistorial(c.name).map((h,i)=>(
                            <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:11, padding:"5px 0", borderBottom:`1px solid ${C.greenPale}`, color:C.textSoft }}>
                              <span><span style={{ color:C.text }}>{h.fecha}</span> · {h.servicios}</span>
                              <span style={{ fontWeight:"bold", color:h.paid?C.orange:C.textSoft, marginLeft:10, flexShrink:0 }}>{h.paid?fmt(h.total):"Sin pagar"}</span>
                            </div>
                          ))
                      }
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, zIndex:9999, background:"rgba(0,0,0,.45)", display:"flex", alignItems:"center", justifyContent:"center" }} onClick={()=>setModal(false)}>
          <div style={{ background:C.white, borderRadius:18, padding:24, width:"min(420px,calc(100vw - 32px))", boxShadow:"0 24px 80px rgba(0,0,0,.2)" }} onClick={e=>e.stopPropagation()}>
            <div style={{ fontSize:7, letterSpacing:"3px", color:C.orange, textTransform:"uppercase" }}>{newMode?"👤 Agregar a la lista":"✏️ Modificar datos"}</div>
            <div style={{ fontSize:18, color:C.text, margin:"4px 0 2px" }}>{newMode?"Nueva clienta":"Editar clienta"}</div>
            <div style={{ height:2, background:`linear-gradient(90deg,${C.green},${C.greenMint},transparent)`, marginBottom:16, borderRadius:2 }}/>
            <Field label="Nombre *"><input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="Ej: María González" style={inputStyle} autoFocus/></Field>
            <Field label="Teléfono"><input value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))} placeholder="Ej: 11-4523-8890" style={inputStyle}/></Field>
            <Field label="Notas / preferencias"><textarea value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} rows={3} style={{...inputStyle,resize:"vertical"}}/></Field>
            <div style={{ display:"flex", gap:8, marginTop:8 }}>
              <GhostBtn onClick={()=>setModal(false)}>Cancelar</GhostBtn>
              <SolidBtn onClick={saveForm} disabled={!form.name.trim()} color={C.green}>{newMode?"✅ Agregar clienta":"✅ Guardar cambios"}</SolidBtn>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
