import { useState, useMemo, useEffect } from "react"
import { C } from "../../constants/colors.js"
import { PAYMENT_METHODS } from "../../constants/data.js"
import { GhostBtn, SolidBtn, Field, inputStyle } from "../ui/index.jsx"
import { formatWaNumber, openWhatsAppLink, extractPhoneFromString } from "../../utils/whatsapp.js"

function WhatsAppIcon({ size = 15, color = "currentColor", style = {} }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 175.216 175.552"
      width={size}
      height={size}
      style={{ display: "block", flexShrink: 0, ...style }}
    >
      <path
        fill={color}
        d="M87.184 0C39.043 0 .001 39.043.001 87.184c0 15.385 4.024 30.407 11.666 43.642L.001 175.552l45.864-12.029c12.724 6.937 27.055 10.601 41.319 10.601h.036c48.136 0 87.18-39.043 87.18-87.184C174.4 39.043 135.32 0 87.184 0zm0 159.544h-.03c-13.018 0-25.782-3.499-36.906-10.106l-2.646-1.571-27.424 7.194 7.319-26.732-1.724-2.744c-7.258-11.554-11.086-24.908-11.086-38.641 0-40.038 32.576-72.614 72.642-72.614 19.398 0 37.632 7.554 51.348 21.275 13.717 13.722 21.27 31.956 21.27 51.359 0 40.043-32.582 72.62-72.663 72.62zm39.851-54.437c-2.186-1.096-12.934-6.384-14.938-7.114-2.003-.73-3.46-1.096-4.918 1.096-1.458 2.191-5.649 7.114-6.924 8.572-1.276 1.458-2.551 1.641-4.737.545-2.186-1.096-9.231-3.403-17.585-10.852-6.502-5.795-10.893-12.956-12.169-15.147-1.276-2.191-.136-3.376.958-4.466 1.002-.998 2.186-2.551 3.28-3.827 1.095-1.276 1.458-2.191 2.186-3.649.73-1.458.365-2.734-.182-3.83-.547-1.096-4.918-11.854-6.739-16.23-1.774-4.267-3.578-3.687-4.918-3.754-1.275-.064-2.733-.064-4.19-.064-1.458 0-3.828.547-5.832 2.738-2.004 2.191-7.653 7.48-7.653 18.239s7.835 21.157 8.928 22.615c1.095 1.458 15.422 23.551 37.359 33.029 5.218 2.254 9.288 3.6 12.464 4.608 5.239 1.662 10.007 1.428 13.774.865 4.199-.628 12.934-5.289 14.755-10.395 1.822-5.107 1.822-9.484 1.276-10.396-.547-.912-2.004-1.459-4.19-2.555z"
      />
    </svg>
  )
}

export default function ClientesView({ clientes, setClientes, allData }) {
  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState("all") // all, vip, frecuentes, nuevas, inactivas
  const [sortBy, setSortBy] = useState("alpha") // alpha, freq, spent, recent
  const [filterSvc, setFilterSvc] = useState("all") // all o nombre del servicio
  const [selectedId, setSelectedId] = useState(null)
  const [showMobileDetail, setShowMobileDetail] = useState(false)

  // Modal Crear/Editar
  const [modal, setModal] = useState(false)
  const [newMode, setNewMode] = useState(false)
  const [form, setForm] = useState({ name: "", phone: "", notes: "" })

  // Edición rápida de notas en la ficha
  const [inlineNotes, setInlineNotes] = useState("")
  const [notesSavedAlert, setNotesSavedAlert] = useState(false)

  const safe = clientes || []
  const safeD = allData || {}

  // ── Mapeo de estadísticas históricas por cliente ──
  const clientStatsMap = useMemo(() => {
    const map = new Map()
    Object.entries(safeD).forEach(([fecha, day]) => {
      Object.values(day || {}).forEach(a => {
        const clientName = (a.client || "").trim().toLowerCase()
        if (!clientName) return
        let st = map.get(clientName)
        if (!st) {
          st = {
            visits: 0,
            totalSpent: 0,
            paidCount: 0,
            lastVisit: null,
            svcsMap: {},
            rawAppts: []
          }
          map.set(clientName, st)
        }
        st.visits++
        if (a.paid) {
          const apptSpent = (a.services || []).reduce((s, x) => s + (Number(x.price) || 0), 0)
          st.totalSpent += apptSpent
          st.paidCount++
        }
        if (!st.lastVisit || fecha > st.lastVisit) {
          st.lastVisit = fecha
        }
        ;(a.services || []).forEach(s => {
          if (s?.name) {
            st.svcsMap[s.name] = (st.svcsMap[s.name] || 0) + 1
          }
        })
        st.rawAppts.push({ fecha, a })
      })
    })
    return map
  }, [safeD])

  // ── Enriquecimiento de la lista de clientes ──
  const enriched = useMemo(() => {
    const now = new Date()
    return safe.map(c => {
      const key = (c.name || "").trim().toLowerCase()
      const st = clientStatsMap.get(key)
      const visits = st ? st.visits : 0
      const totalSpent = st ? st.totalSpent : 0
      const paidCount = st ? st.paidCount : 0
      const avgTicket = paidCount > 0 ? Math.round(totalSpent / paidCount) : 0
      const lastVisit = st ? st.lastVisit : null

      let daysSinceLastVisit = null
      if (lastVisit) {
        const lastDate = new Date(lastVisit + "T00:00:00")
        const diffMs = now - lastDate
        daysSinceLastVisit = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
      }

      const isVIP = visits >= 5 || totalSpent >= 50000
      const isRecurrente = visits >= 2 && !isVIP
      const isNueva = visits <= 1
      const isInactiva = daysSinceLastVisit !== null && daysSinceLastVisit >= 60

      const sortedSvcs = st
        ? Object.entries(st.svcsMap)
            .sort((a, b) => b[1] - a[1])
            .map(([name, count]) => ({ name, count }))
        : []

      // Búsqueda inteligente de teléfono si no está en c.phone
      let inferredPhone = ""
      if (st && st.rawAppts) {
        for (const item of st.rawAppts) {
          const p = extractPhoneFromString(item.a?.client) || extractPhoneFromString(item.a?.notes)
          if (p) {
            inferredPhone = p
            break
          }
        }
      }
      const effectivePhone = (c.phone || "").trim() || extractPhoneFromString(c.notes || "") || inferredPhone

      return {
        ...c,
        phone: c.phone || inferredPhone,
        effectivePhone,
        visits,
        totalSpent,
        avgTicket,
        lastVisit,
        daysSinceLastVisit,
        isVIP,
        isRecurrente,
        isNueva,
        isInactiva,
        topServices: sortedSvcs,
        rawAppts: st ? st.rawAppts : []
      }
    })
  }, [safe, clientStatsMap])

  // ── Lista de todos los servicios históricos disponibles ──
  const allServices = useMemo(() => {
    const set = new Set()
    enriched.forEach(c => {
      (c.topServices || []).forEach(s => set.add(s.name))
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [enriched])

  // ── Conteo para los chips de filtro ──
  const counts = useMemo(() => {
    return {
      all: enriched.length,
      vip: enriched.filter(c => c.isVIP).length,
      frecuentes: enriched.filter(c => c.isRecurrente).length,
      nuevas: enriched.filter(c => c.isNueva).length,
      inactivas: enriched.filter(c => c.isInactiva).length
    }
  }, [enriched])

  // ── Filtrado y ordenamiento ──
  const filteredClientes = useMemo(() => {
    const rawQuery = search.trim()
    const query = rawQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")

    let list = enriched.filter(c => {
      const normName = (c.name || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      const normPhone = (c.effectivePhone || c.phone || "").toLowerCase()
      const normNotes = (c.notes || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      const matchesServices = (c.topServices || []).some(s =>
        (s.name || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(query)
      )

      const matchesSearch =
        !query ||
        normName.includes(query) ||
        normPhone.includes(query) ||
        normNotes.includes(query) ||
        matchesServices

      if (!matchesSearch) return false

      if (activeTab === "vip") return c.isVIP
      if (activeTab === "frecuentes") return c.isRecurrente
      if (activeTab === "nuevas") return c.isNueva
      if (activeTab === "inactivas") return c.isInactiva

      if (filterSvc !== "all") {
        const hasService = (c.topServices || []).some(s => s.name === filterSvc)
        if (!hasService) return false
      }

      return true
    })

    if (sortBy === "alpha") list.sort((a, b) => a.name.localeCompare(b.name))
    else if (sortBy === "freq") list.sort((a, b) => b.visits - a.visits)
    else if (sortBy === "spent") list.sort((a, b) => b.totalSpent - a.totalSpent)
    else if (sortBy === "recent") list.sort((a, b) => (b.lastVisit || "").localeCompare(a.lastVisit || ""))

    return list
  }, [enriched, search, activeTab, filterSvc, sortBy])

  // Clienta seleccionada actual
  const selected = useMemo(() => {
    return enriched.find(c => c.id === selectedId) || null
  }, [enriched, selectedId])

  // Si no hay seleccionada en desktop, preseleccionar la primera si hay resultados
  useEffect(() => {
    if (!selectedId && filteredClientes.length > 0 && typeof window !== "undefined" && window.innerWidth > 780) {
      setSelectedId(filteredClientes[0].id)
    }
  }, [filteredClientes, selectedId])

  // Sincronizar notas inline al cambiar de cliente
  useEffect(() => {
    if (selected) {
      setInlineNotes(selected.notes || "")
      setNotesSavedAlert(false)
    }
  }, [selectedId])

  // ── Formateos ──
  const fmt = n => (n != null ? `$${Number(n).toLocaleString("es-AR")}` : "—")
  const formatDate = fecha => {
    if (!fecha) return "—"
    const parts = fecha.split("-")
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : fecha
  }

  const formatPayment = appt => {
    if (appt?.paymentSplits?.length) {
      return appt.paymentSplits
        .map(sp => {
          const pm = PAYMENT_METHODS.find(m => m.id === sp.methodId)
          return `${pm?.icon || ""} ${pm?.label || sp.methodId} ${fmt(sp.amount)}`.trim()
        })
        .join(" + ")
    }
    if (appt?.payMethod) {
      const pm = PAYMENT_METHODS.find(m => m.id === appt.payMethod)
      return `${pm?.icon || ""} ${pm?.label || appt.payMethod}`.trim()
    }
    return appt?.paid ? "✅ Pagado" : "⏳ Sin pago"
  }

  // Historial ordenado
  const historial = useMemo(() => {
    if (!selected || !selected.rawAppts.length) return []
    return selected.rawAppts
      .map(({ fecha, a }) => ({
        fecha: formatDate(fecha),
        hora: a.hour || "--:--",
        servicios: (a.services || []).map(s => s.name).join(", ") || "Servicio general",
        total: (a.services || []).reduce((s, x) => s + (Number(x.price) || 0), 0),
        pago: formatPayment(a),
        paid: a.paid,
        prof: a.profName || a.profesional || "",
        rawFecha: fecha
      }))
      .sort((a, b) => b.rawFecha.localeCompare(a.rawFecha) || b.hora.localeCompare(a.hora))
  }, [selected])

  // ── Acciones de Clienta ──
  const handleSelectClient = c => {
    setSelectedId(c.id)
    setShowMobileDetail(true)
  }

  const openNew = () => {
    setForm({ name: "", phone: "", notes: "" })
    setNewMode(true)
    setModal(true)
  }

  const openEdit = (c, e) => {
    if (e) e.stopPropagation()
    setForm({ name: c.name, phone: c.phone || c.effectivePhone || "", notes: c.notes || "" })
    setNewMode(false)
    setModal(true)
  }

  const handleDelete = (c, e) => {
    if (e) e.stopPropagation()
    if (window.confirm(`¿Seguro que deseas eliminar a "${c.name}" de la lista de clientes?`)) {
      setClientes(prev => (prev || []).filter(x => x.id !== c.id))
      if (selectedId === c.id) {
        setSelectedId(null)
        setShowMobileDetail(false)
      }
    }
  }

  const saveForm = () => {
    if (!form.name.trim()) return
    if (newMode) {
      const newClient = { id: Date.now(), name: form.name.trim(), phone: form.phone.trim(), notes: form.notes.trim() }
      setClientes(p => [...(p || []), newClient])
      setSelectedId(newClient.id)
      setShowMobileDetail(true)
    } else {
      setClientes(p => (p || []).map(c => (c.id === (selected ? selected.id : form.id) ? { ...c, name: form.name.trim(), phone: form.phone.trim(), notes: form.notes.trim() } : c)))
    }
    setModal(false)
  }

  const saveInlineNotes = () => {
    if (!selected) return
    setClientes(prev =>
      (prev || []).map(c => (c.id === selected.id ? { ...c, notes: inlineNotes } : c))
    )
    setNotesSavedAlert(true)
    setTimeout(() => setNotesSavedAlert(false), 2200)
  }

  const sendWhatsAppMsg = (clientObj) => {
    const target = clientObj || selected
    if (!target) return
    const phoneToUse = target.effectivePhone || target.phone
    if (!phoneToUse) {
      openEdit(target)
      return
    }
    const waNum = formatWaNumber(phoneToUse)
    if (!waNum) {
      alert("El formato del número no es compatible con WhatsApp. Podés editarlo.")
      openEdit(target)
      return
    }

    let defaultMsg = `¡Hola ${target.name}! 🌿 Te escribimos de Verde Naranja.`
    if (target.isInactiva) {
      defaultMsg = `¡Hola ${target.name}! 🌿 Te extrañamos por Verde Naranja. ¿Cómo estás? Te escribimos para saber si te gustaría coordinar tu próximo turno con nosotras ✨`
    }
    openWhatsAppLink(waNum, defaultMsg, "app")
  }

  // Iniciales para el avatar
  const getInitials = name => {
    if (!name) return "CL"
    const parts = name.trim().split(" ")
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + (parts[1] ? parts[1][0] : "")).toUpperCase()
  }

  return (
    <div style={{ background: C.cream, minHeight: "100vh" }}>
      <div className="clientes-container">
        
        <div className="clientes-master-detail">

          {/* ════════════════════════════════════════════════════════════
              PANEL IZQUIERDO: LISTA DE CLIENTAS
             ════════════════════════════════════════════════════════════ */}
          <div
            className="clientes-list-pane"
            style={{
              display: showMobileDetail && typeof window !== "undefined" && window.innerWidth <= 780 ? "none" : "flex"
            }}
          >
            {/* Header del listado */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 9, letterSpacing: "2.5px", color: C.orange, textTransform: "uppercase", fontWeight: "600" }}>
                  Directorio
                </div>
                <div style={{ fontSize: 20, color: C.text, fontWeight: "bold", fontFamily: "Georgia, serif" }}>
                  Clientas ({safe.length})
                </div>
              </div>
              <button
                onClick={openNew}
                style={{
                  padding: "8px 14px",
                  borderRadius: 12,
                  border: "none",
                  background: `linear-gradient(135deg, ${C.green}, ${C.greenLight})`,
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: "bold",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  boxShadow: "0 2px 8px rgba(58,125,68,.2)"
                }}
              >
                <span>+</span> Nueva clienta
              </button>
            </div>

            {/* Buscador */}
            <div style={{ position: "relative", marginBottom: 10 }}>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="🔍 Buscar por nombre, teléfono o servicio..."
                style={{
                  ...inputStyle,
                  paddingRight: search ? 30 : 12,
                  background: "#fafcfb"
                }}
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  style={{
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: C.textSoft,
                    cursor: "pointer",
                    fontSize: 12
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Chips de filtro rápido */}
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6, marginBottom: 8 }}>
              {[
                { id: "all", label: "Todas", count: counts.all },
                { id: "vip", label: "💎 VIP", count: counts.vip },
                { id: "frecuentes", label: "🔄 Recurrentes", count: counts.frecuentes },
                { id: "nuevas", label: "✨ Nuevas", count: counts.nuevas },
                { id: "inactivas", label: "⚠️ Inactivas", count: counts.inactivas }
              ].map(tab => {
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 20,
                      border: `1px solid ${isActive ? C.green : C.border}`,
                      background: isActive ? C.greenPale : C.white,
                      color: isActive ? C.green : C.textSoft,
                      fontSize: 10.5,
                      fontWeight: isActive ? "bold" : "normal",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      transition: "all .15s"
                    }}
                  >
                    <span>{tab.label}</span>
                    <span
                      style={{
                        fontSize: 9,
                        background: isActive ? C.greenMint : "#f0f0f0",
                        padding: "1px 5px",
                        borderRadius: 10,
                        color: isActive ? C.green : C.textSoft
                      }}
                    >
                      {tab.count}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Controles: Ordenar y Filtrar por servicio */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8, padding: "0 2px" }}>
              <div>
                <div style={{ fontSize: 9, color: C.textSoft, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 2 }}>
                  Ordenar por:
                </div>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "5px 7px",
                    borderRadius: 8,
                    border: `1px solid ${C.border}`,
                    background: C.white,
                    fontSize: 11,
                    color: C.text,
                    outline: "none",
                    cursor: "pointer"
                  }}
                >
                  <option value="alpha">A-Z (Alfabético)</option>
                  <option value="freq">Más visitas</option>
                  <option value="spent">Mayor gasto ($)</option>
                  <option value="recent">Última visita</option>
                </select>
              </div>

              <div>
                <div style={{ fontSize: 9, color: C.textSoft, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 2 }}>
                  Por servicio:
                </div>
                <select
                  value={filterSvc}
                  onChange={e => setFilterSvc(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "5px 7px",
                    borderRadius: 8,
                    border: `1px solid ${C.border}`,
                    background: C.white,
                    fontSize: 11,
                    color: C.text,
                    outline: "none",
                    cursor: "pointer"
                  }}
                >
                  <option value="all">Todos ({allServices.length})</option>
                  {allServices.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Lista con scroll */}
            <div className="clientes-scrollable-list">
              {filteredClientes.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 10px", color: C.textSoft }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>🔍</div>
                  <div style={{ fontSize: 13, fontWeight: "600" }}>No se encontraron clientas</div>
                  <div style={{ fontSize: 11, marginTop: 4 }}>Probá cambiando los filtros o la búsqueda</div>
                </div>
              ) : (
                filteredClientes.map(c => {
                  const isSelected = selectedId === c.id
                  const initials = getInitials(c.name)
                  const hasPhone = Boolean(c.effectivePhone || c.phone)
                  return (
                    <div
                      key={c.id}
                      className={`cliente-card-item ${isSelected ? "active" : ""}`}
                      onClick={() => handleSelectClient(c)}
                    >
                      <div className={`cliente-avatar ${c.isVIP ? "vip" : ""}`}>
                        {c.isVIP ? "💎" : initials}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "space-between" }}>
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: isSelected ? "700" : "600",
                              color: C.text,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis"
                            }}
                          >
                            {c.name}
                          </span>
                          {c.isInactiva && (
                            <span
                              style={{
                                fontSize: 8.5,
                                background: "#fff1f0",
                                color: "#c04040",
                                padding: "1px 5px",
                                borderRadius: 4,
                                border: "1px solid #ffd0d0",
                                fontWeight: "bold"
                              }}
                            >
                              +60d
                            </span>
                          )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2, fontSize: 10.5, color: C.textSoft }}>
                          {hasPhone ? (
                            <span>📞 {c.effectivePhone || c.phone}</span>
                          ) : (
                            <span style={{ fontStyle: "italic", opacity: 0.7 }}>Sin tel.</span>
                          )}
                          <span>•</span>
                          <span>{c.visits > 0 ? `${c.visits} turno${c.visits > 1 ? "s" : ""}` : "Sin turnos"}</span>
                        </div>
                      </div>

                      {/* Botón tenue de WhatsApp en la tarjeta si tiene teléfono */}
                      {hasPhone && (
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            sendWhatsAppMsg(c)
                          }}
                          title={`Enviar WhatsApp a ${c.name}`}
                          style={{
                            background: "transparent",
                            border: "none",
                            padding: "2px",
                            width: 22,
                            height: 22,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#25D366",
                            opacity: 0.75,
                            transition: "all .15s ease",
                            outline: "none",
                            flexShrink: 0
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.opacity = "1"
                            e.currentTarget.style.transform = "scale(1.18)"
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.opacity = "0.75"
                            e.currentTarget.style.transform = "scale(1)"
                          }}
                        >
                          <WhatsAppIcon size={16} color="currentColor" />
                        </button>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* ════════════════════════════════════════════════════════════
              PANEL DERECHO: FICHA 360° DE LA CLIENTA
             ════════════════════════════════════════════════════════════ */}
          <div
            className="clientes-detail-pane"
            style={{
              display: !showMobileDetail && typeof window !== "undefined" && window.innerWidth <= 780 ? "none" : "block"
            }}
          >
            {/* Botón Volver en mobile */}
            {showMobileDetail && (
              <div style={{ marginBottom: 14 }}>
                <button
                  onClick={() => setShowMobileDetail(false)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 12px",
                    borderRadius: 10,
                    border: `1px solid ${C.border}`,
                    background: C.white,
                    color: C.text,
                    fontSize: 12,
                    cursor: "pointer"
                  }}
                >
                  ← Volver al listado
                </button>
              </div>
            )}

            {selected ? (
              <div>
                {/* Cabecera del Perfil */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14, paddingBottom: 16, borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                    <div
                      style={{
                        width: 54,
                        height: 54,
                        borderRadius: "50%",
                        background: selected.isVIP ? `linear-gradient(135deg, ${C.goldLight}, ${C.gold})` : `linear-gradient(135deg, ${C.greenPale}, ${C.greenMint})`,
                        color: selected.isVIP ? "#fff" : C.green,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 20,
                        fontWeight: "bold",
                        boxShadow: "0 4px 12px rgba(58,125,68,.12)"
                      }}
                    >
                      {selected.isVIP ? "💎" : getInitials(selected.name)}
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <h2 style={{ margin: 0, fontSize: 21, color: C.text, fontFamily: "Georgia, serif" }}>
                          {selected.name}
                        </h2>
                        {selected.isVIP && (
                          <span style={{ fontSize: 10, background: C.goldPale, color: C.gold, border: `1px solid ${C.goldLight}`, padding: "2px 8px", borderRadius: 8, fontWeight: "bold" }}>
                            VIP
                          </span>
                        )}
                        {selected.isInactiva && (
                          <span style={{ fontSize: 10, background: "#fff1f0", color: "#c04040", border: "1px solid #ffd0d0", padding: "2px 8px", borderRadius: 8, fontWeight: "bold" }}>
                            INACTIVA (+60 DÍAS)
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4, fontSize: 12, color: C.textSoft }}>
                        {(selected.effectivePhone || selected.phone) ? (
                          <span>📞 {selected.effectivePhone || selected.phone}</span>
                        ) : (
                          <span style={{ fontStyle: "italic", color: C.orange }}>⚠️ Sin teléfono guardado</span>
                        )}
                        {selected.lastVisit && (
                          <span>• Última visita: <strong>{formatDate(selected.lastVisit)}</strong></span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Acciones principales */}
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    {(selected.effectivePhone || selected.phone) ? (
                      <>
                        <button
                          onClick={() => sendWhatsAppMsg(selected)}
                          title="Enviar mensaje por WhatsApp"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            background: "transparent",
                            border: "none",
                            padding: "6px 8px",
                            color: "#25D366",
                            fontSize: 12.5,
                            fontWeight: "600",
                            cursor: "pointer",
                            opacity: 0.85,
                            transition: "all .15s ease",
                            outline: "none"
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.opacity = "1"
                            e.currentTarget.style.transform = "scale(1.08)"
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.opacity = "0.85"
                            e.currentTarget.style.transform = "scale(1)"
                          }}
                        >
                          <WhatsAppIcon size={18} color="currentColor" />
                          <span>WhatsApp</span>
                        </button>

                        <a
                          href={`tel:${selected.effectivePhone || selected.phone}`}
                          title="Llamar por teléfono"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "6px 8px",
                            border: "none",
                            background: "transparent",
                            color: C.textSoft,
                            fontSize: 14,
                            textDecoration: "none",
                            opacity: 0.8,
                            transition: "all .15s ease"
                          }}
                          onMouseEnter={e => e.currentTarget.style.opacity = "1"}
                          onMouseLeave={e => e.currentTarget.style.opacity = "0.8"}
                        >
                          📞
                        </a>
                      </>
                    ) : (
                      <button
                        onClick={e => openEdit(selected, e)}
                        title="Cargar número de teléfono para habilitar WhatsApp"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "6px 8px",
                          border: "none",
                          background: "transparent",
                          color: C.textSoft,
                          fontSize: 12,
                          cursor: "pointer",
                          opacity: 0.7,
                          transition: "all .15s ease"
                        }}
                        onMouseEnter={e => e.currentTarget.style.opacity = "1"}
                        onMouseLeave={e => e.currentTarget.style.opacity = "0.7"}
                      >
                        <WhatsAppIcon size={16} color="currentColor" />
                        <span>+ Cargar WhatsApp</span>
                      </button>
                    )}

                    <button
                      onClick={e => openEdit(selected, e)}
                      title="Editar datos básicos"
                      style={{
                        padding: "8px 12px",
                        borderRadius: 10,
                        border: `1px solid ${C.border}`,
                        background: C.white,
                        color: C.text,
                        fontSize: 11,
                        cursor: "pointer",
                        fontWeight: "500"
                      }}
                    >
                      ✏️ Editar
                    </button>

                    <button
                      onClick={e => handleDelete(selected, e)}
                      title="Eliminar clienta"
                      style={{
                        padding: "8px 10px",
                        borderRadius: 10,
                        border: "none",
                        background: "#fee2e2",
                        color: "#b91c1c",
                        fontSize: 11,
                        cursor: "pointer"
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {/* Grid de KPIs de la clienta */}
                <div className="cliente-kpi-grid">
                  <div style={{ background: C.greenPale, border: `1px solid ${C.greenMint}`, borderRadius: 14, padding: "12px 14px" }}>
                    <div style={{ fontSize: 9.5, color: C.green, textTransform: "uppercase", letterSpacing: "1px", fontWeight: "600" }}>
                      💰 Inversión Total
                    </div>
                    <div style={{ fontSize: 20, color: C.green, fontWeight: "bold", marginTop: 4 }}>
                      {fmt(selected.totalSpent)}
                    </div>
                    <div style={{ fontSize: 9.5, color: C.textSoft, marginTop: 2 }}>
                      En turnos abonados
                    </div>
                  </div>

                  <div style={{ background: "#fdf8f0", border: `1px solid #f6e4cc`, borderRadius: 14, padding: "12px 14px" }}>
                    <div style={{ fontSize: 9.5, color: C.orange, textTransform: "uppercase", letterSpacing: "1px", fontWeight: "600" }}>
                      📅 Visitas / Turnos
                    </div>
                    <div style={{ fontSize: 20, color: C.orange, fontWeight: "bold", marginTop: 4 }}>
                      {selected.visits}
                    </div>
                    <div style={{ fontSize: 9.5, color: C.textSoft, marginTop: 2 }}>
                      {selected.visits === 1 ? "Primera cita" : "Citas registradas"}
                    </div>
                  </div>

                  <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, padding: "12px 14px" }}>
                    <div style={{ fontSize: 9.5, color: C.textSoft, textTransform: "uppercase", letterSpacing: "1px", fontWeight: "600" }}>
                      🏷️ Ticket Promedio
                    </div>
                    <div style={{ fontSize: 20, color: C.text, fontWeight: "bold", marginTop: 4 }}>
                      {fmt(selected.avgTicket)}
                    </div>
                    <div style={{ fontSize: 9.5, color: C.textSoft, marginTop: 2 }}>
                      Promedio por cita
                    </div>
                  </div>

                  <div style={{ background: selected.isInactiva ? "#fff1f0" : C.white, border: `1px solid ${selected.isInactiva ? "#ffcccc" : C.border}`, borderRadius: 14, padding: "12px 14px" }}>
                    <div style={{ fontSize: 9.5, color: selected.isInactiva ? "#c04040" : C.textSoft, textTransform: "uppercase", letterSpacing: "1px", fontWeight: "600" }}>
                      ⏳ Última Cita
                    </div>
                    <div style={{ fontSize: 17, color: selected.isInactiva ? "#c04040" : C.text, fontWeight: "bold", marginTop: 4 }}>
                      {selected.lastVisit ? formatDate(selected.lastVisit) : "Sin visitas"}
                    </div>
                    <div style={{ fontSize: 9.5, color: C.textSoft, marginTop: 2 }}>
                      {selected.daysSinceLastVisit !== null
                        ? selected.daysSinceLastVisit === 0
                          ? "¡Visitó hoy!"
                          : `Hace ${selected.daysSinceLastVisit} días`
                        : "Sin historial aún"}
                    </div>
                  </div>
                </div>

                {/* Sección media: Servicios favoritos + Notas técnicas */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginBottom: 22 }}>
                  
                  {/* Servicios Frecuentes */}
                  <div style={{ background: C.cream, borderRadius: 14, border: `1px solid ${C.border}`, padding: "14px 16px" }}>
                    <div style={{ fontSize: 11, fontWeight: "bold", color: C.text, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                      <span>💅</span> Servicios Más Solicitados
                    </div>
                    {selected.topServices.length === 0 ? (
                      <div style={{ fontSize: 11, color: C.textSoft, fontStyle: "italic" }}>
                        Aún no registra servicios realizados
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {selected.topServices.map(s => (
                          <span
                            key={s.name}
                            style={{
                              background: C.white,
                              border: `1px solid ${C.greenMint}`,
                              color: C.green,
                              padding: "4px 10px",
                              borderRadius: 12,
                              fontSize: 11,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6
                            }}
                          >
                            <span>{s.name}</span>
                            <strong style={{ fontSize: 10, background: C.greenPale, padding: "1px 6px", borderRadius: 8 }}>
                              {s.count}x
                            </strong>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Ficha técnica & Notas rápidas */}
                  <div style={{ background: C.cream, borderRadius: 14, border: `1px solid ${C.border}`, padding: "14px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: "bold", color: C.text, display: "flex", alignItems: "center", gap: 6 }}>
                        <span>📋</span> Ficha Técnica & Preferencias
                      </div>
                      {notesSavedAlert && (
                        <span style={{ fontSize: 10, color: C.green, fontWeight: "bold" }}>
                          ✅ Guardado
                        </span>
                      )}
                    </div>
                    <textarea
                      value={inlineNotes}
                      onChange={e => setInlineNotes(e.target.value)}
                      placeholder="Ej: Tono 7.1, alérgica a ciertos esmaltes, prefiere café con leche..."
                      rows={3}
                      style={{
                        ...inputStyle,
                        background: C.white,
                        fontSize: 11.5,
                        resize: "vertical",
                        marginBottom: 8
                      }}
                    />
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button
                        onClick={saveInlineNotes}
                        style={{
                          padding: "4px 12px",
                          borderRadius: 8,
                          border: "none",
                          background: C.green,
                          color: "#fff",
                          fontSize: 10.5,
                          cursor: "pointer",
                          fontWeight: "bold"
                        }}
                      >
                        💾 Guardar notas
                      </button>
                    </div>
                  </div>

                </div>

                {/* Historial de Turnos */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: "bold", color: C.text, fontFamily: "Georgia, serif" }}>
                      🗓️ Historial de Citas ({historial.length})
                    </div>
                    {historial.length > 0 && (
                      <span style={{ fontSize: 10.5, color: C.textSoft }}>
                        Orden cronológico
                      </span>
                    )}
                  </div>

                  {historial.length === 0 ? (
                    <div style={{ background: "#fafbfc", border: `1px dashed ${C.border}`, borderRadius: 14, padding: "28px 16px", textAlign: "center", color: C.textSoft }}>
                      <div style={{ fontSize: 24, marginBottom: 6 }}>📅</div>
                      <div style={{ fontSize: 13, fontWeight: "600" }}>Sin turnos registrados</div>
                      <div style={{ fontSize: 11, marginTop: 4 }}>Cuando agendes citas a nombre de esta clienta se verán reflejadas acá con todo el desglose.</div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 420, overflowY: "auto", paddingRight: 4 }}>
                      {historial.map((h, i) => (
                        <div
                          key={i}
                          style={{
                            background: C.white,
                            border: `1px solid ${C.border}`,
                            borderRadius: 12,
                            padding: "12px 14px",
                            display: "flex",
                            flexDirection: "column",
                            gap: 6
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 12.5, fontWeight: "bold", color: C.text }}>
                                📅 {h.fecha}
                              </span>
                              <span style={{ fontSize: 11.5, color: C.textSoft }}>
                                • {h.hora} hs
                              </span>
                              {h.prof && (
                                <span style={{ fontSize: 10.5, background: C.greenPale, color: C.green, padding: "1px 6px", borderRadius: 6 }}>
                                  {h.prof}
                                </span>
                              )}
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <span style={{ fontSize: 13, fontWeight: "bold", color: h.paid ? C.green : C.orange }}>
                                {h.paid ? fmt(h.total) : "Sin cobrar"}
                              </span>
                            </div>
                          </div>

                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: C.textSoft, borderTop: `1px solid #f0f4f1`, paddingTop: 6 }}>
                            <span style={{ fontWeight: "500", color: C.text }}>
                              💅 {h.servicios}
                            </span>
                            <span style={{ whiteSpace: "nowrap" }}>
                              {h.pago}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            ) : (
              /* Estado vacío cuando no hay clienta seleccionada */
              <div style={{ textAlign: "center", padding: "80px 20px", color: C.textSoft }}>
                <div style={{ fontSize: 44, marginBottom: 14 }}>👤</div>
                <div style={{ fontSize: 18, fontWeight: "bold", color: C.text, fontFamily: "Georgia, serif" }}>
                  Seleccioná una clienta
                </div>
                <p style={{ fontSize: 12, maxWidth: 320, margin: "8px auto 20px", lineHeight: 1.6 }}>
                  Hacé clic en cualquier clienta de la lista izquierda para visualizar su ficha completa, métricas, preferencias e historial.
                </p>
                <button
                  onClick={openNew}
                  style={{
                    padding: "9px 18px",
                    borderRadius: 12,
                    border: "none",
                    background: `linear-gradient(135deg, ${C.green}, ${C.greenLight})`,
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: "bold",
                    cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(58,125,68,.2)"
                  }}
                >
                  + Crear nueva clienta
                </button>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* ════════════════════════════════════════════════════════════
          MODAL CREAR / EDITAR CLIENTA
         ════════════════════════════════════════════════════════════ */}
      {modal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(2px)"
          }}
          onClick={() => setModal(false)}
        >
          <div
            style={{
              background: C.white,
              borderRadius: 18,
              padding: 24,
              width: "min(440px, calc(100vw - 32px))",
              boxShadow: "0 24px 80px rgba(0,0,0,.2)"
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 8, letterSpacing: "3px", color: C.orange, textTransform: "uppercase", fontWeight: "600" }}>
              {newMode ? "👤 Ficha de cliente" : "✏️ Actualizar datos"}
            </div>
            <div style={{ fontSize: 18, color: C.text, margin: "4px 0 2px", fontFamily: "Georgia, serif" }}>
              {newMode ? "Nueva clienta" : "Editar clienta"}
            </div>
            <div style={{ height: 2, background: `linear-gradient(90deg, ${C.green}, ${C.greenMint}, transparent)`, marginBottom: 16, borderRadius: 2 }} />

            <Field label="Nombre y Apellido *">
              <input
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Ej: María González"
                style={inputStyle}
                autoFocus
              />
            </Field>

            <Field label="Teléfono / WhatsApp">
              <input
                value={form.phone}
                onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                placeholder="Ej: 11 4523-8890"
                style={inputStyle}
              />
            </Field>

            <Field label="Notas / Preferencias iniciales">
              <textarea
                value={form.notes}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                rows={3}
                placeholder="Preferencias de color, diseño, observaciones..."
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </Field>

            <div style={{ display: "flex", gap: 10, marginTop: 12, justifyContent: "flex-end" }}>
              <GhostBtn onClick={() => setModal(false)}>
                Cancelar
              </GhostBtn>
              <SolidBtn
                onClick={saveForm}
                disabled={!form.name.trim()}
                color={C.green}
              >
                {newMode ? "✅ Guardar clienta" : "✅ Guardar cambios"}
              </SolidBtn>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

