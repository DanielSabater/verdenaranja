// ── Utilidades de WhatsApp para Verde Naranja ──────────────────────────────────

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
const FULL_PHONE_REGEX = /(?:\+?\d{1,4}[-.\s]?)?\(?\d{2,5}\)?[-.\s]?\d{3,5}[-.\s]?\d{3,5}(?:[-.\s]?\d{1,5})?/g
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
  const phone = extractPhoneFromString(text)
  if (phone) {
    return text.replace(phone, "").replace(/[-–—()]/g, "").trim()
  }
  return text.trim()
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
 * Genera el texto del mensaje de recordatorio cordial y profesional
 * Soporta plantilla personalizada con etiquetas: {cliente}, {hora}, {servicios}, {profesional}, {empresa}
 */
export function generateReminderMessage({
  clientName,
  hour,
  services = [],
  profName,
  empresaNombre = "Verde Naranja",
  template,
}) {
  const nameDisplay = clientName ? clientName.trim() : "¡Hola!"
  const servicesList = services.length > 0
    ? services.map(s => s.name || s).join(" + ")
    : "tu turno"
  const profDisplay = profName ? profName.trim() : "Profesional"

  if (template && typeof template === "string" && template.trim()) {
    return template
      .replace(/{cliente}/gi, nameDisplay)
      .replace(/{hora}/gi, hour || "")
      .replace(/{servicios}/gi, servicesList)
      .replace(/{profesional}/gi, profDisplay)
      .replace(/{empresa}/gi, empresaNombre)
  }

  const profPart = profName ? ` con ${profName}` : ""
  return `¡Hola ${nameDisplay}! 🌿 Te recordamos tu turno en ${empresaNombre} para hoy a las ${hour} hs${profPart} (${servicesList}).\n¡Te esperamos! 💅✨`
}

/**
 * Abre WhatsApp directamente.
 * - Modo "app": usa whatsapp://send?phone=...&text=... para abrir la App de Windows directamente SIN pestañas adicionales en el navegador.
 * - Modo "web": abre en una pestaña de WhatsApp Web.
 */
export function openWhatsAppLink(formattedPhone, message, openMode = "app") {
  if (!formattedPhone) return false
  const encodedText = encodeURIComponent(message)

  if (openMode === "web") {
    window.open(`https://web.whatsapp.com/send?phone=${formattedPhone}&text=${encodedText}`, "_blank", "noopener,noreferrer")
    return true
  }

  // ── Modo "app": protocolo nativo de escritorio/móvil ──
  const waAppUri = `whatsapp://send?phone=${formattedPhone}&text=${encodedText}`

  let appTriggered = false
  const handleBlur = () => {
    appTriggered = true
  }
  window.addEventListener("blur", handleBlur)

  // Disparar click en enlace oculto para activar el handler del sistema operativo
  const a = document.createElement("a")
  a.href = waAppUri
  a.target = "_self"
  a.style.display = "none"
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)

  // Si después de 1.8 segundos la ventana no perdió el foco (la app no se abrió), fallback a WhatsApp Web
  setTimeout(() => {
    window.removeEventListener("blur", handleBlur)
    if (!appTriggered && document.hasFocus && document.hasFocus()) {
      // Fallback a web si el protocolo no abrió ninguna aplicación
      window.open(`https://web.whatsapp.com/send?phone=${formattedPhone}&text=${encodedText}`, "_blank", "noopener,noreferrer")
    }
  }, 1800)

  return true
}

