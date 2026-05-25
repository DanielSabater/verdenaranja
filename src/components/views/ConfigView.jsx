import { useState } from "react"
import { C } from "../../constants/colors.js"
import { CAT_OPTIONS as CAT_OPTIONS_DEFAULT, EMOJI_SUGGESTIONS, BLOCKED_COLORS } from "../../constants/data.js"
import { GhostBtn, SolidBtn } from "../ui/index.jsx"

// ─── Config View ──────────────────────────────────────────────────────────────

export default function ConfigView({ config, setConfig, allData, gastos, sueldos, clientes }) {
  const [seccion, setSeccion] = useState("empresa");
  const [emojiPicker,  setEmojiPicker]  = useState(null)
  const [svcFilter,    setSvcFilter]    = useState({ cat:"all", search:"" })
  const [newSvcModal,  setNewSvcModal]  = useState(false)
  const [newSvc,       setNewSvc]       = useState({ name:"", duration:0, price:0, category:"manos", icon:"💅" })

  // Safety guard
  const profs    = config?.professionals || []
  const svcs     = config?.services     || []

  // Dynamic categories — merge default + custom ones from config
  const CAT_OPTIONS = [
    ...CAT_OPTIONS_DEFAULT,
    ...((config?.customCategories || []).map(cc => ({ id: cc.id, label: cc.label, icon: cc.icon }))),
  ]

  const addCustomCategory = () => {
    const label = prompt("Nombre de la nueva categoría:")
    if (!label?.trim()) return
    const icon  = prompt("Ícono (emoji):") || "🌟"
    const id    = "custom_" + Date.now()
    setConfig(p => ({ ...p, customCategories: [...(p.customCategories||[]), { id, label: label.trim(), icon }] }))
  }

  const removeCustomCategory = (id) => {
    if (!window.confirm("¿Eliminar esta categoría?")) return
    setConfig(p => ({ ...p, customCategories: (p.customCategories||[]).filter(cc => cc.id !== id) }))
  }

  const updateConfig  = (field, value) => setConfig(p => ({ ...p, [field]: value }));

  // ── Professionals ────────────────────────────────────────────────────────
  const updateProf = (id, field, value) =>
    setConfig(p => ({ ...p, professionals: p.professionals.map(pr => pr.id===id ? {...pr,[field]:value} : pr) }));

  const addProf = () => {
    const newId = Date.now();
    setConfig(p => ({ ...p, professionals: [...p.professionals, { id:newId, name:"Nueva profesional", emoji:"🌸" }] }));
  };

  const removeProf = (id) => {
    const prof = profs.find(p => p.id === id)
    if (!window.confirm(`¿Eliminar a ${prof?.name || "esta profesional"}? Esta acción no se puede deshacer.`)) return
    setConfig(p => ({ ...p, professionals: p.professionals.filter(pr => pr.id!==id) }))
  }

  // ── Services ─────────────────────────────────────────────────────────────
  const updateSvc = (id, field, value) =>
    setConfig(p => ({ ...p, services: p.services.map(s => s.id===id ? {...s,[field]:value} : s) }));

  const addSvc = () => {
    setNewSvc({ name:"", duration:0, price:0, category:"manos", icon:"💅" })
    setNewSvcModal(true)
  }

  const saveNewSvc = () => {
    if (!newSvc.name.trim()) return
    const newId = Date.now()
    setConfig(p => ({ ...p, services: [...p.services, { id:newId, ...newSvc }] }))
    setNewSvcModal(false)
  }

  const removeSvc = (id) =>
    setConfig(p => ({ ...p, services: p.services.filter(s => s.id!==id) }));

  const TABS = [
    { id:"empresa",       icon:"🏠", label:"Empresa" },
    { id:"profesionales", icon:"👩", label:"Profesionales" },
    { id:"servicios",     icon:"💅", label:"Servicios" },
    { id:"sistema",       icon:"⚙️", label:"Sistema" },
  ];

  return (
    <div style={{ maxWidth:860, margin:"0 auto", padding:"16px 12px 100px" }}>

      {/* Section tabs */}
      <div style={{ display:"flex", gap:6, marginBottom:28, flexWrap:"wrap" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={()=>setSeccion(t.id)} style={{
            padding:"8px 20px", borderRadius:22, cursor:"pointer",
            border:`2px solid ${seccion===t.id ? C.green : C.border}`,
            background: seccion===t.id ? `linear-gradient(135deg,${C.green},${C.greenLight})` : C.white,
            color: seccion===t.id ? "#fff" : C.textSoft,
            fontSize:11, letterSpacing:"1px", textTransform:"uppercase",
            fontFamily:"Georgia,serif", fontWeight:"normal",
            transition:"all .18s", boxShadow:seccion===t.id?`0 4px 14px ${C.shadow}`:"none",
            minWidth:110,
          }}>{t.icon} {t.label}</button>
        ))}
      </div>

      {/* ── EMPRESA ─────────────────────────────────────────── */}
      {seccion === "empresa" && (
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <SectionCard title="🏠 Identidad del negocio">
            <div style={{ display:"flex", alignItems:"center", gap:20, marginBottom:20, flexWrap:"wrap" }}>
              {/* Logo emoji */}
              <div style={{ textAlign:"center" }}>
                <div onClick={()=>setEmojiPicker(emojiPicker==="empresa"?null:"empresa")} style={{
                  width:72, height:72, borderRadius:"50%", cursor:"pointer",
                  background:`linear-gradient(135deg,${C.greenPale},${C.greenMint})`,
                  border:`3px solid ${emojiPicker==="empresa"?C.green:C.border}`,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:34, transition:"all .2s",
                  boxShadow: emojiPicker==="empresa"?`0 4px 18px ${C.shadow}`:"none",
                }}>{config.empresaEmoji}</div>
                <div style={{ fontSize:8, color:C.textSoft, marginTop:5, letterSpacing:"1px" }}>ÍCONO</div>
              </div>
              <div style={{ flex:1, minWidth:200 }}>
                <CfgField label="Nombre del negocio">
                  <input value={config.empresaNombre} onChange={e=>updateConfig("empresaNombre",e.target.value)}
                    style={cfgInput} placeholder="Ej: Perla Verde" />
                </CfgField>
                <CfgField label="Subtítulo / eslogan">
                  <input value={config.empresaSubtitulo} onChange={e=>updateConfig("empresaSubtitulo",e.target.value)}
                    style={cfgInput} placeholder="Ej: Turnos · Spa" />
                </CfgField>
              </div>
            </div>

            {/* Emoji picker */}
            {emojiPicker === "empresa" && (
              <EmojiPicker current={config.empresaEmoji} onSelect={e=>{updateConfig("empresaEmoji",e);setEmojiPicker(null);}} />
            )}

            {/* Preview */}
            <div style={{ background:C.cream, borderRadius:12, padding:"14px 18px", border:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:44,height:44,borderRadius:"50%",background:"#fff",border:`1px solid ${C.greenMint}`,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden" }}>
                <img src="/logo.png" alt="Logo" style={{ width:"100%",height:"100%",objectFit:"cover" }} />
              </div>
              <div>
                <div style={{ fontSize:8,letterSpacing:"3px",color:C.orange,textTransform:"uppercase" }}>{config.empresaSubtitulo}</div>
                <div style={{ fontSize:18,color:C.green }}>{config.empresaNombre}</div>
              </div>
              <div style={{ marginLeft:"auto", fontSize:9, color:C.textSoft, letterSpacing:"1px" }}>VISTA PREVIA</div>
            </div>
          </SectionCard>
        </div>
      )}

      {/* ── PROFESIONALES ───────────────────────────────────── */}
      {seccion === "profesionales" && (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {profs.map((prof, idx) => (
            <SectionCard key={prof.id}>
              <div style={{ display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}>
                <div style={{ textAlign:"center", flexShrink:0 }}>
                  <div onClick={()=>setEmojiPicker(emojiPicker===prof.id?null:prof.id)} style={{
                    width:52,height:52,borderRadius:"50%",cursor:"pointer",
                    background:`linear-gradient(135deg,${C.greenPale},${C.greenMint})`,
                    border:`2px solid ${emojiPicker===prof.id?C.green:C.border}`,
                    display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,
                    transition:"all .18s",
                  }}>{prof.emoji}</div>
                  <div style={{ fontSize:7,color:C.textSoft,marginTop:3,letterSpacing:"1px" }}>ÍCONO</div>
                </div>

                <div style={{ flex:1, minWidth:160 }}>
                  <label style={cfgLabel}>Nombre</label>
                  <input value={prof.name} onChange={e=>updateProf(prof.id,"name",e.target.value)}
                    style={cfgInput} placeholder="Nombre de la profesional" />
                </div>

                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ background:C.greenPale, border:`1px solid ${C.greenMint}`, borderRadius:8, padding:"4px 10px", fontSize:11, color:C.textSoft }}>
                    #{idx+1}
                  </div>
                  <button onClick={()=>removeProf(prof.id)} style={{
                    width:32,height:32,borderRadius:"50%",border:"none",
                    background:"#fde8e8",color:"#c04040",fontSize:14,cursor:"pointer",
                  }}>✕</button>
                </div>
              </div>

              {emojiPicker === prof.id && (
                <EmojiPicker current={prof.emoji} onSelect={e=>{updateProf(prof.id,"emoji",e);setEmojiPicker(null);}} />
              )}

            </SectionCard>
          ))}

          <button onClick={addProf} style={{
            width:"100%", padding:"12px", borderRadius:14,
            border:`2px dashed ${C.greenMint}`, background:"transparent",
            color:C.green, fontSize:12, cursor:"pointer", fontFamily:"Georgia,serif",
            letterSpacing:"1px", transition:"all .15s",
          }}>＋ Agregar profesional</button>
        </div>
      )}

      {/* ── SERVICIOS ───────────────────────────────────────── */}
      {seccion === "servicios" && (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>

          {/* Add button + filters at the top */}
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
            <button onClick={addSvc} style={{
              padding:"9px 18px", borderRadius:12,
              border:`2px dashed ${C.greenMint}`, background:"transparent",
              color:C.green, fontSize:12, cursor:"pointer", fontFamily:"Georgia,serif",
              letterSpacing:"1px", flexShrink:0,
            }}>＋ Agregar servicio</button>

            <input
              placeholder="🔍 Buscar..."
              value={svcFilter.search}
              onChange={e => setSvcFilter(p => ({...p, search: e.target.value}))}
              style={{...cfgInput, flex:1, minWidth:120, fontSize:11}}
            />

            <select value={svcFilter.cat} onChange={e => setSvcFilter(p => ({...p, cat: e.target.value}))}
              style={{...cfgInput, fontSize:11, padding:"6px 8px"}}>
              <option value="all">Todas las categorías</option>
              {CAT_OPTIONS.map(cat => <option key={cat.id} value={cat.id}>{cat.icon} {cat.label}</option>)}
            </select>
            <button onClick={addCustomCategory} style={{ padding:"8px 12px", borderRadius:10, border:`1.5px solid ${C.border}`, background:C.white, color:C.textSoft, fontSize:11, cursor:"pointer", fontFamily:"Georgia,serif", flexShrink:0 }}>＋ Categoría</button>
          </div>

          {/* Custom categories */}
          {(config?.customCategories||[]).length > 0 && (
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {(config?.customCategories||[]).map(cc => (
                <div key={cc.id} style={{ display:"flex", alignItems:"center", gap:4, background:C.cream, border:`1px solid ${C.border}`, borderRadius:20, padding:"4px 10px" }}>
                  <span style={{ fontSize:12 }}>{cc.icon} {cc.label}</span>
                  <button onClick={() => removeCustomCategory(cc.id)} style={{ border:"none", background:"transparent", color:"#c04040", cursor:"pointer", fontSize:11, padding:0 }}>✕</button>
                </div>
              ))}
            </div>
          )}

          {/* Column headers */}
          <div style={{ display:"grid", gridTemplateColumns:"44px minmax(100px,1fr) 80px 80px 90px 36px", gap:8, padding:"0 14px", alignItems:"center" }}>
            {["Ícono","Nombre","Duración","Precio","Categoría",""].map((h,i)=>(
              <div key={i} style={{ fontSize:8,letterSpacing:"1.5px",color:C.textSoft,textTransform:"uppercase" }}>{h}</div>
            ))}
          </div>

          {svcs.filter(svc => {
            const matchCat = svcFilter.cat === "all" || svc.category === svcFilter.cat
            const matchSearch = !svcFilter.search || svc.name.toLowerCase().includes(svcFilter.search.toLowerCase())
            return matchCat && matchSearch
          }).map(svc => (
            <div key={svc.id} style={{
              background:C.white, border:`1px solid ${C.border}`, borderRadius:12, padding:"10px 14px",
              display:"grid", gridTemplateColumns:"44px 1fr 90px 90px 100px 36px", gap:8, alignItems:"center",
            }}>
              {/* Emoji */}
              <div onClick={()=>setEmojiPicker(emojiPicker===`svc-${svc.id}`?null:`svc-${svc.id}`)} style={{
                width:38,height:38,borderRadius:10,cursor:"pointer",
                background:C.cream, border:`1.5px solid ${emojiPicker===`svc-${svc.id}`?C.green:C.border}`,
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,
                transition:"all .15s",
              }}>{svc.icon}</div>

              {/* Name */}
              <input value={svc.name} onChange={e=>updateSvc(svc.id,"name",e.target.value)}
                style={{...cfgInput, fontSize:11}} placeholder="Nombre del servicio" />

              {/* Duration */}
              <div style={{ display:"flex", alignItems:"center", gap:3 }}>
                <button onClick={()=>updateSvc(svc.id,"duration",Math.max(0,(svc.duration||0)-5))}
                  style={{ width:24,height:32,borderRadius:"7px 0 0 7px",border:`1px solid ${C.border}`,background:C.cream,color:C.textSoft,fontSize:14,cursor:"pointer",lineHeight:1 }}>−</button>
                <div style={{ ...cfgInput, width:"46px", textAlign:"center", borderRadius:0, borderLeft:"none", borderRight:"none", padding:"6px 4px", lineHeight:"20px" }}>
                  {svc.duration}
                </div>
                <button onClick={()=>updateSvc(svc.id,"duration",(svc.duration||0)+5)}
                  style={{ width:24,height:32,borderRadius:"0 7px 7px 0",border:`1px solid ${C.border}`,background:C.cream,color:C.textSoft,fontSize:14,cursor:"pointer",lineHeight:1 }}>+</button>
                <span style={{ fontSize:9,color:C.textSoft,marginLeft:2 }}>min</span>
              </div>

              {/* Price */}
              <div style={{ display:"flex", alignItems:"center", gap:3 }}>
                <span style={{ fontSize:10,color:C.textSoft }}>$</span>
                <input
                  type="text"
                  value={Number(svc.price).toLocaleString("es-AR")}
                  onChange={e => {
                    const raw = e.target.value.replace(/\./g,"").replace(/[^\d]/g,"")
                    updateSvc(svc.id,"price", raw === "" ? 0 : parseInt(raw)||0)
                  }}
                  style={{...cfgInput, width:"80px", textAlign:"right"}}
                />
              </div>

              {/* Category */}
              <select value={svc.category} onChange={e=>updateSvc(svc.id,"category",e.target.value)}
                style={{...cfgInput, fontSize:10, padding:"6px 6px"}}>
                {CAT_OPTIONS.map(c=><option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
              </select>

              {/* Remove */}
              <button onClick={()=>{ if(window.confirm(`¿Eliminar "${svc.name}"?`)) removeSvc(svc.id) }} style={{
                width:32,height:32,borderRadius:"50%",border:"none",
                background:"#fde8e8",color:"#c04040",fontSize:12,cursor:"pointer",
              }}>✕</button>

              {/* Inline emoji picker */}
              {emojiPicker === `svc-${svc.id}` && (
                <div style={{ gridColumn:"1 / -1" }}>
                  <EmojiPicker current={svc.icon} onSelect={e=>{updateSvc(svc.id,"icon",e);setEmojiPicker(null);}} />
                </div>
              )}
            </div>
          ))}

          {/* New service modal */}
          {newSvcModal && (
            <div style={{ position:"fixed", inset:0, zIndex:400, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,.4)" }}>
              <div style={{ background:C.white, borderRadius:20, padding:"24px 28px", width:"min(480px,calc(100vw-32px))", boxShadow:"0 20px 60px rgba(0,0,0,.2)" }}>
                <div style={{ fontSize:14, fontWeight:"bold", color:C.green, marginBottom:18 }}>✨ Nuevo servicio</div>

                <div style={{ marginBottom:12 }}>
                  <div style={{ fontSize:8, letterSpacing:"2px", color:C.textSoft, textTransform:"uppercase", marginBottom:6 }}>Ícono</div>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    {["💅","🦶","🌸","✨","💆","💇","🧖","🪷","🌿","🫧"].map(e => (
                      <button key={e} onClick={() => setNewSvc(p=>({...p,icon:e}))} style={{ width:36, height:36, borderRadius:10, border:`2px solid ${newSvc.icon===e?C.green:C.border}`, background:newSvc.icon===e?C.greenPale:"transparent", fontSize:18, cursor:"pointer" }}>{e}</button>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom:12 }}>
                  <div style={{ fontSize:8, letterSpacing:"2px", color:C.textSoft, textTransform:"uppercase", marginBottom:6 }}>Nombre</div>
                  <input value={newSvc.name} onChange={e=>setNewSvc(p=>({...p,name:e.target.value}))} placeholder="Ej: Manicura clásica" style={{...cfgInput, width:"100%", boxSizing:"border-box"}} autoFocus />
                </div>

                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
                  <div>
                    <div style={{ fontSize:8, letterSpacing:"2px", color:C.textSoft, textTransform:"uppercase", marginBottom:6 }}>Duración (min)</div>
                    <div style={{ display:"flex", alignItems:"center", gap:3 }}>
                      <button onClick={()=>setNewSvc(p=>({...p,duration:Math.max(0,p.duration-5)}))} style={{ width:28,height:32,borderRadius:"7px 0 0 7px",border:`1px solid ${C.border}`,background:C.cream,color:C.textSoft,fontSize:14,cursor:"pointer" }}>−</button>
                      <div style={{ ...cfgInput, width:50, textAlign:"center", borderRadius:0, borderLeft:"none", borderRight:"none", padding:"6px 4px" }}>{newSvc.duration}</div>
                      <button onClick={()=>setNewSvc(p=>({...p,duration:p.duration+5}))} style={{ width:28,height:32,borderRadius:"0 7px 7px 0",border:`1px solid ${C.border}`,background:C.cream,color:C.textSoft,fontSize:14,cursor:"pointer" }}>+</button>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize:8, letterSpacing:"2px", color:C.textSoft, textTransform:"uppercase", marginBottom:6 }}>Precio</div>
                    <div style={{ display:"flex", alignItems:"center", gap:3 }}>
                      <span style={{ fontSize:12, color:C.textSoft }}>$</span>
                      <input type="text" value={newSvc.price===0?"":Number(newSvc.price).toLocaleString("es-AR")} onChange={e=>{const raw=e.target.value.replace(/\./g,"").replace(/[^\d]/g,"");setNewSvc(p=>({...p,price:raw===""?0:parseInt(raw)||0}))}} placeholder="0" style={{...cfgInput, width:90, textAlign:"right"}} />
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom:20 }}>
                  <div style={{ fontSize:8, letterSpacing:"2px", color:C.textSoft, textTransform:"uppercase", marginBottom:6 }}>Categoría</div>
                  <select value={newSvc.category} onChange={e=>setNewSvc(p=>({...p,category:e.target.value}))} style={{...cfgInput, width:"100%", boxSizing:"border-box"}}>
                    {CAT_OPTIONS.map(cat => <option key={cat.id} value={cat.id}>{cat.icon} {cat.label}</option>)}
                  </select>
                </div>

                <div style={{ display:"flex", gap:10 }}>
                  <button onClick={()=>setNewSvcModal(false)} style={{ flex:1, padding:"10px", borderRadius:12, border:`1.5px solid ${C.border}`, background:C.white, color:C.textSoft, fontSize:12, cursor:"pointer", fontFamily:"Georgia,serif" }}>Cancelar</button>
                  <button onClick={saveNewSvc} disabled={!newSvc.name.trim()} style={{ flex:2, padding:"10px", borderRadius:12, border:"none", background:newSvc.name.trim()?`linear-gradient(135deg,${C.green},${C.greenLight})`:"#e8e8e8", color:newSvc.name.trim()?"#fff":"#bbb", fontSize:12, cursor:newSvc.name.trim()?"pointer":"not-allowed", fontFamily:"Georgia,serif" }}>✅ Guardar servicio</button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ── SISTEMA ─────────────────────────────────────────── */}
      {seccion === "sistema" && (
        <SectionCard title="⚙️ Parámetros del sistema">

          <CfgField label="💾 Backup de datos">
            <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
              <button onClick={() => {
                const data = { allData, gastos, sueldos, config, clientes, exportedAt: new Date().toISOString() }
                const blob = new Blob([JSON.stringify(data, null, 2)], { type:"application/json" })
                const url  = URL.createObjectURL(blob)
                const a    = document.createElement("a")
                a.href     = url
                a.download = `perlaverde-backup-${new Date().toISOString().slice(0,10)}.json`
                a.click()
                URL.revokeObjectURL(url)
              }} style={{ padding:"10px 18px", borderRadius:12, border:"none", background:`linear-gradient(135deg,${C.green},${C.greenLight})`, color:"#fff", fontSize:12, cursor:"pointer", fontFamily:"Georgia,serif" }}>
                ⬇️ Descargar backup
              </button>

              <label style={{ padding:"10px 18px", borderRadius:12, border:`1.5px solid ${C.border}`, background:C.white, color:C.textSoft, fontSize:12, cursor:"pointer", fontFamily:"Georgia,serif", display:"inline-block" }}>
                ⬆️ Restaurar backup
                <input type="file" accept=".json" style={{ display:"none" }} onChange={e => {
                  const file = e.target.files[0]
                  if (!file) return
                  const reader = new FileReader()
                  reader.onload = (ev) => {
                    try {
                      const data = JSON.parse(ev.target.result)
                      if (!data.allData && !data.config) { alert("Archivo de backup inválido"); return }
                      if (!window.confirm("¿Restaurar backup del " + (data.exportedAt?.slice(0,10) || "?") + "?\nEsto reemplazará todos los datos actuales.")) return
                      if (data.config)   setConfig(data.config)
                      if (data.allData)  window.__restoreAllData?.(data.allData)
                      if (data.gastos)   window.__restoreGastos?.(data.gastos)
                      if (data.sueldos)  window.__restoreSueldos?.(data.sueldos)
                      if (data.clientes) window.__restoreClientes?.(data.clientes)
                      alert("✅ Backup restaurado correctamente. La página se recargará.")
                      setTimeout(() => window.location.reload(), 1000)
                    } catch { alert("⚠️ Archivo inválido") }
                  }
                  reader.readAsText(file)
                }} />
              </label>
            </div>
            <div style={{ fontSize:10, color:C.textSoft, marginTop:6 }}>Descargá el backup seguido para no perder datos. Al restaurar se reemplaza todo el contenido actual.</div>
          </CfgField>

          <CfgField label={`Porcentaje de comisión por profesional (actualmente ${config.comisionPct}%)`}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <input type="range" min={1} max={100} value={config.comisionPct}
                onChange={e=>updateConfig("comisionPct",parseInt(e.target.value))}
                style={{ flex:1, accentColor:C.green }} />
              <div style={{
                minWidth:60, padding:"8px 12px", borderRadius:10, textAlign:"center",
                background:`linear-gradient(135deg,${C.gold},${C.goldLight})`,
                color:"#fff", fontSize:18, fontWeight:"bold",
              }}>{config.comisionPct}%</div>
            </div>
            <div style={{ fontSize:10,color:C.textSoft,marginTop:6 }}>
              Con {config.comisionPct}% de comisión, sobre $10.000 cada profesional gana <strong style={{color:C.gold}}>${(10000*config.comisionPct/100).toLocaleString("es-AR")}</strong>
            </div>
          </CfgField>

          <CfgField label="🎨 Estética del calendario">
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:C.cream, padding:"12px 16px", borderRadius:12, border:`1.5px solid ${C.border}` }}>
              <div>
                <div style={{ fontSize:12, color:C.text }}>Colores dinámicos en fechas</div>
                <div style={{ fontSize:10, color:C.textSoft }}>Pinta el carrusel de fechas según volumen y estado de pago</div>
              </div>
              <button onClick={() => updateConfig("dynamicDateColors", !config.dynamicDateColors)}
                style={{ width:44, height:24, borderRadius:12, border:"none", background:config.dynamicDateColors?C.green:"#ddd", cursor:"pointer", position:"relative", transition:"background .2s" }}>
                <div style={{ width:20, height:20, borderRadius:"50%", background:"#fff", position:"absolute", top:2, transition:"left .2s", left:config.dynamicDateColors?"22px":"2px" }}/>
              </button>
            </div>
          </CfgField>

          <CfgField label="🎨 Estética y personalización de Bloqueos">
            {/* Color Selection */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: C.textSoft, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8 }}>Color de los bloques inactivos</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                {BLOCKED_COLORS.map(c => {
                  const isSel = (config.blockedColor || "rojo") === c.id
                  return (
                    <button
                      key={c.id}
                      onClick={() => updateConfig("blockedColor", c.id)}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        border: `2px solid ${isSel ? C.text : "transparent"}`,
                        background: c.hex,
                        cursor: "pointer",
                        boxShadow: `0 4px 10px ${c.hex}44`,
                        transform: isSel ? "scale(1.15)" : "scale(1)",
                        transition: "all .15s ease",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        outline: "none",
                      }}
                      title={c.name}
                    >
                      {isSel && <span style={{ color: "#fff", fontSize: 12, fontWeight: "bold" }}>✓</span>}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Opacity Selection */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 10, color: C.textSoft, textTransform: "uppercase", letterSpacing: "1px" }}>Opacidad (10 niveles)</span>
                <span style={{ fontSize: 12, color: C.text, fontWeight: "bold" }}>Nivel {config.blockedOpacity || 3} / 10</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={config.blockedOpacity || 3}
                  onChange={e => updateConfig("blockedOpacity", parseInt(e.target.value))}
                  style={{
                    flex: 1,
                    accentColor: (BLOCKED_COLORS.find(c => c.id === (config.blockedColor || "rojo")) || BLOCKED_COLORS[0]).hex,
                    cursor: "pointer",
                  }}
                />
              </div>
            </div>

            {/* Visual Preview Card */}
            {(() => {
              const activeCol = BLOCKED_COLORS.find(c => c.id === (config.blockedColor || "rojo")) || BLOCKED_COLORS[0]
              const level = config.blockedOpacity || 3
              const previewAlphas = {
                1: { a1: 0.01, a2: 0.03, border: 0.08 },
                2: { a1: 0.02, a2: 0.05, border: 0.14 },
                3: { a1: 0.03, a2: 0.08, border: 0.20 },
                4: { a1: 0.05, a2: 0.12, border: 0.28 },
                5: { a1: 0.08, a2: 0.18, border: 0.38 },
                6: { a1: 0.12, a2: 0.25, border: 0.50 },
                7: { a1: 0.16, a2: 0.32, border: 0.62 },
                8: { a1: 0.20, a2: 0.40, border: 0.74 },
                9: { a1: 0.25, a2: 0.50, border: 0.86 },
                10: { a1: 0.32, a2: 0.65, border: 0.98 },
              }[level] || { a1: 0.03, a2: 0.08, border: 0.20 }

              return (
                <div style={{
                  background: C.cream,
                  borderRadius: 12,
                  padding: "14px 18px",
                  border: `1.5px solid ${C.border}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  marginTop: 10
                }}>
                  <div>
                    <div style={{ fontSize: 11, color: C.text, fontWeight: "bold" }}>Vista previa del bloqueo</div>
                    <div style={{ fontSize: 9, color: C.textSoft, marginTop: 2 }}>Así se verá en la grilla de turnos</div>
                  </div>
                  <div style={{
                    width: 140,
                    height: 52,
                    borderRadius: 9,
                    background: `repeating-linear-gradient(
                      45deg,
                      rgba(${activeCol.rgb}, ${previewAlphas.a1}),
                      rgba(${activeCol.rgb}, ${previewAlphas.a1}) 10px,
                      rgba(${activeCol.rgb}, ${previewAlphas.a2}) 10px,
                      rgba(${activeCol.rgb}, ${previewAlphas.a2}) 20px
                    )`,
                    border: `1.5px dashed rgba(${activeCol.rgb}, ${previewAlphas.border})`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}>
                    <span style={{ fontSize: 10, fontWeight: "bold", color: `rgba(${activeCol.rgb}, ${Math.max(0.4, previewAlphas.border)})`, letterSpacing: "1px" }}>BLOQUEADO</span>
                  </div>
                </div>
              )
            })()}
          </CfgField>
        </SectionCard>
      )}
    </div>
  );
}

// ── Config sub-components ─────────────────────────────────────────────────────
function EmojiPicker({ current, onSelect }) {
  return (
    <div style={{
      marginTop:10, padding:"12px", borderRadius:12,
      background:C.cream, border:`1.5px solid ${C.greenMint}`,
      display:"flex", flexWrap:"wrap", gap:6,
    }}>
      {EMOJI_SUGGESTIONS.map(e => (
        <div key={e} onClick={()=>onSelect(e)} style={{
          width:36, height:36, borderRadius:9, cursor:"pointer",
          border:`2px solid ${e===current?C.green:"transparent"}`,
          background: e===current?C.greenPale:"transparent",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:20, transition:"all .12s",
        }}>{e}</div>
      ))}
      <div style={{ width:"100%", borderTop:`1px solid ${C.border}`, marginTop:6, paddingTop:8 }}>
        <label style={{ fontSize:8,letterSpacing:"2px",color:C.textSoft,textTransform:"uppercase" }}>O escribí un emoji personalizado:</label>
        <input
          maxLength={4}
          defaultValue=""
          placeholder="🦋"
          onKeyDown={e=>{ if(e.key==="Enter" && e.target.value) onSelect(e.target.value); }}
          style={{ ...cfgInput, width:80, textAlign:"center", fontSize:20, marginTop:4 }}
        />
      </div>
    </div>
  );
}

function SectionCard({ title, children }) {
  return (
    <div style={{ background:C.white, borderRadius:16, padding:"20px", border:`1px solid ${C.border}`, boxShadow:`0 2px 12px ${C.shadow}` }}>
      {title && <div style={{ fontSize:13,color:C.text,marginBottom:16,fontWeight:"bold" }}>{title}</div>}
      {children}
    </div>
  );
}

function CfgField({ label, children }) {
  return (
    <div style={{ marginBottom:12 }}>
      <label style={cfgLabel}>{label}</label>
      {children}
    </div>
  );
}

const cfgLabel = { fontSize:8, letterSpacing:"2px", color:C.textSoft, textTransform:"uppercase", display:"block", marginBottom:5 };
const cfgInput = {
  width:"100%", padding:"8px 11px",
  border:`1.5px solid ${C.border}`, borderRadius:9,
  fontSize:12, color:C.text, background:C.cream,
  outline:"none", fontFamily:"Georgia,serif",
  transition:"border-color .2s",
};
