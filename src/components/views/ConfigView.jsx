import { useState } from "react"
import { C } from "../../constants/colors.js"
import { HOURS, CAT_OPTIONS as CAT_OPTIONS_DEFAULT, EMOJI_SUGGESTIONS, BLOCKED_COLORS, APP_VERSION, MODAL_TONES, MODAL_OPACITY_DEFAULT_LEVEL, MODAL_OPACITY_LEVELS, MODAL_BLUR_DEFAULT_LEVEL, MODAL_BLUR_LEVELS, getModalOverlayStyle } from "../../constants/data.js"
import { WORK_DAYS_META } from "../../utils/appointments.js"
import { GhostBtn, SolidBtn, Overlay } from "../ui/index.jsx"
import { MESES_ES, todayKey } from "../../utils/dates.js"
import { DEFAULT_WA_REMINDER_TEMPLATE, generateReminderMessage } from "../../utils/whatsapp.js"

// ─── Config View ──────────────────────────────────────────────────────────────

export default function ConfigView({ planillaRamas = ["manos"], config, setConfig, allData, gastos, sueldos, clientes, todoTasks = [], todoHistory = [], onLogout, restoreBackup }) {
  const [seccion, setSeccion] = useState("empresa");
  const [waPreviewDay, setWaPreviewDay] = useState("manana")
  const [emojiPicker,  setEmojiPicker]  = useState(null)
  const [svcFilter,    setSvcFilter]    = useState({ cat:"all", search:"" })
  const [newSvcModal,  setNewSvcModal]  = useState(false)
  const [newSvc,       setNewSvc]       = useState({ name:"", duration:0, price:0, category:"manos", icon:"💅", rama:"manos" })
  const [newCatModal,  setNewCatModal]  = useState(false)
  const [newCat,       setNewCat]       = useState({ label: "", icon: "🌟" })
  const [newRamaModal, setNewRamaModal] = useState(false)
  const [newRama,      setNewRama]      = useState({ label: "", icon: "🌿" })
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false)
  const [excViewDate,  setExcViewDate]  = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  })
  const [selectedExcDate, setSelectedExcDate] = useState(null)
  const [selectedExcPct,  setSelectedExcPct]  = useState("")
  const [calOpen,         setCalOpen]         = useState(false)
  const [savedProfField,  setSavedProfField]  = useState(null)
  const [openProfScheduleId, setOpenProfScheduleId] = useState(null)

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
  const updateProf = (id, field, value) => {
    setConfig(p => ({ ...p, professionals: p.professionals.map(pr => pr.id===id ? {...pr,[field]:value} : pr) }))
    const fieldKey = `${id}-${field}`
    setSavedProfField(fieldKey)
    setTimeout(() => {
      setSavedProfField(prev => prev === fieldKey ? null : prev)
    }, 1800)
  }

  const END_HOURS = [...HOURS.slice(1), "20:00"]

  const getDefaultDaySchedule = (existing) => ({
    active: existing?.active !== undefined ? existing.active : true,
    from: existing?.from || "09:00",
    to: existing?.to || "20:00",
    breakActive: Boolean(existing?.breakActive),
    breakFrom: existing?.breakFrom || "13:00",
    breakTo: existing?.breakTo || "15:00",
    blockNonWorking: existing?.blockNonWorking !== undefined ? existing.blockNonWorking : true,
  })

  const updateProfDaySchedule = (profId, dayId, patch) => {
    setConfig(p => ({
      ...p,
      professionals: p.professionals.map(pr => {
        if (pr.id !== profId) return pr
        const currentSched = pr.schedule || {}
        const baseDay = getDefaultDaySchedule(currentSched[dayId])
        const nextDay = { ...baseDay, ...patch }
        if (nextDay.from >= nextDay.to) {
          const fromIdx = HOURS.indexOf(nextDay.from)
          nextDay.to = END_HOURS[Math.min(END_HOURS.length - 1, Math.max(0, fromIdx))] || "20:00"
        }
        if (nextDay.breakActive && nextDay.breakFrom >= nextDay.breakTo) {
          const bIdx = HOURS.indexOf(nextDay.breakFrom)
          nextDay.breakTo = END_HOURS[Math.min(END_HOURS.length - 1, Math.max(0, bIdx))] || "15:00"
        }
        return {
          ...pr,
          blockNonWorking: pr.blockNonWorking !== undefined ? pr.blockNonWorking : true,
          schedule: {
            ...currentSched,
            [dayId]: nextDay,
          }
        }
      })
    }))
    const fieldKey = `${profId}-schedule`
    setSavedProfField(fieldKey)
    setTimeout(() => {
      setSavedProfField(prev => prev === fieldKey ? null : prev)
    }, 1800)
  }

  const applyScheduleToAllActiveDays = (profId, sourceDayId) => {
    setConfig(p => ({
      ...p,
      professionals: p.professionals.map(pr => {
        if (pr.id !== profId) return pr
        const currentSched = pr.schedule || {}
        const src = getDefaultDaySchedule(currentSched[sourceDayId])
        const nextSched = { ...currentSched }
        WORK_DAYS_META.forEach(d => {
          const existing = getDefaultDaySchedule(currentSched[d.id])
          nextSched[d.id] = {
            ...existing,
            from: src.from,
            to: src.to,
            breakActive: src.breakActive,
            breakFrom: src.breakFrom,
            breakTo: src.breakTo,
          }
        })
        return {
          ...pr,
          blockNonWorking: pr.blockNonWorking !== undefined ? pr.blockNonWorking : true,
          schedule: nextSched,
        }
      })
    }))
    const fieldKey = `${profId}-schedule`
    setSavedProfField(fieldKey)
    setTimeout(() => {
      setSavedProfField(prev => prev === fieldKey ? null : prev)
    }, 1800)
  }

  const addProf = () => {
    const newId = Date.now();
    setConfig(p => ({ ...p, professionals: [...p.professionals, { id:newId, name:"Nueva profesional", emoji:"🌸", rama: "manos", phone: "" }] }));
  };

  const removeProf = (id) => {
    const prof = profs.find(p => p.id === id)
    if (!prof) return
    const hasAppts = Object.values(allData || {}).some(dayData =>
      Object.values(dayData || {}).some(a => a.profId === id && !a.isBlocked)
    )
    if (hasAppts) {
      if (!window.confirm(`¿Dar de baja a ${prof.name}? Conservará sus datos históricos y turnos pasados. A partir de hoy no aparecerá en el calendario.`)) return
      setConfig(p => ({
        ...p,
        professionals: p.professionals.map(pr => pr.id === id ? { ...pr, deletedAt: todayKey() } : pr)
      }))
    } else {
      if (!window.confirm(`¿Eliminar por completo a ${prof.name}? No tiene turnos registrados.`)) return
      setConfig(p => ({ ...p, professionals: p.professionals.filter(pr => pr.id !== id) }))
    }
  }

  const restoreProf = (id) => {
    setConfig(p => ({
      ...p,
      professionals: p.professionals.map(pr => pr.id === id ? { ...pr, deletedAt: null } : pr)
    }))
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
    setNewRama({ label: "", icon: "🌿" })
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
      customRamas: [...(p.customRamas || []), cleanName],
      ramaIcons: { ...(p.ramaIcons || {}), [cleanName]: newRama.icon }
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

  const serviceRamas = Array.from(new Set(planillaRamas))
  const serviceRamaOptions = current => Array.from(new Set([...serviceRamas, current || "manos"]))

  const getDatalistLabel = (r) => {
    const clean = String(r || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (config.ramaIcons?.[clean]) return `${config.ramaIcons[clean]} ${r.charAt(0).toUpperCase() + r.slice(1)}`
    if (clean === "manos") return "💅 Manos"
    if (clean === "peluqueria") return "💇‍♀️ Peluquería"
    if (clean === "estetica") return "🧴 Estética"
    if (clean === "pestanas") return "👁️ Pestañas"
    return `✨ ${r.charAt(0).toUpperCase() + r.slice(1)}`
  }

  return (
    <div style={{ maxWidth: 860, margin:"0 auto", padding:"16px 12px 100px" }}>


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
          {profs.filter(p => !p.deletedAt).map((prof, idx) => (
            <SectionCard key={prof.id}>
              <div style={{ display:"flex", alignItems:"flex-end", gap:12, flexWrap:"wrap" }}>
                <div style={{ textAlign:"center", flexShrink:0 }}>
                  <div onClick={()=>setEmojiPicker(emojiPicker===prof.id?null:prof.id)} style={{
                    width:48,height:48,borderRadius:"50%",cursor:"pointer",
                    background:`linear-gradient(135deg,${C.greenPale},${C.greenMint})`,
                    border:`2px solid ${emojiPicker===prof.id?C.green:C.border}`,
                    display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,
                    transition:"all .18s",
                  }}>{prof.emoji}</div>
                  <div style={{ fontSize:7,color:C.textSoft,marginTop:3,letterSpacing:"1px" }}>ÍCONO</div>
                </div>

                <div style={{ flex: "2 1 180px", minWidth: 160 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                    <label style={{ ...cfgLabel, marginBottom: 0 }}>Nombre</label>
                    {savedProfField === `${prof.id}-name` && (
                      <span style={{ fontSize: 9, color: C.green, fontWeight: "bold", background: "#dcfce7", padding: "1px 6px", borderRadius: 4, letterSpacing: "0.5px", animation: "fadeIn .2s" }}>
                        ✓ Guardado
                      </span>
                    )}
                  </div>
                  <input
                    value={prof.name}
                    onChange={e=>updateProf(prof.id,"name",e.target.value)}
                    style={{
                      ...cfgInput,
                      borderColor: savedProfField === `${prof.id}-name` ? C.green : C.border,
                      transition: "all .2s"
                    }}
                    placeholder="Nombre de la profesional"
                  />
                </div>

                <div style={{ flex: "1.2 1 140px", minWidth: 135 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                    <label style={{ ...cfgLabel, marginBottom: 0 }}>Rama / Especialidad</label>
                    {savedProfField === `${prof.id}-rama` && (
                      <span style={{ fontSize: 9, color: C.green, fontWeight: "bold", background: "#dcfce7", padding: "1px 6px", borderRadius: 4, letterSpacing: "0.5px" }}>
                        ✓ Guardado
                      </span>
                    )}
                  </div>
                  <select
                    value={prof.rama || "manos"}
                    onChange={e => updateProf(prof.id, "rama", e.target.value)}
                    style={{
                      ...cfgInput,
                      cursor: "pointer",
                      borderRadius: 10,
                      borderColor: savedProfField === `${prof.id}-rama` ? C.green : C.border,
                      appearance: "none",
                      WebkitAppearance: "none",
                      MozAppearance: "none",
                      backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="%23718096" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>')`,
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "right 10px center",
                      paddingRight: "28px",
                      transition: "all .2s"
                    }}
                  >
                    {uniqueRamas.map(r => (
                      <option key={r} value={r}>{getDatalistLabel(r)}</option>
                    ))}
                  </select>
                </div>

                <div style={{ flex: "1.5 1 150px", minWidth: 140 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                    <label style={{ ...cfgLabel, marginBottom: 0 }}>WhatsApp / Teléfono</label>
                    {savedProfField === `${prof.id}-phone` && (
                      <span style={{ fontSize: 9, color: C.green, fontWeight: "bold", background: "#dcfce7", padding: "1px 6px", borderRadius: 4, letterSpacing: "0.5px", animation: "fadeIn .2s" }}>
                        ✓ Guardado
                      </span>
                    )}
                  </div>
                  <input
                    value={prof.phone || ""}
                    onChange={e => updateProf(prof.id, "phone", e.target.value)}
                    style={{
                      ...cfgInput,
                      borderColor: savedProfField === `${prof.id}-phone` ? C.green : C.border,
                      transition: "all .2s"
                    }}
                    placeholder="Ej: 11 2345-6789"
                  />
                </div>

                <div style={{ width: 125, flex: "0 0 125px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                    <label style={{ ...cfgLabel, marginBottom: 0 }}>% Comisión</label>
                    {savedProfField === `${prof.id}-comisionPct` && (
                      <span style={{ fontSize: 9, color: C.green, fontWeight: "bold", background: "#dcfce7", padding: "1px 6px", borderRadius: 4, letterSpacing: "0.5px" }}>
                        ✓ Guardado
                      </span>
                    )}
                  </div>
                  {(() => {
                    const hasCustom = prof.comisionPct !== undefined && prof.comisionPct !== null && prof.comisionPct !== ""
                    const isSaved = savedProfField === `${prof.id}-comisionPct`
                    return (
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: `1.5px solid ${isSaved ? C.green : (hasCustom ? C.greenMint : C.border)}`,
                        borderRadius: 10,
                        background: hasCustom ? C.greenPale : C.cream,
                        height: 36,
                        padding: "0 8px",
                        boxSizing: "border-box",
                        transition: "all .2s ease",
                        boxShadow: isSaved ? `0 0 0 3px ${C.greenPale}` : "none"
                      }}>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          style={{
                            ...cfgInput,
                            border: "none",
                            background: "transparent",
                            padding: 0,
                            height: "100%",
                            width: "55px",
                            textAlign: "center",
                            fontWeight: hasCustom ? "bold" : "normal",
                            color: hasCustom ? C.green : C.text,
                            fontSize: 12
                          }}
                          placeholder={`${config.comisionPct}`}
                          value={hasCustom ? prof.comisionPct : ""}
                          onChange={e => {
                            const val = parseFloat(e.target.value)
                            updateProf(prof.id, "comisionPct", isNaN(val) ? null : val)
                          }}
                        />
                        <span style={{ fontSize: 11, color: hasCustom ? C.green : C.textSoft, fontWeight: "bold" }}>%</span>
                      </div>
                    )
                  })()}
                </div>

                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <button
                    type="button"
                    onClick={() => setOpenProfScheduleId(openProfScheduleId === prof.id ? null : prof.id)}
                    title="Configurar qué días trabaja, horarios y bloqueo de franjas no laborales"
                    style={{
                      height: 36,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      background: openProfScheduleId === prof.id ? C.green : C.cream,
                      color: openProfScheduleId === prof.id ? "#fff" : C.text,
                      border: `1.5px solid ${openProfScheduleId === prof.id ? C.green : C.border}`,
                      borderRadius: 10,
                      padding: "0 12px",
                      fontSize: 11,
                      fontWeight: "bold",
                      cursor: "pointer",
                      fontFamily: "Georgia, serif",
                      transition: "all .18s",
                      whiteSpace: "nowrap"
                    }}
                  >
                    <span>🕒</span>
                    <span>Horarios</span>
                    <span style={{ fontSize: 9, opacity: 0.8 }}>{openProfScheduleId === prof.id ? "▴" : "▾"}</span>
                  </button>
                  <div style={{ height: 36, display: "flex", alignItems: "center", justifyContent: "center", background: C.greenPale, border: `1px solid ${C.greenMint}`, borderRadius: 9, padding: "0 12px", fontSize: 11, fontWeight: "bold", color: C.green, boxSizing: "border-box" }}>
                    #{idx+1}
                  </div>
                  <button onClick={()=>removeProf(prof.id)} title="Dar de baja o eliminar profesional" style={{
                    width:36,height:36,borderRadius:9,border:"none",
                    background:"#fde8e8",color:"#c04040",fontSize:14,cursor:"pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all .15s"
                  }}>✕</button>
                </div>
              </div>

              {/* Resumen compacto de días laborales (visible siempre) */}
              {(() => {
                const sched = prof.schedule || {}
                const hasCustomSched = Object.keys(sched).length > 0
                const blockEnabled = prof.blockNonWorking !== false
                return (
                  <div style={{
                    marginTop: 10,
                    paddingTop: 8,
                    borderTop: `1px dashed ${C.border}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 8
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 10, color: C.textSoft, letterSpacing: "0.5px", marginRight: 2 }}>Días:</span>
                      {WORK_DAYS_META.map(d => {
                        const dayCfg = getDefaultDaySchedule(sched[d.id])
                        const isPartial = dayCfg.active && (dayCfg.from !== "09:00" || dayCfg.to !== "20:00" || dayCfg.breakActive)
                        return (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => setOpenProfScheduleId(openProfScheduleId === prof.id ? null : prof.id)}
                            title={
                              !dayCfg.active
                                ? `${d.label}: No trabaja (Todo el día bloqueado)`
                                : `${d.label}: ${dayCfg.from} a ${dayCfg.to}${dayCfg.breakActive ? ` (Pausa ${dayCfg.breakFrom}-${dayCfg.breakTo})` : ""}`
                            }
                            style={{
                              padding: "3px 8px",
                              borderRadius: 8,
                              fontSize: 10,
                              fontWeight: "bold",
                              fontFamily: "Georgia, serif",
                              cursor: "pointer",
                              border: `1px solid ${!dayCfg.active ? "#f5c2c2" : isPartial ? "#fde68a" : C.greenMint}`,
                              background: !dayCfg.active ? "#fef2f2" : isPartial ? "#fffbeb" : C.greenPale,
                              color: !dayCfg.active ? "#b91c1c" : isPartial ? "#b45309" : C.green,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              transition: "all .15s"
                            }}
                          >
                            <span>{d.short}</span>
                            {!dayCfg.active ? (
                              <span style={{ fontSize: 8 }}>🚫</span>
                            ) : isPartial ? (
                              <span style={{ fontSize: 8, fontWeight: "normal" }}>{dayCfg.from.slice(0, 2)}-{dayCfg.to.slice(0, 2)}h</span>
                            ) : null}
                          </button>
                        )
                      })}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {savedProfField === `${prof.id}-schedule` && (
                        <span style={{ fontSize: 9, color: C.green, fontWeight: "bold", background: "#dcfce7", padding: "2px 7px", borderRadius: 5 }}>
                          ✓ Horario guardado
                        </span>
                      )}
                      {hasCustomSched && blockEnabled && (
                        <span style={{ fontSize: 10, color: C.textSoft, display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <span>🚫</span> Bloqueo automático en horas no laborales
                        </span>
                      )}
                    </div>
                  </div>
                )
              })()}

              {/* Panel desplegable de configuración de días, horarios y bloqueo de franjas no laborales */}
              {openProfScheduleId === prof.id && (() => {
                const sched = prof.schedule || {}
                const blockEnabled = prof.blockNonWorking !== false
                const blockedColorObj = BLOCKED_COLORS.find(c => c.id === (config?.blockedColor || "rojo")) || BLOCKED_COLORS[0]
                return (
                  <div style={{
                    marginTop: 12,
                    padding: "14px 16px",
                    borderRadius: 12,
                    background: C.cream,
                    border: `1.5px solid ${C.greenMint}`,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    animation: "fadeIn .18s ease"
                  }}>
                    {/* Cabecera y toggle de bloqueo automático */}
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 10,
                      paddingBottom: 10,
                      borderBottom: `1px solid ${C.border}`
                    }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: "bold", color: C.green, display: "flex", alignItems: "center", gap: 6 }}>
                          <span>🕒</span>
                          <span>Días y horarios de trabajo de {prof.name}</span>
                        </div>
                        <div style={{ fontSize: 10.5, color: C.textSoft, marginTop: 2 }}>
                          Configurá qué días trabaja, su horario de entrada/salida o pausas intermedias.
                        </div>
                      </div>

                      <label style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "7px 12px",
                        borderRadius: 10,
                        background: blockEnabled ? C.white : "#f8f9fa",
                        border: `1.5px solid ${blockEnabled ? C.greenMint : C.border}`,
                        cursor: "pointer",
                        userSelect: "none",
                        boxShadow: "0 2px 6px rgba(0,0,0,0.03)"
                      }}>
                        <input
                          type="checkbox"
                          checked={blockEnabled}
                          onChange={e => updateProf(prof.id, "blockNonWorking", e.target.checked)}
                          style={{ width: 15, height: 15, accentColor: C.green, cursor: "pointer" }}
                        />
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontSize: 11, fontWeight: "bold", color: C.text }}>
                            🚫 Bloquear franjas y días que no trabaja
                          </span>
                          <span style={{ fontSize: 9.5, color: C.textSoft }}>
                            Se muestra como bloqueo de horario (no cuenta como turno)
                          </span>
                        </div>
                        <div style={{
                          width: 24,
                          height: 24,
                          borderRadius: 6,
                          border: `1px dashed rgba(${blockedColorObj.rgb}, 0.55)`,
                          background: `repeating-linear-gradient(45deg, rgba(${blockedColorObj.rgb}, 0.16), rgba(${blockedColorObj.rgb}, 0.16) 5px, rgba(${blockedColorObj.rgb}, 0.30) 5px, rgba(${blockedColorObj.rgb}, 0.30) 10px)`,
                          flexShrink: 0
                        }} title="Vista previa del bloqueo de horario" />
                      </label>
                    </div>

                    {/* Grilla de días Lunes a Sábado */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {WORK_DAYS_META.map(d => {
                        const dayCfg = getDefaultDaySchedule(sched[d.id])
                        const nonWorkingHoursCount = !dayCfg.active
                          ? HOURS.length
                          : HOURS.filter(h => h < dayCfg.from || h >= dayCfg.to || (dayCfg.breakActive && h >= dayCfg.breakFrom && h < dayCfg.breakTo)).length

                        return (
                          <div
                            key={d.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              flexWrap: "wrap",
                              gap: 10,
                              padding: "9px 12px",
                              borderRadius: 10,
                              background: dayCfg.active ? C.white : "#fef9f9",
                              border: `1px solid ${dayCfg.active ? C.border : "#f5c2c2"}`,
                              transition: "all .15s"
                            }}
                          >
                            {/* Día + Switch Trabaja / No trabaja */}
                            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 185 }}>
                              <div style={{ width: 78, fontSize: 12, fontWeight: "bold", color: dayCfg.active ? C.text : "#b91c1c" }}>
                                {d.label}
                              </div>
                              <button
                                type="button"
                                onClick={() => updateProfDaySchedule(prof.id, d.id, { active: !dayCfg.active })}
                                style={{
                                  padding: "4px 10px",
                                  borderRadius: 8,
                                  fontSize: 10.5,
                                  fontWeight: "bold",
                                  fontFamily: "Georgia, serif",
                                  cursor: "pointer",
                                  border: `1px solid ${dayCfg.active ? C.greenMint : "#f5c2c2"}`,
                                  background: dayCfg.active ? C.greenPale : "#fee2e2",
                                  color: dayCfg.active ? C.green : "#b91c1c",
                                  transition: "all .15s"
                                }}
                              >
                                {dayCfg.active ? "✓ Trabaja" : "🚫 No trabaja"}
                              </button>
                            </div>

                            {/* Controles de horario cuando trabaja, o aviso de día bloqueado cuando no trabaja */}
                            {dayCfg.active ? (
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", flex: 1, justifyContent: "flex-end" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                  <span style={{ fontSize: 10, color: C.textSoft }}>De</span>
                                  <select
                                    value={dayCfg.from}
                                    onChange={e => updateProfDaySchedule(prof.id, d.id, { from: e.target.value })}
                                    style={{
                                      ...cfgInput,
                                      width: 78,
                                      height: 30,
                                      padding: "0 6px",
                                      fontSize: 11,
                                      fontWeight: "bold",
                                      borderRadius: 8,
                                      cursor: "pointer"
                                    }}
                                  >
                                    {HOURS.map(h => (
                                      <option key={h} value={h}>{h} hs</option>
                                    ))}
                                  </select>
                                  <span style={{ fontSize: 10, color: C.textSoft }}>a</span>
                                  <select
                                    value={dayCfg.to}
                                    onChange={e => updateProfDaySchedule(prof.id, d.id, { to: e.target.value })}
                                    style={{
                                      ...cfgInput,
                                      width: 78,
                                      height: 30,
                                      padding: "0 6px",
                                      fontSize: 11,
                                      fontWeight: "bold",
                                      borderRadius: 8,
                                      cursor: "pointer"
                                    }}
                                  >
                                    {END_HOURS.filter(h => h > dayCfg.from).map(h => (
                                      <option key={h} value={h}>{h} hs</option>
                                    ))}
                                  </select>
                                </div>

                                {/* Pausa / Franja intermedia bloqueada */}
                                {dayCfg.breakActive ? (
                                  <div style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 4,
                                    padding: "3px 8px",
                                    borderRadius: 8,
                                    background: "#fff5f5",
                                    border: "1px dashed #f5c2c2"
                                  }}>
                                    <span style={{ fontSize: 10, color: "#b91c1c", fontWeight: "bold" }}>🚫 Bloqueo:</span>
                                    <select
                                      value={dayCfg.breakFrom}
                                      onChange={e => updateProfDaySchedule(prof.id, d.id, { breakFrom: e.target.value })}
                                      style={{
                                        ...cfgInput,
                                        width: 68,
                                        height: 26,
                                        padding: "0 4px",
                                        fontSize: 10.5,
                                        borderRadius: 6,
                                        background: C.white,
                                        cursor: "pointer"
                                      }}
                                    >
                                      {HOURS.filter(h => h >= dayCfg.from && h < dayCfg.to).map(h => (
                                        <option key={h} value={h}>{h}</option>
                                      ))}
                                    </select>
                                    <span style={{ fontSize: 9.5, color: "#b91c1c" }}>a</span>
                                    <select
                                      value={dayCfg.breakTo}
                                      onChange={e => updateProfDaySchedule(prof.id, d.id, { breakTo: e.target.value })}
                                      style={{
                                        ...cfgInput,
                                        width: 68,
                                        height: 26,
                                        padding: "0 4px",
                                        fontSize: 10.5,
                                        borderRadius: 6,
                                        background: C.white,
                                        cursor: "pointer"
                                      }}
                                    >
                                      {END_HOURS.filter(h => h > dayCfg.breakFrom && h <= dayCfg.to).map(h => (
                                        <option key={h} value={h}>{h}</option>
                                      ))}
                                    </select>
                                    <button
                                      type="button"
                                      onClick={() => updateProfDaySchedule(prof.id, d.id, { breakActive: false })}
                                      title="Quitar franja bloqueada intermedia"
                                      style={{
                                        border: "none",
                                        background: "transparent",
                                        color: "#b91c1c",
                                        cursor: "pointer",
                                        fontSize: 11,
                                        padding: "0 3px",
                                        fontWeight: "bold"
                                      }}
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => updateProfDaySchedule(prof.id, d.id, { breakActive: true, breakFrom: "13:00", breakTo: "15:00" })}
                                    title="Bloquear un par de horas intermedias en las que no trabaja"
                                    style={{
                                      padding: "4px 8px",
                                      borderRadius: 8,
                                      border: `1px dashed ${C.border}`,
                                      background: C.cream,
                                      color: C.textSoft,
                                      fontSize: 10,
                                      cursor: "pointer",
                                      fontFamily: "Georgia, serif"
                                    }}
                                  >
                                    ＋ Bloquear franja intermedia
                                  </button>
                                )}

                                {blockEnabled && nonWorkingHoursCount > 0 && (
                                  <span style={{
                                    fontSize: 9.5,
                                    color: "#b91c1c",
                                    background: "#fef2f2",
                                    border: "1px solid #fecaca",
                                    padding: "2px 7px",
                                    borderRadius: 6,
                                    whiteSpace: "nowrap"
                                  }}>
                                    🚫 {(nonWorkingHoursCount * 30) / 60}h bloqueadas
                                  </span>
                                )}

                                <button
                                  type="button"
                                  onClick={() => applyScheduleToAllActiveDays(prof.id, d.id)}
                                  title="Repetir este horario de entrada/salida en todos los días que trabaja"
                                  style={{
                                    padding: "4px 8px",
                                    borderRadius: 7,
                                    border: `1px solid ${C.border}`,
                                    background: C.white,
                                    color: C.green,
                                    fontSize: 9.5,
                                    cursor: "pointer",
                                    fontFamily: "Georgia, serif",
                                    whiteSpace: "nowrap"
                                  }}
                                >
                                  ⇄ Aplicar a todos
                                </button>
                              </div>
                            ) : (
                              <div style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                fontSize: 10.5,
                                color: "#b91c1c",
                                fontWeight: "500"
                              }}>
                                <span>{blockEnabled ? "🚫 Todo el día bloqueado en la planilla (sin generar turno)" : "Día no laboral"}</span>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}

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

          {/* Section for deactivated professionals */}
          {profs.some(p => p.deletedAt) && (
            <div style={{ marginTop: 24, borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
              <div style={{ fontSize: 13, color: C.textSoft, marginBottom: 12, fontWeight: "bold", display: "flex", alignItems: "center", gap: 6 }}>
                <span>👩‍🦳</span> Profesionales de baja (Históricas)
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {profs.filter(p => p.deletedAt).map(prof => (
                  <div key={prof.id} style={{
                    background: "#fdfdfd", border: `1px dashed ${C.border}`, borderRadius: 12,
                    padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between",
                    opacity: 0.85
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 20 }}>{prof.emoji}</span>
                      <div>
                        <strong style={{ fontSize: 13, color: C.text }}>{prof.name}</strong>
                        <div style={{ fontSize: 10, color: C.textSoft }}>
                          Especialidad: {getDatalistLabel(prof.rama || "manos")} · De baja desde: {prof.deletedAt}
                        </div>
                      </div>
                    </div>
                    <button onClick={() => restoreProf(prof.id)} style={{
                      padding: "6px 12px", borderRadius: 8, border: `1px solid ${C.greenMint}`,
                      background: C.greenPale, color: C.green, fontSize: 11, cursor: "pointer",
                      fontWeight: "bold", transition: "all .15s"
                    }}>
                      ↺ Reactivar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
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
            .service-commission-input { appearance: textfield; -moz-appearance: textfield; }
            .service-commission-input::-webkit-inner-spin-button,
            .service-commission-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
            .service-commission-input::placeholder { color: ${C.green}; opacity: 1; }
            .service-commission-input:focus { color: ${C.green}; background: transparent; }

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
            /* Tabla compacta: ancho completo y filas continuas en escritorio. */
            @media (min-width: 769px) {
              .branches-grid-container { grid-template-columns: minmax(0, 1fr); gap: 12px; }
              .branches-grid-container .services-grid-header,
              .branches-grid-container .service-row-card {
                grid-template-columns: 32px minmax(120px, 1fr) 68px 78px 90px 90px 54px 30px 30px !important;
                gap: 6px !important;
                padding: 4px 10px !important;
              }
              .services-compact-list { border: 1px solid ${C.border}; border-radius: 12px; overflow: hidden; }
              .branches-grid-container .service-row-card { border: none; border-bottom: 1px solid ${C.border}; border-radius: 0; box-shadow: none; }
              .branches-grid-container .service-row-card:last-child { border-bottom: none; }
              .branches-grid-container .service-row-card:hover { background: ${C.greenPale}; box-shadow: none; }
              .branches-grid-container .service-row-card input,
              .branches-grid-container .service-row-card select { height: 30px !important; }
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

            {/* Categorías: mismo botón y desplegable que la administración de ramas. */}
            <div style={{ position: "relative" }}>
              <button onClick={() => { setCategoryMenuOpen(!categoryMenuOpen); setDropdownOpen(false) }} style={actionBtnStyle}>
                {svcFilter.cat === "all" ? "Todas las categorías" : `${CAT_OPTIONS.find(cat => cat.id === svcFilter.cat)?.icon || ""} ${CAT_OPTIONS.find(cat => cat.id === svcFilter.cat)?.label || "Categoría"}`} ▾
              </button>
              {categoryMenuOpen && <>
                <div onClick={() => setCategoryMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 99 }} />
                <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 100, background: C.white, border: `1.5px solid ${C.greenMint}`, borderRadius: 12, boxShadow: `0 8px 24px ${C.shadow}`, padding: 6, width: "max-content", minWidth: 190, maxWidth: "calc(100vw - 40px)", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ padding: "8px 12px", fontSize: 11, color: C.green, fontWeight: "bold" }}>Categorías</div>
                  <div style={{ maxHeight: 260, overflowY: "auto" }}>
                    {[{ id: "all", label: "Todas las categorías", icon: "" }, ...CAT_OPTIONS].map(cat => (
                      <div key={cat.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <button onClick={() => { setSvcFilter(p => ({ ...p, cat: cat.id })); setCategoryMenuOpen(false) }} style={{ flex: 1, padding: "9px 12px", textAlign: "left", fontFamily: "inherit", fontSize: 12, border: "none", borderRadius: 8, cursor: "pointer", background: svcFilter.cat === cat.id ? C.greenPale : "transparent", color: C.text }}>
                          {cat.icon} {cat.label}
                        </button>
                        {(config?.customCategories || []).some(cc => cc.id === cat.id) && <button title={`Eliminar categoría ${cat.label}`} onClick={() => removeCustomCategory(cat.id)} style={{ border: "none", background: "transparent", color: "#c04040", cursor: "pointer", padding: "8px 10px" }}>✕</button>}
                      </div>
                    ))}
                  </div>
                  <button onClick={() => { addCustomCategory(); setCategoryMenuOpen(false) }} style={{ ...actionBtnStyle, border: "none", borderTop: `1px solid ${C.border}`, borderRadius: 0, justifyContent: "flex-start", width: "100%" }}>＋ Nueva categoría</button>
                </div>
              </>}
            </div>

            {/* Administración exclusiva de ramas. */}
            <div style={{ position: "relative" }}>
              <button 
                onClick={() => { setDropdownOpen(!dropdownOpen); setCategoryMenuOpen(false) }}
                style={actionBtnStyle}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.greenMint; e.currentTarget.style.background = C.greenPale; e.currentTarget.style.color = C.green }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.white; e.currentTarget.style.color = C.textSoft }}
              >
                🌿 Administrar ramas ▾
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
                    width: "max-content", minWidth: 190, maxWidth: "calc(100vw - 40px)",
                    boxSizing: "border-box",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4
                  }}>
                    <div style={{ padding: "8px 12px", fontSize: 11, color: C.green, fontWeight: "bold" }}>Ramas</div>
                    <div style={{ maxHeight: 260, overflowY: "auto" }}>
                      {serviceRamas.map(r => (
                        <div key={r}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, minHeight: 38 }}>
                            <button title={`Editar ícono de ${r}`} aria-label={`Editar ícono de ${r}`} onClick={() => setEmojiPicker(emojiPicker === `rama-${r}` ? null : `rama-${r}`)} style={{ width: 34, height: 32, border: `1px solid ${C.border}`, borderRadius: 8, background: C.cream, cursor: "pointer", fontSize: 18 }}>{config.ramaIcons?.[r] || (r === "manos" ? "💅" : "✨")}</button>
                            <span style={{ flex: 1, padding: "9px 6px", fontSize: 12, color: C.text }}>{r.charAt(0).toUpperCase() + r.slice(1)}</span>
                            {(config.customRamas || []).includes(r) && <button title={`Eliminar rama ${r}`} onClick={() => removeCustomRama(r)} style={{ border: "none", background: "transparent", color: "#c04040", cursor: "pointer", padding: "8px 10px" }}>✕</button>}
                          </div>
                          {emojiPicker === `rama-${r}` && <EmojiPicker current={config.ramaIcons?.[r] || (r === "manos" ? "💅" : "✨")} onSelect={icon => { setConfig(p => ({ ...p, ramaIcons: { ...(p.ramaIcons || {}), [r]: icon } })); setEmojiPicker(null) }} />}
                        </div>
                      ))}
                    </div>
                    <button 
                      onClick={() => { addCustomRama(); setDropdownOpen(false); }}
                      style={{ ...actionBtnStyle, border: "none", borderTop: `1px solid ${C.border}`, borderRadius: 0, justifyContent: "flex-start", width: "100%" }}
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
                      <div className="services-compact-list" style={{ display: "flex", flexDirection: "column", gap: 0 }}>
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
                                {serviceRamaOptions(svc.rama).map(r => (
                                  <option key={r} value={r}>{getDatalistLabel(r)}</option>
                                ))}
                              </select>
                              
                              {/* % Comisión */}
                              <div className="svc-col-comisionPct" style={{ display: "flex", alignItems: "center", border: `1.5px solid ${C.border}`, borderRadius: 9, background: C.cream, height: 34, padding: "0 5px", width: "100%", boxSizing: "border-box", gap: 2 }}>
                                <input
                                  className="service-commission-input"
                                  aria-label={`Porcentaje de comisión de ${svc.name}`}
                                  type="number"
                                  min={0}
                                  max={100}
                                  placeholder={`${config.comisionPct}`}
                                  value={svc.comisionPct !== undefined && svc.comisionPct !== null ? svc.comisionPct : ""}
                                  onChange={e => {
                                    const val = e.target.value === "" ? null : parseInt(e.target.value)
                                    updateSvc(svc.id, "comisionPct", isNaN(val) ? null : val)
                                  }}
                                  style={{ border: "none", width: "100%", minWidth: 0, height: "100%", fontSize: 11, textAlign: "center", color: C.green, fontWeight: "bold", background: "transparent", outline: "none", padding: 0 }}
                                />
                                <span aria-hidden="true" style={{ fontSize: 10, color: C.green, fontWeight: "bold", pointerEvents: "none" }}>%</span>
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
            <Overlay onClose={() => setNewSvcModal(false)}>
              <div onClick={e => e.stopPropagation()} style={{ background:C.white, borderRadius:20, padding:"24px 28px", width:"min(480px,calc(100vw-32px))", boxShadow:"0 20px 60px rgba(0,0,0,.2)" }}>
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
                    {serviceRamaOptions(newSvc.rama).map(r => (
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
            </Overlay>
          )}

          {/* New Category modal */}
          {newCatModal && (
            <Overlay onClose={() => setNewCatModal(false)}>
              <div onClick={e => e.stopPropagation()} style={{ background:C.white, borderRadius:20, padding:"24px 28px", width:"min(400px,calc(100vw-32px))", boxShadow:"0 20px 60px rgba(0,0,0,.2)" }}>
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
            </Overlay>
          )}

          {/* Formulario de nueva rama */}
          {newRamaModal && (
            <Overlay onClose={() => setNewRamaModal(false)}>
              <div onClick={e => e.stopPropagation()} style={{ background:C.white, borderRadius:20, padding:"24px 28px", width:"min(400px,calc(100vw-32px))", boxShadow:"0 20px 60px rgba(0,0,0,.2)" }}>
                <div style={{ fontSize:14, fontWeight:"bold", color:C.green, marginBottom:18 }}>🌿 Nueva Rama</div>

                <div style={{ marginBottom:16 }}>
                  <div style={{ fontSize:8, letterSpacing:"2px", color:C.textSoft, textTransform:"uppercase", marginBottom:6 }}>Nombre</div>
                  <input
                    value={newRama.label}
                    onChange={e => setNewRama(p => ({ ...p, label: e.target.value }))}
                    placeholder="Ej: Masajes, Barbería..."
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
                        onClick={() => setNewRama(p => ({ ...p, icon: e }))}
                        style={{ width:36, height:36, borderRadius:10, border:`2px solid ${newRama.icon===e?C.green:C.border}`, background:newRama.icon===e?C.greenPale:"transparent", fontSize:18, cursor:"pointer" }}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                  <input
                    value={newRama.icon}
                    onChange={e => setNewRama(p => ({ ...p, icon: e.target.value }))}
                    placeholder="O escribí un emoji custom..."
                    style={{ ...cfgInput, width:"100%", boxSizing:"border-box" }}
                  />
                </div>

                <div style={{ display:"flex", gap:10 }}>
                  <button onClick={() => setNewRamaModal(false)} style={{ flex:1, padding:"10px", borderRadius:12, border:`1.5px solid ${C.border}`, background:C.white, color:C.textSoft, fontSize:12, cursor:"pointer", fontFamily:"Georgia,serif" }}>Cancelar</button>
                  <button onClick={saveNewRama} disabled={!newRama.label.trim()} style={{ flex:2, padding:"10px", borderRadius:12, border:"none", background:newRama.label.trim()?`linear-gradient(135deg,${C.green},${C.greenLight})`:"#e8e8e8", color:newRama.label.trim()?"#fff":"#bbb", fontSize:12, cursor:newRama.label.trim()?"pointer":"not-allowed", fontFamily:"Georgia,serif" }}>✅ Guardar Rama</button>
                </div>
              </div>
            </Overlay>
          )}


        </div>
      )}

      {/* ── SISTEMA ─────────────────────────────────────────── */}
      {seccion === "sistema" && (
        <SectionCard title="⚙️ Parámetros del sistema">

          <CfgField label="💾 Backup de datos">
            <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
              <button onClick={() => {
                const data = { allData, gastos, sueldos, config, clientes, todoTasks, todoHistory, exportedAt: new Date().toISOString() }
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
                  reader.onload = async (ev) => {
                    try {
                      const data = JSON.parse(ev.target.result)
                      if (!data || (!data.allData && !data.config)) { alert("Archivo de backup inválido"); return }
                      const fechaBackup = data.exportedAt?.slice(0, 10) || "desconocida"
                      if (!window.confirm(`¿Restaurar backup del ${fechaBackup}?\nEsto reemplazará y sincronizará todos los datos en la base de datos.`)) return
                      
                      if (typeof restoreBackup === "function") {
                        await restoreBackup(data)
                      } else {
                        if (data.config) setConfig(data.config)
                      }
                      alert("✅ Backup restaurado y sincronizado correctamente. La página se recargará.")
                      window.location.reload()
                    } catch (err) {
                      console.error("Error al restaurar backup:", err)
                      alert("⚠️ Error al restaurar el backup: " + (err.message || "archivo inválido"))
                    }
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

          <CfgField label="✨ Fondo de Modales (Overlay) - Tonalidad y Efecto">
            {/* Introducción */}
            <div style={{ fontSize: 11, color: C.textSoft, marginBottom: 14, lineHeight: 1.4 }}>
              Personalizá la tonalidad del fondo oscuro al abrir modales, junto con su nivel de transparencia y desenfoque (blur). Cada barra cuenta con 10 niveles y tiene marcado su valor original de fábrica.
            </div>

            {/* 1. Tonalidad */}
            <div style={{ background: C.cream, padding: "14px 16px", borderRadius: 12, border: `1.5px solid ${C.border}`, marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: "bold", color: C.text }}>Tonalidad del fondo</div>
                  <div style={{ fontSize: 10, color: C.textSoft }}>Tinte o matiz de color que tiñe el fondo translúcido</div>
                </div>
                {((config.modalTone || "verde") === "verde") && (
                  <span style={{ fontSize: 9.5, fontWeight: "bold", color: C.green, background: "#e8f5e9", border: `1px solid ${C.greenLight}`, padding: "2px 8px", borderRadius: 20 }}>
                    ★ Por defecto
                  </span>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
                {MODAL_TONES.map(tone => {
                  const isSel = (config.modalTone || "verde") === tone.id
                  return (
                    <button
                      key={tone.id}
                      type="button"
                      onClick={() => updateConfig("modalTone", tone.id)}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 10,
                        border: `1.5px solid ${isSel ? C.green : C.border}`,
                        background: isSel ? "#f2faf3" : C.white,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        cursor: "pointer",
                        transition: "all .15s ease",
                        textAlign: "left"
                      }}
                    >
                      <div style={{
                        width: 22, height: 22, borderRadius: "50%",
                        background: tone.hex,
                        border: "1.5px solid rgba(0,0,0,0.15)",
                        flexShrink: 0,
                        boxShadow: isSel ? `0 0 0 2px ${C.green}` : "none",
                        display: "flex", alignItems: "center", justifyContent: "center"
                      }}>
                        {isSel && <span style={{ color: "#fff", fontSize: 10, fontWeight: "bold" }}>✓</span>}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 11, fontWeight: isSel ? "bold" : "600", color: isSel ? C.green : C.text, display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tone.name}</span>
                          {tone.isDefault && <span style={{ fontSize: 8, color: C.textSoft, fontWeight: "normal" }}>(Def)</span>}
                        </div>
                        <div style={{ fontSize: 8.5, color: C.textSoft, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tone.desc}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 2. Transparencia / Opacidad (10 niveles) */}
            {(() => {
              const currentOpLevel = config.modalOpacityLevel ?? MODAL_OPACITY_DEFAULT_LEVEL
              const opData = MODAL_OPACITY_LEVELS[currentOpLevel] || MODAL_OPACITY_LEVELS[MODAL_OPACITY_DEFAULT_LEVEL]
              const isDefaultOp = currentOpLevel === MODAL_OPACITY_DEFAULT_LEVEL

              return (
                <div style={{ background: C.cream, padding: "14px 16px", borderRadius: 12, border: `1.5px solid ${C.border}`, marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: "bold", color: C.text }}>Transparencia / Opacidad (10 niveles)</div>
                      <div style={{ fontSize: 10, color: C.textSoft }}>Qué tan visible o tenue es el fondo debajo del modal</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: "bold", color: C.text }}>
                        Nivel {currentOpLevel} ({opData.label})
                      </span>
                      {isDefaultOp && (
                        <span style={{ fontSize: 9.5, fontWeight: "bold", color: C.green, background: "#e8f5e9", border: `1px solid ${C.greenLight}`, padding: "2px 7px", borderRadius: 20 }}>
                          ★ Por defecto
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Slider */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 9, color: C.textSoft, width: 28 }}>10%</span>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      step={1}
                      value={currentOpLevel}
                      onChange={e => updateConfig("modalOpacityLevel", parseInt(e.target.value))}
                      style={{ flex: 1, accentColor: C.green, cursor: "pointer", height: 6 }}
                    />
                    <span style={{ fontSize: 9, color: C.textSoft, width: 28, textAlign: "right" }}>95%</span>
                  </div>

                  {/* Botones de nivelación de 10 niveles */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 4 }}>
                    {Array.from({ length: 10 }, (_, i) => i + 1).map(lvl => {
                      const isCurrent = currentOpLevel === lvl
                      const isDef = lvl === MODAL_OPACITY_DEFAULT_LEVEL
                      return (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => updateConfig("modalOpacityLevel", lvl)}
                          style={{
                            padding: "6px 2px",
                            borderRadius: 7,
                            border: `1.5px solid ${isCurrent ? C.green : isDef ? C.greenLight : C.border}`,
                            background: isCurrent ? C.green : isDef ? "#f0f7f1" : C.white,
                            color: isCurrent ? "#fff" : isDef ? C.green : C.textSoft,
                            fontSize: 10,
                            fontWeight: isCurrent || isDef ? "bold" : "normal",
                            cursor: "pointer",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 1,
                            transition: "all .12s ease",
                            boxShadow: isCurrent ? `0 2px 6px ${C.green}44` : "none"
                          }}
                          title={`Nivel ${lvl} (${MODAL_OPACITY_LEVELS[lvl].label}): ${MODAL_OPACITY_LEVELS[lvl].desc}${isDef ? " - Valor por defecto" : ""}`}
                        >
                          <span>{lvl}</span>
                          {isDef && (
                            <span style={{ fontSize: 7, textTransform: "uppercase", letterSpacing: "-0.3px", opacity: isCurrent ? 0.95 : 0.85, fontWeight: "bold" }}>
                              Def
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                  <div style={{ fontSize: 9.5, color: C.textSoft, marginTop: 6, fontStyle: "italic" }}>
                    Nivel seleccionado: {opData.desc} ({opData.label} de opacidad)
                  </div>
                </div>
              )
            })()}

            {/* 3. Efecto de Desenfoque / Blur (10 niveles) */}
            {(() => {
              const currentBlurLevel = config.modalBlurLevel ?? MODAL_BLUR_DEFAULT_LEVEL
              const blurData = MODAL_BLUR_LEVELS[currentBlurLevel] || MODAL_BLUR_LEVELS[MODAL_BLUR_DEFAULT_LEVEL]
              const isDefaultBlur = currentBlurLevel === MODAL_BLUR_DEFAULT_LEVEL

              return (
                <div style={{ background: C.cream, padding: "14px 16px", borderRadius: 12, border: `1.5px solid ${C.border}`, marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: "bold", color: C.text }}>Efecto de desenfoque / Blur (10 niveles)</div>
                      <div style={{ fontSize: 10, color: C.textSoft }}>Intensidad del difuminado de la pantalla al abrir un modal</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: "bold", color: C.text }}>
                        Nivel {currentBlurLevel} ({blurData.label})
                      </span>
                      {isDefaultBlur && (
                        <span style={{ fontSize: 9.5, fontWeight: "bold", color: C.green, background: "#e8f5e9", border: `1px solid ${C.greenLight}`, padding: "2px 7px", borderRadius: 20 }}>
                          ★ Por defecto
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Slider */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 9, color: C.textSoft, width: 28 }}>0px</span>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      step={1}
                      value={currentBlurLevel}
                      onChange={e => updateConfig("modalBlurLevel", parseInt(e.target.value))}
                      style={{ flex: 1, accentColor: C.green, cursor: "pointer", height: 6 }}
                    />
                    <span style={{ fontSize: 9, color: C.textSoft, width: 28, textAlign: "right" }}>44px</span>
                  </div>

                  {/* Botones de nivelación de 10 niveles */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 4 }}>
                    {Array.from({ length: 10 }, (_, i) => i + 1).map(lvl => {
                      const isCurrent = currentBlurLevel === lvl
                      const isDef = lvl === MODAL_BLUR_DEFAULT_LEVEL
                      return (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => updateConfig("modalBlurLevel", lvl)}
                          style={{
                            padding: "6px 2px",
                            borderRadius: 7,
                            border: `1.5px solid ${isCurrent ? C.green : isDef ? C.greenLight : C.border}`,
                            background: isCurrent ? C.green : isDef ? "#f0f7f1" : C.white,
                            color: isCurrent ? "#fff" : isDef ? C.green : C.textSoft,
                            fontSize: 10,
                            fontWeight: isCurrent || isDef ? "bold" : "normal",
                            cursor: "pointer",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 1,
                            transition: "all .12s ease",
                            boxShadow: isCurrent ? `0 2px 6px ${C.green}44` : "none"
                          }}
                          title={`Nivel ${lvl} (${MODAL_BLUR_LEVELS[lvl].label}): ${MODAL_BLUR_LEVELS[lvl].desc}${isDef ? " - Valor por defecto" : ""}`}
                        >
                          <span>{lvl}</span>
                          {isDef && (
                            <span style={{ fontSize: 7, textTransform: "uppercase", letterSpacing: "-0.3px", opacity: isCurrent ? 0.95 : 0.85, fontWeight: "bold" }}>
                              Def
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                  <div style={{ fontSize: 9.5, color: C.textSoft, marginTop: 6, fontStyle: "italic" }}>
                    Efecto seleccionado: {blurData.desc} ({blurData.label})
                  </div>
                </div>
              )
            })()}

            {/* 4. Previsualización en Vivo (Live Preview) */}
            {(() => {
              const previewStyle = getModalOverlayStyle(config)
              const isAllDefault = (config.modalTone || "verde") === "verde" &&
                (config.modalOpacityLevel ?? MODAL_OPACITY_DEFAULT_LEVEL) === MODAL_OPACITY_DEFAULT_LEVEL &&
                (config.modalBlurLevel ?? MODAL_BLUR_DEFAULT_LEVEL) === MODAL_BLUR_DEFAULT_LEVEL

              return (
                <div style={{ background: C.cream, padding: "14px 16px", borderRadius: 12, border: `1.5px solid ${C.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: "bold", color: C.text }}>Vista previa en tiempo real</div>
                      <div style={{ fontSize: 10, color: C.textSoft }}>Así se verá el fondo y el desenfoque detrás de las ventanas modales</div>
                    </div>
                    {!isAllDefault && (
                      <button
                        type="button"
                        onClick={() => {
                          updateConfig("modalTone", "verde")
                          updateConfig("modalOpacityLevel", MODAL_OPACITY_DEFAULT_LEVEL)
                          updateConfig("modalBlurLevel", MODAL_BLUR_DEFAULT_LEVEL)
                        }}
                        style={{
                          fontSize: 10,
                          fontWeight: "bold",
                          color: C.green,
                          background: "#fff",
                          border: `1.5px solid ${C.greenLight}`,
                          borderRadius: 8,
                          padding: "5px 10px",
                          cursor: "pointer",
                          transition: "all .15s"
                        }}
                        title="Restablecer tonalidad verde, opacidad 40% y desenfoque 5px"
                      >
                        ↺ Restaurar por defecto
                      </button>
                    )}
                  </div>

                  {/* Contenedor de simulación */}
                  <div style={{
                    position: "relative",
                    height: 150,
                    borderRadius: 12,
                    overflow: "hidden",
                    border: `1.5px solid ${C.border}`,
                    background: "#f4f6f3",
                    boxShadow: "inset 0 2px 6px rgba(0,0,0,0.04)"
                  }}>
                    {/* Fondo simulando la grilla y turnos */}
                    <div style={{
                      position: "absolute",
                      inset: 0,
                      padding: 12,
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      pointerEvents: "none",
                      userSelect: "none"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${C.border}`, paddingBottom: 6 }}>
                        <div style={{ fontWeight: "bold", fontSize: 11, color: C.green }}>🌿 Perla Verde · Agenda</div>
                        <div style={{ fontSize: 10, color: C.textSoft }}>Viernes 24 · 15:30 hs</div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                        <div style={{ background: "#fff", padding: "6px 8px", borderRadius: 6, border: `1px solid ${C.border}` }}>
                          <div style={{ fontSize: 9, fontWeight: "bold", color: C.green }}>💅 Manicura Semi</div>
                          <div style={{ fontSize: 8.5, color: C.textSoft }}>Lucía Morales</div>
                        </div>
                        <div style={{ background: "#fff", padding: "6px 8px", borderRadius: 6, border: `1px solid ${C.border}` }}>
                          <div style={{ fontSize: 9, fontWeight: "bold", color: C.amber }}>✨ Nail Art Spa</div>
                          <div style={{ fontSize: 8.5, color: C.textSoft }}>Camila Ramos</div>
                        </div>
                        <div style={{ background: "#fff", padding: "6px 8px", borderRadius: 6, border: `1px solid ${C.border}` }}>
                          <div style={{ fontSize: 9, fontWeight: "bold", color: C.green }}>🌸 Pedicura Clásica</div>
                          <div style={{ fontSize: 8.5, color: C.textSoft }}>Valeria Rossi</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 9, color: C.textSoft, marginTop: 4 }}>
                        <span>📍 Sala Principal</span>
                        <span>•</span>
                        <span>💰 Total acumulado: $84.500</span>
                      </div>
                    </div>

                    {/* Capa de overlay en tiempo real */}
                    <div style={{
                      position: "absolute",
                      inset: 0,
                      background: previewStyle.background,
                      backdropFilter: previewStyle.backdropFilter,
                      WebkitBackdropFilter: previewStyle.WebkitBackdropFilter,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "background 0.2s ease, backdrop-filter 0.2s ease",
                    }}>
                      {/* Ventana modal simulada */}
                      <div style={{
                        background: "#fff",
                        borderRadius: 12,
                        padding: "10px 14px",
                        boxShadow: "0 10px 25px rgba(0,0,0,0.18)",
                        border: `1px solid ${C.border}`,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 4,
                        maxWidth: 200,
                        textAlign: "center"
                      }}>
                        <span style={{ fontSize: 16 }}>📋</span>
                        <div style={{ fontSize: 11, fontWeight: "bold", color: C.text }}>Modal de Ejemplo</div>
                        <div style={{ fontSize: 8.5, color: C.textSoft }}>El fondo detrás muestra tu ajuste actual</div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}
          </CfgField>

          <CfgField label="💬 WhatsApp y Recordatorios de Turnos">
            {/* 1. Anticipación del recordatorio */}
            <div style={{ background: C.cream, padding: "14px 16px", borderRadius: 12, border: `1.5px solid ${C.border}`, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: "bold", color: C.text }}>Tiempo de anticipación de la alerta</div>
                  <div style={{ fontSize: 10, color: C.textSoft }}>Con cuántos minutos de anticipación al inicio del turno se activa la alerta de recordatorio</div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {[10, 15, 20, 30, 45, 60].map(mins => {
                    const isSel = (config.waReminderMins ?? 15) === mins
                    return (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => updateConfig("waReminderMins", mins)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 8,
                          border: `1.5px solid ${isSel ? "#25D366" : C.border}`,
                          background: isSel ? "linear-gradient(135deg, #25D366, #1ebd5a)" : C.white,
                          color: isSel ? "#fff" : C.textSoft,
                          fontSize: 10,
                          fontWeight: "bold",
                          cursor: "pointer",
                          fontFamily: "Georgia, serif",
                          boxShadow: isSel ? "0 2px 8px rgba(37, 211, 102, 0.3)" : "none",
                          transition: "all 0.15s ease"
                        }}
                      >
                        {mins} min {mins === 15 ? "⭐" : ""}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* 2. Método de apertura */}
            <div style={{ background: C.cream, padding: "14px 16px", borderRadius: 12, border: `1.5px solid ${C.border}`, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: "bold", color: C.text }}>Método de apertura de WhatsApp</div>
                  <div style={{ fontSize: 10, color: C.textSoft }}>Elegí si preferís abrir directamente la app nativa instalada o la versión web en el navegador</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => updateConfig("waOpenMode", "app")}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 8,
                      border: `1.5px solid ${(config.waOpenMode || "app") === "app" ? "#25D366" : C.border}`,
                      background: (config.waOpenMode || "app") === "app" ? "linear-gradient(135deg, #25D366, #1ebd5a)" : C.white,
                      color: (config.waOpenMode || "app") === "app" ? "#fff" : C.textSoft,
                      fontSize: 10,
                      fontWeight: "bold",
                      cursor: "pointer",
                      fontFamily: "Georgia, serif",
                      boxShadow: (config.waOpenMode || "app") === "app" ? "0 2px 8px rgba(37, 211, 102, 0.3)" : "none",
                      transition: "all 0.15s ease"
                    }}
                    title="Abre la app de Windows o móvil directamente sin pestañas en blanco en el navegador"
                  >
                    📱 App nativa (sin pestañas)
                  </button>
                  <button
                    type="button"
                    onClick={() => updateConfig("waOpenMode", "web")}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 8,
                      border: `1.5px solid ${config.waOpenMode === "web" ? "#25D366" : C.border}`,
                      background: config.waOpenMode === "web" ? "linear-gradient(135deg, #25D366, #1ebd5a)" : C.white,
                      color: config.waOpenMode === "web" ? "#fff" : C.textSoft,
                      fontSize: 10,
                      fontWeight: "bold",
                      cursor: "pointer",
                      fontFamily: "Georgia, serif",
                      boxShadow: config.waOpenMode === "web" ? "0 2px 8px rgba(37, 211, 102, 0.3)" : "none",
                      transition: "all 0.15s ease"
                    }}
                    title="Abre una nueva pestaña con WhatsApp Web"
                  >
                    🌐 WhatsApp Web
                  </button>
                </div>
              </div>
            </div>

            {/* 3. Plantilla de mensaje editable */}
            {(() => {
              const OLD_WA_TEMPLATE = "¡Hola {cliente}! 🌿 Te recordamos tu turno en {empresa} para hoy a las {hora} hs con {profesional} ({servicios}).\n¡Te esperamos! 💅✨"
              const currentTemplate = (config.waReminderTemplate === OLD_WA_TEMPLATE || !config.waReminderTemplate)
                ? DEFAULT_WA_REMINDER_TEMPLATE
                : config.waReminderTemplate

              return (
                <div style={{ background: C.cream, padding: "14px 16px", borderRadius: 12, border: `1.5px solid ${C.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: "bold", color: C.text }}>Plantilla del mensaje de recordatorio</div>
                      <div style={{ fontSize: 10, color: C.textSoft }}>Personalizá el saludo y cuerpo del mensaje a enviar a las clientas</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateConfig("waReminderTemplate", DEFAULT_WA_REMINDER_TEMPLATE)}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 6,
                        border: `1px solid ${C.border}`,
                        background: C.white,
                        color: C.textSoft,
                        fontSize: 9,
                        cursor: "pointer",
                        fontFamily: "Georgia, serif"
                      }}
                      title="Restablecer el mensaje por defecto"
                    >
                      ↺ Restablecer original
                    </button>
                  </div>

                  {/* Variable tags helper */}
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 6, alignItems: "center" }}>
                    <span style={{ fontSize: 9, color: C.textSoft, letterSpacing: "0.5px" }}>Variables (clic para insertar):</span>
                    {[
                      { tag: "{cliente}", label: "Nombre clienta" },
                      { tag: "{dia}", label: "Día (hoy / mañana / fecha)", highlight: true },
                      { tag: "{fecha}", label: "Fecha completa", highlight: true },
                      { tag: "{hora}", label: "Horario" },
                      { tag: "{servicios}", label: "Servicios" },
                      { tag: "{profesional}", label: "Profesional" },
                      { tag: "{empresa}", label: "Negocio" },
                    ].map(v => (
                      <button
                        key={v.tag}
                        type="button"
                        onClick={() => {
                          updateConfig("waReminderTemplate", currentTemplate + " " + v.tag)
                        }}
                        style={{
                          background: v.highlight ? "rgba(37, 211, 102, 0.22)" : "rgba(37, 211, 102, 0.12)",
                          color: "#128c7e",
                          border: `1px solid ${v.highlight ? "rgba(37, 211, 102, 0.6)" : "rgba(37, 211, 102, 0.3)"}`,
                          borderRadius: 12,
                          padding: "2px 8px",
                          fontSize: 9,
                          fontWeight: "bold",
                          cursor: "pointer"
                        }}
                        title={`Insertar ${v.tag} en el mensaje`}
                      >
                        {v.tag}
                      </button>
                    ))}
                  </div>

                  {/* Tip explicativo de {dia} y {fecha} */}
                  <div style={{ fontSize: 9.5, color: "#166534", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "6px 10px", marginBottom: 10, lineHeight: 1.45 }}>
                    💡 <strong>{`{dia}`}</strong> se adapta automáticamente al día del turno: indicará <em>"hoy"</em> si el turno es de hoy, <em>"mañana"</em> si es para el día siguiente, o el día con fecha (ej: <em>"el Viernes 9 de octubre"</em>) para cualquier otra fecha posterior o anticipada.
                  </div>

                  <textarea
                    value={currentTemplate}
                    onChange={e => updateConfig("waReminderTemplate", e.target.value)}
                    rows={3}
                    style={{
                      ...cfgInput,
                      height: "auto",
                      padding: "10px",
                      width: "100%",
                      boxSizing: "border-box",
                      lineHeight: 1.4,
                      fontSize: 12,
                      resize: "vertical"
                    }}
                  />

                  {/* Live Preview interactiva con selector de día */}
                  <div style={{ marginTop: 10, background: "#f0fdf4", border: "1px dashed #86efac", borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 6 }}>
                      <div style={{ fontSize: 8.5, fontWeight: "bold", color: "#166534", textTransform: "uppercase", letterSpacing: "1px" }}>
                        👁️ Vista previa del mensaje:
                      </div>
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <span style={{ fontSize: 8.5, color: "#15803d" }}>Simular:</span>
                        {[
                          { id: "hoy", label: "Hoy" },
                          { id: "manana", label: "Mañana" },
                          { id: "otro", label: "Otro día" },
                        ].map(tab => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setWaPreviewDay(tab.id)}
                            style={{
                              padding: "2px 7px",
                              borderRadius: 6,
                              fontSize: 9,
                              fontWeight: waPreviewDay === tab.id ? "bold" : "normal",
                              border: `1px solid ${waPreviewDay === tab.id ? "#16a34a" : "#bbf7d0"}`,
                              background: waPreviewDay === tab.id ? "#16a34a" : "#ffffff",
                              color: waPreviewDay === tab.id ? "#ffffff" : "#166534",
                              cursor: "pointer",
                              transition: "all .12s ease"
                            }}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div style={{ fontSize: 11, color: "#14532d", whiteSpace: "pre-line", fontStyle: "italic", background: "#ffffff", padding: "8px 10px", borderRadius: 6, border: "1px solid #dcfce7" }}>
                      {(() => {
                        const sampleDateKey = (() => {
                          const d = new Date()
                          if (waPreviewDay === "hoy") return todayKey()
                          if (waPreviewDay === "manana") {
                            d.setDate(d.getDate() + 1)
                            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
                          }
                          d.setDate(d.getDate() + 4)
                          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
                        })()

                        return generateReminderMessage({
                          clientName: "Lucía",
                          hour: "17:00",
                          services: [{ name: "Manicura semi + Nail art" }],
                          profName: "Valentina",
                          empresaNombre: config.empresaNombre || "Verde Naranja",
                          template: currentTemplate,
                          date: sampleDateKey,
                        })
                      })()}
                    </div>
                  </div>
                </div>
              )
            })()}
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

      {/* Pie de página con versión para verificación rápida */}
      <div style={{
        marginTop: 32,
        marginBottom: 16,
        textAlign: "center",
        fontSize: 11,
        color: C.textSoft,
        letterSpacing: "0.5px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        userSelect: "none"
      }}>
        <span>{config?.empresaNombre || "Perla Verde"}</span>
        <span style={{ opacity: 0.4 }}>•</span>
        <span style={{ 
          fontWeight: "bold", 
          color: C.green, 
          background: C.greenPale, 
          padding: "2px 8px", 
          borderRadius: 8,
          border: `1px solid ${C.greenMint}`
        }}>
          {APP_VERSION}
        </span>
      </div>
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
  width:"100%", height: 36, padding:"0 11px",
  border:`1.5px solid ${C.border}`, borderRadius:10,
  fontSize:12, color:C.text, background:C.cream,
  outline:"none", fontFamily:"Georgia,serif",
  transition:"border-color .2s", boxSizing: "border-box"
};

const rowInputStyle = {
  width: "100%",
  height: 36,
  padding: "0 10px",
  border: `1.5px solid ${C.border}`,
  borderRadius: 10,
  fontSize: 12,
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
