import { useState } from "react"
import { C } from "../../constants/colors.js"
import { CAT_OPTIONS, EMOJI_SUGGESTIONS } from "../../constants/data.js"
import { GhostBtn, SolidBtn } from "../ui/index.jsx"

// ─── Config View ──────────────────────────────────────────────────────────────

export default function ConfigView({ config, setConfig }) {
  const [seccion, setSeccion] = useState("empresa");
  const [emojiPicker, setEmojiPicker] = useState(null); // "empresa" | profId | svcId

  // Safety guard
  const profs    = config?.professionals || []
  const svcs     = config?.services     || []


  const updateConfig  = (field, value) => setConfig(p => ({ ...p, [field]: value }));

  // ── Professionals ────────────────────────────────────────────────────────
  const updateProf = (id, field, value) =>
    setConfig(p => ({ ...p, professionals: p.professionals.map(pr => pr.id===id ? {...pr,[field]:value} : pr) }));

  const addProf = () => {
    const newId = Date.now();
    setConfig(p => ({ ...p, professionals: [...p.professionals, { id:newId, name:"Nueva profesional", emoji:"🌸" }] }));
  };

  const removeProf = (id) =>
    setConfig(p => ({ ...p, professionals: p.professionals.filter(pr => pr.id!==id) }));

  // ── Services ─────────────────────────────────────────────────────────────
  const updateSvc = (id, field, value) =>
    setConfig(p => ({ ...p, services: p.services.map(s => s.id===id ? {...s,[field]:value} : s) }));

  const addSvc = () => {
    const newId = Date.now();
    setConfig(p => ({ ...p, services: [...p.services, { id:newId, name:"Nuevo servicio", duration:60, price:5000, category:"manos", icon:"💅" }] }));
  };

  const removeSvc = (id) =>
    setConfig(p => ({ ...p, services: p.services.filter(s => s.id!==id) }));

  const TABS = [
    { id:"empresa",       icon:"🏠", label:"Empresa" },
    { id:"profesionales", icon:"👩", label:"Profesionales" },
    { id:"servicios",     icon:"💅", label:"Servicios" },
    { id:"sistema",       icon:"⚙️", label:"Sistema" },
  ];

  return (
    <div style={{ maxWidth:860, margin:"0 auto", padding:"16px 12px 80px" }}>

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
              <div style={{ width:40,height:40,borderRadius:"50%",background:`linear-gradient(135deg,${C.green},${C.greenLight})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20 }}>{config.empresaEmoji}</div>
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
          {/* Column headers */}
          <div style={{ display:"grid", gridTemplateColumns:"44px minmax(100px,1fr) 80px 80px 90px 36px", gap:8, padding:"0 14px", alignItems:"center" }}>
            {["Ícono","Nombre","Duración","Precio","Categoría",""].map((h,i)=>(
              <div key={i} style={{ fontSize:8,letterSpacing:"1.5px",color:C.textSoft,textTransform:"uppercase" }}>{h}</div>
            ))}
          </div>

          {svcs.map(svc => (
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
                <button onClick={()=>updateSvc(svc.id,"duration",Math.max(5,(svc.duration||0)-5))}
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
                    updateSvc(svc.id,"price", parseInt(raw)||0)
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
              <button onClick={()=>removeSvc(svc.id)} style={{
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

          <button onClick={addSvc} style={{
            width:"100%", padding:"12px", borderRadius:14,
            border:`2px dashed ${C.greenMint}`, background:"transparent",
            color:C.green, fontSize:12, cursor:"pointer", fontFamily:"Georgia,serif",
            letterSpacing:"1px", transition:"all .15s",
          }}>＋ Agregar servicio</button>
        </div>
      )}

      {/* ── SISTEMA ─────────────────────────────────────────── */}
      {seccion === "sistema" && (
        <SectionCard title="⚙️ Parámetros del sistema">
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
