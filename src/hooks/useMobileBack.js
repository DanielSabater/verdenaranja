import { useEffect, useRef, useState } from "react"
import { useIsMobile } from "./useIsMobile.js"

const KEY = "vnNavigation"
const layers = new Map()
let nextLayer = 0

function state() {
  return window.history.state?.[KEY]
}
function write(value, replace = false) {
  window.history[replace ? "replaceState" : "pushState"](
    { ...window.history.state, [KEY]: { ...value, position: replace ? (value.position ?? state()?.position ?? 0) : (state()?.position ?? 0) + 1 } }, ""
  )
}

// Browser Back (including Android's system gesture) restores the preceding view.
export function useMobileNavigation(view, setView, enabled) {
  const mobile = useIsMobile()
  const [exitOpen, setExitOpen] = useState(false)
  const leaving = useRef(false)
  const exitVisible = useRef(false)
  const restore = useRef(setView)
  restore.current = setView
  useEffect(() => {
    if (!mobile || !enabled) return
    // One entry below the app catches Back from its initial screen.
    if (!state() || !Number.isInteger(state().position)) {
      write({ view, layers: [], exitBoundary: true, position: 0 }, true)
      write({ view, layers: [] })
    } else if (state().exitBoundary) {
      write({ view, layers: [] })
    } else {
      write({ ...state(), view, layers: [] }, true)
    }
    const onPop = () => {
      if (leaving.current) return
      const target = state()
      if (!target) return
      if (target.exitBoundary) {
        write({ view: target.view, layers: [] })
        restore.current(target.view)
        exitVisible.current = !exitVisible.current
        setExitOpen(exitVisible.current)
        return
      }
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

  const confirmExit = () => {
    leaving.current = true
    // Skip app entries and return to the document before the app.
    window.history.go(-((state()?.position ?? 1) + 1))
  }
  return { exitOpen, cancelExit: () => { exitVisible.current = false; setExitOpen(false) }, confirmExit }
}

// Register only while a modal is visible. The latest layer closes first.
export function useMobileBackLayer(open, onClose) {
  const mobile = useIsMobile()
  const close = useRef(onClose)
  close.current = onClose
  const registration = useRef(null)
  useEffect(() => {
    if (!mobile || !open || !state()) return
    // StrictMode replays setup/cleanup without actually closing the modal.
    // Reuse its entry and defer disposal until that replay has finished.
    let entry = registration.current
    if (!entry || !layers.has(entry.id)) {
      entry = { id: ++nextLayer, cleanupToken: null }
      registration.current = entry
      layers.set(entry.id, () => close.current?.())
      write({ ...state(), layers: [...(state().layers || []), entry.id] })
    }
    entry.cleanupToken = null
    return () => {
      const token = Symbol()
      entry.cleanupToken = token
      queueMicrotask(() => {
        if (entry.cleanupToken !== token || !layers.delete(entry.id)) return
        const current = state()
        if (current?.layers?.at(-1) === entry.id) window.history.back()
        else if (current?.layers?.includes(entry.id)) {
          write({ ...current, layers: current.layers.filter(value => value !== entry.id) }, true)
        }
      })
    }
  }, [open, mobile])
}
