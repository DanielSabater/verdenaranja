import { useEffect, useRef } from "react"
import { useIsMobile } from "./useIsMobile.js"

const KEY = "vnNavigation"
const layers = new Map()
let nextLayer = 0

function state() {
  return window.history.state?.[KEY]
}
function write(value, replace = false) {
  window.history[replace ? "replaceState" : "pushState"](
    { ...window.history.state, [KEY]: value }, ""
  )
}

// Browser Back (including Android's system gesture) restores the preceding view.
export function useMobileNavigation(view, setView, enabled) {
  const mobile = useIsMobile()
  const restore = useRef(setView)
  restore.current = setView
  useEffect(() => {
    if (!mobile || !enabled) return
    write({ view, layers: [] }, true)
    const onPop = () => {
      const target = state()
      if (!target) return
      const retained = new Set(target.layers || [])
      for (const [id, close] of [...layers].reverse()) {
        if (!retained.has(id)) {
          layers.delete(id)
          close()
        }
      }
      restore.current(target.view)
    }
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [mobile, enabled])

  useEffect(() => {
    if (!mobile || !enabled) return
    const current = state()
    if (current && current.view !== view) write({ view, layers: [] })
  }, [view, mobile, enabled])
}

// Register only while a modal is visible. The latest layer closes first.
export function useMobileBackLayer(open, onClose) {
  const mobile = useIsMobile()
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    if (!mobile || !open || !state()) return
    const id = ++nextLayer
    layers.set(id, () => close.current?.())
    write({ ...state(), layers: [...(state().layers || []), id] })
    return () => {
      if (!layers.delete(id)) return // Already consumed by browser Back.
      const current = state()
      if (current?.layers?.at(-1) === id) window.history.back()
      else if (current?.layers?.includes(id)) {
        write({ ...current, layers: current.layers.filter(value => value !== id) }, true)
      }
    }
  }, [open, mobile])
}
