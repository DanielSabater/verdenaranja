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
  const duration = `${hours}:${String(rest).padStart(2, '0')}`
  return {
    label: difference > 0 ? `⏳ ${duration}` : difference < 0 ? `⏰ +${duration}` : '⏰ Ahora',
    description: difference > 0 ? `Faltan ${minutes} minutos para el turno` : difference < 0 ? `Pasaron ${minutes} minutos desde la hora del turno` : 'Es la hora del turno',
  }
}
// El siguiente reloj saltea los turnos que ya llegaron, aunque sigan sin pagar.
export function nextAwaitingAppointment(appointments, profId) {
  return Object.values(appointments).filter(appt => appt && appt.profId === profId
    && !appt.paid && !appt.arrived && !appt.isNote && !appt.isBlocked && !appt.isUnblockOverride)
    .sort((a, b) => (a.hour || '').localeCompare(b.hour || ''))[0] || null
}

// Sólo el turno inmediatamente anterior de la misma profesional determina la ubicación.
export function previousAppointmentAttended(appointments, appt) {
  const previous = Object.values(appointments).filter(item => item && item.profId === appt.profId
    && !item.isNote && !item.isBlocked && !item.isUnblockOverride && item.hour < appt.hour)
    .sort((a, b) => b.hour.localeCompare(a.hour))[0]
  return Boolean(previous && (previous.arrived || previous.paid))
}
