import test from 'node:test'
import assert from 'node:assert/strict'
import { reuseAccountingCalculation } from '../src/utils/accountingCache.js'

test('reutiliza el resultado al volver a entrar con los mismos datos', () => {
  const data = {}, expenses = [], config = {}
  let calls = 0
  const calculate = () => { calls++; return { total: 123 } }
  const first = reuseAccountingCalculation(data, 'totals', calculate, [expenses, config, 'anual'])
  assert.equal(reuseAccountingCalculation(data, 'totals', calculate, [expenses, config, 'anual']), first)
  assert.equal(calls, 1)
})

test('invalida por cada dependencia relevante y por nuevos turnos/pagos', () => {
  const data = {}, initial = [[], {}, [], 40, 'mes', '2026-10-01', '2026-10-31', 'ARS', 1500]
  let calls = 0
  const calculate = () => ++calls
  reuseAccountingCalculation(data, 'comparison', calculate, initial)
  for (let index = 0; index < initial.length; index++) {
    const changed = [...initial]
    changed[index] = typeof initial[index] === 'object' ? {} : String(initial[index]) + 'nuevo'
    const before = calls
    reuseAccountingCalculation(data, 'comparison', calculate, changed)
    assert.equal(calls, before + 1)
    reuseAccountingCalculation(data, 'comparison', calculate, initial)
  }
  const before = calls
  reuseAccountingCalculation({}, 'comparison', calculate, initial)
  assert.equal(calls, before + 1)
})

test('aísla cálculos y conjuntos de datos sin alterar las entradas', () => {
  const a = Object.freeze({}), b = Object.freeze({}), deps = Object.freeze([1])
  assert.equal(reuseAccountingCalculation(a, 'totals', () => 10, deps), 10)
  assert.equal(reuseAccountingCalculation(a, 'daily', () => 20, deps), 20)
  assert.equal(reuseAccountingCalculation(b, 'totals', () => 30, deps), 30)
  assert.deepEqual(deps, [1])
})

test('conserva el resultado correcto tras cambiar y restaurar un filtro', () => {
  const data = {}, expenses = [10, 20]
  const total = multiplier => reuseAccountingCalculation(data, 'totals', () => expenses.reduce((a,b) => a+b, 0) * multiplier, [expenses, multiplier])
  assert.equal(total(1), 30)
  assert.equal(total(2), 60)
  assert.equal(total(1), 30)
})

test('reutiliza comisión cero, separa fechas y recalcula al cambiar turno o reglas', async () => {
  const { memoizeAppointmentCommission } = await import('../src/utils/accountingCache.js')
  const data = {}, professional = {}, services = [], exceptions = {}
  let calls = 0
  const getCalculator = (scope, deps) => reuseAccountingCalculation(scope, 'appointmentCommissions', () => memoizeAppointmentCommission((appt, date) => { calls++; return date === '2026-10-18' ? 0 : appt.price }), deps)
  const deps = [data, professional, services, 40, exceptions]
  const appt = { price: 100 }
  const calculate = getCalculator(data, deps)
  assert.equal(calculate(appt, '2026-10-18'), 0)
  assert.equal(calculate(appt, '2026-10-18'), 0)
  assert.equal(calls, 1)
  assert.equal(getCalculator(data, deps), calculate)
  assert.equal(calculate(appt, '2026-10-19'), 100)
  assert.equal(calculate({ ...appt, price: 200 }, '2026-10-19'), 200)
  assert.equal(calls, 3)
  for (let index = 0; index < deps.length; index++) {
    const changed = [...deps]; changed[index] = typeof deps[index] === 'number' ? 50 : {}
    const updated = getCalculator(data, changed)
    updated(appt, '2026-10-18')
    assert.equal(calls, 4 + index)
  }
  assert.notEqual(getCalculator({}, deps), calculate)
})
