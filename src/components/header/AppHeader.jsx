import { memo, useState, useRef, useEffect, useMemo } from "react"
import { C } from "../../constants/colors.js"
import { PAYMENT_METHODS } from "../../constants/data.js"
import { fmt, apptTotal, apptPaidTotal, apptComisionTotal } from "../../utils/appointments.js"
import { AnimatedNumber } from "../ui/index.jsx"
import { MESES_ES, todayKey, fmtDate, fmtShort, nextWorkDay } from "../../utils/dates.js"
import { formatWaNumber, openWhatsAppLink, cleanClientName } from "../../utils/whatsapp.js"
import { useIsMobile } from "../../hooks/useIsMobile.js"
import { DailySummaryModal } from "../modals/DailySummaryModal.jsx"

function getRamaEmoji(rama) {
  const r = String(rama).toLowerCase().trim()
  if (r.includes("mano") || r.includes("uña") || r.includes("nail")) return "💅"
  if (r.includes("pie") || r.includes("pedi")) return "🦶"
  if (r.includes("pelo") || r.includes("peluquer") || r.includes("hair")) return "💇‍♀️"
  if (r.includes("estet") || r.includes("spa") || r.includes("facial") || r.includes("body")) return "🧴"
  if (r.includes("ceja") || r.includes("pestana") || r.includes("pestaña") || r.includes("ojo") || r.includes("lash")) return "👁️"
  return "✨"
}

export const AppHeader = memo(function AppHeader({
  config, activeView, setActiveView, saveStatus, connStatus, totalByMethod, grandTotal, grandEarnings, onLogout,
  currentDate, setCurrentDate, calendarOpen, setCalendarOpen, calViewDate, setCalViewDate, allData, onQuickGasto,
  professionals, activeRama, setActiveRama, ramas, privacyMode, gastos,
  notebookOpen, onOpenNotebook, todoTasks, onOpenSearchTurnos, onNavigateToTurno, onDeleteAppointment, clientes,
  onOpenHistory
}) {
  const isMobileNav = typeof window !== "undefined" && window.innerWidth <= 1100
  const tKey = todayKey()
  const isLiquid = config?.liquidGlass ?? true

  // Appointments and scheduled turnos
  const appointments = allData[currentDate] || {}
  const hasUncheckedTasks = todoTasks && todoTasks.some(t => !t.completed)
  const allProfsMap = useMemo(() => new Set((config?.professionals || []).map(p => p.id)), [config?.professionals])
  const paidAppts = useMemo(() => Object.values(appointments).filter(a => a.paid && allProfsMap.has(a.profId)), [appointments, allProfsMap])

  const pendingByRama = useMemo(() => {
    const counts = {}
    if (!ramas || !ramas.length || !config?.professionals) return counts

    const profRamaMap = new Map()
    ;(config.professionals || []).forEach(p => {
      const r = String(p.rama || "manos").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      profRamaMap.set(p.id, r)
    })

    ramas.forEach(r => {
      const norm = String(r).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      counts[norm] = 0
    })

    Object.entries(appointments).forEach(([k, appt]) => {
      if (!appt || appt.isBlocked || appt.isNote || appt.paid) return
      const profId = appt.profId || k.split("||")[0]
      const ramaOfProf = profRamaMap.get(profId)
      if (ramaOfProf && counts[ramaOfProf] !== undefined) {
        counts[ramaOfProf] += 1
      }
    })

    return counts
  }, [ramas, config?.professionals, appointments])

  const grossIncomeToday = useMemo(() => {
    return paidAppts.reduce((s, a) => {
      if (a.paymentSplits?.length) {
        return s + a.paymentSplits.reduce((acc, r) => acc + (parseFloat(r.amount) || 0), 0)
      }
      return s + apptPaidTotal(a)
    }, 0)
  }, [paidAppts])

  const scheduledStats = useMemo(() => {
    const dayAppts = (allData || {})[currentDate] || {}
    const list = Object.values(dayAppts).filter(a => {
      if (!a || a.isBlocked || a.isNote) return false
      if (!a.client) return false
      if (allProfsMap.size > 0 && a.profId && !allProfsMap.has(a.profId)) return false
      return true
    })

    const totalCount = list.length
    const paidCount = list.filter(a => !!a.paid).length
    const pctCount = totalCount > 0 ? Math.round((paidCount / totalCount) * 100) : 0

    const totalMoney = list.reduce((sum, a) => sum + (apptTotal(a) || 0), 0)
    const paidMoney = list.reduce((sum, a) => {
      if (!a.paid) return sum
      if (a.paymentSplits?.length) {
        return sum + a.paymentSplits.reduce((acc, r) => acc + (parseFloat(r.amount) || 0), 0)
      }
      return sum + apptPaidTotal(a)
    }, 0)
    const pctMoney = totalMoney > 0 ? Math.round((paidMoney / totalMoney) * 100) : 0

    return {
      totalCount,
      paidCount,
      pctCount,
      totalMoney,
      paidMoney,
      pctMoney,
      isFullyPaid: totalCount > 0 && paidCount === totalCount
    }
  }, [allData, currentDate, allProfsMap])

  // Turnos pasados (días previos a hoy) que quedaron sin cobrar
  const pastUnpaidAppts = useMemo(() => {
    const today = todayKey()
    const profsMap = new Map((config?.professionals || []).map(p => [p.id, p]))
    const list = []

    Object.entries(allData || {}).forEach(([dateStr, dayData]) => {
      // Solo días previos al actual
      if (dateStr >= today) return
      if (!dayData || typeof dayData !== "object") return

      Object.entries(dayData).forEach(([k, appt]) => {
        if (!appt || appt.isBlocked || appt.isNote || appt.paid) return
        if (!appt.client || !appt.client.trim()) return

        const profId = appt.profId || k.split("||")[0]
        const prof = profsMap.get(profId)
        const isOrphan = !prof
        const rama = prof?.rama || "manos"
        const total = apptTotal(appt)

        // Buscar teléfono si no está directo en el turno
        let phone = appt.clientPhone || appt.phone || ""
        if (!phone && Array.isArray(clientes) && clientes.length > 0) {
          const normCName = (appt.client || "").toLowerCase().trim()
          const matchedCli = clientes.find(c => c?.name && c.name.toLowerCase().trim() === normCName)
          if (matchedCli?.phone) phone = matchedCli.phone
        }

        list.push({
          key: `${dateStr}||${k}`,
          cellKey: k,
          date: dateStr,
          hour: appt.hour,
          profId,
          profName: prof?.name || "Sin profesional",
          isOrphan,
          profRama: rama,
          client: appt.client,
          clientPhone: phone,
          services: appt.services || [],
          totalAmount: total,
          appt
        })
      })
    })

    // Ordenar de más reciente a más antiguo
    return list.sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date)
      return a.hour.localeCompare(b.hour)
    })
  }, [allData, config?.professionals, clientes])

  const pastUnpaidTotalMoney = useMemo(() => {
    return pastUnpaidAppts.reduce((sum, a) => sum + (a.totalAmount || 0), 0)
  }, [pastUnpaidAppts])

  const VIEWS = [
    { id: "turnos", icon: "📅", label: "Turnos" },
    { id: "contabilidad", icon: "📊", label: "Contabilidad" },
    { id: "clientes", icon: "👥", label: "Clientes" },
    { id: "config", icon: "⚙️", label: "Config" },
  ]

  const [vy, vm] = (calViewDate || "2026-01").split("-").map(Number)
  const firstDay = new Date(vy, vm - 1, 1)
  const lastDay = new Date(vy, vm, 0)
  const startDow = (firstDay.getDay() + 6) % 7
  const cells = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= lastDay.getDate(); d++) cells.push(d)
  while (cells.length < 42) cells.push(null)

  const prevMonth = () => { let m = vm - 1, y = vy; if (m < 1) { m = 12; y-- } setCalViewDate(`${y}-${String(m).padStart(2, "0")}`) }
  const nextMonth = () => { let m = vm + 1, y = vy; if (m > 12) { m = 1; y++ } setCalViewDate(`${y}-${String(m).padStart(2, "0")}`) }

  const playClickSound = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
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
    } catch (e) {
      console.warn(e)
    }
  }

  const [isRefreshing, setIsRefreshing] = useState(false)
  const [hoyBounce, setHoyBounce] = useState(false)

  const handleHoyClick = () => {
    const isAlreadyToday = currentDate === tKey
    if (isAlreadyToday && ramas && ramas.length > 1) {
      const currIdx = ramas.findIndex(r => String(r).trim().toLowerCase() === String(activeRama).trim().toLowerCase())
      const nextIdx = (currIdx + 1) % ramas.length
      setActiveRama(ramas[nextIdx])
    } else {
      setCurrentDate(tKey)
    }
    
    setHoyBounce(true)
    playClickSound()
    setTimeout(() => setHoyBounce(false), 150)
    
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("scroll-to-today-hour"))
    }, isAlreadyToday ? 50 : 250)
  }
  const dateStripRef = useRef(null)

  useEffect(() => {
    if (activeView === "turnos" && dateStripRef.current) {
      const activeBtn = dateStripRef.current.querySelector('[data-active="true"]')
      if (activeBtn) {
        activeBtn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" })
      }
    }
  }, [currentDate, activeView])

  // Get appointments for current date by payment method
  const getApptsByMethod = (methodId) => {
    const dayData = (allData || {})[currentDate] || {}
    const activeProfIds = new Set((professionals || []).map(p => p.id))
    return Object.values(dayData).filter(a => {
      if (!a.paid) return false
      if (activeProfIds.size > 0 && !activeProfIds.has(a.profId)) return false
      if (a.paymentSplits?.length) return a.paymentSplits.some(s => s.methodId === methodId)
      return a.payMethod === methodId
    }).map(a => {
      const amount = a.paymentSplits?.length
        ? a.paymentSplits.find(s => s.methodId === methodId)?.amount || 0
        : apptTotal(a)
      return { ...a, methodAmount: parseFloat(amount) }
    }).sort((a, b) => a.hour.localeCompare(b.hour))
  }

  const btnNav = { width: 30, height: 30, borderRadius: "50%", border: `1px solid ${C.border}`, background: C.white, color: C.green, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }

  // Modal de resumen diario unificado (Efectivo, Débito, Mercado Pago, Sin Cobrar)
  const [dailySummaryOpen, setDailySummaryOpen] = useState(false)
  const [isDailySummaryHovered, setIsDailySummaryHovered] = useState(false)
  const dailySummaryHoverTimerRef = useRef(null)

  const handleDailySummaryMouseEnter = () => {
    if (dailySummaryHoverTimerRef.current) {
      clearTimeout(dailySummaryHoverTimerRef.current)
      dailySummaryHoverTimerRef.current = null
    }
    setIsDailySummaryHovered(true)
  }

  const handleDailySummaryMouseLeave = () => {
    if (dailySummaryHoverTimerRef.current) {
      clearTimeout(dailySummaryHoverTimerRef.current)
    }
    dailySummaryHoverTimerRef.current = setTimeout(() => {
      setIsDailySummaryHovered(false)
    }, 220)
  }

  useEffect(() => {
    if (activeView !== "turnos") {
      setDailySummaryOpen(false)
      setIsDailySummaryHovered(false)
    }
  }, [activeView])

  useEffect(() => {
    return () => {
      if (dailySummaryHoverTimerRef.current) {
        clearTimeout(dailySummaryHoverTimerRef.current)
      }
    }
  }, [])

  const isMobile = useIsMobile(1100)
  const isToday = currentDate === tKey
  const headerAccentColor = isToday ? C.green : (C.orange || "#e8793a")

  const [isFanOpen, setIsFanOpen] = useState(false)

  useEffect(() => {
    if (activeView !== "turnos") {
      setIsFanOpen(false)
    }
  }, [activeView])

  const fanItems = useMemo(() => [
    {
      id: "notas",
      label: "Anotador",
      angle: 165,
      content: "📝",
      badge: hasUncheckedTasks,
      bg: isLiquid ? "rgba(255, 245, 230, 0.95)" : C.orangePale,
      action: () => onOpenNotebook()
    },
    {
      id: "buscar",
      label: "Buscar turnos",
      angle: 132,
      content: "🔍",
      bg: isLiquid ? "rgba(235, 250, 240, 0.95)" : C.greenPale,
      action: () => onOpenSearchTurnos()
    },
    {
      id: "historial",
      label: "Historial",
      angle: 99,
      content: "🕒",
      bg: isLiquid ? "rgba(255, 245, 230, 0.95)" : C.orangePale,
      action: () => onOpenHistory && onOpenHistory()
    },
    {
      id: "hoy",
      label: "Ir a Hoy",
      angle: 66,
      content: "HOY",
      fontSize: 10,
      fontWeight: "bold",
      fontFamily: "Georgia,serif",
      letterSpacing: "1px",
      color: currentDate !== tKey ? "#ffffff" : C.green,
      bg: currentDate !== tKey
        ? `linear-gradient(135deg, ${C.orange}, ${C.amber || "#e07b20"})`
        : (isLiquid ? "rgba(235, 250, 240, 0.95)" : C.greenPale),
      shadow: currentDate !== tKey
        ? "0 4px 16px rgba(232, 121, 58, 0.45)"
        : undefined,
      border: currentDate !== tKey ? "none" : undefined,
      action: () => handleHoyClick()
    },
    {
      id: "gasto",
      label: "Gasto rápido",
      angle: 33,
      content: "💸",
      bg: isLiquid ? "rgba(255, 255, 250, 0.95)" : C.cream,
      action: () => onQuickGasto()
    },
    {
      id: "calendario",
      label: "Calendario",
      angle: 0,
      content: "📅",
      bg: calendarOpen
        ? `linear-gradient(135deg, ${C.green}, ${C.greenLight})`
        : (isLiquid ? "rgba(255, 255, 250, 0.95)" : C.cream),
      color: calendarOpen ? "#ffffff" : undefined,
      action: () => setCalendarOpen(v => !v)
    }
  ], [hasUncheckedTasks, isLiquid, currentDate, tKey, calendarOpen, onOpenNotebook, onOpenSearchTurnos, onOpenHistory, handleHoyClick, onQuickGasto, setCalendarOpen])

  return (
    <>
      <header
        className={`app-header-main${activeView === "turnos" ? " header-turnos-active" : ""}`}
        style={{
          background: isLiquid ? "rgba(255, 255, 255, 0.45)" : C.white,
          backdropFilter: isLiquid ? "blur(30px) saturate(200%)" : "none",
          WebkitBackdropFilter: isLiquid ? "blur(30px) saturate(200%)" : "none",
          borderTop: isMobile ? `4px solid ${headerAccentColor}` : "none",
          borderBottom: isLiquid ? "none" : `1px solid ${C.border}`,
          padding: "0 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: isLiquid ? "0 4px 30px rgba(0, 0, 0, 0.03)" : `0 2px 10px ${C.shadow}`,
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          minHeight: 56,
          gap: 8,
          transition: isMobile ? "border-color .25s ease" : "none"
        }}
      >

        {/* Left Container (Logo + Switcher) */}
        <div className="header-left-container">
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 9, flexShrink: 0 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#fff", border: `1px solid ${C.greenMint}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0, boxShadow: `0 2px 8px ${C.shadow}` }}>
              <img src="/logo.png" alt="Logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <div className="header-brand-text">
              <div style={{ fontSize: 7, letterSpacing: "3px", color: C.orange, textTransform: "uppercase" }}>{config.empresaSubtitulo}</div>
              <div style={{ fontSize: 15, color: C.green, letterSpacing: "1px" }}>{config.empresaNombre}</div>
            </div>
          </div>

          {/* Spacer before switcher to center it dynamically on desktop */}
          {activeView === "turnos" && ramas && ramas.length > 1 && <div className="desktop-nav-container" style={{ flex: 1 }} />}

          {/* Dynamic Branch Switcher & Mobile Total Bubble */}
          {activeView === "turnos" && ramas && ramas.length > 1 && (
            <div className="header-center-group">
              {/* Burbuja 1: Switcher de Planillas */}
              <div className="branch-switcher-container" style={{ 
                display: "flex", 
                gap: 4, 
                background: isLiquid ? "rgba(255, 255, 255, 0.35)" : C.cream, 
                backdropFilter: isLiquid ? "blur(10px)" : "none",
                padding: 3, 
                borderRadius: 20, 
                border: isLiquid ? "1px solid rgba(255, 255, 255, 0.5)" : `1px solid ${C.border}`, 
                flexShrink: 0,
                alignItems: "center"
              }}>
                {ramas.map(rama => {
                  const normRama = String(rama).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                  const isActive = String(activeRama).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === normRama
                  const emoji = getRamaEmoji(rama)
                  const displayName = rama.charAt(0).toUpperCase() + rama.slice(1)
                  const pendingCount = pendingByRama[normRama] || 0
                  const hasPending = pendingCount > 0 && !isActive
                  return (
                    <button
                      key={rama}
                      onClick={() => setActiveRama(rama)}
                      className="branch-tab-btn"
                      style={{
                        padding: "5px 11px",
                        borderRadius: 16,
                        cursor: "pointer",
                        border: "none",
                        background: isActive ? `linear-gradient(135deg,${C.green},${C.greenLight})` : "transparent",
                        color: isActive ? "#fff" : C.textSoft,
                        fontSize: 9,
                        fontFamily: "Georgia, serif",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        fontWeight: isActive ? "bold" : "normal",
                        transition: "all .18s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        boxShadow: isActive ? `0 2px 6px ${C.green}22` : "none",
                        outline: "none",
                        position: "relative"
                      }}
                      onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = C.greenPale } }}
                      onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = "transparent" } }}
                      title={hasPending ? `${displayName} · ${pendingCount} turno${pendingCount > 1 ? "s" : ""} pendiente${pendingCount > 1 ? "s" : ""} de cobro` : displayName}
                    >
                      <span style={{ fontSize: 12 }}>{emoji}</span>
                      <span className="branch-label-text">{displayName}</span>
                      {hasPending && (
                        <span
                          className="branch-pending-badge"
                          style={{
                            position: "absolute",
                            top: -4,
                            right: -4,
                            background: "linear-gradient(135deg, #ef4444, #dc2626)",
                            color: "#ffffff",
                            fontSize: 8,
                            fontWeight: "800",
                            minWidth: 16,
                            height: 16,
                            padding: "0 4px",
                            borderRadius: 99,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: "0 2px 6px rgba(220, 38, 38, 0.45), 0 0 0 1.5px #fff",
                            lineHeight: 1,
                            zIndex: 10,
                            pointerEvents: "none"
                          }}
                        >
                          {pendingCount}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Burbuja 2: Progreso de turnos cobrados (Abre el modal de resumen) */}
              <div className="mobile-total-bubble" style={{
                display: "flex",
                alignItems: "center",
                background: isLiquid ? "rgba(255, 255, 255, 0.35)" : C.cream,
                backdropFilter: isLiquid ? "blur(10px)" : "none",
                WebkitBackdropFilter: isLiquid ? "blur(10px)" : "none",
                padding: 3,
                borderRadius: 18,
                border: isLiquid ? "1px solid rgba(255, 255, 255, 0.5)" : `1px solid ${C.border}`,
                flexShrink: 0
              }}>
                <button
                  type="button"
                  onClick={() => setDailySummaryOpen(true)}
                  className="branch-tab-btn"
                  style={{
                    padding: "4px 9px",
                    borderRadius: 14,
                    cursor: "pointer",
                    border: "none",
                    background: scheduledStats.isFullyPaid
                      ? `linear-gradient(135deg, ${C.green}, ${C.greenLight})`
                      : (scheduledStats.totalCount > 0 ? `linear-gradient(135deg, ${C.green}, ${C.greenLight})` : "transparent"),
                    color: scheduledStats.totalCount > 0 ? "#fff" : C.textSoft,
                    transition: "all .18s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    boxShadow: scheduledStats.totalCount > 0 ? `0 2px 6px ${C.green}33` : "none",
                    outline: "none",
                    position: "relative",
                    whiteSpace: "nowrap"
                  }}
                  onMouseEnter={(e) => { if (scheduledStats.totalCount === 0) { e.currentTarget.style.background = C.greenPale } }}
                  onMouseLeave={(e) => { if (scheduledStats.totalCount === 0) { e.currentTarget.style.background = "transparent" } }}
                  title={`Progreso del día: ${scheduledStats.pctCount}% (${scheduledStats.paidCount} de ${scheduledStats.totalCount} cobrados)${pastUnpaidAppts.length > 0 ? `\n⚠️ ${pastUnpaidAppts.length} turnos anteriores sin cobrar` : ""}\nClic para ver el resumen completo`}
                >
                  {/* Anillo de progreso circular SVG */}
                  <div style={{ position: "relative", width: 22, height: 22, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="22" height="22" viewBox="0 0 36 36" style={{ transform: "rotate(-90deg)" }}>
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke={scheduledStats.totalCount > 0 ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.07)"}
                        strokeWidth="4"
                      />
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke={scheduledStats.isFullyPaid ? "#ffffff" : (scheduledStats.totalCount > 0 ? "#ffffff" : C.green)}
                        strokeWidth="4"
                        strokeDasharray={`${scheduledStats.pctCount}, 100`}
                        strokeLinecap="round"
                        style={{ transition: "stroke-dasharray 0.5s ease" }}
                      />
                    </svg>
                    {scheduledStats.isFullyPaid ? (
                      <span style={{ position: "absolute", fontSize: 9.5, color: "#fff", fontWeight: "bold" }}>✓</span>
                    ) : (
                      <span style={{ position: "absolute", fontSize: 8, fontWeight: "bold", color: scheduledStats.totalCount > 0 ? "#fff" : C.textSoft }}>
                        %
                      </span>
                    )}
                  </div>

                  {/* Porcentaje y Conteo de turnos (SIN MONTOS DE DINERO) */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", textAlign: "left", lineHeight: 1.15 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: "800",
                          fontFamily: "Georgia, serif",
                          color: scheduledStats.totalCount > 0 ? "#ffffff" : C.textSoft,
                          fontVariantNumeric: "tabular-nums"
                        }}
                      >
                        {scheduledStats.pctCount}%
                      </span>

                      {scheduledStats.isFullyPaid && (
                        <span style={{ fontSize: 7, color: "#ffffff", fontWeight: "bold", background: "rgba(255,255,255,0.25)", padding: "1px 3px", borderRadius: 3, letterSpacing: "0.5px" }}>
                          COMPLETO
                        </span>
                      )}

                      {pastUnpaidAppts.length > 0 && (
                        <span
                          style={{
                            background: "linear-gradient(135deg, #ef4444, #dc2626)",
                            color: "#fff",
                            fontSize: 7.5,
                            fontWeight: "800",
                            minWidth: 14,
                            height: 14,
                            borderRadius: 99,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "0 3px",
                            boxShadow: "0 1px 4px rgba(220, 38, 38, 0.4)",
                            marginLeft: 1
                          }}
                          title={`${pastUnpaidAppts.length} turnos anteriores sin cobrar`}
                        >
                          ⚠️ {pastUnpaidAppts.length}
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: 7.5, color: scheduledStats.totalCount > 0 ? "rgba(255,255,255,0.85)" : C.textSoft, whiteSpace: "nowrap" }}>
                      {scheduledStats.totalCount === 0
                        ? "Sin turnos"
                        : `${scheduledStats.paidCount}/${scheduledStats.totalCount} cobrados`}
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Spacer after switcher to center it dynamically on desktop */}
          {activeView === "turnos" && ramas && ramas.length > 1 && <div className="desktop-nav-container" style={{ flex: 1 }} />}
        </div>

        {/* Center Container (Desktop Navigation centered) */}
        <div className="desktop-nav-container">
          <div className="desktop-nav" style={{ gap: 4 }}>
            {VIEWS.map(v => (
              <button key={v.id} onClick={() => setActiveView(v.id)} style={{ padding: "6px 14px", borderRadius: 20, cursor: "pointer", border: `2px solid ${activeView === v.id ? C.green : C.border}`, background: activeView === v.id ? `linear-gradient(135deg,${C.green},${C.greenLight})` : C.white, color: activeView === v.id ? "#fff" : C.textSoft, fontSize: 10, letterSpacing: "1px", textTransform: "uppercase", fontFamily: "Georgia,serif", transition: "all .18s" }}>{v.icon} {v.label}</button>
            ))}
          </div>
        </div>

        {/* Right Container (Metrics, savebadge & status alignment) */}
        <div className="header-right-container">
          {/* Save Badge */}
          <div className="desktop-savebadge" style={{ padding: "4px 10px", borderRadius: 16, minWidth: 90, textAlign: "center", background: saveStatus === "saving" ? "#f5f5f5" : saveStatus === "saved" ? C.greenPale : saveStatus === "error" ? "#fde8e8" : "transparent", border: `1px solid ${saveStatus === "saving" ? "#ddd" : saveStatus === "saved" ? C.greenMint : saveStatus === "error" ? "#f4b0b0" : "transparent"}`, opacity: saveStatus === "idle" ? 0 : 1, transition: "opacity .3s ease" }}>
            <span style={{ fontSize: 9, color: saveStatus === "saved" ? C.green : saveStatus === "error" ? "#c04040" : "#aaa" }}>{saveStatus === "saving" ? "⏳ Guardando..." : saveStatus === "saved" ? "✓ Guardado" : saveStatus === "error" ? "⚠️ Error" : "✓ Guardado"}</span>
          </div>

          {/* Connection Status Dot - Placed immediately to the left of the payment totals (Efectivo) */}
          <div style={{ 
            width: 10, height: 10, borderRadius: "50%", 
            background: connStatus === "online" ? C.green : connStatus === "connecting" ? "#ffcc00" : "#ff4444",
            boxShadow: connStatus === "online" ? `0 0 8px ${C.green}88` : "none",
            transition: "all .3s ease",
            cursor: "help",
            flexShrink: 0
          }} title={connStatus === "online" ? "Sincronización Activa" : "Reconectando..."} />

          {/* Botón Compacto de Resumen Diario en Header (Abre el modal unificado y despliega turnos adeudados al apoyar el puntero) */}
          {activeView === "turnos" && (
            <div
              className="daily-summary-wrapper"
              style={{ position: "relative" }}
              onMouseEnter={handleDailySummaryMouseEnter}
              onMouseLeave={handleDailySummaryMouseLeave}
            >
              <button
                type="button"
                onClick={() => {
                  if (dailySummaryHoverTimerRef.current) {
                    clearTimeout(dailySummaryHoverTimerRef.current)
                  }
                  setIsDailySummaryHovered(false)
                  setDailySummaryOpen(true)
                }}
                className={`daily-summary-btn ${scheduledStats.isFullyPaid ? "paid" : "unpaid"}`}
                title={`Ver resumen del día y deudas pendientes\nProgreso de hoy: ${scheduledStats.pctCount}% (${scheduledStats.paidCount} de ${scheduledStats.totalCount} cobrados)\nRecaudado hoy: ${fmt(grandTotal)}${pastUnpaidAppts.length > 0 ? `\n⚠️ ${pastUnpaidAppts.length} turno${pastUnpaidAppts.length !== 1 ? "s" : ""} de días anteriores sin cobrar (${fmt(pastUnpaidTotalMoney)})` : ""}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  height: 38,
                  padding: "0 12px",
                  borderRadius: 12,
                  border: scheduledStats.isFullyPaid
                    ? `1.5px solid ${C.green}`
                    : (scheduledStats.totalCount > 0 ? `1.5px solid ${C.greenMint}` : `1.5px solid ${C.border}`),
                  background: scheduledStats.isFullyPaid
                    ? `linear-gradient(135deg, ${C.green}, ${C.greenLight})`
                    : (isLiquid ? "rgba(255, 255, 255, 0.75)" : C.white),
                  backdropFilter: isLiquid ? "blur(12px)" : "none",
                  WebkitBackdropFilter: isLiquid ? "blur(12px)" : "none",
                  boxShadow: scheduledStats.isFullyPaid
                    ? `0 4px 14px ${C.green}44`
                    : `0 2px 8px ${C.shadow}`,
                  cursor: "pointer",
                  userSelect: "none",
                  transition: "all .2s cubic-bezier(0.16, 1, 0.3, 1)",
                  outline: "none",
                  flexShrink: 0
                }}
              >
                {/* Anillo de progreso circular SVG */}
                <div style={{ position: "relative", width: 24, height: 24, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="24" height="24" viewBox="0 0 36 36" style={{ transform: "rotate(-90deg)" }}>
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke={scheduledStats.isFullyPaid ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.07)"}
                      strokeWidth="3.8"
                    />
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke={scheduledStats.isFullyPaid ? "#ffffff" : C.green}
                      strokeWidth="3.8"
                      strokeDasharray={`${scheduledStats.pctCount}, 100`}
                      strokeLinecap="round"
                      style={{ transition: "stroke-dasharray 0.5s ease" }}
                    />
                  </svg>
                  {scheduledStats.isFullyPaid ? (
                    <span style={{ position: "absolute", fontSize: 10, color: "#fff", fontWeight: "bold" }}>✓</span>
                  ) : (
                    <span style={{ position: "absolute", fontSize: 9, fontWeight: "bold", color: scheduledStats.totalCount > 0 ? C.green : C.textSoft }}>
                      %
                    </span>
                  )}
                </div>

                {/* Porcentaje y Conteo (SIN MONTOS DE DINERO) */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", textAlign: "left", lineHeight: 1.15 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: "800",
                        fontFamily: "Georgia, serif",
                        color: scheduledStats.isFullyPaid ? "#ffffff" : (scheduledStats.totalCount > 0 ? C.green : C.textSoft),
                        fontVariantNumeric: "tabular-nums"
                      }}
                    >
                      {scheduledStats.pctCount}%
                    </span>

                    {scheduledStats.isFullyPaid && (
                      <span style={{ fontSize: 7.5, color: "#ffffff", fontWeight: "bold", background: "rgba(255,255,255,0.25)", padding: "1px 4px", borderRadius: 4, letterSpacing: "0.5px" }}>
                        COMPLETO
                      </span>
                    )}

                    {pastUnpaidAppts.length > 0 && (
                      <span
                        title={`${pastUnpaidAppts.length} turno${pastUnpaidAppts.length !== 1 ? "s" : ""} de días anteriores sin cobrar (${fmt(pastUnpaidTotalMoney)})`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 2,
                          background: "linear-gradient(135deg, #ef4444, #dc2626)",
                          color: "#ffffff",
                          fontSize: 8,
                          fontWeight: "bold",
                          padding: "1px 5px",
                          borderRadius: 6,
                          boxShadow: "0 1px 4px rgba(220, 38, 38, 0.35)",
                          flexShrink: 0
                        }}
                      >
                        <span>⚠️</span>
                        <span>{pastUnpaidAppts.length}</span>
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: 8.5, color: scheduledStats.isFullyPaid ? "rgba(255,255,255,0.85)" : C.textSoft, whiteSpace: "nowrap" }}>
                    {scheduledStats.totalCount === 0
                      ? "Sin turnos"
                      : `${scheduledStats.paidCount}/${scheduledStats.totalCount} cobrados`}
                  </div>
                </div>

                {/* Indicador sutil de modal */}
                <span
                  style={{
                    fontSize: 11,
                    color: scheduledStats.isFullyPaid ? "rgba(255,255,255,0.7)" : C.textSoft,
                    marginLeft: 1,
                    transition: "transform .2s ease",
                    transform: isDailySummaryHovered ? "rotate(90deg)" : "none"
                  }}
                >
                  ›
                </span>
              </button>

              {/* Panel vertical desplegable hacia abajo con turnos adeudados al posar el puntero */}
              {isDailySummaryHovered && !dailySummaryOpen && (
                <div
                  className="past-unpaid-dropdown"
                  onMouseEnter={handleDailySummaryMouseEnter}
                  onMouseLeave={handleDailySummaryMouseLeave}
                  style={{
                    position: "absolute",
                    top: "calc(100% + 8px)",
                    right: 0,
                    zIndex: 250,
                    background: C.white,
                    borderRadius: 14,
                    border: `1.5px solid ${pastUnpaidAppts.length > 0 ? "#fca5a5" : C.border}`,
                    boxShadow: "0 12px 36px rgba(0,0,0,0.18)",
                    width: 330,
                    maxHeight: 400,
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    animation: "scaleUp 0.18s cubic-bezier(0.16, 1, 0.3, 1)"
                  }}
                >
                  {/* Cabecera del panel */}
                  <div style={{
                    padding: "10px 14px",
                    background: pastUnpaidAppts.length > 0 ? "linear-gradient(135deg, #fff1f2, #ffe4e6)" : "linear-gradient(135deg, #f0fdf4, #dcfce7)",
                    borderBottom: `1px solid ${pastUnpaidAppts.length > 0 ? "#fecdd3" : "#bbf7d0"}`,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}>
                    <div>
                      <div style={{
                        fontSize: 11,
                        fontWeight: "bold",
                        color: pastUnpaidAppts.length > 0 ? "#b91c1c" : "#15803d",
                        letterSpacing: "0.5px",
                        textTransform: "uppercase"
                      }}>
                        {pastUnpaidAppts.length > 0
                          ? `⚠️ ${pastUnpaidAppts.length} Turno${pastUnpaidAppts.length !== 1 ? "s" : ""} Pasado${pastUnpaidAppts.length !== 1 ? "s" : ""} Sin Cobrar`
                          : "✓ Sin turnos pendientes previos"}
                      </div>
                      <div style={{ fontSize: 9, color: pastUnpaidAppts.length > 0 ? "#991b1b" : "#166534", marginTop: 2 }}>
                        {pastUnpaidAppts.length > 0
                          ? `Total adeudado: ${fmt(pastUnpaidTotalMoney)}`
                          : "Todas las clientas de días anteriores están al día"}
                      </div>
                    </div>
                    <span style={{ fontSize: 16 }}>{pastUnpaidAppts.length > 0 ? "⏳" : "🎉"}</span>
                  </div>

                  {/* Lista de turnos impagos pasados */}
                  {pastUnpaidAppts.length > 0 ? (
                    <>
                      <div style={{
                        overflowY: "auto",
                        maxHeight: 300,
                        padding: "8px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 6
                      }}>
                        {pastUnpaidAppts.map((item) => {
                          const dateDisplay = fmtShort(item.date)
                          const serviceNames = (item.services || []).map(s => s.name).join(", ") || "Turno"

                          const handleWhatsAppClick = (e) => {
                            e.stopPropagation()
                            if (!item.clientPhone) return
                            const message = `¡Hola ${cleanClientName(item.client)}! 🌿 Te escribimos de Verde Naranja por tu turno del día ${fmtDate(item.date)} (${serviceNames}). Te dejamos este recordatorio porque quedó pendiente el saldo de ${fmt(item.totalAmount)}. ¡Muchas gracias!`
                            openWhatsAppLink(formatWaNumber(item.clientPhone), message)
                          }

                          return (
                            <div
                              key={item.key}
                              onClick={() => {
                                onNavigateToTurno?.({
                                  date: item.date,
                                  hour: item.hour,
                                  profId: item.profId,
                                  rama: item.profRama,
                                  openEdit: false
                                })
                                setIsDailySummaryHovered(false)
                              }}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "8px 10px",
                                borderRadius: 10,
                                background: "#fffaf0",
                                border: "1px solid #fed7aa",
                                cursor: "pointer",
                                transition: "all .15s ease",
                                gap: 8
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = "#fff4e5"
                                e.currentTarget.style.borderColor = "#fdba74"
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = "#fffaf0"
                                e.currentTarget.style.borderColor = "#fed7aa"
                              }}
                              title="Clic para ver el turno en la planilla"
                            >
                              {/* Info del turno */}
                              <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                                  <span style={{ fontSize: 9, fontWeight: "bold", color: "#c2410c", background: "#ffedd5", padding: "1px 5px", borderRadius: 4, letterSpacing: "0.3px" }}>
                                    📅 {dateDisplay} · {item.hour} hs
                                  </span>
                                  <span style={{ fontSize: 9, color: C.textSoft }}>
                                    ({item.profName})
                                  </span>
                                </div>
                                <div style={{ fontSize: 11, fontWeight: "bold", color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {item.client}
                                </div>
                                <div style={{ fontSize: 9, color: C.textSoft, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {serviceNames}
                                </div>
                              </div>

                              {/* Monto + Botón WhatsApp */}
                              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                                <div style={{ textAlign: "right" }}>
                                  <div style={{ fontSize: 12, fontWeight: "800", color: "#b91c1c", fontVariantNumeric: "tabular-nums" }}>
                                    {fmt(item.totalAmount)}
                                  </div>
                                  <div style={{ fontSize: 8, color: "#ea580c" }}>
                                    Sin cobrar
                                  </div>
                                </div>
                                {item.clientPhone ? (
                                  <button
                                    type="button"
                                    onClick={handleWhatsAppClick}
                                    title={`Enviar recordatorio por WhatsApp a ${item.client}`}
                                    style={{
                                      width: 28,
                                      height: 28,
                                      borderRadius: "50%",
                                      background: "#25d366",
                                      border: "none",
                                      cursor: "pointer",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      color: "#fff",
                                      fontSize: 13,
                                      boxShadow: "0 2px 6px rgba(37, 211, 102, 0.35)",
                                      transition: "transform .12s ease"
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.12)" }}
                                    onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)" }}
                                  >
                                    💬
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      <div style={{
                        padding: "6px 10px",
                        background: "#f9fafb",
                        borderTop: `1px solid ${C.border}`,
                        fontSize: 8.5,
                        color: C.textSoft,
                        textAlign: "center"
                      }}>
                        👉 Clic en un turno para verlo en la planilla
                      </div>
                    </>
                  ) : (
                    <div style={{ padding: "16px 12px", textAlign: "center", fontSize: 11, color: C.textSoft }}>
                      No hay turnos adeudados pendientes de días anteriores.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Calendar popup */}
      {calendarOpen && activeView === "turnos" && (
        <>
          <div onClick={() => setCalendarOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 299 }} />
          <div onClick={e => e.stopPropagation()} style={{
            position: "fixed",
            bottom: isMobile ? "calc(76px + env(safe-area-inset-bottom))" : 76,
            right: isMobile ? "auto" : 12,
            left: isMobile ? "50%" : "auto",
            transform: isMobile ? "translateX(-50%)" : "none",
            width: 320,
            maxWidth: "92vw",
            zIndex: 300,
            background: isLiquid ? "rgba(255, 255, 255, 0.45)" : C.white,
            backdropFilter: isLiquid ? "blur(30px) saturate(200%)" : "none",
            WebkitBackdropFilter: isLiquid ? "blur(30px) saturate(200%)" : "none",
            borderRadius: 16,
            border: isLiquid ? "1px solid rgba(255, 255, 255, 0.55)" : `1.5px solid ${C.border}`,
            boxShadow: isLiquid ? "0 8px 32px rgba(31, 38, 135, 0.08), inset 0 1px 1px rgba(255, 255, 255, 0.3)" : `0 8px 24px ${C.shadow}`,
            padding: "16px 20px 20px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14 }}>
              <button onClick={prevMonth} style={{ width: 30, height: 30, borderRadius: "50%", border: `1px solid ${C.border}`, background: C.white, color: C.green, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>‹</button>
              <div style={{ fontSize: 14, color: C.text, fontWeight: "bold", minWidth: 160, textAlign: "center" }}>{MESES_ES[vm - 1].charAt(0).toUpperCase() + MESES_ES[vm - 1].slice(1)} {vy}</div>
              <button onClick={nextMonth} style={{ width: 30, height: 30, borderRadius: "50%", border: `1px solid ${C.border}`, background: C.white, color: C.green, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>›</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,36px)", gap: 4, marginBottom: 6 }}>
              {["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"].map(d => <div key={d} style={{ width: 36, textAlign: "center", fontSize: 9, letterSpacing: "1px", textTransform: "uppercase", color: d === "Do" ? "#d0b0b0" : C.textSoft, fontFamily: "Georgia,serif" }}>{d}</div>)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,36px)", gap: 4 }}>
              {cells.map((day, idx) => {
                if (!day) return <div key={idx} style={{ width: 36, height: 36 }} />
                const dow = idx % 7, isSun = dow === 6, dk = `${vy}-${String(vm).padStart(2, "0")}-${String(day).padStart(2, "0")}`, isCur = dk === currentDate, isToday = dk === tKey, hasAppts = Object.keys((allData || {})[dk] || {}).length > 0
                return (
                  <button key={idx} disabled={isSun} onClick={() => { setCurrentDate(dk); setCalendarOpen(false) }} style={{ width: 36, height: 36, borderRadius: 10, position: "relative", border: `1.5px solid ${isCur ? C.green : isToday ? C.greenMint : (isLiquid ? "rgba(255,255,255,0.4)" : C.border)}`, background: isCur ? `linear-gradient(135deg,${C.green},${C.greenLight})` : isToday ? C.greenPale : hasAppts ? (isLiquid ? "rgba(255,255,255,0.6)" : "#f5faf5") : (isLiquid ? "rgba(255,255,255,0.25)" : C.white), color: isCur ? "#fff" : isSun ? "#e0cece" : isToday ? C.green : C.text, fontSize: 12, fontWeight: isCur || isToday ? "bold" : "normal", cursor: isSun ? "not-allowed" : "pointer", fontFamily: "Georgia,serif", transition: "all .12s", boxShadow: isLiquid ? "inset 0 1px 1px rgba(255,255,255,0.3)" : "none" }}>
                    {day}
                    {hasAppts && <div style={{ position: "absolute", bottom: 2, left: "50%", transform: "translateX(-50%)", width: 4, height: 4, borderRadius: "50%", background: isCur ? "rgba(255,255,255,.8)" : C.green }} />}
                  </button>
                )
              })}
            </div>
            <button onClick={() => setCalendarOpen(false)} style={{ marginTop: 14, padding: "5px 20px", borderRadius: 20, border: `1px solid ${C.border}`, background: "transparent", color: C.textSoft, fontSize: 9, letterSpacing: "1.5px", textTransform: "uppercase", cursor: "pointer", fontFamily: "Georgia,serif" }}>Cerrar</button>
          </div>
        </>
      )}

      {/* Bottom date strip & controls */}
      {activeView === "turnos" && currentDate && (() => {
        if (isMobile) {
          return (
            <>
              {/* Backdrop para cerrar el abanico al tocar fuera */}
              {isFanOpen && (
                <div
                  onClick={() => setIsFanOpen(false)}
                  style={{
                    position: "fixed",
                    inset: 0,
                    zIndex: 115,
                    background: "rgba(0,0,0,0.18)",
                    backdropFilter: "blur(2px)",
                    WebkitBackdropFilter: "blur(2px)"
                  }}
                />
              )}

              {/* Contenedor móvil: Flecha izquierda, Botón central con abanico, Flecha derecha */}
              <div
                className="mobile-bottom-controls"
                style={{
                  position: "fixed",
                  bottom: "calc(74px + env(safe-area-inset-bottom))",
                  left: 16,
                  right: 16,
                  zIndex: 120,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  pointerEvents: "none"
                }}
              >
                {/* Esquina Izquierda: Día anterior */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    playClickSound()
                    setCurrentDate(d => nextWorkDay(d, -1))
                  }}
                  title="Día hábil anterior"
                  style={{
                    pointerEvents: "auto",
                    width: 46,
                    height: 46,
                    borderRadius: "50%",
                    border: isLiquid ? "1px solid rgba(255, 255, 255, 0.6)" : `1.5px solid ${C.border}`,
                    background: isLiquid ? "rgba(255, 255, 255, 0.75)" : C.white,
                    backdropFilter: isLiquid ? "blur(25px) saturate(200%)" : "none",
                    WebkitBackdropFilter: isLiquid ? "blur(25px) saturate(200%)" : "none",
                    boxShadow: isLiquid ? "0 8px 24px rgba(31, 38, 135, 0.12), inset 0 1px 1px rgba(255, 255, 255, 0.4)" : `0 4px 16px ${C.shadow}`,
                    color: C.green,
                    fontSize: 22,
                    fontWeight: "bold",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    transition: "transform .15s ease, background .2s ease",
                    outline: "none"
                  }}
                  onTouchStart={(e) => { e.currentTarget.style.transform = "scale(0.92)" }}
                  onTouchEnd={(e) => { e.currentTarget.style.transform = "scale(1)" }}
                >
                  <span style={{ marginTop: -2, marginRight: 1 }}>‹</span>
                </button>

                {/* Centro: Botón Principal + Abanico Desplegable */}
                <div
                  style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    pointerEvents: "none"
                  }}
                >
                  {/* Botones del Abanico */}
                  {fanItems.map((item, idx) => {
                    const rad = (item.angle * Math.PI) / 180
                    const tx = Math.round(84 * Math.cos(rad))
                    const ty = Math.round(-84 * Math.sin(rad))

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          playClickSound()
                          setIsFanOpen(false)
                          item.action()
                        }}
                        title={item.label}
                        style={{
                          position: "absolute",
                          width: 44,
                          height: 44,
                          borderRadius: "50%",
                          border: item.border || (isLiquid ? "1px solid rgba(255, 255, 255, 0.65)" : `1.5px solid ${C.border}`),
                          background: item.bg || (isLiquid ? "rgba(255, 255, 255, 0.85)" : C.white),
                          backdropFilter: isLiquid ? "blur(20px)" : "none",
                          WebkitBackdropFilter: isLiquid ? "blur(20px)" : "none",
                          boxShadow: item.shadow || (isLiquid ? "0 8px 24px rgba(0, 0, 0, 0.12)" : `0 4px 16px ${C.shadow}`),
                          color: item.color || C.text,
                          fontSize: item.fontSize || 18,
                          fontWeight: item.fontWeight || "normal",
                          fontFamily: item.fontFamily || "inherit",
                          letterSpacing: item.letterSpacing || "normal",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          pointerEvents: isFanOpen ? "auto" : "none",
                          opacity: isFanOpen ? 1 : 0,
                          transform: isFanOpen
                            ? `translate(${tx}px, ${ty}px) scale(1)`
                            : `translate(0px, 0px) scale(0.2)`,
                          transition: isFanOpen
                            ? `transform .32s cubic-bezier(0.34, 1.56, 0.64, 1) ${idx * 28}ms, opacity .22s ease ${idx * 28}ms`
                            : `transform .22s cubic-bezier(0.4, 0, 0.2, 1) ${(4 - idx) * 20}ms, opacity .18s ease ${(4 - idx) * 20}ms`,
                          zIndex: 119
                        }}
                      >
                        {item.content}
                        {item.badge && (
                          <div
                            style={{
                              position: "absolute",
                              top: -2,
                              right: -2,
                              width: 11,
                              height: 11,
                              borderRadius: "50%",
                              backgroundColor: "#ff4d4f",
                              border: `1.5px solid ${C.white}`,
                              boxShadow: "0 2px 5px rgba(0,0,0,0.25)",
                              pointerEvents: "none"
                            }}
                          />
                        )}
                      </button>
                    )
                  })}

                  {/* Botón Central Trigger */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      playClickSound()
                      setIsFanOpen(prev => !prev)
                    }}
                    title={isFanOpen ? "Cerrar menú" : "Abrir opciones de turnos"}
                    style={{
                      pointerEvents: "auto",
                      width: 52,
                      height: 52,
                      borderRadius: "50%",
                      border: isFanOpen
                        ? "2px solid rgba(255, 255, 255, 0.85)"
                        : (isLiquid ? "1.5px solid rgba(255, 255, 255, 0.6)" : "none"),
                      background: isFanOpen
                        ? "linear-gradient(135deg, #e8793a, #d97706)"
                        : `linear-gradient(135deg, ${C.green}, ${C.greenLight})`,
                      boxShadow: isFanOpen
                        ? "0 8px 26px rgba(232, 121, 58, 0.5)"
                        : `0 8px 24px ${C.green}55`,
                      color: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      outline: "none",
                      position: "relative",
                      transition: "transform .25s cubic-bezier(0.34, 1.56, 0.64, 1), background .25s ease, box-shadow .25s ease",
                      transform: isFanOpen ? "scale(1.05)" : "scale(1)",
                      zIndex: 121
                    }}
                    onTouchStart={(e) => { e.currentTarget.style.transform = isFanOpen ? "scale(1)" : "scale(0.94)" }}
                    onTouchEnd={(e) => { e.currentTarget.style.transform = isFanOpen ? "scale(1.05)" : "scale(1)" }}
                  >
                    <span
                      style={{
                        fontSize: 26,
                        lineHeight: 1,
                        display: "inline-block",
                        transition: "transform .28s cubic-bezier(0.34, 1.56, 0.64, 1)",
                        transform: isFanOpen ? "rotate(135deg)" : "rotate(0deg)"
                      }}
                    >
                      +
                    </span>
                    {!isFanOpen && hasUncheckedTasks && (
                      <div
                        style={{
                          position: "absolute",
                          top: 2,
                          right: 2,
                          width: 12,
                          height: 12,
                          borderRadius: "50%",
                          backgroundColor: "#ff4d4f",
                          border: "2px solid #ffffff",
                          boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
                          pointerEvents: "none"
                        }}
                      />
                    )}
                  </button>
                </div>

                {/* Esquina Derecha: Día siguiente */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    playClickSound()
                    setCurrentDate(d => nextWorkDay(d, 1))
                  }}
                  title="Día hábil siguiente"
                  style={{
                    pointerEvents: "auto",
                    width: 46,
                    height: 46,
                    borderRadius: "50%",
                    border: isLiquid ? "1px solid rgba(255, 255, 255, 0.6)" : `1.5px solid ${C.border}`,
                    background: isLiquid ? "rgba(255, 255, 255, 0.75)" : C.white,
                    backdropFilter: isLiquid ? "blur(25px) saturate(200%)" : "none",
                    WebkitBackdropFilter: isLiquid ? "blur(25px) saturate(200%)" : "none",
                    boxShadow: isLiquid ? "0 8px 24px rgba(31, 38, 135, 0.12), inset 0 1px 1px rgba(255, 255, 255, 0.4)" : `0 4px 16px ${C.shadow}`,
                    color: C.green,
                    fontSize: 22,
                    fontWeight: "bold",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    transition: "transform .15s ease, background .2s ease",
                    outline: "none"
                  }}
                  onTouchStart={(e) => { e.currentTarget.style.transform = "scale(0.92)" }}
                  onTouchEnd={(e) => { e.currentTarget.style.transform = "scale(1)" }}
                >
                  <span style={{ marginTop: -2, marginLeft: 1 }}>›</span>
                </button>
              </div>
            </>
          )
        }

        const [y, m] = currentDate.split("-").map(Number)
        const [ty, tm] = tKey.split("-").map(Number)
        const isDiffMonth = y !== ty || m !== tm
        const monthName = MESES_ES[m - 1]
        const daysInMonth = new Date(y, m, 0).getDate()

        return (
          <div className="date-strip" 
            onDragOver={(e) => { e.preventDefault() }}
            style={{
            position: "fixed", bottom: 8, left: 16, right: 16,
            zIndex: 98,
            display: "flex", alignItems: "center", justifyContent: "center",
            pointerEvents: "none",
          }}>
            {/* Island 1: Carousel & Month */}
            <div className="date-carousel-island" 
              onDragOver={(e) => { e.preventDefault() }}
              style={{
              background: isLiquid ? "rgba(255, 255, 255, 0.45)" : C.white,
              backdropFilter: isLiquid ? "blur(30px) saturate(200%)" : "none",
              WebkitBackdropFilter: isLiquid ? "blur(30px) saturate(200%)" : "none",
              borderRadius: 24,
              boxShadow: isLiquid ? "0 8px 32px rgba(31, 38, 135, 0.08), inset 0 1px 1px rgba(255, 255, 255, 0.3)" : `0 4px 20px ${C.shadow}`,
              border: isLiquid ? "1px solid rgba(255, 255, 255, 0.55)" : `1.5px solid ${C.border}`,
              display: "flex", alignItems: "center",
              padding: "6px 12px", gap: 6,
              pointerEvents: "auto",
            }}>
              <button onClick={(e) => {
                e.stopPropagation()
                const prev = new Date(y, m - 2, 1)
                const lastDay = new Date(prev.getFullYear(), prev.getMonth() + 1, 0).getDate()
                const day = Math.min(new Date(currentDate + "T12:00:00").getDate(), lastDay)
                const dk = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                setCurrentDate(dk)
              }} style={{...btnNav, border: "none", background: C.cream, width: 34, height: 34}}>‹</button>

              <div ref={dateStripRef} className="date-carousel-scroll" style={{ flex: 1, overflowX: "auto", WebkitOverflowScrolling: "touch", display: "flex", alignItems: "center", gap: 2 }}>
                <div style={{ flex: 1, minWidth: 0 }} />
                {Array.from({ length: 31 }, (_, i) => {
                  const day = i + 1
                  if (day > daysInMonth) {
                    return <div key={`placeholder-${i}`} style={{ minWidth: 36, height: 46, flexShrink: 0 }} />
                  }
                  const dk = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                  const d = new Date(dk + "T12:00:00")
                  const dow = d.getDay()
                  const isSun = dow === 0
                  const isCur = dk === currentDate
                  const isT = dk === tKey
                  const dayRaw = (allData || {})[dk] || {}
                  const dayAppts = Object.values(dayRaw).filter(v => typeof v === "object" && v !== null)
                  const totalCount = dayAppts.length
                  const paidCount = dayAppts.filter(a => a.paid).length
                  const ratio = totalCount > 0 ? paidCount / totalCount : 0
                  const isClosed = !!dayRaw.closed
                  
                  let dynamicBg = "transparent"
                  let textColor = isSun ? "#ddd" : C.textSoft
                  const useDynamic = config?.dynamicDateColors ?? true
                  
                  if (totalCount > 0 && useDynamic) {
                    const r = Math.round(232 + (58 - 232) * ratio)
                    const g = Math.round(121 + (125 - 121) * ratio)
                    const b = Math.round(58 + (68 - 58) * ratio)
                    const alpha = Math.min(0.15 + (totalCount * 0.12), 0.85)
                    dynamicBg = `rgba(${r}, ${g}, ${b}, ${alpha})`
                    if (alpha > 0.6) textColor = "#fff"
                  }

                  return (
                    <button key={dk} data-active={isCur} disabled={isSun} onClick={() => !isSun && setCurrentDate(dk)} style={{
                      minWidth: 36, height: 46, borderRadius: 10, flexShrink: 0,
                      border: `2px solid ${isCur ? C.gold : (isT ? C.greenMint : "transparent")}`,
                      background: isCur ? `linear-gradient(135deg,${C.gold},${C.goldLight})` : (useDynamic ? dynamicBg : (isT ? C.greenPale : (totalCount > 0 ? "#f5faf5" : "transparent"))),
                      color: isCur ? "#fff" : textColor,
                      fontSize: 9, fontFamily: "Georgia,serif", cursor: isSun ? "default" : "pointer",
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                      gap: 1, padding: "0 4px", position: "relative",
                      boxShadow: isCur ? `0 4px 12px ${C.gold}55` : "none",
                      transition: "all .2s ease",
                    }}>
                      {isClosed && <div style={{ position: "absolute", top: 2, right: 2, fontSize: 7, filter: isCur ? "brightness(2)" : "none" }}>🔒</div>}
                      <div style={{ fontSize: 8, letterSpacing: "1px", textTransform: "uppercase", opacity: .7 }}>{["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sá"][dow]}</div>
                      <div style={{ fontSize: 13, fontWeight: isCur || isT || totalCount > 0 ? "bold" : "normal" }}>{day}</div>
                      {totalCount > 0 && <div style={{ position: "absolute", bottom: 3, left: "50%", transform: "translateX(-50%)", width: 4, height: 4, borderRadius: "50%", background: "rgba(255,255,255,.6)" }} />}
                    </button>
                  )
                })}
                <div style={{ flex: 1, minWidth: 0 }} />
              </div>

              <button onClick={(e) => {
                e.stopPropagation()
                const next = new Date(y, m, 1)
                const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
                const day = Math.min(new Date(currentDate + "T12:00:00").getDate(), lastDay)
                const dk = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                setCurrentDate(dk)
              }} style={{...btnNav, border: "none", background: C.cream, width: 34, height: 34}}>›</button>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", marginLeft: 8, marginRight: 4, width: 95, flexShrink: 0 }}>
                <div style={{ fontSize: 11, color: isDiffMonth ? "#e63946" : C.green, fontWeight: "bold", textTransform: "uppercase", letterSpacing: ".8px" }}>{monthName}</div>
                <div style={{ fontSize: 9, color: C.textSoft, opacity: .8, marginTop: -1 }}>{y}</div>
              </div>
            </div>

            {/* Island 3: Notepad (Bottom Left) */}
            <div style={{
              position: "absolute", left: 0,
              background: isLiquid ? "rgba(255, 255, 255, 0.45)" : C.white,
              backdropFilter: isLiquid ? "blur(30px) saturate(200%)" : "none",
              WebkitBackdropFilter: isLiquid ? "blur(30px) saturate(200%)" : "none",
              borderRadius: 24,
              boxShadow: isLiquid ? "0 8px 32px rgba(31, 38, 135, 0.08), inset 0 1px 1px rgba(255, 255, 255, 0.3)" : `0 4px 20px ${C.shadow}`,
              border: isLiquid ? "1px solid rgba(255, 255, 255, 0.55)" : `1.5px solid ${C.border}`,
              display: "flex", alignItems: "center",
              padding: "6px",
              pointerEvents: "auto",
              flexShrink: 0
            }}>
              <div style={{ position: "relative" }}>
                <button 
                  onClick={onOpenNotebook} 
                  style={{
                    width: 46, height: 46, borderRadius: 18, border: `none`,
                    background: C.orangePale,
                    fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all .18s",
                    boxShadow: "none"
                  }}
                  title="Anotador"
                >📝</button>
                {hasUncheckedTasks && (
                  <div style={{
                    position: "absolute",
                    top: -2,
                    right: -2,
                    width: 11,
                    height: 11,
                    borderRadius: "50%",
                    backgroundColor: "#ff4d4f",
                    border: `1.5px solid ${C.orangePale}`,
                    boxShadow: "0 2px 5px rgba(0,0,0,0.18)",
                    pointerEvents: "none",
                    zIndex: 15
                  }} />
                )}
              </div>
            </div>

            {/* Island 2: Actions */}
            <div style={{
              position: "absolute", right: 0,
              background: isLiquid ? "rgba(255, 255, 255, 0.45)" : C.white,
              backdropFilter: isLiquid ? "blur(30px) saturate(200%)" : "none",
              WebkitBackdropFilter: isLiquid ? "blur(30px) saturate(200%)" : "none",
              borderRadius: 24,
              boxShadow: isLiquid ? "0 8px 32px rgba(31, 38, 135, 0.08), inset 0 1px 1px rgba(255, 255, 255, 0.3)" : `0 4px 20px ${C.shadow}`,
              border: isLiquid ? "1px solid rgba(255, 255, 255, 0.55)" : `1.5px solid ${C.border}`,
              display: "flex", alignItems: "center",
              padding: "6px", gap: 6,
              pointerEvents: "auto",
              flexShrink: 0
            }}>
              <button
                className={currentDate !== tKey ? "today-alert-btn" : ""}
                onClick={handleHoyClick}
                title={currentDate !== tKey ? "Haz clic para volver a la fecha de hoy" : "Hoy"}
                style={{
                  width: 46, height: 46, borderRadius: 18,
                  border: `none`,
                  background: currentDate !== tKey
                    ? `linear-gradient(135deg, ${C.orange}, ${C.amber || "#e07b20"})`
                    : C.greenPale,
                  fontSize: 10, fontWeight: "bold",
                  color: currentDate !== tKey ? "#ffffff" : C.green,
                  opacity: 1,
                  cursor: "pointer",
                  fontFamily: "Georgia,serif", letterSpacing: "1px", display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: currentDate !== tKey ? `0 4px 14px rgba(232, 121, 58, 0.45)` : "none",
                  transition: "transform .15s cubic-bezier(0.175, 0.885, 0.32, 1.275), background .2s, opacity .2s, box-shadow .2s",
                  transform: hoyBounce ? "scale(0.85)" : "scale(1)"
                }}
              >HOY</button>
              <button 
                onClick={onOpenSearchTurnos} 
                style={{
                  width: 46, height: 46, borderRadius: 18, border: `none`,
                  background: C.greenPale,
                  fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all .18s",
                  boxShadow: "none"
                }}
                title="Buscar turnos por clienta o teléfono [Tecla B]"
              >🔍</button>
              <button 
                onClick={onOpenHistory} 
                style={{
                  width: 46, height: 46, borderRadius: 18, border: `none`,
                  background: C.orangePale,
                  fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all .18s",
                  boxShadow: "none"
                }}
                title="Historial de movimientos y cambios"
              >🕒</button>
              <button 
                onClick={onQuickGasto} 
                style={{ width: 46, height: 46, borderRadius: 18, border: `none`, background: C.cream, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all .18s" }}
                title="Gasto rápido"
              >💸</button>
              <button onClick={() => setCalendarOpen(v => !v)} style={{ width: 46, height: 46, borderRadius: 18, border: `none`, background: calendarOpen ? `linear-gradient(135deg,${C.green},${C.greenLight})` : C.cream, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all .18s", boxShadow: calendarOpen ? `0 4px 12px ${C.green}55` : "none" }}>📅</button>
            </div>
          </div>
        )
      })()}

      {/* Daily Summary Modal */}
      {dailySummaryOpen && (
        <DailySummaryModal
          isOpen={dailySummaryOpen}
          onClose={() => setDailySummaryOpen(false)}
          currentDate={currentDate}
          totalByMethod={totalByMethod}
          grandTotal={grandTotal}
          scheduledStats={scheduledStats}
          getApptsByMethod={getApptsByMethod}
          pastUnpaidAppts={pastUnpaidAppts}
          onNavigateToTurno={onNavigateToTurno}
          privacyMode={privacyMode}
        />
      )}
    </>
  )
})
