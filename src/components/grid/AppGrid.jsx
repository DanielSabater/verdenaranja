import { useState, useRef, useEffect } from "react"
import { C } from "../../constants/colors.js"
import { PAYMENT_METHODS, HOURS, BLOCKED_COLORS, getBlockedAlphas } from "../../constants/data.js"
import { fmt, cellKey, apptTotal, apptDur, apptPaidTotal, apptComisionableTotal } from "../../utils/appointments.js"
import { Overlay, ModalHeader, GhostBtn, SolidBtn, modalBox } from "../ui/index.jsx"
import { todayKey, fmtDate } from "../../utils/dates.js"
import html2canvas from "html2canvas"

const smallBtn = (color, isMobile) => ({
  padding: isMobile ? "4px 8px" : "6px 12px", borderRadius: 8, border: "none",
  background: color, color: "#fff", fontSize: isMobile ? 12 : 10,
  letterSpacing: "1px", cursor: "pointer",
  fontFamily: "Georgia,serif", opacity: 0.92,
  transition: "opacity .15s",
  fontWeight: "bold",
  display: "flex", alignItems: "center", justifyContent: "center",
})

function ApptCard({
  k, appt, resizePreview, onDragStart, onDragEnd, onEdit, onPay, onDelete,
  appointments, isDragging, isResizeStart, currentTurnKeys, hoveredClientName,
  setHoveredClientName, rgbString, alphas, config, C, HOURS, apptDur,
  apptTotal, apptPaidTotal, isMobile, smallBtn, PAYMENT_METHODS, fmt,
  onResizeStart, span,
}) {
  const [animating, setAnimating] = useState(false)
  const wasPaid = useRef(appt.paid)

  useEffect(() => {
    const prevPaid = wasPaid.current
    wasPaid.current = appt.paid
    if (appt.paid && !prevPaid && !appt.isBlocked && !appt.isNote) {
      setAnimating(true)
      const timer = setTimeout(() => {
        setAnimating(false)
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [appt.paid, appt.isBlocked, appt.isNote])

  const isResizing = resizePreview?.key === k
  const isCurrentTurn = currentTurnKeys.has(k)
  const liveSlots = isResizing ? resizePreview.slots : (span || 1)
  const liveHourIdx = isResizing ? resizePreview.hourIdx : HOURS.indexOf(appt.hour)
  const liveEndIdx = liveHourIdx + liveSlots
  const liveHour = HOURS[liveHourIdx] || appt.hour
  const liveEndHour = liveEndIdx < HOURS.length ? HOURS[liveEndIdx] : "20:00"
  const liveDurMins = liveSlots * 30

  const showPaid = appt.paid && !animating

  return (
    <div
      draggable={!resizePreview}
      onDragStart={e => { if (resizePreview) { e.preventDefault(); return; } onDragStart(e, k) }}
      onDragEnd={onDragEnd}
      onDoubleClick={e => { if (!resizePreview) { e.stopPropagation(); onEdit(k, appointments[k]); } }}
      className={`appt-card${appt.isBlocked ? " blocked" : (appt.isNote ? " note" : (showPaid ? " paid" : " unpaid"))}${isCurrentTurn && !isDragging && !isResizeStart ? " current" : ""}${hoveredClientName && appt.client === hoveredClientName ? " force-hover" : ""}${animating ? " just-paid-glowing" : ""}`}
      style={{
        height: "100%", borderRadius: 9,
        background: appt.isBlocked
          ? `repeating-linear-gradient(
              45deg,
              rgba(${rgbString}, ${alphas.a1}),
              rgba(${rgbString}, ${alphas.a1}) 10px,
              rgba(${rgbString}, ${alphas.a2}) 10px,
              rgba(${rgbString}, ${alphas.a2}) 20px
            )`
          : appt.isNote
            ? "linear-gradient(135deg, #fffbeb, #fff3bf)"
            : showPaid
              ? `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Ctext x='50%25' y='50%25' font-size='18' fill='%233a7d44' opacity='0.1' text-anchor='middle' dominant-baseline='middle' transform='rotate(-25 30 30)'%3E$ %3C/text%3E%3C/svg%3E"), linear-gradient(135deg,${C.greenPale},#d8f0dc)`
              : `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Ctext x='50%25' y='50%25' font-size='14' fill='%23e8793a' opacity='0.08' text-anchor='middle' dominant-baseline='middle' transform='rotate(-20 30 30)'%3E🕒%3C/text%3E%3C/svg%3E"), linear-gradient(135deg,${C.orangePale},#fde8d4)`,
        border: appt.isBlocked
          ? (config.gridStyle === "classic" ? `1px dashed rgba(${rgbString}, ${alphas.border})` : `1.5px dashed rgba(${rgbString}, ${alphas.border})`)
          : appt.isNote
            ? "1.5px solid #ffe066"
            : isResizeStart
              ? `1.5px solid ${C.greenLight}`
              : isCurrentTurn && !isDragging
                ? `1.5px solid #4a90e2`
                : `1.5px solid ${showPaid ? C.greenLight : C.orangeLight}`,
        padding: "6px 7px 6px",
        display: "flex", flexDirection: "column",
        boxShadow: isDragging
          ? `0 10px 30px rgba(58,125,68,.30)`
          : appt.isBlocked
            ? "none"
            : appt.isNote
              ? "0 2px 8px rgba(133, 100, 4, 0.08)"
              : `0 2px 8px ${showPaid ? "rgba(58,125,68,0.1)" : "rgba(232,121,58,0.1)"}`,
        opacity: isDragging ? 0.45 : 1,
        transform: isDragging ? "scale(0.97)" : "scale(1)",
        transition: isResizing ? "none" : "opacity .15s, box-shadow .15s, transform .15s",
        cursor: "grab",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {animating && (
        <>
          <div className="botanical-glow-overlay" />
          <div className="botanical-leaf-particle leaf-1">🍃</div>
          <div className="botanical-leaf-particle leaf-2">🌿</div>
          <div className="botanical-leaf-particle leaf-3">🍃</div>
        </>
      )}

      <div onMouseDown={e => { e.stopPropagation(); onResizeStart(e, k, "top") }}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 8, cursor: "n-resize", zIndex: 10, borderRadius: "9px 9px 0 0" }} />

      {isResizing && (() => {
        const snappedChange = resizePreview.edge === "top"
          ? (resizePreview.hourIdx - resizePreview.origHourIdx) * 100
          : (resizePreview.slots - resizePreview.origSlots) * 100
        const visualDelta = resizePreview.deltaY - snappedChange
        return (
          <div style={{
            position: "absolute",
            top: resizePreview.edge === "top" ? visualDelta : -2,
            bottom: resizePreview.edge === "bottom" ? -visualDelta : -2,
            left: -2, right: -2,
            border: `2px dashed ${C.green}`,
            borderRadius: 9,
            pointerEvents: "none",
            zIndex: 100,
            boxShadow: `0 0 10px rgba(58,125,68,0.2)`
          }} />
        )
      })()}

      {isResizing && (
        <div style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", background: C.green, color: "#fff", borderRadius: 8, padding: "2px 8px", fontSize: 9, fontWeight: "bold", letterSpacing: "1px", whiteSpace: "nowrap", zIndex: 20, pointerEvents: "none", boxShadow: "0 2px 8px rgba(58,125,68,.35)" }}>{liveHour} – {liveEndHour} · {liveDurMins} min</div>
      )}

      <div style={{ position: "absolute", top: 4, right: 5, fontSize: 9, color: "rgba(100,130,100,.4)", pointerEvents: "none", zIndex: 3 }}>⠿</div>

      <div style={{ overflow: "hidden", marginTop: 2, position: "relative", zIndex: 2 }}>
         {appt.isNote ? (
           <div>
             <div style={{ fontSize: 9, fontWeight: "bold", color: "#856404", display: "flex", alignItems: "center", gap: 3, marginBottom: 4 }}>
               <span>📌</span> Anotación
             </div>
             <div style={{ fontSize: 11, color: "#856404", fontWeight: "500", lineHeight: 1.3, whiteSpace: "normal", wordBreak: "break-word" }}>
               {appt.client}
             </div>
             <div style={{ fontSize: 9, color: "rgba(133, 100, 4, 0.7)", marginTop: 6 }}>
               <span style={{ color: isResizing ? C.green : "rgba(133, 100, 4, 0.7)", fontWeight: isResizing ? "bold" : "normal", transition: "color .15s" }}>
                 {isResizing ? `${liveHour} – ${liveEndHour}` : `${apptDur(appt)} min`}
               </span>
             </div>
            </div>
         ) : (
           <>
             <div style={{ fontSize: 11, fontWeight: "bold", color: appt.isBlocked ? C.red : C.text, marginBottom: 1, paddingRight: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
               {appt.isBlocked ? "" : appt.client}
             </div>
             {!appt.isBlocked && (appt.services || []).map((sv, i) => (
               <div key={i} style={{ fontSize: 9, color: showPaid ? C.green : C.orange, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sv.icon} {sv.name}</div>
             ))}
             {appt.notes && (
               <div style={{ fontSize: 9, color: appt.isBlocked ? C.red : C.textSoft, fontStyle: "italic", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", opacity: appt.isBlocked ? 0.8 : 1 }}>📝 {appt.notes}</div>
             )}
             <div style={{ fontSize: 9, color: C.textSoft, marginTop: 2 }}>
                <span style={{ color: isResizing ? C.green : C.textSoft, fontWeight: isResizing ? "bold" : "normal", transition: "color .15s" }}>
                  {isResizing ? `${liveHour} – ${liveEndHour}` : `${apptDur(appt)} min`}
                </span>
                {!appt.isBlocked && <>{" · "}<span style={{ color: C.orange, fontWeight: "bold" }}>{fmt(showPaid ? apptPaidTotal(appt) : apptTotal(appt))}</span></>}
             </div>
           </>
         )}
        {appt.createdAt && (
          <div style={{ fontSize: 8, color: C.textSoft, marginTop: 1, opacity: .7 }}>🕐 Tomado a las {appt.createdAt}</div>
        )}
        {!appt.isBlocked && showPaid && (
          <div style={{ fontSize: 8, color: C.green, marginTop: 1, letterSpacing: ".8px" }}>
            {appt.paymentSplits?.length > 1
              ? appt.paymentSplits.map((r, i) => { const pm = PAYMENT_METHODS.find(m => m.id === r.methodId); return <span key={i} style={{ marginRight: 3 }}>{pm?.icon} {fmt(r.amount)}</span> })
              : <>✓ {PAYMENT_METHODS.find(m => m.id === appt.payMethod)?.icon} {PAYMENT_METHODS.find(m => m.id === appt.payMethod)?.label}</>
            }
          </div>
        )}
        {!appt.isBlocked && appt.tip > 0 && (
          <div style={{ fontSize: 8, color: C.gold, marginTop: 1 }}>🎁 Propina: {fmt(appt.tip)}</div>
        )}
      </div>

      {!appt.isBlocked && (
        <div style={{ position: "absolute", bottom: isMobile ? 4 : 6, right: isMobile ? 4 : 6, display: "flex", alignItems: "center", gap: isMobile ? 3 : 4, zIndex: 12 }}>
          <button onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onDelete(k) }} style={{ width: 22, height: 22, borderRadius: 6, border: `1px solid ${C.border}`, background: "rgba(255,255,255,.9)", color: "#c0a0a0", fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>✕</button>
          {appt.isNote ? (
            <button onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onEdit(k, appointments[k]) }} style={smallBtn(C.green, isMobile)}>{isMobile ? "✏️" : "✏️ Editar"}</button>
          ) : (
            showPaid
              ? (() => {
                const pmColor = PAYMENT_METHODS.find(m => m.id === appt.payMethod)?.color || "#7a9e7a"
                return <button onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onPay(k) }} style={smallBtn(pmColor, isMobile)}>{isMobile ? "✏️" : "✏️ Pago"}</button>
              })()
              : <button onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onPay(k) }} style={smallBtn(C.orange, isMobile)}>{isMobile ? "💰" : "💰 Abonar"}</button>
          )}
        </div>
      )}
      <div onMouseDown={e => { e.stopPropagation(); onResizeStart(e, k, "bottom") }}
        style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 10, cursor: "s-resize", zIndex: 10, borderRadius: "0 0 9px 9px" }} />
    </div>
  )
}

export function AppGrid({
  professionals, appointments, isMobile,
  config,
  draggingKey, dropTarget, dropValid, resizePreview,
  remoteEdits,
  isOccupied, spanOf,
  onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop,
  onResizeStart,
  paidAppts, totalByProf, earningsByProf, comisionPct,
  onCellClick, onEdit, onPay, onDelete,
  CELL_H,
  currentDate,
  quickBlock,
  onToggleTipsRelease,
  activeRama,
}) {
  const [profPopup, setProfPopup] = useState(null)
  const [copiedAgenda, setCopiedAgenda] = useState(false)
  const [hoveredClientName, setHoveredClientName] = useState(null)
  const [colOrder, setColOrder] = useState(() => { try { const v = localStorage.getItem("pv:colOrder"); return v ? JSON.parse(v) : null } catch { return null } })

  const orderedProfessionals = (() => {
    if (!colOrder) return professionals
    const ordered = [...colOrder].map(id => professionals.find(p => p.id === id)).filter(Boolean)
    const missing = professionals.filter(p => !colOrder.includes(p.id))
    return [...ordered, ...missing]
  })()

  const [dragCol, setDragCol] = useState(null) // profId being dragged
  const [dragOver, setDragOverCol] = useState(null) // profId being hovered
  const [menuPos, setMenuPos] = useState(null) // { x, y, profId, hour, hasAppt }
  const dragColRef = useRef(null)
  const scrollContainerRef = useRef(null)
  const isLiquid = config?.liquidGlass ?? true

  // ── Pinch to Zoom mobile cols state & handlers ─────────────────────────────
  const [colsToShow, setColsToShow] = useState(() => {
    try {
      const saved = localStorage.getItem("pv:colsToShow")
      return saved ? Math.max(1, parseInt(saved) || 2) : 2
    } catch {
      return 2
    }
  })
  const [showToast, setShowToast] = useState(false)
  const toastTimeoutRef = useRef(null)
  const touchStartDistRef = useRef(null)
  const lastColsRef = useRef(colsToShow)
  lastColsRef.current = colsToShow

  const colsToShowMobile = Math.min(orderedProfessionals.length, colsToShow)

  const updateColsToShow = (val) => {
    const nextVal = Math.min(orderedProfessionals.length, Math.max(1, val))
    if (nextVal !== lastColsRef.current) {
      setColsToShow(nextVal)
      try { localStorage.setItem("pv:colsToShow", String(nextVal)) } catch {}
      setShowToast(true)
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
      toastTimeoutRef.current = setTimeout(() => setShowToast(false), 1200)
    }
  }

  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el || !isMobile) return

    const onTouchStartN = (e) => {
      if (e.touches.length === 2) {
        if (e.cancelable) e.preventDefault()
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        )
        touchStartDistRef.current = dist
      }
    }

    const onTouchMoveN = (e) => {
      if (e.touches.length === 2 && touchStartDistRef.current !== null) {
        if (e.cancelable) e.preventDefault()
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        )
        const diff = dist - touchStartDistRef.current
        const threshold = 40 // lower threshold for smoother response on mobile
        
        if (Math.abs(diff) > threshold) {
          if (diff > 0) {
            // Pinch apart (zoom in): show more columns (adds a professional)
            if (lastColsRef.current < orderedProfessionals.length) {
              updateColsToShow(lastColsRef.current + 1)
              touchStartDistRef.current = dist
            }
          } else {
            // Pinch together (zoom out): show fewer columns (removes a professional)
            if (lastColsRef.current > 1) {
              updateColsToShow(lastColsRef.current - 1)
              touchStartDistRef.current = dist
            }
          }
        }
      }
    }

    const onTouchEndN = (e) => {
      if (e.touches.length < 2) {
        touchStartDistRef.current = null
      }
    }

    el.addEventListener("touchstart", onTouchStartN, { passive: false })
    el.addEventListener("touchmove", onTouchMoveN, { passive: false })
    el.addEventListener("touchend", onTouchEndN, { passive: true })

    return () => {
      el.removeEventListener("touchstart", onTouchStartN)
      el.removeEventListener("touchmove", onTouchMoveN)
      el.removeEventListener("touchend", onTouchEndN)
    }
  }, [isMobile, orderedProfessionals.length])

  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeEl = document.activeElement
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
         activeEl.tagName === "TEXTAREA" ||
         activeEl.tagName === "SELECT" ||
         activeEl.isContentEditable)
      ) {
        return
      }

      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const container = scrollContainerRef.current
        if (!container) return

        e.preventDefault()

        // 1 hour is 2 slots of 30 mins each (2 * 100px = 200px)
        const scrollAmount = 200
        const currentScroll = container.scrollTop
        const targetScroll = e.key === "ArrowDown" ? currentScroll + scrollAmount : currentScroll - scrollAmount

        container.scrollTo({
          top: targetScroll,
          behavior: "smooth"
        })
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  useEffect(() => {
    const handleScrollEvent = () => {
      const now = new Date()
      const hrs = now.getHours()
      const mins = now.getMinutes()
      
      let closestHour = "09:00"
      let minDiff = Infinity
      
      HOURS.forEach(h => {
        const [hStr, mStr] = h.split(":").map(Number)
        const diff = Math.abs((hrs * 60 + mins) - (hStr * 60 + mStr))
        if (diff < minDiff) {
          minDiff = diff
          closestHour = h
        }
      })
      
      const targetRow = document.querySelector(`[data-hour="${closestHour}"]`)
      const scrollContainer = document.querySelector(".grid-scroll")
      
      if (targetRow && scrollContainer) {
        const containerHeight = scrollContainer.clientHeight
        const rowTop = targetRow.offsetTop
        const rowHeight = targetRow.clientHeight
        
        // Calculate centered scroll position
        const targetScrollTop = rowTop - (containerHeight / 2) + (rowHeight / 2)
        
        scrollContainer.scrollTo({
          top: Math.max(0, targetScrollTop),
          behavior: "smooth"
        })
      }
    }

    window.addEventListener("scroll-to-today-hour", handleScrollEvent)
    
    // Auto-scroll on initial render if the active date is today
    const tKey = todayKey()
    if (currentDate === tKey || (!currentDate && new Date().getDay() !== 0)) {
      setTimeout(handleScrollEvent, 350)
    }

    return () => window.removeEventListener("scroll-to-today-hour", handleScrollEvent)
  }, [HOURS, currentDate])

  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(timer)
  }, [])

  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const startMinutes = 9 * 60
  const endMinutes = 20 * 60
  const isToday = currentDate === todayKey() && currentMinutes >= startMinutes && currentMinutes < endMinutes

  const activeHour = (() => {
    if (!isToday) return null
    let closest = "09:00"
    let minDiff = Infinity
    HOURS.forEach(h => {
      const [hStr, mStr] = h.split(":").map(Number)
      const diff = Math.abs(currentMinutes - (hStr * 60 + mStr))
      if (diff < minDiff) {
        minDiff = diff
        closest = h
      }
    })
    return closest
  })()

  // Check if an hour is outside a professional's schedule for the current date
  const isOutsideSchedule = (prof, hour) => {
    if (!prof.schedule) return false
    const DAYS = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sá"]
    // currentDate format: "2026-05-03"
    const d = currentDate ? new Date(currentDate + "T12:00:00") : new Date()
    const dayName = DAYS[d.getDay()]
    const daySchedule = prof.schedule?.[dayName]
    if (!daySchedule) return false
    if (!daySchedule.active) return true // doesn't work this day
    return hour < daySchedule.from || hour >= daySchedule.to
  }

  const onColDragStart = (profId) => {
    setDragCol(profId)
    dragColRef.current = profId
  }
  const onColDragOver = (e, profId) => {
    e.preventDefault()
    if (dragColRef.current && dragColRef.current !== profId) setDragOverCol(profId)
  }
  const onColDrop = (e, targetId) => {
    e.preventDefault()
    const fromId = dragColRef.current
    if (!fromId || fromId === targetId) { setDragCol(null); setDragOverCol(null); return }
    const base = orderedProfessionals.map(p => p.id)
    const from = base.indexOf(fromId)
    const to = base.indexOf(targetId)
    const next = [...base]
    next.splice(from, 1)
    next.splice(to, 0, fromId)
    setColOrder(next)
    try { localStorage.setItem("pv:colOrder", JSON.stringify(next)) } catch { }
    setDragCol(null)
    setDragOverCol(null)
    dragColRef.current = null
  }
  const onColDragEnd = () => { setDragCol(null); setDragOverCol(null); dragColRef.current = null }

  const currentTurnKeys = (() => {
    const keys = new Set()
    orderedProfessionals.forEach(p => {
      const pAppts = Object.values(appointments).filter(a => a.profId === p.id && !a.isBlocked)
      // Ordenamos de arriba hacia abajo (temprano a tarde)
      pAppts.sort((a, b) => (a.hour || "").localeCompare(b.hour || ""))

      for (let i = 0; i < pAppts.length; i++) {
        if (!pAppts[i].paid) {
          // Si es el primer turno del día o el turno anterior está pago
          if (i === 0 || pAppts[i - 1].paid) {
            keys.add(cellKey(p.id, pAppts[i].hour))
          }
          break // Solo marcamos el primero que cumpla
        }
      }
    })
    return keys
  })()

  const getProfSummary = (profId) => {
    const appts = Object.values(appointments).filter(a => a.profId === profId)
    const paid = appts.filter(a => a.paid)
    const total = paid.reduce((s, a) => s + apptPaidTotal(a), 0)
    const tips = paid.reduce((s, a) => s + (a.tip || 0), 0)
    const byMethod = {}
    paid.forEach(a => {
      if (a.paymentSplits?.length) {
        a.paymentSplits.forEach(sp => { byMethod[sp.methodId] = (byMethod[sp.methodId] || 0) + (parseFloat(sp.amount) || 0) })
      } else if (a.payMethod) {
        byMethod[a.payMethod] = (byMethod[a.payMethod] || 0) + apptPaidTotal(a)
      }
    })
    return { appts, paid, total, tips, byMethod }
  }

  const renderPaymentMethod = (a) => {
    if (!a.paid) return "⏳ Pendiente"
    if (a.paymentSplits?.length) {
      return a.paymentSplits.map((r, i) => {
        const pm = PAYMENT_METHODS.find(m => m.id === r.methodId)
        return <span key={i} style={{ marginRight: 6 }}>{pm?.icon} {fmt(r.amount)}</span>
      })
    }
    const pm = PAYMENT_METHODS.find(m => m.id === a.payMethod)
    return pm ? `${pm.icon} ${pm.label}` : "Pago"
  }

  const handleContextMenu = (e, profId, hour, hasAppt) => {
    e.preventDefault()
    setMenuPos({ x: e.clientX, y: e.clientY, profId, hour, hasAppt })
  }

  const blockedColorConfig = config?.blockedColor || "rojo"
  const blockedOpacityConfig = config?.blockedOpacity || 3
  const activeColorObj = BLOCKED_COLORS.find(c => c.id === blockedColorConfig) || BLOCKED_COLORS[0]
  const rgbString = activeColorObj.rgb
  const alphas = getBlockedAlphas(blockedOpacityConfig)

  if (orderedProfessionals.length === 0) {
    const displayName = String(activeRama || "manos").charAt(0).toUpperCase() + String(activeRama || "manos").slice(1)
    return (
      <div style={{ 
        display: "flex", 
        flexDirection: "column", 
        alignItems: "center", 
        justifyContent: "center", 
        minHeight: 400,
        padding: 40, 
        textAlign: "center",
        background: C.white,
        borderRadius: 18,
        border: `1.5px solid ${C.border}`,
        margin: "20px 14px 100px",
        boxShadow: `0 4px 20px ${C.shadow}`
      }}>
        <div style={{ fontSize: 54, marginBottom: 16 }}>🌿</div>
        <div style={{ fontSize: 16, fontWeight: "bold", color: C.green, fontFamily: "Georgia, serif", marginBottom: 10, letterSpacing: "0.5px" }}>
          Planilla vacía: {displayName}
        </div>
        <div style={{ fontSize: 12, color: C.textSoft, maxWidth: 440, lineHeight: 1.6, marginBottom: 20 }}>
          No hay profesionales asignadas a esta especialidad todavía. Podés asociar profesionales a esta rama desde la pestaña <strong>Configuración ➔ Profesionales</strong>.
        </div>
      </div>
    )
  }

  return (
    <div 
      ref={scrollContainerRef} 
      className="grid-scroll" 
      style={{ touchAction: isMobile ? "pan-x pan-y" : "auto", overflow: "auto", padding: isMobile ? "0 8px 120px 0" : "0 8px 78px", WebkitOverflowScrolling: "touch", maxHeight: "100%", scrollSnapType: isMobile ? "x mandatory" : "none", scrollPaddingLeft: 60, scrollPaddingBottom: isMobile ? 120 : 78 }}
    >
      {showToast && isMobile && (
        <div style={{
          position: "fixed",
          top: 130,
          left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(42, 61, 46, 0.92)",
          backdropFilter: "blur(8px)",
          color: "#fff",
          padding: "8px 18px",
          borderRadius: 20,
          fontSize: 10,
          fontWeight: "bold",
          zIndex: 9999,
          boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
          pointerEvents: "none",
          fontFamily: "Georgia, serif",
          letterSpacing: "0.5px",
          textTransform: "uppercase",
          animation: "fadeIn 0.2s ease"
        }}>
          🔍 {colsToShowMobile} {colsToShowMobile === 1 ? "Profesional" : "Profesionales"}
        </div>
      )}
      <div style={{ paddingTop: 56 }}>
        <table style={{ marginTop: 0, borderCollapse: "collapse", tableLayout: "fixed", width: "100%", minWidth: isMobile ? `calc(52px + ${orderedProfessionals.length} * calc((100vw - 70px) / ${colsToShowMobile}))` : `calc(52px + ${orderedProfessionals.length * 140}px)` }}>
           <thead style={{ position: "sticky", top: 56, zIndex: 100 }}>
             <tr style={{ background: isLiquid ? "rgba(255, 255, 255, 0.45)" : C.white, backdropFilter: isLiquid ? "blur(30px) saturate(200%)" : "none", WebkitBackdropFilter: isLiquid ? "blur(30px) saturate(200%)" : "none", borderBottom: isLiquid ? `2px solid rgba(255,255,255,0.4)` : `2px solid ${C.border}` }}>
               <th style={{ padding: "6px 4px", width: 52, minWidth: 52, position: "sticky", top: 56, left: 0, zIndex: 101, background: isLiquid ? "rgba(255,255,255,0.65)" : C.white, backdropFilter: isLiquid ? "blur(30px) saturate(200%)" : "none", WebkitBackdropFilter: isLiquid ? "blur(30px) saturate(200%)" : "none", borderRight: isLiquid ? `2px solid rgba(255,255,255,0.45)` : `2px solid ${C.border}`, boxShadow: "none" }}>
                 <div style={{ fontSize: 7, letterSpacing: "2px", color: C.textSoft, textTransform: "uppercase", textAlign: "center" }}>Hora</div>
               </th>
               {orderedProfessionals.map((p, idx) => {
                 const tipsCount = Object.values(appointments).filter(a => a.profId === p.id && !a.isBlocked && (a.tip || 0) > 0).length
                 return (
                   <th key={p.id}
                     draggable
                     onDragStart={() => onColDragStart(p.id)}
                     onDragOver={e => onColDragOver(e, p.id)}
                     onDrop={e => onColDrop(e, p.id)}
                     onDragEnd={onColDragEnd}
                     style={{ padding: isMobile ? "6px 2px" : "10px 5px", width: `${100 / orderedProfessionals.length}%`, minWidth: isMobile ? `calc((100vw - 70px) / ${colsToShowMobile})` : 140, transition: "all .2s", opacity: dragCol === p.id ? 0.4 : 1, borderLeft: dragOver === p.id ? `3px solid ${C.green}` : "none", cursor: "grab", scrollSnapAlign: isMobile ? (idx % 2 === 0 ? "none start" : "none") : "none", scrollSnapStop: isMobile ? "always" : "normal", boxShadow: "none", background: "transparent" }}>
                     <div onClick={() => setProfPopup(profPopup === p.id ? null : p.id)}
                       style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: "pointer" }}>
                     <div style={{
                       width: 36, height: 36, borderRadius: "50%",
                       background: profPopup === p.id ? "rgba(255, 255, 255, 0.75)" : "rgba(255, 255, 255, 0.4)",
                       backdropFilter: "blur(10px) saturate(180%)",
                       border: `1.5px solid ${profPopup === p.id ? C.green : "rgba(255, 255, 255, 0.7)"}`,
                       display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
                       transition: "all .2s",
                       boxShadow: "inset 0 1px 3px rgba(255, 255, 255, 0.8), 0 4px 10px rgba(0,0,0,0.03)",
                       position: "relative"
                      }}>{p.emoji}
                        {tipsCount > 0 && Array.from({ length: tipsCount }).map((_, i) => {
                          const startAngle = -210;
                          const endAngle = 30;
                          const angle = tipsCount === 1
                            ? -90
                            : startAngle + (i * (endAngle - startAngle)) / (tipsCount - 1);
                          const rad = (angle * Math.PI) / 180;
                          const R = 19;
                          const giftSize = 14;
                          const left = 18 + R * Math.cos(rad) - giftSize / 2;
                          const top = 18 + R * Math.sin(rad) - giftSize / 2;
                          return (
                            <div key={i} className="prof-badge-tip" style={{
                              position: "absolute",
                              top: top,
                              left: left,
                              width: giftSize,
                              height: giftSize,
                              borderRadius: "50%",
                              background: C.white,
                              border: `1px solid ${C.border}`,
                              boxShadow: "0 2px 5px rgba(0,0,0,0.15)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 8,
                              zIndex: 10 + i
                            }}>🎁</div>
                          );
                        })}
                      </div>
                     <span style={{ fontSize: 11, color: profPopup === p.id ? C.green : C.text, fontWeight: profPopup === p.id ? "bold" : "normal" }}>{p.name}</span>
                   </div>
                 </th>
                )
             })}
          </tr>
        </thead>
        <tbody>
          {HOURS.map((hour, hIdx) => (
            <tr key={hour} data-hour={hour} style={{ background: config.gridStyle === "classic" ? (hIdx % 2 === 0 ? C.white : C.cream) : "transparent", height: 100 }}>
              {/* Hour Cell */}
              {(() => {
                const isActive = activeHour === hour
                const baseBg = hIdx % 2 === 0 ? C.white : C.cream
                return (
                  <td style={{
                    padding: "0 4px",
                    textAlign: "center",
                    position: "sticky",
                    left: 0,
                    zIndex: 5,
                    background: isActive ? C.orangePale : baseBg,
                    borderRight: `2px solid ${C.border}`,
                    borderLeft: isActive ? `4px solid ${C.orange}` : "none",
                    width: 52,
                    minWidth: 52,
                    whiteSpace: "nowrap",
                    height: 100,
                    verticalAlign: "middle",
                    boxShadow: isActive ? `inset 0 0 10px ${C.orange}15` : "none",
                    transition: "all .3s ease",
                  }}>
                    <span style={{
                      fontSize: isActive ? 12 : (hour.endsWith(":00") ? 11 : 9),
                      color: isActive ? C.orange : (hour.endsWith(":00") ? C.green : C.textSoft),
                      fontWeight: isActive || hour.endsWith(":00") ? "bold" : "normal",
                      transition: "all .3s ease",
                    }}>
                      {hour}
                    </span>
                  </td>
                )
              })()}
              {orderedProfessionals.map((prof, idx) => {
                const k = cellKey(prof.id, hour)
                const isResizeStart = resizePreview && resizePreview.profId === prof.id && HOURS[resizePreview.hourIdx] === hour
                const isResizeOriginal = resizePreview && resizePreview.key === k

                const appt = isResizeStart ? appointments[resizePreview.key] : appointments[k]
                const span = isResizeStart ? resizePreview.slots : spanOf(prof.id, hour)

                const isCoveredByResize = !isResizeStart && resizePreview && resizePreview.profId === prof.id && (() => {
                  const rStart = resizePreview.hourIdx
                  const rEnd = rStart + resizePreview.slots
                  const hi = HOURS.indexOf(hour)
                  return hi >= rStart && hi < rEnd
                })()

                const isEditingRemote = !appt && remoteEdits?.[k]
                const isBlocked = (!appt && isOccupied(prof.id, hour)) || isCoveredByResize || (isResizeOriginal && !isResizeStart) || isEditingRemote
                if (isBlocked && !isEditingRemote) return null

                const isDragging = draggingKey === k
                const isTarget = dropTarget?.profId === prof.id && dropTarget?.hour === hour

                const offSchedule = !appt && isOutsideSchedule(prof, hour)
                let cellBg = offSchedule ? "rgba(220,60,60,.07)" : ""
                if (!appt && draggingKey) {
                  cellBg = isTarget ? (dropValid ? C.dragOver : C.dragBad) : (offSchedule ? "rgba(220,60,60,.07)" : "")
                }

                return (
                  <td key={prof.id} rowSpan={span || 1}
                    style={{
                      padding: config.gridStyle === "classic" ? 3 : "5px 6px",
                      height: appt ? `${(span || 1) * 100}px` : 100,
                      verticalAlign: "middle",
                      border: config.gridStyle === "classic" ? `1px solid ${C.border}` : "none",
                      background: config.gridStyle === "classic" ? cellBg : (cellBg || "transparent"),
                      transition: "background .12s",
                      cursor: appt ? "grab" : (draggingKey ? "default" : (isEditingRemote ? "not-allowed" : "pointer")),
                      position: "relative",
                      zIndex: (isResizeStart || draggingKey === k) ? 200 : 1,
                    }}
                    onClick={() => !appt && !draggingKey && onCellClick(prof.id, hour)}
                    onMouseEnter={e => {
                      if (!appt && !draggingKey && !resizePreview) e.currentTarget.style.background = C.greenPale
                      if (appt && appt.client) setHoveredClientName(appt.client)
                    }}
                    onMouseLeave={e => {
                      if (!appt && !draggingKey && !resizePreview) e.currentTarget.style.background = ""
                      if (appt && appt.client) setHoveredClientName(null)
                    }}
                    onContextMenu={e => handleContextMenu(e, prof.id, hour, !!appt)}
                    onDragOver={e => !appt && onDragOver(e, prof.id, hour)}
                    onDragLeave={() => !appt && onDragLeave()}
                    onDrop={e => !appt && onDrop(e, prof.id, hour)}
                  >
                    {isEditingRemote && (
                      <div style={{
                        position: "absolute", inset: 4, borderRadius: 8,
                        background: "rgba(255, 165, 0, 0.08)",
                        border: "2.5px dashed rgba(255, 165, 0, 0.4)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        animation: "pulseEditing 1.8s infinite ease-in-out",
                        pointerEvents: "none"
                      }}>
                        <span style={{ fontSize: 8, fontWeight: "bold", color: "orange", letterSpacing: 1, textShadow: "0 0 5px rgba(255,255,255,0.8)" }}>EDITANDO...</span>
                      </div>
                    )}
                    {appt ? (() => {
                      const isResizing = resizePreview?.key === k
                      const isCurrentTurn = currentTurnKeys.has(k)
                      const liveSlots = isResizing ? resizePreview.slots : (span || 1)
                      const liveHourIdx = isResizing ? resizePreview.hourIdx : HOURS.indexOf(appt.hour)
                      const liveEndIdx = liveHourIdx + liveSlots
                      const liveHour = HOURS[liveHourIdx] || appt.hour
                      const liveEndHour = liveEndIdx < HOURS.length ? HOURS[liveEndIdx] : "20:00"
                      const liveDurMins = liveSlots * 30
                      return (
                        <div
                          draggable={!resizePreview}
                          onDragStart={e => { if (resizePreview) { e.preventDefault(); return; } onDragStart(e, k) }}
                          onDragEnd={onDragEnd}
                          onDoubleClick={e => { if (!resizePreview) { e.stopPropagation(); onEdit(k, appointments[k]); } }}
                          className={`appt-card${appt.isBlocked ? " blocked" : (appt.isNote ? " note" : (appt.paid ? " paid" : " unpaid"))}${isCurrentTurn && !isDragging && !isResizeStart ? " current" : ""}${hoveredClientName && appt.client === hoveredClientName ? " force-hover" : ""}`}
                          style={{
                            height: "100%", borderRadius: 9,
                            background: appt.isBlocked
                              ? `repeating-linear-gradient(
                                  45deg,
                                  rgba(${rgbString}, ${alphas.a1}),
                                  rgba(${rgbString}, ${alphas.a1}) 10px,
                                  rgba(${rgbString}, ${alphas.a2}) 10px,
                                  rgba(${rgbString}, ${alphas.a2}) 20px
                                )`
                              : appt.isNote
                                ? "linear-gradient(135deg, #fffbeb, #fff3bf)"
                                : appt.paid
                                  ? `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Ctext x='50%25' y='50%25' font-size='18' fill='%233a7d44' opacity='0.1' text-anchor='middle' dominant-baseline='middle' transform='rotate(-25 30 30)'%3E$ %3C/text%3E%3C/svg%3E"), linear-gradient(135deg,${C.greenPale},#d8f0dc)`
                                  : `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Ctext x='50%25' y='50%25' font-size='14' fill='%23e8793a' opacity='0.08' text-anchor='middle' dominant-baseline='middle' transform='rotate(-20 30 30)'%3E🕒%3C/text%3E%3C/svg%3E"), linear-gradient(135deg,${C.orangePale},#fde8d4)`,
                            border: appt.isBlocked
                              ? (config.gridStyle === "classic" ? `1px dashed rgba(${rgbString}, ${alphas.border})` : `1.5px dashed rgba(${rgbString}, ${alphas.border})`)
                              : appt.isNote
                                ? "1.5px solid #ffe066"
                                : isResizeStart
                                  ? `1.5px solid ${C.greenLight}`
                                  : isCurrentTurn && !isDragging
                                    ? `1.5px solid #4a90e2`
                                    : `1.5px solid ${appt.paid ? C.greenLight : C.orangeLight}`,
                            padding: "6px 7px 6px",
                            display: "flex", flexDirection: "column",
                            boxShadow: isDragging
                              ? `0 10px 30px rgba(58,125,68,.30)`
                              : appt.isBlocked
                                ? "none"
                                : appt.isNote
                                  ? "0 2px 8px rgba(133, 100, 4, 0.08)"
                                  : `0 2px 8px ${appt.paid ? "rgba(58,125,68,0.1)" : "rgba(232,121,58,0.1)"}`,
                            opacity: isDragging ? 0.45 : 1,
                            transform: isDragging ? "scale(0.97)" : "scale(1)",
                            transition: isResizing ? "none" : "opacity .15s, box-shadow .15s, transform .15s",
                            cursor: "grab",
                            position: "relative",
                            overflow: "visible",
                          }}
                        >
                          <div onMouseDown={e => { e.stopPropagation(); onResizeStart(e, k, "top") }}
                            style={{ position: "absolute", top: 0, left: 0, right: 0, height: 8, cursor: "n-resize", zIndex: 10, borderRadius: "9px 9px 0 0" }} />

                          {isResizing && (() => {
                            const snappedChange = resizePreview.edge === "top"
                              ? (resizePreview.hourIdx - resizePreview.origHourIdx) * 100
                              : (resizePreview.slots - resizePreview.origSlots) * 100
                            const visualDelta = resizePreview.deltaY - snappedChange
                            return (
                              <div style={{
                                position: "absolute",
                                top: resizePreview.edge === "top" ? visualDelta : -2,
                                bottom: resizePreview.edge === "bottom" ? -visualDelta : -2,
                                left: -2, right: -2,
                                border: `2px dashed ${C.green}`,
                                borderRadius: 9,
                                pointerEvents: "none",
                                zIndex: 100,
                                boxShadow: `0 0 10px rgba(58,125,68,0.2)`
                              }} />
                            )
                          })()}

                          {isResizing && (
                            <div style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", background: C.green, color: "#fff", borderRadius: 8, padding: "2px 8px", fontSize: 9, fontWeight: "bold", letterSpacing: "1px", whiteSpace: "nowrap", zIndex: 20, pointerEvents: "none", boxShadow: "0 2px 8px rgba(58,125,68,.35)" }}>{liveHour} – {liveEndHour} · {liveDurMins} min</div>
                          )}

                          <div style={{ position: "absolute", top: 4, right: 5, fontSize: 9, color: "rgba(100,130,100,.4)", pointerEvents: "none" }}>⠿</div>

                          <div style={{ overflow: "hidden", marginTop: 2 }}>
                             {appt.isNote ? (
                               <div>
                                 <div style={{ fontSize: 9, fontWeight: "bold", color: "#856404", display: "flex", alignItems: "center", gap: 3, marginBottom: 4 }}>
                                   <span>📌</span> Anotación
                                 </div>
                                 <div style={{ fontSize: 11, color: "#856404", fontWeight: "500", lineHeight: 1.3, whiteSpace: "normal", wordBreak: "break-word" }}>
                                   {appt.client}
                                 </div>
                                 <div style={{ fontSize: 9, color: "rgba(133, 100, 4, 0.7)", marginTop: 6 }}>
                                   <span style={{ color: isResizing ? C.green : "rgba(133, 100, 4, 0.7)", fontWeight: isResizing ? "bold" : "normal", transition: "color .15s" }}>
                                     {isResizing ? `${liveHour} – ${liveEndHour}` : `${apptDur(appt)} min`}
                                   </span>
                                 </div>
                                </div>
                             ) : (
                               <>
                                 <div style={{ fontSize: 11, fontWeight: "bold", color: appt.isBlocked ? C.red : C.text, marginBottom: 1, paddingRight: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                   {appt.isBlocked ? "" : appt.client}
                                 </div>
                                 {!appt.isBlocked && (appt.services || []).map((sv, i) => (
                                   <div key={i} style={{ fontSize: 9, color: appt.paid ? C.green : C.orange, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sv.icon} {sv.name}</div>
                                 ))}
                                 {appt.notes && (
                                   <div style={{ fontSize: 9, color: appt.isBlocked ? C.red : C.textSoft, fontStyle: "italic", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", opacity: appt.isBlocked ? 0.8 : 1 }}>📝 {appt.notes}</div>
                                 )}
                                 <div style={{ fontSize: 9, color: C.textSoft, marginTop: 2 }}>
                                    <span style={{ color: isResizing ? C.green : C.textSoft, fontWeight: isResizing ? "bold" : "normal", transition: "color .15s" }}>
                                      {isResizing ? `${liveHour} – ${liveEndHour}` : `${apptDur(appt)} min`}
                                    </span>
                                    {!appt.isBlocked && <>{" · "}<span style={{ color: C.orange, fontWeight: "bold" }}>{fmt(appt.paid ? apptPaidTotal(appt) : apptTotal(appt))}</span></>}
                                 </div>
                               </>
                             )}
                            {appt.createdAt && (
                              <div style={{ fontSize: 8, color: C.textSoft, marginTop: 1, opacity: .7 }}>🕐 Tomado a las {appt.createdAt}</div>
                            )}
                            {!appt.isBlocked && appt.paid && (
                              <div style={{ fontSize: 8, color: C.green, marginTop: 1, letterSpacing: ".8px" }}>
                                {appt.paymentSplits?.length > 1
                                  ? appt.paymentSplits.map((r, i) => { const pm = PAYMENT_METHODS.find(m => m.id === r.methodId); return <span key={i} style={{ marginRight: 3 }}>{pm?.icon} {fmt(r.amount)}</span> })
                                  : <>✓ {PAYMENT_METHODS.find(m => m.id === appt.payMethod)?.icon} {PAYMENT_METHODS.find(m => m.id === appt.payMethod)?.label}</>
                                }
                              </div>
                            )}
                            {!appt.isBlocked && appt.tip > 0 && (
                              <div style={{ fontSize: 8, color: C.gold, marginTop: 1 }}>🎁 Propina: {fmt(appt.tip)}</div>
                            )}
                          </div>

                          {!appt.isBlocked && (
                            <div style={{ position: "absolute", bottom: isMobile ? 4 : 6, right: isMobile ? 4 : 6, display: "flex", alignItems: "center", gap: isMobile ? 3 : 4, zIndex: 5 }}>
                              <button onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onDelete(k) }} style={{ width: 22, height: 22, borderRadius: 6, border: `1px solid ${C.border}`, background: "rgba(255,255,255,.9)", color: "#c0a0a0", fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>✕</button>
                              {appt.isNote ? (
                                <button onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onEdit(k, appointments[k]) }} style={smallBtn(C.green, isMobile)}>{isMobile ? "✏️" : "✏️ Editar"}</button>
                              ) : (
                                appt.paid
                                  ? (() => {
                                    const pmColor = PAYMENT_METHODS.find(m => m.id === appt.payMethod)?.color || "#7a9e7a"
                                    return <button onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onPay(k) }} style={smallBtn(pmColor, isMobile)}>{isMobile ? "✏️" : "✏️ Pago"}</button>
                                  })()
                                  : <button onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onPay(k) }} style={smallBtn(C.orange, isMobile)}>{isMobile ? "💰" : "💰 Abonar"}</button>
                              )}
                            </div>
                          )}

                          <div onMouseDown={e => { e.stopPropagation(); onResizeStart(e, k, "bottom") }}
                            style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 10, cursor: "s-resize", zIndex: 10, borderRadius: "0 0 9px 9px" }} />
                        </div>
                      )
                    })() : (
                      config.gridStyle === "classic" ? (
                        <div style={{ height: 42, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", color: isTarget && dropValid ? C.green : (isTarget ? "#e06060" : C.textSoft), fontSize: isTarget ? 22 : 10, letterSpacing: "0.5px", transition: "all .12s" }}>
                          {isTarget ? (dropValid ? "✓" : "✕") : (hour.endsWith(":00") || hour.endsWith(":30") ? hour : "")}
                        </div>
                      ) : (
                        <div style={{
                          height: "100%",
                          borderRadius: 9,
                          border: `1.5px dashed rgba(205, 224, 208, 0.75)`,
                          background: "rgba(255, 255, 255, 0.4)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: isTarget && dropValid ? C.green : (isTarget ? "#e06060" : C.textSoft),
                          fontSize: isTarget ? 22 : 10,
                          letterSpacing: "0.5px",
                          transition: "all .15s ease",
                          boxShadow: "inset 0 1px 3px rgba(0,0,0,0.01)"
                        }}>
                          {isTarget ? (dropValid ? "✓" : "✕") : (hour.endsWith(":00") || hour.endsWith(":30") ? hour : "")}
                        </div>
                      )
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>

        <tfoot>
          <tr style={{ borderTop: `2px solid ${C.greenMint}` }}>
            <td style={{ position: "sticky", left: 0, zIndex: 5, background: C.white, borderRight: `2px solid ${C.border}`, width: 52 }} />
            {orderedProfessionals.map((prof, idx) => {
              const t = totalByProf(prof.id)
              const cnt = paidAppts.filter(a => a.profId === prof.id).length
              return (
                <td key={prof.id} style={{ padding: "6px 4px", textAlign: "center", scrollSnapAlign: isMobile ? (idx % 2 === 0 ? "none start" : "none") : "none", scrollSnapStop: isMobile ? "always" : "normal" }}>
                  <div style={{ background: t > 0 ? C.greenPale : "#f5f5f5", border: `1px solid ${t > 0 ? C.greenMint : "#e5e5e5"}`, borderRadius: 10, padding: "6px 4px", transition: "all .3s" }}>
                    <div style={{ fontSize: 14, fontWeight: "bold", color: t > 0 ? C.green : "#ccc" }}>{fmt(t)}</div>
                    <div style={{ fontSize: 8, color: t > 0 ? C.textSoft : "#ccc", letterSpacing: "1px" }}>{cnt} abonado{cnt !== 1 ? "s" : ""}</div>
                  </div>
                </td>
              )
            })}
          </tr>
          <tr style={{ borderTop: `1px dashed ${C.goldLight}` }}>
            <td style={{ position: "sticky", left: 0, zIndex: 5, background: C.white, borderRight: `2px solid ${C.border}`, width: 52 }} />
            {orderedProfessionals.map((prof, idx) => {
              const e = earningsByProf(prof.id)
              return (
                <td key={prof.id} style={{ padding: "6px 4px", textAlign: "center", scrollSnapAlign: isMobile ? (idx % 2 === 0 ? "none start" : "none") : "none", scrollSnapStop: isMobile ? "always" : "normal" }}>
                  <div style={{ background: e > 0 ? C.goldPale : "#f5f5f5", border: `1px solid ${e > 0 ? C.goldLight : "#e5e5e5"}`, borderRadius: 10, padding: "6px 4px", transition: "all .3s" }}>
                    <div style={{ fontSize: 13, fontWeight: "bold", color: e > 0 ? C.gold : "#ccc" }}>{fmt(e)}</div>
                    <div style={{ fontSize: 8, color: e > 0 ? "#b07820" : "#ccc", letterSpacing: "1px" }}>ganancia</div>
                  </div>
                </td>
              )
            })}
          </tr>
        </tfoot>
      </table>
    </div>
      {profPopup && (() => {
        const prof = professionals.find(p => p.id === profPopup)
        if (!prof) return null
        const s = getProfSummary(prof.id)
        const sortedAppts = [...s.appts]
          .filter(a => !a.isBlocked)
          .sort((a, b) => (a.hour || "").localeCompare(b.hour || ""))

        const exportDailyAsPng = () => {
          const element = document.getElementById("prof-daily-receipt-capture")
          if (!element) return
          html2canvas(element, {
            scale: 2,
            backgroundColor: "#ffffff",
            useCORS: true
          }).then(canvas => {
            canvas.toBlob(blob => {
              if (!blob) return

              // 1. Download image file
              const dataUrl = URL.createObjectURL(blob)
              const link = document.createElement("a")
              link.download = `Agenda_${prof.name}_${currentDate || todayKey()}.png`
              link.href = dataUrl
              document.body.appendChild(link)
              link.click()
              document.body.removeChild(link)
              URL.revokeObjectURL(dataUrl)

              // 2. Copy image to clipboard and open WhatsApp
              const triggerWhatsApp = () => {
                let opened = false
                const handleBlur = () => { opened = true }
                window.addEventListener("blur", handleBlur)
                
                // Attempt to open native WhatsApp client
                window.location.href = "whatsapp://"
                
                setTimeout(() => {
                  window.removeEventListener("blur", handleBlur)
                  if (!opened) {
                    window.open("https://web.whatsapp.com/", "_blank")
                  }
                }, 1500)
              }

              try {
                navigator.clipboard.write([
                  new ClipboardItem({
                    [blob.type]: blob
                  })
                ]).then(() => {
                  triggerWhatsApp()
                }).catch(err => {
                  console.error("Clipboard copy failed, opening WhatsApp anyway:", err)
                  triggerWhatsApp()
                })
              } catch (err) {
                console.error("Clipboard not supported, opening WhatsApp anyway:", err)
                triggerWhatsApp()
              }
            }, "image/png")
          }).catch(err => {
            console.error("Error exporting PNG:", err)
            alert("Error al exportar a PNG")
          })
        }

        const copyDailyToClipboard = () => {
          const element = document.getElementById("prof-daily-receipt-capture")
          if (!element) return
          html2canvas(element, {
            scale: 2,
            backgroundColor: "#ffffff",
            useCORS: true
          }).then(canvas => {
            canvas.toBlob(blob => {
              if (!blob) return

              try {
                navigator.clipboard.write([
                  new ClipboardItem({
                    [blob.type]: blob
                  })
                ]).then(() => {
                  setCopiedAgenda(true)
                  setTimeout(() => setCopiedAgenda(false), 2000)
                }).catch(err => {
                  console.error("Clipboard copy failed:", err)
                  alert("No se pudo copiar al portapapeles automáticamente")
                })
              } catch (err) {
                console.error("Clipboard not supported:", err)
                alert("Tu navegador no soporta la copia de imágenes al portapapeles")
              }
            }, "image/png")
          }).catch(err => {
            console.error("Error exporting PNG:", err)
            alert("Error al exportar a PNG")
          })
        }

        return (
          <Overlay onClose={() => setProfPopup(null)}>
            <>
              <div
                className="prof-summary-sheet"
                style={{
                  position: "fixed",
                  top: "68px",
                  bottom: isMobile ? "calc(166px + env(safe-area-inset-bottom))" : "80px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: isMobile ? "calc(100vw - 24px)" : "min(900px, calc(100vw - 32px))",
                  display: "flex",
                  flexDirection: "column",
                  background: C.white,
                  borderRadius: 18,
                  boxShadow: "0 24px 80px rgba(20,60,30,.16)",
                  border: `1px solid ${C.border}`,
                  overflow: "hidden",
                  padding: 0,
                  zIndex: 201,
                }}
              >
                <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
                  <ModalHeader emoji={prof.emoji} sub="Resumen de turnos">
                    {prof.name} · {s.appts.length} turno{s.appts.length !== 1 ? "s" : ""}
                  </ModalHeader>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10, marginBottom: 16 }}>
                    {[
                      ["📅 Turnos", s.appts.length, C.textSoft],
                      ["✅ Cobrados", s.paid.length, C.green],
                      ["💰 Total", fmt(s.total), C.orange],
                    ].map(([label, val, col]) => (
                      <div key={label} style={{ background: C.cream, borderRadius: 12, padding: "10px 12px" }}>
                        <div style={{ fontSize: 9, color: C.textSoft, letterSpacing: "1px" }}>{label}</div>
                        <div style={{ fontSize: 15, color: col, fontWeight: "bold", marginTop: 6 }}>{val}</div>
                      </div>
                    ))}

                    {/* Propinas Card */}
                    <div style={{ 
                      background: C.cream, 
                      borderRadius: 12, 
                      padding: "10px 12px", 
                      display: "flex", 
                      flexDirection: "column", 
                      justifyContent: "space-between",
                      minHeight: 65,
                      position: "relative"
                    }}>
                      <div>
                        <div style={{ fontSize: 9, color: C.textSoft, letterSpacing: "1px" }}>🎁 Propinas</div>
                        <div style={{ fontSize: 15, color: C.gold, fontWeight: "bold", marginTop: 6 }}>{fmt(s.tips)}</div>
                      </div>
                      {s.tips > 0 && (() => {
                        const pPaidApptsWithTips = s.paid.filter(a => (a.tip || 0) > 0)
                        const isTipsReleased = pPaidApptsWithTips.length > 0 && pPaidApptsWithTips.every(a => a.tipReleased)
                        return (
                          <button
                            onClick={() => onToggleTipsRelease(prof.id, !isTipsReleased)}
                            style={{
                              marginTop: 8,
                              padding: "4px 8px",
                              borderRadius: 6,
                              border: "none",
                              background: isTipsReleased ? `linear-gradient(135deg, #2d6a36, ${C.green})` : `linear-gradient(135deg, ${C.gold}, ${C.goldLight})`,
                              color: "#fff",
                              fontSize: 8,
                              fontWeight: "bold",
                              cursor: "pointer",
                              transition: "all .15s ease-in-out",
                              letterSpacing: "0.5px",
                              boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 3,
                              outline: "none"
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.85"; e.currentTarget.style.transform = "scale(1.03)" }}
                            onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "scale(1)" }}
                          >
                            {isTipsReleased ? "✓ ENTREGADA" : "🔓 LIBERAR"}
                          </button>
                        )
                      })()}
                    </div>
                  </div>

                  {Object.keys(s.byMethod).length > 0 && (
                    <div style={{ marginBottom: 18 }}>
                      <div style={{ fontSize: 10, letterSpacing: "2px", color: C.textSoft, textTransform: "uppercase", marginBottom: 8 }}>Por método de pago</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
                        {PAYMENT_METHODS.filter(pm => s.byMethod[pm.id] > 0).map(pm => (
                          <div key={pm.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: C.textSoft }}>
                            <span>{pm.icon} {pm.label}</span>
                            <span style={{ fontWeight: "bold", color: pm.color }}>{fmt(s.byMethod[pm.id])}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ fontSize: 10, letterSpacing: "2px", color: C.textSoft, textTransform: "uppercase", marginBottom: 10 }}>Detalle de turnos</div>
                  {sortedAppts.length > 0 ? (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 10 }}>
                      {sortedAppts.map((a, index) => (
                        <div key={index} style={{ borderRadius: 14, border: `1px solid ${C.border}`, padding: 12, background: C.white }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", marginBottom: 6 }}>
                            <div style={{ fontSize: 12, fontWeight: "bold", color: C.text }}>{a.hour} · {a.client}</div>
                            <div style={{ fontSize: 11, color: a.paid ? C.green : C.orange, fontWeight: "bold" }}>
                              {a.paid ? fmt(apptPaidTotal(a)) : "⏳ Pendiente"}
                            </div>
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                            {(a.services || []).map((sv, i) => (
                              <span key={i} style={{ fontSize: 11, color: C.textSoft, background: C.cream, borderRadius: 10, padding: "4px 8px" }}>
                                {sv.icon} {sv.name}
                              </span>
                            ))}
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", fontSize: 11, color: C.textSoft }}>
                            <span>{renderPaymentMethod(a)}</span>
                            {a.tip > 0 && <span style={{ color: C.gold }}>🎁 {fmt(a.tip)}</span>}
                          </div>
                          {a.notes && (
                            <div style={{ marginTop: 8, fontSize: 10, color: C.textSoft, fontStyle: "italic" }}>📝 {a.notes}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: C.textSoft, fontStyle: "italic", textAlign: "center", padding: "22px 0" }}>Sin turnos registrados para esta profesional.</div>
                  )}
                </div>
                <div style={{ borderTop: `1px solid ${C.border}`, padding: 14, background: C.cream, display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <GhostBtn onClick={() => setProfPopup(null)}>Cerrar</GhostBtn>
                  <SolidBtn onClick={exportDailyAsPng} color={C.orange}>
                    Descargar / Compartir Agenda
                  </SolidBtn>
                  <SolidBtn onClick={copyDailyToClipboard} color={C.green}>
                    {copiedAgenda ? "✓ Copiado" : "Copiar al portapapeles"}
                  </SolidBtn>
                </div>
              </div>

              {/* Offscreen element for PNG Export */}
              <div 
                id="prof-daily-receipt-capture" 
                style={{ 
                  position: "absolute", 
                  left: "-9999px", 
                  top: "-9999px", 
                  width: "385px", 
                  background: C.white, 
                  padding: "24px", 
                  borderRadius: "16px",
                  fontFamily: "Georgia, serif",
                  color: C.text,
                  border: `1.5px solid ${C.border}`
                }}
              >
                {/* Header */}
                <div style={{ textAlign: "center", borderBottom: `1.5px dashed ${C.border}`, paddingBottom: "16px", marginBottom: "16px" }}>
                  <div style={{ fontSize: "14px", fontWeight: "bold", color: C.green, letterSpacing: "1px", textTransform: "uppercase" }}>
                    Detalle de turnos del día
                  </div>
                  <div style={{ fontSize: "20px", fontWeight: "bold", marginTop: "8px" }}>
                    {prof.name}
                  </div>
                  <div style={{ fontSize: "11px", color: C.textSoft, marginTop: "6px", textTransform: "capitalize" }}>
                    {fmtDate(currentDate || todayKey())}
                  </div>
                </div>

                {/* Turnos List */}
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {sortedAppts.length === 0 ? (
                    <div style={{ textAlign: "center", fontSize: "12px", color: C.textSoft, fontStyle: "italic", padding: "20px 0" }}>
                      Sin turnos registrados para hoy.
                    </div>
                  ) : (
                    sortedAppts.map((a, idx) => (
                      <div key={idx} style={{ paddingBottom: "12px", borderBottom: idx === sortedAppts.length - 1 ? "none" : "1px solid #e8f5eb" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "4px" }}>
                          <span style={{ fontSize: "13px", fontWeight: "bold", color: C.text }}>{a.hour}</span>
                          <span style={{ fontSize: "11px", color: a.paid ? C.green : C.orange, fontWeight: "bold" }}>
                            {a.paid ? `Abonado: ${fmt(apptPaidTotal(a))}` : "⏳ Pendiente"}
                          </span>
                        </div>
                        <div style={{ fontSize: "12px", color: C.text, fontWeight: "600", marginBottom: "4px" }}>
                          Clienta: {a.client}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                          {(a.services || []).map((sv, i) => (
                            <span key={i} style={{ fontSize: "10px", color: C.textSoft, background: C.cream, padding: "2px 6px", borderRadius: "8px", border: `1px solid ${C.border}` }}>
                              {sv.icon} {sv.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Total worked summary */}
                {sortedAppts.length > 0 && (() => {
                  const totalWorked = sortedAppts.reduce((sumVal, a) => sumVal + apptPaidTotal(a), 0)
                  const totalComisionable = sortedAppts.reduce((sumVal, a) => sumVal + apptComisionableTotal(a), 0)
                  const totalEarned = totalComisionable * (comisionPct / 100)
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
                      <div style={{ 
                        background: C.cream, 
                        borderRadius: 10, 
                        border: `1px solid ${C.border}`, 
                        padding: "12px 14px", 
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center"
                      }}>
                        <span style={{ fontSize: 11, fontWeight: "bold", color: C.textSoft, letterSpacing: "1px" }}>
                          TOTAL TRABAJADO:
                        </span>
                        <span style={{ fontSize: 16, fontWeight: "bold", color: C.green }}>
                          {fmt(totalWorked)}
                        </span>
                      </div>

                      <div style={{ 
                        background: "#f3faf5", 
                        borderRadius: 10, 
                        border: `1.5px solid ${C.greenMint}`, 
                        padding: "12px 14px", 
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center"
                      }}>
                        <span style={{ fontSize: 11, fontWeight: "bold", color: C.green, letterSpacing: "1px" }}>
                          COMISIÓN ({comisionPct}%):
                        </span>
                        <span style={{ fontSize: 16, fontWeight: "bold", color: C.green }}>
                          {fmt(totalEarned)}
                        </span>
                      </div>
                    </div>
                  )
                })()}

                {/* Footer Note */}
                <div style={{ textAlign: "center", borderTop: `1.5px dashed ${C.border}`, paddingTop: "12px", marginTop: "16px", fontSize: "9px", color: C.textSoft }}>
                  Generado por {config?.empresaNombre || "Perla Verde"}
                </div>
              </div>
            </>
          </Overlay>
        )
      })()}

      {menuPos && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }} onClick={() => setMenuPos(null)}>
          <div style={{
            position: "absolute", top: menuPos.y, left: menuPos.x,
            background: C.white, borderRadius: 12, border: `1px solid ${C.border}`,
            boxShadow: "0 8px 30px rgba(0,0,0,0.15)", overflow: "hidden",
            width: 160, padding: 4, display: "flex", flexDirection: "column", gap: 2,
            animation: "popIn .15s ease-out"
          }} onClick={e => e.stopPropagation()}>
            {!menuPos.hasAppt ? (
              <>
                <div style={{ fontSize: 9, color: C.textSoft, padding: "6px 10px", letterSpacing: "1px", textTransform: "uppercase" }}>Bloqueo Rápido</div>
                <button onClick={() => { quickBlock(menuPos.profId, menuPos.hour, 1); setMenuPos(null) }} style={{ padding: "8px 12px", background: "transparent", border: "none", borderRadius: 8, textAlign: "left", fontSize: 12, cursor: "pointer", color: C.text }}>🔴 30 min</button>
                <button onClick={() => { quickBlock(menuPos.profId, menuPos.hour, 2); setMenuPos(null) }} style={{ padding: "8px 12px", background: "transparent", border: "none", borderRadius: 8, textAlign: "left", fontSize: 12, cursor: "pointer", color: C.text }}>🔴 1 hora</button>
                <button onClick={() => { quickBlock(menuPos.profId, menuPos.hour, 4); setMenuPos(null) }} style={{ padding: "8px 12px", background: "transparent", border: "none", borderRadius: 8, textAlign: "left", fontSize: 12, cursor: "pointer", color: C.text }}>🔴 2 horas</button>
                <button onClick={() => { quickBlock(menuPos.profId, menuPos.hour, 6); setMenuPos(null) }} style={{ padding: "8px 12px", background: "transparent", border: "none", borderRadius: 8, textAlign: "left", fontSize: 12, cursor: "pointer", color: C.text }}>🔴 3 horas</button>
                <div style={{ borderTop: `1px solid ${C.border}`, margin: "2px 4px" }} />
                <button onClick={() => { quickBlock(menuPos.profId, HOURS[0], HOURS.length); setMenuPos(null) }} style={{ padding: "8px 12px", background: "transparent", border: "none", borderRadius: 8, textAlign: "left", fontSize: 12, cursor: "pointer", color: C.red, fontWeight: "bold" }}>🚫 Todo el día</button>
              </>
            ) : (
              <>
                <button onClick={() => { onDelete(cellKey(menuPos.profId, menuPos.hour)); setMenuPos(null) }} style={{ padding: "8px 12px", background: "transparent", border: "none", borderRadius: 8, textAlign: "left", fontSize: 12, cursor: "pointer", color: "#d44a4a" }}>🗑️ Eliminar turno</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
