import { useState } from "react"
import { C } from "../../constants/colors.js"
import { CAT_OPTIONS as CAT_OPTIONS_DEFAULT, EMOJI_SUGGESTIONS, BLOCKED_COLORS } from "../../constants/data.js"
import { GhostBtn, SolidBtn } from "../ui/index.jsx"
import { MESES_ES, todayKey } from "../../utils/dates.js"

// ─── Config View ──────────────────────────────────────────────────────────────

export default function ConfigView({ config, setConfig, allData, gastos, sueldos, clientes, onLogout }) {
  const [seccion, setSeccion] = useState("empresa");
  const [emojiPicker,  setEmojiPicker]  = useState(null)
  const [svcFilter,    setSvcFilter]    = useState({ cat:"all", search:"" })
  const [newSvcModal,  setNewSvcModal]  = useState(false)
  const [newSvc,       setNewSvc]       = useState({ name:"", duration:0, price:0, category:"manos", icon:"💅", rama:"manos" })
  const [newCatModal,  setNewCatModal]  = useState(false)
  const [newCat,       setNewCat]       = useState({ label: "", icon: "🌟" })
  const [newRamaModal, setNewRamaModal] = useState(false)
  const [newRama,      setNewRama]      = useState({ label: "" })
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [excViewDate,  setExcViewDate]  = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  })
  const [selectedExcDate, setSelectedExcDate] = useState(null)
  const [selectedExcPct,  setSelectedExcPct]  = useState("")
  const [calOpen,         setCalOpen]         = useState(false)

  // Safety guard
  const profs    = config?.professionals || []
  const svcs     = config?.services     || []
  
  // Dynamic categories — merge default + custom ones from config
  const CAT_OPTIONS = [
    ...CAT_OPTIONS_DEFAULT,
    ...((config?.customCategories || []).map(cc => ({ id: cc.id, label: cc.label, icon: cc.icon }))),
  ]

  const addCustomCategory = () => {
    setNewCat({ label: "", icon: "🌟" })
    setNewCatModal(true)
  }

  const saveNewCat = () => {
    if (!newCat.label.trim()) return
    const id = "custom_" + Date.now()
    setConfig(p => ({
      ...p,
      customCategories: [...(p.customCategories || []), { id, label: newCat.label.trim(), icon: newCat.icon }]
    }))
    setNewCatModal(false)
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
    setConfig(p => ({ ...p, professionals: [...p.professionals, { id:newId, name:"Nueva profesional", emoji:"🌸", rama: "manos" }] }));
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
    setNewSvc({ name:"", duration:0, price:0, category:"manos", icon:"💅", rama:"manos" })
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

  const addCustomRama = () => {
    setNewRama({ label: "" })
    setNewRamaModal(true)
  }

  const saveNewRama = () => {
    if (!newRama.label.trim()) return
    const cleanName = newRama.label.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    if ((config.customRamas || []).includes(cleanName)) {
      alert("Esta rama ya existe")
      return
    }
    setConfig(p => ({
      ...p,
      customRamas: [...(p.customRamas || []), cleanName]
    }))
    setNewRamaModal(false)
  }

  const removeCustomRama = (ramaName) => {
    if (!window.confirm(`¿Eliminar la rama "${getDatalistLabel(ramaName)}"?`)) return
    setConfig(p => ({
      ...p,
      customRamas: (p.customRamas || []).filter(r => String(r || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") !== ramaName)
    }))
  }

  const TABS = [
    { id:"empresa",       icon:"🏠", label:"Empresa" },
    { id:"profesionales", icon:"👩", label:"Profesionales" },
    { id:"servicios",     icon:"💅", label:"Servicios" },
    { id:"sistema",       icon:"⚙️", label:"Sistema" },
  ];

  const uniqueRamas = Array.from(new Set([
    "manos",
    "peluqueria",
    "estetica",
    "pestanas",
    ...(config.customRamas || []).map(r => String(r || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")),
    ...profs.map(p => String(p.rama || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")).filter(Boolean),
    ...svcs.map(s => String(s.rama || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")).filter(Boolean)
  ]))

  const getDatalistLabel = (r) => {
    const clean = String(r || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (clean === "manos") return "💅 Manos"
    if (clean === "peluqueria") return "💇‍♀️ Peluquería"
    if (clean === "estetica") return "🧴 Estética"
    if (clean === "pestanas") return "👁️ Pestañas"
    return r.charAt(0).toUpperCase() + r.slice(1)
  }

  return (
    <div style={{ maxWidth: seccion === "servicios" ? "96%" : 860, margin:"0 auto", padding:"16px 12px 100px", transition: "max-width 0.3s ease" }}>


      {/* Section tabs */}
      <div style={{ maxWidth: 836, margin: "0 auto 28px", display:"flex", gap:12, flexWrap:"wrap", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
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

        {onLogout && (
          <button 
            onClick={onLogout} 
            style={{
              padding:"8px 20px", 
              borderRadius:22, 
              cursor:"pointer",
              border:"1.5px solid #fde8e8",
              background: "linear-gradient(135deg, #fff5f5, #ffe8e8)",
              color: "#c04040",
              fontSize:11, 
              letterSpacing:"1px", 
              textTransform:"uppercase",
              fontFamily:"Georgia,serif", 
              fontWeight:"bold",
              transition:"all .18s", 
              boxShadow:"0 2px 8px rgba(192,64,64,.06)",
              minWidth:140,
              display:"flex",
              alignItems:"center",
              justifyContent:"center",
              gap:6
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = "linear-gradient(135deg, #c04040, #e06060)"
              e.currentTarget.style.color = "#fff"
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(192,64,64,.2)"
              e.currentTarget.style.borderColor = "transparent"
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "linear-gradient(135deg, #fff5f5, #ffe8e8)"
              e.currentTarget.style.color = "#c04040"
              e.currentTarget.style.boxShadow = "0 2px 8px rgba(192,64,64,.06)"
              e.currentTarget.style.borderColor = "#fde8e8"
            }}
          >
            🚪 Cerrar Sesión
          </button>
        )}
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

                <div style={{ flex:2, minWidth:160 }}>
                  <label style={cfgLabel}>Nombre</label>
                  <input value={prof.name} onChange={e=>updateProf(prof.id,"name",e.target.value)}
                    style={cfgInput} placeholder="Nombre de la profesional" />
                </div>

                <div style={{ flex:1, minWidth:140 }}>
                  <label style={cfgLabel}>Rama / Especialidad</label>
                  <select
                    value={prof.rama || "manos"}
                    onChange={e => updateProf(prof.id, "rama", e.target.value)}
                    style={{ ...cfgInput, cursor: "pointer" }}
                  >
                    {uniqueRamas.map(r => (
                      <option key={r} value={r}>{getDatalistLabel(r)}</option>
                    ))}
                  </select>
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

          {/* Custom style block for responsiveness and beautiful layout */}
          <style>{`
            .services-grid-header {
              display: grid;
              grid-template-columns: 38px minmax(120px, 1fr) 90px 80px 100px 100px 75px 80px 36px;
              gap: 8px;
              padding: 0 12px;
              align-items: center;
              margin-bottom: 6px;
            }
            .service-row-card {
              background: ${C.white};
              border: 1.5px solid ${C.border};
              border-radius: 14px;
              padding: 8px 12px;
              display: grid;
              grid-template-columns: 38px minmax(120px, 1fr) 90px 80px 100px 100px 75px 80px 36px;
              gap: 8px;
              align-items: center;
              box-shadow: 0 2px 8px rgba(0,0,0,.01);
              transition: all .2s ease;
            }
            .service-row-card:hover {
              border-color: ${C.greenMint};
              box-shadow: 0 2px 10px rgba(58,125,68,.04);
            }
            .service-mobile-row-top, .service-mobile-row-grid {
              display: contents;
            }
            .svc-col-icon { order: 1; }
            .svc-col-name { order: 2; }
            .svc-col-duration { order: 3; }
            .svc-col-price { order: 4; }
            .svc-col-category { order: 5; }
            .svc-col-rama { order: 6; }
            .svc-col-comisionPct { order: 7; }
            .svc-col-excluido { order: 8; display: flex; align-items: center; justify-content: center; }
            .svc-col-remove { order: 9; }
            .svc-excluido-lbl { display: none; }
            @media (max-width: 768px) {
              .services-grid-header {
                display: none;
              }
              .service-row-card {
                display: flex;
                flex-direction: column;
                align-items: stretch;
                gap: 12px;
                padding: 16px;
              }
              .service-mobile-row-top {
                display: flex !important;
                align-items: center;
                gap: 10px;
                width: 100%;
              }
              .service-mobile-row-grid {
                display: grid !important;
                grid-template-columns: 1fr 1fr;
                gap: 10px;
                width: 100%;
              }
              .svc-col-icon, .svc-col-name, .svc-col-duration, .svc-col-price, .svc-col-category, .svc-col-rama, .svc-col-remove {
                order: initial;
              }
              .svc-col-excluido {
                grid-column: span 2;
                background: #fdf6ee;
                border: 1px solid #fce8d5;
                padding: 8px 12px;
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                font-size: 11px;
              }
              .svc-excluido-lbl { display: inline !important; }
            }
            .branches-grid-container {
              display: grid;
              grid-template-columns: 1fr;
              gap: 20px;
            }
            @media (min-width: 1100px) {
              .branches-grid-container {
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 24px;
                align-items: start;
              }
              .branches-grid-container .services-grid-header {
                display: grid !important;
                grid-template-columns: 32px minmax(120px, 1.85fr) 76px 70px 85px 85px 52px 30px 30px !important;
                gap: 6px !important;
                padding: 0 8px !important;
                margin-bottom: 4px !important;
              }
              .branches-grid-container .services-grid-header div {
                font-size: 8px !important;
                letter-spacing: 0.5px !important;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
              }
              .branches-grid-container .service-row-card {
                display: grid !important;
                grid-template-columns: 32px minmax(120px, 1.85fr) 76px 70px 85px 85px 52px 30px 30px !important;
                gap: 6px !important;
                padding: 6px 8px !important;
              }
              .branches-grid-container .service-mobile-row-top,
              .branches-grid-container .service-mobile-row-grid {
                display: contents !important;
              }
              .branches-grid-container .svc-col-icon {
                order: 1 !important;
                width: 32px !important;
                height: 32px !important;
                font-size: 16px !important;
                border-radius: 8px !important;
              }
              .branches-grid-container .svc-col-name {
                order: 2 !important;
                height: 32px !important;
                padding: 0 6px !important;
                font-size: 11px !important;
                border-radius: 8px !important;
              }
              .branches-grid-container .svc-col-duration {
                order: 3 !important;
                font-size: 10px !important;
                gap: 2px !important;
                justify-content: center !important;
              }
              .branches-grid-container .svc-col-duration > div {
                height: 32px !important;
                border-radius: 8px !important;
                max-width: 72px !important;
              }
              .branches-grid-container .svc-col-duration button {
                width: 18px !important;
                font-size: 11px !important;
              }
              .branches-grid-container .svc-col-duration div {
                font-size: 11px !important;
              }
              .branches-grid-container .svc-col-duration span {
                font-size: 9px !important;
              }
              .branches-grid-container .svc-col-price {
                order: 4 !important;
                height: 32px !important;
                padding: 0 6px !important;
                border-radius: 8px !important;
              }
              .branches-grid-container .svc-col-price input {
                font-size: 11px !important;
              }
              .branches-grid-container .svc-col-price span {
                font-size: 11px !important;
                margin-right: 2px !important;
              }
              .branches-grid-container .svc-col-category {
                order: 5 !important;
                height: 32px !important;
                padding: 0 4px !important;
                font-size: 10.5px !important;
                border-radius: 8px !important;
              }
              .branches-grid-container .svc-col-rama {
                order: 6 !important;
                height: 32px !important;
                padding: 0 4px !important;
                font-size: 10.5px !important;
                border-radius: 8px !important;
              }
              .branches-grid-container .svc-col-comisionPct {
                order: 7 !important;
                height: 32px !important;
                padding: 0 4px !important;
                border-radius: 8px !important;
              }
              .branches-grid-container .svc-col-comisionPct input {
                font-size: 11px !important;
              }
              .branches-grid-container .svc-col-excluido {
                order: 8 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                background: transparent !important;
                border: none !important;
                padding: 0 !important;
              }
              .branches-grid-container .svc-col-excluido input {
                width: 16px !important;
                height: 16px !important;
              }
              .branches-grid-container .svc-excluido-lbl {
                display: none !important;
              }
              .branches-grid-container .svc-col-remove {
                order: 9 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
              }
              .branches-grid-container .svc-col-remove button {
                width: 32px !important;
                height: 32px !important;
                font-size: 11px !important;
              }
            }
          `}</style>

          {/* Add button + filters at the top */}
          <div style={{ 
            display: "flex", 
            gap: 12, 
            flexWrap: "wrap", 
            alignItems: "center", 
            background: C.white, 
            padding: "12px 16px", 
            borderRadius: 14, 
            border: `1.5px solid ${C.border}`,
            boxShadow: "0 2px 10px rgba(0,0,0,.02)",
            marginBottom: 8
          }}>
            {/* Search Input */}
            <div style={{ position: "relative", flex: "1 1 200px", minWidth: 200 }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.textSoft, fontSize: 13 }}>🔍</span>
              <input
                placeholder="Buscar servicios..."
                value={svcFilter.search}
                onChange={e => setSvcFilter(p => ({...p, search: e.target.value}))}
                style={{
                  ...cfgInput,
                  paddingLeft: 32,
                  height: 38,
                  fontSize: 12,
                  borderRadius: 11,
                  borderColor: C.border,
                  background: C.cream,
                  transition: "all 0.2s"
                }}
                onFocus={e => e.currentTarget.style.borderColor = C.greenMint}
                onBlur={e => e.currentTarget.style.borderColor = C.border}
              />
            </div>

            {/* Category Filter */}
            <select 
              value={svcFilter.cat} 
              onChange={e => setSvcFilter(p => ({...p, cat: e.target.value}))}
              style={{
                ...cfgInput,
                width: 170,
                height: 38,
                fontSize: 12,
                borderRadius: 11,
                padding: "0 10px",
                borderColor: C.border,
                background: C.cream,
                cursor: "pointer",
                transition: "all 0.2s"
              }}
              onFocus={e => e.currentTarget.style.borderColor = C.greenMint}
              onBlur={e => e.currentTarget.style.borderColor = C.border}
            >
              <option value="all">Todas las categorías</option>
              {CAT_OPTIONS.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.icon} {cat.label}</option>
              ))}
            </select>

            {/* Dropdown Menu for Nueva Rama / Nueva Categoría */}
            <div style={{ position: "relative" }}>
              <button 
                onClick={() => setDropdownOpen(!dropdownOpen)} 
                style={actionBtnStyle}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.greenMint; e.currentTarget.style.background = C.greenPale; e.currentTarget.style.color = C.green }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.white; e.currentTarget.style.color = C.textSoft }}
              >
                🌿 Nueva Rama / Categoría ▾
              </button>
              {dropdownOpen && (
                <>
                  <div 
                    onClick={() => setDropdownOpen(false)} 
                    style={{ position: "fixed", inset: 0, zIndex: 99 }} 
                  />
                  <div style={{
                    position: "absolute",
                    top: "calc(100% + 6px)",
                    right: 0,
                    zIndex: 100,
                    background: C.white,
                    border: `1.5px solid ${C.greenMint}`,
                    borderRadius: 12,
                    boxShadow: `0 8px 24px ${C.shadow}`,
                    padding: "6px",
                    minWidth: 170,
                    display: "flex",
                    flexDirection: "column",
                    gap: 4
                  }}>
                    <button 
                      onClick={() => { addCustomCategory(); setDropdownOpen(false); }}
                      style={{
                        padding: "8px 12px",
                        background: "transparent",
                        border: "none",
                        borderRadius: 8,
                        textAlign: "left",
                        fontSize: 11,
                        fontWeight: "bold",
                        color: C.textSoft,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        transition: "all .12s"
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = C.greenPale; e.currentTarget.style.color = C.green }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.textSoft }}
                    >
                      ➕ Nueva Categoría
                    </button>
                    <button 
                      onClick={() => { addCustomRama(); setDropdownOpen(false); }}
                      style={{
                        padding: "8px 12px",
                        background: "transparent",
                        border: "none",
                        borderRadius: 8,
                        textAlign: "left",
                        fontSize: 11,
                        fontWeight: "bold",
                        color: C.textSoft,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        transition: "all .12s"
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = C.greenPale; e.currentTarget.style.color = C.green }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.textSoft }}
                    >
                      🌿 Nueva Rama
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Agregar Servicio Button */}
            <button 
              onClick={addSvc} 
              style={primaryBtnStyle}
              onMouseEnter={e => { e.currentTarget.style.opacity = "0.92"; e.currentTarget.style.transform = "translateY(-1px)" }}
              onMouseLeave={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "none" }}
            >
              ✨ Agregar Servicio
            </button>
          </div>

          {/* Custom categories & custom ramas tags */}
          {((config?.customCategories||[]).length > 0 || (config?.customRamas||[]).length > 0) && (
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom: 6, padding: "0 4px" }}>
              {/* Custom categories */}
              {(config?.customCategories||[]).map(cc => (
                <div key={cc.id} style={{ display:"flex", alignItems:"center", gap:6, background:C.cream, border:`1px solid ${C.border}`, borderRadius:20, padding:"4px 12px", boxShadow: "0 1px 4px rgba(0,0,0,0.02)" }}>
                  <span style={{ fontSize:11, color: C.text, fontWeight: "bold" }}>{cc.icon} {cc.label}</span>
                  <button onClick={() => removeCustomCategory(cc.id)} style={{ border:"none", background:"transparent", color:"#c04040", cursor:"pointer", fontSize:11, padding:0, display: "flex", alignItems: "center" }}>✕</button>
                </div>
              ))}
              
              {/* Custom ramas */}
              {Array.from(new Set((config?.customRamas||[]).map(r => String(r || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")))).map(r => (
                <div key={r} style={{ display:"flex", alignItems:"center", gap:6, background:C.greenPale, border:`1px solid ${C.greenMint}`, borderRadius:20, padding:"4px 12px", boxShadow: "0 1px 4px rgba(0,0,0,0.02)" }}>
                  <span style={{ fontSize:11, color: C.green, fontWeight: "bold" }}>🌿 {getDatalistLabel(r)}</span>
                  <button onClick={() => removeCustomRama(r)} style={{ border:"none", background:"transparent", color:"#c04040", cursor:"pointer", fontSize:11, padding:0, display: "flex", alignItems: "center" }}>✕</button>
                </div>
              ))}
            </div>
          )}

          {/* Grouped Services List */}
          {(() => {
            const filteredSvcs = svcs.filter(svc => {
              const matchCat = svcFilter.cat === "all" || svc.category === svcFilter.cat
              const matchSearch = !svcFilter.search || svc.name.toLowerCase().includes(svcFilter.search.toLowerCase())
              return matchCat && matchSearch
            })

            // Get all unique ramas present in the filtered services
            const servicesRamas = Array.from(new Set(filteredSvcs.map(s => String(s.rama || "manos").trim().toLowerCase())))

            if (filteredSvcs.length === 0) {
              return (
                <div style={{ textAlign: "center", padding: "40px 20px", color: C.textSoft, fontSize: 13, background: C.white, borderRadius: 16, border: `1.5px solid ${C.border}` }}>
                  📭 No se encontraron servicios con los filtros actuales.
                </div>
              )
            }

            return (
              <div className="branches-grid-container">
                {servicesRamas.map(ramaName => {
                  const ramaServices = filteredSvcs.filter(s => String(s.rama || "manos").trim().toLowerCase() === ramaName)
                  if (ramaServices.length === 0) return null

                  return (
                    <div key={ramaName} style={{ marginBottom: 24 }}>
                      {/* Rama Section Header */}
                      <div style={{
                        fontSize: 12,
                        fontWeight: "bold",
                        color: C.green,
                        fontFamily: "Georgia, serif",
                        letterSpacing: "1px",
                        textTransform: "uppercase",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginTop: 18,
                        marginBottom: 12,
                        borderBottom: `2px solid ${C.greenPale}`,
                        paddingBottom: 6
                      }}>
                        <span>{getDatalistLabel(ramaName)}</span>
                        <span style={{
                          fontSize: 10,
                          fontWeight: "normal",
                          color: C.textSoft,
                          background: C.greenPale,
                          padding: "2px 8px",
                          borderRadius: 12,
                          marginLeft: 8,
                          textTransform: "none"
                        }}>
                          {ramaServices.length} {ramaServices.length === 1 ? "servicio" : "servicios"}
                        </span>
                      </div>

                      {/* Column headers */}
                      <div className="services-grid-header">
                        {[
                          { label: "Ícono", align: "center" },
                          { label: "Nombre", align: "left" },
                          { label: "Duración", align: "center" },
                          { label: "Precio", align: "center" },
                          { label: "Categoría", align: "left" },
                          { label: "Rama", align: "left" },
                          { label: "% Comi.", align: "center" },
                          { label: "Sin Comi.", align: "center" },
                          { label: "", align: "center" }
                        ].map((h, i) => (
                          <div key={i} style={{ 
                            fontSize: 8, 
                            letterSpacing: "1.5px", 
                            color: C.textSoft, 
                            textTransform: "uppercase", 
                            fontWeight: "bold",
                            textAlign: h.align
                          }}>{h.label}</div>
                        ))}
                      </div>

                      {/* Services List */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {ramaServices.map(svc => (
                          <div key={svc.id} className="service-row-card">
                            
                            <div className="service-mobile-row-top">
                              {/* Emoji */}
                              <div className="svc-col-icon" onClick={()=>setEmojiPicker(emojiPicker===`svc-${svc.id}`?null:`svc-${svc.id}`)} style={{
                                width:38,height:38,borderRadius:10,cursor:"pointer",
                                background:C.cream, border:`1.5px solid ${emojiPicker===`svc-${svc.id}`?C.green:C.border}`,
                                display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,
                                transition:"all .15s",
                                margin: "0 auto"
                              }}>{svc.icon}</div>

                              {/* Name */}
                              <input 
                                className="svc-col-name"
                                value={svc.name} 
                                onChange={e=>updateSvc(svc.id,"name",e.target.value)}
                                style={rowInputStyle} 
                                placeholder="Nombre del servicio" 
                              />

                              {/* Remove button */}
                              <div className="svc-col-remove" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <button 
                                  onClick={() => { if (window.confirm(`¿Eliminar "${svc.name}"?`)) removeSvc(svc.id) }} 
                                  style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: "50%",
                                    border: "none",
                                    background: "#fde8e8",
                                    color: "#c04040",
                                    fontSize: 12,
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    transition: "all .15s ease-in-out"
                                  }}
                                  onMouseEnter={e => { e.currentTarget.style.background = "#c04040"; e.currentTarget.style.color = "#fff" }}
                                  onMouseLeave={e => { e.currentTarget.style.background = "#fde8e8"; e.currentTarget.style.color = "#c04040" }}
                                >✕</button>
                              </div>
                            </div>

                            <div className="service-mobile-row-grid">
                              {/* Duration */}
                              <div className="svc-col-duration" style={{ display:"flex", alignItems:"center", gap:3, justifyContent: "center" }}>
                                <div style={{ display: "flex", alignItems: "center", border: `1.5px solid ${C.border}`, borderRadius: 9, background: C.white, overflow: "hidden", height: 34, width: "100%", maxWidth: 84 }}>
                                  <button 
                                    onClick={() => updateSvc(svc.id, "duration", Math.max(0, (svc.duration || 0) - 5))}
                                    style={{ width: 24, height: "100%", border: "none", background: C.cream, color: C.textSoft, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", outline: "none", transition: "background .15s" }}
                                    onMouseEnter={e => e.currentTarget.style.background = C.greenPale}
                                    onMouseLeave={e => e.currentTarget.style.background = C.cream}
                                    >−</button>
                                  <div style={{ flex: 1, textAlign: "center", fontSize: 11, fontWeight: "bold", color: C.text }}>
                                    {svc.duration}
                                  </div>
                                  <button 
                                    onClick={() => updateSvc(svc.id, "duration", (svc.duration || 0) + 5)}
                                    style={{ width: 24, height: "100%", border: "none", background: C.cream, color: C.textSoft, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", outline: "none", transition: "background .15s" }}
                                    onMouseEnter={e => { e.currentTarget.style.background = C.greenPale }}
                                    onMouseLeave={e => { e.currentTarget.style.background = C.cream }}
                                    >+</button>
                                </div>
                                <span style={{ fontSize:9, color:C.textSoft }}>min</span>
                              </div>

                              {/* Price */}
                              <div className="svc-col-price" style={{ display: "flex", alignItems: "center", border: `1.5px solid ${C.border}`, borderRadius: 9, background: C.cream, height: 34, padding: "0 8px", width: "100%" }}>
                                <span style={{ fontSize: 11, color: C.textSoft, fontWeight: "bold", marginRight: 4 }}>$</span>
                                <input
                                  type="text"
                                  value={Number(svc.price).toLocaleString("es-AR")}
                                  onChange={e => {
                                    const raw = e.target.value.replace(/\./g, "").replace(/[^\d]/g, "")
                                    updateSvc(svc.id, "price", raw === "" ? 0 : parseInt(raw) || 0)
                                  }}
                                  style={{ border: "none", width: "100%", height: "100%", fontSize: 11, textAlign: "right", color: C.orange, fontWeight: "bold", background: "transparent", outline: "none", padding: 0 }}
                                />
                              </div>

                              {/* Category */}
                              <select 
                                className="svc-col-category"
                                value={svc.category} 
                                onChange={e=>updateSvc(svc.id,"category",e.target.value)}
                                style={{ 
                                  ...rowInputStyle, 
                                  fontSize: 10, 
                                  padding: "0 6px", 
                                  cursor: "pointer"
                                }}
                              >
                                {CAT_OPTIONS.map(c=><option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
                              </select>

                              {/* Rama */}
                              <select
                                className="svc-col-rama"
                                value={svc.rama || "manos"}
                                onChange={e=>updateSvc(svc.id,"rama",e.target.value)}
                                style={{ 
                                  ...rowInputStyle, 
                                  fontSize: 10, 
                                  color: C.green,
                                  fontWeight: "bold",
                                  cursor: "pointer"
                                }}
                              >
                                {uniqueRamas.map(r => (
                                  <option key={r} value={r}>{getDatalistLabel(r)}</option>
                                ))}
                              </select>
                              
                              {/* % Comisión */}
                              <div className="svc-col-comisionPct" style={{ display: "flex", alignItems: "center", border: `1.5px solid ${C.border}`, borderRadius: 9, background: C.cream, height: 34, padding: "0 8px", width: "100%" }}>
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  placeholder={`${config.comisionPct}%`}
                                  value={svc.comisionPct !== undefined && svc.comisionPct !== null ? svc.comisionPct : ""}
                                  onChange={e => {
                                    const val = e.target.value === "" ? null : parseInt(e.target.value)
                                    updateSvc(svc.id, "comisionPct", isNaN(val) ? null : val)
                                  }}
                                  style={{ border: "none", width: "100%", height: "100%", fontSize: 11, textAlign: "center", color: C.green, fontWeight: "bold", background: "transparent", outline: "none", padding: 0 }}
                                />
                              </div>

                              {/* Sin Comisión Toggle */}
                              <div className="svc-col-excluido">
                                <span className="svc-excluido-lbl" style={{ fontSize: 10, color: C.textSoft, fontWeight: "bold", marginRight: 4 }}>🚫 Sin Comisión</span>
                                <input 
                                  type="checkbox" 
                                  checked={!!svc.excluidoComision} 
                                  onChange={e=>updateSvc(svc.id,"excluidoComision",e.target.checked)} 
                                  style={{ cursor: "pointer", width: 16, height: 16, accentColor: C.green }}
                                />
                              </div>
                            </div>

                            {/* Inline emoji picker */}
                            {emojiPicker === `svc-${svc.id}` && (
                              <div style={{ gridColumn:"1 / -1", marginTop: 8, width: "100%" }}>
                                <EmojiPicker current={svc.icon} onSelect={e=>{updateSvc(svc.id,"icon",e);setEmojiPicker(null);}} />
                              </div>
                            )}

                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}

          {/* New service modal */}
          {newSvcModal && (
            <div 
              onClick={e => e.target === e.currentTarget && setNewSvcModal(false)}
              style={{ position:"fixed", inset:0, zIndex:400, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,.4)" }}
            >
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

                <div style={{ marginBottom:12 }}>
                  <div style={{ fontSize:8, letterSpacing:"2px", color:C.textSoft, textTransform:"uppercase", marginBottom:6 }}>Categoría</div>
                  <select value={newSvc.category} onChange={e=>setNewSvc(p=>({...p,category:e.target.value}))} style={{...cfgInput, width:"100%", boxSizing:"border-box"}}>
                    {CAT_OPTIONS.map(cat => <option key={cat.id} value={cat.id}>{cat.icon} {cat.label}</option>)}
                  </select>
                </div>

                <div style={{ marginBottom:20 }}>
                  <div style={{ fontSize:8, letterSpacing:"2px", color:C.textSoft, textTransform:"uppercase", marginBottom:6 }}>Rama / Especialidad</div>
                  <select
                    value={newSvc.rama || "manos"}
                    onChange={e=>setNewSvc(p=>({...p,rama:e.target.value}))}
                    style={{...cfgInput, width:"100%", boxSizing:"border-box", cursor: "pointer"}}
                  >
                    {uniqueRamas.map(r => (
                      <option key={r} value={r}>{getDatalistLabel(r)}</option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom:20 }}>
                  <div style={{ fontSize:8, letterSpacing:"2px", color:C.textSoft, textTransform:"uppercase", marginBottom:6 }}>% Comisión Personalizado (Opcional)</div>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <input 
                      type="number" 
                      min={0}
                      max={100}
                      placeholder={`Hereda global (${config.comisionPct}%)`} 
                      value={newSvc.comisionPct !== undefined && newSvc.comisionPct !== null ? newSvc.comisionPct : ""} 
                      onChange={e=> {
                        const val = e.target.value === "" ? null : parseInt(e.target.value)
                        setNewSvc(p=>({...p,comisionPct: isNaN(val) ? null : val}))
                      }}
                      style={{...cfgInput, width:"100%", boxSizing:"border-box"}} 
                    />
                  </div>
                </div>

                <div style={{ marginBottom:20, display: "flex", alignItems: "center", gap: 8 }}>
                  <input 
                    type="checkbox" 
                    id="new-svc-no-comi"
                    checked={!!newSvc.excluidoComision} 
                    onChange={e=>setNewSvc(p=>({...p,excluidoComision:e.target.checked}))}
                    style={{ cursor: "pointer", width: 16, height: 16, accentColor: C.green }}
                  />
                  <label htmlFor="new-svc-no-comi" style={{ fontSize:11, fontWeight:"bold", color:C.textSoft, cursor:"pointer" }}>Excluir de comisiones profesionales</label>
                </div>

                <div style={{ display:"flex", gap:10 }}>
                  <button onClick={() => setNewSvcModal(false)} style={{ flex:1, padding:"10px", borderRadius:12, border:`1.5px solid ${C.border}`, background:C.white, color:C.textSoft, fontSize:12, cursor:"pointer", fontFamily:"Georgia,serif" }}>Cancelar</button>
                  <button onClick={saveNewSvc} disabled={!newSvc.name.trim()} style={{ flex:2, padding:"10px", borderRadius:12, border:"none", background:newSvc.name.trim()?`linear-gradient(135deg,${C.green},${C.greenLight})`:"#e8e8e8", color:newSvc.name.trim()?"#fff":"#bbb", fontSize:12, cursor:newSvc.name.trim()?"pointer":"not-allowed", fontFamily:"Georgia,serif" }}>✅ Guardar Servicio</button>
                </div>

              </div>
            </div>
          )}

          {/* New Category modal */}
          {newCatModal && (
            <div 
              onClick={e => e.target === e.currentTarget && setNewCatModal(false)}
              style={{ position:"fixed", inset:0, zIndex:400, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,.4)" }}
            >
              <div style={{ background:C.white, borderRadius:20, padding:"24px 28px", width:"min(400px,calc(100vw-32px))", boxShadow:"0 20px 60px rgba(0,0,0,.2)" }}>
                <div style={{ fontSize:14, fontWeight:"bold", color:C.green, marginBottom:18 }}>➕ Nueva Categoría</div>

                <div style={{ marginBottom:16 }}>
                  <div style={{ fontSize:8, letterSpacing:"2px", color:C.textSoft, textTransform:"uppercase", marginBottom:6 }}>Nombre</div>
                  <input 
                    value={newCat.label} 
                    onChange={e => setNewCat(p => ({ ...p, label: e.target.value }))} 
                    placeholder="Ej: Cejas, Masajes..." 
                    style={{ ...cfgInput, width:"100%", boxSizing:"border-box" }} 
                    autoFocus 
                  />
                </div>

                <div style={{ marginBottom:20 }}>
                  <div style={{ fontSize:8, letterSpacing:"2px", color:C.textSoft, textTransform:"uppercase", marginBottom:6 }}>Ícono (emoji)</div>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
                    {["💅","🦶","🌸","✨","💆","💇","🧖","🪷","🌿","🫧","🌟","👁️"].map(e => (
                      <button 
                        key={e} 
                        onClick={() => setNewCat(p => ({ ...p, icon: e }))} 
                        style={{ width:36, height:36, borderRadius:10, border:`2px solid ${newCat.icon===e?C.green:C.border}`, background:newCat.icon===e?C.greenPale:"transparent", fontSize:18, cursor:"pointer" }}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                  <input 
                    value={newCat.icon} 
                    onChange={e => setNewCat(p => ({ ...p, icon: e.target.value }))} 
                    placeholder="O escribí un emoji custom..." 
                    style={{ ...cfgInput, width:"100%", boxSizing:"border-box" }} 
                  />
                </div>

                <div style={{ display:"flex", gap:10 }}>
                  <button onClick={() => setNewCatModal(false)} style={{ flex:1, padding:"10px", borderRadius:12, border:`1.5px solid ${C.border}`, background:C.white, color:C.textSoft, fontSize:12, cursor:"pointer", fontFamily:"Georgia,serif" }}>Cancelar</button>
                  <button onClick={saveNewCat} disabled={!newCat.label.trim()} style={{ flex:2, padding:"10px", borderRadius:12, border:"none", background:newCat.label.trim()?`linear-gradient(135deg,${C.green},${C.greenLight})`:"#e8e8e8", color:newCat.label.trim()?"#fff":"#bbb", fontSize:12, cursor:newCat.label.trim()?"pointer":"not-allowed", fontFamily:"Georgia,serif" }}>✅ Guardar Categoría</button>
                </div>
              </div>
            </div>
          )}

          {/* New Rama modal */}
          {newRamaModal && (
            <div 
              onClick={e => e.target === e.currentTarget && setNewRamaModal(false)}
              style={{ position:"fixed", inset:0, zIndex:400, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,.4)" }}
            >
              <div style={{ background:C.white, borderRadius:20, padding:"24px 28px", width:"min(400px,calc(100vw-32px))", boxShadow:"0 20px 60px rgba(0,0,0,.2)" }}>
                <div style={{ fontSize:14, fontWeight:"bold", color:C.green, marginBottom:18 }}>🌿 Nueva Rama / Especialidad</div>

                <div style={{ marginBottom:20 }}>
                  <div style={{ fontSize:8, letterSpacing:"2px", color:C.textSoft, textTransform:"uppercase", marginBottom:6 }}>Nombre de la Rama</div>
                  <input 
                    value={newRama.label} 
                    onChange={e => setNewRama(p => ({ ...p, label: e.target.value }))} 
                    placeholder="Ej: Masajes, Barbería, Depilación..." 
                    style={{ ...cfgInput, width:"100%", boxSizing:"border-box" }} 
                    autoFocus 
                  />
                  <div style={{ fontSize:9, color: C.textSoft, marginTop:6 }}>Esta especialidad se sumará como planilla al calendario y sugerencia para los profesionales y servicios.</div>
                </div>

                <div style={{ display:"flex", gap:10 }}>
                  <button onClick={() => setNewRamaModal(false)} style={{ flex:1, padding:"10px", borderRadius:12, border:`1.5px solid ${C.border}`, background:C.white, color:C.textSoft, fontSize:12, cursor:"pointer", fontFamily:"Georgia,serif" }}>Cancelar</button>
                  <button onClick={saveNewRama} disabled={!newRama.label.trim()} style={{ flex:2, padding:"10px", borderRadius:12, border:"none", background:newRama.label.trim()?`linear-gradient(135deg,${C.green},${C.greenLight})`:"#e8e8e8", color:newRama.label.trim()?"#fff":"#bbb", fontSize:12, cursor:newRama.label.trim()?"pointer":"not-allowed", fontFamily:"Georgia,serif" }}>🌿 Crear Rama</button>
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

          <CfgField label="📆 Comisiones especiales por fecha (Excepciones)">
            <div style={{ background: C.cream, padding: "14px 16px", borderRadius: 12, border: `1.5px solid ${C.border}` }}>
              
              {/* Form to add an exception */}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 16, position: "relative" }}>
                
                {/* Date selection field with popup calendar */}
                <div style={{ flex: 1, minWidth: 160, position: "relative" }}>
                  <span style={{ fontSize: 8, letterSpacing: "1px", color: C.textSoft, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Seleccionar Fecha</span>
                  <button
                    type="button"
                    onClick={() => setCalOpen(!calOpen)}
                    style={{
                      ...cfgInput,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      cursor: "pointer",
                      width: "100%",
                      height: 38,
                      background: C.white,
                      textAlign: "left"
                    }}
                  >
                    <span>{selectedExcDate ? (() => {
                      const [y, m, d] = selectedExcDate.split("-")
                      return `${d}/${m}/${y}`
                    })() : "Elegir fecha... 📅"}</span>
                  </button>

                  {calOpen && (() => {
                    const [vy, vm] = excViewDate.split("-").map(Number)
                    const firstDay = new Date(vy, vm - 1, 1)
                    const lastDay = new Date(vy, vm, 0)
                    const startDow = (firstDay.getDay() + 6) % 7
                    const cells = []
                    for (let i = 0; i < startDow; i++) cells.push(null)
                    for (let d = 1; d <= lastDay.getDate(); d++) cells.push(d)
                    while (cells.length % 7 !== 0) cells.push(null)

                    const prevMonth = (e) => {
                      e.stopPropagation()
                      let m = vm - 1, y = vy
                      if (m < 1) { m = 12; y-- }
                      setExcViewDate(`${y}-${String(m).padStart(2, "0")}`)
                    }
                    const nextMonth = (e) => {
                      e.stopPropagation()
                      let m = vm + 1, y = vy
                      if (m > 12) { m = 1; y++ }
                      setExcViewDate(`${y}-${String(m).padStart(2, "0")}`)
                    }

                    return (
                      <div 
                        onClick={e => e.stopPropagation()} 
                        style={{
                          position: "absolute",
                          top: "100%",
                          left: 0,
                          zIndex: 150,
                          marginTop: 6,
                          background: C.white,
                          borderRadius: 12,
                          border: `1.5px solid ${C.border}`,
                          boxShadow: `0 8px 24px rgba(58,125,68,.12)`,
                          padding: "12px 14px",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          width: 240
                        }}
                      >
                        {/* Month Navigator */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", marginBottom: 10 }}>
                          <button 
                            type="button" 
                            onClick={prevMonth} 
                            style={{ 
                              width: 26, height: 26, borderRadius: "50%", border: `1.5px solid ${C.border}`, 
                              background: C.white, color: C.green, fontSize: 14, cursor: "pointer", 
                              display: "flex", alignItems: "center", justifyContent: "center"
                            }}
                          >
                            ‹
                          </button>
                          <div style={{ fontSize: 12, color: C.text, fontWeight: "bold", fontFamily: "Georgia, serif", textTransform: "capitalize" }}>
                            {MESES_ES[vm - 1]} {vy}
                          </div>
                          <button 
                            type="button" 
                            onClick={nextMonth} 
                            style={{ 
                              width: 26, height: 26, borderRadius: "50%", border: `1.5px solid ${C.border}`, 
                              background: C.white, color: C.green, fontSize: 14, cursor: "pointer", 
                              display: "flex", alignItems: "center", justifyContent: "center"
                            }}
                          >
                            ›
                          </button>
                        </div>

                        {/* Day Headers */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, width: "100%", textAlign: "center", marginBottom: 4 }}>
                          {["Lu","Ma","Mi","Ju","Vi","Sá","Do"].map(d => (
                            <div key={d} style={{ fontSize: 8, letterSpacing: "0.5px", textTransform: "uppercase", color: d === "Do" ? "#c08080" : C.textSoft, fontFamily: "Georgia, serif", fontWeight: "bold" }}>
                              {d}
                            </div>
                          ))}
                        </div>

                        {/* Calendar Grid */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, width: "100%" }}>
                          {cells.map((day, idx) => {
                            if (!day) return <div key={`empty-${idx}`} style={{ aspectRatio: "1/1" }} />
                            
                            const dateStr = `${vy}-${String(vm).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                            const hasExc = config.dateExceptions && config.dateExceptions[dateStr] !== undefined
                            const isSelected = selectedExcDate === dateStr
                            const isToday = dateStr === todayKey()
                            const dow = idx % 7
                            const isSun = dow === 6

                            return (
                              <button
                                key={dateStr}
                                type="button"
                                onClick={() => {
                                  setSelectedExcDate(dateStr)
                                  setCalOpen(false)
                                }}
                                style={{
                                  aspectRatio: "1/1",
                                  borderRadius: 8,
                                  border: isSelected ? `2px solid ${C.green}` : `1px solid ${C.border}`,
                                  background: isSelected 
                                    ? C.greenPale 
                                    : hasExc 
                                      ? C.goldPale 
                                      : isToday 
                                        ? C.cream 
                                        : C.white,
                                  color: isSelected 
                                    ? C.green 
                                    : isSun 
                                      ? "#c08080" 
                                      : C.text,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  cursor: "pointer",
                                  fontFamily: "Georgia, serif",
                                  fontSize: 11,
                                  fontWeight: hasExc || isSelected ? "bold" : "normal",
                                  position: "relative",
                                  padding: 0
                                }}
                              >
                                {day}
                                {hasExc && (
                                  <div style={{ 
                                    position: "absolute", 
                                    bottom: 2, 
                                    width: 3, 
                                    height: 3, 
                                    borderRadius: "50%", 
                                    background: C.gold 
                                  }} />
                                )}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })()}
                </div>

                {/* Percentage override */}
                <div style={{ width: 100 }}>
                  <span style={{ fontSize: 8, letterSpacing: "1px", color: C.textSoft, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Comisión (%)</span>
                  <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                    <input 
                      type="number" 
                      value={selectedExcPct}
                      onChange={(e) => setSelectedExcPct(e.target.value)}
                      placeholder="Ej: 60" 
                      min={1} 
                      max={100} 
                      style={{ ...cfgInput, paddingRight: 20 }} 
                    />
                    <span style={{ position: "absolute", right: 8, fontSize: 11, color: C.textSoft, fontWeight: "bold" }}>%</span>
                  </div>
                </div>

                {/* Add button */}
                <button
                  type="button"
                  onClick={() => {
                    const pctVal = parseInt(selectedExcPct)
                    if (!selectedExcDate || isNaN(pctVal) || pctVal < 1 || pctVal > 100) {
                      alert("Por favor elegí una fecha y un porcentaje válido (1-100)")
                      return
                    }
                    setConfig(prev => ({
                      ...prev,
                      dateExceptions: {
                        ...(prev.dateExceptions || {}),
                        [selectedExcDate]: pctVal
                      }
                    }))
                    setSelectedExcDate(null)
                    setSelectedExcPct("")
                  }}
                  style={{
                    padding: "8px 16px",
                    height: 38,
                    borderRadius: 9,
                    border: "none",
                    background: `linear-gradient(135deg, ${C.green}, ${C.greenLight})`,
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: "bold",
                    cursor: "pointer",
                    fontFamily: "Georgia, serif"
                  }}
                >
                  ＋ Agregar
                </button>
              </div>

              {/* List of exceptions */}
              {Object.keys(config.dateExceptions || {}).length === 0 ? (
                <div style={{ fontSize: 10, color: C.textSoft, fontStyle: "italic", textAlign: "center", padding: "10px 0" }}>
                  No hay comisiones especiales configuradas todavía.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 180, overflowY: "auto", paddingRight: 4 }}>
                  {Object.entries(config.dateExceptions || {})
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([dateKey, pct]) => {
                      const [y, m, d] = dateKey.split("-")
                      const formattedDate = `${d}/${m}/${y}`
                      return (
                        <div key={dateKey} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.white, padding: "6px 12px", borderRadius: 8, border: `1px solid ${C.border}` }}>
                          <span style={{ fontSize: 11, color: C.text }}>
                            📅 <strong>{formattedDate}</strong> ➔ <span style={{ color: C.gold, fontWeight: "bold" }}>{pct}%</span> de comisión
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              if (!window.confirm(`¿Eliminar la comisión especial para el día ${formattedDate}?`)) return
                              setConfig(prev => {
                                const nextExceptions = { ...(prev.dateExceptions || {}) }
                                delete nextExceptions[dateKey]
                                return {
                                  ...prev,
                                  dateExceptions: nextExceptions
                                }
                              })
                            }}
                            style={{
                              border: "none",
                              background: "transparent",
                              color: "#c04040",
                              cursor: "pointer",
                              fontSize: 12,
                              padding: "4px"
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      )
                    })}
                </div>
              )}
            </div>
            <div style={{ fontSize:10, color:C.textSoft, marginTop:6 }}>Configurá comisiones diferentes para días de eventos, feriados, etc. Los turnos de estas fechas específicas se liquidarán con el porcentaje asignado.</div>
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

            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:C.cream, padding:"12px 16px", borderRadius:12, border:`1.5px solid ${C.border}`, marginTop: 10 }}>
              <div>
                <div style={{ fontSize:12, color:C.text }}>Diseño de la grilla de turnos</div>
                <div style={{ fontSize:10, color:C.textSoft }}>Elegí entre un diseño de rejilla clásica o tarjetas flotantes modernas</div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button 
                  onClick={() => updateConfig("gridStyle", "classic")}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    border: `1.5px solid ${config.gridStyle === "classic" ? C.green : C.border}`,
                    background: config.gridStyle === "classic" ? C.greenPale : C.white,
                    color: config.gridStyle === "classic" ? C.green : C.textSoft,
                    fontSize: 10,
                    fontWeight: "bold",
                    cursor: "pointer",
                    fontFamily: "Georgia, serif",
                    transition: "all 0.15s ease"
                  }}
                >
                  Clásica
                </button>
                <button 
                  onClick={() => updateConfig("gridStyle", "cards")}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    border: `1.5px solid ${(config.gridStyle || "cards") === "cards" ? C.green : C.border}`,
                    background: (config.gridStyle || "cards") === "cards" ? C.greenPale : C.white,
                    color: (config.gridStyle || "cards") === "cards" ? C.green : C.textSoft,
                    fontSize: 10,
                    fontWeight: "bold",
                    cursor: "pointer",
                    fontFamily: "Georgia, serif",
                    transition: "all 0.15s ease"
                  }}
                >
                  Tarjetas
                </button>
              </div>
            </div>

            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:C.cream, padding:"12px 16px", borderRadius:12, border:`1.5px solid ${C.border}`, marginTop: 10 }}>
              <div>
                <div style={{ fontSize:12, color:C.text }}>Efecto Vidrio Líquido (Liquid Glass)</div>
                <div style={{ fontSize:10, color:C.textSoft }}>Activa o desactiva la estética de transparencias y difuminados premium (Glassmorphic blur)</div>
              </div>
              <button onClick={() => updateConfig("liquidGlass", !(config.liquidGlass ?? true))}
                style={{ width:44, height:24, borderRadius:12, border:"none", background:(config.liquidGlass ?? true)?C.green:"#ddd", cursor:"pointer", position:"relative", transition:"background .2s" }}>
                <div style={{ width:20, height:20, borderRadius:"50%", background:"#fff", position:"absolute", top:2, transition:"left .2s", left:(config.liquidGlass ?? true)?"22px":"2px" }}/>
              </button>
            </div>

            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:C.cream, padding:"12px 16px", borderRadius:12, border:`1.5px solid ${C.border}`, marginTop: 10 }}>
              <div>
                <div style={{ fontSize:12, color:C.text }}>Efecto de Carga Premium</div>
                <div style={{ fontSize:10, color:C.textSoft }}>Activa la pantalla de carga Apple-style con burbujas y desenfoque dinámico</div>
              </div>
              <button onClick={() => updateConfig("premiumLoading", !(config.premiumLoading ?? true))}
                style={{ width:44, height:24, borderRadius:12, border:"none", background:(config.premiumLoading ?? true)?C.green:"#ddd", cursor:"pointer", position:"relative", transition:"background .2s" }}>
                <div style={{ width:20, height:20, borderRadius:"50%", background:"#fff", position:"absolute", top:2, transition:"left .2s", left:(config.premiumLoading ?? true)?"22px":"2px" }}/>
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

const rowInputStyle = {
  width: "100%",
  height: 34,
  padding: "0 10px",
  border: `1.5px solid ${C.border}`,
  borderRadius: 9,
  fontSize: 11,
  color: C.text,
  background: C.cream,
  outline: "none",
  fontFamily: "Georgia, serif",
  transition: "all 0.15s ease",
  boxSizing: "border-box"
};

const actionBtnStyle = {
  padding: "0 14px", 
  height: 38, 
  borderRadius: 11, 
  border: `1.5px solid ${C.border}`, 
  background: C.white, 
  color: C.textSoft, 
  fontSize: 11, 
  fontWeight: "bold", 
  cursor: "pointer", 
  fontFamily: "Georgia, serif", 
  letterSpacing: "0.5px", 
  display: "flex", 
  alignItems: "center", 
  gap: 6, 
  transition: "all .18s ease"
};

const primaryBtnStyle = {
  padding: "0 18px", 
  height: 38, 
  borderRadius: 11, 
  border: "none", 
  background: `linear-gradient(135deg, ${C.green}, ${C.greenLight})`, 
  color: "#fff", 
  fontSize: 11, 
  fontWeight: "bold", 
  cursor: "pointer", 
  fontFamily: "Georgia, serif", 
  letterSpacing: "0.5px", 
  display: "flex", 
  alignItems: "center", 
  gap: 6, 
  boxShadow: `0 4px 14px ${C.green}22`, 
  transition: "all .18s ease"
};
