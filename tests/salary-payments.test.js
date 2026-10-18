import test from 'node:test'
import assert from 'node:assert/strict'
import { salaryPayments, paidSalary, appendSalaryPayment } from '../src/utils/salaryPayments.js'
const payment = { id: 'p1', profesionalId: 'ana', periodo: '2026-10', monto: 30, fecha: '2026-10-18' }
test('conserva pagos anteriores y agrega parciales sin duplicar', () => {
  const old = { pagado: true, monto: '20', fecha: '2026-10-01', dias: ['2026-10-01'] }
  const next = appendSalaryPayment(old, payment, 100)
  assert.equal(paidSalary(next, 'ana', '2026-10'), 50)
  assert.equal(next.pagos[0].fecha, old.fecha)
  assert.deepEqual(next.dias, old.dias)
  assert.equal(next.pagado, false)
  assert.equal(appendSalaryPayment(next, payment, 100), next)
  assert.equal(salaryPayments(old, 'ana', '2026-10').length, 1)
})
test('rechaza importes inválidos, saldo excedido y fechas inválidas', () => {
  for (const monto of [0, -1, NaN, Infinity, 101]) assert.throws(() => appendSalaryPayment({}, { ...payment, monto }, 100))
  assert.throws(() => appendSalaryPayment({}, { ...payment, fecha: '2026-02-30' }, 100))
  assert.throws(() => appendSalaryPayment({}, { ...payment, fecha: '' }, 100))
})
test('liquida el saldo y mantiene la imputación', () => {
  const next = appendSalaryPayment({}, { ...payment, monto: 100 }, 100)
  assert.equal(next.pagado, true)
  assert.equal(next.pagos[0].periodo, '2026-10')
  assert.equal(paidSalary({}, 'ana', '2026-11'), 0)
})

test('anula sin borrar, conserva otros pagos y actualiza campos compatibles', async () => {
  const { cancelSalaryPayment } = await import('../src/utils/salaryPayments.js')
  const first = appendSalaryPayment({}, payment, 100)
  const concurrent = appendSalaryPayment(first, { ...payment, id: 'p2', monto: 70 }, 100)
  const next = cancelSalaryPayment(concurrent, 'ana', '2026-10', 'p1', '  Duplicado  ', 100, '2026-10-18T15:00:00.000Z')
  assert.equal(next.pagos.length, 2)
  assert.deepEqual(next.pagos[1], concurrent.pagos[1])
  assert.equal(next.pagos[0].monto, 30)
  assert.equal(next.pagos[0].motivoAnulacion, 'Duplicado')
  assert.equal(next.pagos[0].anuladoEn, '2026-10-18T15:00:00.000Z')
  assert.equal(paidSalary(next, 'ana', '2026-10'), 70)
  assert.equal(next.monto, 70)
  assert.equal(next.pagado, false)
  assert.equal(cancelSalaryPayment(next, 'ana', '2026-10', 'p1', 'Otra vez', 100), next)
  assert.throws(() => cancelSalaryPayment(first, 'ana', '2026-10', 'p1', ' ', 100))
})
test('anula pago anterior y solo modifica el período indicado', async () => {
  const { cancelSalaryPayment } = await import('../src/utils/salaryPayments.js')
  const old = { pagado: true, monto: '100', fecha: '2026-09-30', dias: 'all' }
  const state = { 'ana||2026-09': old, 'ana||2026-10': appendSalaryPayment({}, payment, 100) }
  const key = 'ana||2026-09'
  const next = { ...state, [key]: cancelSalaryPayment(state[key], 'ana', '2026-09', 'anterior:ana:2026-09', 'Error de carga', 100) }
  assert.equal(next['ana||2026-10'], state['ana||2026-10'])
  assert.equal(next[key].pagos[0].anterior, true)
  assert.equal(next[key].monto, 0)
  assert.equal(next[key].fecha, '')
  assert.equal(next[key].pagado, false)
  assert.equal(salaryPayments(next[key], 'ana', '2026-09').length, 1)
})
