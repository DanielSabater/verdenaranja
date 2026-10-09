// ── Utilidades de WhatsApp para Verde Naranja ──────────────────────────────────
import { todayKey, fmtDate } from "./dates.js"

/**
 * Remueve caracteres no numéricos
 */
export function cleanDigits(phone) {
  if (!phone) return ""
  return String(phone).replace(/\D/g, "")
}

/**
 * Normaliza un string para comparaciones (sin tildes, minúsculas, sin espacios extra)
 */
export function normalizeStr(str) {
  if (!str) return ""
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
}

/**
 * Regex para detectar números de teléfono embebidos en el nombre del cliente o notas
 */
const FULL_PHONE_REGEX = /(?:(?:\+?54[\s.-]*)?(?:9[\s.-]*)?)?(?:\(?0?\d{2,5}\)?[-.\s]*)?(?:15[-.\s]*)?\d{3,5}[-.\s]?\d{3,5}(?:[-.\s]?\d{1,5})?/g
const SHORT_PHONE_REGEX = /\(?\b\d{4,}\b\)?/g

/**
 * Extrae un número de teléfono de una cadena de texto (ej. "Valeria 11-4523-8890")
 */
export function extractPhoneFromString(text) {
  if (!text || typeof text !== "string") return ""
  const match = text.match(FULL_PHONE_REGEX) || text.match(SHORT_PHONE_REGEX)
  if (match && match[0]) {
    const digits = cleanDigits(match[0])
    if (digits.length >= 6) {
      return match[0].trim()
    }
  }
  return ""
}

/**
 * Limpia el nombre del cliente removiendo el número de teléfono si estaba embebido
 */
export function cleanClientName(text) {
  if (!text || typeof text !== "string") return ""
  const phonePattern = /(?:(?:\+?54[\s.-]*)?(?:9[\s.-]*)?)?(?:\(?0?\d{2,5}\)?[\s.-]*)?(?:15[\s.-]*)?\d{3,5}[\s.-]?\d{3,5}(?:[\s.-]?\d{1,5})?/g
  const shortDigitsPattern = /\b\d{6,}\b/g
  let cleaned = text
  const matches = (text.match(phonePattern) || []).concat(text.match(shortDigitsPattern) || [])
  for (const m of matches) {
    if (!m) continue
    const digits = cleanDigits(m)
    if (digits.length >= 6) {
      cleaned = cleaned.replace(m, " ")
    }
  }
  cleaned = cleaned.replace(/(?:\+?54[\s.-]*)?(?:9[\s.-]*)?(?:\(?0?\d{2,5}\)?[\s.-]*)?$/g, "")
                   .replace(/[-–—·()|/\\:,]+/g, " ")
                   .replace(/\s+/g, " ")
                   .trim()
  return cleaned || text.trim()
}

/**
 * Formatea un número al estándar internacional para WhatsApp (wa.me)
 * Especialmente adaptado a números móviles de Argentina (+54 9 ...)
 */
export function formatWaNumber(rawPhone) {
  const digits = cleanDigits(rawPhone)
  if (!digits) return ""

  // Si ya comienza con 549 (ej: 5491145238890)
  if (digits.startsWith("549") && digits.length >= 12) {
    return digits
  }

  // Si comienza con 54 (sin 9, ej: 541145238890 -> 12 dígitos)
  if (digits.startsWith("54") && digits.length >= 11) {
    return "549" + digits.slice(2)
  }

  // Si comienza con 15 (prefijo local argentino de celular)
  let clean = digits
  if (clean.startsWith("15") && clean.length === 10) {
    // Ejemplo: 1545238890 -> Asume AMBA 11 + número
    clean = "11" + clean.slice(2)
  }

  // Si tiene 10 dígitos (típico celular argentino con código de área, ej: 1145238890 o 2234567890)
  if (clean.length === 10) {
    return "549" + clean
  }

  // Si tiene 8 dígitos (número local sin código de área, ej: 45238890) -> Asume AMBA (11)
  if (clean.length === 8) {
    return "54911" + clean
  }

  // Si ya tiene más de 10 dígitos y no empieza con 54 (ej. internacional +598, etc.)
  if (clean.length > 10) {
    return clean
  }

  // Por defecto si tiene entre 9 y 11 dígitos, anteponer 549
  return "549" + clean
}

/**
 * Resuelve el teléfono de un turno consultando la base de clientes o extrayéndolo del texto
 */
export function getApptClientPhone(appt, clientes = []) {
  if (!appt) return { phone: "", cleanName: "", fromClientRecord: false }

  const rawClient = appt.client || ""
  const normName = normalizeStr(cleanClientName(rawClient))

  // 1. Buscar coincidencia en la base de clientes
  if (normName && Array.isArray(clientes)) {
    const matched = clientes.find(c => c && c.name && normalizeStr(c.name) === normName)
    if (matched && matched.phone && matched.phone.trim()) {
      return {
        phone: matched.phone.trim(),
        cleanName: matched.name,
        fromClientRecord: true,
        clientObj: matched,
      }
    }
  }

  // 2. Extraer del propio nombre o de las notas del turno
  const phoneFromName = extractPhoneFromString(rawClient)
  if (phoneFromName) {
    return {
      phone: phoneFromName,
      cleanName: cleanClientName(rawClient),
      fromClientRecord: false,
    }
  }

  const phoneFromNotes = extractPhoneFromString(appt.notes || "")
  if (phoneFromNotes) {
    return {
      phone: phoneFromNotes,
      cleanName: cleanClientName(rawClient),
      fromClientRecord: false,
    }
  }

  return {
    phone: "",
    cleanName: cleanClientName(rawClient) || rawClient,
    fromClientRecord: false,
  }
}

/**
 * Plantilla por defecto de recordatorio con la variable {dia}
 */
export const DEFAULT_WA_REMINDER_TEMPLATE = "¡Hola {cliente}! 🌿 Te recordamos tu turno en {empresa} para {dia} a las {hora} hs con {profesional} ({servicios}).\n¡Te esperamos! 💅✨"

/**
 * Devuelve la expresión adecuada para referirse al día del turno:
 * - "hoy" si el turno es hoy
 * - "mañana" si el turno es para el día siguiente
 * - "ayer" si el turno es de ayer
 * - "el [Día] [número] de [mes]" (ej: "el Viernes 9 de octubre") si es cualquier otra fecha
 */
export function getTurnoDayLabel(dateKey) {
  if (!dateKey) return "hoy"
  const tKey = todayKey()
  if (dateKey === tKey) return "hoy"

  try {
    const [ty, tm, td] = tKey.split("-").map(Number)
    const [dy, dm, dd] = dateKey.split("-").map(Number)
    const tDate = new Date(ty, tm - 1, td, 12, 0, 0)
    const dDate = new Date(dy, dm - 1, dd, 12, 0, 0)
    const diffDays = Math.round((dDate.getTime() - tDate.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 1) return "mañana"
    if (diffDays === -1) return "ayer"
    return `el ${fmtDate(dateKey)}`
  } catch (_) {
    return `el ${fmtDate(dateKey)}`
  }
}

/**
 * Genera el texto del mensaje de recordatorio cordial y profesional
 * Soporta plantilla personalizada con etiquetas: {cliente}, {dia}, {fecha}, {hora}, {servicios}, {profesional}, {empresa}
 */
export function generateReminderMessage({
  clientName,
  hour,
  services = [],
  profName,
  empresaNombre = "Verde Naranja",
  template,
  date,
}) {
  const nameDisplay = clientName ? clientName.trim() : "¡Hola!"
  const servicesList = services.length > 0
    ? services.map(s => s.name || s).join(" + ")
    : "tu turno"
  const profDisplay = profName ? profName.trim() : "Profesional"
  const dateKey = date || todayKey()
  const dayLabel = getTurnoDayLabel(dateKey)
  const fullDate = fmtDate(dateKey)

  let text = (template && typeof template === "string" && template.trim())
    ? template
    : DEFAULT_WA_REMINDER_TEMPLATE

  // Compatibilidad retroactiva: si la plantilla guardada aún tenía "para hoy" o "hoy" fijo
  // y el turno pertenece a otro día que no sea el que corre:
  if (!text.includes("{dia}") && !text.includes("{fecha}") && dateKey !== todayKey()) {
    if (/para\s+hoy/i.test(text)) {
      text = text.replace(/para\s+hoy/gi, `para ${dayLabel}`)
    } else if (/hoy\s+a\s+las/i.test(text)) {
      text = text.replace(/hoy\s+a\s+las/gi, `${dayLabel} a las`)
    } else if (/de\s+hoy/i.test(text)) {
      text = text.replace(/de\s+hoy/gi, `del ${fullDate}`)
    }
  }

  let result = text
    .replace(/{cliente}/gi, nameDisplay)
    .replace(/{dia}/gi, dayLabel)
    .replace(/{fecha}/gi, fullDate)
    .replace(/{hora}/gi, hour || "")
    .replace(/{servicios}/gi, servicesList)
    .replace(/{profesional}/gi, profDisplay)
    .replace(/{empresa}/gi, empresaNombre)

  // Limpieza de posibles redundancias o cacofonías gramaticales
  result = result
    .replace(/\bel\s+el\b/gi, "el")
    .replace(/\bpara\s+el\s+hoy\b/gi, "para hoy")
    .replace(/\bpara\s+el\s+mañana\b/gi, "para mañana")

  return result
}

/**
 * Genera el texto para notificar por WhatsApp a una clienta sobre la reprogramación de su turno
 */
export function generateRescheduleMessage({
  clientName,
  dateFormatted,
  hour,
  services = [],
  profName,
  empresaNombre = "Verde Naranja",
}) {
  const nameDisplay = clientName ? clientName.trim() : "¡Hola!"
  const servicesList = services.length > 0
    ? services.map(s => s.name || s).join(" + ")
    : "tu turno"
  const profPart = profName ? ` con ${profName}` : ""

  return `¡Hola ${nameDisplay}! 🌿 Te confirmamos que tu turno en ${empresaNombre} fue reprogramado para el *${dateFormatted}* a las *${hour} hs*${profPart} (${servicesList}).\n¡Te esperamos! 💅✨`
}

let waWebWindow = null

function openWaWeb(url) {
  try {
    waWebWindow = window.open(url, "whatsapp_web_vn")
    if (waWebWindow) {
      try {
        waWebWindow.focus()
      } catch (_) {}
    }
  } catch (_) {
    window.open(url, "_blank", "noopener,noreferrer")
  }
  return true
}

/**
 * Abre WhatsApp directamente.
 * - Modo "app": usa whatsapp://send?phone=...&text=... para abrir directamente la Aplicación de WhatsApp (Desktop en Mac/Windows o App en celular) sin intermediarios.
 * - Modo "web": abre en una pestaña reutilizable de WhatsApp Web.
 */
export function openWhatsAppLink(formattedPhone, message, openMode = "app") {
  if (!formattedPhone) return false
  const encodedText = encodeURIComponent(message)
  const webUrl = `https://web.whatsapp.com/send?phone=${formattedPhone}&text=${encodedText}`

  if (openMode === "web") {
    return openWaWeb(webUrl)
  }

  // ── Modo "app": activa directamente la aplicación instalada de WhatsApp ──
  const waAppUri = `whatsapp://send?phone=${formattedPhone}&text=${encodedText}`

  try {
    const a = document.createElement("a")
    a.href = waAppUri
    a.style.display = "none"
    document.body.appendChild(a)
    a.click()
    setTimeout(() => {
      try {
        if (a && a.parentNode) document.body.removeChild(a)
      } catch (_) {}
    }, 500)
  } catch (_) {
    window.location.href = waAppUri
  }

  return true
}

