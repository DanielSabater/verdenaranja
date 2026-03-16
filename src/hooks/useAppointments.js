import { useState, useRef, useCallback } from "react"
import { HOURS } from "../constants/data.js"
import { cellKey, apptDur } from "../utils/appointments.js"

const CELL_H = 50 // px per 30-min slot

export function useAppointments(appointments, setAppointments) {
  // ── Drag ─────────────────────────────────────────────────────────────────
  const [draggingKey, setDraggingKey] = useState(null)
  const [dropTarget,  setDropTarget]  = useState(null)
  const [dropValid,   setDropValid]   = useState(false)
  const dragNode = useRef(null)

  // ── Resize ───────────────────────────────────────────────────────────────
  const resizeRef = useRef(null)
  const [resizePreview, setResizePreview] = useState(null)

  // ── Helpers ──────────────────────────────────────────────────────────────
  const isOccupied = useCallback((profId, hour, ignoreKey = null) => {
    if (appointments[cellKey(profId, hour)] && cellKey(profId, hour) !== ignoreKey) return true
    for (const [k, a] of Object.entries(appointments)) {
      if (k === ignoreKey) continue
      const [pid, h] = k.split("||")
      if (parseInt(pid) !== profId) continue
      const idx   = HOURS.indexOf(h)
      const slots = a.manualSlots ?? Math.ceil(apptDur(a) / 30)
      for (let s = 1; s < slots; s++) if (HOURS[idx + s] === hour) return true
    }
    return false
  }, [appointments])

  const canDrop = useCallback((dragKey, targetProfId, targetHour) => {
    const a = appointments[dragKey]
    if (!a) return false
    const slots = a.manualSlots ?? Math.ceil(apptDur(a) / 30)
    const idx   = HOURS.indexOf(targetHour)
    if (idx < 0 || idx + slots > HOURS.length) return false
    for (let s = 0; s < slots; s++) {
      if (isOccupied(targetProfId, HOURS[idx + s], dragKey)) return false
    }
    return true
  }, [appointments, isOccupied])

  const spanOf = (profId, hour) => {
    const k = cellKey(profId, hour)
    const a = appointments[k]
    if (!a) return null
    if (resizePreview?.key === k) return resizePreview.slots
    return a.manualSlots ?? Math.max(1, Math.ceil(apptDur(a) / 30))
  }

  // ── Drag handlers ────────────────────────────────────────────────────────
  const onDragStart = (e, key) => {
    setDraggingKey(key)
    dragNode.current = key
    e.dataTransfer.effectAllowed = "move"
    e.dataTransfer.setData("text/plain", key)
  }

  const onDragEnd = () => {
    setDraggingKey(null)
    setDropTarget(null)
    setDropValid(false)
    dragNode.current = null
  }

  const onDragOver = (e, profId, hour) => {
    e.preventDefault()
    const key = dragNode.current
    if (!key) return
    const valid = canDrop(key, profId, hour)
    setDropTarget({ profId, hour })
    setDropValid(valid)
    e.dataTransfer.dropEffect = valid ? "move" : "none"
  }

  const onDragLeave = () => { setDropTarget(null); setDropValid(false) }

  const onDrop = (e, targetProfId, targetHour) => {
    e.preventDefault()
    const key = dragNode.current
    if (!key || !canDrop(key, targetProfId, targetHour)) return
    setAppointments(prev => {
      const appt  = prev[key]
      const next  = { ...prev }
      delete next[key]
      next[cellKey(targetProfId, targetHour)] = { ...appt, profId: targetProfId, hour: targetHour }
      return next
    })
    onDragEnd()
  }

  // ── Resize handlers ──────────────────────────────────────────────────────
  const onResizeStart = (e, key, edge) => {
    e.stopPropagation()
    e.preventDefault()
    const appt       = appointments[key]
    const origHourIdx = HOURS.indexOf(appt.hour)
    const origSlots   = appt.manualSlots ?? Math.max(1, Math.ceil(apptDur(appt) / 30))
    resizeRef.current = { key, edge, startY: e.clientY, origHourIdx, origSlots, profId: appt.profId }

    const onMove = (ev) => {
      const { edge, startY, origHourIdx, origSlots, profId } = resizeRef.current
      const dy        = ev.clientY - startY
      const slotDelta = Math.round(dy / CELL_H)
      let newHourIdx  = origHourIdx
      let newSlots    = origSlots

      if (edge === "bottom") {
        newSlots = Math.max(1, origSlots + slotDelta)
        if (origHourIdx + newSlots > HOURS.length) newSlots = HOURS.length - origHourIdx
      } else {
        newHourIdx = Math.max(0, Math.min(origHourIdx + slotDelta, origHourIdx + origSlots - 1))
        newSlots   = origSlots - (newHourIdx - origHourIdx)
      }
      setResizePreview({ key: resizeRef.current.key, hourIdx: newHourIdx, slots: newSlots })
    }

    const onUp = () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup",   onUp)
      if (!resizeRef.current) return
      const { key, profId } = resizeRef.current
      setResizePreview(prev => {
        if (!prev) return null
        const newHour  = HOURS[prev.hourIdx]
        const oldKey   = key
        const newKey   = cellKey(profId, newHour)
        setAppointments(p => {
          const appt    = p[oldKey]
          const updated = { ...appt, hour: newHour, manualSlots: prev.slots, manualDur: prev.slots * 30 }
          const next    = { ...p }
          if (oldKey !== newKey) delete next[oldKey]
          next[newKey] = updated
          return next
        })
        return null
      })
      resizeRef.current = null
    }

    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup",   onUp)
  }

  return {
    draggingKey, dropTarget, dropValid,
    resizePreview,
    isOccupied, canDrop, spanOf,
    onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop,
    onResizeStart,
    CELL_H,
  }
}
