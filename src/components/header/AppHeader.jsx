import { memo, useState, useRef, useEffect, useMemo } from "react"
import { C } from "../../constants/colors.js"
import { PAYMENT_METHODS } from "../../constants/data.js"
import { fmt, apptTotal, apptPaidTotal, apptComisionTotal } from "../../utils/appointments.js"
import { AnimatedNumber } from "../ui/index.jsx"
import { MESES_ES, todayKey, fmtDate, nextWorkDay } from "../../utils/dates.js"

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
  professionals, activeRama, setActiveRama, ramas, privacyMode, gastos
}) {
  const isMobileNav = typeof window !== "undefined" && window.innerWidth <= 1100
  const tKey = todayKey()
  const isLiquid = config?.liquidGlass ?? true

  const [metricMenuOpen, setMetricMenuOpen] = useState(false)
  const [selectedMetric, setSelectedMetric] = useState(() => {
    try {
      return localStorage.getItem("pv:selectedHeaderMetric") || "comisiones"
    } catch {
      return "comisiones"
    }
  })

  const handleSelectMetric = (metricId) => {
    setSelectedMetric(metricId)
    try {
      localStorage.setItem("pv:selectedHeaderMetric", metricId)
    } catch (e) {
      console.warn(e)
    }
    playClickSound()
  }

  // Calculate today's values for metrics
  const appointments = allData[currentDate] || {}
  const allProfsMap = useMemo(() => new Set((config?.professionals || []).map(p => p.id)), [config?.professionals])
  const paidAppts = useMemo(() => Object.values(appointments).filter(a => a.paid && allProfsMap.has(a.profId)), [appointments, allProfsMap])

  const grossIncomeToday = useMemo(() => {
    return paidAppts.reduce((s, a) => {
      if (a.paymentSplits?.length) {
        return s + a.paymentSplits.reduce((acc, r) => acc + (parseFloat(r.amount) || 0), 0)
      }
      return s + apptPaidTotal(a)
    }, 0)
  }, [paidAppts])

  const dailyExpensesTotal = useMemo(() => {
    return (gastos || [])
      .filter(g => g.fecha === currentDate)
      .reduce((sum, g) => sum + (parseFloat(g.monto) || 0), 0)
  }, [gastos, currentDate])

  const dailyRealNet = useMemo(() => {
    return grossIncomeToday - grandEarnings - dailyExpensesTotal
  }, [grossIncomeToday, grandEarnings, dailyExpensesTotal])

  const [currentMonthRevenue, prevMonthRevenue, progressPercent, prevMonthVal] = useMemo(() => {
    if (!currentDate) return [0, 0, 0, 1]
    const parts = currentDate.split("-")
    if (parts.length < 2) return [0, 0, 0, 1]
    const year = parseInt(parts[0], 10)
    const month = parseInt(parts[1], 10)
    if (isNaN(year) || isNaN(month)) return [0, 0, 0, 1]

    const currentMonthStr = `${year}-${String(month).padStart(2, "0")}`
    
    let prevMonthVal = month - 1
    let prevYearVal = year
    if (prevMonthVal < 1) {
      prevMonthVal = 12
      prevYearVal = year - 1
    }
    const prevMonthStr = `${prevYearVal}-${String(prevMonthVal).padStart(2, "0")}`

    let currentTotal = 0
    let prevTotal = 0

    Object.keys(allData || {}).forEach(dateStr => {
      const dayAppts = allData[dateStr] || {}
      const isCurrentMonth = dateStr.startsWith(currentMonthStr)
      const isPrevMonth = dateStr.startsWith(prevMonthStr)

      if (isCurrentMonth || isPrevMonth) {
        Object.values(dayAppts).forEach(a => {
          if (a.paid && allProfsMap.has(a.profId)) {
            let apptAmt = 0
            if (a.paymentSplits?.length) {
              apptAmt = a.paymentSplits.reduce((acc, r) => acc + (parseFloat(r.amount) || 0), 0)
            } else {
              apptAmt = apptPaidTotal(a)
            }
            if (isCurrentMonth) currentTotal += apptAmt
            else prevTotal += apptAmt
          }
        })
      }
    })

    const progress = prevTotal > 0
      ? (currentTotal / prevTotal) * 100
      : 0

    return [currentTotal, prevTotal, progress, prevMonthVal]
  }, [allData, currentDate, allProfsMap])

  const prevMonthNameCapitalized = useMemo(() => {
    const prevMonthName = MESES_ES[prevMonthVal - 1] || "Mes Ant."
    return prevMonthName.charAt(0).toUpperCase() + prevMonthName.slice(1)
  }, [prevMonthVal])

  const [dollarRate, setDollarRate] = useState(940)
  useEffect(() => {
    fetch("https://dolarapi.com/v1/dolares/oficial")
      .then(res => res.json())
      .then(data => {
        if (data && data.venta) {
          setDollarRate(data.venta)
        }
      })
      .catch(err => console.warn("Error fetching official dollar rate:", err))
  }, [])

  const fmtUSD = (v) => "US$ " + Math.round(v).toLocaleString("es-AR")

  const METRICS = {
    comisiones: {
      id: "comisiones",
      label: "Suma de Sueldos",
      val: grandEarnings,
      bg: `linear-gradient(135deg,${C.gold},${C.goldLight})`,
      tag: `${config?.comisionPct ?? 40}% Chicas`,
      icon: "👩",
      textColor: C.white,
    },
    ingresos: {
      id: "ingresos",
      label: "Ingresos",
      val: grossIncomeToday,
      bg: `linear-gradient(135deg,${C.green},${C.greenLight})`,
      tag: "Bruto",
      icon: "💰",
      textColor: C.white,
    },
    ingresos_usd: {
      id: "ingresos_usd",
      label: "Ingresos USD",
      val: grossIncomeToday / dollarRate,
      bg: "linear-gradient(135deg,#1d4ed8,#3b82f6)",
      tag: "Bruto USD",
      icon: "💵",
      textColor: C.white,
      isUSD: true
    },
    gastos: {
      id: "gastos",
      label: "Gastos",
      val: dailyExpensesTotal,
      bg: `linear-gradient(135deg,${C.orange},${C.orangeLight})`,
      tag: "Gastos",
      icon: "💸",
      textColor: C.white,
    },
    ganancia: {
      id: "ganancia",
      label: "Ganancia Real",
      val: dailyRealNet,
      bg: dailyRealNet >= 0 ? `linear-gradient(135deg,#2d6a36,${C.green})` : `linear-gradient(135deg,#a03030,#c04040)`,
      tag: "Neto ARS",
      icon: "📈",
      textColor: C.white,
    },
    ganancia_usd: {
      id: "ganancia_usd",
      label: "Ganancia Real USD",
      val: dailyRealNet / dollarRate,
      bg: dailyRealNet >= 0 ? "linear-gradient(135deg,#1e3a8a,#3b82f6)" : "linear-gradient(135deg,#a03030,#c04040)",
      tag: "Neto USD",
      icon: "💵",
      textColor: C.white,
      isUSD: true
    },
    meta_mes_anterior: {
      id: "meta_mes_anterior",
      label: "Progreso vs Mes Anterior",
      val: progressPercent,
      bg: progressPercent >= 100 ? `linear-gradient(135deg,#2d6a36,${C.green})` : `linear-gradient(135deg,${C.gold},${C.goldLight})`,
      tag: `Progreso vs ${prevMonthNameCapitalized.slice(0, 3)}.`,
      icon: "🎯",
      textColor: C.white,
      isPercent: true
    }
  }

  const activeMetric = METRICS[selectedMetric] || METRICS.comisiones
  const hasValue = activeMetric.val !== 0 || activeMetric.id.startsWith("ganancia") || activeMetric.isPercent
  const formatFn = activeMetric.isPercent
    ? (v) => `${v.toFixed(1)}%`
    : (activeMetric.isUSD ? fmtUSD : fmt)
  const metricBg = hasValue ? activeMetric.bg : "#f0f0f0"
  const metricColor = hasValue ? activeMetric.textColor : "#ccc"
  const metricLabelColor = hasValue ? "rgba(255,255,255,.75)" : "#bbb"
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
  const [activeMethod, setActiveMethod] = useState(null)
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

  return (
    <>
      <header style={{ background: isLiquid ? "rgba(255, 255, 255, 0.45)" : C.white, backdropFilter: isLiquid ? "blur(30px) saturate(200%)" : "none", WebkitBackdropFilter: isLiquid ? "blur(30px) saturate(200%)" : "none", borderBottom: isLiquid ? "none" : `1px solid ${C.border}`, padding: "0 14px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: isLiquid ? "0 4px 30px rgba(0, 0, 0, 0.03)" : `0 2px 10px ${C.shadow}`, position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, minHeight: 56, gap: 8 }}>

        {/* Left Container (Logo + Switcher) */}
        <div className="header-left-container">
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 9, flexShrink: 0 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#fff", border: `1px solid ${C.greenMint}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0, boxShadow: `0 2px 8px ${C.shadow}` }}>
              <img src="/logo.png" alt="Logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <div>
              <div style={{ fontSize: 7, letterSpacing: "3px", color: C.orange, textTransform: "uppercase" }}>{config.empresaSubtitulo}</div>
              <div style={{ fontSize: 15, color: C.green, letterSpacing: "1px" }}>{config.empresaNombre}</div>
            </div>
          </div>

          {/* Spacer before switcher to center it dynamically on desktop */}
          {activeView === "turnos" && ramas && ramas.length > 1 && <div className="desktop-nav-container" style={{ flex: 1 }} />}

          {/* Dynamic Branch Switcher - Ultra clean and responsive */}
          {activeView === "turnos" && ramas && ramas.length > 1 && (
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
                const isActive = String(activeRama).trim().toLowerCase() === String(rama).trim().toLowerCase()
                const emoji = getRamaEmoji(rama)
                const displayName = rama.charAt(0).toUpperCase() + rama.slice(1)
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
                      outline: "none"
                    }}
                    onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = C.greenPale } }}
                    onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = "transparent" } }}
                  >
                    <span style={{ fontSize: 12 }}>{emoji}</span>
                    <span className="branch-label-text">{displayName}</span>
                  </button>
                )
              })}
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

          {/* Desktop totals */}
          <div className="desktop-totals" style={{ alignItems: "center", gap: 5 }}>
            {PAYMENT_METHODS.map(pm => {
              const t = totalByMethod(pm.id); const isActive = activeMethod === pm.id; return (
                <div key={pm.id} style={{ position: "relative", flexShrink: 0 }} onMouseEnter={() => setActiveMethod(pm.id)} onMouseLeave={() => setActiveMethod(null)}>
                  <div
                    style={{ background: t > 0 ? (pm.id === "mercadopago" ? C.mpPale : pm.id === "debito" ? C.amberPale : C.greenPale) : "#f7f7f7", border: `1.5px solid ${isActive ? pm.color : (t > 0 ? (pm.id === "mercadopago" ? C.mpMid : pm.id === "debito" ? C.amberMid : C.greenMint) : "#e8e8e8")}`, borderRadius: 9, padding: "5px 9px", textAlign: "center", minWidth: 110, cursor: t > 0 ? "pointer" : "default", transition: "all .15s", boxShadow: isActive ? `0 4px 12px ${pm.color}33` : "none" }}>
                    <div style={{ fontSize: 8, color: t > 0 ? pm.color : "#bbb", textTransform: "uppercase", whiteSpace: "nowrap" }}>{pm.icon} {pm.label}</div>
                    <div className={privacyMode ? "privacy-blur" : ""} style={{ fontSize: 12, fontWeight: "bold", color: t > 0 ? pm.color : "#ccc", fontVariantNumeric: "tabular-nums" }}><AnimatedNumber value={t} formatFn={fmt} />{t > 0 && <span style={{ fontSize: 8, marginLeft: 3 }}>{isActive ? "▲" : "▼"}</span>}</div>
                  </div>

                  {/* Dropdown */}
                  {isActive && t > 0 && (() => {
                    const appts = getApptsByMethod(pm.id)
                    return (
                      <>
                        <div style={{ position: "absolute", top: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)", zIndex: 150, background: C.white, borderRadius: 14, border: `1.5px solid ${pm.color}44`, boxShadow: `0 8px 32px ${pm.color}22`, minWidth: 260, maxWidth: 340, padding: "12px 14px" }}>
                          <div style={{ fontSize: 8, letterSpacing: "2px", color: pm.color, textTransform: "uppercase", marginBottom: 8 }}>{pm.icon} {pm.label} — {currentDate}</div>
                          {appts.length === 0
                            ? <div style={{ fontSize: 11, color: C.textSoft, textAlign: "center", padding: "8px 0" }}>Sin pagos</div>
                            : <>
                              {appts.map((a, i) => (
                                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${C.greenPale}` }}>
                                  <div>
                                    <div style={{ fontSize: 11, color: C.text, fontWeight: "bold" }}>{a.client}</div>
                                    <div style={{ fontSize: 9, color: C.textSoft }}>{a.hour} · {(a.services || []).map(s => s.name).join(", ")}</div>
                                  </div>
                                  <div style={{ fontSize: 13, fontWeight: "bold", color: pm.color }}>{fmt(a.methodAmount)}</div>
                                </div>
                              ))}
                              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, paddingTop: 6, borderTop: `2px solid ${pm.color}33` }}>
                                <div style={{ fontSize: 9, color: C.textSoft }}>{appts.length} pago{appts.length !== 1 ? "s" : ""}</div>
                                <div style={{ fontSize: 13, fontWeight: "bold", color: pm.color }}>{fmt(t)}</div>
                              </div>
                            </>
                          }
                        </div>
                      </>
                    )
                  })()}
                </div>
              )
            })}
            <div style={{ background: grandTotal > 0 ? `linear-gradient(135deg,${C.green},${C.greenLight})` : "#f0f0f0", borderRadius: 10, padding: "6px 12px", textAlign: "center", minWidth: 120, flexShrink: 0 }}>
              <div style={{ fontSize: 7, color: grandTotal > 0 ? "rgba(255,255,255,.7)" : "#bbb", textTransform: "uppercase" }}>Total</div>
              <div className={privacyMode ? "privacy-blur" : ""} style={{ fontSize: 15, fontWeight: "bold", color: grandTotal > 0 ? C.white : "#ccc", fontVariantNumeric: "tabular-nums" }}><AnimatedNumber value={grandTotal} formatFn={fmt} /></div>
            </div>
            <div style={{ position: "relative", flexShrink: 0 }}>
              <div 
                onClick={(e) => {
                  e.stopPropagation()
                  setMetricMenuOpen(p => !p)
                }}
                title={
                  activeMetric.id === "meta_mes_anterior"
                    ? `Recaudado este mes: ${fmt(currentMonthRevenue)} / Meta (${prevMonthNameCapitalized}): ${fmt(prevMonthRevenue)}`
                    : activeMetric.label
                }
                style={{ 
                  background: metricBg, 
                  borderRadius: 9, 
                  padding: "5px 9px", 
                  textAlign: "center", 
                  width: 120,
                  height: "38px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  boxSizing: "border-box",
                  flexShrink: 0,
                  cursor: "pointer",
                  userSelect: "none",
                  boxShadow: metricMenuOpen ? `0 0 0 1.5px ${C.gold}, 0 4px 12px rgba(0,0,0,0.15)` : "none",
                  transition: "all 0.15s ease",
                  border: "1.5px solid transparent"
                }}
              >
                <div style={{ fontSize: 8, color: metricLabelColor, textTransform: "uppercase", whiteSpace: "nowrap" }}>
                  {activeMetric.icon} {activeMetric.tag} <span style={{ fontSize: 6, marginLeft: 2 }}>▼</span>
                </div>
                <div className={privacyMode ? "privacy-blur" : ""} style={{ fontSize: 12, fontWeight: "bold", color: metricColor, fontVariantNumeric: "tabular-nums" }}>
                  <AnimatedNumber value={activeMetric.val} formatFn={formatFn} />
                </div>
              </div>

              {metricMenuOpen && (
                <>
                  <div 
                    onClick={() => setMetricMenuOpen(false)} 
                    style={{ position: "fixed", inset: 0, zIndex: 140 }} 
                  />
                  <div 
                    style={{ 
                      position: "absolute", 
                      top: "calc(100% + 8px)", 
                      right: 0, 
                      zIndex: 150, 
                      background: C.white, 
                      borderRadius: 14, 
                      border: `1.5px solid ${C.border}`, 
                      boxShadow: `0 8px 32px rgba(0,0,0,0.12)`, 
                      minWidth: 200, 
                      padding: "8px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 4
                    }}
                  >
                    <div style={{ fontSize: 8, letterSpacing: "1px", color: C.textSoft, textTransform: "uppercase", padding: "4px 8px 6px", borderBottom: `1px solid ${C.border}`, fontFamily: "Georgia, serif" }}>
                      Seleccionar Métrica
                    </div>
                    {Object.values(METRICS).map((m) => {
                      const isSelected = m.id === selectedMetric
                      return (
                        <button
                          key={m.id}
                          onClick={() => {
                            handleSelectMetric(m.id)
                            setMetricMenuOpen(false)
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "8px 10px",
                            borderRadius: 8,
                            border: "none",
                            background: isSelected ? C.greenPale : "transparent",
                            cursor: "pointer",
                            width: "100%",
                            textAlign: "left",
                            transition: "background 0.15s ease",
                            outline: "none",
                            fontFamily: "Georgia, serif"
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 14 }}>{m.icon}</span>
                            <div>
                              <div style={{ fontSize: 11, color: C.text, fontWeight: isSelected ? "bold" : "normal" }}>{m.label}</div>
                              <div style={{ fontSize: 8, color: C.textSoft }}>{m.tag}</div>
                            </div>
                          </div>
                          <div style={{ fontSize: 11, fontWeight: "bold", color: isSelected ? C.green : C.textSoft, fontVariantNumeric: "tabular-nums" }}>
                            {m.isPercent
                              ? `${m.val.toFixed(1)}%`
                              : (m.isUSD ? fmtUSD(m.val) : fmt(m.val))}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile totals strip */}
      {activeView === "turnos" && (
        <div className="mobile-totals-strip" style={{ background: C.white, borderBottom: `1px solid ${C.border}`, padding: "8px 12px", gap: 6, overflowX: "auto", WebkitOverflowScrolling: "touch", flexShrink: 0 }}>
          {PAYMENT_METHODS.map(pm => {
            const t = totalByMethod(pm.id); return t > 0 ? (
              <div key={pm.id} style={{ background: pm.id === "mercadopago" ? C.mpPale : pm.id === "debito" ? C.amberPale : C.greenPale, border: `1px solid ${pm.id === "mercadopago" ? C.mpMid : pm.id === "debito" ? C.amberMid : C.greenMint}`, borderRadius: 9, padding: "5px 10px", textAlign: "center", minWidth: 100, flexShrink: 0 }}>
                <div style={{ fontSize: 8, color: pm.color, whiteSpace: "nowrap" }}>{pm.icon} {pm.label}</div>
                <div className={privacyMode ? "privacy-blur" : ""} style={{ fontSize: 12, fontWeight: "bold", color: pm.color, fontVariantNumeric: "tabular-nums" }}><AnimatedNumber value={t} formatFn={fmt} /></div>
              </div>
            ) : null
          })}
          {grandTotal > 0 && <div style={{ background: `linear-gradient(135deg,${C.green},${C.greenLight})`, borderRadius: 9, padding: "5px 10px", textAlign: "center", minWidth: 110, flexShrink: 0 }}><div style={{ fontSize: 8, color: "rgba(255,255,255,.8)" }}>Total</div><div className={privacyMode ? "privacy-blur" : ""} style={{ fontSize: 12, fontWeight: "bold", color: "#fff", fontVariantNumeric: "tabular-nums" }}><AnimatedNumber value={grandTotal} formatFn={fmt} /></div></div>}
          {hasValue && (
            <div style={{ position: "relative", flexShrink: 0 }}>
              <div 
                onClick={(e) => {
                  e.stopPropagation()
                  setMetricMenuOpen(p => !p)
                }}
                title={
                  activeMetric.id === "meta_mes_anterior"
                    ? `Recaudado este mes: ${fmt(currentMonthRevenue)} / Meta (${prevMonthNameCapitalized}): ${fmt(prevMonthRevenue)}`
                    : activeMetric.label
                }
                style={{ 
                  background: metricBg, 
                  borderRadius: 9, 
                  padding: "5px 10px", 
                  textAlign: "center", 
                  width: 100, 
                  boxSizing: "border-box",
                  flexShrink: 0,
                  cursor: "pointer",
                  userSelect: "none"
                }}
              >
                <div style={{ fontSize: 8, color: metricLabelColor, whiteSpace: "nowrap" }}>
                  {activeMetric.icon} {activeMetric.tag} <span style={{ fontSize: 6, marginLeft: 2 }}>▼</span>
                </div>
                <div className={privacyMode ? "privacy-blur" : ""} style={{ fontSize: 12, fontWeight: "bold", color: metricColor, fontVariantNumeric: "tabular-nums" }}>
                  <AnimatedNumber value={activeMetric.val} formatFn={formatFn} />
                </div>
              </div>

              {metricMenuOpen && (
                <>
                  <div 
                    onClick={() => setMetricMenuOpen(false)} 
                    style={{ position: "fixed", inset: 0, zIndex: 140 }} 
                  />
                  <div 
                    style={{ 
                      position: "absolute", 
                      bottom: "calc(100% + 8px)", 
                      right: 0, 
                      zIndex: 150, 
                      background: C.white, 
                      borderRadius: 14, 
                      border: `1.5px solid ${C.border}`, 
                      boxShadow: `0 8px 32px rgba(0,0,0,0.12)`, 
                      minWidth: 200, 
                      padding: "8px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 4
                    }}
                  >
                    <div style={{ fontSize: 8, letterSpacing: "1px", color: C.textSoft, textTransform: "uppercase", padding: "4px 8px 6px", borderBottom: `1px solid ${C.border}`, fontFamily: "Georgia, serif" }}>
                      Seleccionar Métrica
                    </div>
                    {Object.values(METRICS).map((m) => {
                      const isSelected = m.id === selectedMetric
                      return (
                        <button
                          key={m.id}
                          onClick={() => {
                            handleSelectMetric(m.id)
                            setMetricMenuOpen(false)
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "8px 10px",
                            borderRadius: 8,
                            border: "none",
                            background: isSelected ? C.greenPale : "transparent",
                            cursor: "pointer",
                            width: "100%",
                            textAlign: "left",
                            transition: "background 0.15s ease",
                            outline: "none",
                            fontFamily: "Georgia, serif"
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 14 }}>{m.icon}</span>
                            <div>
                              <div style={{ fontSize: 11, color: C.text, fontWeight: isSelected ? "bold" : "normal" }}>{m.label}</div>
                              <div style={{ fontSize: 8, color: C.textSoft }}>{m.tag}</div>
                            </div>
                          </div>
                          <div style={{ fontSize: 11, fontWeight: "bold", color: isSelected ? C.green : C.textSoft, fontVariantNumeric: "tabular-nums" }}>
                            {m.isPercent
                              ? `${m.val.toFixed(1)}%`
                              : (m.isUSD ? fmtUSD(m.val) : fmt(m.val))}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Calendar popup */}
      {calendarOpen && activeView === "turnos" && (
        <>
          <div onClick={() => setCalendarOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 299 }} />
          <div onClick={e => e.stopPropagation()} style={{ position: "fixed", bottom: 76, right: 12, width: 320, maxWidth: "92vw", zIndex: 300, background: isLiquid ? "rgba(255, 255, 255, 0.45)" : C.white, backdropFilter: isLiquid ? "blur(30px) saturate(200%)" : "none", WebkitBackdropFilter: isLiquid ? "blur(30px) saturate(200%)" : "none", borderRadius: 16, border: isLiquid ? "1px solid rgba(255, 255, 255, 0.55)" : `1.5px solid ${C.border}`, boxShadow: isLiquid ? "0 8px 32px rgba(31, 38, 135, 0.08), inset 0 1px 1px rgba(255, 255, 255, 0.3)" : `0 8px 24px ${C.shadow}`, padding: "16px 20px 20px", display: "flex", flexDirection: "column", alignItems: "center" }}>
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

      {/* Bottom date strip — fixed, all days of month */}
      {/* Floating date islands */}
      {activeView === "turnos" && currentDate && (() => {
        const [y, m] = currentDate.split("-").map(Number)
        const [ty, tm] = tKey.split("-").map(Number)
        const isDiffMonth = y !== ty || m !== tm
        const monthName = MESES_ES[m - 1]
        const daysInMonth = new Date(y, m, 0).getDate()

        return (
          <div className="date-strip" style={{
            position: "fixed", bottom: 8, left: 16, right: 16,
            zIndex: 98,
            display: "flex", alignItems: "center", justifyContent: "center",
            pointerEvents: "none",
          }}>
            {/* Island 1: Carousel & Month */}
            <div className="date-carousel-island" style={{
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
                onClick={handleHoyClick}
                style={{
                  width: 46, height: 46, borderRadius: 18,
                  border: `none`,
                  background: currentDate === tKey ? C.greenPale : C.cream,
                  fontSize: 10, fontWeight: "bold",
                  color: C.green,
                  opacity: currentDate === tKey ? 0.75 : 1,
                  cursor: "pointer",
                  fontFamily: "Georgia,serif", letterSpacing: "1px", display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "transform .15s cubic-bezier(0.175, 0.885, 0.32, 1.275), background .2s, opacity .2s",
                  transform: hoyBounce ? "scale(0.85)" : "scale(1)"
                }}
              >HOY</button>
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
    </>
  )
})
