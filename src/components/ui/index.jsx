import { useState, useEffect } from "react"
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

export function Field({ label, children, style }) {
  return (
    <div style={{ marginBottom: 13, ...style }}>
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

export function AnimatedNumber({ value, formatFn = (x) => x, duration = 1500 }) {
  const [displayValue, setDisplayValue] = useState(value)

  useEffect(() => {
    // Si la diferencia es muy pequeña, no animamos para ahorrar recursos
    if (Math.abs(value - displayValue) < 0.5) {
      setDisplayValue(value)
      return
    }

    let startValue = displayValue
    let startTime = null

    // Easing: starts slow, accelerates, and slows down at the end (easeInOutCubic)
    const easeInOutCubic = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp
      const progress = timestamp - startTime
      const t = Math.min(progress / duration, 1)
      
      const easedT = easeInOutCubic(t)
      const currentVal = startValue + (value - startValue) * easedT
      
      setDisplayValue(currentVal)

      if (t < 1) {
        requestAnimationFrame(animate)
      } else {
        setDisplayValue(value)
      }
    }

    const frameId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameId)
  }, [value, duration]) // eslint-disable-line react-hooks/exhaustive-deps

  return <>{formatFn(displayValue)}</>
}
