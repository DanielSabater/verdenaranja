import { HOURS } from "../constants/data.js"

/** "$1.234" format */
export const fmt = (n) => `$${Math.round(n).toLocaleString("es-AR")}`

/** Composite key: profId + hour */
export const cellKey = (profId, hour) => `${profId}||${hour}`

/** Sum of all service prices in an appointment */
export const apptTotal = (a) => {
  if (a?.isBlocked) return 0
  return Array.isArray(a?.services) ? a.services.reduce((s, sv) => s + (sv?.price || 0), 0) : 0
}

/** Sum of all service durations in an appointment */
export const apptDur = (a) => {
  if (a?.manualDur) return a.manualDur
  return Array.isArray(a?.services) ? a.services.reduce((s, sv) => s + (sv?.duration || 0), 0) : 0
}

/** Actual income received for an appointment (sum of payments minus tip) */
export const apptPaidTotal = (a) => {
  if (!a?.paid) return apptTotal(a)
  if (a.paymentSplits?.length) {
    const sumPaid = a.paymentSplits.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
    return Math.max(0, sumPaid - (a.tip || 0))
  }
  return Math.max(0, apptTotal(a) - (a.discount || 0))
}

/** Normaliza nombres de servicios para matching flexible (ignora mayúsculas, tildes y emojis) */
export const normServiceName = (str) => (str || "")
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^\p{L}\p{N}]/gu, "")
  .trim()

/** Busca el servicio correspondiente en la lista activa por ID o por nombre normalizado */
export const findActiveService = (sv, activeServices) => {
  if (!Array.isArray(activeServices) || !sv) return null
  const svIdStr = sv.id != null ? String(sv.id) : null
  const svNorm = normServiceName(sv.name)

  return activeServices.find(s => {
    if (svIdStr != null && s.id != null && String(s.id) === svIdStr) return true
    if (svNorm && s.name && normServiceName(s.name) === svNorm) return true
    return false
  }) || null
}

/** Determina si un servicio está excluido de comisión (no comisionable, ej. café, o marcado sin comisión) */
export const isServiceExcluido = (sv, activeServices = []) => {
  if (!sv) return false
  const liveSvc = findActiveService(sv, activeServices)
  if (Boolean(liveSvc?.excluidoComision || sv?.excluidoComision)) return true
  if (liveSvc?.comisionPct === 0 || sv?.comisionPct === 0) return true
  const normName = normServiceName(sv.name)
  if (normName === "cafe" || normName.startsWith("cafe") || normName.includes("cafeteria")) return true
  return false
}

/** Determina si un turno contiene servicios comisionables (o si es turno manual sin servicios registrados) */
export const hasCommissionableServices = (a, activeServices = []) => {
  if (!a || a.isBlocked || a.isNote) return false
  const services = Array.isArray(a.services) ? a.services : []
  if (services.length === 0) return true
  return services.some(sv => !isServiceExcluido(sv, activeServices))
}

/** Total comisionable base for an appointment (excluding services marked as no commission, prorating discounts) */
export const apptComisionableTotal = (a, activeServices = []) => {
  if (a?.isBlocked || a?.isNote) return 0
  const services = Array.isArray(a?.services) ? a.services : []
  const totalSvc = services.reduce((s, sv) => s + (sv?.price || 0), 0)
  const paidTotal = apptPaidTotal(a)

  // Si no hay servicios asignados pero se registró un pago/monto (ej. servicio no registrado acordado en el momento)
  if (totalSvc === 0) {
    return paidTotal > 0 ? Math.round(paidTotal) : 0
  }
  
  const comiSvc = services.filter(sv => !isServiceExcluido(sv, activeServices))
    .reduce((s, sv) => s + (sv?.price || 0), 0)

  const ratio = totalSvc > 0 ? (paidTotal / totalSvc) : 1
  return Math.round(comiSvc * ratio)
}

export const apptComisionTotal = (a, globalComisionPct, activeServices = [], dateExceptions = {}, apptDate = null, professionals = []) => {
  if (a?.isBlocked || a?.isNote) return 0
  const services = Array.isArray(a?.services) ? a.services : []
  const totalSvc = services.reduce((s, sv) => s + (sv?.price || 0), 0)

  // Professional specific commission percentage override if defined
  let basePct = globalComisionPct
  if (Array.isArray(professionals) && a?.profId) {
    const prof = professionals.find(p => String(p.id) === String(a.profId))
    if (prof && prof.comisionPct !== undefined && prof.comisionPct !== null && prof.comisionPct !== "") {
      const parsed = parseFloat(prof.comisionPct)
      if (!isNaN(parsed)) {
        basePct = parsed
      }
    }
  }

  // Check if there is a commission exception for this date
  let comisionPctToUse = basePct
  if (apptDate && dateExceptions && typeof dateExceptions === "object" && dateExceptions[apptDate] !== undefined) {
    comisionPctToUse = parseFloat(dateExceptions[apptDate])
  }

  const paidTotal = apptPaidTotal(a)

  // Si no hay servicios asignados o totalSvc es 0, pero hay un monto pagado/cobrado,
  // se comisiona directamente sobre ese monto con el porcentaje correspondiente
  if (totalSvc === 0) {
    if (paidTotal > 0 && typeof comisionPctToUse === "number" && !isNaN(comisionPctToUse)) {
      return paidTotal * (comisionPctToUse / 100)
    }
    return 0
  }

  const ratio = totalSvc > 0 ? (paidTotal / totalSvc) : 1

  return services.reduce((sum, sv) => {
    if (isServiceExcluido(sv, activeServices)) return sum

    const comisionableAmt = sv.price * ratio
    const liveSvc = findActiveService(sv, activeServices)
    const livePct = liveSvc?.comisionPct
    const pct = livePct !== undefined && livePct !== null ? livePct : (sv.comisionPct !== undefined && sv.comisionPct !== null ? sv.comisionPct : comisionPctToUse)
    return sum + (comisionableAmt * (pct / 100))
  }, 0)
}

/**
 * Fuente única de verdad para la duración de un turno en bloques (slots) de 30 minutos.
 * Prioridad:
 * 1. manualSlots: ajuste manual explícito del usuario (resize, modal o edición).
 * 2. naturalSlots: suma de la duración de los servicios asignados.
 * 3. originalSlots: slots previos si el turno fue truncado por un drag.
 * 4. apptDur(a) / 30 como fallback general.
 */
export const getApptSlots = (a) => {
  if (!a) return 1
  if (a.manualSlots != null && a.manualSlots > 0) {
    return a.manualSlots
  }
  const svcDur = Array.isArray(a.services) && a.services.length > 0
    ? a.services.reduce((s, sv) => s + (sv?.duration || 0), 0)
    : 0
  if (svcDur > 0) {
    return Math.max(1, Math.ceil(svcDur / 30))
  }
  if (a.originalSlots != null && a.originalSlots > 0) {
    return a.originalSlots
  }
  return Math.max(1, Math.ceil(apptDur(a) / 30))
}

/**
 * Comprueba si un horario/slot específico está ocupado por otro turno o bloqueo en ese día.
 */
export const isSlotOccupied = (dayAppointments = {}, profId, hour, ignoreKey = null) => {
  if (!dayAppointments) return false
  const directKey = cellKey(profId, hour)
  if (dayAppointments[directKey] && directKey !== ignoreKey) return true

  for (const [k, a] of Object.entries(dayAppointments)) {
    if (k === ignoreKey || !a) continue
    const [pid, h] = k.split("||")
    if (String(pid) !== String(profId)) continue

    const startIdx = HOURS.indexOf(h)
    if (startIdx < 0) continue
    const requestedSlots = getApptSlots(a)

    let actualSlots = requestedSlots
    for (let s = 1; s < requestedSlots; s++) {
      const checkHour = HOURS[startIdx + s]
      if (!checkHour) { actualSlots = s; break }
      const checkKey = cellKey(profId, checkHour)
      if (dayAppointments[checkKey]) {
        actualSlots = s
        break
      }
    }

    const targetIdx = HOURS.indexOf(hour)
    if (targetIdx > startIdx && targetIdx < startIdx + actualSlots) {
      return true
    }
  }
  return false
}

/**
 * Comprueba si un rango de horarios (a partir de startHour) está completamente libre para la duración en slots requerida.
 */
export const checkSlotAvailability = (dayAppointments = {}, profId, startHour, neededSlots = 1, ignoreKey = null) => {
  const startIdx = HOURS.indexOf(startHour)
  if (startIdx < 0) return { available: false, reason: "Horario inválido" }
  if (startIdx + neededSlots > HOURS.length) return { available: false, reason: "Excede horario de cierre" }

  for (let s = 0; s < neededSlots; s++) {
    const checkHour = HOURS[startIdx + s]
    if (isSlotOccupied(dayAppointments, profId, checkHour, ignoreKey)) {
      const occupyingAppt = dayAppointments[cellKey(profId, checkHour)]
      const label = occupyingAppt?.isBlocked ? "Bloqueado" : (occupyingAppt?.client ? `Ocupado (${occupyingAppt.client})` : "Ocupado")
      return { available: false, reason: label, conflictHour: checkHour }
    }
  }

  return { available: true }
}

/**
 * Obtiene la lista completa de horarios del día con su estado de disponibilidad para la duración requerida.
 */
export const getAvailableHoursForDay = (dayAppointments = {}, profId, neededSlots = 1, ignoreKey = null) => {
  return HOURS.map(hour => {
    const check = checkSlotAvailability(dayAppointments, profId, hour, neededSlots, ignoreKey)
    return {
      hour,
      available: check.available,
      reason: check.reason || null,
      conflictHour: check.conflictHour || null
    }
  })
}
