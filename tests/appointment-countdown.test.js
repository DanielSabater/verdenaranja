import test from 'node:test'
import assert from 'node:assert/strict'
import { appointmentCountdown } from '../src/utils/appointmentCountdown.js'

const options = { isToday: true, isNext: true, now: new Date(2026, 9, 26, 10, 0) }
test('muestra tiempo restante, horario exacto y tiempo transcurrido sin límite de tres horas', () => {
  assert.equal(appointmentCountdown({ hour: '10:30' }, options).label, '⏳ 30m')
  assert.equal(appointmentCountdown({ hour: '12:00' }, options).label, '⏳ 2h')
  assert.equal(appointmentCountdown({ hour: '10:00' }, options).label, '⏰ Ahora')
  assert.equal(appointmentCountdown({ hour: '09:00' }, options).label, '⏰ +1h')
  assert.equal(appointmentCountdown({ hour: '06:30' }, options).label, '⏰ +3h30m')
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
