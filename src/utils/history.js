// ── Historial de Movimientos y Registro de Actividad para Verde Naranja ──────

const LS_HISTORY_KEY = "pv:history_log"
const MAX_HISTORY_ENTRIES = 150

export const ACTION_CONFIG = {
  move: {
    label: "Movido",
    icon: "✂️",
    color: "#ea580c",
    bg: "#fff7ed",
    border: "#fed7aa"
  },
  reschedule: {
    label: "Reprogramado",
    icon: "📅",
    color: "#0284c7",
    bg: "#f0f9ff",
    border: "#bae6fd"
  },
  delete: {
    label: "Eliminado",
    icon: "🗑️",
    color: "#dc2626",
    bg: "#fef2f2",
    border: "#fecaca"
  },
  create: {
    label: "Creado",
    icon: "➕",
    color: "#16a34a",
    bg: "#f0fdf4",
    border: "#bbf7d0"
  },
  edit: {
    label: "Editado",
    icon: "✏️",
    color: "#4f46e5",
    bg: "#eef2ff",
    border: "#c7d2fe"
  },
  resize: {
    label: "Duración cambiada",
    icon: "⏱️",
    color: "#d97706",
    bg: "#fffbeb",
    border: "#fde68a"
  },
  pay: {
    label: "Cobrado",
    icon: "💰",
    color: "#059669",
    bg: "#ecfdf5",
    border: "#a7f3d0"
  },
  arrived: {
    label: "En salón",
    icon: "📍",
    color: "#2563eb",
    bg: "#eff6ff",
    border: "#bfdbfe"
  },
  restore: {
    label: "Restaurado",
    icon: "🔄",
    color: "#7c3aed",
    bg: "#f5f3ff",
    border: "#ddd6fe"
  }
}

/**
 * Obtiene la lista de movimientos guardada en localStorage
 */
export function getHistoryLog() {
  try {
    const raw = localStorage.getItem(LS_HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (err) {
    console.error("[getHistoryLog] Error al leer historial:", err)
    return []
  }
}

/**
 * Guarda la lista de movimientos en localStorage respetando el límite máximo
 */
export function saveHistoryLog(entries) {
  try {
    const trimmed = Array.isArray(entries) ? entries.slice(0, MAX_HISTORY_ENTRIES) : []
    localStorage.setItem(LS_HISTORY_KEY, JSON.stringify(trimmed))
    return trimmed
  } catch (err) {
    console.error("[saveHistoryLog] Error al guardar historial:", err)
    return entries || []
  }
}

/**
 * Agrega una nueva entrada al inicio del historial de movimientos
 */
export function addHistoryEntry(entry) {
  try {
    const current = getHistoryLog()
    const now = new Date()
    const timeFormatted = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    
    const newEntry = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
      timestamp: Date.now(),
      timeFormatted,
      date: entry.date, // Fecha del turno (YYYY-MM-DD)
      action: entry.action, // 'move' | 'delete' | 'create' | 'edit' | 'resize' | 'pay' | 'arrived' | 'restore'
      client: entry.client || "Clienta",
      details: entry.details || "",
      profName: entry.profName || "",
      hour: entry.hour || "",
      payload: entry.payload || null, // Información para deshacer/restaurar
      canUndo: Boolean(entry.canUndo),
      undone: false
    }

    const updated = [newEntry, ...current].slice(0, MAX_HISTORY_ENTRIES)
    localStorage.setItem(LS_HISTORY_KEY, JSON.stringify(updated))
    return updated
  } catch (err) {
    console.error("[addHistoryEntry] Error al agregar entrada:", err)
    return []
  }
}

/**
 * Limpia todo el historial de movimientos
 */
export function clearHistoryLog() {
  try {
    localStorage.removeItem(LS_HISTORY_KEY)
    return []
  } catch {
    return []
  }
}

/**
 * Formatea el tiempo transcurrido en texto amigable ("Hace 2 min", "Hace 3 horas", "Ayer")
 */
export function formatRelativeTime(timestamp) {
  if (!timestamp) return ""
  const now = Date.now()
  const diffMs = now - timestamp
  const diffMins = Math.floor(diffMs / 60000)
  
  if (diffMins < 1) return "Recién"
  if (diffMins === 1) return "Hace 1 min"
  if (diffMins < 60) return `Hace ${diffMins} min`
  
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours === 1) return "Hace 1 hora"
  if (diffHours < 24) return `Hace ${diffHours} horas`
  
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return "Ayer"
  return `Hace ${diffDays} días`
}
