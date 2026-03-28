/** "$1.234" format */
export const fmt = (n) => `$${Math.round(n).toLocaleString("es-AR")}`

/** Composite key: profId + hour */
export const cellKey = (profId, hour) => `${profId}||${hour}`

/** Sum of all service prices in an appointment */
export const apptTotal = (a) => Array.isArray(a?.services) ? a.services.reduce((s, sv) => s + (sv?.price || 0), 0) : 0

/** Sum of all service durations in an appointment */
export const apptDur = (a) => Array.isArray(a?.services) ? a.services.reduce((s, sv) => s + (sv?.duration || 0), 0) : 0
