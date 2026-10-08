import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { createPortal } from "react-dom"
import { C } from "../../constants/colors.js"
import { formatRelativeTime } from "../../utils/history.js"
import { useIsMobile } from "../../hooks/useIsMobile.js"

// Cantidad de renglones fijos por cada hoja (ocupa todo el alto de la página sin dejar huecos)
const LINES_PER_PAGE = 17
const ROW_HEIGHT = 34

// Función sintetizadora de sonido físico de papel pasando de hoja (Web Audio API)
export function playPageSound() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    const bufferSize = Math.floor(ctx.sampleRate * 0.38)
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1
    }
    const noiseNode = ctx.createBufferSource()
    noiseNode.buffer = buffer

    const filter = ctx.createBiquadFilter()
    filter.type = "bandpass"
    filter.frequency.setValueAtTime(1050, ctx.currentTime)
    filter.frequency.exponentialRampToValueAtTime(1650, ctx.currentTime + 0.12)
    filter.frequency.exponentialRampToValueAtTime(850, ctx.currentTime + 0.38)
    filter.Q.setValueAtTime(3.2, ctx.currentTime)

    const gainNode = ctx.createGain()
    gainNode.gain.setValueAtTime(0.001, ctx.currentTime)
    gainNode.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.06)
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.38)

    noiseNode.connect(filter)
    filter.connect(gainNode)
    gainNode.connect(ctx.destination)
    noiseNode.start()
  } catch {
    // Silencioso si el navegador bloquea audio
  }
}

export function NotebookModal({
  isOpen,
  onClose,
  todoTasks = [],
  setTodoTasks,
  todoHistory = [],
  setTodoHistory
}) {
  const isMobile = useIsMobile(850)

  // Búsqueda en historial y copiado
  const [historySearch, setHistorySearch] = useState("")
  const [copiedId, setCopiedId] = useState(null)
  const [toast, setToast] = useState(null) // { message, onUndo }

  // Animación de pase de página: "forward" | "backward" | null
  const [pageTurnAnim, setPageTurnAnim] = useState(null)

  // Cantidad de hojas de notas normales (mínimo 2 en escritorio, 1 en móvil)
  // El Historial es la página final ubicada después de todas las hojas de notas
  const [userNotePages, setUserNotePages] = useState(() => {
    let saved = 2
    try {
      const stored = localStorage.getItem("pv:notebook_user_note_pages")
      if (stored) saved = parseInt(stored, 10)
    } catch {}
    const maxInTasks = (todoTasks || []).reduce((max, t) => Math.max(max, (t.page || 0) + 1), 2)
    return Math.max(2, saved, maxInTasks)
  })

  // Títulos personalizados de hojas (ej: { 0: "Pendientes", 1: "Notas" })
  const [pageTitles, setPageTitles] = useState(() => {
    try {
      const stored = localStorage.getItem("pv:notebook_page_titles")
      if (stored) return JSON.parse(stored)
    } catch {}
    return {}
  })

  // Pies de página personalizados (ej: { 0: "Página 1", 1: "Página 2" })
  const [pageFooters, setPageFooters] = useState(() => {
    try {
      const stored = localStorage.getItem("pv:notebook_page_footers")
      if (stored) return JSON.parse(stored)
    } catch {}
    return {}
  })

  // Página activa en escritorio (índice par: 0, 2, 4...)
  const [currentDesktopPage, setCurrentDesktopPage] = useState(0)

  // Página activa en móvil (0, 1, 2...)
  const [currentMobilePage, setCurrentMobilePage] = useState(0)

  // Refs a inputs de cada renglón: key = `${pageIndex}-${lineIndex}`
  const inputRefs = useRef({})

  // Guardar páginas, títulos y pies en localStorage
  useEffect(() => {
    try {
      localStorage.setItem("pv:notebook_user_note_pages", userNotePages.toString())
    } catch {}
  }, [userNotePages])

  useEffect(() => {
    try {
      localStorage.setItem("pv:notebook_page_titles", JSON.stringify(pageTitles))
    } catch {}
  }, [pageTitles])

  useEffect(() => {
    try {
      localStorage.setItem("pv:notebook_page_footers", JSON.stringify(pageFooters))
    } catch {}
  }, [pageFooters])

  // Normalización retrocompatible de notas: asegurar que cada nota tenga page y line
  const normalizedTasks = useMemo(() => {
    return (todoTasks || []).map((t, idx) => {
      if (typeof t.page === "number" && typeof t.line === "number") {
        return t
      }
      return {
        ...t,
        page: Math.floor(idx / LINES_PER_PAGE),
        line: idx % LINES_PER_PAGE
      }
    })
  }, [todoTasks])

  // Mapa rápido de acceso O(1): `${page}-${line}` => task
  const tasksByPageAndLine = useMemo(() => {
    const map = {}
    normalizedTasks.forEach(task => {
      const key = `${task.page}-${task.line}`
      map[key] = task
    })
    return map
  }, [normalizedTasks])

  // Historial ordenado
  const safeHistory = useMemo(() => Array.isArray(todoHistory) ? todoHistory : [], [todoHistory])
  const filteredHistory = useMemo(() => {
    const q = historySearch.trim().toLowerCase()
    if (!q) return safeHistory
    return safeHistory.filter(h => (h.text || "").toLowerCase().includes(q))
  }, [safeHistory, historySearch])

  // ── Cálculo de apertura final donde se ubica la Hoja del Historial ──
  // En escritorio se muestran en pares [Izq | Der].
  // La última apertura es par (ej: 0, 2, 4...) donde la hoja derecha es el Historial.
  const desktopHistoryPairIndex = Math.floor(userNotePages / 2) * 2
  const isDesktopShowingHistory = !isMobile && currentDesktopPage === desktopHistoryPairIndex

  // En móvil: el Historial es la página final (índice = userNotePages)
  const mobileHistoryPageIndex = userNotePages
  const isMobileShowingHistory = isMobile && currentMobilePage === mobileHistoryPageIndex

  // ── Navegación entre Hojas ──

  const triggerPageAnim = useCallback((direction) => {
    playPageSound()
    setPageTurnAnim(direction)
    setTimeout(() => setPageTurnAnim(null), 360)
  }, [])

  const handlePrevPage = useCallback(() => {
    if (isMobile) {
      if (currentMobilePage > 0) {
        triggerPageAnim("backward")
        setCurrentMobilePage(prev => prev - 1)
      }
    } else {
      if (currentDesktopPage > 0) {
        triggerPageAnim("backward")
        setCurrentDesktopPage(prev => Math.max(0, prev - 2))
      }
    }
  }, [isMobile, currentMobilePage, currentDesktopPage, triggerPageAnim])

  const handleNextPage = useCallback(() => {
    if (isMobile) {
      if (currentMobilePage < mobileHistoryPageIndex) {
        triggerPageAnim("forward")
        setCurrentMobilePage(prev => prev + 1)
      }
    } else {
      if (currentDesktopPage < desktopHistoryPairIndex) {
        triggerPageAnim("forward")
        setCurrentDesktopPage(prev => prev + 2)
      }
    }
  }, [isMobile, currentMobilePage, mobileHistoryPageIndex, currentDesktopPage, desktopHistoryPairIndex, triggerPageAnim])

  // Acceso directo para saltar hasta la Hoja del Historial al final de todas las hojas
  const handleToggleHistoryShortcut = useCallback(() => {
    if (isMobile) {
      if (currentMobilePage === mobileHistoryPageIndex) {
        triggerPageAnim("backward")
        setCurrentMobilePage(0)
      } else {
        triggerPageAnim("forward")
        setCurrentMobilePage(mobileHistoryPageIndex)
      }
    } else {
      if (currentDesktopPage === desktopHistoryPairIndex) {
        triggerPageAnim("backward")
        setCurrentDesktopPage(0)
      } else {
        triggerPageAnim("forward")
        setCurrentDesktopPage(desktopHistoryPairIndex)
      }
    }
  }, [isMobile, currentMobilePage, mobileHistoryPageIndex, currentDesktopPage, desktopHistoryPairIndex, triggerPageAnim])

  const handleAddPage = useCallback(() => {
    triggerPageAnim("forward")
    if (isMobile) {
      const newPageIdx = userNotePages
      setUserNotePages(prev => prev + 1)
      setCurrentMobilePage(newPageIdx)
      setTimeout(() => {
        inputRefs.current[`${newPageIdx}-0`]?.focus()
      }, 90)
    } else {
      // En escritorio se agregan 2 hojas de notas y el Historial se desplaza al final
      const newPages = userNotePages + 2
      setUserNotePages(newPages)
      setCurrentDesktopPage(userNotePages)
      setTimeout(() => {
        inputRefs.current[`${userNotePages}-0`]?.focus()
      }, 90)
    }
  }, [isMobile, userNotePages, triggerPageAnim])

  // Función para eliminar hojas y reacomodar índices y notas
  const deletePages = useCallback((pagesToDelete) => {
    const sortedPages = [...new Set(pagesToDelete)].filter(p => typeof p === "number" && p >= 0).sort((a, b) => b - a)
    if (sortedPages.length === 0) return

    // Verificar si hay notas con texto en las hojas a eliminar
    const notesToArchive = normalizedTasks.filter(
      t => sortedPages.includes(t.page) && (t.text || "").trim()
    )

    const pageLabels = sortedPages
      .map(p => pageTitles[p] || `Hoja ${p + 1}`)
      .reverse()
      .join(" y ")

    const confirmMsg = notesToArchive.length > 0
      ? `¿Eliminar ${pageLabels}? Hay ${notesToArchive.length} nota(s) escrita(s) que se archivarán en el Historial.`
      : `¿Estás seguro de que querés eliminar la ${pageLabels}?`

    if (!window.confirm(confirmMsg)) {
      return
    }

    // 1. Archivar notas en el Historial
    if (notesToArchive.length > 0) {
      const archivedItems = notesToArchive.map(t => ({
        id: t.id || `hist-${Date.now()}-${Math.random()}`,
        text: t.text,
        completed: !!t.completed,
        page: t.page,
        deletedAt: new Date().toISOString()
      }))
      setTodoHistory(prev => [...archivedItems, ...(Array.isArray(prev) ? prev : [])])
    }

    // 2. Función auxiliar para calcular el nuevo índice de página tras eliminar sortedPages
    const shiftPageIndex = (p, delPages) => {
      const deletedBefore = delPages.filter(dp => dp < p).length
      return p - deletedBefore
    }

    // 3. Actualizar todoTasks
    setTodoTasks(prev => {
      return (prev || [])
        .filter(t => !sortedPages.includes(t.page))
        .map(t => {
          const newPage = shiftPageIndex(t.page, sortedPages)
          return newPage !== t.page ? { ...t, page: newPage } : t
        })
    })

    // 4. Actualizar títulos y pies de página
    const shiftMetaMap = (metaMap, delPages) => {
      const next = {}
      Object.entries(metaMap || {}).forEach(([k, v]) => {
        const p = parseInt(k, 10)
        if (!delPages.includes(p)) {
          const newP = shiftPageIndex(p, delPages)
          next[newP] = v
        }
      })
      return next
    }

    setPageTitles(prev => shiftMetaMap(prev, sortedPages))
    setPageFooters(prev => shiftMetaMap(prev, sortedPages))

    // 5. Decrementar userNotePages
    const countDeleted = sortedPages.length
    const nextUserNotePages = Math.max(1, userNotePages - countDeleted)
    setUserNotePages(nextUserNotePages)

    // 6. Sonido de pase de hoja
    playPageSound()

    // 7. Ajustar página activa
    if (isMobile) {
      setCurrentMobilePage(prev => {
        if (sortedPages.includes(prev)) {
          return Math.max(0, prev - 1)
        }
        return Math.min(prev, nextUserNotePages - 1)
      })
    } else {
      setCurrentDesktopPage(prev => {
        const maxSpread = Math.floor(nextUserNotePages / 2) * 2
        return Math.min(prev, maxSpread)
      })
    }

    const deletedLabel = sortedPages.length === 1
      ? (pageTitles[sortedPages[0]] || `Hoja ${sortedPages[0] + 1}`)
      : "Hojas"
    setToast({
      message: `${deletedLabel} eliminada${sortedPages.length > 1 ? "s" : ""}${notesToArchive.length > 0 ? " (notas archivadas en Historial)" : ""}`
    })
  }, [normalizedTasks, pageTitles, setTodoHistory, setTodoTasks, isMobile, userNotePages])

  // Atajos de teclado: Escape y Flechas Izquierda / Derecha para pasar de hoja
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault()
        e.stopPropagation()
        onClose?.()
        return
      }

      // Desplazamiento entre hojas con flechas izquierda y derecha del teclado
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        const activeEl = document.activeElement
        const isInput = activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")

        if (isInput) {
          const val = activeEl.value || ""
          const selStart = activeEl.selectionStart
          const selEnd = activeEl.selectionEnd

          // Solo navegar si está al extremo del texto o el renglón está vacío
          const canGoLeft = e.key === "ArrowLeft" && selStart === 0 && selEnd === 0
          const canGoRight = e.key === "ArrowRight" && selStart === val.length && selEnd === val.length

          if (!canGoLeft && !canGoRight) {
            // El usuario está moviendo el cursor dentro de la palabra escrita
            return
          }
        }

        e.preventDefault()
        e.stopPropagation() // Evita que se propague al cambio de días de la planilla

        if (e.key === "ArrowLeft") {
          handlePrevPage()
        } else if (e.key === "ArrowRight") {
          handleNextPage()
        }
      }
    }

    // Se registra en fase de captura (true) para interceptar antes que cualquier otro listener
    window.addEventListener("keydown", handleKeyDown, true)
    return () => window.removeEventListener("keydown", handleKeyDown, true)
  }, [isOpen, handlePrevPage, handleNextPage, onClose])

  // Temporizador para auto-descartar el toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5500)
      return () => clearTimeout(timer)
    }
  }, [toast])

  if (!isOpen) return null

  // ── Edición de Títulos y Pies de Hoja ──

  const handleTitleChange = (pageIdx, val) => {
    setPageTitles(prev => ({ ...prev, [pageIdx]: val }))
  }

  const handleFooterChange = (pageIdx, val) => {
    setPageFooters(prev => ({ ...prev, [pageIdx]: val }))
  }

  // ── Edición y Manejo de Renglones ──

  const handleLineChange = (page, line, newText) => {
    const key = `${page}-${line}`
    const existing = tasksByPageAndLine[key]

    if (!newText.trim()) {
      if (existing) {
        setTodoTasks(prev => (prev || []).filter(t => t.id !== existing.id))
      }
      return
    }

    if (existing) {
      setTodoTasks(prev => (prev || []).map(t => 
        t.id === existing.id ? { ...t, text: newText } : t
      ))
    } else {
      const newTask = {
        id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
        page,
        line,
        text: newText,
        completed: false,
        createdAt: Date.now()
      }
      setTodoTasks(prev => [...(prev || []), newTask])
    }
  }

  const handleToggleLineCompleted = (page, line) => {
    const key = `${page}-${line}`
    const existing = tasksByPageAndLine[key]
    if (!existing) return

    setTodoTasks(prev => (prev || []).map(t => 
      t.id === existing.id ? { ...t, completed: !t.completed } : t
    ))
  }

  const handleClearLine = (page, line) => {
    const key = `${page}-${line}`
    const existing = tasksByPageAndLine[key]
    if (!existing) return

    const historyEntry = {
      id: existing.id || Date.now().toString(),
      text: existing.text,
      deletedAt: Date.now(),
      completed: Boolean(existing.completed),
      page,
      line
    }

    if (setTodoHistory) {
      setTodoHistory(prev => [historyEntry, ...(prev || [])].slice(0, 150))
    }

    setTodoTasks(prev => (prev || []).filter(t => t.id !== existing.id))

    setToast({
      message: "Renglón borrado (archivado en el Historial)",
      onUndo: () => {
        setTodoTasks(prev => [...(prev || []), existing])
        if (setTodoHistory) {
          setTodoHistory(prev => (prev || []).filter(h => h.id !== historyEntry.id))
        }
        setToast(null)
      }
    })
  }

  const handleLineKeyDown = (e, page, line) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (line + 1 < LINES_PER_PAGE) {
        inputRefs.current[`${page}-${line + 1}`]?.focus()
      } else if (!isMobile && page === currentDesktopPage && !isDesktopShowingHistory) {
        inputRefs.current[`${page + 1}-0`]?.focus()
      }
    } else if (e.key === "ArrowDown") {
      if (line + 1 < LINES_PER_PAGE) {
        inputRefs.current[`${page}-${line + 1}`]?.focus()
      }
    } else if (e.key === "ArrowUp") {
      if (line - 1 >= 0) {
        inputRefs.current[`${page}-${line - 1}`]?.focus()
      }
    }
  }

  // ── Historial y Recuperación ──

  const handleRestoreTask = (item) => {
    // Si estamos en la apertura final, recupera a la hoja izquierda de notas compañera
    const targetPage = typeof item.page === "number" 
      ? item.page 
      : (isMobile ? (currentMobilePage === mobileHistoryPageIndex ? 0 : currentMobilePage) : currentDesktopPage)
    
    let targetLine = typeof item.line === "number" ? item.line : 0

    if (tasksByPageAndLine[`${targetPage}-${targetLine}`]) {
      let found = false
      for (let l = 0; l < LINES_PER_PAGE; l++) {
        if (!tasksByPageAndLine[`${targetPage}-${l}`]) {
          targetLine = l
          found = true
          break
        }
      }
      if (!found) targetLine = 0
    }

    const restored = {
      id: item.id || Date.now().toString(),
      page: targetPage,
      line: targetLine,
      text: item.text,
      completed: false,
      createdAt: Date.now()
    }

    setTodoTasks(prev => [...(prev || []), restored])
    if (setTodoHistory) {
      setTodoHistory(prev => (prev || []).filter(h => h.id !== item.id))
    }
    setToast({
      message: `✅ Nota recuperada en ${pageTitles[targetPage] || `Hoja ${targetPage + 1}`}`,
      onUndo: null
    })
  }

  const handlePermanentDelete = (id) => {
    if (setTodoHistory) {
      setTodoHistory(prev => (prev || []).filter(h => h.id !== id))
    }
  }

  const handleClearAllHistory = () => {
    if (window.confirm("¿Seguro que deseas vaciar el historial de notas borradas?")) {
      if (setTodoHistory) setTodoHistory([])
      setToast({ message: "Historial vaciado", onUndo: null })
    }
  }

  const handleCopyText = (text, id) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {})
    }
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1600)
  }

  // ── Renderizado de Renglones Interactivos ──
  // Circulito de realizada a la DERECHA del texto.
  // Cruz (✕) para borrar ubicada DENTRO DEL MARGEN ROJO (hacia los ganchitos) y visible ÚNICAMENTE en hover.

  const renderSheetLines = (pageIndex, isLeftPage = true) => {
    const leftPad = isLeftPage ? 22 : 54
    const rightPad = isLeftPage ? 54 : 22

    return Array.from({ length: LINES_PER_PAGE }).map((_, lineIndex) => {
      const key = `${pageIndex}-${lineIndex}`
      const task = tasksByPageAndLine[key]
      const text = task ? task.text : ""
      const isCompleted = task ? Boolean(task.completed) : false

      return (
        <div
          key={`line-${lineIndex}`}
          className="notebook-line-row"
          onClick={() => inputRefs.current[key]?.focus()}
          style={{
            flex: 1,
            minHeight: ROW_HEIGHT,
            display: "flex",
            alignItems: "flex-end", // Apoyo exacto sobre la raya del renglón
            borderBottom: "1.5px solid rgba(74, 144, 226, 0.18)",
            position: "relative",
            paddingLeft: leftPad,
            paddingRight: rightPad,
            paddingBottom: 2,
            boxSizing: "border-box",
            cursor: "text",
            transition: "background 0.12s ease"
          }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.015)"}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
        >
          {/* Input de texto manuscrito sobre el renglón */}
          <input
            ref={el => { inputRefs.current[key] = el }}
            type="text"
            value={text}
            onChange={(e) => handleLineChange(pageIndex, lineIndex, e.target.value)}
            onKeyDown={(e) => handleLineKeyDown(e, pageIndex, lineIndex)}
            placeholder={lineIndex === 0 && !text ? "Hacé clic en cualquier renglón para escribir..." : ""}
            autoComplete="off"
            spellCheck="false"
            style={{
              flex: 1,
              minWidth: 0,
              height: 26,
              lineHeight: "22px",
              border: "none",
              background: "transparent",
              outline: "none",
              fontSize: 14,
              fontFamily: "'Georgia', serif",
              fontStyle: "italic",
              color: isCompleted ? C.textSoft : C.text,
              textDecoration: isCompleted ? "line-through" : "none",
              opacity: isCompleted ? 0.6 : 1,
              padding: 0,
              margin: 0,
              boxSizing: "border-box"
            }}
          />

          {/* Circulito para marcar completada a la derecha inmediata del texto escrito */}
          {text ? (
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleToggleLineCompleted(pageIndex, lineIndex)
              }}
              title={isCompleted ? "Marcar como pendiente" : "Marcar como realizada"}
              style={{
                width: 17,
                height: 17,
                minHeight: "unset",
                borderRadius: "50%",
                border: `1.5px solid ${isCompleted ? C.green : "rgba(0,0,0,0.3)"}`,
                background: isCompleted ? C.greenPale : "transparent",
                color: C.green,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                fontSize: 11,
                padding: 0,
                fontWeight: "bold",
                outline: "none",
                marginBottom: 4,
                flexShrink: 0
              }}
            >
              {isCompleted && "✓"}
            </button>
          ) : null}

          {/* Cruz para eliminar nota: ubicada DENTRO DEL MARGEN (hacia los ganchitos) y SOLO visible en hover */}
          {text ? (
            <button
              className="notebook-line-delete-btn"
              onClick={(e) => {
                e.stopPropagation()
                handleClearLine(pageIndex, lineIndex)
              }}
              title="Eliminar renglón"
              style={{
                position: "absolute",
                [isLeftPage ? "right" : "left"]: 14,
                bottom: 5,
                background: "transparent",
                border: "none",
                color: C.red,
                cursor: "pointer",
                fontSize: 13,
                width: 20,
                height: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 10
              }}
            >
              ✕
            </button>
          ) : null}
        </div>
      )
    })
  }

  // ── Renderizado de la Hoja del Historial (Página Final de la Libreta) ──
  // Con márgenes perfectamente respetados (paddingLeft: 54px para respetar la línea roja de los ganchitos)
  const renderHistoryPageContent = () => {
    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        fontFamily: "'Georgia', serif",
        boxSizing: "border-box"
      }}>
        {/* Cabecera del Historial: paddingLeft 54px respeta estrictamente la línea roja */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          height: 38,
          borderBottom: "1.5px solid rgba(74, 144, 226, 0.15)",
          paddingLeft: 54,
          paddingRight: 18,
          boxSizing: "border-box"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <span style={{ fontSize: 10.5, letterSpacing: "1.5px", color: "#ea580c", textTransform: "uppercase", fontWeight: "bold" }}>
              🕒 Historial
            </span>
            {safeHistory.length > 0 && (
              <span style={{
                fontSize: 10,
                background: "rgba(234, 88, 12, 0.12)",
                color: "#ea580c",
                borderRadius: 10,
                padding: "1px 6px",
                fontWeight: "bold"
              }}>
                {safeHistory.length}
              </span>
            )}
          </div>

          {safeHistory.length > 0 && (
            <button 
              onClick={handleClearAllHistory}
              style={{
                background: "transparent",
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                padding: "2px 7px",
                fontSize: 9.5,
                color: C.red,
                opacity: 0.75,
                cursor: "pointer",
                fontFamily: "Georgia, serif"
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = 1}
              onMouseLeave={e => e.currentTarget.style.opacity = 0.75}
            >
              Vaciar
            </button>
          )}
        </div>

        {/* Buscador / Filtro: paddingLeft 54px respeta estrictamente la línea roja */}
        {safeHistory.length > 2 && (
          <div style={{
            display: "flex",
            alignItems: "center",
            height: 32,
            borderBottom: "1.5px solid rgba(74, 144, 226, 0.15)",
            paddingLeft: 54,
            paddingRight: 18,
            gap: 6,
            boxSizing: "border-box"
          }}>
            <span style={{ fontSize: 11, opacity: 0.6 }}>🔍</span>
            <input
              type="text"
              placeholder="Filtrar notas borradas..."
              value={historySearch}
              onChange={e => setHistorySearch(e.target.value)}
              style={{
                flex: 1,
                height: 22,
                fontSize: 11,
                fontFamily: "'Georgia', serif",
                fontStyle: "italic",
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                padding: "1px 8px",
                background: "rgba(255,255,255,0.75)",
                outline: "none",
                color: C.text
              }}
            />
          </div>
        )}

        {/* Lista de notas archivadas: cada fila respeta paddingLeft: 54px */}
        <div className="no-scrollbar" style={{ flex: 1, overflowY: "auto" }}>
          {filteredHistory.length === 0 ? (
            <div style={{
              padding: "40px 20px 20px 54px",
              color: C.textSoft,
              fontStyle: "italic",
              fontSize: 12.5,
              lineHeight: 1.6
            }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>✨</div>
              <div style={{ fontWeight: "bold", color: C.text, fontSize: 13, marginBottom: 4 }}>
                {safeHistory.length === 0 ? "Historial limpio" : "Sin coincidencias"}
              </div>
              <div>
                {safeHistory.length === 0
                  ? "Las notas que borres de cualquier hoja quedarán archivadas acá para recuperarlas con 1 clic."
                  : "No se encontraron notas archivadas que coincidan con la búsqueda."}
              </div>
            </div>
          ) : (
            filteredHistory.map(item => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  minHeight: 34,
                  borderBottom: "1.5px solid rgba(74, 144, 226, 0.15)",
                  paddingLeft: 54, // Respeta estrictamente la línea roja
                  paddingRight: 18,
                  gap: 8,
                  fontSize: 12.5,
                  boxSizing: "border-box"
                }}
              >
                <span style={{ fontSize: 11, color: C.textSoft, flexShrink: 0 }}>
                  {item.completed ? "✓" : "🕒"}
                </span>

                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                  <span style={{
                    fontStyle: "italic",
                    color: C.text,
                    textDecoration: item.completed ? "line-through" : "none",
                    opacity: item.completed ? 0.7 : 1,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis"
                  }}>
                    {item.text}
                  </span>
                  <span style={{ fontSize: 9.5, color: C.textSoft }}>
                    {formatRelativeTime(item.deletedAt)}
                    {typeof item.page === "number" && ` · ${pageTitles[item.page] || `Hoja ${item.page + 1}`}`}
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                  <button
                    onClick={() => handleRestoreTask(item)}
                    title="Recuperar nota a la hoja"
                    style={{
                      background: C.greenPale,
                      border: `1px solid ${C.green}55`,
                      color: C.green,
                      borderRadius: 6,
                      padding: "2px 6px",
                      fontSize: 9.5,
                      fontWeight: "bold",
                      cursor: "pointer",
                      fontFamily: "'Georgia', serif",
                      display: "flex",
                      alignItems: "center",
                      gap: 3
                    }}
                  >
                    <span>🔄</span> Recuperar
                  </button>

                  <button
                    onClick={() => handleCopyText(item.text, item.id)}
                    title="Copiar texto"
                    style={{
                      background: "rgba(255,255,255,0.7)",
                      border: `1px solid ${C.border}`,
                      color: C.textSoft,
                      borderRadius: 6,
                      padding: "2px 5px",
                      fontSize: 10,
                      cursor: "pointer"
                    }}
                  >
                    {copiedId === item.id ? "✓" : "📋"}
                  </button>

                  <button
                    onClick={() => handlePermanentDelete(item.id)}
                    title="Eliminar permanentemente"
                    style={{
                      background: "transparent",
                      border: "none",
                      color: C.red,
                      cursor: "pointer",
                      fontSize: 12,
                      padding: "2px 4px",
                      opacity: 0.45
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = 1}
                    onMouseLeave={e => e.currentTarget.style.opacity = 0.45}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pie de la Hoja del Historial: paddingLeft 54px respeta la línea roja */}
        <div style={{
          height: 30,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingLeft: 54,
          paddingRight: 18,
          borderTop: "1px solid rgba(74, 144, 226, 0.1)",
          boxSizing: "border-box",
          fontSize: 10.5,
          color: C.textSoft,
          fontStyle: "italic"
        }}>
          <span>☁️ Registro archivado</span>
          <button
            onClick={handleToggleHistoryShortcut}
            className="notebook-footer-link"
            style={{ fontSize: 10.5 }}
          >
            volver a las notas
          </button>
        </div>
      </div>
    )
  }

  // ── Toast Flotante ──

  const renderToastOverlay = (styleOverride = {}) => {
    if (!toast) return null
    return (
      <div style={{
        position: "absolute",
        bottom: 14,
        left: 54,
        right: 16,
        background: "rgba(20, 32, 22, 0.94)",
        backdropFilter: "blur(10px)",
        color: "#fff",
        borderRadius: 10,
        padding: "7px 12px",
        fontSize: 11,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        zIndex: 60,
        boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
        ...styleOverride
      }}>
        <span style={{ fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {toast.message}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {toast.onUndo && (
            <button
              onClick={() => {
                toast.onUndo()
                setToast(null)
              }}
              style={{
                background: "#38bdf8",
                color: "#0f172a",
                border: "none",
                borderRadius: 6,
                padding: "2px 8px",
                fontSize: 10.5,
                fontWeight: "bold",
                cursor: "pointer"
              }}
            >
              ↩️ Deshacer
            </button>
          )}
          <button
            onClick={() => setToast(null)}
            style={{
              background: "transparent",
              border: "none",
              color: "#fff",
              opacity: 0.7,
              cursor: "pointer",
              fontSize: 12,
              padding: "0 4px"
            }}
          >
            &times;
          </button>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VISTA MÓVIL (1 sola hoja, navegación, teclado y renglones interactivos)
  // ═══════════════════════════════════════════════════════════════════════════

  if (isMobile) {
    const mobileTotalPageCount = userNotePages + 1 // Notas + Hoja de Historial final
    const isFirstPage = currentMobilePage === 0
    const isLastPage = currentMobilePage === mobileHistoryPageIndex

    const ringsCountMobile = 18
    const mobileRings = Array.from({ length: ringsCountMobile }).map((_, i) => (
      <div key={`m-ring-${i}`} style={{
        width: 24,
        height: 10,
        borderRadius: 5,
        background: "linear-gradient(180deg, #dedede 0%, #b0b0b0 30%, #efefef 70%, #999999 100%)",
        border: "1px solid #888",
        boxShadow: "1px 2px 3px rgba(0,0,0,0.15)",
        flexShrink: 0,
        pointerEvents: "none"
      }} />
    ))

    const mobileContent = (
      <>
        {/* Click-catcher overlay transparente */}
        <div 
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 199,
            background: "transparent",
            cursor: "default"
          }}
        />

        <div className="notebook-popover">
          <style>{`
            .notebook-line-row .notebook-line-delete-btn {
              opacity: 0;
              pointer-events: none;
              transition: opacity 0.15s ease, transform 0.15s ease;
            }
            .notebook-line-row:hover .notebook-line-delete-btn {
              opacity: 0.6;
              pointer-events: auto;
            }
            .notebook-line-row .notebook-line-delete-btn:hover {
              opacity: 1;
              transform: scale(1.15);
            }

            .notebook-title-row .notebook-page-delete-btn {
              opacity: 0;
              pointer-events: none;
              transition: opacity 0.15s ease, transform 0.15s ease;
            }
            .notebook-title-row:hover .notebook-page-delete-btn {
              opacity: 0.65;
              pointer-events: auto;
            }
            .notebook-title-row .notebook-page-delete-btn:hover {
              opacity: 1;
              transform: scale(1.15);
            }

            .notebook-footer-row .notebook-footer-actions {
              opacity: 0;
              pointer-events: none;
              transition: opacity 0.2s ease;
            }
            .notebook-footer-row:hover .notebook-footer-actions {
              opacity: 0.85;
              pointer-events: auto;
            }
            .notebook-footer-link {
              background: transparent;
              border: none;
              padding: 0;
              margin: 0;
              font-family: 'Georgia', serif;
              font-style: italic;
              font-size: 11px;
              color: #718096;
              cursor: pointer;
              transition: color 0.15s ease, opacity 0.15s ease;
              text-decoration: none;
              line-height: 1;
            }
            .notebook-footer-link:hover {
              color: #1e293b;
              text-decoration: underline;
              opacity: 1;
            }
          `}</style>

          <div style={{ position: "relative", width: "100%", paddingLeft: 22, boxSizing: "border-box" }}>
            
            {/* Anillos laterales */}
            <div style={{
              position: "absolute",
              left: 10,
              top: 0,
              bottom: 0,
              width: 26,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: "16px 0",
              boxSizing: "border-box",
              overflow: "hidden",
              pointerEvents: "none",
              zIndex: 10
            }}>
              {mobileRings}
            </div>

            {/* Hoja única de la libreta con margen rojo vertical a la izquierda */}
            <div style={{
              position: "relative",
              background: "#fef6c5",
              backgroundImage: "linear-gradient(90deg, transparent 44px, #f4b0b0 44px, #f4b0b0 46px, transparent 46px)",
              backgroundSize: "100% 100%",
              borderRadius: "4px 16px 16px 4px",
              border: `1.5px solid ${C.border}`,
              borderLeft: "8px solid #c0d8c4",
              boxShadow: "0 20px 50px rgba(40,60,45,.25), 4px 4px 15px rgba(0,0,0,0.06)",
              minHeight: 480,
              maxHeight: "82vh",
              display: "flex",
              flexDirection: "column",
              fontFamily: "'Georgia', serif",
              boxSizing: "border-box",
              overflow: "hidden",
              transition: "transform 0.25s ease, filter 0.25s ease",
              transform: pageTurnAnim ? "scale(0.98)" : "scale(1)",
              filter: pageTurnAnim ? "brightness(0.94)" : "brightness(1)"
            }}>
              
              {/* Cabecera Móvil con título editable en naranja */}
              <div className="notebook-title-row" style={{
                display: "flex",
                flexDirection: "column",
                borderBottom: "1.5px solid rgba(74, 144, 226, 0.15)",
                paddingLeft: 46,
                paddingRight: 14,
                boxSizing: "border-box",
                position: "relative"
              }}>
                {/* Fila 1: Título editable naranja, tachito en margen y Cerrar */}
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  height: 32
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 11, color: isMobileShowingHistory ? "#ea580c" : C.orange }}>
                      {isMobileShowingHistory ? "🕒" : "📓"}
                    </span>
                    {isMobileShowingHistory ? (
                      <span style={{
                        color: "#ea580c",
                        fontSize: 10.5,
                        letterSpacing: "1.5px",
                        textTransform: "uppercase",
                        fontWeight: "bold",
                        fontFamily: "'Georgia', serif"
                      }}>
                        Historial
                      </span>
                    ) : (
                      <input
                        type="text"
                        value={pageTitles[currentMobilePage] !== undefined ? pageTitles[currentMobilePage] : `Hoja ${currentMobilePage + 1}`}
                        onChange={(e) => handleTitleChange(currentMobilePage, e.target.value)}
                        placeholder={`Hoja ${currentMobilePage + 1}`}
                        autoComplete="off"
                        spellCheck="false"
                        style={{
                          flex: 1,
                          border: "none",
                          background: "transparent",
                          outline: "none",
                          color: C.orange,
                          fontSize: 10.5,
                          letterSpacing: "1.5px",
                          textTransform: "uppercase",
                          fontWeight: "bold",
                          fontFamily: "'Georgia', serif",
                          padding: 0,
                          margin: 0
                        }}
                        title="Hacé clic para cambiar el título de esta hoja"
                      />
                    )}
                  </div>

                  {/* Tachito dentro del margen izquierdo */}
                  {!isMobileShowingHistory && userNotePages > 1 && (
                    <button
                      className="notebook-page-delete-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        deletePages([currentMobilePage])
                      }}
                      title={`Eliminar Hoja ${currentMobilePage + 1}`}
                      style={{
                        position: "absolute",
                        left: 14,
                        top: 6,
                        background: "transparent",
                        border: "none",
                        color: C.red,
                        fontSize: 12,
                        cursor: "pointer",
                        padding: 0,
                        width: 20,
                        height: 20,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 10
                      }}
                    >
                      🗑️
                    </button>
                  )}

                  <button
                    onClick={onClose}
                    style={{
                      background: "transparent",
                      border: "none",
                      fontSize: 20,
                      color: C.textSoft,
                      cursor: "pointer",
                      padding: 0
                    }}
                  >
                    &times;
                  </button>
                </div>

              </div>

              {/* Contenido: Renglones de la hoja actual O Hoja del Historial final */}
              <div className="no-scrollbar" style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto" }}>
                {isMobileShowingHistory ? (
                  renderHistoryPageContent()
                ) : (
                  renderSheetLines(currentMobilePage, false)
                )}
              </div>

              {/* Pie de página inferior editable con acciones discretas en gris */}
              {!isMobileShowingHistory && (
                <div 
                  className="notebook-footer-row"
                  style={{
                    height: 28,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingLeft: 46,
                    paddingRight: 14,
                    borderTop: "none",
                    boxSizing: "border-box"
                  }}
                >
                  {/* Acciones discretas al pie de la hoja que aparecen en hover */}
                  <div 
                    className="notebook-footer-actions"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 10.5,
                      fontFamily: "'Georgia', serif",
                      fontStyle: "italic",
                      userSelect: "none"
                    }}
                  >
                    <button onClick={handleAddPage} className="notebook-footer-link">
                      agregar hoja
                    </button>
                    {userNotePages > 1 && (
                      <>
                        <span style={{ color: "rgba(0,0,0,0.18)", fontStyle: "normal" }}>·</span>
                        <button onClick={() => deletePages([currentMobilePage])} className="notebook-footer-link">
                          eliminar hoja
                        </button>
                      </>
                    )}
                    <span style={{ color: "rgba(0,0,0,0.18)", fontStyle: "normal" }}>·</span>
                    <button onClick={handleToggleHistoryShortcut} className="notebook-footer-link">
                      historial
                    </button>
                  </div>

                  {/* Número de página con flechitas discretas para pasar hoja */}
                  <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    {!isFirstPage && (
                      <button
                        onClick={handlePrevPage}
                        title="Hoja anterior (←)"
                        style={{
                          background: "transparent",
                          border: "none",
                          color: C.textSoft,
                          cursor: "pointer",
                          fontSize: 12,
                          padding: "0 2px"
                        }}
                      >
                        ‹
                      </button>
                    )}
                    <input
                      type="text"
                      value={pageFooters[currentMobilePage] !== undefined ? pageFooters[currentMobilePage] : `Página ${currentMobilePage + 1}`}
                      onChange={(e) => handleFooterChange(currentMobilePage, e.target.value)}
                      placeholder={`Página ${currentMobilePage + 1}`}
                      autoComplete="off"
                      spellCheck="false"
                      style={{
                        border: "none",
                        background: "transparent",
                        outline: "none",
                        color: C.textSoft,
                        fontSize: 11,
                        fontStyle: "italic",
                        fontFamily: "'Georgia', serif",
                        padding: 0,
                        margin: 0,
                        textAlign: "right",
                        width: 65
                      }}
                      title="Hacé clic para editar el pie de página"
                    />
                    {!isLastPage && (
                      <button
                        onClick={handleNextPage}
                        title="Hoja siguiente (→)"
                        style={{
                          background: "transparent",
                          border: "none",
                          color: C.textSoft,
                          cursor: "pointer",
                          fontSize: 12,
                          padding: "0 2px"
                        }}
                      >
                        ›
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Toast flotante */}
              {renderToastOverlay()}

            </div>
          </div>
        </div>
      </>
    )

    return typeof document !== "undefined" ? createPortal(mobileContent, document.body) : mobileContent
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VISTA ESCRITORIO (Libreta abierta de dos hojas con márgenes hacia el centro,
  // Historial como página al final de todas las hojas, y acceso directo instantáneo)
  // ═══════════════════════════════════════════════════════════════════════════

  const leftPageIdx = currentDesktopPage
  const rightPageIdx = currentDesktopPage + 1
  const isFirstDesktopPair = leftPageIdx === 0
  const isLastDesktopPair = currentDesktopPage === desktopHistoryPairIndex

  // Generación de anillas metálicas en el lomo central (cubren todo el largo de la libreta)
  const DESKTOP_RINGS_COUNT = 20
  const desktopRings = Array.from({ length: DESKTOP_RINGS_COUNT }).map((_, i) => (
    <div 
      key={`d-ring-${i}`} 
      style={{ 
        position: "relative", 
        width: "100%", 
        height: 11, 
        flexShrink: 0, 
        pointerEvents: "none", 
        zIndex: 30 
      }}
    >
      {/* Orificio hoja izquierda (a la derecha de la hoja izquierda) */}
      <div style={{
        position: "absolute",
        left: -4,
        top: 0,
        width: 7,
        height: 11,
        borderRadius: 3,
        background: "#241d11",
        boxShadow: "inset 0 1px 2px rgba(0,0,0,0.7)",
        zIndex: 20
      }} />

      {/* Anillo metálico horizontal */}
      <div style={{
        position: "absolute",
        left: "50%",
        transform: "translateX(-50%)",
        top: 0,
        width: 36,
        height: 11,
        borderRadius: 5,
        background: "linear-gradient(180deg, #f8f8f8 0%, #b8b8b8 28%, #ffffff 65%, #7a7a7a 100%)",
        border: "1px solid #666",
        boxShadow: "0 2px 4px rgba(0,0,0,0.32), inset 0 1px 1px rgba(255,255,255,0.7)",
        zIndex: 25
      }} />

      {/* Orificio hoja derecha (a la izquierda de la hoja derecha) */}
      <div style={{
        position: "absolute",
        right: -4,
        top: 0,
        width: 7,
        height: 11,
        borderRadius: 3,
        background: "#241d11",
        boxShadow: "inset 0 1px 2px rgba(0,0,0,0.7)",
        zIndex: 20
      }} />
    </div>
  ))

  const desktopContent = (
    <div 
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
      className="modal-overlay"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "var(--modal-overlay-bg, rgba(20, 40, 24, 0.45))",
        backdropFilter: "var(--modal-overlay-blur, blur(6px))",
        WebkitBackdropFilter: "var(--modal-overlay-blur, blur(6px))",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 20px",
        boxSizing: "border-box",
        animation: "fadeIn .18s ease"
      }}
    >
      {/* Botón discreto flotante para cerrar en la esquina superior derecha del fondo */}
      <button
        onClick={onClose}
        title="Cerrar libreta (Esc)"
        style={{
          position: "absolute",
          top: 18,
          right: 22,
          background: "rgba(0, 0, 0, 0.28)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          borderRadius: "50%",
          width: 34,
          height: 34,
          color: "rgba(255, 255, 255, 0.85)",
          fontSize: 16,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.15s ease",
          zIndex: 100
        }}
        onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,0,0,0.55)"; e.currentTarget.style.color = "#fff" }}
        onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,0,0,0.28)"; e.currentTarget.style.color = "rgba(255,255,255,0.85)" }}
      >
        ✕
      </button>

      {/* Estilos CSS para el hover de eliminación y la animación 3D de doblado de hoja */}
      <style>{`
        .notebook-line-row .notebook-line-delete-btn {
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.15s ease, transform 0.15s ease;
        }
        .notebook-line-row:hover .notebook-line-delete-btn {
          opacity: 0.6;
          pointer-events: auto;
        }
        .notebook-line-row .notebook-line-delete-btn:hover {
          opacity: 1;
          transform: scale(1.15);
        }

        .notebook-title-row .notebook-page-delete-btn {
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.15s ease, transform 0.15s ease;
        }
        .notebook-title-row:hover .notebook-page-delete-btn {
          opacity: 0.65;
          pointer-events: auto;
        }
        .notebook-title-row .notebook-page-delete-btn:hover {
          opacity: 1;
          transform: scale(1.15);
        }

        .notebook-footer-row .notebook-footer-actions {
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s ease;
        }
        .notebook-footer-row:hover .notebook-footer-actions {
          opacity: 0.85;
          pointer-events: auto;
        }
        .notebook-footer-link {
          background: transparent;
          border: none;
          padding: 0;
          margin: 0;
          font-family: 'Georgia', serif;
          font-style: italic;
          font-size: 11px;
          color: #718096;
          cursor: pointer;
          transition: color 0.15s ease, opacity 0.15s ease;
          text-decoration: none;
          line-height: 1;
        }
        .notebook-footer-link:hover {
          color: #1e293b;
          text-decoration: underline;
          opacity: 1;
        }

        /* Animación suave de hoja que se dobla y pasa hacia adelante (la hoja derecha gira sobre el lomo) */
        @keyframes turnSheetForwardAnim {
          0% {
            transform: perspective(1400px) rotateY(0deg);
            filter: brightness(1);
            box-shadow: inset 16px 0 18px -10px rgba(0,0,0,0.14);
          }
          40% {
            transform: perspective(1400px) rotateY(-22deg) scale(0.985);
            filter: brightness(0.94);
            box-shadow: inset -25px 0 25px -8px rgba(0,0,0,0.22);
          }
          100% {
            transform: perspective(1400px) rotateY(0deg) scale(1);
            filter: brightness(1);
            box-shadow: inset 16px 0 18px -10px rgba(0,0,0,0.14);
          }
        }

        /* Animación suave de hoja que se dobla y pasa hacia atrás (la hoja izquierda gira sobre el lomo) */
        @keyframes turnSheetBackwardAnim {
          0% {
            transform: perspective(1400px) rotateY(0deg);
            filter: brightness(1);
            box-shadow: inset -16px 0 18px -10px rgba(0,0,0,0.14);
          }
          40% {
            transform: perspective(1400px) rotateY(22deg) scale(0.985);
            filter: brightness(0.94);
            box-shadow: inset 25px 0 25px -8px rgba(0,0,0,0.22);
          }
          100% {
            transform: perspective(1400px) rotateY(0deg) scale(1);
            filter: brightness(1);
            box-shadow: inset -16px 0 18px -10px rgba(0,0,0,0.14);
          }
        }

        @keyframes sheetContentFade {
          0% {
            opacity: 0.2;
          }
          100% {
            opacity: 1;
          }
        }
      `}</style>

      {/* Cuaderno Abierto de Dos Hojas (Solo el anotador de papel, sin marco de cuero ni barra superior) */}
      <div 
        style={{
          width: "min(1060px, 94vw)",
          height: "min(660px, 88vh)",
          maxHeight: "88vh",
          display: "flex",
          position: "relative",
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "0 28px 75px -12px rgba(0,0,0,0.45), 0 10px 25px -5px rgba(0,0,0,0.25)",
          boxSizing: "border-box",
          perspective: 1600,
          animation: "scaleUp 0.22s cubic-bezier(0.16, 1, 0.3, 1)"
        }}
      >
        {/* Flecha discreta flotante izquierda para pasar de hoja (←) */}
        {!isFirstDesktopPair && (
          <button
            onClick={handlePrevPage}
            title="Página anterior (←)"
            style={{
              position: "absolute",
              left: 6,
              top: "50%",
              transform: "translateY(-50%)",
              background: "rgba(0,0,0,0.06)",
              border: "none",
              borderRadius: "50%",
              width: 26,
              height: 26,
              fontSize: 16,
              color: "rgba(0,0,0,0.35)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 40,
              transition: "all .15s",
              opacity: 0.6
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.background = "rgba(0,0,0,0.14)" }}
            onMouseLeave={e => { e.currentTarget.style.opacity = "0.6"; e.currentTarget.style.background = "rgba(0,0,0,0.06)" }}
          >
            ‹
          </button>
        )}

        {/* Flecha discreta flotante derecha para pasar de hoja (→) */}
        {!isLastDesktopPair && (
          <button
            onClick={handleNextPage}
            title="Página siguiente (→)"
            style={{
              position: "absolute",
              right: 6,
              top: "50%",
              transform: "translateY(-50%)",
              background: "rgba(0,0,0,0.06)",
              border: "none",
              borderRadius: "50%",
              width: 26,
              height: 26,
              fontSize: 16,
              color: "rgba(0,0,0,0.35)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 40,
              transition: "all .15s",
              opacity: 0.6
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.background = "rgba(0,0,0,0.14)" }}
            onMouseLeave={e => { e.currentTarget.style.opacity = "0.6"; e.currentTarget.style.background = "rgba(0,0,0,0.06)" }}
          >
            ›
          </button>
        )}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* HOJA IZQUIERDA                                                */}
          {/* Margen rojo a la DERECHA (lado de los ganchitos centrales)   */}
          {/* ───────────────────────────────────────────────────────────── */}
          <div style={{
            flex: 1,
            background: "#fef6c5",
            backgroundImage: "linear-gradient(90deg, transparent calc(100% - 46px), #f4b0b0 calc(100% - 46px), #f4b0b0 calc(100% - 44px), transparent calc(100% - 44px))",
            backgroundSize: "100% 100%",
            borderTopLeftRadius: 8,
            borderBottomLeftRadius: 8,
            borderLeft: "6px solid #dcd4a4",
            boxShadow: "inset -16px 0 18px -10px rgba(0,0,0,0.14)",
            display: "flex",
            flexDirection: "column",
            fontFamily: "'Georgia', serif",
            overflow: "hidden",
            position: "relative",
            boxSizing: "border-box",
            transformOrigin: "right center",
            animation: pageTurnAnim === "backward" ? "turnSheetBackwardAnim 0.35s cubic-bezier(0.2, 0.8, 0.4, 1)" : "none"
          }}>
            {/* Encabezado Hoja Izquierda con título editable en naranja */}
            <div className="notebook-title-row" style={{
              display: "flex",
              alignItems: "center",
              height: 38,
              borderBottom: "1.5px solid rgba(74, 144, 226, 0.15)",
              paddingLeft: 22,
              paddingRight: 54, // Deja libre el margen rojo de la derecha
              boxSizing: "border-box",
              position: "relative"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 12, color: C.orange, userSelect: "none" }}>📓</span>
                <input
                  type="text"
                  value={pageTitles[leftPageIdx] !== undefined ? pageTitles[leftPageIdx] : `Hoja ${leftPageIdx + 1}`}
                  onChange={(e) => handleTitleChange(leftPageIdx, e.target.value)}
                  placeholder={`Hoja ${leftPageIdx + 1}`}
                  autoComplete="off"
                  spellCheck="false"
                  style={{
                    flex: 1,
                    border: "none",
                    background: "transparent",
                    outline: "none",
                    color: C.orange,
                    fontSize: 11,
                    letterSpacing: "1.5px",
                    textTransform: "uppercase",
                    fontWeight: "bold",
                    fontFamily: "'Georgia', serif",
                    padding: 0,
                    margin: 0,
                    cursor: "text"
                  }}
                  title="Hacé clic para cambiar el título de esta hoja"
                />
              </div>

              {/* Tachito dentro del margen derecho (hacia las anillas) */}
              {userNotePages > 1 && (
                <button
                  className="notebook-page-delete-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    deletePages([leftPageIdx])
                  }}
                  title={`Eliminar Hoja ${leftPageIdx + 1}`}
                  style={{
                    position: "absolute",
                    right: 14,
                    top: 8,
                    background: "transparent",
                    border: "none",
                    color: C.red,
                    fontSize: 12.5,
                    cursor: "pointer",
                    padding: 0,
                    width: 20,
                    height: 20,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 10
                  }}
                >
                  🗑️
                </button>
              )}
            </div>

            {/* Renglones interactivos Hoja Izquierda */}
            <div 
              className="no-scrollbar" 
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                overflowY: "auto",
                animation: pageTurnAnim === "backward" ? "sheetContentFade 0.35s ease" : "none"
              }}
            >
              {renderSheetLines(leftPageIdx, true)}
            </div>

            {/* Pie de página inferior Hoja Izquierda (editable, discreto con acciones en hover) */}
            <div 
              className="notebook-footer-row"
              style={{
                height: 30,
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-start",
                gap: 10,
                paddingLeft: 22,
                paddingRight: 54,
                borderTop: "none",
                boxSizing: "border-box"
              }}
            >
              <input
                type="text"
                value={pageFooters[leftPageIdx] !== undefined ? pageFooters[leftPageIdx] : `Página ${leftPageIdx + 1}`}
                onChange={(e) => handleFooterChange(leftPageIdx, e.target.value)}
                placeholder={`Página ${leftPageIdx + 1}`}
                autoComplete="off"
                spellCheck="false"
                style={{
                  border: "none",
                  background: "transparent",
                  outline: "none",
                  color: C.textSoft,
                  fontSize: 11,
                  fontStyle: "italic",
                  fontFamily: "'Georgia', serif",
                  padding: 0,
                  margin: 0,
                  width: 68,
                  cursor: "text"
                }}
                title="Hacé clic para editar el pie de página"
              />

              {/* Acciones discretas al pie: solo texto gris en hover al lado de Página */}
              <div 
                className="notebook-footer-actions"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 11,
                  fontFamily: "'Georgia', serif",
                  fontStyle: "italic",
                  userSelect: "none"
                }}
              >
                <button onClick={handleAddPage} className="notebook-footer-link">
                  agregar hojas
                </button>
                {userNotePages > 1 && (
                  <>
                    <span style={{ color: "rgba(0,0,0,0.22)", fontStyle: "normal" }}>·</span>
                    <button onClick={() => deletePages([leftPageIdx])} className="notebook-footer-link">
                      eliminar hoja
                    </button>
                  </>
                )}
                <span style={{ color: "rgba(0,0,0,0.22)", fontStyle: "normal" }}>·</span>
                <button onClick={handleToggleHistoryShortcut} className="notebook-footer-link">
                  historial
                </button>
              </div>
            </div>
          </div>

          {/* ───────────────────────────────────────────────────────────── */}
          {/* LOMO CENTRAL CON ANILLAS METÁLICAS                            */}
          {/* ───────────────────────────────────────────────────────────── */}
          <div style={{
            width: 32,
            flexShrink: 0,
            background: "linear-gradient(90deg, #d4cb97 0%, #b3a976 50%, #d4cb97 100%)",
            boxShadow: "inset 0 0 10px rgba(0,0,0,0.35)",
            position: "relative",
            zIndex: 20,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "16px 0",
            boxSizing: "border-box"
          }}>
            {desktopRings}
          </div>

          {/* ───────────────────────────────────────────────────────────── */}
          {/* HOJA DERECHA                                                  */}
          {/* Si estamos en la apertura final, renderiza la HOJA DEL HISTORIAL */}
          {/* Margen rojo a la IZQUIERDA (lado de los ganchitos centrales) */}
          {/* ───────────────────────────────────────────────────────────── */}
          <div style={{
            flex: 1,
            background: "#fef6c5",
            backgroundImage: "linear-gradient(90deg, transparent 44px, #f4b0b0 44px, #f4b0b0 46px, transparent 46px)",
            backgroundSize: "100% 100%",
            borderTopRightRadius: 8,
            borderBottomRightRadius: 8,
            borderRight: "6px solid #dcd4a4",
            boxShadow: "inset 16px 0 18px -10px rgba(0,0,0,0.14)",
            display: "flex",
            flexDirection: "column",
            fontFamily: "'Georgia', serif",
            overflow: "hidden",
            position: "relative",
            boxSizing: "border-box",
            transformOrigin: "left center",
            animation: pageTurnAnim === "forward" ? "turnSheetForwardAnim 0.35s cubic-bezier(0.2, 0.8, 0.4, 1)" : "none"
          }}>
            {isDesktopShowingHistory ? (
              renderHistoryPageContent()
            ) : (
              <>
                {/* Encabezado Hoja Derecha con título editable en naranja */}
                <div className="notebook-title-row" style={{
                  display: "flex",
                  alignItems: "center",
                  height: 38,
                  borderBottom: "1.5px solid rgba(74, 144, 226, 0.15)",
                  paddingLeft: 54, // Deja libre el margen rojo de la izquierda
                  paddingRight: 22,
                  boxSizing: "border-box",
                  position: "relative"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 12, color: C.orange, userSelect: "none" }}>📓</span>
                    <input
                      type="text"
                      value={pageTitles[rightPageIdx] !== undefined ? pageTitles[rightPageIdx] : `Hoja ${rightPageIdx + 1}`}
                      onChange={(e) => handleTitleChange(rightPageIdx, e.target.value)}
                      placeholder={`Hoja ${rightPageIdx + 1}`}
                      autoComplete="off"
                      spellCheck="false"
                      style={{
                        flex: 1,
                        border: "none",
                        background: "transparent",
                        outline: "none",
                        color: C.orange,
                        fontSize: 11,
                        letterSpacing: "1.5px",
                        textTransform: "uppercase",
                        fontWeight: "bold",
                        fontFamily: "'Georgia', serif",
                        padding: 0,
                        margin: 0,
                        cursor: "text"
                      }}
                      title="Hacé clic para cambiar el título de esta hoja"
                    />
                  </div>

                  {/* Tachito dentro del margen izquierdo (hacia las anillas) */}
                  {userNotePages > 1 && (
                    <button
                      className="notebook-page-delete-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        deletePages([rightPageIdx])
                      }}
                      title={`Eliminar Hoja ${rightPageIdx + 1}`}
                      style={{
                        position: "absolute",
                        left: 14,
                        top: 8,
                        background: "transparent",
                        border: "none",
                        color: C.red,
                        fontSize: 12.5,
                        cursor: "pointer",
                        padding: 0,
                        width: 20,
                        height: 20,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 10
                      }}
                    >
                      🗑️
                    </button>
                  )}
                </div>

                {/* Renglones interactivos Hoja Derecha */}
                <div 
                  className="no-scrollbar" 
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    overflowY: "auto",
                    animation: pageTurnAnim === "forward" ? "sheetContentFade 0.35s ease" : "none"
                  }}
                >
                  {renderSheetLines(rightPageIdx, false)}
                </div>

                {/* Pie de página inferior Hoja Derecha (editable, discreto con acciones en hover) */}
                <div 
                  className="notebook-footer-row"
                  style={{
                    height: 30,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: 10,
                    paddingLeft: 54,
                    paddingRight: 22,
                    borderTop: "none",
                    boxSizing: "border-box"
                  }}
                >
                  {/* Acciones discretas al pie: solo texto gris en hover al lado de Página */}
                  <div 
                    className="notebook-footer-actions"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 11,
                      fontFamily: "'Georgia', serif",
                      fontStyle: "italic",
                      userSelect: "none"
                    }}
                  >
                    <button onClick={handleAddPage} className="notebook-footer-link">
                      agregar hojas
                    </button>
                    {userNotePages > 1 && (
                      <>
                        <span style={{ color: "rgba(0,0,0,0.22)", fontStyle: "normal" }}>·</span>
                        <button onClick={() => deletePages([rightPageIdx])} className="notebook-footer-link">
                          eliminar hoja
                        </button>
                      </>
                    )}
                    <span style={{ color: "rgba(0,0,0,0.22)", fontStyle: "normal" }}>·</span>
                    <button onClick={handleToggleHistoryShortcut} className="notebook-footer-link">
                      historial
                    </button>
                  </div>

                  <input
                    type="text"
                    value={pageFooters[rightPageIdx] !== undefined ? pageFooters[rightPageIdx] : `Página ${rightPageIdx + 1}`}
                    onChange={(e) => handleFooterChange(rightPageIdx, e.target.value)}
                    placeholder={`Página ${rightPageIdx + 1}`}
                    autoComplete="off"
                    spellCheck="false"
                    style={{
                      border: "none",
                      background: "transparent",
                      outline: "none",
                      color: C.textSoft,
                      fontSize: 11,
                      fontStyle: "italic",
                      fontFamily: "'Georgia', serif",
                      padding: 0,
                      margin: 0,
                      width: 68,
                      textAlign: "right",
                      cursor: "text"
                    }}
                    title="Hacé clic para editar el pie de página"
                  />
                </div>
              </>
            )}
          </div>

        </div>

        {/* Toast flotante */}
        {renderToastOverlay({
          bottom: 24,
          left: "50%",
          right: "auto",
          transform: "translateX(-50%)",
          minWidth: 320,
          maxWidth: "80%"
        })}
      </div>
    )

  return typeof document !== "undefined" ? createPortal(desktopContent, document.body) : desktopContent
}
