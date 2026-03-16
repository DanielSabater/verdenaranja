import { useState } from "react"
import { C } from "../../constants/colors.js"
import { PAYMENT_METHODS } from "../../constants/data.js"
import { fmt, apptTotal } from "../../utils/appointments.js"
import { Overlay, ModalHeader, Field, GhostBtn, SolidBtn, inputStyle, modalBox } from "../ui/index.jsx"

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
      _cachedAudio.play().catch(() => {})
    })
  } catch(e) {}
}



export function AppModals({
  modal, setModal,
  payModal, setPayModal,
  deleteKey, setDeleteKey,
  clientName, setClientName,
  apptNotes, setApptNotes,
  chosenServices,
  filterCat, setFilterCat,
  paymentSplits,
  filteredServices, services,
  saveAppt, confirmPay, doDelete,
  apptTip, setApptTip,
  addSplit, removeSplit, updateSplit,
  toggleService, removeService,
  modalSubtotal, modalDuration,
  appointments,
  professionals,
  clientes, setClientes,
}) {
  const [showSug, setShowSug] = useState(false)
  const safeClientes = clientes || []
  const suggestions = safeClientes.filter(cl =>
    clientName.length > 1 && cl.name.toLowerCase().includes(clientName.toLowerCase())
  )
  const isNewCliente = clientName.trim().length > 1 &&
    !safeClientes.some(cl => cl.name.toLowerCase() === clientName.trim().toLowerCase())
  const saveNewCliente = () => {
    if (!clientName.trim()) return
    setClientes(p => [...(p||[]), { id: Date.now(), name: clientName.trim(), phone:"", notes:"" }])
  }


  return (
    <>
      {/* ── MODAL NUEVO / EDITAR ── */}
      {modal && (
        <Overlay onClose={() => setModal(null)}>
          <div className="modal-sheet" style={modalBox}>
            <ModalHeader
              emoji={modal.editKey ? "✏️" : "🌿"}
              sub={modal.editKey ? "Editar turno" : "Nuevo turno"}
            >
              {professionals?.find(p => p.id === modal.profId)?.name} · {modal.hour} hs
            </ModalHeader>

            <Field label="Nombre del cliente">
              <div style={{ position:"relative" }}>
                <input
                  value={clientName}
                  onChange={e => { setClientName(e.target.value); setShowSug(true) }}
                  placeholder="Ej: María González"
                  style={{ ...inputStyle, paddingRight: isNewCliente ? 100 : 12 }}
                  onFocus={() => setShowSug(true)}
                  onBlur={() => setTimeout(() => setShowSug(false), 150)}
                />
                {isNewCliente && (
                  <button
                    onMouseDown={saveNewCliente}
                    style={{ position:"absolute", right:6, top:"50%", transform:"translateY(-50%)", padding:"3px 9px", borderRadius:8, border:"none", background:`linear-gradient(135deg,${C.green},${C.greenLight})`, color:"#fff", fontSize:9, cursor:"pointer", fontFamily:"Georgia,serif" }}
                  >💾 Guardar</button>
                )}
                {showSug && suggestions.length > 0 && (
                  <div style={{ position:"absolute", top:"calc(100% + 4px)", left:0, right:0, zIndex:999, background:C.white, borderRadius:10, border:`1.5px solid ${C.greenMint}`, boxShadow:"0 8px 24px rgba(58,125,68,.14)", overflow:"hidden" }}>
                    {suggestions.map(cl => (
                      <div key={cl.id}
                        onMouseDown={() => { setClientName(cl.name); setShowSug(false) }}
                        style={{ padding:"9px 14px", cursor:"pointer", borderBottom:`1px solid ${C.greenPale}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}
                        onMouseEnter={e => e.currentTarget.style.background = C.greenPale}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                      >
                        <div>
                          <div style={{ fontSize:13, color:C.text }}>{cl.name}</div>
                          {cl.phone && <div style={{ fontSize:10, color:C.textSoft }}>{cl.phone}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {isNewCliente && <div style={{ fontSize:10, color:C.textSoft, marginTop:4 }}>✨ Clienta nueva — guardá para la próxima</div>}
            </Field>

            <Field label="Observaciones">
              <textarea
                value={apptNotes}
                onChange={e => setApptNotes(e.target.value)}
                placeholder="Ej: cliente pide diseño especial, alergia a X producto..."
                rows={2}
                style={{ ...inputStyle, resize:"vertical", fontSize:12 }}
              />
            </Field>

            {chosenServices.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 8, letterSpacing: "2px", color: C.textSoft, textTransform: "uppercase", marginBottom: 6 }}>
                  Servicios seleccionados
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {chosenServices.map(sv => (
                    <div key={sv.id} style={{
                      display: "flex", alignItems: "center", gap: 5,
                      background: C.greenPale, border: `1px solid ${C.greenMint}`,
                      borderRadius: 20, padding: "4px 10px", fontSize: 11, color: C.green,
                    }}>
                      {sv.icon} {sv.name}
                      <span onClick={() => removeService(sv.id)} style={{ cursor: "pointer", color: "#a0b8a4", fontWeight: "bold", marginLeft: 2 }}>×</span>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: C.orange, marginTop: 6, textAlign: "right" }}>
                  {modalDuration} min · <strong>{fmt(modalSubtotal)}</strong>
                </div>
              </div>
            )}

            <Field label="Agregar servicio">
              <div style={{ display: "flex", gap: 5, marginBottom: 8, flexWrap: "wrap" }}>
                {["all", "manos", "pies", "combo"].map(cat => (
                  <button key={cat} onClick={() => setFilterCat(cat)} style={{
                    padding: "4px 9px", borderRadius: 20, cursor: "pointer",
                    border: `1.5px solid ${filterCat === cat ? C.green : C.border}`,
                    background: filterCat === cat ? C.greenPale : C.white,
                    color: filterCat === cat ? C.green : C.textSoft,
                    fontSize: 9, letterSpacing: "1px", textTransform: "uppercase",
                    fontFamily: "Georgia,serif", transition: "all .15s",
                  }}>
                    {cat === "all" ? "Todos" : cat === "manos" ? "💅 Manos" : cat === "pies" ? "🦶 Pies" : "🌸 Combo"}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 240, overflowY: "auto", paddingRight: 3 }}>
                {filteredServices.map(s => {
                  const isChosen = chosenServices.some(x => x.id === s.id)
                  return (
                    <div key={s.id} onClick={() => toggleService(s)} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "8px 11px", borderRadius: 10, cursor: "pointer",
                      border: `1.5px solid ${isChosen ? C.green : C.border}`,
                      background: isChosen ? C.greenPale : C.white, transition: "all .15s",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <span style={{ fontSize: 15 }}>{isChosen ? "✅" : "⬜"}</span>
                        <div>
                          <span style={{ fontSize: 12, color: C.text }}>{s.icon} {s.name}</span>
                          <span style={{ fontSize: 9, color: C.textSoft, marginLeft: 6 }}>{s.duration} min</span>
                        </div>
                      </div>
                      <span style={{ fontSize: 12, color: C.orange, fontWeight: "bold" }}>{fmt(s.price)}</span>
                    </div>
                  )
                })}
              </div>
            </Field>

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <GhostBtn onClick={() => setModal(null)}>Cancelar</GhostBtn>
              <SolidBtn onClick={saveAppt} disabled={!chosenServices.length || !clientName.trim()} color={C.green}>
                {modal.editKey ? "✏️ Guardar cambios" : "🌿 Confirmar turno"}
              </SolidBtn>
            </div>
          </div>
        </Overlay>
      )}

      {/* ── MODAL PAGO ── */}
      {payModal && appointments[payModal] && (() => {
        const appt    = appointments[payModal]
        const total    = apptTotal(appt)
        const tipAmount = parseFloat(apptTip) || 0
        const totalWithTip = total + tipAmount
        const sumPaid  = paymentSplits.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
        const balance  = totalWithTip - sumPaid
        const balanced = Math.abs(balance) <= 1
        // eslint-disable-next-line no-unused-vars
        const usedMids = paymentSplits.map(r => r.methodId)
        const canAdd   = PAYMENT_METHODS.some(m => !usedMids.includes(m.id))
        return (
          <Overlay onClose={() => setPayModal(null)}>
            <div className="modal-sheet" style={{ ...modalBox, maxWidth: 500, width: "calc(100vw - 32px)" }}>
              <ModalHeader emoji="💰" sub={appt.paid ? "Editar pago" : "Registrar pago"}>
                {appt.client} · <span style={{ color: C.orange }}>{fmt(totalWithTip)}</span>
              </ModalHeader>

              <div style={{ background: C.cream, borderRadius: 10, padding: "10px 13px", marginBottom: 16, border: `1px solid ${C.border}` }}>
                {appt.services.map((sv, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.textSoft, lineHeight: 1.8 }}>
                    <span>{sv.icon} {sv.name}</span>
                    <span style={{ color: C.text }}>{fmt(sv.price)}</span>
                  </div>
                ))}
                {/* Tip row */}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:8, paddingTop:6, borderTop:`1px solid ${C.border}` }}>
                  <span style={{ fontSize:11, color:C.textSoft }}>🎁 Propina</span>
                  <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                    <span style={{ fontSize:11, color:C.textSoft }}>$</span>
                    <input
                      type="number"
                      value={apptTip}
                      onChange={e => setApptTip(e.target.value)}
                      placeholder="0"
                      style={{ width:80, padding:"4px 8px", border:`1.5px solid ${C.border}`, borderRadius:8, fontSize:12, color:C.text, background:C.cream, outline:"none", fontFamily:"Georgia,serif", textAlign:"right" }}
                    />
                  </div>
                </div>
                <div style={{ borderTop:`1px solid ${C.border}`, marginTop:6, paddingTop:6, display:"flex", justifyContent:"space-between" }}>
                  <span style={{ fontSize:11, fontWeight:"bold", color:C.text }}>Total{parseFloat(apptTip)>0?` + propina`:""}</span>
                  <span style={{ fontSize:14, fontWeight:"bold", color:C.orange }}>{fmt(total + (parseFloat(apptTip)||0))}</span>
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

              <div style={{ display: "flex", gap: 8 }}>
                <GhostBtn onClick={() => setPayModal(null)}>Cancelar</GhostBtn>
                <SolidBtn onClick={() => { playPaySound(); confirmPay() }} disabled={!balanced} color={appt.paid ? C.green : C.orange}>
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
                {appointments[deleteKey].services.map(s => s.name).join(", ")}
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
