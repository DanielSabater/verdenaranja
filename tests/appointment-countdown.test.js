import test from 'node:test'
import assert from 'node:assert/strict'
import { appointmentCountdown, nextAwaitingAppointment } from '../src/utils/appointmentCountdown.js'

const options = { isToday: true, isNext: true, now: new Date(2026, 9, 26, 10, 0) }
test('el siguiente reloj avanza al marcar llegada sin esperar el pago y vuelve al desmarcarla', () => {
  const appointments = {
    next: { profId: 1, hour: '10:30' },
    current: { profId: 1, hour: '10:00', arrived: true },
    paid: { profId: 1, hour: '09:00', paid: true },
    note: { profId: 1, hour: '09:30', isNote: true },
    blocked: { profId: 1, hour: '09:15', isBlocked: true },
    other: { profId: 2, hour: '09:00' },
  }
  assert.equal(nextAwaitingAppointment(appointments, 1), appointments.next)
  assert.equal(nextAwaitingAppointment(appointments, 2), appointments.other)
  assert.equal(nextAwaitingAppointment(appointments, 3), null)
  appointments.current.arrived = false
  assert.equal(nextAwaitingAppointment(appointments, 1), appointments.current)
  appointments.current.arrived = true
  appointments.next.arrived = true
  assert.equal(nextAwaitingAppointment(appointments, 1), null)
})
test('muestra tiempo restante, horario exacto y tiempo transcurrido sin límite de tres horas', () => {
  assert.equal(appointmentCountdown({ hour: '10:30' }, options).label, '⏳ 0:30')
  assert.equal(appointmentCountdown({ hour: '11:32' }, options).label, '⏳ 1:32')
  assert.equal(appointmentCountdown({ hour: '10:08' }, options).label, '⏳ 0:08')
  assert.equal(appointmentCountdown({ hour: '12:00' }, options).label, '⏳ 2:00')
  assert.equal(appointmentCountdown({ hour: '10:00' }, options).label, '⏰ Ahora')
  assert.equal(appointmentCountdown({ hour: '09:00' }, options).label, '⏰ +1:00')
  assert.equal(appointmentCountdown({ hour: '09:52' }, options).label, '⏰ +0:08')
  assert.equal(appointmentCountdown({ hour: '06:30' }, options).label, '⏰ +3:30')
})
test('el reloj sólo corresponde al próximo turno sin cobrar de hoy', () => {
  for (const flag of ['paid', 'arrived', 'isNote', 'isBlocked', 'isUnblockOverride']) {
    assert.equal(appointmentCountdown({ hour: '10:30', [flag]: true }, options), null)
  }
  assert.equal(appointmentCountdown({ hour: '10:30' }, { ...options, isNext: false }), null)
  assert.equal(appointmentCountdown({ hour: '10:30' }, { ...options, isToday: false }), null)
  assert.equal(appointmentCountdown({ hour: '25:00' }, options), null)
})
test('al marcar llegada deja de mostrar el reloj sin alterar el turno', () => {
  const appt = { hour: '09:00', arrived: true }
  assert.equal(appointmentCountdown(appt, options), null)
  assert.deepEqual(appt, { hour: '09:00', arrived: true })
})
