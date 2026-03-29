import { useState } from "react"
import { C } from "../../constants/colors.js"
import { PAYMENT_METHODS, HOURS } from "../../constants/data.js"
import { fmt, cellKey, apptTotal, apptDur } from "../../utils/appointments.js"
import { Overlay, ModalHeader, GhostBtn, modalBox } from "../ui/index.jsx"

const smallBtn = (color) => ({
  padding: "3px 8px", borderRadius: 8, border: "none",
  background: color, color: "#fff", fontSize: 9,
  letterSpacing: "1px", cursor: "pointer",
  fontFamily: "Georgia,serif", opacity: 0.92,
  transition: "opacity .15s",
})

export function AppGrid({
  professionals, appointments, isMobile,
  draggingKey, dropTarget, dropValid, resizePreview,
  isOccupied, spanOf,
  onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop,
  onResizeStart,
  paidAppts, totalByProf, earningsByProf, comisionPct,
  onCellClick, onEdit, onPay, onDelete,
  CELL_H,
}) {
  const [profPopup, setProfPopup] = useState(null)

  const getProfSummary = (profId) => {
    const appts = Object.values(appointments).filter(a => a.profId === profId)
    const paid  = appts.filter(a => a.paid)
    const total = paid.reduce((s,a) => s + apptTotal(a), 0)
    const tips  = paid.reduce((s,a) => s + (a.tip||0), 0)
    const byMethod = {}
    paid.forEach(a => {
      if (a.paymentSplits?.length) {
        a.paymentSplits.forEach(sp => { byMethod[sp.methodId] = (byMethod[sp.methodId]||0) + (parseFloat(sp.amount)||0) })
      } else if (a.payMethod) {
        byMethod[a.payMethod] = (byMethod[a.payMethod]||0) + apptTotal(a)
      }
    })
    return { appts, paid, total, tips, byMethod }
  }

  const renderPaymentMethod = (a) => {
    if (!a.paid) return "⏳ Pendiente"
    if (a.paymentSplits?.length) {
      return a.paymentSplits.map((r, i) => {
        const pm = PAYMENT_METHODS.find(m => m.id === r.methodId)
        return <span key={i} style={{ marginRight:6 }}>{pm?.icon} {fmt(r.amount)}</span>
      })
    }
    const pm = PAYMENT_METHODS.find(m => m.id === a.payMethod)
    return pm ? `${pm.icon} ${pm.label}` : "Pago"
  }

  return (
    <div className="grid-scroll" style={{ overflowX:"auto", padding:"16px 8px 0", WebkitOverflowScrolling:"touch", minHeight:"100%" }}>
      <table style={{ borderCollapse:"collapse", tableLayout:"fixed", width:"100%", minWidth: isMobile ? `${professionals.length*80}px` : `${professionals.length*140}px` }}>
        <thead>
          <tr>
            {professionals.map(p => (
              <th key={p.id} style={{ padding: isMobile?"6px 2px":"10px 5px", borderBottom:`2px solid ${C.border}`, width:`${100/professionals.length}%`, minWidth: isMobile?80:140, position:"sticky", top:0, zIndex:100, background:C.white }}>
                <div onClick={() => setProfPopup(profPopup===p.id ? null : p.id)}
                  style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3, cursor:"pointer" }}>
                  <div style={{
                    width:36, height:36, borderRadius:"50%",
                    background: profPopup===p.id ? `linear-gradient(135deg,${C.green},${C.greenLight})` : `linear-gradient(135deg,${C.greenPale},${C.greenMint})`,
                    border:`2px solid ${profPopup===p.id ? C.green : C.greenLight}`,
                    display:"flex", alignItems:"center", justifyContent:"center", fontSize:16,
                    transition:"all .2s",
                  }}>{p.emoji}</div>
                  <span style={{ fontSize:11, color: profPopup===p.id ? C.green : C.text, fontWeight: profPopup===p.id ? "bold" : "normal" }}>{p.name}</span>
                </div>

              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {HOURS.map((hour, hIdx) => (
            <tr key={hour} style={{ background: hIdx%2===0?C.white:C.cream }}>
              {professionals.map(prof => {
                const k    = cellKey(prof.id, hour)
                const appt = appointments[k]
                const span = spanOf(prof.id, hour)

                const liveResizeSpan = appt && resizePreview?.key === k ? resizePreview.slots : null

                const isCoveredByResize = !appt && resizePreview && (() => {
                  const [rpid] = resizePreview.key.split("||")
                  if (parseInt(rpid) !== prof.id) return false
                  const rStart = resizePreview.hourIdx
                  const rEnd   = rStart + resizePreview.slots
                  const hi     = HOURS.indexOf(hour)
                  return hi > rStart && hi < rEnd
                })()

                const isBlocked = !appt && (isOccupied(prof.id, hour) || isCoveredByResize)
                if (isBlocked) return null

                const isDragging = draggingKey === k
                const isTarget   = dropTarget?.profId===prof.id && dropTarget?.hour===hour

                let cellBg = ""
                if (!appt && draggingKey) {
                  cellBg = isTarget ? (dropValid ? C.dragOver : C.dragBad) : ""
                }

                return (
                  <td key={prof.id} rowSpan={liveResizeSpan || span || 1}
                    style={{
                      padding:3,
                      height: appt ? `${(liveResizeSpan||span||1)*50}px` : 50,
                      verticalAlign:"middle",
                      border:`1px solid ${C.border}`,
                      background: cellBg,
                      transition:"background .12s",
                      cursor: appt ? "grab" : (draggingKey ? "default" : "pointer"),
                      position:"relative",
                    }}
                    onClick={() => !appt && !draggingKey && onCellClick(prof.id, hour)}
                    onMouseEnter={e => { if(!appt && !draggingKey) e.currentTarget.style.background = C.greenPale }}
                    onMouseLeave={e => { if(!appt && !draggingKey) e.currentTarget.style.background = "" }}
                    onDragOver={e => !appt && onDragOver(e, prof.id, hour)}
                    onDragLeave={() => !appt && onDragLeave()}
                    onDrop={e => !appt && onDrop(e, prof.id, hour)}
                  >
                    {appt ? (() => {
                      const isResizing  = resizePreview?.key === k
                      const liveSlots   = isResizing ? resizePreview.slots   : (span || 1)
                      const liveHourIdx = isResizing ? resizePreview.hourIdx : HOURS.indexOf(appt.hour)
                      const liveEndIdx  = liveHourIdx + liveSlots
                      const liveHour    = HOURS[liveHourIdx] || appt.hour
                      const liveEndHour = liveEndIdx < HOURS.length ? HOURS[liveEndIdx] : "20:00"
                      const liveDurMins = liveSlots * 30
                      return (
                        <div
                          draggable={!resizePreview}
                          onDragStart={e => { if(resizePreview){e.preventDefault();return;} onDragStart(e, k) }}
                          onDragEnd={onDragEnd}
                          onDoubleClick={e => { if(!resizePreview) { e.stopPropagation(); onEdit(k, appointments[k]); }}}
                          style={{
                            height:"100%", borderRadius:9,
                            background: appt.paid
                              ? `linear-gradient(135deg,${C.greenPale},#d8f0dc)`
                              : `linear-gradient(135deg,${C.orangePale},#fde8d4)`,
                            border: isResizing
                              ? `2px dashed ${C.green}`
                              : `1.5px solid ${appt.paid?C.greenLight:C.orangeLight}`,
                            padding:"14px 7px 5px",
                            display:"flex", flexDirection:"column", justifyContent:"space-between",
                            boxShadow: isDragging
                              ? `0 10px 30px rgba(58,125,68,.30)`
                              : `0 2px 8px ${appt.paid?"rgba(58,125,68,.10)":"rgba(232,121,58,.10)"}`,
                            opacity: isDragging ? 0.45 : 1,
                            transform: isDragging ? "scale(0.97)" : "scale(1)",
                            transition: isResizing ? "none" : "opacity .15s, box-shadow .15s, transform .15s",
                            cursor:"grab",
                            position:"relative",
                            overflow:"visible",
                          }}
                        >
                          <div onMouseDown={e => { e.stopPropagation(); onResizeStart(e, k, "top") }}
                            style={{ position:"absolute", top:0, left:0, right:0, height:10, cursor:"n-resize", zIndex:10, borderRadius:"9px 9px 0 0", display:"flex", alignItems:"center", justifyContent:"center", background: isResizing ? "rgba(58,125,68,.08)" : "transparent" }}>
                            <div style={{ width:36, height:3, borderRadius:2, background: appt.paid ? C.greenLight : C.orangeLight, opacity:.65 }}/>
                          </div>

                          {isResizing && (
                            <div style={{ position:"absolute", top:12, left:"50%", transform:"translateX(-50%)", background:C.green, color:"#fff", borderRadius:8, padding:"2px 8px", fontSize:9, fontWeight:"bold", letterSpacing:"1px", whiteSpace:"nowrap", zIndex:20, pointerEvents:"none", boxShadow:"0 2px 8px rgba(58,125,68,.35)" }}>{liveHour} – {liveEndHour} · {liveDurMins} min</div>
                          )}

                          <div style={{ position:"absolute", top:4, right:5, fontSize:9, color:"rgba(100,130,100,.4)", pointerEvents:"none" }}>⠿</div>

                          <div style={{ overflow:"hidden", marginTop:2 }}>
                            <div style={{ fontSize:11, fontWeight:"bold", color:C.text, marginBottom:1, paddingRight:12, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{appt.client}</div>
                            {(appt.services||[]).map((sv,i)=>(
                              <div key={i} style={{ fontSize:9, color:appt.paid?C.green:C.orange, lineHeight:1.4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{sv.icon} {sv.name}</div>
                            ))}
                            {appt.notes && (
                              <div style={{ fontSize:9, color:C.textSoft, fontStyle:"italic", marginTop:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>📝 {appt.notes}</div>
                            )}
                            <div style={{ fontSize:9, color:C.textSoft, marginTop:2 }}>
                              <span style={{ color: isResizing ? C.green : C.textSoft, fontWeight: isResizing ? "bold" : "normal", transition:"color .15s" }}>
                                {isResizing ? `${liveHour} – ${liveEndHour}` : `${apptDur(appt)} min`}
                              </span>
                              {" · "}<span style={{ color:C.orange, fontWeight:"bold" }}>{fmt(apptTotal(appt))}</span>
                            </div>
                            {appt.paid && (
                              <div style={{ fontSize:8, color:C.green, marginTop:1, letterSpacing:".8px" }}>
                                {appt.paymentSplits?.length > 1
                                  ? appt.paymentSplits.map((r,i)=>{ const pm = PAYMENT_METHODS.find(m=>m.id===r.methodId); return <span key={i} style={{ marginRight:3 }}>{pm?.icon} {fmt(r.amount)}</span> })
                                  : <>✓ {PAYMENT_METHODS.find(m=>m.id===appt.payMethod)?.icon} {PAYMENT_METHODS.find(m=>m.id===appt.payMethod)?.label}</>
                                }
                              </div>
                            )}
                            {appt.tip > 0 && (
                              <div style={{ fontSize:8, color:C.gold, marginTop:1 }}>🎁 Propina: {fmt(appt.tip)}</div>
                            )}
                          </div>

                          <div style={{ display:"flex", justifyContent:"flex-end", alignItems:"center", gap:3, marginTop:4, marginBottom:8 }}>
                            <button onMouseDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();onDelete(k)}} style={{ width:22, borderRadius:6, border:`1px solid ${C.border}`, background:"rgba(255,255,255,.8)", color:"#c0a0a0", fontSize:9, cursor:"pointer" }}>✕</button>
                            {appt.paid
                              ? <button onMouseDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();onPay(k)}} style={smallBtn("#7a9e7a")}>{isMobile?"✏️":"✏️ Pago"}</button>
                              : <button onMouseDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();onPay(k)}} style={smallBtn(C.orange)}>{isMobile?"💰":"💰 Abonar"}</button>
                            }
                          </div>

                          <div onMouseDown={e => { e.stopPropagation(); onResizeStart(e, k, "bottom") }}
                            style={{ position:"absolute", bottom:0, left:0, right:0, height:14, cursor:"s-resize", zIndex:10, borderRadius:"0 0 9px 9px", display:"flex", alignItems:"center", justifyContent:"center", background: isResizing ? "rgba(58,125,68,.08)" : `linear-gradient(to bottom, transparent, ${appt.paid?"rgba(90,158,102,.07)":"rgba(232,121,58,.07)"})` }}>
                            <div style={{ width:36, height:3, borderRadius:2, background: appt.paid ? C.greenLight : C.orangeLight, opacity:.7 }}/>
                          </div>
                        </div>
                      )
                    })() : (
                      <div style={{ height:42, borderRadius:7, display:"flex", alignItems:"center", justifyContent:"center", color: isTarget && dropValid ? C.green : (isTarget ? "#e06060" : C.textSoft), fontSize: isTarget ? 22 : 10, letterSpacing:"0.5px", transition:"all .12s" }}>
                        {isTarget ? (dropValid ? "✓" : "✕") : (hour.endsWith(":00") || hour.endsWith(":30") ? hour : "")}
                      </div>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>

        <tfoot>
          <tr style={{ borderTop:`2px solid ${C.greenMint}` }}>
            {professionals.map(prof => {
              const t   = totalByProf(prof.id)
              const cnt = paidAppts.filter(a=>a.profId===prof.id).length
              return (
                <td key={prof.id} style={{ padding:"6px 4px", textAlign:"center" }}>
                  <div style={{ background:t>0?C.greenPale:"#f5f5f5", border:`1px solid ${t>0?C.greenMint:"#e5e5e5"}`, borderRadius:10, padding:"6px 4px", transition:"all .3s" }}>
                    <div style={{ fontSize:14, fontWeight:"bold", color:t>0?C.green:"#ccc" }}>{fmt(t)}</div>
                    <div style={{ fontSize:8, color:t>0?C.textSoft:"#ccc", letterSpacing:"1px" }}>{cnt} abonado{cnt!==1?"s":""}</div>
                  </div>
                </td>
              )
            })}
          </tr>
          <tr style={{ borderTop:`1px dashed ${C.goldLight}` }}>
            {professionals.map(prof => {
              const e = earningsByProf(prof.id)
              return (
                <td key={prof.id} style={{ padding:"6px 4px", textAlign:"center" }}>
                  <div style={{ background:e>0?C.goldPale:"#f5f5f5", border:`1px solid ${e>0?C.goldLight:"#e5e5e5"}`, borderRadius:10, padding:"6px 4px", transition:"all .3s" }}>
                    <div style={{ fontSize:13, fontWeight:"bold", color:e>0?C.gold:"#ccc" }}>{fmt(e)}</div>
                    <div style={{ fontSize:8, color:e>0?"#b07820":"#ccc", letterSpacing:"1px" }}>ganancia</div>
                  </div>
                </td>
              )
            })}
          </tr>
        </tfoot>
      </table>
      {profPopup && (() => {
        const prof = professionals.find(p => p.id === profPopup)
        if (!prof) return null
        const s = getProfSummary(prof.id)
        const sortedAppts = [...s.appts].sort((a,b) => (a.hour||"").localeCompare(b.hour||""))
        return (
          <Overlay onClose={() => setProfPopup(null)}>
            <div className="modal-sheet" style={{ ...modalBox, width: "min(560px, calc(100vw - 32px))", maxHeight: "92vh", display: "flex", flexDirection: "column", padding: 0 }}>
              <div style={{ padding: 24, overflowY: "auto", maxHeight: "82vh" }}>
                <ModalHeader emoji={prof.emoji} sub="Resumen de turnos">
                  {prof.name} · {s.appts.length} turno{s.appts.length !== 1 ? "s" : ""}
                </ModalHeader>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, marginBottom: 16 }}>
                  {[
                    ["📅 Turnos", s.appts.length, C.textSoft],
                    ["✅ Cobrados", s.paid.length, C.green],
                    ["💰 Total", fmt(s.total), C.orange],
                    ["🎁 Propinas", fmt(s.tips), C.gold],
                  ].map(([label, val, col]) => (
                    <div key={label} style={{ background: C.cream, borderRadius: 12, padding: "10px 12px" }}>
                      <div style={{ fontSize: 9, color: C.textSoft, letterSpacing: "1px" }}>{label}</div>
                      <div style={{ fontSize: 15, color: col, fontWeight: "bold", marginTop: 6 }}>{val}</div>
                    </div>
                  ))}
                </div>

                {Object.keys(s.byMethod).length > 0 && (
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: 10, letterSpacing: "2px", color: C.textSoft, textTransform: "uppercase", marginBottom: 8 }}>Por método de pago</div>
                    <div style={{ display: "grid", gap: 8 }}>
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
                  <div style={{ display: "grid", gap: 10 }}>
                    {sortedAppts.map((a, index) => (
                      <div key={index} style={{ borderRadius: 14, border: `1px solid ${C.border}`, padding: 12, background: C.white }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", marginBottom: 6 }}>
                          <div style={{ fontSize: 12, fontWeight: "bold", color: C.text }}>{a.hour} · {a.client}</div>
                          <div style={{ fontSize: 11, color: a.paid ? C.green : C.orange, fontWeight: "bold" }}>
                            {a.paid ? fmt(apptTotal(a)) : "⏳ Pendiente"}
                          </div>
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                          {(a.services||[]).map((sv, i) => (
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
              <div style={{ borderTop: `1px solid ${C.border}`, padding: 14, background: C.cream, display: "flex", justifyContent: "flex-end" }}>
                <GhostBtn onClick={() => setProfPopup(null)}>Cerrar</GhostBtn>
              </div>
            </div>
          </Overlay>
        )
      })()}
    </div>
  )
}
