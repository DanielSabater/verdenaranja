import { apptPaidTotal, apptComisionTotal } from './appointments.js'
import { aggregateBillingComparison } from './billingComparison.js'

const same = (a, b) => a?.length === b.length && a.every((value, i) => Object.is(value, b[i]))
const mapFields = ['incomeByProf', 'comisionByProf', 'incomeByMethod', 'turnsByProf', 'incomeByService', 'countByService', 'incomeByDOW']
const emptyTotals = () => ({ totalIncome: 0, totalTurns: 0, ...Object.fromEntries(mapFields.map(key => [key, {}])) })
const cloneTotals = value => ({ ...value, ...Object.fromEntries(mapFields.map(key => [key, { ...value[key] }])) })

export function summarizeAccountingDay(date, day, { professionals, services, comisionPct, dateExceptions }) {
  const result = emptyTotals()
  const dow = new Date(`${date}T12:00:00`).getDay()
  for (const appt of Object.values(day || {})) {
    if (!appt?.paid) continue
    const amount = apptPaidTotal(appt)
    const commission = apptComisionTotal(appt, comisionPct, services, dateExceptions || {}, date, professionals)
    result.totalIncome += amount
    result.totalTurns++
    const add = (field, key, value) => { result[field][key] = (result[field][key] || 0) + value }
    add('incomeByProf', appt.profId, amount)
    add('comisionByProf', appt.profId, commission)
    add('turnsByProf', appt.profId, 1)
    add('incomeByDOW', dow, amount)
    for (const service of appt.services || []) {
      add('incomeByService', service.name, parseFloat(service.price) || 0)
      add('countByService', service.name, 1)
    }
    if (appt.paymentSplits?.length) {
      for (const split of appt.paymentSplits) add('incomeByMethod', split.methodId, parseFloat(split.amount) || 0)
    } else if (appt.payMethod) add('incomeByMethod', appt.payMethod, amount)
  }
  return result
}

// Conserva un resumen por día y un acumulador para el último rango consultado.
export function createIncrementalAccountingIndex(summarize = summarizeAccountingDay) {
  let days = new Map(), dependencies, range, totals, uses
  const inside = date => range && date >= range[0] && date <= range[1]
  const apply = (summary, sign) => {
    totals.totalIncome += sign * summary.totalIncome
    totals.totalTurns += sign * summary.totalTurns
    for (const field of mapFields) for (const [key, value] of Object.entries(summary[field])) {
      uses[field][key] = (uses[field][key] || 0) + sign
      if (!uses[field][key]) { delete totals[field][key]; delete uses[field][key] }
      else totals[field][key] = (totals[field][key] || 0) + sign * value
    }
  }
  return {
    update(allData, rules) {
      const nextDependencies = [rules.professionals, rules.services, rules.comisionPct, rules.dateExceptions]
      const globalChange = !same(dependencies, nextDependencies)
      dependencies = nextDependencies
      let changed = false
      const changes = []
      for (const [date, source] of Object.entries(allData)) {
        const previous = days.get(date)
        if (!globalChange && previous?.source === source) continue
        const summary = summarize(date, source, rules)
        changes.push([date, previous?.summary, summary])
        days.set(date, { source, summary })
        changed = true
      }
      for (const [date, previous] of days) if (!Object.hasOwn(allData, date)) {
        changes.push([date, previous.summary, null]); days.delete(date); changed = true
      }
      if (changed && totals) {
        totals = cloneTotals(totals)
        for (const [date, before, after] of changes) if (inside(date)) {
          if (before) apply(before, -1)
          if (after) apply(after, 1)
        }
      }
      return this
    },
    totals(from, to, professionals) {
      if (!range || range[0] !== from || range[1] !== to) {
        range = [from, to]; totals = emptyTotals(); uses = Object.fromEntries(mapFields.map(key => [key, {}]))
        for (const [date, entry] of days) if (inside(date)) apply(entry.summary, 1)
      }
      // Los ceros de profesionales y días de semana siguen presentes como antes.
      const result = cloneTotals(totals)
      for (const prof of professionals) for (const field of ['incomeByProf', 'comisionByProf', 'turnsByProf']) result[field][prof.id] ??= 0
      for (let day = 0; day < 7; day++) result.incomeByDOW[day] ??= 0
      return result
    },
    days() { return new Map([...days].map(([date, entry]) => [date, entry.summary])) },
  }
}

const indexes = new WeakMap()
export function incrementalAccountingIndex(allData, rules, from, to) {
  let index = indexes.get(rules.professionals)
  if (!index) { index = createIncrementalAccountingIndex(); indexes.set(rules.professionals, index) }
  index.update(allData, rules)
  // Entregar una fotografía inmutable del render, no el acumulador que cambiará después.
  const totals = index.totals(from, to, rules.professionals)
  const days = index.days()
  return { totals, days: () => new Map(days) }
}

const arrayFields = ['income', 'expenses', 'commissions']
const scalarFields = ['fixedExpenses', 'expensesWithoutTime']

// Actualiza las barras y líneas por diferencias de contribuciones diarias.
export function createIncrementalBillingComparison() {
  let dependencies, entries = new Map(), accumulated, dateYears
  return (options, globalDependencies) => {
    const { allData = {}, gastos = [], years, period } = options
    const dates = [...new Set([...Object.keys(allData), ...gastos.map(g => g.fecha).filter(Boolean)])]
    const nextYears = period === 'todo' ? [...new Set(dates.map(date => date.slice(0, 4)))].sort().join(',') : ''
    const nextDependencies = [options.period, options.from, options.to, ...years, ...globalDependencies]
    const reset = !same(dependencies, nextDependencies) || dateYears !== nextYears
    dependencies = nextDependencies; dateYears = nextYears
    const templateOptions = { ...options, allData: {}, gastos: [], comparisonDates: dates, keepUntimedBucket: true }
    if (reset) { entries = new Map(); accumulated = aggregateBillingComparison(templateOptions) }
    const expenseDays = new Map()
    for (const expense of gastos) if (expense.fecha) {
      if (!expenseDays.has(expense.fecha)) expenseDays.set(expense.fecha, [])
      expenseDays.get(expense.fecha).push(expense)
    }
    // Nunca se modifica un resultado ya entregado a React.
    const next = { ...accumulated }
    for (const field of arrayFields) next[field] = Object.fromEntries(Object.entries(accumulated[field]).map(([year, values]) => [year, [...values]]))
    for (const field of scalarFields) next[field] = { ...accumulated[field] }
    const apply = (value, sign) => {
      for (const field of arrayFields) for (const year of new Set(years)) value[field][year].forEach((amount, i) => { next[field][year][i] += sign * amount })
      for (const field of scalarFields) for (const year of new Set(years)) next[field][year] += sign * value[field][year]
    }
    const activeDates = new Set(dates)
    for (const [date, previous] of entries) if (!activeDates.has(date)) { apply(previous.value, -1); entries.delete(date) }
    for (const date of dates) {
      const day = allData[date], expenses = expenseDays.get(date) || [], previous = entries.get(date)
      if (previous && previous.day === day && same(previous.expenses, expenses)) continue
      const value = aggregateBillingComparison({ ...templateOptions, allData: day ? { [date]: day } : {}, gastos: expenses })
      if (previous) apply(previous.value, -1)
      apply(value, 1)
      entries.set(date, { day, expenses, value })
    }
    for (const field of ['monthlySummaries', 'incomeAvailable']) next[field] = {}
    for (const year of new Set(years)) {
      next.monthlySummaries[year] = [...entries.values()].flatMap(entry => entry.value.monthlySummaries[year])
      next.incomeAvailable[year] = next.buckets.map((_, i) => [...entries.values()].every(entry => entry.value.incomeAvailable[year][i]))
    }
    accumulated = next
    if (next.unit !== 'hora' || ![...new Set(years)].every(year => next.income[year].at(-1) === 0 && next.commissions[year].at(-1) === 0)) return next
    const trimmed = { ...next, buckets: next.buckets.slice(0, -1) }
    for (const field of [...arrayFields, 'incomeAvailable']) trimmed[field] = Object.fromEntries(Object.entries(next[field]).map(([year, values]) => [year, values.slice(0, -1)]))
    return trimmed
  }
}
const comparisons = new WeakMap()
export function incrementalBillingComparison(scope, options, dependencies) {
  let calculate = comparisons.get(scope)
  if (!calculate) { calculate = createIncrementalBillingComparison(); comparisons.set(scope, calculate) }
  return calculate(options, dependencies)
}

const details = new WeakMap()
export function incrementalDayDetail(scope, date, day, expenses, dependencies, calculate) {
  let entries = details.get(scope)
  if (!entries) { entries = new Map(); details.set(scope, entries) }
  const previous = entries.get(date)
  if (previous && previous.day === day && same(previous.expenses, expenses) && same(previous.dependencies, dependencies)) return previous.value
  const value = calculate()
  entries.set(date, { day, expenses, dependencies: [...dependencies], value })
  return value
}
