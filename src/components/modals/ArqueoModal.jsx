import React, { useMemo } from "react"
import { C } from "../../constants/colors.js"
import { fmt } from "../../utils/appointments.js"
import { fmtDate } from "../../utils/dates.js"
import { Overlay, ModalHeader } from "../ui/index.jsx"

export function ArqueoModal({
  isOpen,
  onClose,
  currentDate,
  gastos,
  totalByMethod,
  paidAppts,
  billCounts,
  setBillCounts
}) {
  if (!isOpen) return null

  // Denominations to count (ordered from highest to lowest)
  const denominations = [20000, 10000, 2000, 1000, 500, 200, 100]

  // Filter expenses of the day
  const dailyExpenses = useMemo(() => {
    return (gastos || []).filter(g => g.fecha === currentDate)
  }, [gastos, currentDate])

  // Cash expenses
  const cashExpenses = useMemo(() => {
    return dailyExpenses.filter(g => g.metodoPago === "efectivo")
  }, [dailyExpenses])

  // Released tips of the day (paid from the cash drawer)
  const releasedTips = useMemo(() => {
    return paidAppts.reduce((s, a) => s + (a.tipReleased ? (a.tip || 0) : 0), 0)
  }, [paidAppts])

  // Expected Cash (from header: cash payments - released tips - cash expenses)
  const expectedCash = useMemo(() => {
    return totalByMethod("efectivo")
  }, [totalByMethod])

  // Calculated counted cash
  const totalCountedCash = useMemo(() => {
    return Object.entries(billCounts).reduce((sum, [denom, count]) => {
      return sum + (parseInt(denom) * (parseInt(count) || 0))
    }, 0)
  }, [billCounts])

  // Difference
  const diff = totalCountedCash - expectedCash

  // Handlers for bill increments/decrements
  const adjustCount = (denom, delta) => {
    setBillCounts(p => ({
      ...p,
      [denom]: Math.max(0, (parseInt(p[denom]) || 0) + delta)
    }))
  }

  const handleInputChange = (denom, val) => {
    const parsed = parseInt(val)
    setBillCounts(p => ({
      ...p,
      [denom]: isNaN(parsed) ? "" : Math.max(0, parsed)
    }))
  }

  const handleReset = () => {
    const cleared = {}
    denominations.forEach(d => { cleared[d] = 0 })
    setBillCounts(cleared)
  }

  return (
    <Overlay onClose={onClose}>
      <div 
        onClick={e => e.stopPropagation()} 
        style={{
          background: C.white,
          borderRadius: 20,
          padding: "24px 24px 20px",
          width: "min(860px, calc(100vw - 20px))",
          maxHeight: "92vh",
          overflowY: "auto",
          boxShadow: "0 24px 80px rgba(20,60,30,.22)",
          border: `1.5px solid ${C.greenMint}`,
          display: "flex",
          flexDirection: "column",
          gap: 14,
          position: "relative",
          animation: "scaleIn 0.2s ease-out"
        }}
      >
        {/* Header */}
        <div>
          <ModalHeader emoji="🏦" sub={fmtDate(currentDate)}>
            Arqueo & Cierre de Caja
          </ModalHeader>
          <button 
            onClick={onClose} 
            style={{ 
              position: "absolute", 
              top: 20, 
              right: 20, 
              background: "transparent", 
              border: "none", 
              cursor: "pointer", 
              color: C.textSoft, 
              fontSize: 22, 
              lineHeight: 1 
            }}
          >
            &times;
          </button>
        </div>

        {/* 2-Column Horizontal Grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          gap: 20,
          alignItems: "start"
        }}>
          {/* Column 1: Bill Counter */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 9, fontWeight: "bold", color: C.green, textTransform: "uppercase", letterSpacing: "1px", display: "flex", alignItems: "center", gap: 4 }}>
              <span>💵</span> Conteo de Billetes
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 6, background: C.cream, borderRadius: 14, padding: 12, border: `1px solid ${C.border}` }}>
              {denominations.map(denom => {
                const count = billCounts[denom] || 0
                const subtotal = denom * count
                return (
                  <div key={denom} style={{ display: "grid", gridTemplateColumns: "90px 1fr 110px", gap: 8, alignItems: "center", padding: "4px 0", borderBottom: `1px solid rgba(58,125,68,.05)` }}>
                    {/* Bill badge */}
                    <div style={{ 
                      background: denom >= 10000 ? `linear-gradient(135deg, ${C.green}, ${C.greenLight})` : denom >= 1000 ? `${C.green}18` : "#f3f3f3",
                      color: denom >= 10000 ? "#fff" : C.green,
                      border: denom >= 10000 ? "none" : `1px solid ${C.greenMint}`,
                      borderRadius: 8,
                      padding: "4px 6px",
                      fontSize: 10,
                      fontWeight: "bold",
                      textAlign: "center",
                      boxShadow: denom >= 10000 ? "0 2px 6px rgba(58,125,68,.12)" : "none"
                    }}>
                      $ {denom.toLocaleString()}
                    </div>

                    {/* Quantity input & controls */}
                    <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "center" }}>
                      <button 
                        onClick={() => adjustCount(denom, -1)}
                        style={{ width: 22, height: 22, borderRadius: 6, border: `1px solid ${C.border}`, background: C.white, cursor: "pointer", fontSize: 12, fontWeight: "bold", color: C.textSoft, display: "flex", alignItems: "center", justifyContent: "center" }}
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        value={billCounts[denom] === 0 ? "" : billCounts[denom]}
                        onChange={e => handleInputChange(denom, e.target.value)}
                        placeholder="0"
                        style={{ 
                          width: 44, 
                          padding: "3px 4px", 
                          borderRadius: 6, 
                          border: `1.5px solid ${C.border}`, 
                          textAlign: "center", 
                          fontSize: 12, 
                          fontFamily: "Georgia,serif",
                          fontWeight: "bold",
                          background: C.white,
                          outline: "none"
                        }}
                      />
                      <button 
                        onClick={() => adjustCount(denom, 1)}
                        style={{ width: 22, height: 22, borderRadius: 6, border: `1px solid ${C.border}`, background: C.white, cursor: "pointer", fontSize: 12, fontWeight: "bold", color: C.textSoft, display: "flex", alignItems: "center", justifyContent: "center" }}
                      >
                        +
                      </button>
                    </div>

                    {/* Subtotal */}
                    <div style={{ textAlign: "right", fontSize: 11, fontWeight: "bold", color: subtotal > 0 ? C.text : "#ccc", fontVariantNumeric: "tabular-nums" }}>
                      {subtotal > 0 ? fmt(subtotal) : "—"}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Column 2: Audit Totals, Difference Alert, Outflows list & Actions */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 9, fontWeight: "bold", color: C.green, textTransform: "uppercase", letterSpacing: "1px", display: "flex", alignItems: "center", gap: 4 }}>
              <span>📊</span> Resumen & Balance
            </div>

            {/* Audit Summary Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ background: C.cream, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 8, color: C.textSoft, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 3 }}>Esperado en Caja</div>
                <div style={{ fontSize: 16, fontWeight: "bold", color: C.green }}>{fmt(expectedCash)}</div>
              </div>
              <div style={{ background: `${C.green}0a`, border: `1.5px solid ${C.greenMint}`, borderRadius: 12, padding: "10px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 8, color: C.green, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 3 }}>Total Contado</div>
                <div style={{ fontSize: 16, fontWeight: "bold", color: C.green }}>{fmt(totalCountedCash)}</div>
              </div>
            </div>

            {/* Difference Alert Card */}
            <div style={{ 
              background: diff === 0 ? `${C.green}12` : diff > 0 ? `${C.green}0f` : "#fff1f1", 
              border: `1.5px solid ${diff === 0 ? C.green : diff > 0 ? C.greenMint : "#ffc1c1"}`, 
              borderRadius: 12, 
              padding: "10px 12px", 
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2
            }}>
              <div style={{ fontSize: 9, color: diff >= 0 ? C.green : C.red, textTransform: "uppercase", fontWeight: "bold", letterSpacing: "1.5px" }}>
                {diff === 0 ? "✅ Caja Balanceada" : diff > 0 ? "📈 Sobrante en Caja" : "📉 Faltante en Caja"}
              </div>
              <div style={{ fontSize: 20, fontWeight: "bold", color: diff === 0 ? C.green : diff > 0 ? C.green : C.red }}>
                {diff === 0 ? "$0" : diff > 0 ? `+${fmt(diff)}` : fmt(diff)}
              </div>
              <div style={{ fontSize: 9, color: C.textSoft, fontStyle: "italic" }}>
                {diff === 0 
                  ? "¡El efectivo contado coincide exactamente con el sistema!" 
                  : diff > 0 
                    ? "Hay más efectivo en caja de lo registrado." 
                    : "Hay menos efectivo en caja de lo registrado."
                }
              </div>
            </div>

            {/* Expenses and Outflows Section */}
            <div>
              <div style={{ fontSize: 9, fontWeight: "bold", color: C.orange, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
                <span>💸</span> Salidas de Caja del Día
              </div>
              
              <div style={{ display: "flex", flexDirection: "column", gap: 6, height: 215, overflowY: "auto", paddingRight: 4, background: C.cream, borderRadius: 12, padding: 8, border: `1px solid ${C.border}` }}>
                {releasedTips > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 8px", background: "#fffdf9", border: "1px solid #ffe9c2", borderRadius: 8, fontSize: 10 }}>
                    <span style={{ fontWeight: "bold", color: C.orange }}>🤲 Propinas Entregadas</span>
                    <span style={{ fontWeight: "bold", color: C.orange }}>{fmt(releasedTips)}</span>
                  </div>
                )}

                {cashExpenses.length === 0 && dailyExpenses.filter(g => g.metodoPago !== "efectivo").length === 0 && releasedTips === 0 ? (
                  <div style={{ color: C.textSoft, fontSize: 10, fontStyle: "italic", display: "flex", alignItems: "center", justifyContent: "center", height: "100%", width: "100%" }}>
                    No se registraron gastos hoy.
                  </div>
                ) : (
                  <>
                    {/* Cash expenses */}
                    {cashExpenses.map(g => (
                      <div key={g.id || g.monto + g.descripcion} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 8px", background: "#fcfcff", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 10 }}>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontWeight: "bold", color: C.text }}>💵 {g.descripcion || "Gasto"}</span>
                          <span style={{ fontSize: 8, color: C.textSoft }}>Caja Chica</span>
                        </div>
                        <span style={{ fontWeight: "bold", color: C.text }}>{fmt(parseFloat(g.monto))}</span>
                      </div>
                    ))}

                    {/* Other payment expenses */}
                    {dailyExpenses.filter(g => g.metodoPago !== "efectivo").map(g => (
                      <div key={g.id || g.monto + g.descripcion} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 8px", background: "#fbfbbf10", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 10, opacity: 0.8 }}>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span>{g.metodoPago === "mercadopago" ? "📲" : "💳"} {g.descripcion || "Gasto"}</span>
                          <span style={{ fontSize: 8, color: C.textSoft }}>{g.metodoPago === "mercadopago" ? "Mercado Pago" : "Débito"}</span>
                        </div>
                        <span style={{ fontStyle: "italic" }}>{fmt(parseFloat(g.monto))}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>

            {/* Actions bar */}
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button 
                onClick={handleReset}
                style={{ 
                  flex: 1, 
                  padding: "9px 0", 
                  borderRadius: 11, 
                  border: `1.5px solid ${C.border}`, 
                  background: "transparent", 
                  color: C.textSoft, 
                  fontSize: 9, 
                  letterSpacing: "1.5px", 
                  textTransform: "uppercase", 
                  cursor: "pointer", 
                  fontFamily: "Georgia,serif", 
                  transition: "all .15s",
                  fontWeight: "500"
                }}
              >
                🧹 Limpiar
              </button>
              <button 
                onClick={onClose}
                style={{ 
                  flex: 2, 
                  padding: "9px 0", 
                  borderRadius: 11, 
                  border: "none", 
                  background: `linear-gradient(135deg, ${C.green}, ${C.greenLight})`, 
                  color: "#fff", 
                  fontSize: 9, 
                  letterSpacing: "1.5px", 
                  textTransform: "uppercase", 
                  cursor: "pointer", 
                  fontFamily: "Georgia,serif", 
                  boxShadow: `0 4px 14px ${C.green}40`,
                  transition: "all .2s",
                  fontWeight: "bold"
                }}
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      </div>
    </Overlay>
  )
}
