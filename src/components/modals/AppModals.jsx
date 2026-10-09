import { useState, useEffect, useMemo } from "react"
import { C } from "../../constants/colors.js"
import { PAYMENT_METHODS } from "../../constants/data.js"
import { fmt, apptTotal } from "../../utils/appointments.js"
import { Overlay, ModalHeader, Field, GhostBtn, SolidBtn, inputStyle, modalBox } from "../ui/index.jsx"
import { getApptClientPhone, formatWaNumber, generateReminderMessage, openWhatsAppLink, cleanClientName, normalizeStr, extractPhoneFromString } from "../../utils/whatsapp.js"
import { fmtDate, todayKey } from "../../utils/dates.js"
import { useIsMobile } from "../../hooks/useIsMobile.js"
import { RescheduleContent } from "./RescheduleModal.jsx"

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

// ── Sonido de caja registradora ──────────────────────────────────────────────
// Probá estas URLs — usá la que funcione en tu navegador:
const CASH_SOUND_URLS = [
  "https://assets.mixkit.co/active_storage/sfx/2003/2003-preview.mp3",  // cha-ching
  "https://www.soundjay.com/misc/sounds/cash-register-1.mp3",
  "https://freesound.org/data/previews/154/154953_2538033-lq.mp3",
]

let _cachedAudio = null
function playPaySound() {
  try {
    if (!_cachedAudio) {
      _cachedAudio = new Audio(CASH_SOUND_URLS[0])
      _cachedAudio.volume = 0.7
    }
    _cachedAudio.currentTime = 0
    _cachedAudio.play().catch(() => {
      // fallback to next URL if first fails
      _cachedAudio = new Audio(CASH_SOUND_URLS[1])
      _cachedAudio.volume = 0.7
      _cachedAudio.play().catch(() => { })
    })
  } catch (e) { }
}



export function AppModals({
  modal, setModal,
  payModal, setPayModal,
  deleteKey, setDeleteKey,
  clientName, setClientName,
  apptNotes, setApptNotes,
  chosenServices,
  filterCat, setFilterCat,
  searchTerm, setSearchTerm,
  paymentSplits, setPaymentSplits,
  filteredServices, services,
  saveAppt, confirmPay, doDelete,
  apptTip, setApptTip,
  apptDiscount, setApptDiscount,
  addSplit, removeSplit, updateSplit,
  toggleService, removeService,
  modalSubtotal, modalDuration,
  appointments,
  professionals,
  allProfessionals,
  clientes, setClientes,
  allData,
  multiPayKeys, setMultiPayKeys,
  config,
  currentDate,
  onOpenReschedule,
  activeRama,
  onConfirmReschedule,
}) {
  const [showSug, setShowSug] = useState(false)
  const [serviceHighlightIdx, setServiceHighlightIdx] = useState(0)
  const [isNoteMode, setIsNoteMode] = useState(false)
  const [noteDuration, setNoteDuration] = useState(30)
  const [modalMode, setModalMode] = useState("form") // "form" | "reschedule"


  // Teléfono del cliente gestionado en el formulario
  const [clientPhone, setClientPhone] = useState("")
  const isMobile = useIsMobile(820)

  useEffect(() => {
    if (modal) {
      const appt = modal.editKey ? appointments[modal.editKey] : null
      setIsNoteMode(appt?.isNote || false)
      setNoteDuration(appt?.manualDur || 30)
      setModalMode("form")

      // Cargar teléfono si ya existía en el turno o en la clienta
      if (modal.editKey && appt) {
        const ph = appt.clientPhone || appt.phone || getApptClientPhone(appt, clientes).phone || ""
        setClientPhone(ph)
      } else if (clientName) {
        const norm = normalizeStr(cleanClientName(clientName))
        const found = (clientes || []).find(c => c && normalizeStr(c.name) === norm)
        setClientPhone(found?.phone || "")
      } else {
        setClientPhone("")
      }
    }
  }, [modal, appointments])

  const safeClientes = clientes || []
  const [showPhoneSug, setShowPhoneSug] = useState(false)

  // Sugerencias para el nombre de la clienta (desde la primera letra o número)
  const suggestions = useMemo(() => {
    const raw = (clientName || "").trim().toLowerCase()
    if (!raw) return []
    const rawDigits = raw.replace(/\D/g, "")

    return safeClientes.filter(cl => {
      if (!cl || !cl.name) return false
      const clName = cl.name.toLowerCase()
      const clPhoneDigits = (cl.phone || "").replace(/\D/g, "")
      const clNameClean = cleanClientName(cl.name).toLowerCase()

      const matchName = clName.includes(raw) || clNameClean.includes(raw)
      const matchPhone = rawDigits.length >= 1 && clPhoneDigits.includes(rawDigits)

      return (matchName || matchPhone) && clName !== raw
    }).slice(0, 8)
  }, [clientName, safeClientes])

  // Sugerencias para el campo de teléfono (desde el primer número o letra)
  const phoneSuggestions = useMemo(() => {
    const raw = (clientPhone || "").trim()
    const digits = raw.replace(/\D/g, "")
    if (!digits && raw.length < 1) return []

    return safeClientes.filter(cl => {
      if (!cl) return false
      const clPhoneDigits = (cl.phone || "").replace(/\D/g, "")
      if (digits.length >= 1) {
        return clPhoneDigits.includes(digits)
      }
      return raw.length >= 1 && cl.name && cl.name.toLowerCase().includes(raw.toLowerCase()) && Boolean(clPhoneDigits)
    }).slice(0, 8)
  }, [clientPhone, safeClientes])

  const isNewCliente = clientName.trim().length >= 1 &&
    !safeClientes.some(cl => cl.name.toLowerCase() === clientName.trim().toLowerCase())

  // Análisis inteligente de reconocimiento de la clienta y lo que suele pedir
  const clientAnalysis = useMemo(() => {
    const raw = (clientName || "").trim()
    const normTarget = normalizeStr(cleanClientName(raw))
    const rawPhoneDigits = (clientPhone || "").replace(/\D/g, "")
    if (!normTarget && (!rawPhoneDigits || rawPhoneDigits.length < 4)) {
      return { isRecognized: false, matchedClient: null, visitCount: 0, usualServices: [], lastVisit: null }
    }

    const matchedClient = safeClientes.find(c => {
      if (!c) return false
      const cNorm = normalizeStr(cleanClientName(c.name || ""))
      const cPhoneDigits = (c.phone || "").replace(/\D/g, "")
      if (normTarget && cNorm === normTarget) return true
      if (rawPhoneDigits && rawPhoneDigits.length >= 6 && cPhoneDigits === rawPhoneDigits) return true
      return false
    })

    let visitCount = 0
    let lastVisit = null
    const svcCountMap = new Map()

    Object.entries(allData || {}).forEach(([dateStr, dayData]) => {
      Object.values(dayData || {}).forEach(appt => {
        if (!appt || appt.isBlocked || appt.isNote) return
        const aNorm = normalizeStr(cleanClientName(appt.client || ""))
        const aPhone = (appt.clientPhone || appt.phone || "").replace(/\D/g, "")
        const matchName = normTarget && aNorm === normTarget
        const matchPhone = rawPhoneDigits && rawPhoneDigits.length >= 6 && aPhone === rawPhoneDigits
        if (matchName || matchPhone) {
          visitCount++
          if (!lastVisit || dateStr > lastVisit) {
            lastVisit = dateStr
          }
          (appt.services || []).forEach(s => {
            if (!s || !s.name) return
            const existing = svcCountMap.get(s.name) || { count: 0, sample: s }
            existing.count++
            svcCountMap.set(s.name, existing)
          })
        }
      })
    })

    const catalogServices = Array.isArray(services) ? services : []
    const usualServices = Array.from(svcCountMap.entries())
      .map(([sName, data]) => {
        const catalogMatch = catalogServices.find(cs => cs && cs.name && cs.name.toLowerCase().trim() === sName.toLowerCase().trim())
        if (catalogMatch) {
          return { ...catalogMatch, count: data.count }
        }
        return {
          id: data.sample?.id || sName,
          name: sName,
          price: data.sample?.price || 0,
          duration: data.sample?.duration || 30,
          icon: data.sample?.icon || "✨",
          count: data.count
        }
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)

    const isRecognized = Boolean(matchedClient || visitCount > 0)
    return {
      isRecognized,
      matchedClient,
      visitCount,
      usualServices,
      lastVisit,
    }
  }, [clientName, clientPhone, safeClientes, allData, services])

  // Si reconoce a la clienta y no hay teléfono ingresado, auto-completar el teléfono guardado
  useEffect(() => {
    if (!clientPhone && clientAnalysis.isRecognized) {
      const ph = clientAnalysis.matchedClient?.phone
      if (ph) {
        setClientPhone(ph)
      }
    }
  }, [clientAnalysis.isRecognized, clientAnalysis.matchedClient, clientPhone])

  const saveNewCliente = () => {
    if (!clientName.trim()) return
    setClientes(p => [...(p || []), { id: Date.now(), name: clientName.trim(), phone: clientPhone.trim(), notes: "" }])
  }

  const handleSave = () => {
    if (isNoteMode) {
      saveAppt({
        isNote: true,
        manualDur: noteDuration,
        manualSlots: Math.ceil(noteDuration / 30),
        services: []
      })
      return
    }

    const trimmedName = clientName.trim()
    const trimmedPhone = clientPhone.trim()

    saveAppt({
      isNote: false,
      clientPhone: trimmedPhone,
      manualDur: undefined,
      manualSlots: undefined,
    })

    if (trimmedName && setClientes) {
      setClientes(prev => {
        const list = Array.isArray(prev) ? [...prev] : []
        const norm = normalizeStr(cleanClientName(trimmedName))
        const idx = list.findIndex(c => c && normalizeStr(cleanClientName(c.name)) === norm)
        if (idx >= 0) {
          if (trimmedPhone && list[idx].phone !== trimmedPhone) {
            list[idx] = { ...list[idx], phone: trimmedPhone }
          }
        } else {
          list.push({ id: Date.now(), name: trimmedName, phone: trimmedPhone, notes: "" })
        }
        return list
      })
    }
  }

  const handleToggleService = (s) => {
    const existing = chosenServices.find(x => x.id === s.id)
    if (existing) {
      removeService(existing.uniqueId)
    } else {
      toggleService(s)
    }
  }

  const handleAddAllUsual = () => {
    if (!clientAnalysis.usualServices.length) return
    clientAnalysis.usualServices.forEach(us => {
      if (!chosenServices.some(cs => cs.id === us.id)) {
        toggleService(us)
      }
    })
  }

  return (
    <>
      {/* ── MODAL NUEVO / EDITAR ── */}
      {modal && (
        <Overlay onClose={() => setModal(null)}>
          <div
            className="modal-sheet"
            style={{
              ...modalBox,
              width: isNoteMode ? "min(520px, calc(100vw - 24px))" : "min(960px, calc(100vw - 24px))",
              maxWidth: isNoteMode ? 520 : 960,
              display: "flex",
              flexDirection: "column",
              padding: isMobile ? "20px 16px 14px" : "24px 26px 16px",
              overflow: "hidden",
              height: isNoteMode ? "auto" : (isMobile ? "min(740px, calc(100vh - 36px))" : "min(710px, calc(100vh - 40px))"),
              maxHeight: "94vh",
              transition: "all 0.2s ease",
              background: C.white,
              border: `1.5px solid ${C.borderLight}`,
              outline: "1.5px dashed rgba(184, 142, 60, 0.45)",
              outlineOffset: "-8px",
              boxShadow: "0 24px 80px rgba(20, 60, 30, 0.16)",
            }}
          >
            {modalMode === "reschedule" ? (
              <div className="modal-view-transition" style={{ flex: 1, minHeight: 0, height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <RescheduleContent
                  apptData={{
                    fromDate: currentDate,
                    fromKey: modal.editKey,
                    appt: appointments[modal.editKey] ? {
                      ...appointments[modal.editKey],
                      client: clientName || appointments[modal.editKey]?.client,
                      clientPhone: clientPhone || appointments[modal.editKey]?.clientPhone,
                      services: isNoteMode ? [] : chosenServices,
                      notes: apptNotes,
                      isNote: isNoteMode,
                      manualDur: noteDuration,
                    } : {
                      client: clientName,
                      clientPhone: clientPhone,
                      profId: modal.profId,
                      hour: modal.hour,
                      services: chosenServices,
                      notes: apptNotes,
                      isNote: isNoteMode,
                      manualDur: noteDuration,
                    },
                    activeRama: activeRama,
                  }}
                  allData={allData}
                  allProfessionals={allProfessionals || professionals}
                  config={config}
                  clientes={clientes}
                  activeRama={activeRama}
                  onBack={() => setModalMode("form")}
                  onClose={() => setModal(null)}
                  onConfirmReschedule={(params) => {
                    onConfirmReschedule?.(params)
                    setModal(null)
                  }}
                />
              </div>
            ) : (
              <div className="modal-view-transition" style={{ flex: 1, minHeight: 0, height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                {isNoteMode ? (
                  /* ── MODO ANOTACIÓN ── */
                  <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                    <ModalHeader emoji="📌" sub="Anotación / Nota">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", gap: 10 }}>
                        <span>
                          {(allProfessionals || professionals)?.find(p => p.id === modal.profId)?.name} · {modal.hour} hs
                        </span>
                        {!modal.editKey && (
                          <button
                            type="button"
                            onClick={() => { setIsNoteMode(false); setClientName(""); }}
                            style={{
                              background: "transparent",
                              border: `1px solid ${C.border}`,
                              color: C.green,
                              borderRadius: 8,
                              padding: "4px 8px",
                              fontSize: 10,
                              fontWeight: "bold",
                              cursor: "pointer",
                            }}
                          >
                            🌿 Cambiar a Turno
                          </button>
                        )}
                      </div>
                    </ModalHeader>

                    <Field label="Texto de la anotación">
                      <textarea
                        autoFocus
                        value={clientName}
                        onChange={e => setClientName(e.target.value)}
                        placeholder="Ej: Almuerzo, Reunión de equipo, Traer reposición de insumos..."
                        rows={3}
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        data-form-type="other"
                        style={{ ...inputStyle, resize: "vertical", fontSize: 13 }}
                      />
                    </Field>

                    <Field label="Duración">
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {[30, 60, 90, 120, 180].map(dur => (
                          <button
                            key={dur}
                            onClick={() => setNoteDuration(dur)}
                            style={{
                              padding: "6px 12px", borderRadius: 20, cursor: "pointer",
                              border: `1.5px solid ${noteDuration === dur ? C.green : C.border}`,
                              background: noteDuration === dur ? C.greenPale : C.white,
                              color: noteDuration === dur ? C.green : C.textSoft,
                              fontSize: 10, fontWeight: "bold", fontFamily: "Georgia, serif",
                              transition: "all .15s"
                            }}
                          >
                            {dur >= 60 ? `${dur / 60} h${dur % 60 !== 0 ? ` ${dur % 60}m` : ""}` : `${dur} min`}
                          </button>
                        ))}
                      </div>
                    </Field>
                  </div>
                ) : (
                  /* ── NUEVA TARJETA DE TURNOS (DOBLE DE ANCHO · 2 COLUMNAS) ── */
                  <div
                    className="no-scrollbar"
                    style={{
                      flex: 1,
                      minHeight: 0,
                      display: "flex",
                      flexDirection: isMobile ? "column" : "row",
                      gap: isMobile ? 14 : 22,
                      overflowY: isMobile ? "auto" : "hidden",
                    }}
                  >
                    {/* ═══ COLUMNA IZQUIERDA: CLIENTA Y DETALLES DEL TURNO ═══ */}
                    <div
                      className="no-scrollbar"
                      style={{
                        flex: isMobile ? "none" : "1 1 380px",
                        minWidth: isMobile ? "100%" : 350,
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                        overflowY: isMobile ? "visible" : "auto",
                        paddingRight: isMobile ? 0 : 6,
                      }}
                    >
                      <ModalHeader
                        emoji={modal.editKey ? "✏️" : "🌿"}
                        sub={modal.editKey ? "Editar turno" : "Nuevo turno"}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", gap: 10 }}>
                          <span>
                            {(allProfessionals || professionals)?.find(p => p.id === modal.profId)?.name} · {modal.hour} hs
                          </span>
                          {!modal.editKey && (
                            <button
                              type="button"
                              onClick={() => {
                                setIsNoteMode(true);
                                setClientName("");
                              }}
                              style={{
                                background: "transparent",
                                border: `1px solid ${C.border}`,
                                color: C.textSoft,
                                borderRadius: 8,
                                padding: "4px 8px",
                                fontSize: 10,
                                fontWeight: "bold",
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                                cursor: "pointer",
                                transition: "all 0.15s",
                              }}
                              title="Cambiar a Anotación"
                            >
                              📌 Anotar
                            </button>
                          )}
                        </div>
                      </ModalHeader>

                      {/* ── 1. NOMBRE DE LA CLIENTA (EXTRA GRANDE Y EN DORADO) ── */}
                      <div style={{ marginBottom: 4 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                          <label style={{ fontSize: 8, letterSpacing: "2.5px", color: "#a88526", textTransform: "uppercase", fontWeight: "bold" }}>
                            Nombre de la clienta
                          </label>
                          {clientAnalysis.isRecognized ? (
                            <span style={{
                              background: "linear-gradient(135deg, #fef3c7, #fde68a)",
                              border: "1px solid #d4af37",
                              color: "#854d0e",
                              fontSize: 9,
                              fontWeight: "bold",
                              padding: "1px 7px",
                              borderRadius: 12,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 3,
                            }}>
                              👑 Reconocida
                            </span>
                          ) : isNewCliente ? (
                            <span style={{
                              background: "#e0f2fe",
                              border: "1px solid #bae6fd",
                              color: "#0369a1",
                              fontSize: 9,
                              fontWeight: "bold",
                              padding: "1px 7px",
                              borderRadius: 12,
                            }}>
                              ✨ Clienta nueva
                            </span>
                          ) : null}
                        </div>

                        <div style={{ position: "relative" }}>
                          <div style={{
                            position: "relative",
                            display: "flex",
                            alignItems: "center",
                            borderRadius: 12,
                            background: "linear-gradient(135deg, #fffdf5, #fffbf0)",
                            border: clientAnalysis.isRecognized ? "2px solid #d4af37" : "1.5px solid #e2cb7b",
                            outline: "1.5px dashed rgba(195, 150, 45, 0.55)",
                            outlineOffset: "-4px",
                            boxShadow: "0 3px 12px rgba(212, 175, 55, 0.16)",
                            padding: "2px 12px",
                            transition: "all .18s ease",
                          }}>
                            <span style={{ fontSize: 18, marginRight: 8, userSelect: "none" }}>
                              {clientAnalysis.isRecognized ? "👑" : "✨"}
                            </span>
                            <input
                              autoFocus
                              value={clientName}
                              autoComplete="off"
                              autoCorrect="off"
                              autoCapitalize="off"
                              spellCheck={false}
                              data-lpignore="true"
                              data-form-type="other"
                              aria-autocomplete="none"
                              onChange={e => {
                                const capitalizeName = (str) => str.split(' ').map(word => word ? word.charAt(0).toUpperCase() + word.slice(1) : '').join(' ')
                                const raw = e.target.value
                                const extractedPhone = extractPhoneFromString(raw)
                                if (extractedPhone && !clientPhone) {
                                  setClientPhone(extractedPhone)
                                  setClientName(capitalizeName(cleanClientName(raw)))
                                } else {
                                  setClientName(capitalizeName(raw))
                                }
                                setShowSug(true)
                              }}
                              placeholder="Ej: María González"
                              style={{
                                width: "100%",
                                border: "none",
                                background: "transparent",
                                outline: "none",
                                fontSize: isMobile ? 18 : 22,
                                fontWeight: "700",
                                color: "#996515", // Dorado elegante y cálido
                                fontFamily: "Georgia, serif",
                                letterSpacing: "0.5px",
                                padding: "8px 0",
                              }}
                              onFocus={() => setShowSug(true)}
                              onBlur={() => setTimeout(() => setShowSug(false), 200)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  document.getElementById('client-phone-input')?.focus();
                                }
                              }}
                            />
                            {isNewCliente && (
                              <button
                                onMouseDown={saveNewCliente}
                                type="button"
                                style={{
                                  padding: "4px 9px",
                                  borderRadius: 8,
                                  border: "none",
                                  background: `linear-gradient(135deg,${C.green},${C.greenLight})`,
                                  color: "#fff",
                                  fontSize: 9,
                                  cursor: "pointer",
                                  fontFamily: "Georgia,serif",
                                  fontWeight: "bold",
                                  whiteSpace: "nowrap",
                                  marginLeft: 6,
                                }}
                              >
                                💾 Guardar
                              </button>
                            )}
                          </div>

                          {showSug && suggestions.length > 0 && (
                            <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 999, background: C.white, borderRadius: 12, border: `1.5px solid #d4af37`, boxShadow: "0 8px 24px rgba(184,134,11,.18)", overflowY: "auto", maxHeight: 220 }}>
                              {suggestions.map(cl => {
                                const clean = cleanClientName(cl.name)
                                const ph = cl.phone || extractPhoneFromString(cl.name)
                                return (
                                  <div
                                    key={cl.id}
                                    onMouseDown={() => {
                                      setClientName(clean || cl.name);
                                      if (ph) setClientPhone(ph);
                                      setShowSug(false);
                                    }}
                                    style={{ padding: "8px 12px", cursor: "pointer", borderBottom: `1px solid ${C.greenPale}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}
                                    onMouseEnter={e => e.currentTarget.style.background = "#fffbf0"}
                                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                  >
                                    <div>
                                      <div style={{ fontSize: 13, fontWeight: "bold", color: "#996515" }}>{clean || cl.name}</div>
                                      {ph && <div style={{ fontSize: 10, color: C.textSoft }}>📱 {ph}</div>}
                                    </div>
                                    <span style={{ fontSize: 10, color: C.green, fontWeight: "bold" }}>Seleccionar →</span>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* ── 2. NÚMERO DE TELÉFONO POR SEPARADO ── */}
                      <div style={{ marginBottom: 4 }}>
                        <label style={{ fontSize: 8, letterSpacing: "2.5px", color: C.textSoft, textTransform: "uppercase", display: "block", marginBottom: 5 }}>
                          Número de teléfono / WhatsApp
                        </label>
                        <div style={{ position: "relative" }}>
                          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                            <input
                              id="client-phone-input"
                              type="tel"
                              value={clientPhone}
                              autoComplete="off"
                              autoCorrect="off"
                              autoCapitalize="off"
                              spellCheck={false}
                              data-lpignore="true"
                              data-form-type="other"
                              aria-autocomplete="none"
                              onChange={e => {
                                setClientPhone(e.target.value)
                                setShowPhoneSug(true)
                              }}
                              onFocus={() => setShowPhoneSug(true)}
                              onBlur={() => setTimeout(() => setShowPhoneSug(false), 200)}
                              placeholder="Ej: 11 4523-8890"
                              style={{
                                ...inputStyle,
                                paddingLeft: 36,
                                paddingRight: clientPhone ? 80 : 12,
                                fontSize: 13,
                                border: clientPhone ? `1.5px solid ${C.green}` : `1.5px solid ${C.border}`,
                                background: clientPhone ? "rgba(58, 125, 68, 0.04)" : C.cream,
                                outline: clientPhone ? "1px dashed rgba(58, 125, 68, 0.35)" : "1px dashed rgba(180, 170, 150, 0.35)",
                                outlineOffset: "-3px",
                              }}
                            />
                            <div style={{ position: "absolute", left: 11, pointerEvents: "none", display: "flex", alignItems: "center" }}>
                              <WhatsAppIcon size={16} color={clientPhone ? "#25D366" : C.textSoft} />
                            </div>
                            {clientPhone && (
                              <div style={{ position: "absolute", right: 8, display: "flex", alignItems: "center", gap: 4 }}>
                                <span style={{ fontSize: 9, color: C.green, fontWeight: "bold", background: C.greenPale, padding: "2px 6px", borderRadius: 6 }}>
                                  ✓ WhatsApp
                                </span>
                              </div>
                            )}
                          </div>

                          {showPhoneSug && phoneSuggestions.length > 0 && (
                            <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 999, background: C.white, borderRadius: 12, border: `1.5px solid ${C.green}`, boxShadow: "0 8px 24px rgba(58,125,68,.18)", overflowY: "auto", maxHeight: 200 }}>
                              {phoneSuggestions.map(cl => {
                                const clean = cleanClientName(cl.name)
                                const ph = cl.phone || extractPhoneFromString(cl.name)
                                return (
                                  <div
                                    key={cl.id}
                                    onMouseDown={() => {
                                      if (clean) setClientName(clean);
                                      if (ph) setClientPhone(ph);
                                      setShowPhoneSug(false);
                                    }}
                                    style={{ padding: "8px 12px", cursor: "pointer", borderBottom: `1px solid ${C.greenPale}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}
                                    onMouseEnter={e => e.currentTarget.style.background = C.greenPale}
                                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                  >
                                    <div>
                                      <div style={{ fontSize: 12, fontWeight: "bold", color: C.green }}>📱 {ph || "Sin teléfono"}</div>
                                      <div style={{ fontSize: 10, color: C.textSoft }}>{clean || cl.name}</div>
                                    </div>
                                    <span style={{ fontSize: 10, color: C.green, fontWeight: "bold" }}>Asignar →</span>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* ── 3. RESUMEN DE RECONOCIMIENTO / HISTORIAL DE LA CLIENTA ── */}
                      {clientAnalysis.isRecognized && (
                        <div style={{
                          background: "linear-gradient(135deg, rgba(254, 243, 199, 0.4), rgba(253, 230, 138, 0.25))",
                          border: "1px solid rgba(212, 175, 55, 0.4)",
                          borderRadius: 10,
                          padding: "6px 10px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          fontSize: 10,
                          color: "#854d0e",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            <span>✨</span>
                            <span><strong>{clientAnalysis.visitCount}</strong> {clientAnalysis.visitCount === 1 ? "turno histórico" : "turnos históricos registrados"}</span>
                          </div>
                          {clientAnalysis.lastVisit && (
                            <span style={{ color: C.textSoft, fontSize: 9 }}>
                              Última visita: {fmtDate(clientAnalysis.lastVisit)}
                            </span>
                          )}
                        </div>
                      )}

                      {/* ── 4. OBSERVACIONES ── */}
                      <Field label="Observaciones" style={{ marginBottom: 4 }}>
                        <textarea
                          value={apptNotes}
                          onChange={e => setApptNotes(e.target.value)}
                          placeholder="Ej: diseño especial, uñas cortas, alergia a producto..."
                          rows={2}
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck={false}
                          data-form-type="other"
                          style={{
                            ...inputStyle,
                            resize: "vertical",
                            fontSize: 12,
                            outline: "1px dashed rgba(180, 170, 150, 0.35)",
                            outlineOffset: "-3px",
                          }}
                        />
                      </Field>

                      {/* ── 5. RESUMEN DE SERVICIOS SELECCIONADOS ── */}
                      <div style={{
                        marginTop: 2,
                        background: C.cream,
                        borderRadius: 12,
                        padding: "10px 12px",
                        border: `1.5px solid ${C.borderLight}`,
                        outline: "1.2px dashed rgba(184, 142, 60, 0.4)",
                        outlineOffset: "-4px",
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <span style={{ fontSize: 8, letterSpacing: "2px", color: C.textSoft, textTransform: "uppercase", fontWeight: "bold" }}>
                            Servicios elegidos ({chosenServices.length})
                          </span>
                          <span style={{ fontSize: 11, color: C.orange, fontWeight: "bold" }}>
                            {modalDuration} min · {fmt(modalSubtotal)}
                          </span>
                        </div>

                        {chosenServices.length === 0 ? (
                          <div style={{ fontSize: 11, color: C.textSoft, fontStyle: "italic", textAlign: "center", padding: "8px 0" }}>
                            Tocá los turnos a la derecha para agregarlos ➔
                          </div>
                        ) : (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                            {chosenServices.map(sv => (
                              <div
                                key={sv.uniqueId}
                                style={{
                                  display: "flex", alignItems: "center", gap: 5,
                                  background: C.greenPale, border: `1px solid ${C.greenMint}`,
                                  borderRadius: 20, padding: "3px 9px", fontSize: 11, color: C.green,
                                }}
                              >
                                <span>{sv.icon} {sv.name}</span>
                                <span style={{ fontSize: 9, color: C.orange, fontWeight: "bold", marginLeft: 2 }}>{fmt(sv.price)}</span>
                                <span
                                  onClick={() => removeService(sv.uniqueId)}
                                  style={{ cursor: "pointer", color: "#a0b8a4", fontWeight: "bold", marginLeft: 4 }}
                                  title="Quitar"
                                >
                                  ×
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ═══ COLUMNA DERECHA: TURNOS QUE SUELE PEDIR Y SUGERIDOS ═══ */}
                    <div
                      className="no-scrollbar"
                      style={{
                        flex: isMobile ? "none" : "1.25 1 450px",
                        minWidth: isMobile ? "100%" : 380,
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                        overflowY: isMobile ? "visible" : "auto",
                        background: "rgba(255, 255, 255, 0.75)",
                        borderRadius: 14,
                        padding: isMobile ? "12px 10px" : "12px 14px",
                        border: `1.5px solid ${C.greenMint || "#d9e8dc"}`,
                        outline: "1.5px dashed rgba(58, 125, 68, 0.38)",
                        outlineOffset: "-6px",
                      }}
                    >
                      {/* ── SECCIÓN A: SI RECONOCE A LA CLIENTA -> TURNOS QUE SUELE PEDIR ── */}
                      {clientAnalysis.isRecognized && clientAnalysis.usualServices.length > 0 ? (
                        <div style={{
                          background: "linear-gradient(135deg, #fffef9, #fff9ed)",
                          borderRadius: 12,
                          padding: "10px 12px",
                          border: "1.5px solid #e8d697",
                          outline: "1.5px dashed rgba(195, 150, 45, 0.55)",
                          outlineOffset: "-4px",
                          boxShadow: "0 2px 8px rgba(212,175,55,0.12)",
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                            <div>
                              <div style={{ fontSize: 11, fontWeight: "bold", color: "#996515", display: "flex", alignItems: "center", gap: 5 }}>
                                <span>⭐</span> Lo que suele pedir {clientAnalysis.matchedClient?.name ? clientAnalysis.matchedClient.name.split(" ")[0] : clientName.split(" ")[0]}
                              </div>
                              <div style={{ fontSize: 9, color: C.textSoft }}>Frecuentes en sus turnos históricos</div>
                            </div>
                            {clientAnalysis.usualServices.length > 1 && (
                              <button
                                type="button"
                                onClick={handleAddAllUsual}
                                style={{
                                  background: "linear-gradient(135deg, #d4af37, #b8860b)",
                                  border: "none",
                                  borderRadius: 8,
                                  color: "#fff",
                                  fontSize: 9,
                                  fontWeight: "bold",
                                  padding: "4px 8px",
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 4,
                                  boxShadow: "0 2px 6px rgba(184,134,11,0.25)",
                                }}
                                title="Seleccionar todos sus turnos frecuentes de una vez"
                              >
                                ✨ Cargar habituales
                              </button>
                            )}
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(180px, 1fr))", gap: 6 }}>
                            {clientAnalysis.usualServices.map(us => {
                              const isChosen = chosenServices.some(x => x.id === us.id)
                              return (
                                <div
                                  key={us.id}
                                  onClick={() => handleToggleService(us)}
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    padding: "7px 10px",
                                    borderRadius: 9,
                                    cursor: "pointer",
                                    border: isChosen ? `1.5px solid ${C.green}` : "1.5px solid #ecdca0",
                                    outline: isChosen ? "1px dashed rgba(58, 125, 68, 0.4)" : "1px dashed rgba(195, 150, 45, 0.4)",
                                    outlineOffset: "-3px",
                                    background: isChosen ? C.greenPale : C.white,
                                    transition: "all .15s ease",
                                    boxShadow: isChosen ? "0 2px 6px rgba(58,125,68,0.14)" : "none",
                                  }}
                                  onMouseEnter={e => {
                                    if (!isChosen) e.currentTarget.style.background = "#fffdf7"
                                  }}
                                  onMouseLeave={e => {
                                    if (!isChosen) e.currentTarget.style.background = C.white
                                  }}
                                >
                                  <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                                    <div
                                      style={{
                                        width: 16,
                                        height: 16,
                                        borderRadius: 5,
                                        border: isChosen ? `2px solid ${C.green}` : "1.5px solid #d1c7a7",
                                        background: isChosen ? C.green : C.white,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        flexShrink: 0,
                                        transition: "all .15s",
                                      }}
                                    >
                                      {isChosen && (
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                          <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                      )}
                                    </div>
                                    <div style={{ overflow: "hidden" }}>
                                      <div style={{ fontSize: 11, fontWeight: "bold", color: isChosen ? C.green : C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                        {us.icon} {us.name}
                                      </div>
                                      <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 1 }}>
                                        <span style={{ fontSize: 8, color: "#996515", background: "#fef3c7", padding: "1px 5px", borderRadius: 6, fontWeight: "bold" }}>
                                          x{us.count} {us.count === 1 ? "vez" : "veces"}
                                        </span>
                                        <span style={{ fontSize: 8, color: C.textSoft }}>{us.duration}m</span>
                                      </div>
                                    </div>
                                  </div>
                                  <span style={{ fontSize: 11, color: C.orange, fontWeight: "bold", marginLeft: 4 }}>
                                    {fmt(us.price)}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ) : (
                        <div style={{
                          background: "rgba(58, 125, 68, 0.05)",
                          border: `1px solid ${C.greenMint}`,
                          borderRadius: 10,
                          padding: "8px 12px",
                          fontSize: 10,
                          color: C.green,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}>
                          <span>✨</span>
                          <span>
                            {clientName.trim().length > 1
                              ? "Clienta nueva · Elegí sus turnos y el sistema aprenderá lo que suele pedir para las próximas citas."
                              : "Escribí el nombre de la clienta para ver sus turnos frecuentes y sugerencias personalizadas."}
                          </span>
                        </div>
                      )}

                      {/* ── SECCIÓN B: LUEGO LOS SUGERIDOS (CATÁLOGO COMPLETO) ── */}
                      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <span style={{ fontSize: 8, letterSpacing: "2px", color: C.textSoft, textTransform: "uppercase", fontWeight: "bold" }}>
                            {clientAnalysis.isRecognized ? "🌿 Luego los sugeridos / Todos los servicios" : "🌿 Turnos y servicios sugeridos"}
                          </span>
                        </div>

                        {/* Buscador de servicios */}
                        <input
                          id="search-services-input"
                          type="text"
                          placeholder="Buscar servicios por nombre o duración..."
                          value={searchTerm}
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck={false}
                          data-lpignore="true"
                          data-form-type="other"
                          aria-autocomplete="none"
                          onChange={e => { setSearchTerm(e.target.value); setServiceHighlightIdx(0); }}
                          onKeyDown={e => {
                            const list = filteredServices;
                            if (list.length === 0) return;
                            if (e.key === "Enter") {
                              e.preventDefault();
                              if (list[serviceHighlightIdx]) {
                                handleToggleService(list[serviceHighlightIdx]);
                                setSearchTerm("");
                                setServiceHighlightIdx(0);
                              }
                            } else if (e.key === "ArrowDown" || (e.key === "Tab" && !e.shiftKey)) {
                              e.preventDefault();
                              const nextIdx = (serviceHighlightIdx + 1) % list.length;
                              setServiceHighlightIdx(nextIdx);
                              document.getElementById(`service-item-${nextIdx}`)?.scrollIntoView({ block: 'nearest' });
                            } else if (e.key === "ArrowUp" || (e.key === "Tab" && e.shiftKey)) {
                              e.preventDefault();
                              const prevIdx = (serviceHighlightIdx - 1 + list.length) % list.length;
                              setServiceHighlightIdx(prevIdx);
                              document.getElementById(`service-item-${prevIdx}`)?.scrollIntoView({ block: 'nearest' });
                            }
                          }}
                          style={{
                            ...inputStyle,
                            padding: "8px 12px",
                            marginBottom: 6,
                            fontSize: 12,
                            outline: "1px dashed rgba(58, 125, 68, 0.3)",
                            outlineOffset: "-3px",
                          }}
                        />

                        {/* Filtros de Categoría */}
                        <div style={{ display: "flex", gap: 5, marginBottom: 8, flexWrap: "wrap" }}>
                          {["all", "manos", "pies", "combo"].map(cat => (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => { setFilterCat(cat); setServiceHighlightIdx(0); }}
                              style={{
                                padding: "4px 9px", borderRadius: 20, cursor: "pointer",
                                border: `1.5px solid ${filterCat === cat ? C.green : C.border}`,
                                background: filterCat === cat ? C.greenPale : C.white,
                                color: filterCat === cat ? C.green : C.textSoft,
                                fontSize: 9, letterSpacing: "1px", textTransform: "uppercase",
                                fontFamily: "Georgia,serif", transition: "all .15s",
                              }}
                            >
                              {cat === "all" ? "Todos" : cat === "manos" ? "💅 Manos" : cat === "pies" ? "🦶 Pies" : "🌸 Combo"}
                            </button>
                          ))}
                        </div>

                        {/* Lista scrolleable de servicios sugeridos */}
                        <div
                          className="service-scroll"
                          style={{
                            flex: 1,
                            minHeight: 0,
                            overflowY: "auto",
                            display: "flex",
                            flexDirection: "column",
                            gap: 5,
                            paddingRight: 4,
                          }}
                        >
                          {filteredServices.map((s, idx) => {
                            const isChosen = chosenServices.some(x => x.id === s.id)
                            const isFirstMatch = idx === serviceHighlightIdx
                            const borderColor = isFirstMatch 
                              ? "#4a90e2" 
                              : (isChosen ? C.green : C.border)
                            const bgColor = isChosen 
                              ? (isFirstMatch ? "rgba(58, 125, 68, 0.16)" : C.greenPale)
                              : (isFirstMatch ? "#eef6ff" : C.white)

                            return (
                              <div 
                                key={s.id} 
                                id={`service-item-${idx}`}
                                onMouseEnter={() => setServiceHighlightIdx(idx)}
                                onClick={() => { 
                                  handleToggleService(s); 
                                  setSearchTerm(""); 
                                  setServiceHighlightIdx(idx);
                                  document.getElementById("search-services-input")?.focus(); 
                                }} 
                                style={{
                                  width: "100%",
                                  display: "flex", justifyContent: "space-between", alignItems: "center",
                                  padding: "7px 11px", borderRadius: 9, cursor: "pointer",
                                  border: `1.5px solid ${borderColor}`,
                                  outline: isChosen ? "1px dashed rgba(58, 125, 68, 0.35)" : (isFirstMatch ? "1px dashed rgba(74, 144, 226, 0.4)" : "1px dashed rgba(195, 205, 195, 0.4)"),
                                  outlineOffset: "-3px",
                                  background: bgColor,
                                  boxShadow: isFirstMatch ? "0 0 0 1px #4a90e2" : "none",
                                  transition: "all .15s",
                                }}
                              >
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <div
                                    style={{
                                      width: 17,
                                      height: 17,
                                      borderRadius: 5,
                                      border: isChosen ? `2px solid ${C.green}` : `1.5px solid ${C.border}`,
                                      background: isChosen ? C.green : C.white,
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      flexShrink: 0,
                                      transition: "all .15s",
                                    }}
                                  >
                                    {isChosen && (
                                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12" />
                                      </svg>
                                    )}
                                  </div>
                                  <div>
                                    <span style={{ fontSize: 11, color: C.text, fontWeight: isChosen ? "bold" : "normal" }}>{s.icon} {s.name}</span>
                                    <span style={{ fontSize: 9, color: C.textSoft, marginLeft: 6 }}>{s.duration} min</span>
                                  </div>
                                </div>
                                <span style={{ fontSize: 11, color: C.orange, fontWeight: "bold" }}>{fmt(s.price)}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ═══ BARRA INFERIOR UNIFICADA DE ACCIONES ═══ */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, paddingTop: 10, background: "transparent", borderTop: `1px solid ${C.borderLight}` }}>
              {modal.editKey && !isNoteMode && (
                <button
                  type="button"
                  onClick={() => {
                    const currentAppt = appointments[modal.editKey] || { client: clientName, hour: modal.hour, services: chosenServices }
                    const prof = (allProfessionals || professionals)?.find(p => p.id === modal.profId)
                    const { phone, cleanName } = getApptClientPhone(currentAppt, clientes)

                    let targetPhone = clientPhone || phone
                    if (!targetPhone) {
                      const input = window.prompt(`Ingresá el celular de ${cleanName || clientName}:`)
                      if (!input || !input.trim()) return
                      targetPhone = input.trim()
                      setClientPhone(targetPhone)
                      if (setClientes && (cleanName || clientName)) {
                        const cName = (cleanName || clientName).trim()
                        setClientes(prev => {
                          const list = Array.isArray(prev) ? [...prev] : []
                          const norm = cName.toLowerCase().trim()
                          const idx = list.findIndex(c => c && c.name && c.name.toLowerCase().trim() === norm)
                          if (idx >= 0) list[idx] = { ...list[idx], phone: targetPhone }
                          else list.push({ id: Date.now(), name: cName, phone: targetPhone, notes: "" })
                          return list
                        })
                      }
                    }

                    const formatted = formatWaNumber(targetPhone)
                    const msg = generateReminderMessage({
                      clientName: cleanName || clientName,
                      hour: modal.hour,
                      services: chosenServices,
                      profName: prof?.name,
                      empresaNombre: config?.empresaNombre || "Verde Naranja",
                      template: config?.waReminderTemplate,
                      date: currentDate || todayKey(),
                    })
                    openWhatsAppLink(formatted, msg, config?.waOpenMode || "app")
                  }}
                  title="Enviar recordatorio por WhatsApp"
                  style={{
                    width: 36,
                    height: 36,
                    border: "none",
                    background: "transparent",
                    color: "#6b7280",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    padding: 0,
                    flexShrink: 0,
                    transition: "transform .15s ease, color .15s ease",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = "scale(1.15)"
                    e.currentTarget.style.color = "#374151"
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = "scale(1)"
                    e.currentTarget.style.color = "#6b7280"
                  }}
                >
                  <WhatsAppIcon size={22} color="currentColor" />
                </button>
              )}
              {modal.editKey && (
                <button
                  type="button"
                  onClick={() => setModalMode("reschedule")}
                  title="Reprogramar turno (mover a otra fecha u horario)"
                  style={{
                    width: 36,
                    height: 36,
                    border: "none",
                    background: "transparent",
                    color: "#6b7280",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    padding: 0,
                    flexShrink: 0,
                    transition: "transform .15s ease, color .15s ease",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = "scale(1.15)"
                    e.currentTarget.style.color = "#374151"
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = "scale(1)"
                    e.currentTarget.style.color = "#6b7280"
                  }}
                >
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ display: "block", pointerEvents: "none" }}
                  >
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                    <polyline points="12 7 12 12 15 14" />
                  </svg>
                </button>
              )}
              <GhostBtn onClick={() => setModal(null)} style={{ flex: 1 }}>
                Cancelar
              </GhostBtn>
              <SolidBtn 
                onClick={handleSave} 
                disabled={!clientName.trim()} 
                color={C.green}
                style={{ flex: 1.6 }}
              >
                {isNoteMode 
                  ? (modal.editKey ? "📝 Guardar" : "📌 Crear") 
                  : (modal.editKey ? "🌿 Confirmar" : "🌿 Confirmar turno")}
              </SolidBtn>
            </div>
          </div>
        </Overlay>
      )}

      {/* ── MODAL PAGO ── */}
      {payModal && appointments[payModal] && (() => {
        const appt = appointments[payModal]
        const otherPending = Object.entries(appointments).filter(([k, a]) =>
          a.client === appt.client && !a.paid && !a.isBlocked && !multiPayKeys.includes(k)
        )

        const total = multiPayKeys.reduce((s, k) => s + (appointments[k] ? apptTotal(appointments[k]) : 0), 0)
        const discountAmount = parseFloat(apptDiscount) || 0
        const tipAmount = Object.values(apptTip || {}).reduce((s, v) => s + (parseFloat(v) || 0), 0)
        const totalWithTip = Math.max(0, total - discountAmount + tipAmount)
        const sumPaid = paymentSplits.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
        const balance = totalWithTip - sumPaid
        const balanced = Math.abs(balance) <= 1
        // eslint-disable-next-line no-unused-vars
        const usedMids = paymentSplits.map(r => r.methodId)
        const canAdd = PAYMENT_METHODS.some(m => !usedMids.includes(m.id))
        const uniqueClients = Array.from(new Set(multiPayKeys.map(k => appointments[k]?.client).filter(Boolean)))
        const clientHeaderTitle = uniqueClients.length > 1
          ? `${uniqueClients.length} clientas (${uniqueClients.join(", ")})`
          : (appt.client || "Turno")

        return (
          <Overlay onClose={() => setPayModal(null)}>
            <div className="modal-sheet" style={{ ...modalBox, maxWidth: 500, width: "calc(100vw - 32px)" }}>
              <ModalHeader emoji="💰" sub={appt.paid ? "Editar pago" : "Registrar pago"}>
                {clientHeaderTitle} · <span style={{ color: C.orange }}>{fmt(totalWithTip)}</span>
              </ModalHeader>

              <div style={{ background: C.cream, borderRadius: 10, padding: "10px 13px", marginBottom: 16, border: `1px solid ${C.border}` }}>
                {multiPayKeys.map(k => {
                  const a = appointments[k]
                  if (!a) return null
                  const prof = (allProfessionals || professionals)?.find(p => p.id === a.profId)
                  return (
                    <div key={k} style={{ marginBottom: multiPayKeys.length > 1 ? 12 : 0, paddingBottom: multiPayKeys.length > 1 ? 8 : 0, borderBottom: multiPayKeys.length > 1 ? `1px dashed ${C.border}` : "none" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontSize: 10, fontWeight: "bold", color: C.green }}>
                          {prof?.name || "Profesional"}
                          {uniqueClients.length > 1 && a.client && (
                            <span style={{ color: C.textSoft, fontWeight: "normal", marginLeft: 6 }}>· {a.client}</span>
                          )}
                        </span>
                        {multiPayKeys.length > 1 && k !== payModal && (
                          <button onClick={() => {
                            const nextKeys = multiPayKeys.filter(x => x !== k)
                            setMultiPayKeys(nextKeys)
                            if (paymentSplits.length === 1 && !appointments[payModal]?.paid) {
                              const total = nextKeys.reduce((s, key) => s + (appointments[key] ? apptTotal(appointments[key]) : 0), 0)
                              setPaymentSplits([{ ...paymentSplits[0], amount: total.toString() }])
                            }
                          }} style={{ border: "none", background: "transparent", color: "#c04040", cursor: "pointer", fontSize: 10 }}>Quitar</button>
                        )}
                      </div>
                      {(a.services || []).map((sv, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.textSoft, lineHeight: 1.6 }}>
                          <span>{sv.icon} {sv.name}</span>
                          <span style={{ color: C.text }}>{fmt(sv.price)}</span>
                        </div>
                      ))}
                      {multiPayKeys.length > 1 && (
                        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 6, marginTop: 6 }}>
                          <span style={{ fontSize: 10, color: C.textSoft }}>🎁 Propina para {prof?.name || "prof."}:</span>
                          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                            <span style={{ fontSize: 10, color: C.textSoft }}>$</span>
                            <input
                              type="number"
                              value={apptTip[k] || ""}
                              onChange={e => {
                                const val = e.target.value
                                const nextTip = { ...apptTip, [k]: val }
                                setApptTip(nextTip)
                                
                                if (paymentSplits.length === 1) {
                                  const totalTipAmount = Object.values(nextTip).reduce((s, v) => s + (parseFloat(v) || 0), 0)
                                  const total = multiPayKeys.reduce((s, key) => s + (appointments[key] ? apptTotal(appointments[key]) : 0), 0)
                                  const discount = parseFloat(apptDiscount) || 0
                                  setPaymentSplits([{ ...paymentSplits[0], amount: Math.max(0, total - discount + totalTipAmount).toString() }])
                                }
                              }}
                              placeholder="0"
                              style={{ width: 70, padding: "2px 6px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 11, color: C.text, background: C.white, outline: "none", fontFamily: "Georgia,serif", textAlign: "right" }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}

                {otherPending.length > 0 && (
                  <div className="pulse-option-container" style={{ marginTop: 8, padding: "8px 10px", background: "#fff", borderRadius: 8, border: `1.5px dashed ${C.orangeLight}` }}>
                    <div style={{ fontSize: 9, color: C.orange, fontWeight: "bold", marginBottom: 6, textTransform: "uppercase" }}>¿Sumar otros turnos de {appt.client} hoy?</div>
                    {otherPending.map(([k, a]) => {
                      const prof = (allProfessionals || professionals)?.find(p => p.id === a.profId)
                      return (
                        <div key={k} onClick={() => {
                          const nextKeys = [...multiPayKeys, k]
                          setMultiPayKeys(nextKeys)
                          if (paymentSplits.length === 1 && !appointments[payModal]?.paid) {
                            const total = nextKeys.reduce((s, key) => s + (appointments[key] ? apptTotal(appointments[key]) : 0), 0)
                            setPaymentSplits([{ ...paymentSplits[0], amount: total.toString() }])
                          }
                        }} className="other-pending-item" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", padding: "4px 0" }}>
                          <span style={{ fontSize: 11, color: C.text }}><span className="pulse-plus-icon">➕</span> {prof?.name}: {(a.services || []).map(s => s.name).join(", ")}</span>
                          <span style={{ fontSize: 11, fontWeight: "bold", color: C.text }}>{fmt(apptTotal(a))}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
                {/* Discount row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, paddingTop: 6, borderTop: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 11, color: "#c04040" }}>🏷️ Descuento</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 11, color: C.textSoft }}>$</span>
                    <input
                      type="number"
                      value={apptDiscount}
                      onChange={e => {
                        const val = e.target.value
                        setApptDiscount(val)
                        if (paymentSplits.length === 1) {
                          const total = multiPayKeys.reduce((s, key) => s + (appointments[key] ? apptTotal(appointments[key]) : 0), 0)
                          const discount = parseFloat(val) || 0
                          const tip = Object.values(apptTip || {}).reduce((s, v) => s + (parseFloat(v) || 0), 0)
                          setPaymentSplits([{ ...paymentSplits[0], amount: Math.max(0, total - discount + tip).toString() }])
                        }
                      }}
                      placeholder="0"
                      style={{ width: 80, padding: "4px 8px", border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 12, color: "#c04040", background: C.cream, outline: "none", fontFamily: "Georgia,serif", textAlign: "right" }}
                    />
                  </div>
                </div>

                {/* Tip row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, paddingTop: 6, borderTop: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 11, color: C.textSoft }}>{multiPayKeys.length > 1 ? "🎁 Propina Total" : "🎁 Propina"}</span>
                  {multiPayKeys.length === 1 ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: 11, color: C.textSoft }}>$</span>
                      <input
                        type="number"
                        value={apptTip[payModal] || ""}
                        onChange={e => {
                          const val = e.target.value
                          const nextTip = { ...apptTip, [payModal]: val }
                          setApptTip(nextTip)
                          if (paymentSplits.length === 1) {
                            const total = multiPayKeys.reduce((s, key) => s + (appointments[key] ? apptTotal(appointments[key]) : 0), 0)
                            const discount = parseFloat(apptDiscount) || 0
                            const tip = parseFloat(val) || 0
                            setPaymentSplits([{ ...paymentSplits[0], amount: Math.max(0, total - discount + tip).toString() }])
                          }
                        }}
                        placeholder="0"
                        style={{ width: 80, padding: "4px 8px", border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 12, color: C.text, background: C.cream, outline: "none", fontFamily: "Georgia,serif", textAlign: "right" }}
                      />
                    </div>
                  ) : (
                    <span style={{ fontSize: 12, fontWeight: "bold", color: C.text }}>{fmt(tipAmount)}</span>
                  )}
                </div>
                <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 6, paddingTop: 6, display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, fontWeight: "bold", color: C.text }}>Total{discountAmount > 0 ? " c/descuento" : ""}{tipAmount > 0 ? " + propina" : ""}</span>
                  <span style={{ fontSize: 14, fontWeight: "bold", color: C.orange }}>{fmt(totalWithTip)}</span>
                </div>
              </div>

              <Field label="Formas de pago">
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {paymentSplits.map((row, idx) => {
                    const pm = PAYMENT_METHODS.find(m => m.id === row.methodId)
                    return (
                      <div key={idx} style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "10px 12px", borderRadius: 12,
                        border: `2px solid ${pm?.color || C.border}`,
                        background: pm?.id === "mercadopago" ? C.mpPale : pm?.id === "debito" ? C.amberPale : C.greenPale,
                      }}>
                        <div style={{ display: "flex", gap: 5, flex: "0 0 auto" }}>
                          {PAYMENT_METHODS.map(m => {
                            const taken = usedMids.includes(m.id) && m.id !== row.methodId
                            return (
                              <button key={m.id}
                                onClick={() => updateSplit(idx, "methodId", m.id)}
                                disabled={taken}
                                title={m.label}
                                style={{
                                  width: 34, height: 34, borderRadius: "50%", border: "none",
                                  fontSize: 16, cursor: taken ? "not-allowed" : "pointer",
                                  background: row.methodId === m.id ? (m.id === "mercadopago" ? C.mp : m.id === "debito" ? C.amber : C.green) : "rgba(255,255,255,.7)",
                                  opacity: taken ? 0.3 : 1,
                                  transition: "all .15s",
                                }}
                              >{m.icon}</button>
                            )
                          })}
                        </div>
                        <span style={{ fontSize: 11, color: pm?.color, fontWeight: "bold", flex: "0 0 90px" }}>{pm?.label}</span>
                        <div style={{ flex: 1, position: "relative" }}>
                          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: C.textSoft }}>$</span>
                          <input
                            type="number"
                            value={row.amount}
                            onChange={e => updateSplit(idx, "amount", e.target.value)}
                            style={{ width: "100%", padding: "7px 10px 7px 22px", border: `1.5px solid ${pm?.color || C.border}`, borderRadius: 8, fontSize: 13, color: C.text, background: "rgba(255,255,255,.85)", outline: "none", fontFamily: "Georgia,serif" }}
                          />
                        </div>
                        {paymentSplits.length > 1 && (
                          <button onClick={() => removeSplit(idx)} style={{ width: 28, height: 28, borderRadius: "50%", border: "none", background: "rgba(200,100,100,.15)", color: "#c04040", fontSize: 14, cursor: "pointer", flexShrink: 0 }}>✕</button>
                        )}
                      </div>
                    )
                  })}
                </div>
                {canAdd && (
                  <button onClick={addSplit} style={{ width: "100%", marginTop: 8, padding: "8px", borderRadius: 10, border: `1.5px dashed ${C.greenMint}`, background: "transparent", color: C.green, fontSize: 11, letterSpacing: "1px", textTransform: "uppercase", cursor: "pointer", fontFamily: "Georgia,serif" }}>
                    ＋ Agregar otra forma de pago
                  </button>
                )}
              </Field>

              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 14px", borderRadius: 10, marginBottom: 16,
                background: balanced ? C.greenPale : (balance < 0 ? "#fde8e8" : C.orangePale),
                border: `1.5px solid ${balanced ? C.greenMint : (balance < 0 ? "#f4b0b0" : C.orangeLight)}`,
              }}>
                <span style={{ fontSize: 11, color: C.textSoft }}>
                  {balanced ? "✅ Monto balanceado" : balance > 0 ? "⚠️ Falta cubrir" : "⚠️ Excede el total"}
                </span>
                <span style={{ fontSize: 14, fontWeight: "bold", color: balanced ? C.green : (balance < 0 ? "#c04040" : C.orange) }}>
                  {balanced ? fmt(totalWithTip) : balance > 0 ? `${fmt(balance)} pendiente` : `${fmt(Math.abs(balance))} de más`}
                </span>
              </div>

              <div style={{ display: "flex", gap: 8, width: "100%" }}>
                {appt.paid && (
                  <GhostBtn 
                    onClick={() => {
                      if (window.confirm("¿Seguro que querés desmarcar el pago de este turno?")) {
                        confirmPay(true)
                      }
                    }} 
                    style={{ borderColor: C.red, color: C.red }}
                  >
                    Desmarcar Pago
                  </GhostBtn>
                )}
                <GhostBtn onClick={() => setPayModal(null)}>Cancelar</GhostBtn>
                <SolidBtn onClick={() => { playPaySound(); confirmPay() }} color={appt.paid ? C.green : C.orange}>
                  {appt.paid ? "✏️ Actualizar pago" : "💰 Confirmar pago"}
                </SolidBtn>
              </div>
            </div>
          </Overlay>
        )
      })()}

      {/* ── MODAL ELIMINAR ── */}
      {deleteKey && (
        <Overlay onClose={() => setDeleteKey(null)}>
          <div className="modal-sheet" style={{ ...modalBox, textAlign: "center", maxWidth: 360, width: "calc(100vw - 32px)" }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🗑️</div>
            <div style={{ fontSize: 15, color: C.text, marginBottom: 5 }}>¿Eliminar turno?</div>
            {appointments[deleteKey] && (
              <div style={{ fontSize: 12, color: C.textSoft, marginBottom: 20 }}>
                {appointments[deleteKey].client}<br />
                {(appointments[deleteKey]?.services || []).map(s => s.name).join(", ")}
                {appointments[deleteKey].paid && (
                  <div style={{ color: "#d44a4a", marginTop: 4, fontSize: 11 }}>⚠️ Este turno ya fue abonado</div>
                )}
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <GhostBtn onClick={() => setDeleteKey(null)}>Volver</GhostBtn>
              <SolidBtn onClick={doDelete} color="#d44a4a">Eliminar</SolidBtn>
            </div>
          </div>
        </Overlay>
      )}
    </>
  )
}
