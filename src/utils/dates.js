export const DIAS_ES  = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"]
export const MESES_ES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"]

/** Date → "YYYY-MM-DD" (local time) */
export const toDateKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`

/** Today as "YYYY-MM-DD" */
export const todayKey = () => toDateKey(new Date())

/** True if Mon–Sat */
export const isWorkDay = (d) => { const day = d.getDay(); return day >= 1 && day <= 6 }

/** Advance by +1 or -1 working day */
export const nextWorkDay = (dateKey, delta) => {
  const d = new Date(dateKey + "T12:00:00")
  do { d.setDate(d.getDate() + delta) } while (!isWorkDay(d))
  return toDateKey(d)
}

/** "Lunes 7 de enero" */
export const fmtDate = (dateKey) => {
  const d = new Date(dateKey + "T12:00:00")
  return `${DIAS_ES[d.getDay()]} ${d.getDate()} de ${MESES_ES[d.getMonth()]}`
}

/** "Lun 7/1" */
export const fmtShort = (dateKey) => {
  const d = new Date(dateKey + "T12:00:00")
  return `${DIAS_ES[d.getDay()].slice(0,3)} ${d.getDate()}/${d.getMonth()+1}`
}

/** Returns array of 6 dateKeys Mon–Sat for the week containing dateKey */
export const getWeekDays = (dateKey) => {
  const d = new Date(dateKey + "T12:00:00")
  const day = d.getDay()
  const diffToMon = day === 0 ? -6 : 1 - day
  const mon = new Date(d); mon.setDate(d.getDate() + diffToMon)
  const days = []
  for (let i = 0; i < 6; i++) {
    const dd = new Date(mon); dd.setDate(mon.getDate() + i)
    days.push(toDateKey(dd))
  }
  return days
}

/** Advance by +N or -N months */
export const addMonths = (dateKey, delta) => {
  const parts = dateKey.split("-").map(Number)
  const d = new Date(parts[0], parts[1] - 1 + delta, parts[2])
  const expectedMonth = (parts[1] - 1 + delta + 1200) % 12
  while (d.getMonth() !== expectedMonth) {
    d.setDate(d.getDate() - 1)
  }
  if (d.getDay() === 0) {
    d.setDate(d.getDate() + 1)
  }
  return toDateKey(d)
}

