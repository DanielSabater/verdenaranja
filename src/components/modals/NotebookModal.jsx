import { useState, useEffect, useRef, useMemo } from "react"
import { C } from "../../constants/colors.js"
import { formatRelativeTime } from "../../utils/history.js"

export function NotebookModal({
  isOpen,
  onClose,
  todoTasks = [],
  setTodoTasks,
  todoHistory = [],
  setTodoHistory
}) {
  const [activeTab, setActiveTab] = useState("active") // "active" | "history"
  const [historySearch, setHistorySearch] = useState("")
  const [toast, setToast] = useState(null) // { message, onUndo }
  const [copiedId, setCopiedId] = useState(null)
  const [newText, setNewText] = useState("")
  const [editingTaskId, setEditingTaskId] = useState(null)
  const [editingText, setEditingText] = useState("")

  const inputRef = useRef(null)
  const editInputRef = useRef(null)
  const sheetRef = useRef(null)
  const listRef = useRef(null)
  const [sheetHeight, setSheetHeight] = useState(480)

  // Medir la altura real de la libreta para calcular los anillos necesarios
  useEffect(() => {
    const el = sheetRef.current
    if (!el) return

    const updateHeight = () => {
      if (el.offsetHeight) {
        setSheetHeight(el.offsetHeight)
      }
    }

    updateHeight()

    const ro = new ResizeObserver(() => {
      updateHeight()
    })

    ro.observe(el)
    return () => ro.disconnect()
  }, [isOpen, todoTasks, todoHistory, activeTab])

  // Temporizador para auto-descartar el toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5500)
      return () => clearTimeout(timer)
    }
  }, [toast])

  // Al abrir la libreta o cambiar de tab: posicionar el scroll y dar foco según corresponda
  useEffect(() => {
    if (isOpen) {
      setEditingTaskId(null)
      setEditingText("")

      const scrollToBottomAndFocus = () => {
        if (activeTab === "active") {
          if (listRef.current) {
            listRef.current.scrollTop = listRef.current.scrollHeight
          }
          inputRef.current?.focus({ preventScroll: true })
        } else if (listRef.current) {
          listRef.current.scrollTop = 0
        }
      }

      const t1 = setTimeout(scrollToBottomAndFocus, 40)
      const t2 = setTimeout(scrollToBottomAndFocus, 230)

      return () => {
        clearTimeout(t1)
        clearTimeout(t2)
      }
    }
  }, [isOpen, activeTab])

  // Autofoco, selección y cálculo de altura exacto al editar una tarea
  useEffect(() => {
    if (editingTaskId && editInputRef.current) {
      editInputRef.current.focus()
      const len = editInputRef.current.value.length
      editInputRef.current.setSelectionRange(len, len)
      
      editInputRef.current.style.height = "auto"
      const exactHeight = Math.max(32, Math.round(editInputRef.current.scrollHeight / 32) * 32)
      editInputRef.current.style.height = `${exactHeight}px`
    }
  }, [editingTaskId])

  // Filtrado de notas en el historial
  const safeHistory = Array.isArray(todoHistory) ? todoHistory : []
  const filteredHistory = useMemo(() => {
    const q = historySearch.trim().toLowerCase()
    if (!q) return safeHistory
    return safeHistory.filter(h => (h.text || "").toLowerCase().includes(q))
  }, [safeHistory, historySearch])

  if (!isOpen) return null

  // ── Acciones de tareas activas ──

  const handleAddTask = (e) => {
    if (e.key === "Enter" || e.type === "click") {
      if (!newText.trim()) return
      const newTask = {
        id: Date.now().toString(),
        text: newText.trim(),
        completed: false,
        createdAt: Date.now()
      }
      setTodoTasks([...todoTasks, newTask])
      setNewText("")
      
      if (inputRef.current) {
        inputRef.current.style.height = "32px"
      }

      setTimeout(() => {
        if (listRef.current) {
          listRef.current.scrollTo({
            top: listRef.current.scrollHeight,
            behavior: "smooth"
          })
        }
      }, 50)
    }
  }

  const handleSaveEdit = (id) => {
    if (!editingText.trim()) {
      handleDeleteTask(id)
    } else {
      const prevTask = todoTasks.find(t => t.id === id)
      if (prevTask && prevTask.text !== editingText.trim()) {
        // Guardamos copia de la versión anterior en el historial para evitar pérdidas
        const historyEntry = {
          id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
          text: prevTask.text,
          deletedAt: Date.now(),
          completed: Boolean(prevTask.completed),
          isPreviousVersion: true
        }
        if (setTodoHistory) {
          setTodoHistory(prev => [historyEntry, ...(prev || [])].slice(0, 150))
        }
      }
      setTodoTasks(todoTasks.map(t => t.id === id ? { ...t, text: editingText.trim() } : t))
    }
    setEditingTaskId(null)
    setEditingText("")
  }

  const handleToggleTask = (id) => {
    setTodoTasks(todoTasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t))
  }

  const handleDeleteTask = (id) => {
    const taskToDelete = todoTasks.find(t => t.id === id)
    if (!taskToDelete) return
    const now = Date.now()
    const historyEntry = {
      id: taskToDelete.id || (Date.now().toString() + Math.random().toString(36).substring(2, 6)),
      text: taskToDelete.text,
      deletedAt: now,
      completed: Boolean(taskToDelete.completed)
    }

    if (setTodoHistory) {
      setTodoHistory(prev => [historyEntry, ...(prev || [])].slice(0, 150))
    }
    setTodoTasks(todoTasks.filter(t => t.id !== id))
    if (editingTaskId === id) {
      setEditingTaskId(null)
      setEditingText("")
    }

    // Ofrecer Deshacer inmediato
    setToast({
      message: "Anotación borrada",
      onUndo: () => {
        setTodoTasks(prev => [...(prev || []), taskToDelete])
        if (setTodoHistory) {
          setTodoHistory(prev => (prev || []).filter(h => h.id !== historyEntry.id))
        }
        setToast(null)
      }
    })
  }

  const handleClearCompleted = () => {
    const completed = todoTasks.filter(t => t.completed)
    if (completed.length === 0) return
    const now = Date.now()
    const entries = completed.map(t => ({
      id: t.id || (Date.now().toString() + Math.random().toString(36).substring(2, 6)),
      text: t.text,
      deletedAt: now,
      completed: true
    }))

    if (setTodoHistory) {
      setTodoHistory(prev => [...entries, ...(prev || [])].slice(0, 150))
    }
    setTodoTasks(todoTasks.filter(t => !t.completed))

    setToast({
      message: `${completed.length} ${completed.length === 1 ? "nota completada archivada" : "notas completadas archivadas"}`,
      onUndo: () => {
        setTodoTasks(prev => [...(prev || []), ...completed])
        if (setTodoHistory) {
          const ids = new Set(entries.map(e => e.id))
          setTodoHistory(prev => (prev || []).filter(h => !ids.has(h.id)))
        }
        setToast(null)
      }
    })
  }

  // ── Acciones de historial / recuperación ──

  const handleRestoreTask = (item) => {
    const restored = {
      id: item.id || Date.now().toString(),
      text: item.text,
      completed: false
    }
    setTodoTasks(prev => [...(prev || []), restored])
    if (setTodoHistory) {
      setTodoHistory(prev => (prev || []).filter(h => h.id !== item.id))
    }
    setToast({
      message: "✅ Anotación recuperada a la libreta",
      onUndo: null
    })
  }

  const handlePermanentDelete = (id) => {
    if (setTodoHistory) {
      setTodoHistory(prev => (prev || []).filter(h => h.id !== id))
    }
  }

  const handleClearAllHistory = () => {
    if (window.confirm("¿Seguro que deseas vaciar el historial de notas borradas? Esta acción no se puede deshacer.")) {
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

  // Calcular líneas de relleno para completar el aspecto visual de la hoja
  const minLines = 9
  const currentList = activeTab === "history" ? filteredHistory : todoTasks
  const taskLinesCount = currentList.reduce((acc, t) => acc + ((t.text || "").length > 28 ? 2 : 1), 0)
  const fillerCount = Math.max(0, minLines - taskLinesCount - 1)

  // Calcular la altura real de la hoja respetando el límite visual de maxHeight (75vh)
  const maxAllowedHeight = typeof window !== "undefined" ? window.innerHeight * 0.75 : 600
  const realHeight = Math.min(sheetHeight || 460, maxAllowedHeight)

  // Generar la cantidad exacta de anillos que caben físicamente en el lomo visible de la libreta
  const ringCount = Math.max(0, Math.floor((realHeight - 57) / 32) + 1)
  const rings = Array.from({ length: ringCount }).map((_, i) => (
    <div key={i} style={{
      position: "absolute",
      left: 10,
      top: `${27 + i * 32}px`,
      width: 24,
      height: 10,
      borderRadius: 5,
      background: "linear-gradient(180deg, #dedede 0%, #b0b0b0 30%, #efefef 70%, #999999 100%)",
      border: "1px solid #888",
      boxShadow: "1px 2px 3px rgba(0,0,0,0.15)",
      zIndex: 10,
      pointerEvents: "none"
    }} />
  ))

  return (
    <>
      {/* Click-catcher overlay: completamente transparente, sin blur */}
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

      {/* Contenedor flotante de la libreta */}
      <div className="notebook-popover">
        {/* Contenedor relativo para posicionar los anillos de la libreta */}
        <div style={{ position: "relative", width: "100%", paddingLeft: 22, boxSizing: "border-box" }}>
          
          {/* Anillos del espiral metálico contenidos estrictamente dentro de la altura de la libreta */}
          <div style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 44,
            overflow: "hidden",
            pointerEvents: "none",
            zIndex: 10
          }}>
            {rings}
          </div>

          {/* Hojas de la libreta */}
          <div 
            ref={sheetRef}
            style={{
            position: "relative",
            background: "#fef6c5", // Tonalidad amarillita de anotador de papel
            backgroundImage: `linear-gradient(90deg, transparent 44px, #f4b0b0 44px, #f4b0b0 46px, transparent 46px)`, // Línea de margen roja vertical
            backgroundSize: "100% 100%",
            borderRadius: "4px 16px 16px 4px",
            border: `1.5px solid ${C.border}`,
            borderLeft: "8px solid #c0d8c4", // Lomo verde pastel
            boxShadow: "0 20px 50px rgba(40,60,45,.25), 4px 4px 15px rgba(0,0,0,0.06)",
            padding: "16px 0px 16px 0px", // Padding horizontal en 0 para que las líneas crucen toda la hoja
            minHeight: 460,
            maxHeight: "75vh",
            display: "flex",
            flexDirection: "column",
            fontFamily: "'Georgia', serif",
            boxSizing: "border-box",
            overflow: "hidden"
          }}>
            
            {/* Cabecera de la libreta integrada en las líneas (Renglón 1 y 2) */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              
              {/* Renglón 1: LIBRETA + Botón Cerrar */}
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-end",
                height: 32,
                flexShrink: 0,
                borderBottom: "1.5px solid rgba(74, 144, 226, 0.15)",
                paddingLeft: 54,
                paddingRight: 16,
                paddingBottom: 4,
                boxSizing: "border-box"
              }}>
                <span style={{ fontSize: 9, letterSpacing: "2.5px", color: C.orange, textTransform: "uppercase", fontWeight: "bold" }}>
                  📓 Libreta
                </span>
                <button 
                  onMouseDown={onClose} 
                  style={{
                    background: "transparent",
                    border: "none",
                    minHeight: "unset", // Anula min-height global de mobile
                    cursor: "pointer",
                    color: C.textSoft,
                    fontSize: 20,
                    lineHeight: 1,
                    padding: 0,
                    margin: 0,
                    marginBottom: -2
                  }}
                >
                  &times;
                </button>
              </div>

              {/* Renglón 2: Selector de pestañas Anotaciones vs Historial */}
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                height: 32,
                flexShrink: 0,
                borderBottom: "1.5px solid rgba(74, 144, 226, 0.15)",
                paddingLeft: 50,
                paddingRight: 14,
                boxSizing: "border-box"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <button
                    onClick={() => setActiveTab("active")}
                    style={{
                      background: activeTab === "active" ? "rgba(58, 125, 68, 0.15)" : "transparent",
                      border: "none",
                      borderRadius: 6,
                      padding: "2px 7px",
                      fontSize: 12,
                      fontWeight: "bold",
                      fontStyle: "italic",
                      color: activeTab === "active" ? C.green : C.textSoft,
                      cursor: "pointer",
                      fontFamily: "'Georgia', serif",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      transition: "all .15s"
                    }}
                  >
                    <span>📝</span>
                    <span>Anotaciones</span>
                    {todoTasks.length > 0 && (
                      <span style={{
                        fontSize: 9.5,
                        background: activeTab === "active" ? C.green : "rgba(0,0,0,0.06)",
                        color: activeTab === "active" ? "#fff" : C.textSoft,
                        borderRadius: 10,
                        padding: "0px 5px",
                        lineHeight: "14px"
                      }}>
                        {todoTasks.length}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => setActiveTab("history")}
                    style={{
                      background: activeTab === "history" ? "rgba(234, 88, 12, 0.15)" : "transparent",
                      border: "none",
                      borderRadius: 6,
                      padding: "2px 7px",
                      fontSize: 12,
                      fontWeight: "bold",
                      fontStyle: "italic",
                      color: activeTab === "history" ? "#ea580c" : C.textSoft,
                      cursor: "pointer",
                      fontFamily: "'Georgia', serif",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      transition: "all .15s"
                    }}
                  >
                    <span>🕒</span>
                    <span>Historial</span>
                    {safeHistory.length > 0 && (
                      <span style={{
                        fontSize: 9.5,
                        background: activeTab === "history" ? "#ea580c" : "rgba(234, 88, 12, 0.12)",
                        color: activeTab === "history" ? "#fff" : "#ea580c",
                        borderRadius: 10,
                        padding: "0px 5px",
                        lineHeight: "14px",
                        fontWeight: "bold"
                      }}>
                        {safeHistory.length}
                      </span>
                    )}
                  </button>
                </div>

                {activeTab === "history" && safeHistory.length > 2 && (
                  <input
                    type="text"
                    placeholder="Filtrar..."
                    value={historySearch}
                    onChange={e => setHistorySearch(e.target.value)}
                    style={{
                      height: 20,
                      width: 80,
                      fontSize: 10.5,
                      fontFamily: "'Georgia', serif",
                      fontStyle: "italic",
                      border: `1px solid ${C.border}`,
                      borderRadius: 6,
                      padding: "1px 6px",
                      background: "rgba(255,255,255,0.7)",
                      outline: "none",
                      color: C.text
                    }}
                  />
                )}
              </div>
            </div>

            {/* Área de contenido (scrollable y alineada con líneas de fondo) */}
            <div 
              ref={listRef}
              className="no-scrollbar" 
              style={{
                flex: 1,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                minHeight: 288
              }}
            >
              {activeTab === "history" ? (
                /* ── PESTAÑA HISTORIAL / NOTAS BORRADAS ── */
                filteredHistory.length === 0 ? (
                  <div style={{
                    padding: "32px 20px 24px 54px",
                    textAlign: "left",
                    color: C.textSoft,
                    fontStyle: "italic",
                    fontSize: 12.5,
                    lineHeight: 1.6
                  }}>
                    <div style={{ fontSize: 22, marginBottom: 6 }}>✨</div>
                    <div style={{ fontWeight: "bold", color: C.text, fontSize: 13, marginBottom: 4 }}>
                      {safeHistory.length === 0 ? "Historial vacío" : "Sin coincidencias"}
                    </div>
                    <div>
                      {safeHistory.length === 0 
                        ? "Las anotaciones que borres quedarán guardadas acá para que puedas recuperarlas en cualquier momento."
                        : "No se encontraron notas en el historial que coincidan con la búsqueda."}
                    </div>
                  </div>
                ) : (
                  filteredHistory.map((item) => (
                    <div 
                      key={item.id} 
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        minHeight: 32,
                        flexShrink: 0,
                        backgroundImage: "linear-gradient(rgba(74, 144, 226, 0.15) 1.5px, transparent 1.5px)",
                        backgroundSize: "100% 32px",
                        backgroundPosition: "0 31px",
                        paddingLeft: 54,
                        paddingRight: 16,
                        gap: 8,
                        fontSize: 12.5,
                        color: C.text,
                        boxSizing: "border-box"
                      }}
                    >
                      {/* Icono indicador */}
                      <span style={{ fontSize: 11, color: C.textSoft, marginTop: 7, flexShrink: 0 }}>
                        {item.completed ? "✓" : "🕒"}
                      </span>

                      {/* Texto de la nota e info de borrado */}
                      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", padding: "5px 0 3px" }}>
                        <span style={{
                          fontStyle: "italic",
                          color: C.text,
                          lineHeight: "20px",
                          wordBreak: "break-word",
                          overflowWrap: "anywhere",
                          textDecoration: item.completed ? "line-through" : "none",
                          opacity: item.completed ? 0.7 : 1
                        }}>
                          {item.text}
                        </span>
                        <div style={{ fontSize: 9.5, color: C.textSoft, marginTop: 1, display: "flex", alignItems: "center", gap: 5 }}>
                          <span>{formatRelativeTime(item.deletedAt)}</span>
                          {item.isPreviousVersion && (
                            <span style={{ color: "#d97706", fontWeight: "bold" }}>· versión editada</span>
                          )}
                          {item.completed && (
                            <span style={{ color: C.green }}>· completada</span>
                          )}
                        </div>
                      </div>

                      {/* Botones de acción */}
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6, flexShrink: 0 }}>
                        <button
                          onClick={() => handleRestoreTask(item)}
                          title="Recuperar a notas activas"
                          style={{
                            background: C.greenPale,
                            border: `1px solid ${C.green}55`,
                            color: C.green,
                            borderRadius: 6,
                            padding: "2px 7px",
                            fontSize: 10,
                            fontWeight: "bold",
                            cursor: "pointer",
                            fontFamily: "'Georgia', serif",
                            display: "flex",
                            alignItems: "center",
                            gap: 3,
                            transition: "all .15s"
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
                            padding: "2px 6px",
                            fontSize: 10,
                            cursor: "pointer",
                            fontFamily: "'Georgia', serif"
                          }}
                        >
                          {copiedId === item.id ? "✓" : "📋"}
                        </button>

                        <button
                          onClick={() => handlePermanentDelete(item.id)}
                          title="Eliminar permanentemente del historial"
                          style={{
                            background: "transparent",
                            border: "none",
                            color: C.red,
                            cursor: "pointer",
                            fontSize: 12,
                            padding: "2px 4px",
                            opacity: 0.45,
                            transition: "opacity .15s"
                          }}
                          onMouseEnter={e => e.currentTarget.style.opacity = 1}
                          onMouseLeave={e => e.currentTarget.style.opacity = 0.45}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))
                )
              ) : (
                /* ── PESTAÑA NOTAS ACTIVAS ── */
                <>
                  {todoTasks.map((task) => (
                    <div 
                      key={task.id} 
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        minHeight: 32,
                        flexShrink: 0,
                        backgroundImage: "linear-gradient(rgba(74, 144, 226, 0.15) 1.5px, transparent 1.5px)",
                        backgroundSize: "100% 32px",
                        backgroundPosition: "0 31px",
                        paddingLeft: 54,
                        paddingRight: 16,
                        gap: 10,
                        fontSize: 13,
                        color: C.text,
                        boxSizing: "border-box"
                      }}
                    >
                      {/* Checkbox circular */}
                      <button
                        onClick={() => handleToggleTask(task.id)}
                        style={{
                          width: 18,
                          height: 18,
                          minHeight: "unset",
                          borderRadius: "50%",
                          border: `1.5px solid ${task.completed ? C.green : C.textSoft}`,
                          background: task.completed ? C.greenPale : "transparent",
                          color: C.green,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          fontSize: 12,
                          padding: 0,
                          fontWeight: "bold",
                          flexShrink: 0,
                          outline: "none",
                          marginTop: 7
                        }}
                      >
                        {task.completed && "✓"}
                      </button>

                      {/* Texto de la tarea o editor inline */}
                      {editingTaskId === task.id ? (
                        <textarea
                          ref={editInputRef}
                          value={editingText}
                          onChange={(e) => {
                            setEditingText(e.target.value)
                            e.target.style.height = "auto"
                            const exactHeight = Math.max(32, Math.round(e.target.scrollHeight / 32) * 32)
                            e.target.style.height = `${exactHeight}px`
                          }}
                          onBlur={() => handleSaveEdit(task.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault()
                              handleSaveEdit(task.id)
                            } else if (e.key === "Escape") {
                              setEditingTaskId(null)
                            }
                          }}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            border: "none",
                            background: "transparent",
                            outline: "none",
                            fontSize: 13,
                            fontFamily: "'Georgia', serif",
                            fontStyle: "italic",
                            color: C.text,
                            height: 32,
                            lineHeight: "32px",
                            padding: 0,
                            margin: 0,
                            resize: "none",
                            overflow: "hidden",
                            boxSizing: "border-box"
                          }}
                        />
                      ) : (
                        <span 
                          onClick={() => {
                            setEditingTaskId(task.id)
                            setEditingText(task.text)
                          }}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            textDecoration: task.completed ? "line-through" : "none",
                            color: task.completed ? C.textSoft : C.text,
                            opacity: task.completed ? 0.6 : 1,
                            fontStyle: "italic",
                            lineHeight: "32px",
                            whiteSpace: "normal",
                            wordBreak: "break-word",
                            overflowWrap: "anywhere",
                            transition: "all 0.2s",
                            cursor: "pointer"
                          }}
                          title="Hacé clic para editar"
                        >
                          {task.text}
                        </span>
                      )}

                      {/* Botón eliminar */}
                      <button 
                        onClick={() => handleDeleteTask(task.id)}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: C.red,
                          cursor: "pointer",
                          fontSize: 14,
                          width: 28,
                          height: 32,
                          minHeight: "unset",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          opacity: 0.5,
                          transition: "opacity 0.2s",
                          flexShrink: 0,
                          alignSelf: "flex-start"
                        }}
                        onMouseEnter={e => e.currentTarget.style.opacity = 1}
                        onMouseLeave={e => e.currentTarget.style.opacity = 0.5}
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  {/* Renglón para agregar nueva tarea */}
                  <div style={{ 
                    display: "flex", 
                    alignItems: "flex-start", 
                    minHeight: 32, 
                    flexShrink: 0,
                    backgroundImage: "linear-gradient(rgba(74, 144, 226, 0.15) 1.5px, transparent 1.5px)",
                    backgroundSize: "100% 32px",
                    backgroundPosition: "0 31px",
                    paddingLeft: 54,
                    paddingRight: 16,
                    gap: 10,
                    boxSizing: "border-box"
                  }}>
                    <span style={{ fontSize: 16, color: C.green, marginLeft: 2, userSelect: "none", marginTop: 7 }}>✏️</span>
                    <textarea
                      ref={inputRef}
                      rows={1}
                      value={newText}
                      onChange={(e) => {
                        setNewText(e.target.value)
                        e.target.style.height = "auto"
                        const exactHeight = Math.max(32, Math.round(e.target.scrollHeight / 32) * 32)
                        e.target.style.height = `${exactHeight}px`
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault()
                          handleAddTask(e)
                        }
                      }}
                      placeholder="Escribir nuevo recordatorio..."
                      style={{
                        flex: 1,
                        minWidth: 0,
                        border: "none",
                        background: "transparent",
                        outline: "none",
                        fontSize: 13,
                        fontFamily: "'Georgia', serif",
                        fontStyle: "italic",
                        color: C.text,
                        height: 32,
                        lineHeight: "32px",
                        padding: 0,
                        margin: 0,
                        resize: "none",
                        overflow: "hidden",
                        boxSizing: "border-box"
                      }}
                    />
                    {newText.trim() && (
                      <button 
                        onClick={handleAddTask}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: C.green,
                          cursor: "pointer",
                          fontSize: 11,
                          fontWeight: "bold",
                          fontFamily: "Georgia, serif",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                          padding: "0 8px",
                          height: 32,
                          minHeight: "unset",
                          display: "flex",
                          alignItems: "center",
                          alignSelf: "flex-start",
                          flexShrink: 0
                        }}
                      >
                        Listo
                      </button>
                    )}
                  </div>
                </>
              )}

              {/* Renglones vacíos de relleno para mantener la estética de la hoja */}
              {Array.from({ length: fillerCount }).map((_, idx) => (
                <div 
                  key={`filler-${idx}`} 
                  style={{ 
                    height: 32, 
                    flexShrink: 0,
                    borderBottom: "1.5px solid rgba(74, 144, 226, 0.15)",
                    boxSizing: "border-box"
                  }} 
                />
              ))}
            </div>

            {/* Toast flotante de Deshacer */}
            {toast && (
              <div style={{
                position: "absolute",
                bottom: 12,
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
                zIndex: 30,
                boxShadow: "0 6px 18px rgba(0,0,0,0.25)"
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
            )}

            {/* Pie de Libreta / Acciones generales */}
            <div style={{
              display: "flex",
              justifyContent: activeTab === "history" ? "space-between" : "flex-end",
              alignItems: "center",
              padding: "10px 16px 0 54px",
              boxSizing: "border-box"
            }}>
              {activeTab === "history" ? (
                <>
                  <button 
                    onClick={() => setActiveTab("active")}
                    style={{
                      background: "transparent",
                      border: "none",
                      padding: "4px 0",
                      fontSize: 11,
                      color: C.green,
                      fontWeight: "bold",
                      cursor: "pointer",
                      fontFamily: "Georgia, serif"
                    }}
                  >
                    ← Volver a anotaciones
                  </button>

                  {safeHistory.length > 0 && (
                    <button 
                      onClick={handleClearAllHistory}
                      style={{
                        background: "transparent",
                        border: `1px solid ${C.border}`,
                        borderRadius: 8,
                        padding: "3px 8px",
                        fontSize: 9.5,
                        color: C.red,
                        opacity: 0.8,
                        cursor: "pointer",
                        fontFamily: "Georgia, serif",
                        transition: "all 0.15s"
                      }}
                      onMouseEnter={e => e.currentTarget.style.opacity = 1}
                      onMouseLeave={e => e.currentTarget.style.opacity = 0.8}
                    >
                      Vaciar historial
                    </button>
                  )}
                </>
              ) : (
                todoTasks.some(t => t.completed) && (
                  <button 
                    onClick={handleClearCompleted}
                    style={{
                      background: "transparent",
                      border: `1px solid ${C.border}`,
                      borderRadius: 8,
                      padding: "4px 10px",
                      fontSize: 10,
                      color: C.textSoft,
                      minHeight: "unset",
                      cursor: "pointer",
                      fontFamily: "Georgia, serif",
                      transition: "all 0.15s"
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.4)"; e.currentTarget.style.color = C.text }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.textSoft }}
                  >
                    🧹 Limpiar completadas
                  </button>
                )
              )}
            </div>

          </div>
        </div>
      </div>
    </>
  )
}
