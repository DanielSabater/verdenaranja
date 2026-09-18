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

/** Total comisionable base for an appointment (excluding services marked as no commission, prorating discounts) */
export const apptComisionableTotal = (a) => {
  if (a?.isBlocked) return 0
  const services = Array.isArray(a?.services) ? a.services : []
  const totalSvc = services.reduce((s, sv) => s + (sv?.price || 0), 0)
  const paidTotal = apptPaidTotal(a)

  // Si no hay servicios asignados pero se registró un pago/monto (ej. servicio no registrado acordado en el momento)
  if (totalSvc === 0) {
    return paidTotal > 0 ? Math.round(paidTotal) : 0
  }
  
  const comiSvc = services.filter(sv => !sv?.excluidoComision).reduce((s, sv) => s + (sv?.price || 0), 0)
  const ratio = paidTotal / totalSvc
  return Math.round(comiSvc * ratio)
}

export const apptComisionTotal = (a, globalComisionPct, activeServices = [], dateExceptions = {}, apptDate = null, professionals = []) => {
  if (a?.isBlocked) return 0
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

  const ratio = paidTotal / totalSvc

  return services.reduce((sum, sv) => {
    const liveSvc = Array.isArray(activeServices) ? activeServices.find(s => s.id === sv.id) : null
    const isExcluido = liveSvc ? !!liveSvc.excluidoComision : !!sv.excluidoComision
    if (isExcluido) return sum

    const comisionableAmt = sv.price * ratio
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
