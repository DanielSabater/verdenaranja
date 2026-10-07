import { useState, useMemo, useEffect, useRef } from "react"
import { C } from "../../constants/colors.js"
import { Overlay } from "../ui/index.jsx"
import { fmtShort, todayKey } from "../../utils/dates.js"
import { ACTION_CONFIG, formatRelativeTime, clearHistoryLog } from "../../utils/history.js"

function normalizeStr(str) {
  if (!str) return ""
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
}

export function HistoryModal({
  isOpen,
  onClose,
  historyLog = [],
  setHistoryLog,
  currentDate,
  onRestoreDeletedAppt,
  onRevertMoveAppt,
}) {
  const [searchQuery, setSearchQuery] = useState("")
  const [filterTab, setFilterTab] = useState("todos") // 'todos' | 'hoy' | 'delete' | 'move' | 'pay' | 'create'
  const inputRef = useRef(null)
  const tKey = todayKey()

  // Auto-focus al abrir
  useEffect(() => {
    if (isOpen) {
      setSearchQuery("")
      setTimeout(() => {
        inputRef.current?.focus()
      }, 80)
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

  // Filtrado de eventos
  const filteredEvents = useMemo(() => {
    let list = Array.isArray(historyLog) ? [...historyLog] : []

    // Filtro por pestaña
    if (filterTab === "hoy") {
      list = list.filter(item => item.date === tKey)
    } else if (filterTab === "delete") {
      list = list.filter(item => item.action === "delete")
    } else if (filterTab === "move") {
      list = list.filter(item => item.action === "move" || item.action === "reschedule")
    } else if (filterTab === "pay") {
      list = list.filter(item => item.action === "pay")
    } else if (filterTab === "create") {
      list = list.filter(item => item.action === "create")
    }

    // Filtro por búsqueda
    const q = normalizeStr(searchQuery)
    if (q) {
      list = list.filter(item => {
        const c = normalizeStr(item.client)
        const d = normalizeStr(item.details)
        const p = normalizeStr(item.profName)
        const h = normalizeStr(item.hour)
        return c.includes(q) || d.includes(q) || p.includes(q) || h.includes(q)
      })
    }

    return list
  }, [historyLog, filterTab, searchQuery, tKey])

  const handleClearHistory = () => {
    if (window.confirm("¿Seguro que deseas vaciar el historial de movimientos? Esta acción no se puede deshacer.")) {
      clearHistoryLog()
      if (setHistoryLog) setHistoryLog([])
    }
  }

  if (!isOpen) return null

  return (
    <Overlay onClose={onClose}>
      <div
        className="modal-sheet"
        onClick={e => e.stopPropagation()}
        style={{
          width: "94vw",
          maxWidth: 620,
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          borderRadius: 22,
          background: C.white,
          border: `1.5px solid ${C.border}`,
          boxShadow: `0 16px 48px ${C.shadow}, 0 2px 6px rgba(0,0,0,0.06)`,
          overflow: "hidden",
          animation: "popIn .2s cubic-bezier(0.16, 1, 0.3, 1)",
          fontFamily: "inherit"
        }}
      >
        {/* Header */}
        <div style={{
          padding: "18px 22px 14px",
          borderBottom: `1px solid ${C.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "linear-gradient(180deg, #fafbf9 0%, #ffffff 100%)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              background: C.orangePale,
              border: `1px solid ${C.orange}33`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20
            }}>
              🕒
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: "bold", color: C.green, fontFamily: "Georgia, serif", letterSpacing: "0.4px" }}>
                Historial de Movimientos
              </div>
              <div style={{ fontSize: 11, color: C.textSoft, marginTop: 1 }}>
                Registro de cambios, reubicaciones y turnos eliminados
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              border: `1px solid ${C.border}`,
              background: "transparent",
              color: C.textSoft,
              fontSize: 14,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all .15s"
            }}
            title="Cerrar (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Buscador y Pestañas */}
        <div style={{ padding: "14px 20px 10px", background: "#fafaf8", borderBottom: `1px solid ${C.border}` }}>
          {/* Input de búsqueda */}
          <div style={{ position: "relative", marginBottom: 12 }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, opacity: 0.6 }}>
              🔍
            </span>
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar por clienta, profesional o detalle..."
              style={{
                width: "100%",
                padding: "9px 36px 9px 34px",
                borderRadius: 12,
                border: `1.5px solid ${C.border}`,
                background: C.white,
                fontSize: 12,
                outline: "none",
                transition: "border .2s, box-shadow .2s",
                boxSizing: "border-box"
              }}
              onFocus={e => {
                e.target.style.borderColor = C.green
                e.target.style.boxShadow = `0 0 0 3px ${C.greenPale}`
              }}
              onBlur={e => {
                e.target.style.borderColor = C.border
                e.target.style.boxShadow = "none"
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: C.textSoft,
                  fontSize: 12
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Filtros rápidos (Pestañas) */}
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
            {[
              { id: "todos", label: "Todos", count: historyLog.length },
              { id: "hoy", label: "Hoy", count: historyLog.filter(x => x.date === tKey).length },
              { id: "delete", label: "🗑️ Eliminados", count: historyLog.filter(x => x.action === "delete").length },
              { id: "move", label: "✂️ Movidos", count: historyLog.filter(x => x.action === "move" || x.action === "reschedule").length },
              { id: "pay", label: "💰 Cobros", count: historyLog.filter(x => x.action === "pay").length },
              { id: "create", label: "➕ Creados", count: historyLog.filter(x => x.action === "create").length },
            ].map(tab => {
              const isActive = filterTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setFilterTab(tab.id)}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 20,
                    border: `1px solid ${isActive ? C.green : C.border}`,
                    background: isActive ? C.green : C.white,
                    color: isActive ? "#ffffff" : C.text,
                    fontSize: 11,
                    fontWeight: isActive ? "bold" : 500,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    transition: "all .15s"
                  }}
                >
                  <span>{tab.label}</span>
                  {tab.count > 0 && (
                    <span style={{
                      fontSize: 9,
                      padding: "1px 5px",
                      borderRadius: 10,
                      background: isActive ? "rgba(255,255,255,0.25)" : "#f0f0f0",
                      color: isActive ? "#fff" : C.textSoft
                    }}>
                      {tab.count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Lista de Movimientos */}
        <div style={{
          flex: 1,
          overflowY: "auto",
          padding: "14px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          background: "#fdfdfc"
        }}>
          {filteredEvents.length === 0 ? (
            <div style={{
              textAlign: "center",
              padding: "40px 20px",
              color: C.textSoft,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8
            }}>
              <div style={{ fontSize: 32 }}>🌿</div>
              <div style={{ fontSize: 13, fontWeight: "bold", color: C.green }}>
                {searchQuery ? "Sin resultados para tu búsqueda" : "No hay movimientos registrados"}
              </div>
              <div style={{ fontSize: 11, maxWidth: 300, lineHeight: 1.5 }}>
                {searchQuery
                  ? "Probá buscando con otro nombre o limpiando los filtros."
                  : "A medida que muevas, elimines, cobres o cargues turnos en la grilla, se listarán automáticamente acá."}
              </div>
            </div>
          ) : (
            filteredEvents.map(item => {
              const cfg = ACTION_CONFIG[item.action] || ACTION_CONFIG.edit
              const isTodayAppt = item.date === tKey
              const isCurrentDay = item.date === currentDate

              return (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    padding: "10px 14px",
                    borderRadius: 14,
                    background: C.white,
                    border: `1px solid ${C.border}`,
                    boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
                    transition: "transform .15s, box-shadow .15s"
                  }}
                >
                  {/* Fila superior: badge de acción, hora y fecha */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 10,
                        fontWeight: "bold",
                        padding: "2px 8px",
                        borderRadius: 12,
                        background: cfg.bg,
                        color: cfg.color,
                        border: `1px solid ${cfg.border}`
                      }}>
                        <span>{cfg.icon}</span>
                        <span>{cfg.label}</span>
                      </span>

                      {/* Fecha del turno */}
                      {item.date && (
                        <span style={{
                          fontSize: 10,
                          fontWeight: 600,
                          color: isTodayAppt ? C.green : C.textSoft,
                          background: isTodayAppt ? C.greenPale : "#f4f4f5",
                          padding: "2px 7px",
                          borderRadius: 6
                        }}>
                          {isTodayAppt ? "Hoy" : fmtShort(item.date)}
                        </span>
                      )}
                    </div>

                    {/* Hora del registro */}
                    <div style={{ fontSize: 10, color: C.textSoft, display: "flex", alignItems: "center", gap: 4 }}>
                      <span>🕒 {item.timeFormatted}</span>
                      <span style={{ opacity: 0.6 }}>· {formatRelativeTime(item.timestamp)}</span>
                    </div>
                  </div>

                  {/* Fila central: Cliente y detalles */}
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginTop: 2 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: "bold", color: C.text, display: "flex", alignItems: "center", gap: 6 }}>
                        <span>{item.client || "Clienta"}</span>
                        {item.hour && (
                          <span style={{ fontSize: 11, fontWeight: "normal", color: C.textSoft }}>
                            ({item.hour} hs)
                          </span>
                        )}
                      </div>
                      {item.details && (
                        <div style={{ fontSize: 11, color: C.textSoft, marginTop: 2, lineHeight: 1.4 }}>
                          {item.details}
                        </div>
                      )}
                    </div>

                    {/* Botones de acción (Restaurar o Revertir) */}
                    <div>
                      {item.action === "delete" && item.payload?.deletedAppt && !item.undone && onRestoreDeletedAppt && (
                        <button
                          onClick={() => onRestoreDeletedAppt(item)}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 10,
                            border: `1px solid ${C.green}`,
                            background: C.greenPale,
                            color: C.green,
                            fontSize: 11,
                            fontWeight: "bold",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                            whiteSpace: "nowrap",
                            transition: "all .15s"
                          }}
                          title="Restaurar este turno en la planilla"
                        >
                          <span>🔄</span>
                          <span>Restaurar</span>
                        </button>
                      )}

                      {item.action === "move" && item.payload?.fromKey && !item.undone && onRevertMoveAppt && (
                        <button
                          onClick={() => onRevertMoveAppt(item)}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 10,
                            border: `1px solid ${C.orange}`,
                            background: C.orangePale,
                            color: C.orange,
                            fontSize: 11,
                            fontWeight: "bold",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                            whiteSpace: "nowrap",
                            transition: "all .15s"
                          }}
                          title="Volver este turno a su horario/profesional original"
                        >
                          <span>↩️</span>
                          <span>Revertir</span>
                        </button>
                      )}

                      {item.undone && (
                        <span style={{
                          fontSize: 10,
                          fontWeight: "bold",
                          color: "#15803d",
                          background: "#dcfce7",
                          padding: "3px 8px",
                          borderRadius: 8,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 3
                        }}>
                          ✓ Restaurado
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "12px 20px",
          borderTop: `1px solid ${C.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "#fafaf8"
        }}>
          <div style={{ fontSize: 11, color: C.textSoft }}>
            Mostrando <strong>{filteredEvents.length}</strong> {filteredEvents.length === 1 ? "movimiento" : "movimientos"}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {historyLog.length > 0 && (
              <button
                onClick={handleClearHistory}
                style={{
                  padding: "5px 12px",
                  borderRadius: 10,
                  border: `1px solid ${C.border}`,
                  background: "transparent",
                  color: C.textSoft,
                  fontSize: 11,
                  cursor: "pointer"
                }}
              >
                Vaciar historial
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                padding: "6px 16px",
                borderRadius: 10,
                border: "none",
                background: C.green,
                color: "#fff",
                fontSize: 11,
                fontWeight: "bold",
                cursor: "pointer"
              }}
            >
              Listo
            </button>
          </div>
        </div>
      </div>
    </Overlay>
  )
}
