import { useState, useRef, useCallback, useMemo, useEffect } from "react"
import { C } from "./constants/colors.js"
import { PAYMENT_METHODS, HOURS, APP_VERSION, getModalOverlayStyle } from "./constants/data.js"
import { cellKey, apptTotal, apptDur, apptPaidTotal, apptComisionableTotal, apptComisionTotal, getApptSlots } from "./utils/appointments.js"
import { toDateKey, todayKey, isWorkDay, nextWorkDay, addMonths, DIAS_ES, MESES_ES } from "./utils/dates.js"
import { normalizeStr, formatWaNumber, generateRescheduleMessage, openWhatsAppLink } from "./utils/whatsapp.js"
import { useIsMobile } from "./hooks/useIsMobile.js"
import { usePersistentState } from "./hooks/usePersistentState.js"
import { AppHeader } from "./components/header/AppHeader.jsx"
import { DateNav } from "./components/grid/DateNav.jsx"
import { AppGrid } from "./components/grid/AppGrid.jsx"
import { AppModals } from "./components/modals/AppModals.jsx"
import { ArqueoModal } from "./components/modals/ArqueoModal.jsx"
import { NotebookModal } from "./components/modals/NotebookModal.jsx"
import { SearchTurnosModal } from "./components/modals/SearchTurnosModal.jsx"
import { RescheduleModal } from "./components/modals/RescheduleModal.jsx"
import { HistoryModal } from "./components/modals/HistoryModal.jsx"
import { getHistoryLog, addHistoryEntry, saveHistoryLog } from "./utils/history.js"
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
    allData, setAppointments, rescheduleAppointment, copyAppointment,
    allArqueos, setArqueo,
    gastos, setGastos,
    sueldos, setSueldos,
    config, setConfig,
    clientes, setClientes,
    todoTasks, setTodoTasks,
    remoteEdits, broadcastEditing,
    restoreBackup,
    deleteAppointment,
    restoreAppointment
  } = usePersistentState(currentDate)

  // Sincronizar variables CSS dinámicas para fondo, opacidad y desenfoque de modales
  useEffect(() => {
    const overlayStyle = getModalOverlayStyle(config)
    document.documentElement.style.setProperty("--modal-overlay-bg", overlayStyle.background)
    document.documentElement.style.setProperty("--modal-overlay-blur", overlayStyle.backdropFilter)
  }, [config?.modalTone, config?.modalOpacityLevel, config?.modalBlurLevel])

  const playPageSound = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const bufferSize = ctx.sampleRate * 0.4
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1
      }
      const noiseNode = ctx.createBufferSource()
      noiseNode.buffer = buffer

      const filter = ctx.createBiquadFilter()
      filter.type = "bandpass"
      filter.frequency.setValueAtTime(1000, ctx.currentTime)
      filter.frequency.exponentialRampToValueAtTime(1600, ctx.currentTime + 0.15)
      filter.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.4)
      filter.Q.setValueAtTime(3.0, ctx.currentTime)

      const gainNode = ctx.createGain()
      gainNode.gain.setValueAtTime(0.0, ctx.currentTime)
      gainNode.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.08)
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)

      noiseNode.connect(filter)
      filter.connect(gainNode)
      gainNode.connect(ctx.destination)

      noiseNode.start(ctx.currentTime)
      noiseNode.stop(ctx.currentTime + 0.4)
    } catch (e) {
      console.warn("Failed to play page sound:", e)
    }
  }

  const [notebookOpen, setNotebookOpen] = useState(false)
  const [searchTurnosOpen, setSearchTurnosOpen] = useState(false)
  const [historyModalOpen, setHistoryModalOpen] = useState(false)
  const [historyLog, setHistoryLog] = useState(getHistoryLog)
  const [undoToast, setUndoToast] = useState(null)
  const undoToastTimerRef = useRef(null)

  const showUndoToast = useCallback((message, onUndo, icon = "↩️") => {
    if (undoToastTimerRef.current) clearTimeout(undoToastTimerRef.current)
    setUndoToast({
      id: Date.now(),
      message,
      icon,
      onUndo
    })
    undoToastTimerRef.current = setTimeout(() => {
      setUndoToast(null)
    }, 6000)
  }, [])

  const recordHistory = useCallback((entry) => {
    const updated = addHistoryEntry(entry)
    setHistoryLog(updated)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignorar si hay modificadores presionados (Ctrl, Cmd, Alt) para evitar conflictos con atajos compuestos (ej. Ctrl+C)
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return
      }

      const activeEl = document.activeElement
      if (activeEl && (
        activeEl.tagName === "INPUT" || 
        activeEl.tagName === "TEXTAREA" || 
        activeEl.isContentEditable
      )) {
        return
      }

      const key = e.key.toLowerCase()
      if (key === "n") {
        e.preventDefault()
        playPageSound()
        setNotebookOpen(prev => !prev)
      } else if (key === "g") {
        e.preventDefault()
        setQuickGastoModal(true)
      } else if (key === "c") {
        e.preventDefault()
        setCalendarOpen(prev => !prev)
      } else if (key === "b") {
        e.preventDefault()
        setSearchTurnosOpen(prev => !prev)
      } else if (key === "h") {
        e.preventDefault()
        setHistoryModalOpen(prev => !prev)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const billCounts = allArqueos[currentDate] || { 100: 0, 200: 0, 500: 0, 1000: 0, 2000: 0, 10000: 0, 20000: 0 }
  const setBillCounts = setArqueo

  const [activeRama, setActiveRama] = useState("manos")
  const ramas = useMemo(() => {
    // Extract unique normalized ramas from active professionals + custom branches in config
    const activeProfs = (config?.professionals || []).filter(p => !p.deletedAt || currentDate < p.deletedAt)
    const profRamas = activeProfs.length > 0
      ? activeProfs.map(p => String(p.rama || "manos").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""))
      : (config?.professionals || []).map(p => String(p.rama || "manos").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""))
    const customRamas = (config?.customRamas || []).map(r => String(r || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""))
    
    const list = Array.from(new Set([
      ...profRamas,
      ...customRamas
    ])).filter(Boolean)
    
    return list.length ? list : ["manos"]
  }, [config.professionals, config.customRamas, currentDate])

  useEffect(() => {
    const normalized = String(activeRama).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    if (!ramas.includes(normalized)) {
      setActiveRama(ramas[0] || "manos")
    }
  }, [ramas, activeRama])

  const handleNavigateToTurno = useCallback(({ date, hour, profId, rama, openEdit }) => {
    setActiveView("turnos")
    setCalendarOpen(false)
    if (rama) {
      const normalizedTargetRama = String(rama).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      const foundRama = (ramas || []).find(r => String(r).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === normalizedTargetRama)
      if (foundRama) {
        setActiveRama(foundRama)
      }
    }
    if (date) {
      setCurrentDate(date)
    }
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("scroll-to-hour", { detail: { hour, profId } }))
      if (openEdit && date && profId && hour) {
        const key = cellKey(profId, hour)
        const appt = (allData[date] || {})[key]
        if (appt) {
          setModal({ profId, hour, editKey: key })
          setChosenServices([...(appt.services || [])])
          setClientName(appt.client || "")
          setFilterCat("all")
          setApptNotes(appt.notes || "")
          setApptTip({ [key]: appt.tip ? appt.tip.toString() : "" })
        }
      }
    }, date !== currentDate ? 300 : 80)
  }, [ramas, currentDate, allData])

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
  const [selectedMultiPayKeys, setSelectedMultiPayKeys] = useState([])
  const selectedMultiPayKeysRef = useRef([])
  selectedMultiPayKeysRef.current = selectedMultiPayKeys
  const multiPayPreloadRef = useRef(null)

  // ── Reprogramación de turnos (Opción 1) ───────────────────────────────────
  const [rescheduleData, setRescheduleData] = useState(null)
  const [rescheduleToast, setRescheduleToast] = useState(null)
  const rescheduleToastTimerRef = useRef(null)

  // ── Salto rápido de fecha con teclado numérico ─────────────────────────────
  const [dateQuickJump, setDateQuickJump] = useState(null)
  const dateNumberBufferRef = useRef("")
  const dateNumberTimerRef = useRef(null)
  const dateQuickJumpToastTimerRef = useRef(null)
  const currentDateRef = useRef(currentDate)
  currentDateRef.current = currentDate
  const activeViewRef = useRef(activeView)
  activeViewRef.current = activeView
  const isAnyModalOpenRef = useRef(false)
  isAnyModalOpenRef.current = Boolean(
    modal || payModal || deleteKey || gastoModal || quickGastoModal || arqueoModal || notebookOpen || searchTurnosOpen || historyModalOpen || calendarOpen || rescheduleData
  )

  const executeDateJump = useCallback((dayToJump) => {
    dateNumberBufferRef.current = ""
    if (dateNumberTimerRef.current) {
      clearTimeout(dateNumberTimerRef.current)
      dateNumberTimerRef.current = null
    }

    const curDate = currentDateRef.current
    const [yearStr, monthStr] = curDate.split("-")
    const year = parseInt(yearStr, 10)
    const month = parseInt(monthStr, 10)
    const daysInMonth = new Date(year, month, 0).getDate()
    const monthName = MESES_ES[month - 1]

    if (isNaN(dayToJump) || dayToJump < 1 || dayToJump > daysInMonth) {
      setDateQuickJump({
        title: `Día ${dayToJump} no válido`,
        sub: `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} tiene hasta ${daysInMonth} días`,
        error: true,
        isTyping: false
      })
      if (dateQuickJumpToastTimerRef.current) clearTimeout(dateQuickJumpToastTimerRef.current)
      dateQuickJumpToastTimerRef.current = setTimeout(() => setDateQuickJump(null), 1800)
      return
    }

    const d = new Date(year, month - 1, dayToJump, 12, 0, 0)
    let finalDateKey = toDateKey(d)
    const isSunday = !isWorkDay(d)
    if (isSunday) {
      d.setDate(d.getDate() + 1)
      finalDateKey = toDateKey(d)
    }

    const dayName = DIAS_ES[new Date(finalDateKey + "T12:00:00").getDay()]
    const finalDayNum = new Date(finalDateKey + "T12:00:00").getDate()
    const isToday = finalDateKey === todayKey()

    setDateQuickJump({
      title: isSunday
        ? `Domingo ${dayToJump} cerrado ➜ Lunes ${finalDayNum}`
        : `${dayName} ${dayToJump} de ${monthName}`,
      sub: isToday ? "Hoy" : `Fecha seleccionada: ${finalDayNum}/${month}`,
      badge: isToday ? "HOY" : isSunday ? "LUNES" : null,
      badgeBg: isToday ? C.greenPale : C.orangePale,
      badgeColor: isToday ? C.green : C.orange,
      error: false,
      isTyping: false
    })

    if (dateQuickJumpToastTimerRef.current) clearTimeout(dateQuickJumpToastTimerRef.current)
    dateQuickJumpToastTimerRef.current = setTimeout(() => setDateQuickJump(null), 1600)

    setCurrentDate(finalDateKey)
    playClickSound()

    if (isToday) {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("scroll-to-today-hour"))
      }, 100)
    }
  }, [setCurrentDate])

  const handleNumericDateInput = useCallback((digitChar) => {
    if (dateNumberTimerRef.current) {
      clearTimeout(dateNumberTimerRef.current)
      dateNumberTimerRef.current = null
    }

    let nextBuffer = dateNumberBufferRef.current + digitChar
    if (nextBuffer.length > 2) {
      nextBuffer = digitChar
    }
    dateNumberBufferRef.current = nextBuffer

    const numVal = parseInt(nextBuffer, 10)
    const curDate = currentDateRef.current
    const [yearStr, monthStr] = curDate.split("-")
    const year = parseInt(yearStr, 10)
    const month = parseInt(monthStr, 10)
    const daysInMonth = new Date(year, month, 0).getDate()
    const monthName = MESES_ES[month - 1]

    if (nextBuffer.length === 2) {
      setDateQuickJump({
        title: `Día ${numVal}`,
        sub: `Cambiando al día ${numVal} de ${monthName}...`,
        error: false,
        isTyping: true
      })
      dateNumberTimerRef.current = setTimeout(() => {
        executeDateJump(numVal)
      }, 150)
    } else if (nextBuffer.length === 1) {
      const isHighDigit = numVal >= 4
      const waitTime = isHighDigit ? 420 : 620

      setDateQuickJump({
        title: `Día ${numVal}...`,
        sub: numVal <= 3 ? `Podés escribir otro número (ej: ${numVal}5) o esperar...` : `Cambiando al día ${numVal} de ${monthName}...`,
        error: false,
        isTyping: true
      })

      dateNumberTimerRef.current = setTimeout(() => {
        executeDateJump(numVal)
      }, waitTime)
    }
  }, [executeDateJump])

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignorar combinaciones con modificadores (Ctrl, Cmd, Alt) para no interferir con atajos como Ctrl+V
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return
      }

      const activeTag = document.activeElement?.tagName?.toLowerCase()
      if (activeTag === "input" || activeTag === "textarea" || document.activeElement?.isContentEditable) {
        return
      }

      // Teclado numérico para saltar de fecha en la planilla de turnos (0-9)
      const isDigit = e.key >= '0' && e.key <= '9'
      const isEnter = e.key === 'Enter'
      const isCancel = e.key === 'Escape' || e.key === 'Backspace'

      if (isDigit || isEnter || isCancel) {
        if (!isAnyModalOpenRef.current && activeViewRef.current === "turnos" && !e.ctrlKey && !e.metaKey && !e.altKey) {
          if (isDigit) {
            e.preventDefault()
            handleNumericDateInput(e.key)
            return
          } else if (isEnter && dateNumberBufferRef.current) {
            e.preventDefault()
            if (dateNumberTimerRef.current) {
              clearTimeout(dateNumberTimerRef.current)
              dateNumberTimerRef.current = null
            }
            executeDateJump(parseInt(dateNumberBufferRef.current, 10))
            return
          } else if (isCancel && dateNumberBufferRef.current) {
            e.preventDefault()
            dateNumberBufferRef.current = ""
            if (dateNumberTimerRef.current) clearTimeout(dateNumberTimerRef.current)
            if (dateQuickJumpToastTimerRef.current) clearTimeout(dateQuickJumpToastTimerRef.current)
            setDateQuickJump(null)
            return
          }
        }
      }

      if (e.key === ' ' || e.code === 'Space') {
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

        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("scroll-to-today-hour"))
        }, isAlreadyToday ? 50 : 250)
        
        playClickSound()
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
  }, [currentDate, setCurrentDate, activeRama, setActiveRama, ramas, handleNumericDateInput, executeDateJump])

  // Actualiza dinámicamente el color de la barra de título de Windows (Verde en Hoy, Naranja en otra fecha)
  useEffect(() => {
    const isToday = currentDate === todayKey()
    const targetColor = isToday ? C.green : (C.orange || "#e8793a")
    const metaTheme = document.querySelector('meta[name="theme-color"]')
    if (metaTheme) {
      metaTheme.setAttribute("content", targetColor)
    }
  }, [currentDate])

  // Mantener el título de la ventana sincronizado con el nombre de la empresa y la versión actual
  useEffect(() => {
    document.title = `${config?.empresaNombre || "Perla Verde"} · Turnos · ${APP_VERSION}`
  }, [config?.empresaNombre])



  useEffect(() => {
    if (multiPayPreloadRef.current) {
      multiPayPreloadRef.current = null
      return
    }
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
  const [truncateToast, setTruncateToast] = useState(null)
  const truncateToastTimerRef = useRef(null)


  const appointments = allData[currentDate] || {}

  const professionals = useMemo(() => {
    const activeLower = String(activeRama).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    return (config?.professionals || []).filter(p => {
      const matchRama = String(p.rama || "manos").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === activeLower
      if (!matchRama) return false
      const isActiveOnDate = !p.deletedAt || currentDate < p.deletedAt
      const hasApptsOnDate = Object.values(appointments).some(a => a.profId === p.id && !a.isBlocked)
      return isActiveOnDate || hasApptsOnDate
    })
  }, [config.professionals, activeRama, currentDate, appointments])
  const services = config.services
  const comisionPct = config.comisionPct

  // ── Memoized so drag state changes don't re-render header ──────────────────
  const allProfsMap = useMemo(() => new Set(config.professionals.map(p => p.id)), [config.professionals])
  const paidAppts = useMemo(
    () => Object.values(appointments).filter(a => a.paid && allProfsMap.has(a.profId)),
    [appointments, allProfsMap]
  )
  const totalByProf = useCallback((pId) => paidAppts.filter(a => a.profId === pId).reduce((s, a) => s + apptPaidTotal(a), 0), [paidAppts])
  const comisionableByProf = useCallback((pId) => paidAppts.filter(a => a.profId === pId).reduce((s, a) => s + apptComisionableTotal(a, services), 0), [paidAppts, services])
  const earningsByProf = useCallback((pId) => paidAppts.filter(a => a.profId === pId).reduce((s, a) => s + apptComisionTotal(a, comisionPct, services, config.dateExceptions || {}, currentDate, config.professionals), 0), [paidAppts, comisionPct, services, config.dateExceptions, currentDate, config.professionals])
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
    .filter(s => (filterCat === "all" || s.category === filterCat) && s.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => (serviceCounts[b.id] || 0) - (serviceCounts[a.id] || 0))
  const modalSubtotal = chosenServices.reduce((s, sv) => s + sv.price, 0)
  const modalDuration = chosenServices.reduce((s, sv) => s + sv.duration, 0)

  const openMultiPay = useCallback((keys) => {
    if (!keys || !keys.length) return
    const validKeys = keys.filter(k => appointments[k] && !appointments[k].isBlocked && !appointments[k].isNote)
    if (!validKeys.length) return

    multiPayPreloadRef.current = validKeys
    const total = validKeys.reduce((s, k) => s + (appointments[k] ? apptTotal(appointments[k]) : 0), 0)
    setPaymentSplits([{ methodId: "efectivo", amount: total.toString() }])
    const tipsMap = {}
    validKeys.forEach(k => { tipsMap[k] = "" })
    setApptTip(tipsMap)
    setApptDiscount("")
    setMultiPayKeys(validKeys)
    setPayModal(validKeys[0])
  }, [appointments])

  const handleToggleSelectMultiPay = useCallback((key) => {
    const appt = appointments[key]
    if (!appt || appt.isBlocked || appt.isNote || appt.paid) return

    setSelectedMultiPayKeys(prev => {
      if (prev.includes(key)) {
        return prev.filter(k => k !== key)
      } else {
        return [...prev, key]
      }
    })
  }, [appointments])

  // Detectar cuando se suelta Ctrl o Cmd para abrir el cobro unificado, o Escape para cancelar
  useEffect(() => {
    const handleKeyUp = (e) => {
      if (e.key === "Control" || e.key === "Meta") {
        const keys = selectedMultiPayKeysRef.current
        if (keys && keys.length > 0) {
          openMultiPay(keys)
          setSelectedMultiPayKeys([])
        }
      }
    }

    const handleKeyDownGlobal = (e) => {
      if (e.key === "Escape") {
        if (selectedMultiPayKeysRef.current.length > 0) {
          setSelectedMultiPayKeys([])
        }
        if (clipboardApptRef.current) {
          setClipboardAppt(null)
        }
      }
    }

    window.addEventListener("keyup", handleKeyUp)
    window.addEventListener("keydown", handleKeyDownGlobal)
    return () => {
      window.removeEventListener("keyup", handleKeyUp)
      window.removeEventListener("keydown", handleKeyDownGlobal)
    }
  }, [openMultiPay])

  // Portapapeles para Cortar, Copiar y Pegar turnos
  const [clipboardAppt, setClipboardAppt] = useState(null)
  const clipboardApptRef = useRef(null)
  clipboardApptRef.current = clipboardAppt

  const handleCutAppt = useCallback((key) => {
    const a = appointments[key]
    if (!a) return
    setClipboardAppt({
      mode: "cut",
      appt: a,
      fromDate: currentDate,
      fromKey: key
    })
    setTruncateToast(`✂️ Turno de ${a.client || "Clienta"} cortado. Pegalo con Ctrl+V / ⌘V o clic derecho`)
    setTimeout(() => setTruncateToast(null), 3500)
  }, [appointments, currentDate])

  const handleCopyAppt = useCallback((key) => {
    const a = appointments[key]
    if (!a) return
    setClipboardAppt({
      mode: "copy",
      appt: a,
      fromDate: currentDate,
      fromKey: key
    })
    setTruncateToast(`📋 Turno de ${a.client || "Clienta"} copiado. Pegalo con Ctrl+V / ⌘V o clic derecho`)
    setTimeout(() => setTruncateToast(null), 3500)
  }, [appointments, currentDate])

  const handleCancelClipboard = useCallback(() => {
    setClipboardAppt(null)
  }, [])

  const isOccupied = useCallback((profId, hour, ignoreKey = null) => {
    if (appointments[cellKey(profId, hour)] && cellKey(profId, hour) !== ignoreKey) return true
    for (const [k, a] of Object.entries(appointments)) {
      if (k === ignoreKey) continue
      const [pid, h] = k.split("||")
      if (String(pid) !== String(profId)) continue
      const startIdx = HOURS.indexOf(h)
      const requestedSlots = getApptSlots(a)

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

      const targetIdx = HOURS.indexOf(hour)
      if (targetIdx > startIdx && targetIdx < startIdx + actualSlots) {
        return true
      }
    }
    return false
  }, [appointments])

  const handlePasteAppt = useCallback((toProfId, toHour) => {
    if (!clipboardAppt) return
    const { mode, appt, fromDate, fromKey } = clipboardAppt
    const toKey = cellKey(toProfId, toHour)

    if (mode === "cut" && fromDate === currentDate && fromKey === toKey) {
      setClipboardAppt(null)
      return
    }

    const ignoreKey = (mode === "cut" && fromDate === currentDate) ? fromKey : null
    const requestedSlots = getApptSlots(appt)
    const idx = HOURS.indexOf(toHour)
    if (idx < 0) return

    let canFit = true
    for (let s = 0; s < requestedSlots; s++) {
      const checkHour = HOURS[idx + s]
      if (!checkHour || isOccupied(toProfId, checkHour, ignoreKey)) {
        canFit = false
        break
      }
    }

    if (!canFit) {
      setTruncateToast(`⚠️ No hay espacio suficiente (${requestedSlots * 30} min) en ese horario`)
      setTimeout(() => setTruncateToast(null), 3500)
      return
    }

    if (mode === "cut") {
      rescheduleAppointment({
        fromDate,
        fromKey,
        toDate: currentDate,
        toProfId,
        toHour
      })
      setClipboardAppt(null)
      setTruncateToast(`✅ Turno de ${appt.client || "Clienta"} movido con éxito a ${toHour} hs`)
      setTimeout(() => setTruncateToast(null), 3000)

      const toProfName = (config?.professionals || []).find(p => p.id === toProfId)?.name || "Profesional"
      recordHistory({
        date: currentDate,
        action: "move",
        client: appt.client || "Clienta",
        profName: toProfName,
        hour: toHour,
        details: `Movido con portapapeles a ${toProfName} (${toHour} hs)`,
        canUndo: true,
        payload: {
          fromKey,
          toKey,
          fromDate,
          toDate: currentDate,
          fromProfId: appt.profId,
          toProfId,
          fromHour: appt.hour,
          toHour
        }
      })
    } else if (mode === "copy") {
      copyAppointment({
        fromDate,
        fromKey,
        toDate: currentDate,
        toProfId,
        toHour
      })
      setClipboardAppt(null)
      setTruncateToast(`✅ Turno de ${appt.client || "Clienta"} copiado con éxito a ${toHour} hs`)
      setTimeout(() => setTruncateToast(null), 3000)

      const toProfName = (config?.professionals || []).find(p => p.id === toProfId)?.name || "Profesional"
      recordHistory({
        date: currentDate,
        action: "create",
        client: appt.client || "Clienta",
        profName: toProfName,
        hour: toHour,
        details: `Copiado con portapapeles a ${toProfName} (${toHour} hs)`
      })
    }
  }, [clipboardAppt, currentDate, isOccupied, rescheduleAppointment, copyAppointment, config?.professionals, recordHistory])

  const handleRestoreDeletedAppt = useCallback((entry) => {
    if (!entry || !entry.payload?.deletedAppt) return
    const { deletedAppt, deletedKey, deletedDate } = entry.payload
    const targetDate = deletedDate || currentDate

    const targetDay = allData[targetDate] || {}
    if (targetDay[deletedKey]) {
      setTruncateToast(`⚠️ El horario original (${deletedAppt.hour} hs) ya está ocupado en esa fecha`)
      setTimeout(() => setTruncateToast(null), 4000)
      return
    }

    restoreAppointment(targetDate, deletedKey, deletedAppt)

    setHistoryLog(prev => {
      const updated = prev.map(item => item.id === entry.id ? { ...item, undone: true } : item)
      saveHistoryLog(updated)
      return updated
    })

    recordHistory({
      date: targetDate,
      action: "restore",
      client: deletedAppt.client || "Clienta",
      profName: (config?.professionals || []).find(p => p.id === deletedAppt.profId)?.name || "",
      hour: deletedAppt.hour,
      details: `Turno de ${deletedAppt.client || "Clienta"} restaurado en ${deletedAppt.hour} hs`
    })

    setTruncateToast(`✅ Turno de ${deletedAppt.client || "Clienta"} restaurado con éxito`)
    setTimeout(() => setTruncateToast(null), 3500)
  }, [allData, currentDate, restoreAppointment, recordHistory, config?.professionals])

  const handleRevertMoveAppt = useCallback((entry) => {
    if (!entry || !entry.payload?.fromKey) return
    const { fromKey, toKey, fromDate, toDate, fromProfId, fromHour } = entry.payload

    const targetDay = allData[fromDate] || {}
    if (targetDay[fromKey]) {
      setTruncateToast(`⚠️ El horario original (${fromHour} hs) ahora está ocupado`)
      setTimeout(() => setTruncateToast(null), 4000)
      return
    }

    const currentDay = allData[toDate] || {}
    const currentAppt = currentDay[toKey]
    if (!currentAppt) {
      setTruncateToast(`⚠️ No se encontró el turno en su ubicación actual`)
      setTimeout(() => setTruncateToast(null), 3500)
      return
    }

    rescheduleAppointment({
      fromDate: toDate,
      fromKey: toKey,
      toDate: fromDate,
      toProfId: fromProfId,
      toHour: fromHour
    })

    setHistoryLog(prev => {
      const updated = prev.map(item => item.id === entry.id ? { ...item, undone: true } : item)
      saveHistoryLog(updated)
      return updated
    })

    recordHistory({
      date: fromDate,
      action: "restore",
      client: currentAppt.client || "Clienta",
      details: `Movimiento revertido: regresó a ${fromHour} hs`
    })

    setTruncateToast(`✅ Turno de ${currentAppt.client || "Clienta"} regresado a ${fromHour} hs`)
    setTimeout(() => setTruncateToast(null), 3500)
  }, [allData, rescheduleAppointment, recordHistory])

  const checkDropStatus = useCallback((dragKey, targetProfId, targetHour) => {
    const a = appointments[dragKey]
    if (!a) return { canDrop: false }
    const idx = HOURS.indexOf(targetHour)
    if (idx < 0) return { canDrop: false }
    // La celda inicial debe estar libre
    if (isOccupied(targetProfId, targetHour, dragKey)) {
      return { canDrop: false }
    }
    const requestedSlots = getApptSlots(a)
    let availableSlots = 1
    for (let s = 1; s < requestedSlots; s++) {
      const checkHour = HOURS[idx + s]
      if (!checkHour || isOccupied(targetProfId, checkHour, dragKey)) {
        break
      }
      availableSlots++
    }
    const willTruncate = availableSlots < requestedSlots
    return {
      canDrop: true,
      willTruncate,
      availableSlots,
      requestedSlots,
      durationMins: availableSlots * 30,
    }
  }, [appointments, isOccupied])

  const canDrop = useCallback((dragKey, targetProfId, targetHour) => {
    return checkDropStatus(dragKey, targetProfId, targetHour).canDrop
  }, [checkDropStatus])

  const spanOf = (profId, hour) => {
    const k = cellKey(profId, hour)
    const a = appointments[k]
    if (!a) return null
    if (resizePreview?.key === k) return resizePreview.slots

    const requestedSlots = getApptSlots(a)
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
    const status = checkDropStatus(key, profId, hour)
    setDropTarget({ profId, hour, ...status })
    setDropValid(status.canDrop)
    e.dataTransfer.dropEffect = status.canDrop ? "move" : "none"
  }
  const onDrop = (e, targetProfId, targetHour) => {
    e.preventDefault()
    const key = dragNode.current
    if (!key) { setDropTarget(null); setDropValid(false); return }
    const status = checkDropStatus(key, targetProfId, targetHour)
    if (!status.canDrop) { setDropTarget(null); setDropValid(false); return }

    const originalAppt = appointments[key]
    if (originalAppt) {
      const fromProf = (config?.professionals || []).find(p => p.id === originalAppt.profId)?.name || "Profesional"
      const toProf = (config?.professionals || []).find(p => p.id === targetProfId)?.name || "Profesional"
      const destKey = cellKey(targetProfId, targetHour)
      recordHistory({
        date: currentDate,
        action: "move",
        client: originalAppt.client || "Clienta",
        profName: toProf,
        hour: targetHour,
        details: `Movido de ${fromProf} (${originalAppt.hour}) ➔ ${toProf} (${targetHour})`,
        canUndo: true,
        payload: {
          fromKey: key,
          toKey: destKey,
          fromDate: currentDate,
          toDate: currentDate,
          fromProfId: originalAppt.profId,
          toProfId: targetProfId,
          fromHour: originalAppt.hour,
          toHour: targetHour
        }
      })
      showUndoToast(`Turno de ${originalAppt.client || "Clienta"} movido a ${targetHour} hs`, () => {
        setAppointments(prev => {
          const moved = prev[destKey]
          if (!moved) return prev
          const n = { ...prev }
          delete n[destKey]
          n[key] = { ...moved, profId: originalAppt.profId, hour: originalAppt.hour }
          return n
        })
      })
    }

    setAppointments(prev => {
      const next = { ...prev }; const appt = next[key]; delete next[key]
      const svcDur = Array.isArray(appt.services) && appt.services.length > 0
        ? appt.services.reduce((s, sv) => s + (sv?.duration || 0), 0)
        : 0

      const updatedAppt = {
        ...appt,
        id: appt.id || (Date.now().toString() + Math.random().toString(36).substring(2, 7)),
        profId: targetProfId,
        hour: targetHour,
      }

      if (status.willTruncate) {
        updatedAppt.originalSlots = status.requestedSlots
        updatedAppt.isTruncatedInSlot = true
      } else {
        delete updatedAppt.originalSlots
        delete updatedAppt.isTruncatedInSlot
        if (svcDur > 0) {
          delete updatedAppt.manualSlots
          delete updatedAppt.manualDur
        }
      }

      next[cellKey(targetProfId, targetHour)] = updatedAppt
      return next
    })
    if (status.willTruncate) {
      setTruncateToast(`⚠️ Turno de ${status.requestedSlots * 30} min reubicado: se ajustó a ${status.durationMins} min para entrar en el hueco`)
      if (truncateToastTimerRef.current) clearTimeout(truncateToastTimerRef.current)
      truncateToastTimerRef.current = setTimeout(() => setTruncateToast(null), 3800)
    }
    onDragEnd()
  }

  const onResizeStart = (e, key, edge) => {
    e.preventDefault(); e.stopPropagation()
    const appt = appointments[key]
    const origHourIdx = HOURS.indexOf(appt.hour)
    const origSlots = spanOf(appt.profId, appt.hour) || getApptSlots(appt)
    resizeRef.current = { key, edge, startY: e.clientY, origHourIdx, origSlots, profId: appt.profId, latestHourIdx: origHourIdx, latestSlots: origSlots }
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

      r.latestHourIdx = hourIdx
      r.latestSlots = slots
      setResizePreview({ key: r.key, hourIdx, slots, deltaY: ev.clientY - r.startY, edge: r.edge, origSlots: r.origSlots, origHourIdx: r.origHourIdx, profId: r.profId })
    }
    const onUp = () => {
      window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp)
      const r = resizeRef.current; if (!r) return
      
      const finalHourIdx = r.latestHourIdx ?? r.origHourIdx
      const finalSlots = r.latestSlots ?? r.origSlots
      const newHour = HOURS[finalHourIdx]
      const newKey = cellKey(r.profId, newHour)
      
      let conflict = false
      for (let s = 0; s < finalSlots; s++) {
        const h = HOURS[finalHourIdx + s]
        if (!h || isOccupied(r.profId, h, r.key)) { conflict = true; break }
      }
      
      if (!conflict) {
        const apptObj = appointments[r.key]
        if (apptObj && (finalSlots !== r.origSlots || newHour !== HOURS[r.origHourIdx])) {
          const profName = (config?.professionals || []).find(p => p.id === r.profId)?.name || "Profesional"
          recordHistory({
            date: currentDate,
            action: "resize",
            client: apptObj.client || "Clienta",
            profName,
            hour: newHour,
            details: `Duración ajustada de ${r.origSlots * 30} min a ${finalSlots * 30} min (${newHour} hs)`
          })
        }
        setAppointments(p => {
          const next = { ...p }
          const apptObj = next[r.key]
          if (apptObj) {
            delete next[r.key]
            const updated = {
              ...apptObj,
              hour: newHour,
              manualSlots: finalSlots,
              manualDur: finalSlots * 30
            }
            delete updated.originalSlots
            delete updated.isTruncatedInSlot
            next[newKey] = updated
          }
          return next
        })
      }
      setResizePreview(null)
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
        ...prev,
        id: prev.id || (Date.now().toString() + Math.random().toString(36).substring(2, 7)),
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
    const profName = (config?.professionals || []).find(p => p.id === profId)?.name || "Profesional"
    if (editKey) {
      recordHistory({
        date: currentDate,
        action: "edit",
        client: clientName.trim(),
        profName,
        hour,
        details: extraParams.isNote ? "Nota editada" : `Editado: ${clientName.trim()} (${hour} hs · ${profName})`
      })
    } else {
      recordHistory({
        date: currentDate,
        action: "create",
        client: clientName.trim(),
        profName,
        hour,
        details: extraParams.isNote ? "Nota creada" : `Creado: ${clientName.trim()} (${hour} hs · ${profName})`
      })
    }
    setModal(null)
  }

  const handleConfirmReschedule = ({
    fromDate,
    fromKey,
    toDate,
    toProfId,
    toHour,
    sendWhatsApp,
    clientPhone,
    clientName,
    services,
    profName,
    dateFormatted,
    turnoRama,
  }) => {
    const moved = rescheduleAppointment({ fromDate, fromKey, toDate, toProfId, toHour })
    if (!moved) return

    recordHistory({
      date: toDate,
      action: "reschedule",
      client: clientName,
      profName,
      hour: toHour,
      details: `Reprogramado de ${fromDate} ➔ ${dateFormatted || toDate} (${toHour} hs · ${profName})`
    })

    if (sendWhatsApp && clientPhone) {
      const formattedPhone = formatWaNumber(clientPhone)
      const msg = generateRescheduleMessage({
        clientName,
        dateFormatted,
        hour: toHour,
        services,
        profName,
        empresaNombre: config?.empresaNombre || "Verde Naranja",
      })
      openWhatsAppLink(formattedPhone, msg, config?.waOpenMode || "app")
    }

    setRescheduleToast({
      clientName,
      toDate,
      toHour,
      profName,
      dateFormatted,
      turnoRama,
      toProfId,
    })
    if (rescheduleToastTimerRef.current) clearTimeout(rescheduleToastTimerRef.current)
    rescheduleToastTimerRef.current = setTimeout(() => setRescheduleToast(null), 8000)
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

  const confirmPay = (forceUnpay = false) => {
    const keys = multiPayKeys
    const totalToPay = keys.reduce((sum, k) => sum + apptTotal(appointments[k]), 0)
    const tipAmount = Object.values(apptTip || {}).reduce((sum, v) => sum + (parseFloat(v) || 0), 0)
    const discountAmount = parseFloat(apptDiscount) || 0
    const validSplits = paymentSplits.filter(r => r.methodId && r.amount !== "" && !isNaN(parseFloat(r.amount)))
    const totalAmountPaid = validSplits.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0)
    const isUnpaying = forceUnpay || validSplits.length === 0

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

    const clientsList = keys.map(k => appointments[k]?.client).filter(Boolean).join(", ")
    recordHistory({
      date: currentDate,
      action: "pay",
      client: clientsList || "Cobro",
      details: isUnpaying
        ? `Cobro anulado (${keys.length} ${keys.length === 1 ? "turno" : "turnos"})`
        : `Abonado: ${validSplits.map(s => `${s.methodId}: $${s.amount}`).join(", ")}`
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

  const doDelete = () => {
    const apptToDelete = appointments[deleteKey]
    if (apptToDelete) {
      const profName = (config?.professionals || []).find(p => p.id === apptToDelete.profId)?.name || "Profesional"
      const svcsStr = (apptToDelete.services || []).map(s => s.name).join(", ")
      recordHistory({
        date: currentDate,
        action: "delete",
        client: apptToDelete.client || "Clienta",
        profName,
        hour: apptToDelete.hour,
        details: `Eliminado de ${profName} · ${apptToDelete.hour} hs${svcsStr ? ` (${svcsStr})` : ""}`,
        canUndo: true,
        payload: {
          deletedAppt: apptToDelete,
          deletedKey: deleteKey,
          deletedDate: currentDate
        }
      })
      showUndoToast(`🗑️ Turno de ${apptToDelete.client || "Clienta"} eliminado`, () => {
        restoreAppointment(currentDate, deleteKey, apptToDelete)
      })
    }
    setAppointments(p => { const n = { ...p }; delete n[deleteKey]; return n })
    setDeleteKey(null)
  }

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

  const handleToggleArrived = useCallback((key) => {
    setAppointments(prev => {
      const current = prev[key]
      if (!current) return prev
      const newArrived = !current.arrived
      const rawTarget = current.client || ""
      const targetNorm = normalizeStr(rawTarget)

      recordHistory({
        date: currentDate,
        action: "arrived",
        client: rawTarget || "Clienta",
        details: newArrived ? "Marcada como presente en local" : "Llegada desmarcada"
      })

      if (!targetNorm) {
        return {
          ...prev,
          [key]: {
            ...current,
            arrived: newArrived
          }
        }
      }

      const next = { ...prev }
      Object.keys(prev).forEach(k => {
        const appt = prev[k]
        if (!appt || appt.isBlocked || appt.isNote) return
        const apptNorm = normalizeStr(appt.client || "")
        if (apptNorm === targetNorm) {
          next[k] = {
            ...appt,
            arrived: newArrived
          }
        }
      })
      return next
    })
  }, [setAppointments, currentDate, recordHistory])

  const handleMarkWaSent = useCallback((key) => {
    setAppointments(prev => {
      const current = prev[key]
      if (!current) return prev
      return {
        ...prev,
        [key]: {
          ...current,
          waSent: true,
          waSentAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        }
      }
    })
  }, [setAppointments])

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
      {/* Toast flotante de salto rápido de fecha con teclado numérico */}
      {dateQuickJump && (
        <div style={{
          position: "fixed",
          top: isMobile ? 65 : 78,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 9999,
          background: dateQuickJump.error 
            ? "rgba(254, 242, 242, 0.96)" 
            : (config?.liquidGlass ?? true) 
              ? "rgba(255, 255, 255, 0.88)" 
              : "rgba(255, 255, 255, 0.98)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          border: `1.5px solid ${dateQuickJump.error ? "#f87171" : dateQuickJump.isTyping ? C.orange : C.green}`,
          boxShadow: dateQuickJump.error
            ? "0 12px 36px rgba(220, 38, 38, 0.2)"
            : "0 14px 40px rgba(58, 125, 68, 0.18), 0 0 0 1px rgba(255,255,255,0.6) inset",
          borderRadius: 20,
          padding: "10px 22px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          animation: "scaleUp .16s cubic-bezier(0.16, 1, 0.3, 1)",
          pointerEvents: "none",
          maxWidth: "90vw"
        }}>
          <div style={{
            fontSize: 22,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            animation: dateQuickJump.isTyping ? "pulse 1s infinite alternate" : "none"
          }}>
            {dateQuickJump.error ? "⚠️" : dateQuickJump.isTyping ? "⌨️" : "📅"}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{
              fontSize: 14,
              fontWeight: 800,
              color: dateQuickJump.error ? "#dc2626" : dateQuickJump.isTyping ? C.orange : C.green,
              fontFamily: "Georgia, serif",
              letterSpacing: "0.3px",
              display: "flex",
              alignItems: "center",
              gap: 8
            }}>
              <span>{dateQuickJump.title}</span>
              {dateQuickJump.badge && (
                <span style={{
                  fontSize: 9,
                  fontWeight: 800,
                  padding: "2px 7px",
                  borderRadius: 8,
                  background: dateQuickJump.badgeBg || C.greenPale,
                  color: dateQuickJump.badgeColor || C.green
                }}>
                  {dateQuickJump.badge}
                </span>
              )}
            </div>
            {dateQuickJump.sub && (
              <div style={{ fontSize: 11, color: C.textSoft, marginTop: 1 }}>
                {dateQuickJump.sub}
              </div>
            )}
          </div>
        </div>
      )}

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
        gastos={gastos}
        notebookOpen={notebookOpen}
        onOpenNotebook={() => { playPageSound(); setNotebookOpen(v => !v); }}
        todoTasks={todoTasks}
        onOpenSearchTurnos={() => setSearchTurnosOpen(true)}
        onNavigateToTurno={handleNavigateToTurno}
        onDeleteAppointment={deleteAppointment}
        clientes={clientes}
      />
      <div className="main-content" style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>

        {activeView === "turnos" && (
          <div key="v-turnos" className="pv-view pv-bg" style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", paddingBottom: 0 }}>
            <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              {(draggingKey || resizePreview) && (
                <div style={{
                  position: "fixed",
                  bottom: isMobile ? "calc(140px + env(safe-area-inset-bottom))" : 86,
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: resizePreview
                    ? "rgba(58,125,68,.92)"
                    : dropTarget
                      ? dropValid
                        ? dropTarget.willTruncate
                          ? "rgba(217,119,6,.95)"
                          : "rgba(58,125,68,.92)"
                        : "rgba(200,60,60,.88)"
                      : "rgba(40,40,40,.82)",
                  color: "#fff",
                  borderRadius: 30,
                  padding: "8px 22px",
                  fontSize: 12,
                  letterSpacing: "1px",
                  zIndex: 300,
                  boxShadow: "0 4px 20px rgba(0,0,0,.25)",
                  pointerEvents: "none"
                }}>
                  {resizePreview
                    ? "↕ Soltá para confirmar"
                    : dropTarget
                      ? dropValid
                        ? dropTarget.willTruncate
                          ? `⚠️ Hueco de ${dropTarget.durationMins} min (se acotará) · Soltá para mover`
                          : "✅ Soltar para mover aquí"
                        : "🚫 Horario ocupado"
                      : "☝️ Arrastrá a un nuevo horario"}
                </div>
              )}

              {truncateToast && (
                <div style={{
                  position: "fixed",
                  top: isMobile ? 66 : 76,
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "linear-gradient(135deg, #d97706, #b45309)",
                  color: "#fff",
                  padding: "10px 22px",
                  borderRadius: 24,
                  fontSize: 13,
                  fontWeight: "600",
                  boxShadow: "0 8px 26px rgba(0,0,0,.35), 0 2px 8px rgba(217,119,6,.4)",
                  zIndex: 99999,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  animation: "fadeIn .2s ease-out",
                  pointerEvents: "auto",
                }}>
                  <span>{truncateToast}</span>
                  <button
                    onClick={() => setTruncateToast(null)}
                    style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", cursor: "pointer", fontSize: 13, lineHeight: 1, padding: "3px 7px", borderRadius: 12 }}
                  >
                    ✕
                  </button>
                </div>
              )}

              <AppGrid
                professionals={professionals} appointments={appointments} isMobile={isMobile}
                config={config} setConfig={setConfig}
                draggingKey={draggingKey} dropTarget={dropTarget} dropValid={dropValid} resizePreview={resizePreview}
                remoteEdits={remoteEdits}
                isOccupied={isOccupied} spanOf={spanOf}
                onDragStart={onDragStart} onDragEnd={onDragEnd} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
                onResizeStart={onResizeStart}
                quickBlock={quickBlock}
                paidAppts={paidAppts} totalByProf={totalByProf} earningsByProf={earningsByProf} comisionPct={comisionPct} services={services}
                currentDate={currentDate}
                onCellClick={(profId, hour) => { setModal({ profId, hour, editKey: null }); setChosenServices([]); setClientName(""); setFilterCat("all"); setApptNotes(""); setApptTip({}) }}
                onEdit={(key, appt) => { setModal({ profId: appt.profId, hour: appt.hour, editKey: key }); setChosenServices([...(appt.services || [])]); setClientName(appt.client); setFilterCat("all"); setApptNotes(appt.notes || ""); setApptTip({ [key]: appt.tip ? appt.tip.toString() : "" }) }}
                onPay={(key) => { const a = appointments[key]; if (a?.paymentSplits?.length) setPaymentSplits(a.paymentSplits.map(s => ({ ...s }))); else setPaymentSplits([{ methodId: "efectivo", amount: Math.max(0, apptTotal(a) + (a.tip || 0) - (a.discount || 0)) }]); setApptTip({ [key]: a.tip ? a.tip.toString() : "" }); setApptDiscount(a.discount || ""); setPayModal(key) }}
                onDelete={(key) => setDeleteKey(key)}
                onOpenReschedule={(data) => setRescheduleData(data)}
                onToggleTipsRelease={onToggleTipsRelease}
                onToggleArrived={handleToggleArrived}
                CELL_H={CELL_H}
                activeRama={activeRama}
                selectedMultiPayKeys={selectedMultiPayKeys}
                onToggleSelectMultiPay={handleToggleSelectMultiPay}
                onClearMultiPaySelection={() => setSelectedMultiPayKeys([])}
                onConfirmMultiPaySelection={() => {
                  openMultiPay(selectedMultiPayKeys)
                  setSelectedMultiPayKeys([])
                }}
                clientes={clientes}
                setClientes={setClientes}
                onMarkWaSent={handleMarkWaSent}
                clipboardAppt={clipboardAppt}
                onCutAppt={handleCutAppt}
                onCopyAppt={handleCopyAppt}
                onPasteAppt={handlePasteAppt}
                onCancelClipboard={handleCancelClipboard}
              />
            </div>
          </div>
        )}

        {activeView === "contabilidad" && (
          <div key="v-cont" className="pv-view pv-bg" style={{ overflowY: "auto", overflowX: "hidden", flex: 1, paddingTop: 72 }}><ContabilidadView
            allData={allData} professionals={config.professionals} comisionPct={comisionPct}
            services={config.services} config={config}
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

        {activeView === "config" && <div key="v-cfg" className="pv-view pv-bg" style={{ overflowY: "auto", overflowX: "hidden", flex: 1, paddingTop: 72 }}><ConfigView config={config} setConfig={setConfig} allData={allData} gastos={gastos} sueldos={sueldos} clientes={clientes} onLogout={handleLogout} restoreBackup={restoreBackup} /></div>}
        {activeView === "clientes" && <div key="v-cli" className="pv-view pv-bg" style={{ overflowY: "auto", overflowX: "hidden", flex: 1, paddingTop: 72 }}><ClientesView clientes={clientes} setClientes={setClientes} allData={allData} /></div>}


        {/* Bottom nav (mobile) */}

        {quickGastoModal && (() => {
          const isIngreso = quickGastoForm.tipo === "ingreso"
          const accentColor = isIngreso ? C.green : C.orange
          return (
            <>
              <div 
                onClick={() => setQuickGastoModal(false)} 
                style={{ 
                  position: "fixed", 
                  inset: 0, 
                  zIndex: 299 
                }} 
              />
              <div 
                onClick={e => e.stopPropagation()} 
                style={{ 
                  position: "fixed", 
                  bottom: 76, 
                  right: 16, 
                  width: 330, 
                  maxWidth: "92vw", 
                  maxHeight: "85vh", 
                  overflowY: "auto", 
                  zIndex: 300, 
                  background: "rgba(255, 255, 255, 0.95)", 
                  backdropFilter: "blur(20px)", 
                  WebkitBackdropFilter: "blur(20px)", 
                  borderRadius: 18, 
                  border: `1.5px solid rgba(205, 224, 208, 0.8)`, 
                  boxShadow: "0 12px 40px rgba(0, 0, 0, 0.18)", 
                  padding: "16px 20px 20px", 
                  display: "flex", 
                  flexDirection: "column", 
                  gap: 12,
                  animation: "slideUp .2s cubic-bezier(0.16, 1, 0.3, 1)"
                }}
              >
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
          allProfessionals={config.professionals}
          services={services} filteredServices={filteredServices}
          saveAppt={saveAppt} confirmPay={confirmPay} doDelete={doDelete}
          addSplit={addSplit} removeSplit={removeSplit} updateSplit={updateSplit}
          toggleService={toggleService} removeService={removeService}
          modalSubtotal={modalSubtotal} modalDuration={modalDuration}
          appointments={appointments}
          allData={allData}
          multiPayKeys={multiPayKeys} setMultiPayKeys={setMultiPayKeys}
          config={config}
          currentDate={currentDate}
          onOpenReschedule={(data) => setRescheduleData(data)}
          activeRama={activeRama}
          onConfirmReschedule={handleConfirmReschedule}
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

        <NotebookModal
          isOpen={notebookOpen}
          onClose={() => { playPageSound(); setNotebookOpen(false); }}
          todoTasks={todoTasks}
          setTodoTasks={setTodoTasks}
        />

        <SearchTurnosModal
          isOpen={searchTurnosOpen}
          onClose={() => setSearchTurnosOpen(false)}
          allData={allData}
          clientes={clientes}
          config={config}
          onNavigateToTurno={handleNavigateToTurno}
        />

        <RescheduleModal
          isOpen={Boolean(rescheduleData)}
          onClose={() => setRescheduleData(null)}
          apptData={rescheduleData}
          allData={allData}
          allProfessionals={config.professionals}
          config={config}
          clientes={clientes}
          activeRama={activeRama}
          ramas={ramas}
          onConfirmReschedule={handleConfirmReschedule}
        />

        <HistoryModal
          isOpen={historyModalOpen}
          onClose={() => setHistoryModalOpen(false)}
          historyLog={historyLog}
          setHistoryLog={setHistoryLog}
          currentDate={currentDate}
          onRestoreDeletedAppt={handleRestoreDeletedAppt}
          onRevertMoveAppt={handleRevertMoveAppt}
        />

        {/* Notificación flotante con Deshacer */}
        {undoToast && (
          <div style={{
            position: "fixed",
            bottom: isMobile ? "calc(140px + env(safe-area-inset-bottom))" : 86,
            left: "50%",
            transform: "translateX(-50%)",
            background: "linear-gradient(135deg, #1e293b, #0f172a)",
            color: "#ffffff",
            borderRadius: 36,
            padding: "8px 14px 8px 18px",
            fontSize: 13,
            zIndex: 9999,
            boxShadow: "0 10px 35px rgba(0,0,0,0.45), 0 0 0 1.5px rgba(255,255,255,0.2)",
            display: "flex",
            alignItems: "center",
            gap: 12,
            backdropFilter: "blur(12px)",
            animation: "popIn .18s ease-out",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span>{undoToast.icon || "ℹ️"}</span>
              <span>{undoToast.message}</span>
            </div>
            {undoToast.onUndo && (
              <button
                onClick={() => {
                  undoToast.onUndo()
                  setUndoToast(null)
                }}
                style={{
                  background: "#38bdf8",
                  color: "#0f172a",
                  border: "none",
                  borderRadius: 20,
                  padding: "5px 12px",
                  fontSize: 11,
                  fontWeight: "bold",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4
                }}
              >
                <span>↩️</span> Deshacer
              </button>
            )}
            <button
              onClick={() => setUndoToast(null)}
              style={{
                background: "transparent",
                border: "none",
                color: "#ffffff",
                opacity: 0.6,
                fontSize: 14,
                cursor: "pointer",
                padding: "2px 4px"
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Notificación flotante de turno reprogramado */}
        {rescheduleToast && (
          <div style={{
            position: "fixed",
            bottom: isMobile ? "calc(140px + env(safe-area-inset-bottom))" : 86,
            left: "50%",
            transform: "translateX(-50%)",
            background: "linear-gradient(135deg, #15803d, #166534)",
            color: "#ffffff",
            borderRadius: 36,
            padding: "8px 14px 8px 20px",
            fontSize: 13,
            zIndex: 9999,
            boxShadow: "0 10px 35px rgba(0,0,0,0.38), 0 0 0 1.5px rgba(255,255,255,0.25)",
            display: "flex",
            alignItems: "center",
            gap: 14,
            backdropFilter: "blur(12px)",
            animation: "popIn .18s ease-out",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16 }}>📅</span>
              <span>
                Turno de <strong>{rescheduleToast.clientName}</strong> reprogramado al <strong>{rescheduleToast.dateFormatted}</strong> ({rescheduleToast.toHour} hs · {rescheduleToast.profName})
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button
                onClick={() => {
                  handleNavigateToTurno({
                    date: rescheduleToast.toDate,
                    hour: rescheduleToast.toHour,
                    profId: rescheduleToast.toProfId,
                    rama: rescheduleToast.turnoRama,
                  })
                  setRescheduleToast(null)
                }}
                style={{
                  background: "#fde047",
                  color: "#14532d",
                  border: "none",
                  borderRadius: 20,
                  padding: "6px 14px",
                  fontSize: 12,
                  fontWeight: "bold",
                  cursor: "pointer",
                  whiteSpace: "nowrap"
                }}
              >
                👀 Ver en la planilla
              </button>
              <button
                onClick={() => setRescheduleToast(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#ffffff",
                  opacity: 0.75,
                  fontSize: 15,
                  cursor: "pointer",
                  padding: "2px 6px"
                }}
              >
                ✕
              </button>
            </div>
          </div>
        )}

      </div>{/* end main-content */}
      <nav className="bottom-nav" style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
        flexShrink: 0,
        justifyContent: "space-around", alignItems: "stretch",
        background: (config?.liquidGlass ?? true) ? "rgba(255, 255, 255, 0.45)" : C.white,
        backdropFilter: (config?.liquidGlass ?? true) ? "blur(30px) saturate(200%)" : "none",
        WebkitBackdropFilter: (config?.liquidGlass ?? true) ? "blur(30px) saturate(200%)" : "none",
        borderTop: (config?.liquidGlass ?? true) ? "none" : `1px solid ${C.border}`,
        height: 62, boxShadow: (config?.liquidGlass ?? true) ? "0 -4px 30px rgba(0, 0, 0, 0.03)" : `0 -4px 20px ${C.shadow}`,
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
