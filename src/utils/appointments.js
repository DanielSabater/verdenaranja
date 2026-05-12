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
