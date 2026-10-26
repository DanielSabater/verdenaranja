import test from 'node:test'
import assert from 'node:assert/strict'
import { arrivalControlDisplay } from '../src/utils/arrivalControlDisplay.js'

test('el recorrido de reloj, llegada, monto y cobro avanza siempre en orden', () => {
  const base = { mode: 'appointment', amount: '$30.000', countdown: { label: '⏳ 15m' } }
  const faces = [
    arrivalControlDisplay(base),
    arrivalControlDisplay({ ...base, active: true }),
    arrivalControlDisplay({ ...base, countdown: null, arrived: true, active: true, showAmountAfterArrival: true }),
    arrivalControlDisplay({ ...base, countdown: null, arrived: true, active: true }),
    arrivalControlDisplay({ ...base, countdown: null, arrived: true, mode: 'paid' }),
  ]
  assert.deepEqual(faces.map(face => face.step), [0, 1, 2, 3, 4])
  assert.deepEqual(faces.map(face => face.text), ['⏳ 15m', '¿Llegó?', '$30.000', 'Cobrar', '$30.000'])
})
test('desmarcar pago y llegada retrocede y salir del botón vuelve a la cara anterior', () => {
  const base = { mode: 'appointment', amount: '$30.000' }
  const faces = [
    arrivalControlDisplay({ ...base, arrived: true, mode: 'paid' }),
    arrivalControlDisplay({ ...base, arrived: true }),
    arrivalControlDisplay(base),
  ]
  assert.deepEqual(faces.map(face => face.step), [4, 2, 0])
  assert.ok(arrivalControlDisplay({ ...base, arrived: true, active: true }).step > arrivalControlDisplay({ ...base, arrived: true }).step)
})
