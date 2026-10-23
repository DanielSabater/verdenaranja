import { toDateKey } from './dates.js'

export function shiftCalendarMonth(monthKey, delta) {
  const [year, month] = monthKey.split('-').map(Number)
  return toDateKey(new Date(year, month - 1 + delta, 1, 12)).slice(0, 7)
}

// Semanas de lunes a domingo, con casilleros vacíos al comienzo y al final.
export function calendarMonthDays(monthKey) {
  const [year, month] = monthKey.split('-').map(Number)
  const leading = (new Date(year, month - 1, 1, 12).getDay() + 6) % 7
  const count = new Date(year, month, 0, 12).getDate()
  const days = Array(leading).fill(null)
  for (let day = 1; day <= count; day++) {
    const date = new Date(year, month - 1, day, 12)
    days.push({ key: toDateKey(date), day, sunday: date.getDay() === 0 })
  }
  while (days.length % 7) days.push(null)
  return days
}
