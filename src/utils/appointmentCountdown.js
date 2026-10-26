// El reloj sigue la hora programada y no altera los estados de llegada o pago.
export function appointmentCountdown(appt, { isToday, isNext, now = new Date() }) {
  if (!isToday || !isNext || !appt || appt.paid || appt.arrived || appt.isNote || appt.isBlocked || appt.isUnblockOverride) return null
  const match = /^(\d{2}):(\d{2})$/.exec(appt.hour || '')
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) return null
  const difference = hour * 60 + minute - (now.getHours() * 60 + now.getMinutes())
  const minutes = Math.abs(difference)
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  const duration = hours ? `${hours}h${rest ? `${rest}m` : ''}` : `${minutes}m`
  return {
    label: difference > 0 ? `⏳ ${duration}` : difference < 0 ? `⏰ +${duration}` : '⏰ Ahora',
    description: difference > 0 ? `Faltan ${minutes} minutos para el turno` : difference < 0 ? `Pasaron ${minutes} minutos desde la hora del turno` : 'Es la hora del turno',
  }
}
