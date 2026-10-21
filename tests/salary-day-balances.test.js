import test from 'node:test'
import assert from 'node:assert/strict'
import { salaryDayBalances } from '../src/utils/salaryDayBalances.js'
const breakdown = [{ dk: '2026-10-01', comision: 100 }, { dk: '2026-10-15', comision: 300 }, { dk: '2026-10-16', comision: 200 }]
const payment = (monto, dias, extra = {}) => ({ monto, dias, ...extra })
test('saldar primera quincena deja segunda pendiente sin alterar registros', () => {
  const record = { pagos: [payment(400, ['2026-10-01', '2026-10-15'])] }
  const before = JSON.stringify(record)
  const result = salaryDayBalances(record, '1', '2026-10', breakdown)
  assert.equal(result['2026-10-01'].status, 'paid')
  assert.equal(result['2026-10-15'].status, 'paid')
  assert.equal(result['2026-10-16'].paid, 0)
  assert.equal(JSON.stringify(record), before)
})
test('parciales proporcionales se completan y anulaciones reabren saldo', () => {
  const payments = [payment(200, ['2026-10-01', '2026-10-15'])]
  let result = salaryDayBalances({ pagos: payments }, '1', '2026-10', breakdown)
  assert.equal(result['2026-10-01'].paid, 50)
  assert.equal(result['2026-10-15'].paid, 150)
  assert.equal(result['2026-10-15'].status, 'partial')
  payments.push(payment(200, ['2026-10-01', '2026-10-15']))
  result = salaryDayBalances({ pagos: payments }, '1', '2026-10', breakdown)
  assert.equal(result['2026-10-15'].status, 'paid')
  payments[1].anulado = true
  result = salaryDayBalances({ pagos: payments }, '1', '2026-10', breakdown)
  assert.equal(result['2026-10-15'].status, 'partial')
})
test('conserva centavos en mes completo y reconoce pagos anteriores', () => {
  const result = salaryDayBalances({ pagado: true, monto: 600 }, '1', '2026-10', breakdown)
  assert.ok(Object.values(result).every(day => day.status === 'paid'))
  const partial = salaryDayBalances({ pagos: [payment(.01, 'all')] }, '1', '2026-10', breakdown)
  assert.equal(Object.values(partial).reduce((sum, day) => sum + day.paid, 0), .01)
})
