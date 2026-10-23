import test from 'node:test'
import assert from 'node:assert/strict'
import { calendarMonthDays, shiftCalendarMonth } from '../src/utils/calendar.js'

test('navegación mensual conserva meses y cruza correctamente el año', () => {
  assert.equal(shiftCalendarMonth('2026-01', -1), '2025-12')
  assert.equal(shiftCalendarMonth('2026-12', 1), '2027-01')
  assert.equal(shiftCalendarMonth('2026-10', -1), '2026-09')
  assert.equal(shiftCalendarMonth('2026-10', 1), '2026-11')
})

test('octubre se presenta de lunes a domingo sin perder ninguno de sus 31 días', () => {
  const cells = calendarMonthDays('2026-10')
  assert.equal(cells.length, 35)
  assert.deepEqual(cells.slice(0,3), [null,null,null])
  assert.equal(cells[3].key, '2026-10-01')
  assert.equal(cells.filter(Boolean).length, 31)
  assert.equal(cells.filter(Boolean).at(-1).key, '2026-10-31')
  cells.forEach((date,i) => { if (date) assert.equal(date.sunday, i % 7 === 6) })
})

test('meses de seis semanas incluyen todos los días y domingos', () => {
  const cells = calendarMonthDays('2026-11')
  assert.equal(cells.length, 42)
  assert.equal(cells[6].key, '2026-11-01')
  assert.equal(cells[35].key, '2026-11-30')
  assert.equal(cells.filter(Boolean).length, 30)
})

test('febrero respeta los años bisiestos', () => {
  assert.equal(calendarMonthDays('2024-02').filter(Boolean).length, 29)
  assert.equal(calendarMonthDays('2026-02').filter(Boolean).length, 28)
})
