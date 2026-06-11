import { useState, useRef, useCallback, useMemo, useEffect } from "react"
import { C } from "./constants/colors.js"
import { PAYMENT_METHODS, HOURS } from "./constants/data.js"
import { cellKey, apptTotal, apptDur, apptPaidTotal, apptComisionableTotal } from "./utils/appointments.js"
import { toDateKey, todayKey, isWorkDay, nextWorkDay, addMonths } from "./utils/dates.js"
import { useIsMobile } from "./hooks/useIsMobile.js"
import { usePersistentState } from "./hooks/usePersistentState.js"
import { AppHeader } from "./components/header/AppHeader.jsx"
import { DateNav } from "./components/grid/DateNav.jsx"
import { AppGrid } from "./components/grid/AppGrid.jsx"
import { AppModals } from "./components/modals/AppModals.jsx"
import { ArqueoModal } from "./components/modals/ArqueoModal.jsx"
import ContabilidadView from "./components/views/ContabilidadView.jsx"
import ConfigView from "./components/views/ConfigView.jsx"
import ClientesView from "./components/views/ClientesView.jsx"
import Login from "./components/Login.jsx"
import { Overlay, ModalHeader, Field, GhostBtn, SolidBtn, inputStyle, modalBox } from "./components/ui/index.jsx"

const CELL_H = 100

const playClickSound = () => {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    
    const play = () => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = "sine"
      osc.frequency.setValueAtTime(700, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(1300, ctx.currentTime + 0.06)
      gain.gain.setValueAtTime(0.04, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.06)
    }

    if (ctx.state === 'suspended') {
      ctx.resume().then(play).catch(e => console.warn(e))
    } else {
      play()
    }
  } catch (e) {
    console.warn(e)
  }
}


function getRamaEmoji(rama) {
  const r = String(rama).toLowerCase().trim()
  if (r.includes("mano") || r.includes("uña") || r.includes("nail")) return "💅"
  if (r.includes("pie") || r.includes("pedi")) return "🦶"
  if (r.includes("pelo") || r.includes("peluquer") || r.includes("hair")) return "💇‍♀️"
  if (r.includes("estet") || r.includes("spa") || r.includes("facial") || r.includes("body")) return "🧴"
  if (r.includes("ceja") || r.includes("pestana") || r.includes("pestaña") || r.includes("ojo") || r.includes("lash")) return "👁️"
  return "✨"
}

export default function App() {
  const isMobile = useIsMobile()
  const [privacyMode, setPrivacyMode] = useState(false)
  const [arqueoModal, setArqueoModal] = useState(false)
  const [billCounts, setBillCounts] = useState({
    100: 0,
    200: 0,
    500: 0,
    1000: 0,
    2000: 0,
    10000: 0,
    20000: 0
  })
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



  const [currentDate, setCurrentDate] = useState(() => {
    const d = new Date()
    if (!isWorkDay(d)) d.setDate(d.getDate() + 1)
    return toDateKey(d)
  })

  const {
    loaded, saveStatus, connStatus,
    allData, setAppointments,
    gastos, setGastos,
    sueldos, setSueldos,
    config, setConfig,
    clientes, setClientes,
    remoteEdits, broadcastEditing
  } = usePersistentState(currentDate)

  const [activeRama, setActiveRama] = useState("manos")
  const ramas = useMemo(() => {
    // Extract unique normalized ramas from professionals + custom branches in config
    const profRamas = config?.professionals 
      ? config.professionals.map(p => String(p.rama || "manos").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""))
      : ["manos"]
    const customRamas = (config?.customRamas || []).map(r => String(r || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""))
    
    const list = Array.from(new Set([
      ...profRamas,
      ...customRamas
    ])).filter(Boolean)
    
    return list.length ? list : ["manos"]
  }, [config.professionals, config.customRamas])

  useEffect(() => {
    const normalized = String(activeRama).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    if (!ramas.includes(normalized)) {
      setActiveRama(ramas[0] || "manos")
    }
  }, [ramas, activeRama])

  const [calendarOpen, setCalendarOpen] = useState(false)
  const [calViewDate, setCalViewDate] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  })

  useEffect(() => {
    if (calendarOpen) {
      const d = new Date()
      setCalViewDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
    }
  }, [calendarOpen])

  const [activeView, setActiveView] = useState("turnos")
  const [contPeriod, setContPeriod] = useState("mes")
  const [contFrom, setContFrom] = useState("")
  const [contTo, setContTo] = useState("")
  const [gastoModal, setGastoModal] = useState(false)
  const [gastoForm, setGastoForm] = useState({ descripcion: "", monto: "", categoria: "insumos", fecha: todayKey(), isFixed: false })
  const [editGastoId, setEditGastoId] = useState(null)
  
  const [quickGastoModal, setQuickGastoModal] = useState(false)
  const [quickGastoForm, setQuickGastoForm] = useState({ descripcion: "", monto: "", metodoPago: "efectivo", tipo: "gasto" })
  const descRef = useRef(null)
  const montoRef = useRef(null)

  useEffect(() => {
    if (quickGastoModal) {
      setQuickGastoForm({ descripcion: "", monto: "", metodoPago: "efectivo", tipo: "gasto" })
      setTimeout(() => descRef.current?.focus(), 50)
    }
  }, [quickGastoModal])

  const handleQuickGastoSave = () => {
    if (!quickGastoForm.monto) return
    const isIngreso = quickGastoForm.tipo === "ingreso"
    const parsedMonto = Math.abs(parseFloat(quickGastoForm.monto) || 0)
    const finalMonto = isIngreso ? String(-parsedMonto) : String(parsedMonto)
    setGastos(p => [...p, {
      id: Date.now(),
      descripcion: quickGastoForm.descripcion || (isIngreso ? "Entrada" : "Salida"),
      monto: finalMonto,
      categoria: isIngreso ? "ingreso" : "otros",
      fecha: currentDate,
      metodoPago: quickGastoForm.metodoPago,
      tipo: quickGastoForm.tipo || "gasto"
    }])
    setQuickGastoModal(false)
  }

  const handleMontoKeyDown = (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setQuickGastoForm(p => ({ ...p, monto: String((parseFloat(p.monto) || 0) + 1000) }))
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setQuickGastoForm(p => ({ ...p, monto: String(Math.max(0, (parseFloat(p.monto) || 0) - 1000)) }))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      handleQuickGastoSave()
    }
  }

  const handleMontoWheel = (e) => {
    if (e.deltaY < 0) {
      setQuickGastoForm(p => ({ ...p, monto: String((parseFloat(p.monto) || 0) + 1000) }))
    } else if (e.deltaY > 0) {
      setQuickGastoForm(p => ({ ...p, monto: String(Math.max(0, (parseFloat(p.monto) || 0) - 1000)) }))
    }
  }
  const [sueldoPeriod, setSueldoPeriod] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  })

  const [modal, setModal] = useState(null)
  const [payModal, setPayModal] = useState(null)
  const [deleteKey, setDeleteKey] = useState(null)
  const [clientName, setClientName] = useState("")
  const [chosenServices, setChosenServices] = useState([])
  const [filterCat, setFilterCat] = useState("all")
  const [apptNotes, setApptNotes] = useState("")
  const [apptTip, setApptTip] = useState({})
  const [apptDiscount, setApptDiscount] = useState("")
  const [paymentSplits, setPaymentSplits] = useState([])
  const [searchTerm, setSearchTerm] = useState("")
  const [multiPayKeys, setMultiPayKeys] = useState([])

  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase()
      if (activeTag === "input" || activeTag === "textarea" || document.activeElement?.isContentEditable) {
        return
      }

      if (e.key?.toLowerCase() === 'h') {
        e.preventDefault()
        const tKey = todayKey()
        const isAlreadyToday = currentDate === tKey
        
        if (isAlreadyToday && ramas && ramas.length > 1) {
          const currIdx = ramas.findIndex(r => String(r).trim().toLowerCase() === String(activeRama).trim().toLowerCase())
          const nextIdx = (currIdx + 1) % ramas.length
          setActiveRama(ramas[nextIdx])
        } else {
          setCurrentDate(tKey)
        }
        
        playClickSound()
        
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("scroll-to-today-hour"))
        }, isAlreadyToday ? 50 : 250)
      } else if (e.key?.toLowerCase() === 'v') {
        e.preventDefault()
        setPrivacyMode(p => !p)
      } else if (e.key?.toLowerCase() === 'a') {
        e.preventDefault()
        setArqueoModal(p => !p)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setCurrentDate(d => nextWorkDay(d, -1))
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        setCurrentDate(d => nextWorkDay(d, 1))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentDate, setCurrentDate, activeRama, setActiveRama, ramas])

  useEffect(() => {
    const handleWakeUp = () => {
      const tKey = todayKey()
      if (currentDate !== tKey) {
        setCurrentDate(tKey)
      }
    }
    window.addEventListener("focus", handleWakeUp)
    document.addEventListener("visibilitychange", handleWakeUp)
    return () => {
      window.removeEventListener("focus", handleWakeUp)
      document.removeEventListener("visibilitychange", handleWakeUp)
    }
  }, [currentDate, setCurrentDate])

  // Persist billCounts to localStorage keyed by currentDate
  useEffect(() => {
    const key = `vn_arqueo_${currentDate}`
    const saved = localStorage.getItem(key)
    if (saved) {
      try {
        setBillCounts(JSON.parse(saved))
      } catch (e) {
        setBillCounts({ 100: 0, 200: 0, 500: 0, 1000: 0, 2000: 0, 10000: 0, 20000: 0 })
      }
    } else {
      setBillCounts({ 100: 0, 200: 0, 500: 0, 1000: 0, 2000: 0, 10000: 0, 20000: 0 })
    }
  }, [currentDate])

  useEffect(() => {
    const key = `vn_arqueo_${currentDate}`
    const hasValues = Object.values(billCounts).some(v => v > 0)
    if (hasValues) {
      localStorage.setItem(key, JSON.stringify(billCounts))
    } else {
      if (localStorage.getItem(key)) {
        localStorage.removeItem(key)
      }
    }
  }, [billCounts, currentDate])

  useEffect(() => {
    if (payModal) {
      const appt = appointments[payModal]
      if (appt?.paid && appt.payGroupId) {
        // Reconstruct the whole payment group
        const groupKeys = Object.entries(appointments)
          .filter(([_, a]) => a.payGroupId === appt.payGroupId)
          .map(([k]) => k)
        
        setMultiPayKeys(groupKeys)

        // Sum up splits, tips and discounts to show the "Total" in the UI
        const combinedSplits = {}
        let totalTip = 0
        let totalDiscount = 0

        groupKeys.forEach(k => {
          const a = appointments[k]
          totalTip += (a.tip || 0)
          totalDiscount += (a.discount || 0)
          ;(a.paymentSplits || []).forEach(s => {
            combinedSplits[s.methodId] = (combinedSplits[s.methodId] || 0) + (parseFloat(s.amount) || 0)
          })
        })

        const finalSplits = Object.entries(combinedSplits).map(([methodId, amount]) => ({
          methodId,
          amount: Math.round(amount).toString()
        }))

        setPaymentSplits(finalSplits.length ? finalSplits : [{ methodId: "efectivo", amount: "" }])
        
        const tipsMap = {}
        groupKeys.forEach(k => {
          const a = appointments[k]
          tipsMap[k] = a.tip > 0 ? Math.round(a.tip).toString() : ""
        })
        setApptTip(tipsMap)

        setApptDiscount(totalDiscount > 0 ? Math.round(totalDiscount).toString() : "")
      } else {
        const total = apptTotal(appt)
        setMultiPayKeys([payModal])
        setPaymentSplits([{ methodId: "efectivo", amount: total.toString() }])
        setApptTip({ [payModal]: "" })
        setApptDiscount("")
      }
    } else {
      setMultiPayKeys([])
      setPaymentSplits([])
      setApptTip({})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payModal])

  const lastModalKey = useRef(null)
  useEffect(() => {
    if (modal) {
      const k = modal.editKey || cellKey(modal.profId, modal.hour)
      broadcastEditing(k, true)
      lastModalKey.current = k
    } else if (lastModalKey.current) {
      broadcastEditing(lastModalKey.current, false)
      lastModalKey.current = null
    }
  }, [modal])

  const [draggingKey, setDraggingKey] = useState(null)
  const [dropTarget, setDropTarget] = useState(null)
  const [dropValid, setDropValid] = useState(false)
  const [resizePreview, setResizePreview] = useState(null)
  const dragNode = useRef(null)
  const resizeRef = useRef(null)


  const professionals = useMemo(() => {
    const activeLower = String(activeRama).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    return config.professionals.filter(p => String(p.rama || "manos").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === activeLower)
  }, [config.professionals, activeRama])
  const services = config.services
  const comisionPct = config.comisionPct

  const appointments = allData[currentDate] || {}

  // ── Memoized so drag state changes don't re-render header ──────────────────
  const allProfsMap = useMemo(() => new Set(config.professionals.map(p => p.id)), [config.professionals])
  const paidAppts = useMemo(
    () => Object.values(appointments).filter(a => a.paid && allProfsMap.has(a.profId)),
    [appointments, allProfsMap]
  )
  const totalByProf = useCallback((pId) => paidAppts.filter(a => a.profId === pId).reduce((s, a) => s + apptPaidTotal(a), 0), [paidAppts])
  const comisionableByProf = useCallback((pId) => paidAppts.filter(a => a.profId === pId).reduce((s, a) => s + apptComisionableTotal(a), 0), [paidAppts])
  const earningsByProf = useCallback((pId) => comisionableByProf(pId) * (comisionPct / 100), [comisionableByProf, comisionPct])
  const totalByMethod = useCallback((mid) => {
    const base = paidAppts.reduce((s, a) => {
      if (a.paymentSplits?.length) {
        const split = a.paymentSplits.find(r => r.methodId === mid)
        return s + (split ? parseFloat(split.amount) || 0 : 0)
      }
      return s + (a.payMethod === mid ? apptPaidTotal(a) : 0)
    }, 0)
    if (mid === "efectivo") {
      const releasedTips = paidAppts.reduce((s, a) => s + (a.tipReleased ? (a.tip || 0) : 0), 0)
      const cashGastos = (gastos || [])
        .filter(g => g.fecha === currentDate && g.metodoPago === "efectivo")
        .reduce((sum, g) => sum + (parseFloat(g.monto) || 0), 0)
      return Math.max(0, base - releasedTips - cashGastos)
    }
    return base
  }, [paidAppts, gastos, currentDate])
  const grandTotal = useMemo(() => {
    return totalByMethod("efectivo") + totalByMethod("debito") + totalByMethod("mercadopago")
  }, [totalByMethod])
  const grandEarnings = useMemo(() => config.professionals.reduce((s, p) => s + earningsByProf(p.id), 0), [config.professionals, earningsByProf])

  const serviceCounts = useMemo(() => {
    const counts = {}
    Object.values(allData || {}).forEach(dayData => {
      Object.values(dayData).forEach(appt => {
        ;(appt.services || []).forEach(sv => {
          counts[sv.id] = (counts[sv.id] || 0) + 1
        })
      })
    })
    return counts
  }, [allData])

  const modalProf = modal?.profId ? config.professionals.find(p => p.id === modal.profId) : null
  const modalProfRama = String(modalProf?.rama || "manos").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")

  const filteredServices = services
    .filter(s => String(s.rama || "manos").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === modalProfRama)
    .filter(s => (filterCat === "all" || s.category === filterCat) && s.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => (serviceCounts[b.id] || 0) - (serviceCounts[a.id] || 0))
  const modalSubtotal = chosenServices.reduce((s, sv) => s + sv.price, 0)
  const modalDuration = chosenServices.reduce((s, sv) => s + sv.duration, 0)

  const isOccupied = useCallback((profId, hour, ignoreKey = null) => {
    if (appointments[cellKey(profId, hour)] && cellKey(profId, hour) !== ignoreKey) return true
    for (const [k, a] of Object.entries(appointments)) {
      if (k === ignoreKey) continue
      const [pid, h] = k.split("||")
      if (parseInt(pid) !== profId) continue
      const startIdx = HOURS.indexOf(h)
      const requestedSlots = a.manualSlots ?? Math.ceil(apptDur(a) / 30)

      let actualSlots = requestedSlots
      for (let s = 1; s < requestedSlots; s++) {
        const checkHour = HOURS[startIdx + s]
        if (!checkHour) { actualSlots = s; break }
        const checkKey = cellKey(profId, checkHour)
        if (appointments[checkKey] && checkKey !== ignoreKey) {
          actualSlots = s
          break
        }
      }

      const targetIdx = HOURS.indexOf(hour)
      if (targetIdx > startIdx && targetIdx < startIdx + actualSlots) {
        return true
      }
    }
    return false
  }, [appointments])

  const canDrop = useCallback((dragKey, targetProfId, targetHour) => {
    const a = appointments[dragKey]
    if (!a) return false
    const idx = HOURS.indexOf(targetHour)
    if (idx < 0) return false
    return !isOccupied(targetProfId, targetHour, dragKey)
  }, [appointments, isOccupied])

  const spanOf = (profId, hour) => {
    const k = cellKey(profId, hour)
    const a = appointments[k]
    if (!a) return null
    if (resizePreview?.key === k) return resizePreview.slots

    const requestedSlots = a.manualSlots ?? Math.max(1, Math.ceil(apptDur(a) / 30))
    const startIdx = HOURS.indexOf(hour)
    let actualSlots = requestedSlots

    for (let s = 1; s < requestedSlots; s++) {
      const checkHour = HOURS[startIdx + s]
      if (!checkHour) { actualSlots = s; break }
      const checkKey = cellKey(profId, checkHour)
      if (appointments[checkKey]) {
        actualSlots = s
        break
      }
    }
    return actualSlots
  }

  const onDragStart = (e, key) => { setDraggingKey(key); dragNode.current = key; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", key) }
  const onDragEnd = () => { setDraggingKey(null); setDropTarget(null); setDropValid(false); dragNode.current = null }
  const onDragLeave = () => { setDropTarget(null); setDropValid(false) }
  const onDragOver = (e, profId, hour) => {
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
    const appt = appointments[key]
    const origHourIdx = HOURS.indexOf(appt.hour)
    const origSlots = Math.max(1, Math.ceil(apptDur(appt) / 30))
    resizeRef.current = { key, edge, startY: e.clientY, origHourIdx, origSlots, profId: appt.profId }
    setResizePreview({ key, hourIdx: origHourIdx, slots: origSlots, deltaY: 0, edge, origSlots, origHourIdx, profId: appt.profId })
    const onMove = (ev) => {
      const r = resizeRef.current; if (!r) return
      const delta = Math.round((ev.clientY - r.startY) / CELL_H)

      // Calculate desired slots
      let hourIdx, slots
      if (r.edge === "bottom") {
        hourIdx = r.origHourIdx
        slots = Math.min(Math.max(1, r.origSlots + delta), HOURS.length - r.origHourIdx)
      } else {
        hourIdx = Math.max(0, Math.min(r.origHourIdx + delta, r.origHourIdx + r.origSlots - 1))
        slots = Math.max(1, r.origSlots - (hourIdx - r.origHourIdx))
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
        slots = Math.max(1, r.origSlots - (hourIdx - r.origHourIdx))
      }

      setResizePreview({ key: r.key, hourIdx, slots, deltaY: ev.clientY - r.startY, edge: r.edge, origSlots: r.origSlots, origHourIdx: r.origHourIdx, profId: r.profId })
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

  const saveAppt = (extraParams = {}) => {
    if (!clientName.trim()) return
    const { profId, hour, editKey } = modal
    const k = editKey || cellKey(profId, hour)
    const prev = appointments[editKey] || {}
    setAppointments(p => {
      const next = { ...p }
      if (editKey && editKey !== k) delete next[editKey]
      next[k] = {
        profId,
        hour,
        client: clientName.trim(),
        services: extraParams.isNote ? [] : chosenServices,
        notes: extraParams.isNote ? "" : apptNotes.trim(),
        paid: prev.paid || false,
        payMethod: prev.payMethod || null,
        tip: parseFloat(apptTip[editKey || k]) || 0,
        ...extraParams
      }
      return next
    })
    setModal(null)
  }

  const quickBlock = (profId, hour, slots = 1, reason = "BLOQUEADO") => {
    const k = cellKey(profId, hour)
    setAppointments(p => ({
      ...p,
      [k]: {
        profId, hour,
        client: reason,
        services: [],
        notes: "",
        paid: false,
        isBlocked: true,
        manualSlots: slots,
        manualDur: slots * 30
      }
    }))
  }

  const confirmPay = () => {
    const keys = multiPayKeys
    const totalToPay = keys.reduce((sum, k) => sum + apptTotal(appointments[k]), 0)
    const tipAmount = Object.values(apptTip || {}).reduce((sum, v) => sum + (parseFloat(v) || 0), 0)
    const discountAmount = parseFloat(apptDiscount) || 0
    const validSplits = paymentSplits.filter(r => r.methodId && r.amount !== "" && !isNaN(parseFloat(r.amount)))
    const totalAmountPaid = validSplits.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0)
    const isUnpaying = totalAmountPaid === 0

    // Create or reuse a group ID to keep these appointments linked
    const existingGid = keys.map(k => appointments[k]?.payGroupId).find(g => !!g)
    const gid = existingGid || Date.now()

    // 1. Calcular los totales esperados (servicio - descuento + propina específica) para cada turno
    const expectedTotals = {}
    let grandExpectedTotal = 0

    keys.forEach(k => {
      const appt = appointments[k]
      if (!appt) return
      const apptBase = apptTotal(appt)
      const ratio = totalToPay > 0 ? apptBase / totalToPay : 1 / keys.length
      const discount = Math.round(discountAmount * ratio)
      const tip = parseFloat(apptTip[k]) || 0
      
      const expected = Math.max(0, apptBase - discount + tip)
      expectedTotals[k] = expected
      grandExpectedTotal += expected
    })

    setAppointments(p => {
      const next = { ...p }
      keys.forEach(k => {
        const appt = next[k]
        if (!appt) return
        
        if (isUnpaying) {
          next[k] = {
            ...appt,
            paid: false,
            payGroupId: undefined,
            payMethod: undefined,
            paymentSplits: undefined,
            tip: undefined,
            discount: undefined
          }
          return
        }

        const apptBase = apptTotal(appt)
        const ratio = totalToPay > 0 ? apptBase / totalToPay : 1 / keys.length
        
        // Usamos el ratio esperado que incluye la propina específica para dividir los métodos de pago
        const expectedRatio = grandExpectedTotal > 0 ? expectedTotals[k] / grandExpectedTotal : ratio

        next[k] = {
          ...appt,
          paid: true,
          payGroupId: gid,
          payMethod: validSplits[0]?.methodId || "efectivo",
          paymentSplits: validSplits.map(s => ({ ...s, amount: Math.round((parseFloat(s.amount) || 0) * expectedRatio) })),
          tip: parseFloat(apptTip[k]) || 0,
          discount: Math.round(discountAmount * ratio)
        }
      })
      return next
    })
    setPayModal(null)
  }

  const addSplit = () => {
    const usedMids = paymentSplits.map(r => r.methodId)
    const avail = PAYMENT_METHODS.find(m => !usedMids.includes(m.id))
    if (!avail) return
    setPaymentSplits(p => [...p, { methodId: avail.id, amount: "" }])
  }
  const removeSplit = (idx) => setPaymentSplits(p => p.filter((_, i) => i !== idx))
  const updateSplit = (idx, field, value) => setPaymentSplits(p => p.map((r, i) => i === idx ? { ...r, [field]: value } : r))

  const doDelete = () => { setAppointments(p => { const n = { ...p }; delete n[deleteKey]; return n }); setDeleteKey(null) }

  const onToggleTipsRelease = useCallback((profId, shouldRelease) => {
    setAppointments(prev => {
      const next = { ...prev }
      Object.entries(next).forEach(([key, appt]) => {
        if (appt && appt.profId === profId && appt.paid && (appt.tip || 0) > 0) {
          next[key] = {
            ...appt,
            tipReleased: shouldRelease
          }
        }
      })
      return next
    })
  }, [])

  // Show loading only on very first load, not on session changes
  if (!loaded) {
    const isPremium = config?.premiumLoading ?? true
    return (
      <div style={{ position: "fixed", inset: 0, background: C.cream, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
        {isPremium ? (
          <>
            {/* Background Animated Gradient Blobs */}
            <div style={{ position: "absolute", top: "-10%", left: "-10%", width: "50vw", height: "50vw", minWidth: 350, minHeight: 350, borderRadius: "50%", background: "rgba(58,125,68,0.25)", filter: "blur(80px)", animation: "float1 12s infinite alternate ease-in-out" }} />
            <div style={{ position: "absolute", bottom: "-10%", right: "-10%", width: "60vw", height: "60vw", minWidth: 400, minHeight: 400, borderRadius: "50%", background: "rgba(232,121,58,0.22)", filter: "blur(90px)", animation: "float2 15s infinite alternate ease-in-out" }} />
            <div style={{ position: "absolute", top: "35%", left: "25%", width: "45vw", height: "45vw", minWidth: 300, minHeight: 300, borderRadius: "50%", background: "rgba(200,134,10,0.18)", filter: "blur(70px)", animation: "float3 14s infinite alternate ease-in-out" }} />

            {/* Apple Frosted Glass Layer */}
            <div style={{ position: "absolute", inset: 0, background: "rgba(255, 255, 255, 0.42)", backdropFilter: "blur(40px) saturate(190%)", WebkitBackdropFilter: "blur(40px) saturate(190%)", zIndex: 2 }} />

            {/* Main Elegant Card */}
            <div style={{ position: "relative", zIndex: 3, display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "36px 48px", borderRadius: 28, background: "rgba(255, 255, 255, 0.65)", border: "1px solid rgba(255, 255, 255, 0.7)", boxShadow: "0 16px 40px rgba(58,125,68,0.06)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", animation: "fadeIn 0.6s ease" }}>
              {/* Pulsing Logo Sphere */}
              <div style={{ width: 90, height: 90, borderRadius: "50%", background: "#fff", border: `2px solid ${C.greenMint}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", boxShadow: `0 8px 30px rgba(58,125,68,0.12)`, animation: "pulsePulse 2.2s infinite ease-in-out" }}>
                <img src="/logo.png" alt="Verde Naranja" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              
              {/* Elegant typography */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                <span style={{ fontSize: 9, letterSpacing: "3px", color: C.orange, textTransform: "uppercase", fontWeight: "bold" }}>Diario de Trabajo</span>
                <span style={{ fontSize: 18, color: C.green, letterSpacing: "1.5px", fontWeight: "bold", fontFamily: "Georgia, serif" }}>VERDE NARANJA</span>
              </div>

              {/* Small Spinner indicator */}
              <div style={{ width: 18, height: 18, border: `2px solid ${C.green}20`, borderTop: `2px solid ${C.green}`, borderRadius: "50%", animation: "spin 0.8s linear infinite", marginTop: 8 }} />
            </div>
          </>
        ) : (
          /* Simple Loading Screen */
          <div style={{ width: 84, height: 84, borderRadius: "50%", background: "#fff", border: `2px solid ${C.greenMint}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", boxShadow: `0 10px 30px rgba(58,125,68,.15)`, animation: "spin 1.8s linear infinite", zIndex: 3 }}>
            <img src="/logo.png" alt="Cargando..." style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        )}

        <style>{`
          @keyframes float1 {
            0% { transform: translate(0, 0) scale(1); }
            100% { transform: translate(80px, 50px) scale(1.15); }
          }
          @keyframes float2 {
            0% { transform: translate(0, 0) scale(1.1); }
            100% { transform: translate(-70px, -60px) scale(0.9); }
          }
          @keyframes float3 {
            0% { transform: translate(0, 0) scale(0.95); }
            100% { transform: translate(-40px, 40px) scale(1.1); }
          }
          @keyframes pulsePulse {
            0%, 100% { transform: scale(1); box-shadow: 0 8px 30px rgba(58,125,68,0.12); }
            50% { transform: scale(1.05); box-shadow: 0 12px 40px rgba(58,125,68,0.22); }
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  if (!session) return <Login onLogin={handleLogin} />

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: C.cream, fontFamily: "'Georgia','Times New Roman',serif", color: C.text, userSelect: draggingKey ? "none" : "auto" }}>
      <AppHeader
        config={config} activeView={activeView}
        onLogout={handleLogout}
        setActiveView={(v) => { setActiveView(v); setCalendarOpen(false) }}
        saveStatus={saveStatus} connStatus={connStatus} totalByMethod={totalByMethod}
        grandTotal={grandTotal} grandEarnings={grandEarnings}
        currentDate={currentDate} setCurrentDate={setCurrentDate}
        calendarOpen={calendarOpen} setCalendarOpen={setCalendarOpen}
        calViewDate={calViewDate} setCalViewDate={setCalViewDate}
        allData={allData}
        onQuickGasto={() => setQuickGastoModal(true)}
        professionals={professionals}
        activeRama={activeRama}
        setActiveRama={setActiveRama}
        ramas={ramas}
        privacyMode={privacyMode}
      />
      <div className="main-content" style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>

        {activeView === "turnos" && (
          <div key="v-turnos" className="pv-view pv-bg" style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", paddingBottom: 0 }}>
            <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              {(draggingKey || resizePreview) && (
                <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: resizePreview ? "rgba(58,125,68,.92)" : dropTarget ? (dropValid ? "rgba(58,125,68,.92)" : "rgba(200,60,60,.88)") : "rgba(40,40,40,.82)", color: "#fff", borderRadius: 30, padding: "8px 22px", fontSize: 12, letterSpacing: "1px", zIndex: 300, boxShadow: "0 4px 20px rgba(0,0,0,.25)", pointerEvents: "none" }}>
                  {resizePreview ? "↕ Soltá para confirmar" : dropTarget ? (dropValid ? "✅ Soltar para mover aquí" : "🚫 Horario ocupado") : "☝️ Arrastrá a un nuevo horario"}
                </div>
              )}

              <AppGrid
                professionals={professionals} appointments={appointments} isMobile={isMobile}
                config={config}
                draggingKey={draggingKey} dropTarget={dropTarget} dropValid={dropValid} resizePreview={resizePreview}
                remoteEdits={remoteEdits}
                isOccupied={isOccupied} spanOf={spanOf}
                onDragStart={onDragStart} onDragEnd={onDragEnd} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
                onResizeStart={onResizeStart}
                quickBlock={quickBlock}
                paidAppts={paidAppts} totalByProf={totalByProf} earningsByProf={earningsByProf} comisionPct={comisionPct}
                currentDate={currentDate}
                onCellClick={(profId, hour) => { setModal({ profId, hour, editKey: null }); setChosenServices([]); setClientName(""); setFilterCat("all"); setApptNotes(""); setApptTip({}) }}
                onEdit={(key, appt) => { setModal({ profId: appt.profId, hour: appt.hour, editKey: key }); setChosenServices([...(appt.services || [])]); setClientName(appt.client); setFilterCat("all"); setApptNotes(appt.notes || ""); setApptTip({ [key]: appt.tip ? appt.tip.toString() : "" }) }}
                onPay={(key) => { const a = appointments[key]; if (a?.paymentSplits?.length) setPaymentSplits(a.paymentSplits.map(s => ({ ...s }))); else setPaymentSplits([{ methodId: "efectivo", amount: Math.max(0, apptTotal(a) + (a.tip || 0) - (a.discount || 0)) }]); setApptTip({ [key]: a.tip ? a.tip.toString() : "" }); setApptDiscount(a.discount || ""); setPayModal(key) }}
                onDelete={(key) => setDeleteKey(key)}
                onToggleTipsRelease={onToggleTipsRelease}
                CELL_H={CELL_H}
                activeRama={activeRama}
              />
            </div>
          </div>
        )}

        {activeView === "contabilidad" && (
          <div key="v-cont" className="pv-view pv-bg" style={{ overflowY: "auto", flex: 1, paddingTop: 72 }}><ContabilidadView
            allData={allData} professionals={config.professionals} comisionPct={comisionPct}
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

        {activeView === "config" && <div key="v-cfg" className="pv-view pv-bg" style={{ overflowY: "auto", flex: 1, paddingTop: 72 }}><ConfigView config={config} setConfig={setConfig} allData={allData} gastos={gastos} sueldos={sueldos} clientes={clientes} onLogout={handleLogout} /></div>}
        {activeView === "clientes" && <div key="v-cli" className="pv-view pv-bg" style={{ overflowY: "auto", flex: 1, paddingTop: 72 }}><ClientesView clientes={clientes} setClientes={setClientes} allData={allData} /></div>}


        {/* Bottom nav (mobile) */}

        {quickGastoModal && (() => {
          const isIngreso = quickGastoForm.tipo === "ingreso"
          const accentColor = isIngreso ? C.green : C.orange
          return (
            <>
              <div onClick={() => setQuickGastoModal(false)} style={{ position: "fixed", inset: 0, zIndex: 299 }} />
              <div onClick={e => e.stopPropagation()} style={{ position: "fixed", bottom: 76, right: 12, width: 330, maxWidth: "92vw", zIndex: 300, background: "rgba(255, 255, 255, 0.65)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderRadius: 16, border: `1.5px solid rgba(205, 224, 208, 0.6)`, boxShadow: "0 12px 40px rgba(58,125,68,.18)", padding: "16px 20px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Close & Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 13, color: C.text, fontWeight: "bold", display: "flex", alignItems: "center", gap: 6 }}>
                    <span>{isIngreso ? "💰" : "💸"}</span> {isIngreso ? "Entrada Rápida" : "Salida Rápida"}
                  </div>
                  <button onClick={() => setQuickGastoModal(false)} style={{ background:"transparent", border:"none", cursor:"pointer", color:C.textSoft, fontSize:20, lineHeight: 1 }}>&times;</button>
                </div>

                {/* Tabs */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, background: "#f3f3f3", borderRadius: 10, padding: 3 }}>
                  <button 
                    onClick={() => setQuickGastoForm(p => ({ ...p, tipo: "gasto" }))} 
                    style={{
                      padding: "6px 0",
                      borderRadius: 8,
                      border: "none",
                      background: !isIngreso ? C.orange : "transparent",
                      color: !isIngreso ? "#fff" : C.textSoft,
                      fontWeight: "bold",
                      fontSize: 10,
                      cursor: "pointer",
                      transition: "all .15s",
                      fontFamily: "Georgia,serif"
                    }}
                  >
                    💸 Salida
                  </button>
                  <button 
                    onClick={() => setQuickGastoForm(p => ({ ...p, tipo: "ingreso" }))} 
                    style={{
                      padding: "6px 0",
                      borderRadius: 8,
                      border: "none",
                      background: isIngreso ? C.green : "transparent",
                      color: isIngreso ? "#fff" : C.textSoft,
                      fontWeight: "bold",
                      fontSize: 10,
                      cursor: "pointer",
                      transition: "all .15s",
                      fontFamily: "Georgia,serif"
                    }}
                  >
                    💰 Entrada
                  </button>
                </div>
                
                <div>
                  <input 
                    ref={descRef}
                    value={quickGastoForm.descripcion} 
                    onChange={e => setQuickGastoForm(p => ({ ...p, descripcion: e.target.value }))} 
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); montoRef.current?.focus() } }}
                    placeholder={isIngreso ? "Origen del ingreso (ej: Venta de crema)" : "Descripción (opcional)"} 
                    style={{ ...inputStyle, marginBottom: 8 }}
                  />
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: 10, top: 10, color: C.textSoft, fontWeight: "bold", fontSize: 14 }}>$</span>
                    <input 
                      ref={montoRef}
                      type="number" 
                      value={quickGastoForm.monto} 
                      onChange={e => setQuickGastoForm(p => ({ ...p, monto: e.target.value }))} 
                      onKeyDown={handleMontoKeyDown}
                      onWheel={handleMontoWheel}
                      placeholder="0" 
                      style={{ ...inputStyle, paddingLeft: 24 }}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                  {PAYMENT_METHODS.map(m => {
                    const isSelected = quickGastoForm.metodoPago === m.id
                    return (
                      <button key={m.id} onClick={() => setQuickGastoForm(p => ({ ...p, metodoPago: m.id }))} style={{ padding: "6px 4px", borderRadius: 8, border: `1.5px solid ${isSelected ? m.color : C.border}`, background: isSelected ? `${m.color}15` : C.white, color: isSelected ? m.color : C.textSoft, fontSize: 10, cursor: "pointer", fontFamily: "Georgia,serif", textAlign: "center", transition: "all .15s", fontWeight: isSelected ? "bold" : "normal" }}>
                        <div style={{ fontSize: 14, marginBottom: 2 }}>{m.icon}</div>
                        <div>{m.label}</div>
                      </button>
                    )
                  })}
                </div>

                <SolidBtn onClick={handleQuickGastoSave} disabled={!quickGastoForm.monto} color={accentColor} style={{ marginTop: 4 }}>
                  {isIngreso ? "✅ Guardar Entrada" : "✅ Guardar Salida"}
                </SolidBtn>
              </div>
            </>
          )
        })()}

        <AppModals
          modal={modal} setModal={setModal}
          payModal={payModal} setPayModal={setPayModal}
          deleteKey={deleteKey} setDeleteKey={setDeleteKey}
          clientName={clientName} setClientName={setClientName}
          apptNotes={apptNotes} setApptNotes={setApptNotes}
          apptTip={apptTip} setApptTip={setApptTip}
          apptDiscount={apptDiscount} setApptDiscount={setApptDiscount}
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
          allData={allData}
          multiPayKeys={multiPayKeys} setMultiPayKeys={setMultiPayKeys}
        />

        <ArqueoModal
          isOpen={arqueoModal}
          onClose={() => setArqueoModal(false)}
          currentDate={currentDate}
          gastos={gastos}
          totalByMethod={totalByMethod}
          paidAppts={paidAppts}
          billCounts={billCounts}
          setBillCounts={setBillCounts}
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
          { id: "turnos", icon: "📅", label: "Turnos" },
          { id: "contabilidad", icon: "📊", label: "Contab." },
          { id: "clientes", icon: "👥", label: "Clientes" },
          { id: "config", icon: "⚙️", label: "Config" },
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
