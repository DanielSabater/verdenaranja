import { useState, useMemo, useEffect } from "react"
import { C } from "../../constants/colors.js"
import { Overlay, ModalHeader, inputStyle } from "../ui/index.jsx"
import { buildMergedClientData, getPairKey } from "../../utils/clientDeduplication.js"

export default function MergeClientsModal({
  isOpen,
  onClose,
  suggestions = [],
  allEnrichedClients = [],
  onMergeClients,
  onIgnoreSuggestion,
  initialClient = null
}) {
  const [activeTab, setActiveTab] = useState("suggestions") // "suggestions" | "manual"
  const [currentIndex, setCurrentIndex] = useState(0)

  // Estado para la sugerencia actual
  const currentSug = suggestions[currentIndex] || null

  // Si se abrió desde una clienta específica que tiene sugerencia, sincronizar el índice
  useEffect(() => {
    if (initialClient && suggestions.length > 0) {
      const idx = suggestions.findIndex(
        s => s.clientA.id === initialClient.id || s.clientB.id === initialClient.id
      )
      if (idx >= 0) {
        setCurrentIndex(idx)
        setActiveTab("suggestions")
      } else {
        // Si no tiene sugerencia automática, abrir en manual con esa clienta preseleccionada
        setActiveTab("manual")
        setManualClientA(initialClient)
      }
    }
  }, [initialClient, isOpen])

  // Ajustar índice si la lista de sugerencias se reduce
  useEffect(() => {
    if (currentIndex >= suggestions.length && suggestions.length > 0) {
      setCurrentIndex(suggestions.length - 1)
    }
  }, [suggestions.length, currentIndex])

  // Estado de edición para la fusión activa
  const [chosenMaster, setChosenMaster] = useState("A") // "A" | "B"
  const [customName, setCustomName] = useState("")
  const [customPhone, setCustomPhone] = useState("")
  const [customNotes, setCustomNotes] = useState("")

  // Estado para modo manual
  const [manualClientA, setManualClientA] = useState(null)
  const [manualClientB, setManualClientB] = useState(null)
  const [searchA, setSearchA] = useState("")
  const [searchB, setSearchB] = useState("")

  // Sincronizar campos cuando cambia la sugerencia actual o la pestaña
  useEffect(() => {
    if (activeTab === "suggestions" && currentSug) {
      setChosenMaster("A")
      setCustomName(currentSug.clientA.name || "")
      const initialMerged = buildMergedClientData(currentSug.clientA, currentSug.clientB)
      setCustomPhone(initialMerged.phone)
      setCustomNotes(initialMerged.notes)
    }
  }, [currentSug, activeTab])

  // Sincronizar en modo manual cuando ambos clientes están elegidos
  useEffect(() => {
    if (activeTab === "manual" && manualClientA && manualClientB) {
      setChosenMaster("A")
      setCustomName(manualClientA.name || "")
      const initialMerged = buildMergedClientData(manualClientA, manualClientB)
      setCustomPhone(initialMerged.phone)
      setCustomNotes(initialMerged.notes)
    }
  }, [manualClientA, manualClientB, activeTab])

  // Manejo de cambio de nombre principal
  const handleSelectMaster = (side, client) => {
    setChosenMaster(side)
    setCustomName(client.name || "")
  }

  // Previsualización calculada
  const previewData = useMemo(() => {
    let clientA = null
    let clientB = null

    if (activeTab === "suggestions" && currentSug) {
      clientA = chosenMaster === "A" ? currentSug.clientA : currentSug.clientB
      clientB = chosenMaster === "A" ? currentSug.clientB : currentSug.clientA
    } else if (activeTab === "manual" && manualClientA && manualClientB) {
      clientA = chosenMaster === "A" ? manualClientA : manualClientB
      clientB = chosenMaster === "A" ? manualClientB : manualClientA
    }

    if (!clientA || !clientB) return null

    return buildMergedClientData(clientA, clientB, {
      chosenName: customName,
      chosenPhone: customPhone,
      chosenNotes: customNotes
    })
  }, [activeTab, currentSug, manualClientA, manualClientB, chosenMaster, customName, customPhone, customNotes])

  if (!isOpen) return null

  // Filtro de clientas para modo manual
  const filteredClientsA = allEnrichedClients.filter(c => {
    if (manualClientB && c.id === manualClientB.id) return false
    const q = searchA.toLowerCase().trim()
    return !q || c.name.toLowerCase().includes(q) || (c.phone || "").includes(q)
  }).slice(0, 8)

  const filteredClientsB = allEnrichedClients.filter(c => {
    if (manualClientA && c.id === manualClientA.id) return false
    const q = searchB.toLowerCase().trim()
    return !q || c.name.toLowerCase().includes(q) || (c.phone || "").includes(q)
  }).slice(0, 8)

  const fmtMoney = n => (n != null ? `$${Number(n).toLocaleString("es-AR")}` : "$0")
  const formatDate = fecha => {
    if (!fecha) return "Sin visitas"
    const parts = fecha.split("-")
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : fecha
  }

  const handleExecuteMerge = () => {
    if (!previewData) return

    let target = null
    let source = null

    if (activeTab === "suggestions" && currentSug) {
      target = chosenMaster === "A" ? currentSug.clientA : currentSug.clientB
      source = chosenMaster === "A" ? currentSug.clientB : currentSug.clientA
    } else if (activeTab === "manual" && manualClientA && manualClientB) {
      target = chosenMaster === "A" ? manualClientA : manualClientB
      source = chosenMaster === "A" ? manualClientB : manualClientA
    }

    if (!target || !source) return

    onMergeClients({
      targetClient: target,
      sourceClient: source,
      finalName: customName.trim() || target.name,
      finalPhone: customPhone.trim(),
      finalNotes: customNotes.trim(),
      oldNames: [target.name, source.name]
    })

    if (activeTab === "manual") {
      setManualClientA(null)
      setManualClientB(null)
      setSearchA("")
      setSearchB("")
    }
  }

  const handleDismissSuggestion = () => {
    if (!currentSug) return
    onIgnoreSuggestion(currentSug.clientA.id, currentSug.clientB.id)
  }

  return (
    <Overlay onClose={onClose}>
      <div
        className="modal-sheet"
        style={{
          background: C.white,
          borderRadius: 20,
          padding: "24px",
          width: "min(720px, calc(100vw - 24px))",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 50px rgba(0,0,0,0.22)",
          overflow: "hidden"
        }}
      >
        {/* Cabecera del modal */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: "2.5px", color: C.orange, textTransform: "uppercase", fontWeight: "bold" }}>
              Control de calidad de datos
            </div>
            <div style={{ fontSize: 20, color: C.text, fontWeight: "bold", fontFamily: "Georgia, serif", display: "flex", alignItems: "center", gap: 8 }}>
              <span>✨ Unificación de Clientas</span>
            </div>
            <div style={{ fontSize: 11.5, color: C.textSoft, marginTop: 2 }}>
              Consolidá perfiles duplicados sin perder historial, turnos ni gastos acumulados.
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              fontSize: 18,
              color: C.textSoft,
              cursor: "pointer",
              padding: "4px 8px"
            }}
          >
            ✕
          </button>
        </div>

        {/* Pestañas: Sugerencias vs Manual */}
        <div style={{ display: "flex", gap: 8, borderBottom: `1px solid ${C.border}`, paddingBottom: 10, marginBottom: 16 }}>
          <button
            onClick={() => setActiveTab("suggestions")}
            style={{
              padding: "6px 14px",
              borderRadius: 10,
              border: "none",
              background: activeTab === "suggestions" ? C.green : "#f0f4f1",
              color: activeTab === "suggestions" ? "#fff" : C.text,
              fontSize: 11.5,
              fontWeight: "bold",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              transition: "all 0.15s"
            }}
          >
            <span>💡 Sugerencias detectadas</span>
            <span
              style={{
                background: activeTab === "suggestions" ? "rgba(255,255,255,0.25)" : C.orangePale,
                color: activeTab === "suggestions" ? "#fff" : C.orange,
                padding: "1px 6px",
                borderRadius: 12,
                fontSize: 10
              }}
            >
              {suggestions.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("manual")}
            style={{
              padding: "6px 14px",
              borderRadius: 10,
              border: "none",
              background: activeTab === "manual" ? C.green : "#f0f4f1",
              color: activeTab === "manual" ? "#fff" : C.text,
              fontSize: 11.5,
              fontWeight: "bold",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              transition: "all 0.15s"
            }}
          >
            <span>🔗 Unificar manualmente</span>
          </button>
        </div>

        {/* Contenido scrolleable */}
        <div style={{ flex: 1, overflowY: "auto", paddingRight: 4 }} className="no-scrollbar">
          {activeTab === "suggestions" ? (
            suggestions.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🎉</div>
                <div style={{ fontSize: 16, fontWeight: "bold", color: C.text, fontFamily: "Georgia, serif" }}>
                  ¡Todo en orden!
                </div>
                <div style={{ fontSize: 12, color: C.textSoft, maxWidth: 360, margin: "6px auto 16px" }}>
                  No se encontraron clientas duplicadas o con nombres similares en este momento.
                </div>
                <button
                  onClick={() => setActiveTab("manual")}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 10,
                    border: `1px solid ${C.border}`,
                    background: C.white,
                    color: C.green,
                    fontSize: 11.5,
                    fontWeight: "bold",
                    cursor: "pointer"
                  }}
                >
                  Unificar dos clientas manualmente →
                </button>
              </div>
            ) : currentSug ? (
              <div>
                {/* Barra de navegación de sugerencias */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 12px",
                    borderRadius: 12,
                    background: "#fffaf0",
                    border: "1px solid #fed7aa",
                    marginBottom: 14
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, background: "#f97316", color: "#fff", padding: "2px 7px", borderRadius: 8, fontWeight: "bold" }}>
                      {currentSug.confidence === "alta" ? "Coincidencia alta" : "Posible coincidencia"}
                    </span>
                    <span style={{ fontSize: 11.5, color: "#9a3412", fontWeight: "600" }}>
                      Motivo: {currentSug.reason}
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 11, color: C.textSoft, marginRight: 4 }}>
                      {currentIndex + 1} de {suggestions.length}
                    </span>
                    <button
                      disabled={currentIndex === 0}
                      onClick={() => setCurrentIndex(p => Math.max(0, p - 1))}
                      style={{
                        padding: "3px 8px",
                        borderRadius: 6,
                        border: `1px solid ${C.border}`,
                        background: C.white,
                        cursor: currentIndex === 0 ? "not-allowed" : "pointer",
                        opacity: currentIndex === 0 ? 0.4 : 1,
                        fontSize: 11
                      }}
                    >
                      ←
                    </button>
                    <button
                      disabled={currentIndex >= suggestions.length - 1}
                      onClick={() => setCurrentIndex(p => Math.min(suggestions.length - 1, p + 1))}
                      style={{
                        padding: "3px 8px",
                        borderRadius: 6,
                        border: `1px solid ${C.border}`,
                        background: C.white,
                        cursor: currentIndex >= suggestions.length - 1 ? "not-allowed" : "pointer",
                        opacity: currentIndex >= suggestions.length - 1 ? 0.4 : 1,
                        fontSize: 11
                      }}
                    >
                      →
                    </button>
                  </div>
                </div>

                {/* Comparación lado a lado de las 2 clientas */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                  {/* Ficha A */}
                  <div
                    onClick={() => handleSelectMaster("A", currentSug.clientA)}
                    style={{
                      padding: "14px",
                      borderRadius: 14,
                      border: `2px solid ${chosenMaster === "A" ? C.green : C.border}`,
                      background: chosenMaster === "A" ? "#f4f9f5" : "#fafafa",
                      cursor: "pointer",
                      position: "relative",
                      transition: "all 0.15s"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span
                        style={{
                          fontSize: 9.5,
                          fontWeight: "bold",
                          letterSpacing: "0.5px",
                          textTransform: "uppercase",
                          color: chosenMaster === "A" ? C.green : C.textSoft
                        }}
                      >
                        {chosenMaster === "A" ? "★ Perfil Principal" : "Perfil Secundario"}
                      </span>
                      <input
                        type="radio"
                        checked={chosenMaster === "A"}
                        onChange={() => handleSelectMaster("A", currentSug.clientA)}
                        style={{ cursor: "pointer", accentColor: C.green }}
                      />
                    </div>

                    <div style={{ fontSize: 15, fontWeight: "bold", color: C.text, fontFamily: "Georgia, serif", marginBottom: 6 }}>
                      {currentSug.clientA.name}
                    </div>

                    <div style={{ fontSize: 11, color: C.textSoft, display: "flex", flexDirection: "column", gap: 4 }}>
                      <div>
                        📞 <strong>Teléfono:</strong> {currentSug.clientA.effectivePhone || currentSug.clientA.phone || <em style={{ color: C.orange }}>Sin registrar</em>}
                      </div>
                      <div>
                        📅 <strong>Turnos:</strong> {currentSug.clientA.visits || 0} visitas
                      </div>
                      <div>
                        💰 <strong>Inversión:</strong> {fmtMoney(currentSug.clientA.totalSpent)}
                      </div>
                      <div>
                        🕒 <strong>Última cita:</strong> {formatDate(currentSug.clientA.lastVisit)}
                      </div>
                      {currentSug.clientA.notes && (
                        <div style={{ marginTop: 4, padding: "4px 8px", background: "rgba(0,0,0,0.03)", borderRadius: 6, fontStyle: "italic", fontSize: 10.5 }}>
                          "{currentSug.clientA.notes}"
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Ficha B */}
                  <div
                    onClick={() => handleSelectMaster("B", currentSug.clientB)}
                    style={{
                      padding: "14px",
                      borderRadius: 14,
                      border: `2px solid ${chosenMaster === "B" ? C.green : C.border}`,
                      background: chosenMaster === "B" ? "#f4f9f5" : "#fafafa",
                      cursor: "pointer",
                      position: "relative",
                      transition: "all 0.15s"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span
                        style={{
                          fontSize: 9.5,
                          fontWeight: "bold",
                          letterSpacing: "0.5px",
                          textTransform: "uppercase",
                          color: chosenMaster === "B" ? C.green : C.textSoft
                        }}
                      >
                        {chosenMaster === "B" ? "★ Perfil Principal" : "Perfil Secundario"}
                      </span>
                      <input
                        type="radio"
                        checked={chosenMaster === "B"}
                        onChange={() => handleSelectMaster("B", currentSug.clientB)}
                        style={{ cursor: "pointer", accentColor: C.green }}
                      />
                    </div>

                    <div style={{ fontSize: 15, fontWeight: "bold", color: C.text, fontFamily: "Georgia, serif", marginBottom: 6 }}>
                      {currentSug.clientB.name}
                    </div>

                    <div style={{ fontSize: 11, color: C.textSoft, display: "flex", flexDirection: "column", gap: 4 }}>
                      <div>
                        📞 <strong>Teléfono:</strong> {currentSug.clientB.effectivePhone || currentSug.clientB.phone || <em style={{ color: C.orange }}>Sin registrar</em>}
                      </div>
                      <div>
                        📅 <strong>Turnos:</strong> {currentSug.clientB.visits || 0} visitas
                      </div>
                      <div>
                        💰 <strong>Inversión:</strong> {fmtMoney(currentSug.clientB.totalSpent)}
                      </div>
                      <div>
                        🕒 <strong>Última cita:</strong> {formatDate(currentSug.clientB.lastVisit)}
                      </div>
                      {currentSug.clientB.notes && (
                        <div style={{ marginTop: 4, padding: "4px 8px", background: "rgba(0,0,0,0.03)", borderRadius: 6, fontStyle: "italic", fontSize: 10.5 }}>
                          "{currentSug.clientB.notes}"
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : null
          ) : (
            /* Modo manual */
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: C.textSoft, marginBottom: 12 }}>
                Seleccioná dos clientas existentes para combinarlas en un único perfil consolidado:
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                {/* Selector Clienta 1 */}
                <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, background: "#fafafa" }}>
                  <div style={{ fontSize: 11, fontWeight: "bold", color: C.text, marginBottom: 6 }}>
                    1. Primera Clienta
                  </div>
                  {manualClientA ? (
                    <div style={{ background: "#fff", padding: "8px 10px", borderRadius: 8, border: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: "bold", fontSize: 13, color: C.text }}>{manualClientA.name}</div>
                        <div style={{ fontSize: 10, color: C.textSoft }}>
                          {manualClientA.effectivePhone || manualClientA.phone || "Sin tel"} • {manualClientA.visits || 0} turnos
                        </div>
                      </div>
                      <button
                        onClick={() => setManualClientA(null)}
                        style={{ border: "none", background: "transparent", color: "#c04040", cursor: "pointer", fontSize: 12 }}
                      >
                        Cambiar
                      </button>
                    </div>
                  ) : (
                    <div>
                      <input
                        value={searchA}
                        onChange={e => setSearchA(e.target.value)}
                        placeholder="Buscar por nombre o tel..."
                        style={{ ...inputStyle, padding: "6px 10px", fontSize: 12, marginBottom: 6 }}
                      />
                      <div style={{ maxHeight: 130, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                        {filteredClientsA.map(c => (
                          <div
                            key={c.id}
                            onClick={() => setManualClientA(c)}
                            style={{
                              padding: "5px 8px",
                              borderRadius: 6,
                              background: "#fff",
                              border: `1px solid ${C.border}`,
                              cursor: "pointer",
                              fontSize: 11
                            }}
                          >
                            <strong>{c.name}</strong>
                            <span style={{ color: C.textSoft, marginLeft: 6 }}>
                              ({c.effectivePhone || c.phone || "Sin tel."})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Selector Clienta 2 */}
                <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, background: "#fafafa" }}>
                  <div style={{ fontSize: 11, fontWeight: "bold", color: C.text, marginBottom: 6 }}>
                    2. Segunda Clienta
                  </div>
                  {manualClientB ? (
                    <div style={{ background: "#fff", padding: "8px 10px", borderRadius: 8, border: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: "bold", fontSize: 13, color: C.text }}>{manualClientB.name}</div>
                        <div style={{ fontSize: 10, color: C.textSoft }}>
                          {manualClientB.effectivePhone || manualClientB.phone || "Sin tel"} • {manualClientB.visits || 0} turnos
                        </div>
                      </div>
                      <button
                        onClick={() => setManualClientB(null)}
                        style={{ border: "none", background: "transparent", color: "#c04040", cursor: "pointer", fontSize: 12 }}
                      >
                        Cambiar
                      </button>
                    </div>
                  ) : (
                    <div>
                      <input
                        value={searchB}
                        onChange={e => setSearchB(e.target.value)}
                        placeholder="Buscar por nombre o tel..."
                        style={{ ...inputStyle, padding: "6px 10px", fontSize: 12, marginBottom: 6 }}
                      />
                      <div style={{ maxHeight: 130, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                        {filteredClientsB.map(c => (
                          <div
                            key={c.id}
                            onClick={() => setManualClientB(c)}
                            style={{
                              padding: "5px 8px",
                              borderRadius: 6,
                              background: "#fff",
                              border: `1px solid ${C.border}`,
                              cursor: "pointer",
                              fontSize: 11
                            }}
                          >
                            <strong>{c.name}</strong>
                            <span style={{ color: C.textSoft, marginLeft: 6 }}>
                              ({c.effectivePhone || c.phone || "Sin tel."})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Cuadro de previsualización y edición del resultado unificado */}
          {previewData && (
            <div
              style={{
                borderRadius: 14,
                background: "#f0fdf4",
                border: "1.5px solid #86efac",
                padding: "16px",
                marginBottom: 14
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: "bold", color: "#166534", textTransform: "uppercase", letterSpacing: "1px" }}>
                  📋 Vista Previa del Perfil Unificado
                </div>
                <span style={{ fontSize: 10, background: "#dcfce7", color: "#15803d", padding: "2px 8px", borderRadius: 8, fontWeight: "bold" }}>
                  Listo para unificar
                </span>
              </div>

              {/* Métricas consolidadas */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 8,
                  marginBottom: 12,
                  background: "#fff",
                  padding: "10px",
                  borderRadius: 10,
                  border: "1px solid #bbf7d0"
                }}
              >
                <div>
                  <div style={{ fontSize: 9.5, color: C.textSoft, textTransform: "uppercase" }}>Turnos Totales</div>
                  <div style={{ fontSize: 14, fontWeight: "bold", color: "#166534" }}>
                    {previewData.combinedVisits} visitas
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 9.5, color: C.textSoft, textTransform: "uppercase" }}>Inversión Acumulada</div>
                  <div style={{ fontSize: 14, fontWeight: "bold", color: "#166534" }}>
                    {fmtMoney(previewData.combinedSpent)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 9.5, color: C.textSoft, textTransform: "uppercase" }}>Última Cita</div>
                  <div style={{ fontSize: 14, fontWeight: "bold", color: "#166534" }}>
                    {formatDate(previewData.combinedLastVisit)}
                  </div>
                </div>
              </div>

              {/* Campos finales editables */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ fontSize: 9, fontWeight: "bold", color: C.textSoft, textTransform: "uppercase", display: "block", marginBottom: 4 }}>
                    Nombre Definitivo:
                  </label>
                  <input
                    value={customName}
                    onChange={e => setCustomName(e.target.value)}
                    style={{ ...inputStyle, padding: "8px 10px", fontSize: 12, background: "#fff" }}
                    placeholder="Nombre oficial de la clienta"
                  />
                </div>
                <div>
                  <label style={{ fontSize: 9, fontWeight: "bold", color: C.textSoft, textTransform: "uppercase", display: "block", marginBottom: 4 }}>
                    Teléfono Definitivo:
                  </label>
                  <input
                    value={customPhone}
                    onChange={e => setCustomPhone(e.target.value)}
                    style={{ ...inputStyle, padding: "8px 10px", fontSize: 12, background: "#fff" }}
                    placeholder="Número de teléfono / WhatsApp"
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 9, fontWeight: "bold", color: C.textSoft, textTransform: "uppercase", display: "block", marginBottom: 4 }}>
                  Notas combinadas (podés editarlas si querés):
                </label>
                <textarea
                  value={customNotes}
                  onChange={e => setCustomNotes(e.target.value)}
                  rows={2}
                  style={{
                    ...inputStyle,
                    padding: "8px 10px",
                    fontSize: 11.5,
                    background: "#fff",
                    resize: "vertical",
                    minHeight: 48
                  }}
                  placeholder="Información adicional o notas combinadas..."
                />
              </div>

              <div style={{ marginTop: 8, fontSize: 10.5, color: "#15803d" }}>
                💡 <em>Al unificar, todos los turnos anteriores en el historial pasarán a este nombre, sumando servicios más pedidos y gastos sin perder nada.</em>
              </div>
            </div>
          )}
        </div>

        {/* Barra de botones de acción */}
        <div style={{ display: "flex", gap: 8, paddingTop: 12, borderTop: `1px solid ${C.border}`, alignItems: "center" }}>
          {activeTab === "suggestions" && currentSug && (
            <button
              onClick={handleDismissSuggestion}
              title="Descarta esta sugerencia para que no vuelva a aparecer"
              style={{
                padding: "10px 14px",
                borderRadius: 11,
                border: `1.5px solid ${C.border}`,
                background: "transparent",
                color: C.textSoft,
                fontSize: 10.5,
                fontWeight: "bold",
                cursor: "pointer",
                transition: "all 0.15s"
              }}
            >
              ✕ No son la misma
            </button>
          )}

          <div style={{ flex: 1 }} />

          <button
            onClick={onClose}
            style={{
              padding: "10px 16px",
              borderRadius: 11,
              border: `1px solid ${C.border}`,
              background: C.white,
              color: C.text,
              fontSize: 11,
              cursor: "pointer"
            }}
          >
            Cerrar
          </button>

          {previewData && (
            <button
              onClick={handleExecuteMerge}
              disabled={!customName.trim()}
              style={{
                padding: "10px 22px",
                borderRadius: 11,
                border: "none",
                background: `linear-gradient(135deg, ${C.green}, ${C.greenLight})`,
                color: "#fff",
                fontSize: 11,
                fontWeight: "bold",
                letterSpacing: "0.5px",
                cursor: !customName.trim() ? "not-allowed" : "pointer",
                boxShadow: "0 4px 12px rgba(58,125,68,0.3)",
                display: "flex",
                alignItems: "center",
                gap: 6
              }}
            >
              <span>✓ Unificar clientas ahora</span>
            </button>
          )}
        </div>
      </div>
    </Overlay>
  )
}
