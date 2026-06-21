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
  const comiSvc = services.filter(sv => !sv?.excluidoComision).reduce((s, sv) => s + (sv?.price || 0), 0)
  if (totalSvc === 0) return 0
  
  const paidTotal = apptPaidTotal(a)
  const ratio = paidTotal / totalSvc
  return Math.round(comiSvc * ratio)
}

export const apptComisionTotal = (a, globalComisionPct, activeServices = [], dateExceptions = {}, apptDate = null) => {
  if (a?.isBlocked) return 0
  const services = Array.isArray(a?.services) ? a.services : []
  const totalSvc = services.reduce((s, sv) => s + (sv?.price || 0), 0)
  if (totalSvc === 0) return 0

  const paidTotal = apptPaidTotal(a)
  const ratio = paidTotal / totalSvc

  // Check if there is a commission exception for this date
  let comisionPctToUse = globalComisionPct
  if (apptDate && dateExceptions && typeof dateExceptions === "object" && dateExceptions[apptDate] !== undefined) {
    comisionPctToUse = parseFloat(dateExceptions[apptDate])
  }

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


