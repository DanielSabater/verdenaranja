import { C } from '../../constants/colors.js'

export function Overlay({ children, onClose }) {
  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      className="modal-overlay"
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(20,40,24,.4)",
        display: "flex", alignItems: "center", justifyContent: "center",
        backdropFilter: "blur(5px)", animation: "fadeIn .18s ease",
      }}
    >
      {children}
    </div>
  )
}

export function ModalHeader({ emoji, sub, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 8, letterSpacing: "3px", color: C.orange, textTransform: "uppercase", marginBottom: 3 }}>
        {emoji} {sub}
      </div>
      <div style={{ fontSize: 16, color: C.text }}>{children}</div>
      <div style={{ height: 2, background: `linear-gradient(90deg,${C.green},${C.greenMint},transparent)`, marginTop: 8, borderRadius: 2 }} />
    </div>
  )
}

export function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 13 }}>
      <label style={{ fontSize: 8, letterSpacing: "2.5px", color: C.textSoft, textTransform: "uppercase", display: "block", marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

export function GhostBtn({ onClick, children }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: "10px 0", borderRadius: 11,
      border: `1.5px solid ${C.border}`, background: "transparent",
      color: C.textSoft, fontSize: 9, letterSpacing: "1.5px",
      textTransform: "uppercase", cursor: "pointer",
      fontFamily: "Georgia,serif", transition: "all .15s",
    }}>
      {children}
    </button>
  )
}

export function SolidBtn({ onClick, children, disabled = false, color = C.green }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      flex: 2, padding: "10px 0", borderRadius: 11, border: "none",
      background: disabled ? "#e8e8e8" : `linear-gradient(135deg,${color},${color}cc)`,
      color: disabled ? "#bbb" : C.white,
      fontSize: 9, letterSpacing: "1.5px", textTransform: "uppercase",
      cursor: disabled ? "not-allowed" : "pointer",
      fontFamily: "Georgia,serif",
      boxShadow: disabled ? "none" : `0 4px 14px ${color}40`,
      transition: "all .2s",
    }}>
      {children}
    </button>
  )
}

export const inputStyle = {
  width: "100%", padding: "10px 13px",
  border: `1.5px solid ${C.border}`,
  borderRadius: 9, fontSize: 13, color: C.text,
  background: C.cream, outline: "none",
  fontFamily: "Georgia,serif", transition: "border-color .2s",
}

export const modalBox = {
  background: C.white, borderRadius: 18,
  padding: "24px 24px 20px",
  width: "min(490px, calc(100vw - 24px))",
  maxHeight: "92vh", overflowY: "auto",
  boxShadow: "0 24px 80px rgba(20,60,30,.16)",
  border: `1px solid ${C.border}`,
}
