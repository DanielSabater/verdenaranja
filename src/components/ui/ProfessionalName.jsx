import { useEffect, useId, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { C } from "../../constants/colors.js"

export default function ProfessionalName({ professional, style }) {
  const [position, setPosition] = useState(null)
  const timer = useRef(null)
  const nameRef = useRef(null)
  const id = useId()
  const notes = professional.notes?.trim()
  const hide = () => { clearTimeout(timer.current); setPosition(null) }
  useEffect(() => hide, [notes])
  useEffect(() => {
    window.addEventListener("scroll", hide, true)
    window.addEventListener("resize", hide)
    return () => {
      window.removeEventListener("scroll", hide, true)
      window.removeEventListener("resize", hide)
    }
  }, [])
  const show = event => {
    hide()
    if (!notes) return
    const rect = event.currentTarget.getBoundingClientRect()
    timer.current = setTimeout(() => setPosition({
      left: Math.max(8, Math.min(rect.left + rect.width / 2 - 140, window.innerWidth - 288)),
      top: rect.bottom + 8
    }), 1000)
  }
  useEffect(() => {
    const header = nameRef.current?.closest("th")
    if (!header || !notes) return
    header.addEventListener("mouseenter", show)
    header.addEventListener("mouseleave", hide)
    return () => {
      header.removeEventListener("mouseenter", show)
      header.removeEventListener("mouseleave", hide)
      hide()
    }
  }, [notes])
  return <>
    <span ref={nameRef} style={style} tabIndex={notes ? 0 : undefined} aria-describedby={position ? id : undefined}
      onFocus={show} onBlur={hide}
      onKeyDown={event => { if (event.key === "Escape") hide() }}>
      {professional.name}
    </span>
    {position && createPortal(<div id={id} role="tooltip" style={{
      position: "fixed", ...position, zIndex: 10000, boxSizing: "border-box", width: 280,
      maxWidth: "calc(100vw - 16px)", padding: "12px 14px", borderRadius: 10,
      background: C.cream, color: C.text, border: `1px dashed ${C.greenMint}`,
      boxShadow: "0 4px 16px rgba(0,0,0,.12)", fontFamily: "Georgia,serif",
      fontSize: 12, lineHeight: 1.5, whiteSpace: "pre-wrap", overflowWrap: "anywhere",
      maxHeight: "50vh", overflowY: "auto", pointerEvents: "none"
    }}>{notes}</div>, document.body)}
  </>
}
