import { useState, useEffect, useRef } from "react"
import { C } from "../../constants/colors.js"

export function NotebookModal({ isOpen, onClose, todoTasks, setTodoTasks }) {
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
  }, [isOpen, todoTasks])

  // Al abrir la libreta: posicionar el scroll al final para mostrar siempre la última anotación y el campo de edición, y dar foco al input
  useEffect(() => {
    if (isOpen) {
      setEditingTaskId(null)
      setEditingText("")

      const scrollToBottomAndFocus = () => {
        if (listRef.current) {
          listRef.current.scrollTop = listRef.current.scrollHeight
        }
        inputRef.current?.focus({ preventScroll: true })
      }

      // Ejecutar de inmediato y tras la animación de entrada del popover
      const t1 = setTimeout(scrollToBottomAndFocus, 40)
      const t2 = setTimeout(scrollToBottomAndFocus, 230)

      return () => {
        clearTimeout(t1)
        clearTimeout(t2)
      }
    }
  }, [isOpen])

  // Autofoco, selección y cálculo de altura exacto al editar una tarea
  useEffect(() => {
    if (editingTaskId && editInputRef.current) {
      editInputRef.current.focus()
      const len = editInputRef.current.value.length
      editInputRef.current.setSelectionRange(len, len)
      
      // Auto-grow inicial redondeando al múltiplo de 32px más cercano para evitar líneas huérfanas
      editInputRef.current.style.height = "auto"
      const exactHeight = Math.max(32, Math.round(editInputRef.current.scrollHeight / 32) * 32)
      editInputRef.current.style.height = `${exactHeight}px`
    }
  }, [editingTaskId])

  if (!isOpen) return null

  const handleAddTask = (e) => {
    if (e.key === "Enter" || e.type === "click") {
      if (!newText.trim()) return
      const newTask = {
        id: Date.now().toString(),
        text: newText.trim(),
        completed: false
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
      setTodoTasks(todoTasks.map(t => t.id === id ? { ...t, text: editingText.trim() } : t))
    }
    setEditingTaskId(null)
    setEditingText("")
  }

  const handleToggleTask = (id) => {
    setTodoTasks(todoTasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t))
  }

  const handleDeleteTask = (id) => {
    setTodoTasks(todoTasks.filter(t => t.id !== id))
    if (editingTaskId === id) {
      setEditingTaskId(null)
      setEditingText("")
    }
  }

  const handleClearCompleted = () => {
    setTodoTasks(todoTasks.filter(t => !t.completed))
  }

  // Calcular líneas de relleno para completar el aspecto visual de la hoja
  const minLines = 9
  const taskLinesCount = todoTasks.reduce((acc, t) => acc + (t.text.length > 28 ? 2 : 1), 0)
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

              {/* Renglón 2: Mis anotaciones */}
              <div style={{
                display: "flex",
                alignItems: "flex-end",
                height: 32,
                flexShrink: 0,
                borderBottom: "1.5px solid rgba(74, 144, 226, 0.15)",
                paddingLeft: 54,
                paddingRight: 16,
                paddingBottom: 4,
                boxSizing: "border-box"
              }}>
                <span style={{ fontSize: 15, color: C.text, fontWeight: "bold", fontStyle: "italic" }}>
                  Mis anotaciones
                </span>
              </div>
            </div>

            {/* Área de tareas (scrollable y alineada mediante bordes físicos en cada fila) */}
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
              {/* 1. Renderizar tareas */}
              {todoTasks.map((task) => (
                <div 
                  key={task.id} 
                  style={{
                    display: "flex",
                    alignItems: "flex-start", // Alinear al inicio del renglón para soportar multilínea
                    minHeight: 32, // Altura mínima de un renglón
                    flexShrink: 0, // Evita que flexbox aplaste filas cuando hay muchas notas
                    backgroundImage: "linear-gradient(rgba(74, 144, 226, 0.15) 1.5px, transparent 1.5px)", // Asegura líneas divisorias internas si la tarea ocupa varios renglones
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
                  {/* Checkbox circular: Centrado vertical en la primera línea de 32px */}
                  <button
                    onClick={() => handleToggleTask(task.id)}
                    style={{
                      width: 18,
                      height: 18,
                      minHeight: "unset", // Anula min-height global de mobile
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
                      marginTop: 7 // Centrado vertical en la primera línea
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
                        lineHeight: "32px", // Cada renglón mide exactamente 32px
                        whiteSpace: "normal", // Permite saltar de línea limpiamente
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

                  {/* Botón eliminar: Alineado al primer renglón de la tarea */}
                  <button 
                    onClick={() => handleDeleteTask(task.id)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: C.red,
                      cursor: "pointer",
                      fontSize: 14,
                      width: 28,
                      height: 32, // Alto de un renglón
                      minHeight: "unset", // Anula min-height global de mobile
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: 0.5,
                      transition: "opacity 0.2s",
                      flexShrink: 0,
                      alignSelf: "flex-start" // Se alinea en el primer renglón junto al checkbox
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = 1}
                    onMouseLeave={e => e.currentTarget.style.opacity = 0.5}
                  >
                    ✕
                  </button>
                </div>
              ))}

              {/* 2. Renglón para agregar nueva tarea (con textarea autoregulable en multilínea en tiempo real) */}
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
                      minHeight: "unset", // Anula min-height global de mobile
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

              {/* 3. Renglones vacíos de relleno (renderizados abajo del input para completar la visual de la hoja) */}
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

            {/* Pie de Libreta / Acciones generales */}
            {todoTasks.some(t => t.completed) && (
              <div style={{ display: "flex", justifyContent: "flex-end", padding: "10px 16px 0", boxSizing: "border-box" }}>
                <button 
                  onClick={handleClearCompleted}
                  style={{
                    background: "transparent",
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    padding: "4px 10px",
                    fontSize: 10,
                    color: C.textSoft,
                    minHeight: "unset", // Anula min-height global de mobile
                    cursor: "pointer",
                    fontFamily: "Georgia, serif",
                    transition: "all 0.15s"
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.4)"; e.currentTarget.style.color = C.text }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.textSoft }}
                >
                  🧹 Limpiar completadas
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
