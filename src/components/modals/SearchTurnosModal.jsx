import { useState, useMemo, useEffect, useRef } from "react"
import { C } from "../../constants/colors.js"
import { HOURS } from "../../constants/data.js"
import { fmtDate, todayKey } from "../../utils/dates.js"
import { apptTotal, apptDur } from "../../utils/appointments.js"

function normalizeStr(str) {
  if (!str) return ""
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
}

function cleanPhone(phone) {
  if (!phone) return ""
  return String(phone).replace(/\D/g, "")
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

function getRelativeDateLabel(dateKey, tKey) {
  if (dateKey === tKey) return { label: "HOY", color: C.green, bg: C.greenPale, isToday: true, isFuture: false }

  const [y1, m1, d1] = dateKey.split("-").map(Number)
  const [y2, m2, d2] = tKey.split("-").map(Number)
  const dt1 = new Date(y1, m1 - 1, d1)
  const dt2 = new Date(y2, m2 - 1, d2)
  const diffTime = dt1.getTime() - dt2.getTime()
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays === 1) return { label: "MAÑANA", color: C.orange, bg: C.orangePale, isToday: false, isFuture: true }
  if (diffDays === -1) return { label: "AYER", color: C.textSoft, bg: "#f1f3f5", isToday: false, isFuture: false }
  if (diffDays > 1) {
    return {
      label: `EN ${diffDays} DÍAS`,
      color: diffDays <= 7 ? C.green : "#2b8a3e",
      bg: diffDays <= 7 ? C.greenPale : "#ebfbee",
      isToday: false,
      isFuture: true
    }
  }
  return {
    label: `HACE ${Math.abs(diffDays)} DÍAS`,
    color: C.textSoft,
    bg: "#f8f9fa",
    isToday: false,
    isFuture: false
  }
}

export function SearchTurnosModal({
  isOpen,
  onClose,
  allData,
  clientes,
  config,
  onNavigateToTurno,
}) {
  const [searchQuery, setSearchQuery] = useState("")
  const [filterTab, setFilterTab] = useState("proximos") // 'proximos' | 'todos' | 'pasados'
  const inputRef = useRef(null)
  const tKey = todayKey()

  // Auto-focus al abrir
  useEffect(() => {
    if (isOpen) {
      setSearchQuery("")
      setFilterTab("proximos")
      setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 50)
    }
  }, [isOpen])

  // Cerrar con Escape
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  // Mapa de teléfonos de clientes por nombre normalizado
  const clientPhoneMap = useMemo(() => {
    const map = new Map()
    ;(clientes || []).forEach(c => {
      if (c.name) {
        const norm = normalizeStr(c.name)
        if (!map.has(norm) || c.phone) {
          map.set(norm, c)
        }
      }
    })
    return map
  }, [clientes])

  // Mapa de profesionales por ID
  const profsMap = useMemo(() => {
    const map = new Map()
    ;(config?.professionals || []).forEach(p => {
      map.set(p.id, p)
    })
    return map
  }, [config?.professionals])

  // Extraer todos los turnos válidos con metadatos
  const allAppointmentsList = useMemo(() => {
    const list = []
    const safeData = allData || {}

    Object.entries(safeData).forEach(([dateKey, dayObj]) => {
      if (!dayObj || typeof dayObj !== "object") return
      Object.entries(dayObj).forEach(([cellKey, appt]) => {
        if (!appt || typeof appt !== "object") return
        if (appt.isBlocked) return // omitir bloqueos
        const clientName = (appt.client || "").trim()
        if (!clientName && !appt.isNote) return

        const prof = profsMap.get(appt.profId) || { name: "Profesional", rama: "manos" }
        const matchedClient = clientPhoneMap.get(normalizeStr(clientName))
        const phone = matchedClient?.phone || ""
        const durMins = apptDur(appt)
        const total = apptTotal(appt)
        const isFutureOrToday = dateKey >= tKey

        list.push({
          dateKey,
          cellKey,
          hour: appt.hour || cellKey.split("||")[1] || "09:00",
          profId: appt.profId,
          profName: prof.name,
          profRama: prof.rama || "manos",
          clientName: clientName || (appt.isNote ? "Anotación" : "Sin nombre"),
          phone,
          notes: appt.notes || "",
          services: appt.services || [],
          paid: !!appt.paid,
          isNote: !!appt.isNote,
          durMins,
          total,
          isFutureOrToday,
          // Propiedades para búsqueda rápida (exclusivo clientes y teléfonos)
          normClient: normalizeStr(clientName),
          clientWords: normalizeStr(clientName).split(/\s+/).filter(Boolean),
          cleanPhone: cleanPhone(phone),
          normNotes: normalizeStr(appt.notes),
        })
      })
    })

    return list
  }, [allData, profsMap, clientPhoneMap, tKey])

  // Filtrado de turnos según búsqueda y tab
  const filteredTurnos = useMemo(() => {
    const qRaw = searchQuery.trim()
    const qNorm = normalizeStr(qRaw)
    const qDigits = cleanPhone(qRaw)

    let results = allAppointmentsList

    if (qNorm) {
      const scoredResults = []

      results.forEach(item => {
        let score = 0

        // 1. Coincidencias en el Nombre de la Clienta (Máxima Prioridad)
        if (item.normClient === qNorm) {
          score = 100 // Coincidencia exacta completa
        } else if (item.normClient.startsWith(qNorm)) {
          score = 90 // El nombre empieza exactamente con lo tipeado (ej. "Mirta...")
        } else if (item.clientWords.some(w => w.startsWith(qNorm))) {
          score = 80 // Una de las palabras (segundo nombre o apellido) empieza con lo tipeado (ej. "Racing...")
        } else if (item.normClient.includes(qNorm)) {
          score = 70 // El nombre contiene el texto en cualquier posición
        }
        // 2. Coincidencias en Número de Teléfono (si se ingresaron dígitos)
        else if (qDigits && qDigits.length >= 2 && item.cleanPhone.includes(qDigits)) {
          score = item.cleanPhone.startsWith(qDigits) ? 65 : 60
        }
        // 3. Coincidencias secundarias en Observaciones / Notas
        else if (item.normNotes.includes(qNorm)) {
          score = 20
        }

        if (score > 0) {
          scoredResults.push({ ...item, score })
        }
      })

      results = scoredResults
    }

    // Filtro por pestaña
    if (filterTab === "proximos") {
      results = results.filter(i => i.isFutureOrToday)
    } else if (filterTab === "pasados") {
      results = results.filter(i => !i.isFutureOrToday)
    }

    // Ordenamiento:
    // Si hay búsqueda activa: se ordena primero por RELEVANCIA de nombre (score)
    // A igual relevancia (o sin búsqueda): se desempata por fecha
    results.sort((a, b) => {
      if (qNorm) {
        const scoreDiff = (b.score || 0) - (a.score || 0)
        if (scoreDiff !== 0) return scoreDiff
      }

      if (filterTab === "pasados") {
        if (a.dateKey !== b.dateKey) return b.dateKey.localeCompare(a.dateKey)
        return b.hour.localeCompare(a.hour)
      } else {
        // En próximos o todos:
        if (a.isFutureOrToday && !b.isFutureOrToday) return -1
        if (!a.isFutureOrToday && b.isFutureOrToday) return 1

        if (a.isFutureOrToday) {
          // Ambos futuros: el más cercano a hoy primero
          if (a.dateKey !== b.dateKey) return a.dateKey.localeCompare(b.dateKey)
          return a.hour.localeCompare(b.hour)
        } else {
          // Ambos pasados: el más reciente primero
          if (a.dateKey !== b.dateKey) return b.dateKey.localeCompare(a.dateKey)
          return b.hour.localeCompare(a.hour)
        }
      }
    })

    return results
  }, [allAppointmentsList, searchQuery, filterTab])

  if (!isOpen) return null

  return (
    <div
      onClick={e => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 250,
        background: "rgba(18, 38, 22, 0.48)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "16px 12px",
        paddingTop: "min(6vh, 50px)",
        animation: "fadeIn .18s ease-out",
        overflowY: "auto"
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 640,
          background: "#ffffff",
          borderRadius: 22,
          boxShadow: "0 25px 70px -12px rgba(18, 50, 24, 0.28), 0 0 0 1px rgba(58, 125, 68, 0.12)",
          display: "flex",
          flexDirection: "column",
          maxHeight: "88vh",
          overflow: "hidden",
          animation: "scaleUp .2s cubic-bezier(0.16, 1, 0.3, 1)"
        }}
      >
        {/* ── Encabezado y Barra de Búsqueda ── */}
        <div style={{
          padding: "20px 22px 14px",
          borderBottom: `1px solid ${C.border}`,
          background: "linear-gradient(180deg, #ffffff 0%, #faf8f5 100%)"
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 20 }}>🔎</span>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.text, fontFamily: "Georgia, serif", display: "flex", alignItems: "center", gap: 8 }}>
                  Buscador de Turnos
                  <span style={{
                    fontSize: 10,
                    fontWeight: 600,
                    background: C.greenPale,
                    color: C.green,
                    padding: "2px 8px",
                    borderRadius: 12,
                    border: `1px solid ${C.greenMint}`
                  }}>
                    Tecla [B]
                  </span>
                </h3>
                <p style={{ margin: 0, fontSize: 11, color: C.textSoft }}>
                  Buscá por nombre de clienta, número de teléfono o servicio
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              title="Cerrar (Esc)"
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                border: `1px solid ${C.border}`,
                background: "#ffffff",
                color: C.textSoft,
                fontSize: 14,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all .15s"
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = "#fee2e2"
                e.currentTarget.style.color = "#dc2626"
                e.currentTarget.style.borderColor = "#fca5a5"
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = "#ffffff"
                e.currentTarget.style.color = C.textSoft
                e.currentTarget.style.borderColor = C.border
              }}
            >
              ✕
            </button>
          </div>

          {/* Caja de Input Principal */}
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <span style={{
              position: "absolute",
              left: 14,
              fontSize: 17,
              pointerEvents: "none",
              opacity: searchQuery ? 0.9 : 0.5,
              transition: "transform .15s",
              transform: searchQuery ? "scale(1.05)" : "scale(1)"
            }}>
              🔍
            </span>

            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Ej: Florencia, 115432..., Semipermanente..."
              style={{
                width: "100%",
                padding: "13px 40px 13px 44px",
                borderRadius: 14,
                border: `1.5px solid ${searchQuery ? C.green : C.border}`,
                background: "#ffffff",
                fontSize: 14,
                color: C.text,
                fontFamily: "inherit",
                boxShadow: searchQuery
                  ? "0 4px 16px rgba(58, 125, 68, 0.12), 0 0 0 3px rgba(58, 125, 68, 0.08)"
                  : "0 2px 8px rgba(0, 0, 0, 0.03)",
                outline: "none",
                transition: "all .2s"
              }}
            />

            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("")
                  inputRef.current?.focus()
                }}
                style={{
                  position: "absolute",
                  right: 12,
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  border: "none",
                  background: "#e5e7eb",
                  color: "#4b5563",
                  fontSize: 11,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
                title="Limpiar búsqueda"
              >
                ✕
              </button>
            )}
          </div>

          {/* Pestañas de Filtro Rápido y Contador */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 12,
            paddingTop: 8,
            flexWrap: "wrap",
            gap: 8
          }}>
            <div style={{ display: "flex", gap: 6 }}>
              {[
                { id: "proximos", label: "Próximos y Hoy" },
                { id: "todos", label: "Todos" },
                { id: "pasados", label: "Historial / Pasados" }
              ].map(tab => {
                const isActive = filterTab === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilterTab(tab.id)}
                    style={{
                      padding: "5px 12px",
                      borderRadius: 18,
                      border: `1.5px solid ${isActive ? C.green : "transparent"}`,
                      background: isActive ? C.greenPale : "#f3f4f6",
                      color: isActive ? C.green : C.textSoft,
                      fontSize: 11,
                      fontWeight: isActive ? 700 : 500,
                      cursor: "pointer",
                      transition: "all .15s",
                      fontFamily: "Georgia, serif"
                    }}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>

            <div style={{ fontSize: 11, color: C.textSoft, fontWeight: 500 }}>
              {filteredTurnos.length === 1
                ? "1 turno encontrado"
                : `${filteredTurnos.length} turnos encontrados`}
            </div>
          </div>
        </div>

        {/* ── Lista de Tarjetas de Turnos ── */}
        <div style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 20px",
          background: "#fcfbfa",
          display: "flex",
          flexDirection: "column",
          gap: 12
        }}>
          {filteredTurnos.length === 0 ? (
            <div style={{
              textAlign: "center",
              padding: "48px 20px",
              background: "#ffffff",
              borderRadius: 16,
              border: `1.5px dashed ${C.border}`
            }}>
              <div style={{ fontSize: 38, marginBottom: 10 }}>🔍</div>
              <h4 style={{ margin: "0 0 6px", fontSize: 15, color: C.text, fontFamily: "Georgia, serif" }}>
                {searchQuery
                  ? `No se encontraron turnos para "${searchQuery}"`
                  : "No hay turnos para mostrar en esta sección"}
              </h4>
              <p style={{ margin: 0, fontSize: 12, color: C.textSoft, maxWidth: 360, marginInline: "auto" }}>
                {searchQuery
                  ? "Revisá que el nombre o número de teléfono esté bien escrito, o seleccioná la pestaña 'Todos'."
                  : "Escribí el nombre de la clienta o su número en la barra de arriba para buscar en todos los registros."}
              </p>
            </div>
          ) : (
            filteredTurnos.map(item => {
              const rel = getRelativeDateLabel(item.dateKey, tKey)
              const ramaEmoji = getRamaEmoji(item.profRama)

              return (
                <div
                  key={`${item.dateKey}-${item.cellKey}`}
                  onClick={() => {
                    onNavigateToTurno({
                      date: item.dateKey,
                      hour: item.hour,
                      profId: item.profId,
                      rama: item.profRama
                    })
                    onClose()
                  }}
                  style={{
                    background: "#ffffff",
                    borderRadius: 16,
                    padding: "14px 18px",
                    border: rel.isToday
                      ? `2px solid ${C.green}`
                      : `1.5px solid ${rel.isFuture ? C.greenMint : C.border}`,
                    boxShadow: "0 2px 10px rgba(0, 0, 0, 0.03)",
                    cursor: "pointer",
                    position: "relative",
                    transition: "all .18s ease-out",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = "translateY(-2px)"
                    e.currentTarget.style.boxShadow = "0 8px 24px rgba(58, 125, 68, 0.14)"
                    e.currentTarget.style.borderColor = C.green
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = "none"
                    e.currentTarget.style.boxShadow = "0 2px 10px rgba(0, 0, 0, 0.03)"
                    e.currentTarget.style.borderColor = rel.isToday
                      ? C.green
                      : rel.isFuture
                      ? C.greenMint
                      : C.border
                  }}
                >
                  {/* Fila 1: Fecha, Horario y Badges */}
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 8,
                    borderBottom: "1px solid #f3f4f6",
                    paddingBottom: 8
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: rel.isToday ? C.green : C.text,
                        fontFamily: "Georgia, serif"
                      }}>
                        📅 {fmtDate(item.dateKey)}
                      </span>

                      <span style={{
                        fontSize: 9,
                        fontWeight: 800,
                        padding: "2px 7px",
                        borderRadius: 10,
                        letterSpacing: "0.5px",
                        background: rel.bg,
                        color: rel.color
                      }}>
                        {rel.label}
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{
                        fontSize: 13,
                        fontWeight: 800,
                        color: C.text,
                        background: "#f8f9fa",
                        padding: "3px 8px",
                        borderRadius: 8,
                        border: "1px solid #e9ecef"
                      }}>
                        🕒 {item.hour} hs
                      </span>

                      {item.durMins > 0 && (
                        <span style={{ fontSize: 10, color: C.textSoft }}>
                          ({item.durMins >= 60 ? `${item.durMins / 60}h` : `${item.durMins}m`})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Fila 2: Clienta, Teléfono y Profesional */}
                  <div style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 12
                  }}>
                    <div>
                      <div style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: C.text,
                        display: "flex",
                        alignItems: "center",
                        gap: 6
                      }}>
                        <span>{item.isNote ? "📌" : "👤"}</span>
                        <span>{item.clientName}</span>
                      </div>

                      {item.phone && (
                        <div style={{
                          fontSize: 12,
                          color: C.green,
                          marginTop: 2,
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          fontWeight: 500
                        }}>
                          <span>📞</span>
                          <span>{item.phone}</span>
                        </div>
                      )}
                    </div>

                    {/* Profesional asignada */}
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      background: "#fbfcf9",
                      padding: "4px 10px",
                      borderRadius: 12,
                      border: `1px solid ${C.greenPale}`
                    }}>
                      <span style={{ fontSize: 14 }}>{ramaEmoji}</span>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: C.text }}>
                          {item.profName}
                        </div>
                        <div style={{ fontSize: 9, color: C.textSoft, textTransform: "capitalize" }}>
                          {item.profRama}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Fila 3: Servicios */}
                  {item.services && item.services.length > 0 && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
                      {item.services.map((svc, sIdx) => (
                        <span
                          key={sIdx}
                          style={{
                            fontSize: 10,
                            padding: "3px 8px",
                            borderRadius: 8,
                            background: C.greenPale,
                            color: C.green,
                            fontWeight: 600,
                            border: `1px solid ${C.greenMint}`
                          }}
                        >
                          ✦ {svc.name} {svc.price ? `($${svc.price.toLocaleString("es-AR")})` : ""}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Observaciones / Notas */}
                  {item.notes && (
                    <div style={{
                      fontSize: 11,
                      color: "#6b7280",
                      background: "#f9fafb",
                      padding: "6px 10px",
                      borderRadius: 8,
                      borderLeft: `3px solid ${C.orange}`,
                      fontStyle: "italic"
                    }}>
                      📝 {item.notes}
                    </div>
                  )}

                  {/* Fila 4: Pie de tarjeta con Estado de Cobro e Indicador de Navegación */}
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingTop: 8,
                    borderTop: "1px dashed #f0f0f0",
                    marginTop: 2
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {item.paid ? (
                        <span style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: C.green,
                          background: "#eaf5ec",
                          padding: "2px 7px",
                          borderRadius: 8
                        }}>
                          ✓ Pagado {item.total > 0 && `($${item.total.toLocaleString("es-AR")})`}
                        </span>
                      ) : (
                        <span style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: C.orange,
                          background: C.orangePale,
                          padding: "2px 7px",
                          borderRadius: 8
                        }}>
                          ⏳ Pendiente {item.total > 0 && `($${item.total.toLocaleString("es-AR")})`}
                        </span>
                      )}
                    </div>

                    <div style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: C.green,
                      display: "flex",
                      alignItems: "center",
                      gap: 4
                    }}>
                      <span>Ir a la grilla</span>
                      <span style={{ fontSize: 13 }}>➜</span>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* ── Pie de la Modal con Tips y Accesos ── */}
        <div style={{
          padding: "10px 20px",
          background: "#ffffff",
          borderTop: `1px solid ${C.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 11,
          color: C.textSoft
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span>💡 <strong>Tip:</strong> Hacé clic en cualquier tarjeta para abrir su día y horario</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: C.textSoft,
              fontSize: 11,
              cursor: "pointer",
              textDecoration: "underline"
            }}
          >
            Cerrar (Esc)
          </button>
        </div>
      </div>
    </div>
  )
}
