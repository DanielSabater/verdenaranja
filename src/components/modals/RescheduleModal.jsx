import { useState, useEffect, useMemo } from "react"
import { C } from "../../constants/colors.js"
import { fmtDate, toDateKey, todayKey, nextWorkDay, DIAS_ES, MESES_ES } from "../../utils/dates.js"
import { fmt, apptTotal, apptDur, getApptSlots, getAvailableHoursForDay } from "../../utils/appointments.js"
import { Overlay, ModalHeader, Field, GhostBtn, modalBox } from "../ui/index.jsx"
import { getApptClientPhone, formatWaNumber, generateRescheduleMessage, openWhatsAppLink } from "../../utils/whatsapp.js"

function addCalendarDays(dateKey, numDays) {
  const parts = dateKey.split("-").map(Number)
  const d = new Date(parts[0], parts[1] - 1, parts[2] + numDays, 12, 0, 0)
  return toDateKey(d)
}

function getRamaEmoji(rama) {
  const r = String(rama || "").toLowerCase().trim()
  if (r.includes("mano") || r.includes("uña") || r.includes("nail")) return "💅"
  if (r.includes("pie") || r.includes("pedi")) return "🦶"
  if (r.includes("pelo") || r.includes("peluquer") || r.includes("hair")) return "💇‍♀️"
  if (r.includes("estet") || r.includes("spa") || r.includes("facial") || r.includes("body")) return "🧴"
  if (r.includes("ceja") || r.includes("pestana") || r.includes("pestaña") || r.includes("ojo") || r.includes("lash")) return "👁️"
  return "✨"
}

export function RescheduleContent({
  apptData,
  allData = {},
  allProfessionals = [],
  config = {},
  clientes = [],
  activeRama = "manos",
  onClose,
  onBack,
  onConfirmReschedule,
}) {
  if (!apptData || !apptData.appt) return null

  const { fromDate, fromKey, appt } = apptData
  const clientName = appt.client || "Cliente"
  const isNote = Boolean(appt.isNote)
  const neededSlots = getApptSlots(appt)
  const durationMins = apptDur(appt) || (neededSlots * 30)
  const totalAmount = apptTotal(appt)

  // Teléfono del cliente
  const { phone: clientPhone, cleanName } = useMemo(() => {
    return getApptClientPhone(appt, clientes)
  }, [appt, clientes])

  // Fecha por defecto: la misma semana próxima (+7 días)
  const defaultTargetDate = useMemo(() => {
    return addCalendarDays(fromDate, 7)
  }, [fromDate])

  const [targetDate, setTargetDate] = useState(defaultTargetDate)
  const [calMonth, setCalMonth] = useState(() => defaultTargetDate.slice(0, 7))
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [targetProfId, setTargetProfId] = useState(appt.profId)
  const [selectedHour, setSelectedHour] = useState(appt.hour || "09:00")
  const [sendWhatsApp, setSendWhatsApp] = useState(Boolean(clientPhone))

  // Profesional de origen
  const origProf = useMemo(() => {
    return (allProfessionals || []).find(p => String(p.id) === String(appt.profId)) || { name: "Profesional", emoji: "👤", rama: "manos" }
  }, [allProfessionals, appt.profId])

  // Rama / Plantilla correspondiente a este turno (no se debe mezclar con otras plantillas)
  const turnoRama = useMemo(() => {
    return String(origProf?.rama || apptData?.activeRama || activeRama || "manos")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
  }, [origProf, apptData?.activeRama, activeRama])

  // Lista de profesionales activos ÚNICAMENTE de la plantilla de este turno
  const activeProfessionals = useMemo(() => {
    const list = Array.isArray(allProfessionals) && allProfessionals.length > 0 ? allProfessionals : []
    const filtered = list.filter(p => {
      const pRama = String(p.rama || "manos").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      if (pRama !== turnoRama) return false
      const isActiveOnDate = !p.deletedAt || targetDate < p.deletedAt
      return isActiveOnDate
    })
    if (filtered.length === 0 && origProf) {
      return [origProf]
    }
    return filtered
  }, [allProfessionals, targetDate, turnoRama, origProf])

  const curTargetProf = useMemo(() => {
    return activeProfessionals.find(p => String(p.id) === String(targetProfId)) || origProf
  }, [activeProfessionals, targetProfId, origProf])

  // Sincronizar estado cuando cambie el turno recibido
  useEffect(() => {
    const nextDate = addCalendarDays(fromDate, 7)
    setTargetDate(nextDate)
    setCalMonth(nextDate.slice(0, 7))
    setCalendarOpen(false)
    setTargetProfId(appt.profId)
    setSelectedHour(appt.hour || "09:00")
    setSendWhatsApp(Boolean(clientPhone))
  }, [apptData, clientPhone])

  // Si la profesional seleccionada no pertenece a la plantilla activa, corregir
  useEffect(() => {
    if (activeProfessionals.length > 0 && !activeProfessionals.some(p => String(p.id) === String(targetProfId))) {
      setTargetProfId(activeProfessionals[0].id)
    }
  }, [activeProfessionals, targetProfId])

  // Obtener turnos del día destino
  const targetDayAppts = useMemo(() => {
    return allData[targetDate] || {}
  }, [allData, targetDate])

  // Disponibilidad de horarios para la profesional y fecha elegida
  const ignoreKey = fromDate === targetDate ? fromKey : null
  const hoursAvailability = useMemo(() => {
    return getAvailableHoursForDay(targetDayAppts, targetProfId, neededSlots, ignoreKey)
  }, [targetDayAppts, targetProfId, neededSlots, ignoreKey])

  // Auto-seleccionar horario válido si el seleccionado queda inválido
  useEffect(() => {
    const currentCheck = hoursAvailability.find(h => h.hour === selectedHour)
    if (!currentCheck || !currentCheck.available) {
      const origCheck = hoursAvailability.find(h => h.hour === appt.hour)
      if (origCheck && origCheck.available) {
        setSelectedHour(appt.hour)
      } else {
        const firstAvail = hoursAvailability.find(h => h.available)
        setSelectedHour(firstAvail ? firstAvail.hour : null)
      }
    }
  }, [hoursAvailability, selectedHour, appt.hour])

  const isSelectedAvailable = hoursAvailability.some(h => h.hour === selectedHour && h.available)
  const isSameAsOriginal = fromDate === targetDate && String(targetProfId) === String(appt.profId) && selectedHour === appt.hour
  const isConfirmDisabled = !selectedHour || !isSelectedAvailable || isSameAsOriginal

  // Verificar si la fecha seleccionada es Domingo
  const isSunday = useMemo(() => {
    const parts = targetDate.split("-").map(Number)
    const d = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0)
    return d.getDay() === 0
  }, [targetDate])

  // Helpers de calendario estético personalizado
  const [vy, vm] = useMemo(() => {
    const parts = (calMonth || targetDate.slice(0, 7)).split("-").map(Number)
    return [parts[0], parts[1]]
  }, [calMonth, targetDate])

  const cells = useMemo(() => {
    const firstDay = new Date(vy, vm - 1, 1)
    const lastDay = new Date(vy, vm, 0)
    const startDow = (firstDay.getDay() + 6) % 7 // Lunes = 0, Domingo = 6
    const arr = []
    for (let i = 0; i < startDow; i++) arr.push(null)
    for (let d = 1; d <= lastDay.getDate(); d++) arr.push(d)
    while (arr.length % 7 !== 0) arr.push(null)
    return arr
  }, [vy, vm])

  const prevMonth = (e) => {
    e?.stopPropagation?.()
    let m = vm - 1, y = vy
    if (m < 1) { m = 12; y-- }
    setCalMonth(`${y}-${String(m).padStart(2, "0")}`)
  }

  const nextMonth = (e) => {
    e?.stopPropagation?.()
    let m = vm + 1, y = vy
    if (m > 12) { m = 1; y++ }
    setCalMonth(`${y}-${String(m).padStart(2, "0")}`)
  }

  const handleConfirm = () => {
    if (isConfirmDisabled) return

    onConfirmReschedule({
      fromDate,
      fromKey,
      toDate: targetDate,
      toProfId: targetProfId,
      toHour: selectedHour,
      sendWhatsApp: sendWhatsApp && Boolean(clientPhone),
      clientPhone,
      clientName: cleanName || clientName,
      services: appt.services || [],
      profName: curTargetProf.name,
      dateFormatted: fmtDate(targetDate),
      turnoRama,
    })
    onClose?.()
  }

  // Atajos rápidos de fecha
  const quickDatePresets = [
    { label: "+7 días (Próx. sem.)", days: 7 },
    { label: "+14 días (2 sem.)", days: 14 },
    { label: "+21 días (3 sem.)", days: 21 },
    { label: "Próx. hábil", customDate: nextWorkDay(fromDate, 1) },
  ]

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, height: "100%", width: "100%", overflow: "hidden" }}>
      {/* Cabecera y botón Volver fijos al tope */}
      <div style={{ flexShrink: 0, marginBottom: 8 }}>
        {onBack && (
          <div style={{ marginBottom: 8 }}>
            <button
              type="button"
              onClick={onBack}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                background: "transparent",
                border: `1.5px solid ${C.border}`,
                borderRadius: 20,
                padding: "4px 10px",
                color: C.green,
                fontSize: 11,
                fontFamily: "Georgia, serif",
                fontWeight: "bold",
                cursor: "pointer",
                transition: "all .15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = C.greenPale }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent" }}
              title="Volver a los detalles del turno"
            >
              <span style={{ fontSize: 13, lineHeight: 1 }}>‹</span> Volver al turno
            </button>
          </div>
        )}

        <ModalHeader emoji="📅" sub="Reprogramar Turno">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
            <span>Mover turno de {clientName}</span>
            <span style={{ fontSize: 12, color: C.textSoft, fontWeight: "normal" }}>
              ⏱️ {durationMins} min {totalAmount > 0 && `· ${fmt(totalAmount)}`}
            </span>
          </div>
        </ModalHeader>
      </div>

      {/* Contenido con scroll vertical suave */}
      <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", display: "flex", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: 460, display: "flex", flexDirection: "column", gap: 14, paddingBottom: 16 }}>
          
          {/* Tarjeta de turno actual (Origen) */}
          <div style={{
            background: "#f8faf9",
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: "10px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 4
          }}>
            <div style={{ fontSize: 9, letterSpacing: "1.5px", color: C.textSoft, textTransform: "uppercase", fontWeight: "bold" }}>
              Turno actual agendado
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontSize: 13, color: C.text, fontWeight: "bold" }}>
                📍 {fmtDate(fromDate)} · {appt.hour} hs
              </div>
              <div style={{ fontSize: 12, color: C.green, background: C.greenPale, padding: "2px 8px", borderRadius: 8, fontWeight: "bold" }}>
                {origProf.emoji} {origProf.name}
              </div>
            </div>
            {appt.services && appt.services.length > 0 && (
              <div style={{ fontSize: 11, color: C.textSoft, marginTop: 2 }}>
                {appt.services.map(s => s.name).join(" + ")}
              </div>
            )}
          </div>

          {/* Selector de nueva fecha */}
          <Field label="1. Elegir nueva fecha">
            {/* Botones de acceso rápido */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8, justifyContent: "center" }}>
              {quickDatePresets.map(preset => {
                const calculatedDate = preset.customDate || addCalendarDays(fromDate, preset.days)
                const isSelected = targetDate === calculatedDate
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setTargetDate(calculatedDate)
                      setCalMonth(calculatedDate.slice(0, 7))
                    }}
                    style={{
                      padding: "5px 10px",
                      borderRadius: 16,
                      fontSize: 11,
                      fontWeight: isSelected ? "bold" : "normal",
                      fontFamily: "Georgia, serif",
                      cursor: "pointer",
                      border: `1.5px solid ${isSelected ? C.green : C.border}`,
                      background: isSelected ? C.greenPale : C.white,
                      color: isSelected ? C.green : C.text,
                      transition: "all .15s"
                    }}
                  >
                    {preset.label}
                  </button>
                )
              })}
            </div>

            {/* Recuadro de fecha centrada y selector con calendario estético */}
            <button
              type="button"
              onClick={() => setCalendarOpen(v => !v)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                padding: "10px 16px",
                borderRadius: 12,
                border: `1.5px solid ${calendarOpen ? C.green : C.border}`,
                background: calendarOpen ? C.greenPale : "#f8faf9",
                cursor: "pointer",
                transition: "all .18s ease",
                boxShadow: calendarOpen ? `0 2px 10px ${C.green}18` : "none"
              }}
              title="Hacé clic para ver el calendario interactivo"
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>📅</span>
                <span style={{
                  fontSize: 13,
                  fontWeight: "bold",
                  color: C.green,
                  fontFamily: "Georgia, serif",
                  textAlign: "center",
                  letterSpacing: "0.2px"
                }}>
                  {fmtDate(targetDate)}
                </span>
                <span style={{
                  fontSize: 10,
                  color: calendarOpen ? C.green : C.textSoft,
                  marginLeft: 4,
                  transition: "transform .2s ease",
                  transform: calendarOpen ? "rotate(180deg)" : "rotate(0deg)"
                }}>
                  ▼
                </span>
              </div>
            </button>

            {/* Calendario estético desplegable */}
            {calendarOpen && (
              <div
                style={{
                  marginTop: 8,
                  background: C.white,
                  borderRadius: 14,
                  border: `1px solid ${C.border}`,
                  padding: "14px 16px",
                  boxShadow: "0 4px 16px rgba(58,125,68,.08)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  animation: "fadeIn .18s ease",
                }}
              >
                {/* Navegador de Mes / Año */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", maxWidth: 260, marginBottom: 12 }}>
                  <button
                    type="button"
                    onClick={prevMonth}
                    style={{
                      width: 28, height: 28, borderRadius: "50%",
                      border: `1px solid ${C.border}`, background: C.white,
                      color: C.green, fontSize: 15, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center"
                    }}
                  >
                    ‹
                  </button>
                  <div style={{ fontSize: 13, color: C.text, fontWeight: "bold", fontFamily: "Georgia, serif", textAlign: "center" }}>
                    {MESES_ES[vm - 1].charAt(0).toUpperCase() + MESES_ES[vm - 1].slice(1)} {vy}
                  </div>
                  <button
                    type="button"
                    onClick={nextMonth}
                    style={{
                      width: 28, height: 28, borderRadius: "50%",
                      border: `1px solid ${C.border}`, background: C.white,
                      color: C.green, fontSize: 15, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center"
                    }}
                  >
                    ›
                  </button>
                </div>

                {/* Encabezados de días */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 34px)", gap: 4, marginBottom: 6 }}>
                  {["Lu","Ma","Mi","Ju","Vi","Sá","Do"].map(d => (
                    <div
                      key={d}
                      style={{
                        width: 34, textAlign: "center", fontSize: 9,
                        letterSpacing: "1px", textTransform: "uppercase",
                        color: d === "Do" ? "#d0b0b0" : C.textSoft,
                        fontFamily: "Georgia, serif"
                      }}
                    >
                      {d}
                    </div>
                  ))}
                </div>

                {/* Celdas del mes */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 34px)", gap: 4 }}>
                  {cells.map((day, idx) => {
                    if (!day) return <div key={idx} style={{ width: 34, height: 34 }} />
                    const dow = idx % 7
                    const isSun = dow === 6
                    const dk = `${vy}-${String(vm).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                    const isSelected = dk === targetDate
                    const isToday = dk === todayKey()
                    const hasAppts = Object.keys(allData[dk] || {}).length > 0

                    return (
                      <button
                        key={idx}
                        type="button"
                        disabled={isSun}
                        onClick={() => {
                          setTargetDate(dk)
                          setCalendarOpen(false)
                        }}
                        title={isSun ? "Domingo cerrado" : (hasAppts ? `${day} (con turnos)` : `${day}`)}
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 10,
                          position: "relative",
                          border: `1.5px solid ${isSelected ? C.green : isToday ? C.greenMint : "transparent"}`,
                          background: isSelected
                            ? `linear-gradient(135deg, ${C.green}, ${C.greenLight})`
                            : isToday
                              ? C.greenPale
                              : hasAppts
                                ? "#f4f9f5"
                                : "transparent",
                          color: isSelected ? "#fff" : isSun ? "#d1d5db" : isToday ? C.green : C.text,
                          fontSize: 12,
                          fontWeight: isSelected || isToday ? "bold" : "normal",
                          fontFamily: "Georgia, serif",
                          cursor: isSun ? "not-allowed" : "pointer",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: 0,
                          boxShadow: isSelected ? `0 2px 8px ${C.green}40` : "none",
                          transition: "all .12s",
                        }}
                      >
                        <span>{day}</span>
                        {hasAppts && (
                          <span style={{
                            position: "absolute",
                            bottom: 2,
                            left: "50%",
                            transform: "translateX(-50%)",
                            width: 3,
                            height: 3,
                            borderRadius: "50%",
                            background: isSelected ? "#ffffff" : C.green,
                          }} />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {isSunday && (
              <div style={{ fontSize: 11, color: C.red, marginTop: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                <span>⚠️</span>
                <span>El día seleccionado es domingo (el salón suele estar cerrado).</span>
              </div>
            )}
          </Field>

          {/* Selector de Profesional */}
          <Field label={`2. Profesional a cargo · Plantilla: ${getRamaEmoji(turnoRama)} ${turnoRama.charAt(0).toUpperCase() + turnoRama.slice(1)}`}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {activeProfessionals.map(p => {
                const isChosen = String(p.id) === String(targetProfId)
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setTargetProfId(p.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 12px",
                      borderRadius: 12,
                      border: `1.5px solid ${isChosen ? C.green : C.border}`,
                      background: isChosen ? C.greenPale : C.white,
                      color: isChosen ? C.green : C.text,
                      fontSize: 12,
                      fontWeight: isChosen ? "bold" : "normal",
                      cursor: "pointer",
                      fontFamily: "Georgia, serif",
                      transition: "all .15s",
                      boxShadow: isChosen ? `0 2px 8px ${C.green}20` : "none"
                    }}
                  >
                    <span>{p.emoji || "👤"}</span>
                    <span>{p.name}</span>
                    {String(p.id) === String(appt.profId) && (
                      <span style={{ fontSize: 9, opacity: 0.7 }}>(Actual)</span>
                    )}
                  </button>
                )
              })}
            </div>
          </Field>

          {/* Selector de Horarios disponibles */}
          <Field label={`3. Horarios disponibles (${durationMins} min requeridos)`}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(78px, 1fr))",
              gap: 6,
              padding: "4px 2px"
            }}>
              {hoursAvailability.map(({ hour, available, reason }) => {
                const isSelected = selectedHour === hour
                const isOriginalHour = hour === appt.hour && fromDate === targetDate && String(targetProfId) === String(appt.profId)

                return (
                  <button
                    key={hour}
                    type="button"
                    disabled={!available}
                    onClick={() => setSelectedHour(hour)}
                    title={available ? `Seleccionar ${hour} hs` : `${hour} hs: ${reason || "Ocupado"}`}
                    style={{
                      padding: "7px 4px",
                      borderRadius: 9,
                      textAlign: "center",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontFamily: "Georgia, serif",
                      fontWeight: isSelected ? "bold" : (available ? "500" : "normal"),
                      cursor: available ? "pointer" : "not-allowed",
                      border: `1.5px solid ${isSelected ? C.green : (available ? C.border : "#f1f3f5")}`,
                      background: isSelected 
                        ? C.green 
                        : (available ? (isOriginalHour ? "#f0fdf4" : C.white) : "#f8f9fa"),
                      color: isSelected 
                        ? C.white 
                        : (available ? (isOriginalHour ? C.green : C.text) : "#adb5bd"),
                      opacity: available ? 1 : 0.6,
                      boxShadow: isSelected ? `0 2px 8px ${C.green}40` : "none",
                      transition: "all .15s",
                      position: "relative"
                    }}
                  >
                    {hour}
                    {isSelected && (
                      <span style={{ fontSize: 10, marginLeft: 3 }}>✓</span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Aviso si no hay disponibilidad */}
            {!hoursAvailability.some(h => h.available) && (
              <div style={{
                background: C.redPale || "#fff1f0",
                color: C.red,
                border: "1px solid #fecaca",
                padding: "8px 12px",
                borderRadius: 8,
                fontSize: 11,
                marginTop: 8,
                textAlign: "center"
              }}>
                🚫 No hay huecos de {durationMins} min libres con {curTargetProf.name} en esta fecha. Probá seleccionando otra profesional o cambiando el día.
              </div>
            )}
          </Field>

          {/* Opciones adicionales: Notificar por WhatsApp */}
          {!isNote && (
            <div style={{
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: 10,
              padding: "8px 12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10
            }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, color: "#166534" }}>
                <input
                  type="checkbox"
                  checked={sendWhatsApp && Boolean(clientPhone)}
                  disabled={!clientPhone}
                  onChange={e => setSendWhatsApp(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: C.green, cursor: clientPhone ? "pointer" : "not-allowed" }}
                />
                <span style={{ fontWeight: "bold" }}>
                  📲 Enviar confirmación por WhatsApp a {cleanName || clientName}
                </span>
              </label>

              {clientPhone ? (
                <span style={{ fontSize: 11, color: C.textSoft, background: C.white, padding: "2px 8px", borderRadius: 6, border: "1px solid #bbf7d0" }}>
                  {clientPhone}
                </span>
              ) : (
                <span style={{ fontSize: 10, color: "#9ca3af", fontStyle: "italic" }}>
                  (Sin celular guardado)
                </span>
              )}
            </div>
          )}

          {/* Resumen del cambio */}
          <div style={{
            background: C.orangePale || "#fff7ed",
            border: `1px solid ${C.orange}40`,
            borderRadius: 10,
            padding: "8px 12px",
            fontSize: 12,
            color: C.text,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            flexWrap: "wrap",
            gap: 6
          }}>
            <div style={{ textAlign: "center" }}>
              <span style={{ color: C.textSoft }}>Se moverá a: </span>
              <strong>{fmtDate(targetDate)}</strong> a las <strong>{selectedHour || "--:--"} hs</strong> con <strong>{curTargetProf.name}</strong>
            </div>
            {isSameAsOriginal && (
              <span style={{ fontSize: 11, color: C.orange, fontWeight: "bold" }}>
                (Es el mismo día y horario actual)
              </span>
            )}
          </div>

        </div>
      </div>

      {/* Botones de acción fijados al pie */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexShrink: 0,
        paddingTop: 10,
        background: C.white,
        borderTop: `1px solid ${C.borderLight || "#e9ecef"}`
      }}>
        <GhostBtn onClick={onBack || onClose} style={{ flex: 1 }}>
          {onBack ? "‹ Volver" : "Cancelar"}
        </GhostBtn>
        <GhostBtn
          onClick={handleConfirm}
          disabled={isConfirmDisabled}
          style={{
            flex: 1,
            color: isConfirmDisabled ? "#bbb" : C.green,
            borderColor: isConfirmDisabled ? C.border : C.green,
            fontWeight: "bold",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 5
          }}
        >
          🚀 Confirmar y Mover
        </GhostBtn>
      </div>

    </div>
  )
}

export function RescheduleModal({
  isOpen,
  onClose,
  apptData,
  allData = {},
  allProfessionals = [],
  config = {},
  clientes = [],
  activeRama = "manos",
  onConfirmReschedule,
}) {
  if (!isOpen || !apptData || !apptData.appt) return null

  return (
    <Overlay onClose={onClose}>
      <div
        className="modal-sheet modal-view-transition"
        style={{
          ...modalBox,
          display: "flex",
          flexDirection: "column",
          padding: "24px 24px 18px",
          overflow: "hidden",
          height: "min(680px, calc(100vh - 40px))",
          maxHeight: "92vh",
        }}
      >
        <RescheduleContent
          apptData={apptData}
          allData={allData}
          allProfessionals={allProfessionals}
          config={config}
          clientes={clientes}
          activeRama={activeRama}
          onClose={onClose}
          onConfirmReschedule={onConfirmReschedule}
        />
      </div>
    </Overlay>
  )
}
