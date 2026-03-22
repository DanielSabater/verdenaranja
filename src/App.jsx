import { useState, useRef, useCallback, useMemo, useEffect } from "react"
import { C } from "./constants/colors.js"
import { PAYMENT_METHODS, HOURS } from "./constants/data.js"
import { cellKey, apptTotal, apptDur } from "./utils/appointments.js"
import { toDateKey, todayKey, isWorkDay } from "./utils/dates.js"
import { useIsMobile } from "./hooks/useIsMobile.js"
import { usePersistentState } from "./hooks/usePersistentState.js"
import { AppHeader } from "./components/header/AppHeader.jsx"
import { DateNav } from "./components/grid/DateNav.jsx"
import { AppGrid } from "./components/grid/AppGrid.jsx"
import { AppModals } from "./components/modals/AppModals.jsx"
import ContabilidadView from "./components/views/ContabilidadView.jsx"
import ConfigView from "./components/views/ConfigView.jsx"
import ClientesView from "./components/views/ClientesView.jsx"
import Login from "./components/Login.jsx"

const CELL_H = 50

export default function App() {
  const isMobile = useIsMobile()
  const [session, setSession] = useState(() => {
    const t = localStorage.getItem("pv_token")
    return t ? { token: t } : null
  })

  const handleLogin = (token, user) => {
    localStorage.setItem("pv_token", token)
    setSession({ token, user })
  }

  const handleLogout = () => {
    localStorage.removeItem("pv_token")
    setSession(null)
  }



  const {
    loaded, saveStatus,
    allData, setAllData,
    gastos, setGastos,
    sueldos, setSueldos,
    config, setConfig,
    clientes, setClientes,
  } = usePersistentState()

  const [currentDate, setCurrentDate] = useState(() => {
    const d = new Date()
    if (!isWorkDay(d)) d.setDate(d.getDate() + 1)
    return toDateKey(d)
  })
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [calViewDate, setCalViewDate]   = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  })
  const [activeView,   setActiveView]   = useState("turnos")
  const [contPeriod,   setContPeriod]   = useState("mes")
  const [contFrom,     setContFrom]     = useState("")
  const [contTo,       setContTo]       = useState("")
  const [gastoModal,   setGastoModal]   = useState(false)
  const [gastoForm,    setGastoForm]    = useState({ descripcion: "", monto: "", categoria: "insumos", fecha: todayKey() })
  const [editGastoId,  setEditGastoId]  = useState(null)
  const [sueldoPeriod, setSueldoPeriod] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  })

  const [modal,          setModal]          = useState(null)
  const [payModal,       setPayModal]       = useState(null)
  const [deleteKey,      setDeleteKey]      = useState(null)
  const [clientName,     setClientName]     = useState("")
  const [chosenServices, setChosenServices] = useState([])
  const [filterCat,      setFilterCat]      = useState("all")
  const [apptNotes,      setApptNotes]      = useState("")
  const [apptTip,        setApptTip]        = useState("")
  const [paymentSplits,  setPaymentSplits]  = useState([])
  const [searchTerm,     setSearchTerm]     = useState("")

  const [draggingKey,   setDraggingKey]   = useState(null)
  const [dropTarget,    setDropTarget]    = useState(null)
  const [dropValid,     setDropValid]     = useState(false)
  const [resizePreview, setResizePreview] = useState(null)
  const dragNode  = useRef(null)
  const resizeRef = useRef(null)


  const professionals = config.professionals
  const services      = config.services
  const comisionPct   = config.comisionPct

  const appointments = allData[currentDate] || {}
  const setAppointments = (updater) =>
    setAllData(prev => ({
      ...prev,
      [currentDate]: typeof updater === "function" ? updater(prev[currentDate] || {}) : updater,
    }))

  // ── Memoized so drag state changes don't re-render header ──────────────────
  const paidAppts = useMemo(
    () => Object.values(appointments).filter(a => a.paid),
    [appointments]
  )
  const totalByProf    = useCallback((pId) => paidAppts.filter(a => a.profId === pId).reduce((s, a) => s + apptTotal(a), 0), [paidAppts])
  const earningsByProf = useCallback((pId) => totalByProf(pId) * (comisionPct / 100), [totalByProf, comisionPct])
  const totalByMethod  = useCallback((mid) => paidAppts.reduce((s, a) => {
    if (a.paymentSplits?.length) {
      const split = a.paymentSplits.find(r => r.methodId === mid)
      return s + (split ? parseFloat(split.amount) || 0 : 0)
    }
    return s + (a.payMethod === mid ? apptTotal(a) : 0)
  }, 0), [paidAppts])
  const grandTotal    = useMemo(() => paidAppts.reduce((s, a) => s + apptTotal(a), 0), [paidAppts])
  const grandEarnings = useMemo(() => professionals.reduce((s, p) => s + earningsByProf(p.id), 0), [professionals, earningsByProf])

  const filteredServices = services.filter(s => (filterCat === "all" || s.category === filterCat) && s.name.toLowerCase().includes(searchTerm.toLowerCase()))
  const modalSubtotal    = chosenServices.reduce((s, sv) => s + sv.price, 0)
  const modalDuration    = chosenServices.reduce((s, sv) => s + sv.duration, 0)

  const isOccupied = useCallback((profId, hour, ignoreKey = null) => {
    if (appointments[cellKey(profId, hour)] && cellKey(profId, hour) !== ignoreKey) return true
    for (const [k, a] of Object.entries(appointments)) {
      if (k === ignoreKey) continue
      const [pid, h] = k.split("||")
      if (parseInt(pid) !== profId) continue
      const idx   = HOURS.indexOf(h)
      const slots = a.manualSlots ?? Math.ceil(apptDur(a) / 30)
      for (let s = 1; s < slots; s++) if (HOURS[idx + s] === hour) return true
    }
    return false
  }, [appointments])

  const canDrop = useCallback((dragKey, targetProfId, targetHour) => {
    const a = appointments[dragKey]
    if (!a) return false
    const slots = a.manualSlots ?? Math.ceil(apptDur(a) / 30)
    const idx   = HOURS.indexOf(targetHour)
    if (idx < 0 || idx + slots > HOURS.length) return false
    for (let s = 0; s < slots; s++) {
      if (isOccupied(targetProfId, HOURS[idx + s], dragKey)) return false
    }
    return true
  }, [appointments, isOccupied])

  const spanOf = (profId, hour) => {
    const k = cellKey(profId, hour)
    const a = appointments[k]
    if (!a) return null
    if (resizePreview?.key === k) return resizePreview.slots
    return a.manualSlots ?? Math.max(1, Math.ceil(apptDur(a) / 30))
  }

  const onDragStart = (e, key) => { setDraggingKey(key); dragNode.current = key; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", key) }
  const onDragEnd   = () => { setDraggingKey(null); setDropTarget(null); setDropValid(false); dragNode.current = null }
  const onDragLeave = () => { setDropTarget(null); setDropValid(false) }
  const onDragOver  = (e, profId, hour) => {
    e.preventDefault()
    const key = dragNode.current; if (!key) return
    const valid = canDrop(key, profId, hour)
    setDropTarget({ profId, hour }); setDropValid(valid)
    e.dataTransfer.dropEffect = valid ? "move" : "none"
  }
  const onDrop = (e, targetProfId, targetHour) => {
    e.preventDefault()
    const key = dragNode.current
    if (!key || !canDrop(key, targetProfId, targetHour)) { setDropTarget(null); setDropValid(false); return }
    setAppointments(prev => {
      const next = { ...prev }; const appt = next[key]; delete next[key]
      next[cellKey(targetProfId, targetHour)] = { ...appt, profId: targetProfId, hour: targetHour }
      return next
    })
    onDragEnd()
  }

  const onResizeStart = (e, key, edge) => {
    e.preventDefault(); e.stopPropagation()
    const appt        = appointments[key]
    const origHourIdx = HOURS.indexOf(appt.hour)
    const origSlots   = Math.max(1, Math.ceil(apptDur(appt) / 30))
    resizeRef.current = { key, edge, startY: e.clientY, origHourIdx, origSlots, profId: appt.profId }
    setResizePreview({ key, hourIdx: origHourIdx, slots: origSlots })
    const onMove = (ev) => {
      const r = resizeRef.current; if (!r) return
      const delta = Math.round((ev.clientY - r.startY) / CELL_H)

      // Calculate desired slots
      let hourIdx, slots
      if (r.edge === "bottom") {
        hourIdx = r.origHourIdx
        slots   = Math.min(Math.max(1, r.origSlots + delta), HOURS.length - r.origHourIdx)
      } else {
        hourIdx = Math.max(0, Math.min(r.origHourIdx + delta, r.origHourIdx + r.origSlots - 1))
        slots   = Math.max(1, r.origSlots - (hourIdx - r.origHourIdx))
      }

      // Clamp slots so we never overlap another appointment
      if (r.edge === "bottom") {
        let maxSlots = slots
        for (let s = 1; s < slots; s++) {
          const h = HOURS[hourIdx + s]
          if (!h || isOccupied(r.profId, h, r.key)) { maxSlots = s; break }
        }
        slots = maxSlots
      } else {
        // top resize: find first conflict going up
        let minIdx = hourIdx
        for (let i = hourIdx; i < r.origHourIdx; i++) {
          const h = HOURS[i]
          if (!h || isOccupied(r.profId, h, r.key)) { minIdx = i + 1 }
        }
        hourIdx = Math.max(hourIdx, minIdx)
        slots   = Math.max(1, r.origSlots - (hourIdx - r.origHourIdx))
      }

      setResizePreview({ key: r.key, hourIdx, slots })
    }
    const onUp = () => {
      window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp)
      const r = resizeRef.current; if (!r) return
      setResizePreview(prev => {
        if (!prev) return null
        const newHour = HOURS[prev.hourIdx]; const newKey = cellKey(r.profId, newHour)
        let conflict = false
        for (let s = 0; s < prev.slots; s++) { const h = HOURS[prev.hourIdx + s]; if (!h || isOccupied(r.profId, h, r.key)) { conflict = true; break } }
        if (!conflict) setAppointments(p => { const next = { ...p }; const appt = next[r.key]; delete next[r.key]; next[newKey] = { ...appt, hour: newHour, manualSlots: prev.slots, manualDur: prev.slots * 30 }; return next })
        return null
      })
      resizeRef.current = null
    }
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp)
  }

  const toggleService = (svc) => setChosenServices(prev => [...prev, { ...svc, uniqueId: Date.now() + Math.random() }])
  const removeService = (uniqueId) => setChosenServices(prev => prev.filter(x => x.uniqueId !== uniqueId))

  const saveAppt = () => {
    if (!chosenServices.length || !clientName.trim()) return
    const { profId, hour, editKey } = modal
    const k    = editKey || cellKey(profId, hour)
    const prev = appointments[editKey] || {}
    setAppointments(p => { const next = { ...p }; if (editKey && editKey !== k) delete next[editKey]; next[k] = { profId, hour, client: clientName.trim(), services: chosenServices, notes: apptNotes.trim(), paid: prev.paid || false, payMethod: prev.payMethod || null, tip: parseFloat(apptTip) || 0 }; return next })
    setModal(null)
  }

  const confirmPay = () => {
    const total   = apptTotal(appointments[payModal])
    const tipAmount = parseFloat(apptTip) || 0
    const totalWithTip = total + tipAmount
    const sumPaid = paymentSplits.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
    if (Math.abs(sumPaid - totalWithTip) > 1 || paymentSplits.some(r => !r.methodId || !(parseFloat(r.amount) > 0))) return
    setAppointments(p => ({ ...p, [payModal]: { ...p[payModal], paid: true, payMethod: paymentSplits[0].methodId, paymentSplits, tip: tipAmount } }))
    setPayModal(null)
  }

  const addSplit = () => {
    const usedMids = paymentSplits.map(r => r.methodId)
    const avail    = PAYMENT_METHODS.find(m => !usedMids.includes(m.id))
    if (!avail) return
    setPaymentSplits(p => [...p, { methodId: avail.id, amount: "" }])
  }
  const removeSplit = (idx) => setPaymentSplits(p => p.filter((_, i) => i !== idx))
  const updateSplit = (idx, field, value) => setPaymentSplits(p => p.map((r, i) => i === idx ? { ...r, [field]: value } : r))

  const doDelete = () => { setAppointments(p => { const n = { ...p }; delete n[deleteKey]; return n }); setDeleteKey(null) }

  // Show loading only on very first load, not on session changes
  if (!loaded) return (
    <div style={{ minHeight:"100vh", background:C.cream, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ width:52, height:52, borderRadius:"50%", background:`linear-gradient(135deg,${C.green},${C.greenLight})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:26, animation:"spin 1.2s linear infinite" }}>🌿</div>
    </div>
  )

  if (!session) return <Login onLogin={handleLogin} />

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh", background: C.cream, fontFamily: "'Georgia','Times New Roman',serif", color: C.text, userSelect: draggingKey ? "none" : "auto" }}>
      <AppHeader
        config={config} activeView={activeView}
        onLogout={handleLogout}
        setActiveView={(v) => { setActiveView(v); setCalendarOpen(false) }}
        saveStatus={saveStatus} totalByMethod={totalByMethod}
        grandTotal={grandTotal} grandEarnings={grandEarnings}
        currentDate={currentDate} setCurrentDate={setCurrentDate}
        calendarOpen={calendarOpen} setCalendarOpen={setCalendarOpen}
        calViewDate={calViewDate} setCalViewDate={setCalViewDate}
        allData={allData}
      />
      <div className="main-content" style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>

      {activeView === "turnos" && (
        <div key="v-turnos" className="pv-view pv-bg" style={{ display:"flex", flexDirection:"column", flex:1, overflow:"hidden", paddingBottom:70 }}>
          <div style={{ flex:1, overflowY:"auto", overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
          {(draggingKey || resizePreview) && (
            <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: resizePreview ? "rgba(58,125,68,.92)" : dropTarget ? (dropValid ? "rgba(58,125,68,.92)" : "rgba(200,60,60,.88)") : "rgba(40,40,40,.82)", color: "#fff", borderRadius: 30, padding: "8px 22px", fontSize: 12, letterSpacing: "1px", zIndex: 300, boxShadow: "0 4px 20px rgba(0,0,0,.25)", pointerEvents: "none" }}>
              {resizePreview ? "↕ Soltá para confirmar" : dropTarget ? (dropValid ? "✅ Soltar para mover aquí" : "🚫 Horario ocupado") : "☝️ Arrastrá a un nuevo horario"}
            </div>
          )}

          <AppGrid
            professionals={professionals} appointments={appointments} isMobile={isMobile}
            draggingKey={draggingKey} dropTarget={dropTarget} dropValid={dropValid} resizePreview={resizePreview}
            isOccupied={isOccupied} spanOf={spanOf}
            onDragStart={onDragStart} onDragEnd={onDragEnd} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
            onResizeStart={onResizeStart}
            paidAppts={paidAppts} totalByProf={totalByProf} earningsByProf={earningsByProf} comisionPct={comisionPct}
            onCellClick={(profId, hour) => { setModal({ profId, hour, editKey: null }); setChosenServices([]); setClientName(""); setFilterCat("all"); setApptNotes(""); setApptTip("") }}
            onEdit={(key, appt) => { setModal({ profId: appt.profId, hour: appt.hour, editKey: key }); setChosenServices([...appt.services]); setClientName(appt.client); setFilterCat("all"); setApptNotes(appt.notes || ""); setApptTip(appt.tip || "") }}
            onPay={(key) => { const a = appointments[key]; if (a?.paymentSplits?.length) setPaymentSplits(a.paymentSplits.map(s => ({ ...s }))); else setPaymentSplits([{ methodId: "efectivo", amount: apptTotal(a) + (a.tip || 0) }]); setApptTip(a.tip || ""); setPayModal(key) }}
            onDelete={(key) => setDeleteKey(key)}
            CELL_H={CELL_H}
          />
          </div>
        </div>
      )}

      {activeView === "contabilidad" && (
        <div key="v-cont" className="pv-view pv-bg" style={{ overflowY:"auto", flex:1 }}><ContabilidadView
          allData={allData} professionals={professionals} comisionPct={comisionPct}
          gastos={gastos} setGastos={setGastos}
          sueldos={sueldos} setSueldos={setSueldos}
          sueldoPeriod={sueldoPeriod} setSueldoPeriod={setSueldoPeriod}
          contPeriod={contPeriod} setContPeriod={setContPeriod}
          contFrom={contFrom} setContFrom={setContFrom}
          contTo={contTo} setContTo={setContTo}
          gastoModal={gastoModal} setGastoModal={setGastoModal}
          gastoForm={gastoForm} setGastoForm={setGastoForm}
          editGastoId={editGastoId} setEditGastoId={setEditGastoId}
        /></div>
      )}

      {activeView === "config" && <div key="v-cfg" className="pv-view pv-bg" style={{ overflowY:"auto", flex:1 }}><ConfigView config={config} setConfig={setConfig} /></div>}
      {activeView === "clientes" && <div key="v-cli" className="pv-view pv-bg" style={{ overflowY:"auto", flex:1 }}><ClientesView clientes={clientes} setClientes={setClientes} allData={allData} /></div>}


      {/* Bottom nav (mobile) */}

      <AppModals
        modal={modal} setModal={setModal}
        payModal={payModal} setPayModal={setPayModal}
        deleteKey={deleteKey} setDeleteKey={setDeleteKey}
        clientName={clientName} setClientName={setClientName}
        apptNotes={apptNotes} setApptNotes={setApptNotes}
        apptTip={apptTip} setApptTip={setApptTip}
        clientes={clientes} setClientes={setClientes}
        chosenServices={chosenServices} setChosenServices={setChosenServices}
        filterCat={filterCat} setFilterCat={setFilterCat}
        searchTerm={searchTerm} setSearchTerm={setSearchTerm}
        paymentSplits={paymentSplits} setPaymentSplits={setPaymentSplits}
        professionals={professionals}
        services={services} filteredServices={filteredServices}
        saveAppt={saveAppt} confirmPay={confirmPay} doDelete={doDelete}
        addSplit={addSplit} removeSplit={removeSplit} updateSplit={updateSplit}
        toggleService={toggleService} removeService={removeService}
        modalSubtotal={modalSubtotal} modalDuration={modalDuration}
        appointments={appointments}
      />
      </div>{/* end main-content */}
      <nav className="bottom-nav" style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
        flexShrink: 0,
        justifyContent: "space-around", alignItems: "stretch",
        background: C.white, borderTop: `2px solid ${C.greenMint}`,
        height: 62, boxShadow: "0 -4px 20px rgba(58,125,68,.10)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}>
        {[
          { id: "turnos",       icon: "📅", label: "Turnos" },
          { id: "contabilidad", icon: "📊", label: "Contab." },
          { id: "clientes",     icon: "👥", label: "Clientes" },
          { id: "config",       icon: "⚙️", label: "Config" },
        ].map(v => (
          <button key={v.id} onClick={() => { setActiveView(v.id); setCalendarOpen(false) }} style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 2, border: "none", background: "transparent", cursor: "pointer", padding: "6px 4px",
            color: activeView === v.id ? C.green : C.textSoft, position: "relative",
          }}>
            {activeView === v.id && (
              <div style={{ position: "absolute", top: 0, left: "20%", right: "20%", height: 3, borderRadius: "0 0 3px 3px", background: C.green }} />
            )}
            <div style={{ fontSize: 20 }}>{v.icon}</div>
            <div style={{ fontSize: 9, letterSpacing: "1px", textTransform: "uppercase", fontFamily: "Georgia,serif", fontWeight: activeView === v.id ? "bold" : "normal" }}>{v.label}</div>
          </button>
        ))}
      </nav>
    </div>
  )
}
