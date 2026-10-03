import React, { useMemo } from "react"
import { C } from "../../constants/colors.js"
import { fmt, apptTotal } from "../../utils/appointments.js"
import { fmtDate, fmtShort } from "../../utils/dates.js"
import { formatWaNumber, openWhatsAppLink, cleanClientName } from "../../utils/whatsapp.js"
import { Overlay, AnimatedNumber } from "../ui/index.jsx"

export function DailySummaryModal({
  isOpen,
  onClose,
  currentDate,
  totalByMethod,
  grandTotal,
  scheduledStats,
  getApptsByMethod,
  pastUnpaidAppts = [],
  onNavigateToTurno,
  privacyMode = false
}) {
  if (!isOpen) return null

  // Cobros por método
  const cashAppts = useMemo(() => getApptsByMethod("efectivo") || [], [getApptsByMethod])
  const debitAppts = useMemo(() => getApptsByMethod("debito") || [], [getApptsByMethod])
  const mpAppts = useMemo(() => getApptsByMethod("mercadopago") || [], [getApptsByMethod])

  const cashTotal = useMemo(() => totalByMethod("efectivo") || 0, [totalByMethod])
  const debitTotal = useMemo(() => totalByMethod("debito") || 0, [totalByMethod])
  const mpTotal = useMemo(() => totalByMethod("mercadopago") || 0, [totalByMethod])

  // Deudas pendientes: únicamente turnos de días anteriores sin cobrar (Opción 1)
  const unpaidAppts = pastUnpaidAppts

  const totalUnpaidMoney = useMemo(() => {
    return unpaidAppts.reduce((sum, a) => sum + (a.totalAmount || 0), 0)
  }, [unpaidAppts])

  return (
    <Overlay onClose={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: C.white,
          borderRadius: 22,
          padding: "20px 24px 22px",
          width: "min(1160px, calc(100vw - 28px))",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          boxShadow: "0 24px 80px rgba(20,60,30,.24)",
          border: `1.5px solid ${C.greenMint}`,
          position: "relative",
          animation: "scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)"
        }}
      >
        {/* Cabecera Principal */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: "2.5px", color: C.orange, textTransform: "uppercase", fontWeight: "bold", marginBottom: 3 }}>
              📊 Control Diario de Cobros · Verde Naranja
            </div>
            <div style={{ fontSize: 20, fontWeight: "800", color: C.text, fontFamily: "Georgia, serif", display: "flex", alignItems: "center", gap: 8 }}>
              <span>Resumen del Día</span>
              <span style={{ fontSize: 13, fontWeight: "normal", color: C.textSoft, fontFamily: "sans-serif" }}>
                · {fmtDate(currentDate)}
              </span>
            </div>
          </div>

          {/* Tarjetas resumen superior */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {/* Total General */}
            <div style={{
              background: `linear-gradient(135deg, ${C.green}, ${C.greenLight})`,
              color: "#ffffff",
              padding: "7px 14px",
              borderRadius: 12,
              textAlign: "right",
              boxShadow: "0 4px 14px rgba(43,122,58,0.22)"
            }}>
              <div style={{ fontSize: 8, letterSpacing: "1px", textTransform: "uppercase", opacity: 0.85, fontWeight: "bold" }}>
                Total Recaudado
              </div>
              <div className={privacyMode ? "privacy-blur" : ""} style={{ fontSize: 18, fontWeight: "bold", fontVariantNumeric: "tabular-nums" }}>
                <AnimatedNumber value={grandTotal} formatFn={fmt} />
              </div>
            </div>

            {/* Progreso del día */}
            <div style={{
              background: scheduledStats?.isFullyPaid ? "#f0fdf4" : C.cream,
              border: `1.5px solid ${scheduledStats?.isFullyPaid ? C.greenMint : C.border}`,
              padding: "7px 12px",
              borderRadius: 12,
              textAlign: "left"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 13, fontWeight: "800", color: scheduledStats?.isFullyPaid ? C.green : C.text, fontVariantNumeric: "tabular-nums" }}>
                  {scheduledStats?.pctCount || 0}%
                </span>
                {scheduledStats?.isFullyPaid && (
                  <span style={{ fontSize: 8, color: "#ffffff", background: C.green, fontWeight: "bold", padding: "1px 5px", borderRadius: 4 }}>
                    COMPLETO
                  </span>
                )}
              </div>
              <div style={{ fontSize: 9, color: C.textSoft }}>
                {scheduledStats?.paidCount || 0} de {scheduledStats?.totalCount || 0} turnos cobrados
              </div>
            </div>

            {/* Botón Cerrar */}
            <button
              type="button"
              onClick={onClose}
              style={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                background: "#f4f4f4",
                border: "none",
                cursor: "pointer",
                color: C.textSoft,
                fontSize: 18,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all .15s"
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "#e8e8e8"; e.currentTarget.style.color = C.text }}
              onMouseLeave={e => { e.currentTarget.style.background = "#f4f4f4"; e.currentTarget.style.color = C.textSoft }}
              title="Cerrar ventana (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Separador sutil */}
        <div style={{ height: 1.5, background: `linear-gradient(90deg, ${C.greenMint}, ${C.border}, transparent)`, borderRadius: 2 }} />

        {/* 4 Columnas: Efectivo, Débito, Mercado Pago, Sin Cobrar */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 12,
          flex: 1,
          minHeight: 0
        }}>
          {/* 1. Columna Efectivo */}
          <div style={{
            background: "#fafdf9",
            borderRadius: 16,
            border: `1.5px solid ${C.greenMint}`,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden"
          }}>
            {/* Header columna */}
            <div style={{
              background: C.greenPale,
              padding: "10px 14px",
              borderBottom: `1px solid ${C.greenMint}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <div>
                <div style={{ fontSize: 9, letterSpacing: "1.5px", color: C.green, textTransform: "uppercase", fontWeight: "bold" }}>
                  💵 Efectivo
                </div>
                <div style={{ fontSize: 9, color: C.textSoft, marginTop: 1 }}>
                  {cashAppts.length} cobro{cashAppts.length !== 1 ? "s" : ""}
                </div>
              </div>
              <div className={privacyMode ? "privacy-blur" : ""} style={{ fontSize: 16, fontWeight: "bold", color: C.green, fontVariantNumeric: "tabular-nums" }}>
                <AnimatedNumber value={cashTotal} formatFn={fmt} />
              </div>
            </div>

            {/* Lista scrolleable */}
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px", maxHeight: 440, display: "flex", flexDirection: "column", gap: 6 }}>
              {cashAppts.length === 0 ? (
                <div style={{ fontSize: 11, color: C.textSoft, textAlign: "center", padding: "24px 0", fontStyle: "italic" }}>
                  Sin cobros en efectivo
                </div>
              ) : (
                cashAppts.map((a, i) => (
                  <div
                    key={a.id || i}
                    onClick={() => {
                      onNavigateToTurno?.({
                        date: currentDate,
                        hour: a.hour,
                        profId: a.profId,
                        rama: a.profRama || "manos",
                        openEdit: false
                      })
                      onClose()
                    }}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "7px 9px",
                      borderRadius: 9,
                      background: C.white,
                      border: `1px solid ${C.border}`,
                      cursor: "pointer",
                      transition: "all .12s"
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = C.greenMint}
                    onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
                    title="Clic para ver turno en planilla"
                  >
                    <div style={{ flex: 1, minWidth: 0, paddingRight: 6 }}>
                      <div style={{ fontSize: 11, fontWeight: "bold", color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {a.client}
                      </div>
                      <div style={{ fontSize: 9, color: C.textSoft }}>
                        {a.hour} hs · {(a.services || []).map(s => s.name).join(", ")}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: "bold", color: C.green, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                      {fmt(a.methodAmount)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 2. Columna Débito */}
          <div style={{
            background: "#fffcf7",
            borderRadius: 16,
            border: `1.5px solid ${C.amberMid}`,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden"
          }}>
            {/* Header columna */}
            <div style={{
              background: C.amberPale,
              padding: "10px 14px",
              borderBottom: `1px solid ${C.amberMid}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <div>
                <div style={{ fontSize: 9, letterSpacing: "1.5px", color: C.amber, textTransform: "uppercase", fontWeight: "bold" }}>
                  💳 Débito
                </div>
                <div style={{ fontSize: 9, color: C.textSoft, marginTop: 1 }}>
                  {debitAppts.length} cobro{debitAppts.length !== 1 ? "s" : ""}
                </div>
              </div>
              <div className={privacyMode ? "privacy-blur" : ""} style={{ fontSize: 16, fontWeight: "bold", color: C.amber, fontVariantNumeric: "tabular-nums" }}>
                <AnimatedNumber value={debitTotal} formatFn={fmt} />
              </div>
            </div>

            {/* Lista scrolleable */}
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px", maxHeight: 440, display: "flex", flexDirection: "column", gap: 6 }}>
              {debitAppts.length === 0 ? (
                <div style={{ fontSize: 11, color: C.textSoft, textAlign: "center", padding: "24px 0", fontStyle: "italic" }}>
                  Sin cobros en débito
                </div>
              ) : (
                debitAppts.map((a, i) => (
                  <div
                    key={a.id || i}
                    onClick={() => {
                      onNavigateToTurno?.({
                        date: currentDate,
                        hour: a.hour,
                        profId: a.profId,
                        rama: a.profRama || "manos",
                        openEdit: false
                      })
                      onClose()
                    }}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "7px 9px",
                      borderRadius: 9,
                      background: C.white,
                      border: `1px solid ${C.border}`,
                      cursor: "pointer",
                      transition: "all .12s"
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = C.amberMid}
                    onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
                    title="Clic para ver turno en planilla"
                  >
                    <div style={{ flex: 1, minWidth: 0, paddingRight: 6 }}>
                      <div style={{ fontSize: 11, fontWeight: "bold", color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {a.client}
                      </div>
                      <div style={{ fontSize: 9, color: C.textSoft }}>
                        {a.hour} hs · {(a.services || []).map(s => s.name).join(", ")}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: "bold", color: C.amber, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                      {fmt(a.methodAmount)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 3. Columna Mercado Pago */}
          <div style={{
            background: "#f8fbff",
            borderRadius: 16,
            border: `1.5px solid ${C.mpMid}`,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden"
          }}>
            {/* Header columna */}
            <div style={{
              background: C.mpPale,
              padding: "10px 14px",
              borderBottom: `1px solid ${C.mpMid}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <div>
                <div style={{ fontSize: 9, letterSpacing: "1.5px", color: C.mp, textTransform: "uppercase", fontWeight: "bold" }}>
                  📱 Mercado Pago
                </div>
                <div style={{ fontSize: 9, color: C.textSoft, marginTop: 1 }}>
                  {mpAppts.length} cobro{mpAppts.length !== 1 ? "s" : ""}
                </div>
              </div>
              <div className={privacyMode ? "privacy-blur" : ""} style={{ fontSize: 16, fontWeight: "bold", color: C.mp, fontVariantNumeric: "tabular-nums" }}>
                <AnimatedNumber value={mpTotal} formatFn={fmt} />
              </div>
            </div>

            {/* Lista scrolleable */}
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px", maxHeight: 440, display: "flex", flexDirection: "column", gap: 6 }}>
              {mpAppts.length === 0 ? (
                <div style={{ fontSize: 11, color: C.textSoft, textAlign: "center", padding: "24px 0", fontStyle: "italic" }}>
                  Sin cobros en Mercado Pago
                </div>
              ) : (
                mpAppts.map((a, i) => (
                  <div
                    key={a.id || i}
                    onClick={() => {
                      onNavigateToTurno?.({
                        date: currentDate,
                        hour: a.hour,
                        profId: a.profId,
                        rama: a.profRama || "manos",
                        openEdit: false
                      })
                      onClose()
                    }}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "7px 9px",
                      borderRadius: 9,
                      background: C.white,
                      border: `1px solid ${C.border}`,
                      cursor: "pointer",
                      transition: "all .12s"
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = C.mpMid}
                    onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
                    title="Clic para ver turno en planilla"
                  >
                    <div style={{ flex: 1, minWidth: 0, paddingRight: 6 }}>
                      <div style={{ fontSize: 11, fontWeight: "bold", color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {a.client}
                      </div>
                      <div style={{ fontSize: 9, color: C.textSoft }}>
                        {a.hour} hs · {(a.services || []).map(s => s.name).join(", ")}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: "bold", color: C.mp, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                      {fmt(a.methodAmount)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 4. Columna Turnos Adeudados */}
          <div style={{
            background: "#fff9f9",
            borderRadius: 16,
            border: "1.5px solid #fca5a5",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden"
          }}>
            {/* Header columna */}
            <div style={{
              background: "linear-gradient(135deg, #fff1f2, #ffe4e6)",
              padding: "10px 14px",
              borderBottom: "1px solid #fecdd3",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <div>
                <div style={{ fontSize: 9, letterSpacing: "1.5px", color: "#b91c1c", textTransform: "uppercase", fontWeight: "bold" }}>
                  ⚠️ Deudas Anteriores
                </div>
                <div style={{ fontSize: 9, color: "#991b1b", marginTop: 1 }}>
                  {unpaidAppts.length} turno{unpaidAppts.length !== 1 ? "s" : ""}
                </div>
              </div>
              <div className={privacyMode ? "privacy-blur" : ""} style={{ fontSize: 16, fontWeight: "bold", color: "#b91c1c", fontVariantNumeric: "tabular-nums" }}>
                <AnimatedNumber value={totalUnpaidMoney} formatFn={fmt} />
              </div>
            </div>

            {/* Lista scrolleable */}
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px", maxHeight: 440, display: "flex", flexDirection: "column", gap: 6 }}>
              {unpaidAppts.length === 0 ? (
                <div style={{ fontSize: 11, color: "#15803d", textAlign: "center", padding: "32px 12px", display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 24 }}>🎉</span>
                  <span style={{ fontWeight: "bold" }}>¡Al día! Sin deudas pendientes</span>
                  <span style={{ fontSize: 9.5, color: C.textSoft, fontWeight: "normal" }}>
                    Todas las clientas de días anteriores están cobradas.
                  </span>
                </div>
              ) : (
                unpaidAppts.map((item) => {
                  const dateDisplay = fmtShort(item.date)
                  const serviceNames = (item.services || []).map(s => s.name).join(", ") || "Turno"

                  const handleWhatsAppClick = (e) => {
                    e.stopPropagation()
                    if (!item.clientPhone) return
                    const message = `¡Hola ${cleanClientName(item.client)}! 🌿 Te escribimos de Verde Naranja por tu turno del día ${fmtDate(item.date)} (${serviceNames}). Te dejamos este recordatorio porque quedó pendiente el saldo de ${fmt(item.totalAmount)}. ¡Muchas gracias!`
                    openWhatsAppLink(formatWaNumber(item.clientPhone), message)
                  }

                  return (
                    <div
                      key={item.key || item.id}
                      onClick={() => {
                        onNavigateToTurno?.({
                          date: item.date,
                          hour: item.hour,
                          profId: item.profId,
                          rama: item.profRama || "manos",
                          openEdit: false
                        })
                        onClose()
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 10px",
                        borderRadius: 10,
                        background: C.white,
                        border: "1px solid #fed7aa",
                        cursor: "pointer",
                        transition: "all .12s",
                        gap: 8
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = "#fffaf0"
                        e.currentTarget.style.borderColor = "#fdba74"
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = C.white
                        e.currentTarget.style.borderColor = "#fed7aa"
                      }}
                      title="Clic para ver turno en planilla"
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
                          <span style={{ fontSize: 8.5, fontWeight: "bold", color: "#c2410c", background: "#ffedd5", padding: "1px 5px", borderRadius: 4 }}>
                            📅 {dateDisplay} · {item.hour} hs
                          </span>
                          <span style={{ fontSize: 8.5, color: C.textSoft }}>
                            ({item.profName})
                          </span>
                        </div>
                        <div style={{ fontSize: 11, fontWeight: "bold", color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.client}
                        </div>
                        <div style={{ fontSize: 8.5, color: C.textSoft, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {serviceNames}
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 12, fontWeight: "800", color: "#b91c1c", fontVariantNumeric: "tabular-nums" }}>
                            {fmt(item.totalAmount)}
                          </div>
                          <div style={{ fontSize: 7.5, color: "#ea580c" }}>
                            Sin cobrar
                          </div>
                        </div>
                        {item.clientPhone ? (
                          <button
                            type="button"
                            onClick={handleWhatsAppClick}
                            title={`Enviar recordatorio por WhatsApp a ${item.client}`}
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: "50%",
                              background: "#25d366",
                              border: "none",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "#fff",
                              fontSize: 13,
                              boxShadow: "0 2px 6px rgba(37, 211, 102, 0.35)",
                              transition: "transform 0.15s ease"
                            }}
                            onMouseEnter={e => e.currentTarget.style.transform = "scale(1.1)"}
                            onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
                          >
                            💬
                          </button>
                        ) : null}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </Overlay>
  )
}
