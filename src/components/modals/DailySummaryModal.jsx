import React, { useMemo } from "react"
import { C } from "../../constants/colors.js"
import { fmt } from "../../utils/appointments.js"
import { fmtDate } from "../../utils/dates.js"
import { Overlay, AnimatedNumber } from "../ui/index.jsx"
import { useIsMobile } from "../../hooks/useIsMobile.js"

export function DailySummaryModal({
  isOpen,
  onClose,
  currentDate,
  totalByMethod,
  grandTotal,
  scheduledStats,
  getApptsByMethod,
  onNavigateToTurno,
  privacyMode = false
}) {
  const isMobile = useIsMobile()

  // Cobros por método (declarados incondicionalmente para respetar las reglas de hooks de React)
  const cashAppts = useMemo(() => (isOpen && getApptsByMethod ? getApptsByMethod("efectivo") : []) || [], [isOpen, getApptsByMethod])
  const debitAppts = useMemo(() => (isOpen && getApptsByMethod ? getApptsByMethod("debito") : []) || [], [isOpen, getApptsByMethod])
  const mpAppts = useMemo(() => (isOpen && getApptsByMethod ? getApptsByMethod("mercadopago") : []) || [], [isOpen, getApptsByMethod])

  const cashTotal = useMemo(() => (isOpen && totalByMethod ? totalByMethod("efectivo") : 0) || 0, [isOpen, totalByMethod])
  const debitTotal = useMemo(() => (isOpen && totalByMethod ? totalByMethod("debito") : 0) || 0, [isOpen, totalByMethod])
  const mpTotal = useMemo(() => (isOpen && totalByMethod ? totalByMethod("mercadopago") : 0) || 0, [isOpen, totalByMethod])

  if (!isOpen) return null

  return (
    <Overlay onClose={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: C.white,
          borderRadius: isMobile ? 18 : 22,
          padding: isMobile ? "14px 12px 18px" : "20px 24px 22px",
          width: isMobile ? "calc(100vw - 16px)" : "min(980px, calc(100vw - 28px))",
          maxHeight: isMobile ? "94vh" : "92vh",
          display: "flex",
          flexDirection: "column",
          gap: isMobile ? 10 : 14,
          boxShadow: "0 24px 80px rgba(20,60,30,.24)",
          border: `1.5px solid ${C.greenMint}`,
          position: "relative",
          overflowY: "auto",
          animation: "scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)"
        }}
      >
        {/* Botón Cerrar Absoluto en esquina superior derecha */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: "absolute",
            top: isMobile ? 10 : 14,
            right: isMobile ? 10 : 14,
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "#f4f4f4",
            border: "none",
            cursor: "pointer",
            color: C.textSoft,
            fontSize: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all .15s",
            zIndex: 30
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "#e8e8e8"; e.currentTarget.style.color = C.text }}
          onMouseLeave={e => { e.currentTarget.style.background = "#f4f4f4"; e.currentTarget.style.color = C.textSoft }}
          title="Cerrar ventana (Esc)"
        >
          ✕
        </button>

        {/* Cabecera Principal */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, paddingRight: isMobile ? 36 : 42 }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: "2px", color: C.orange, textTransform: "uppercase", fontWeight: "bold", marginBottom: 2 }}>
              📊 Control Diario de Cobros · Verde Naranja
            </div>
            <div style={{ fontSize: isMobile ? 18 : 20, fontWeight: "800", color: C.text, fontFamily: "Georgia, serif", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span>Resumen del Día</span>
              <span style={{ fontSize: 12, fontWeight: "normal", color: C.textSoft, fontFamily: "sans-serif" }}>
                · {fmtDate(currentDate)}
              </span>
            </div>
          </div>

          {/* Tarjetas resumen superior */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {/* Total General */}
            <div style={{
              background: `linear-gradient(135deg, ${C.green}, ${C.greenLight})`,
              color: "#ffffff",
              padding: "6px 12px",
              borderRadius: 12,
              textAlign: "right",
              boxShadow: "0 4px 14px rgba(43,122,58,0.22)"
            }}>
              <div style={{ fontSize: 7.5, letterSpacing: "1px", textTransform: "uppercase", opacity: 0.85, fontWeight: "bold" }}>
                Total Recaudado
              </div>
              <div className={privacyMode ? "privacy-blur" : ""} style={{ fontSize: isMobile ? 16 : 18, fontWeight: "bold", fontVariantNumeric: "tabular-nums" }}>
                <AnimatedNumber value={grandTotal} formatFn={fmt} />
              </div>
            </div>

            {/* Progreso del día */}
            <div style={{
              background: scheduledStats?.isFullyPaid ? "#f0fdf4" : C.cream,
              border: `1.5px solid ${scheduledStats?.isFullyPaid ? C.greenMint : C.border}`,
              padding: "6px 10px",
              borderRadius: 12,
              textAlign: "left"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: "800", color: scheduledStats?.isFullyPaid ? C.green : C.text, fontVariantNumeric: "tabular-nums" }}>
                  {scheduledStats?.pctCount || 0}%
                </span>
                {scheduledStats?.isFullyPaid && (
                  <span style={{ fontSize: 7.5, color: "#ffffff", background: C.green, fontWeight: "bold", padding: "1px 4px", borderRadius: 4 }}>
                    COMPLETO
                  </span>
                )}
              </div>
              <div style={{ fontSize: 8.5, color: C.textSoft }}>
                {scheduledStats?.paidCount || 0} de {scheduledStats?.totalCount || 0} cobrados
              </div>
            </div>
          </div>
        </div>

        {/* Separador sutil */}
        <div style={{ height: 1.5, background: `linear-gradient(90deg, ${C.greenMint}, ${C.border}, transparent)`, borderRadius: 2 }} />

        {/* 3 Columnas: Efectivo, Débito, Mercado Pago */}
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(280px, 1fr))",
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
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px", maxHeight: isMobile ? 260 : 440, display: "flex", flexDirection: "column", gap: 6 }}>
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
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px", maxHeight: isMobile ? 260 : 440, display: "flex", flexDirection: "column", gap: 6 }}>
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
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px", maxHeight: isMobile ? 260 : 440, display: "flex", flexDirection: "column", gap: 6 }}>
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

        </div>
      </div>
    </Overlay>
  )
}

