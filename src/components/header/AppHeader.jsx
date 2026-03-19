import { memo } from "react"
import { C } from "../../constants/colors.js"
import { PAYMENT_METHODS } from "../../constants/data.js"
import { fmt } from "../../utils/appointments.js"

export const AppHeader = memo(function AppHeader({ config, activeView, setActiveView, saveStatus, totalByMethod, grandTotal, grandEarnings, onLogout }) {
  const isMobileNav = typeof window !== "undefined" && window.innerWidth <= 900
  const VIEWS = [
    { id: "turnos",       icon: "📅", label: "Turnos" },
    { id: "contabilidad", icon: "📊", label: "Contabilidad" },
    { id: "clientes",     icon: "👥", label: "Clientes" },
    { id: "config",       icon: "⚙️", label: "Config" },
  ]

  return (
    <>
      {/* ── HEADER ── */}
      <header style={{
        background: C.white, borderBottom: `2px solid ${C.greenMint}`,
        padding: "0 14px", display: "flex", alignItems: "center",
        justifyContent: "space-between",
        boxShadow: `0 2px 16px ${C.shadow}`,
        position: "sticky", top: 0, zIndex: 100,
        minHeight: 56, gap: 8,
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 9, flexShrink: 0 }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            background: `linear-gradient(135deg,${C.green},${C.greenLight})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, flexShrink: 0,
          }}>{config.empresaEmoji}</div>
          <div>
            <div style={{ fontSize: 7, letterSpacing: "3px", color: C.orange, textTransform: "uppercase" }}>
              {config.empresaSubtitulo}
            </div>
            <div style={{ fontSize: 15, color: C.green, letterSpacing: "1px" }}>
              {config.empresaNombre}
            </div>
          </div>
        </div>

        {/* Desktop nav */}
        <div style={{ display: isMobileNav ? "none" : "flex", gap: 4 }}>
          {VIEWS.map(v => (
            <button key={v.id} onClick={() => setActiveView(v.id)} style={{
              padding: "6px 14px", borderRadius: 20, cursor: "pointer",
              border: `2px solid ${activeView === v.id ? C.green : C.border}`,
              background: activeView === v.id ? `linear-gradient(135deg,${C.green},${C.greenLight})` : C.white,
              color: activeView === v.id ? "#fff" : C.textSoft,
              fontSize: 10, letterSpacing: "1px", textTransform: "uppercase",
              fontFamily: "Georgia,serif", transition: "all .18s",
            }}>{v.icon} {v.label}</button>
          ))}
        </div>

        {/* Desktop totals */}
        <div style={{ display: isMobileNav ? "none" : "flex", alignItems: "center", gap: 5 }}>
          {PAYMENT_METHODS.map(pm => {
            const t = totalByMethod(pm.id)
            return (
              <div key={pm.id} style={{
                background: t > 0 ? (pm.id === "mercadopago" ? C.mpPale : pm.id === "debito" ? C.amberPale : C.greenPale) : "#f7f7f7",
                border: `1px solid ${t > 0 ? (pm.id === "mercadopago" ? C.mpMid : pm.id === "debito" ? C.amberMid : C.greenMint) : "#e8e8e8"}`,
                borderRadius: 9, padding: "5px 9px", textAlign: "center",
              }}>
                <div style={{ fontSize: 8, color: t > 0 ? pm.color : "#bbb", textTransform: "uppercase" }}>{pm.icon} {pm.label}</div>
                <div style={{ fontSize: 12, fontWeight: "bold", color: t > 0 ? pm.color : "#ccc" }}>{fmt(t)}</div>
              </div>
            )
          })}
          <div style={{ background: grandTotal > 0 ? `linear-gradient(135deg,${C.green},${C.greenLight})` : "#f0f0f0", borderRadius: 10, padding: "6px 12px", textAlign: "center" }}>
            <div style={{ fontSize: 7, color: grandTotal > 0 ? "rgba(255,255,255,.7)" : "#bbb", textTransform: "uppercase" }}>Total</div>
            <div style={{ fontSize: 15, fontWeight: "bold", color: grandTotal > 0 ? C.white : "#ccc" }}>{fmt(grandTotal)}</div>
          </div>
          <div style={{ background: grandEarnings > 0 ? `linear-gradient(135deg,${C.gold},${C.goldLight})` : "#f0f0f0", borderRadius: 10, padding: "6px 12px", textAlign: "center" }}>
            <div style={{ fontSize: 7, color: grandEarnings > 0 ? "rgba(255,255,255,.75)" : "#bbb", textTransform: "uppercase" }}>{config.comisionPct}%</div>
            <div style={{ fontSize: 15, fontWeight: "bold", color: grandEarnings > 0 ? C.white : "#ccc" }}>{fmt(grandEarnings)}</div>
          </div>
        </div>

        {/* Save badge (desktop) */}
        {onLogout && (
          <button onClick={onLogout} style={{ padding:"4px 10px", borderRadius:16, border:`1px solid ${C.border}`, background:"transparent", color:C.textSoft, fontSize:9, cursor:"pointer", fontFamily:"Georgia,serif", flexShrink:0 }}>Salir</button>
        )}
        <div style={{ display: isMobileNav ? "none" : "flex",
          padding: "4px 10px", borderRadius: 16, minWidth: 90, textAlign: "center", flexShrink: 0,
          background: saveStatus === "saving" ? "#f5f5f5" : saveStatus === "saved" ? C.greenPale : saveStatus === "error" ? "#fde8e8" : "transparent",
          border: `1px solid ${saveStatus === "saving" ? "#ddd" : saveStatus === "saved" ? C.greenMint : saveStatus === "error" ? "#f4b0b0" : "transparent"}`,
          opacity: saveStatus === "idle" ? 0 : 1,
          transition: "opacity .3s ease",
        }}>
          <span style={{ fontSize: 9, color: saveStatus === "saved" ? C.green : saveStatus === "error" ? "#c04040" : "#aaa" }}>
            {saveStatus === "saving" ? "⏳ Guardando..." : saveStatus === "saved" ? "✓ Guardado" : saveStatus === "error" ? "⚠️ Error" : "✓ Guardado"}
          </span>
        </div>

        {/* Save dot (mobile) - always present, opacity toggle */}
        <div style={{
          width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
          background: saveStatus === "saving" ? "#ccc" : saveStatus === "saved" ? C.green : saveStatus === "error" ? "#c04040" : "transparent",
          opacity: saveStatus === "idle" ? 0 : 1,
          transition: "opacity .3s ease",
        }} />
      </header>

      {/* Mobile totals strip */}
      {activeView === "turnos" && (
        <div style={{
          display: isMobileNav && activeView === "turnos" ? "flex" : "none",
          background: C.white, borderBottom: `1px solid ${C.border}`,
          padding: "8px 12px", gap: 6, overflowX: "auto",
          WebkitOverflowScrolling: "touch", flexShrink: 0,
        }}>
          {PAYMENT_METHODS.map(pm => {
            const t = totalByMethod(pm.id)
            return t > 0 ? (
              <div key={pm.id} style={{
                background: pm.id === "mercadopago" ? C.mpPale : pm.id === "debito" ? C.amberPale : C.greenPale,
                border: `1px solid ${pm.id === "mercadopago" ? C.mpMid : pm.id === "debito" ? C.amberMid : C.greenMint}`,
                borderRadius: 9, padding: "5px 10px", textAlign: "center", flexShrink: 0,
              }}>
                <div style={{ fontSize: 8, color: pm.color }}>{pm.icon} {pm.label}</div>
                <div style={{ fontSize: 12, fontWeight: "bold", color: pm.color }}>{fmt(t)}</div>
              </div>
            ) : null
          })}
          {grandTotal > 0 && (
            <div style={{ background: `linear-gradient(135deg,${C.green},${C.greenLight})`, borderRadius: 9, padding: "5px 10px", textAlign: "center", flexShrink: 0 }}>
              <div style={{ fontSize: 8, color: "rgba(255,255,255,.8)" }}>Total</div>
              <div style={{ fontSize: 12, fontWeight: "bold", color: "#fff" }}>{fmt(grandTotal)}</div>
            </div>
          )}
          {grandEarnings > 0 && (
            <div style={{ background: `linear-gradient(135deg,${C.gold},${C.goldLight})`, borderRadius: 9, padding: "5px 10px", textAlign: "center", flexShrink: 0 }}>
              <div style={{ fontSize: 8, color: "rgba(255,255,255,.8)" }}>{config.comisionPct}%</div>
              <div style={{ fontSize: 12, fontWeight: "bold", color: "#fff" }}>{fmt(grandEarnings)}</div>
            </div>
          )}
        </div>
      )}

      {/* Bottom nav (mobile) */}
      <nav className="bottom-nav" style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 99999,
        justifyContent: "space-around", alignItems: "stretch",
        background: C.white, borderTop: `2px solid ${C.greenMint}`,
        height: 62, boxShadow: "0 -4px 20px rgba(58,125,68,.10)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}>
        {[
          { id: "turnos",       icon: "📅", label: "Turnos" },
          { id: "contabilidad", icon: "📊", label: "Contab." },
          { id: "clientes",     icon: "👥", label: "Clientes" },
          { id: "config",       icon: "⚙️", label: "Config" },
        ].map(v => (
          <button key={v.id} onClick={() => setActiveView(v.id)} style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 2, border: "none", background: "transparent", cursor: "pointer", padding: "6px 4px",
            color: activeView === v.id ? C.green : C.textSoft, position: "relative",
          }}>
            {activeView === v.id && (
              <div style={{ position: "absolute", top: 0, left: "20%", right: "20%", height: 3, borderRadius: "0 0 3px 3px", background: C.green }} />
            )}
            <div style={{ fontSize: 20 }}>{v.icon}</div>
            <div style={{ fontSize: 9, letterSpacing: "1px", textTransform: "uppercase", fontFamily: "Georgia,serif", fontWeight: activeView === v.id ? "bold" : "normal" }}>{v.label}</div>
          </button>
        ))}
      </nav>
    </>
  )
})
