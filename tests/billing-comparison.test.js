import test from 'node:test'
import assert from 'node:assert/strict'
import { buildComparisonBuckets, aggregateBillingComparison } from '../src/utils/billingComparison.js'
const paid = (amount, hour) => ({ paid: true, hour, services: [{ price: amount }], paymentSplits: [{ amount }] })
const aggregate = (period, from, to, extra = {}) => aggregateBillingComparison({ period, from, to, years: [2026, 2025], ...extra })
const sum = values => values.reduce((a, b) => a + b, 0)

test('Hoy distribuye por hora, separa los gastos sin hora y excluye otros días y pendientes', () => {
  const result = aggregate('dia', '2026-10-19', '2026-10-19', {
    allData: { '2026-10-19': { a: paid(100, '09:30'), 'p||10:00': paid(200), b: paid(50), c: { ...paid(500, '09:00'), paid: false } }, '2026-10-20': { a: paid(800, '09:00') } },
    gastos: [{ fecha: '2026-10-19', monto: 30 }], commissionFor: a => a.services[0].price * 0.4,
  })
  assert.equal(result.unit, 'hora')
  assert.equal(result.buckets.length, 25)
  assert.equal(result.income[2026][9], 100)
  assert.equal(result.income[2026][10], 200)
  assert.equal(result.income[2026][24], 50)
  assert.equal(result.expenses[2026][24], 0)
  assert.equal(result.expensesWithoutTime[2026], 30)
  assert.equal(sum(result.income[2026]), 350)
  assert.equal(sum(result.commissions[2026]), 140)
})

test('Semana muestra solamente los días del rango en los dos años elegidos', () => {
  const result = aggregate('semana', '2026-10-12', '2026-10-17', { allData: {
    '2026-10-12': { a: paid(100) }, '2026-10-18': { a: paid(900) },
    '2025-10-12': { a: paid(70) }, '2025-09-12': { a: paid(500) },
  } })
  assert.equal(result.buckets.length, 6)
  assert.deepEqual(result.buckets.map(b => b.label), ['12/10', '13/10', '14/10', '15/10', '16/10', '17/10'])
  assert.equal(sum(result.income[2026]), 100)
  assert.equal(sum(result.income[2025]), 70)
})

test('Mes usa cada día real, incluidos los años bisiestos', () => {
  assert.equal(buildComparisonBuckets('mes', '2024-02-01', '2024-02-29').buckets.length, 29)
  assert.equal(buildComparisonBuckets('mes', '2025-02-01', '2025-02-28').buckets.length, 28)
  const result = aggregate('mes', '2026-10-01', '2026-10-31', { allData: { '2026-10-31': { a: paid(300) }, '2026-09-30': { a: paid(700) } } })
  assert.equal(result.buckets.length, 31)
  assert.equal(result.income[2026][30], 300)
  assert.equal(sum(result.income[2026]), 300)
})

test('Anual agrupa en doce meses y conserva la conversión del mes de cada registro', () => {
  const result = aggregate('anual', '2026-01-01', '2026-12-31', { allData: {
    '2026-01-05': { a: paid(100) }, '2026-02-05': { a: paid(200) }, '2025-12-01': { a: paid(50) },
  }, convertAmount: (value, date) => value / Number(date.slice(5, 7)) })
  assert.equal(result.buckets.length, 12)
  assert.equal(result.income[2026][0], 100)
  assert.equal(result.income[2026][1], 100)
  assert.equal(result.income[2025][11], 50 / 12)
})

test('Los rangos cruzados de año respetan los límites de cada comparación', () => {
  const result = aggregate('custom', '2026-12-30', '2027-01-02', { allData: {
    '2026-12-30': { a: paid(100) }, '2027-01-02': { a: paid(200) }, '2027-01-03': { a: paid(900) }, '2025-12-30': { a: paid(70) },
  } })
  assert.equal(result.buckets.length, 4)
  assert.equal(sum(result.income[2026]), 300)
  assert.equal(sum(result.income[2025]), 70)
  const longRange = aggregate('custom', '2026-02-15', '2026-05-10', { allData: { '2026-02-01': { a: paid(500) }, '2026-02-20': { a: paid(100) } } })
  assert.equal(longRange.unit, 'mes')
  assert.equal(sum(longRange.income[2026]), 100)
})

test('Historial agrupa por año real sin truncar años ni duplicar series', () => {
  const result = aggregate('todo', '2000-01-01', '2099-12-31', { allData: { '2020-01-01': { a: paid(100) }, '2026-10-01': { a: paid(300) } }, gastos: [{ fecha: '2024-01-01', monto: 50 }] })
  assert.equal(result.unit, 'año')
  assert.deepEqual(result.buckets.map(b => b.label), ['2020', '2024', '2026'])
  assert.deepEqual(result.income[2026], [100, 0, 300])
  assert.deepEqual(result.expenses[2026], [0, 50, 0])
})

test('Un rango inválido no genera puntos ni valores fuera del período', () => {
  const result = aggregate('custom', '2026-10-20', '2026-10-01')
  assert.equal(result.buckets.length, 0)
  assert.deepEqual(result.income[2026], [])
})

test('Los meses futuros quedan pendientes, sin dibujar una caída a cero', async () => {
  const { comparisonBucketAvailable } = await import('../src/utils/billingComparison.js')
  const spec = buildComparisonBuckets('anual', '2026-01-01', '2026-12-31')
  assert.equal(comparisonBucketAvailable(spec, 9, 2026, 'anual', '2026-10-17'), true)
  assert.equal(comparisonBucketAvailable(spec, 10, 2026, 'anual', '2026-10-17'), false)
  assert.equal(comparisonBucketAvailable(spec, 11, 2025, 'anual', '2026-10-17'), true)
})

test('Los gastos fijos mensuales se muestran aparte en vistas diarias, conservando el total', () => {
  const gastos = [{ fecha: '2026-10-01', monto: 8000, isFixed: true }, { fecha: '2026-10-01', monto: 70 }, { fecha: '2026-10-05', monto: 30 }, { fecha: '2026-09-01', monto: 9000, isFixed: true }]
  const month = aggregate('mes', '2026-10-01', '2026-10-31', { gastos })
  assert.equal(month.fixedExpenses[2026], 8000)
  assert.equal(month.expenses[2026][0], 70)
  assert.equal(sum(month.expenses[2026]), 100)
  assert.equal(sum(month.expenses[2026]) + month.fixedExpenses[2026], 8100)
  const annual = aggregate('anual', '2026-01-01', '2026-12-31', { gastos })
  assert.equal(annual.fixedExpenses[2026], 0)
  assert.equal(annual.expenses[2026][9], 8100)
  const day = aggregate('dia', '2026-10-01', '2026-10-01', { gastos })
  assert.equal(day.fixedExpenses[2026], 8000)
  assert.equal(sum(day.expenses[2026]), 0)
  assert.equal(day.expensesWithoutTime[2026], 70)
})

const monthlySummary = amount => ({ paid: true, payMethod: 'efectivo', services: [{ name: 'Total Facturación Mensual', price: amount, excluidoComision: true }] })

test('El resumen importado de 2025 no se presenta como facturación del día 1', () => {
  const allData = { '2025-10-01': { historico_2025: monthlySummary(19808700) }, '2026-10-01': { a: paid(1251000, '09:00') } }
  const original = JSON.stringify(allData)
  const result = aggregate('mes', '2026-10-01', '2026-10-31', { allData })
  assert.equal(result.income[2026][0], 1251000)
  assert.equal(sum(result.income[2025]), 0)
  assert.deepEqual(result.monthlySummaries[2025], [{ month: '2025-10', amount: 19808700 }])
  assert.equal(result.incomeAvailable[2025].every(available => !available), true)
  assert.equal(result.incomeAvailable[2026].every(Boolean), true)
  assert.equal(JSON.stringify(allData), original)
})

test('El histórico mensual sigue contando en Anual y Todo, sin duplicarlo', () => {
  const allData = { '2025-10-01': { historico_2025: monthlySummary(19808700) } }
  const annual = aggregate('anual', '2026-01-01', '2026-12-31', { allData })
  assert.equal(annual.income[2025][9], 19808700)
  assert.equal(sum(annual.income[2025]), 19808700)
  assert.deepEqual(annual.monthlySummaries[2025], [])
  const history = aggregate('todo', '2000-01-01', '2099-12-31', { allData })
  assert.equal(sum(history.income[2026]), 19808700)
})

test('Semana y Hoy avisan que existe total mensual aunque el rango no incluya el día 1', () => {
  const allData = { '2025-10-01': { historico_2025: monthlySummary(19808700) } }
  const week = aggregate('semana', '2026-10-12', '2026-10-17', { allData })
  assert.equal(week.monthlySummaries[2025][0].amount, 19808700)
  assert.equal(week.incomeAvailable[2025].every(available => !available), true)
  const day = aggregate('dia', '2026-10-17', '2026-10-17', { allData })
  assert.equal(day.monthlySummaries[2025][0].amount, 19808700)
  assert.equal(day.incomeAvailable[2025].every(available => !available), true)
})

test('Un importe grande real no se clasifica como resumen mensual por su tamaño', () => {
  const allData = { '2025-10-01': { real: paid(19808700, '09:00'), otra: monthlySummary(300) } }
  const result = aggregate('mes', '2026-10-01', '2026-10-31', { allData })
  assert.equal(result.income[2025][0], 19809000)
  assert.deepEqual(result.monthlySummaries[2025], [])
})

test('Los rangos parciales no atribuyen un total mensual completo a parte del mes', () => {
  const allData = { '2025-10-01': { historico_2025: monthlySummary(1000) }, '2025-11-01': { historico_2025: monthlySummary(2000) }, '2025-12-01': { historico_2025: monthlySummary(3000) } }
  const result = aggregate('custom', '2026-10-15', '2027-01-20', { allData })
  assert.equal(result.unit, 'mes')
  assert.deepEqual(result.monthlySummaries[2025], [{ month: '2025-10', amount: 1000 }])
  assert.equal(sum(result.income[2025]), 5000)
  assert.equal(result.incomeAvailable[2025][0], false)
  assert.equal(result.incomeAvailable[2025][1], true)
})

test('Solo el mes actual queda en curso; el mes cerrado ya se puede unir a la línea', async () => {
  const { comparisonBucketInProgress } = await import('../src/utils/billingComparison.js')
  const spec = buildComparisonBuckets('anual', '2026-01-01', '2026-12-31')
  const october = new Date(2026, 9, 17, 14, 30)
  assert.equal(comparisonBucketInProgress(spec, 8, 2026, october), false)
  assert.equal(comparisonBucketInProgress(spec, 9, 2026, october), true)
  assert.equal(comparisonBucketInProgress(spec, 9, 2025, october), false)
  assert.equal(comparisonBucketInProgress(spec, 10, 2026, october), false)
  assert.equal(comparisonBucketInProgress(spec, 9, 2026, new Date(2026, 10, 1, 0)), false)
})

test('Semana y Mes marcan el día actual; Hoy marca la hora actual y oculta las futuras', async () => {
  const { comparisonBucketInProgress, comparisonBucketAvailable } = await import('../src/utils/billingComparison.js')
  const now = new Date(2026, 9, 17, 14, 30)
  const week = buildComparisonBuckets('semana', '2026-10-12', '2026-10-17')
  assert.equal(comparisonBucketInProgress(week, 5, 2026, now), true)
  assert.equal(comparisonBucketInProgress(week, 4, 2026, now), false)
  const month = buildComparisonBuckets('mes', '2026-10-01', '2026-10-31')
  assert.equal(comparisonBucketInProgress(month, 16, 2026, now), true)
  assert.equal(comparisonBucketInProgress(month, 17, 2026, now), false)
  const day = buildComparisonBuckets('dia', '2026-10-17', '2026-10-17')
  assert.equal(comparisonBucketInProgress(day, 14, 2026, now), true)
  assert.equal(comparisonBucketInProgress(day, 13, 2026, now), false)
  assert.equal(comparisonBucketInProgress(day, 24, 2026, now), false)
  assert.equal(comparisonBucketAvailable(day, 14, 2026, 'dia', '2026-10-17', now), true)
  assert.equal(comparisonBucketAvailable(day, 15, 2026, 'dia', '2026-10-17', now), false)
  assert.equal(comparisonBucketAvailable(day, 24, 2026, 'dia', '2026-10-17', now), true)
})

test('Se identifica el año en curso en el historial sin marcar años cerrados', async () => {
  const { comparisonBucketInProgress } = await import('../src/utils/billingComparison.js')
  const spec = buildComparisonBuckets('todo', '', '', ['2025-01-01', '2026-01-01'])
  const now = new Date(2026, 9, 17)
  assert.equal(comparisonBucketInProgress(spec, 0, 2026, now), false)
  assert.equal(comparisonBucketInProgress(spec, 1, 2026, now), true)
})

test('Hoy conserva gastos sin horario en el total, sin una barra al final ni una columna vacía', () => {
  const result = aggregate('dia', '2026-10-17', '2026-10-17', { allData: { '2026-10-17': { a: paid(1000, '09:30') } }, gastos: [{ fecha: '2026-10-17', monto: 160000 }, { fecha: '2026-10-16', monto: 999 }] })
  assert.equal(result.expensesWithoutTime[2026], 160000)
  assert.equal(sum(result.expenses[2026]), 0)
  assert.equal(result.buckets.length, 24)
  assert.equal(result.buckets.some(bucket => bucket.label === 'Sin hora'), false)
  assert.equal(sum(result.income[2026]), 1000)
  assert.equal(sum(result.expenses[2026]) + result.fixedExpenses[2026] + result.expensesWithoutTime[2026], 160000)
})
