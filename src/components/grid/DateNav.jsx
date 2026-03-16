import { useState } from "react"
import { C } from "../../constants/colors.js"
import { DIAS_ES, MESES_ES, todayKey, fmtDate, getWeekDays, nextWorkDay, toDateKey } from "../../utils/dates.js"

export function DateNav({ currentDate, setCurrentDate, calendarOpen, setCalendarOpen, calViewDate, setCalViewDate, allData }) {
  const weekDays = getWeekDays(currentDate)
  const tKey     = todayKey()

  // Calendar helpers
  const [vy, vm] = calViewDate.split("-").map(Number)
  const firstDay  = new Date(vy, vm - 1, 1)
  const lastDay   = new Date(vy, vm, 0)
  const startDow  = (firstDay.getDay() + 6) % 7
  const cells     = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= lastDay.getDate(); d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const prevMonth = () => {
    let m = vm - 1, y = vy
    if (m < 1) { m = 12; y-- }
    setCalViewDate(`${y}-${String(m).padStart(2, "0")}`)
  }
  const nextMonth = () => {
    let m = vm + 1, y = vy
    if (m > 12) { m = 1; y++ }
    setCalViewDate(`${y}-${String(m).padStart(2, "0")}`)
  }

  const btnStyle = {
    width: 34, height: 34, borderRadius: "50%", border: `1px solid ${C.border}`,
    background: C.white, color: C.green, fontSize: 18, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  }

  return (
    <>
      {/* ── Date nav bar ── */}
      <div style={{
        background: C.white, borderBottom: `1px solid ${C.border}`,
        padding: "8px 14px", boxShadow: "0 2px 8px rgba(58,125,68,.05)",
        position: "sticky", top: 56, zIndex: 90,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Prev */}
          <button style={btnStyle} onClick={() => setCurrentDate(d => nextWorkDay(d, -1))}>‹</button>

          {/* Desktop: week pills */}
          <div className="date-nav-pills" style={{ display: "flex", gap: 4, flex: 1, justifyContent: "center", overflow: "hidden" }}>
            {weekDays.map(dk => {
              const d     = new Date(dk + "T12:00:00")
              const isCur = dk === currentDate
              const isT   = dk === tKey
              const has   = Object.keys(allData[dk] || {}).length > 0
              return (
                <button key={dk} onClick={() => setCurrentDate(dk)} style={{
                  padding: "5px 8px", borderRadius: 12, cursor: "pointer", flexShrink: 0,
                  border: `2px solid ${isCur ? C.green : isT ? C.greenMint : "transparent"}`,
                  background: isCur ? `linear-gradient(135deg,${C.green},${C.greenLight})` : isT ? C.greenPale : "transparent",
                  color: isCur ? "#fff" : isT ? C.green : C.textSoft,
                  fontSize: 9, fontFamily: "Georgia,serif", position: "relative",
                  minWidth: 42, textAlign: "center",
                }}>
                  <div style={{ letterSpacing: "1px", textTransform: "uppercase" }}>{DIAS_ES[d.getDay()].slice(0, 3)}</div>
                  <div style={{ fontSize: 13, fontWeight: "bold" }}>{d.getDate()}</div>
                  {has && <div style={{ position: "absolute", bottom: 2, left: "50%", transform: "translateX(-50%)", width: 4, height: 4, borderRadius: "50%", background: isCur ? "rgba(255,255,255,.8)" : C.green }} />}
                </button>
              )
            })}
          </div>

          {/* Mobile: compact date */}
          <div className="date-nav-compact" style={{ display: "none", flex: 1, flexDirection: "column", alignItems: "center" }}>
            <div style={{ fontSize: 11, color: C.green, fontWeight: "bold" }}>{fmtDate(currentDate)}</div>
            {currentDate === tKey && <div style={{ fontSize: 9, color: C.textSoft }}>Hoy</div>}
          </div>

          {/* Next */}
          <button style={btnStyle} onClick={() => setCurrentDate(d => nextWorkDay(d, +1))}>›</button>

          {currentDate !== tKey && (
            <button onClick={() => setCurrentDate(todayKey())} style={{
              padding: "5px 10px", borderRadius: 14,
              border: `1px solid ${C.greenMint}`, background: C.greenPale,
              color: C.green, fontSize: 9, cursor: "pointer",
              fontFamily: "Georgia,serif", letterSpacing: "1px", textTransform: "uppercase", flexShrink: 0,
            }}>Hoy</button>
          )}

          <button onClick={() => setCalendarOpen(v => !v)} style={{
            padding: "5px 10px", borderRadius: 14,
            border: `1px solid ${calendarOpen ? C.green : C.border}`,
            background: calendarOpen ? C.greenPale : C.white,
            color: calendarOpen ? C.green : C.textSoft,
            fontSize: 13, cursor: "pointer", flexShrink: 0,
          }}>📅</button>
        </div>
      </div>

      {/* ── Calendar dropdown ── */}
      {calendarOpen && (
        <div onClick={e => e.stopPropagation()} style={{
          position: "sticky", top: 112, zIndex: 89,
          background: C.white, borderBottom: `2px solid ${C.greenMint}`,
          boxShadow: `0 8px 24px rgba(58,125,68,.12)`,
          padding: "16px 20px 20px",
          display: "flex", flexDirection: "column", alignItems: "center",
        }}>
          {/* Month navigator */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14 }}>
            <button onClick={prevMonth} style={{ width: 30, height: 30, borderRadius: "50%", border: `1px solid ${C.border}`, background: C.white, color: C.green, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>‹</button>
            <div style={{ fontSize: 14, color: C.text, fontWeight: "bold", minWidth: 160, textAlign: "center" }}>
              {MESES_ES[vm - 1].charAt(0).toUpperCase() + MESES_ES[vm - 1].slice(1)} {vy}
            </div>
            <button onClick={nextMonth} style={{ width: 30, height: 30, borderRadius: "50%", border: `1px solid ${C.border}`, background: C.white, color: C.green, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>›</button>
          </div>

          {/* Day headers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,36px)", gap: 4, marginBottom: 6 }}>
            {["Lu","Ma","Mi","Ju","Vi","Sá","Do"].map(d => (
              <div key={d} style={{ width: 36, textAlign: "center", fontSize: 9, letterSpacing: "1px", textTransform: "uppercase", color: d === "Do" ? "#d0b0b0" : C.textSoft, fontFamily: "Georgia,serif" }}>{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,36px)", gap: 4 }}>
            {cells.map((day, idx) => {
              if (!day) return <div key={idx} />
              const dow      = idx % 7
              const isSun    = dow === 6
              const dk       = `${vy}-${String(vm).padStart(2, "0")}-${String(day).padStart(2, "0")}`
              const isCur    = dk === currentDate
              const isToday  = dk === tKey
              const hasAppts = Object.keys(allData[dk] || {}).length > 0
              return (
                <button key={idx} disabled={isSun} onClick={() => { setCurrentDate(dk); setCalendarOpen(false) }} style={{
                  width: 36, height: 36, borderRadius: 10, position: "relative",
                  border: `2px solid ${isCur ? C.green : isToday ? C.greenMint : "transparent"}`,
                  background: isCur ? `linear-gradient(135deg,${C.green},${C.greenLight})` : isToday ? C.greenPale : hasAppts ? C.cream : "transparent",
                  color: isCur ? "#fff" : isSun ? "#e0cece" : isToday ? C.green : C.text,
                  fontSize: 12, fontWeight: isCur || isToday ? "bold" : "normal",
                  cursor: isSun ? "not-allowed" : "pointer",
                  fontFamily: "Georgia,serif", transition: "all .12s",
                }}>
                  {day}
                  {hasAppts && <div style={{ position: "absolute", bottom: 2, left: "50%", transform: "translateX(-50%)", width: 4, height: 4, borderRadius: "50%", background: isCur ? "rgba(255,255,255,.8)" : C.green }} />}
                </button>
              )
            })}
          </div>

          <button onClick={() => setCalendarOpen(false)} style={{ marginTop: 14, padding: "5px 20px", borderRadius: 20, border: `1px solid ${C.border}`, background: "transparent", color: C.textSoft, fontSize: 9, letterSpacing: "1.5px", textTransform: "uppercase", cursor: "pointer", fontFamily: "Georgia,serif" }}>
            Cerrar
          </button>
        </div>
      )}
    </>
  )
}
