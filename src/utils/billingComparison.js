import { apptPaidTotal, normServiceName } from './appointments.js'

const keyOf = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

/** Identificar el resumen mensual importado, sin inferirlo por el tamaño del importe. */
export function isMonthlyBillingSummary(cell, appt) {
  return /^historico_\d{4}$/.test(cell) && Array.isArray(appt?.services)
    && appt.services.some(service => normServiceName(service.name) === 'totalfacturacionmensual')
}

/** Unidades reales del período. Las fechas sin hora nunca se atribuyen a una hora ficticia. */
export function buildComparisonBuckets(period, from, to, dataDates = []) {
  if (period === 'todo') {
    const years = [...new Set(dataDates.filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k)).map(k => Number(k.slice(0, 4))))].sort((a, b) => a - b)
    if (!years.length) years.push(new Date().getFullYear())
    return { unit: 'año', anchorYear: years[0], buckets: years.map(year => ({ key: String(year), label: String(year), month: 0 })) }
  }
  const start = new Date(`${from}T12:00:00`)
  const end = new Date(`${to}T12:00:00`)
  if (isNaN(start) || isNaN(end) || start > end) return { unit: 'día', anchorYear: 0, buckets: [] }
  const anchorYear = start.getFullYear()
  if (period === 'dia') {
    return { unit: 'hora', anchorYear, buckets: [...Array.from({ length: 24 }, (_, hour) => ({ key: `${from}|${hour}`, label: `${String(hour).padStart(2, '0')}:00`, month: start.getMonth() })), { key: `${from}|sin-hora`, label: 'Sin hora', month: start.getMonth() }] }
  }
  const monthly = period === 'anual' || (period === 'custom' && (end - start) / 86400000 > 62)
  const cursor = monthly ? new Date(anchorYear, start.getMonth(), 1, 12) : new Date(start)
  const buckets = []
  while (cursor <= end) {
    const key = keyOf(cursor)
    buckets.push({ key: monthly ? key.slice(0, 7) : key, label: monthly ? `${months[cursor.getMonth()]}${start.getFullYear() !== end.getFullYear() ? ` ${cursor.getFullYear()}` : ''}` : `${cursor.getDate()}/${cursor.getMonth() + 1}`, month: cursor.getMonth() })
    if (monthly) cursor.setMonth(cursor.getMonth() + 1)
    else cursor.setDate(cursor.getDate() + 1)
  }
  return { unit: monthly ? 'mes' : 'día', anchorYear, buckets }
}

/** Comparar las mismas fechas en los años elegidos; el historial usa años reales. */
export function aggregateBillingComparison({ period, from, to, allData = {}, gastos = [], years, commissionFor = () => 0, convertAmount = value => value }) {
  const dates = [...Object.keys(allData), ...gastos.map(g => g.fecha).filter(Boolean)]
  const spec = buildComparisonBuckets(period, from, to, dates)
  const income = {}, expenses = {}, commissions = {}, fixedExpenses = {}, expensesWithoutTime = {}, monthlySummaries = {}, incomeAvailable = {}
  for (const year of new Set(years)) {
    const empty = () => spec.buckets.map(() => 0)
    income[year] = empty(); expenses[year] = empty(); commissions[year] = empty(); fixedExpenses[year] = 0
    expensesWithoutTime[year] = 0
    monthlySummaries[year] = []
    const summaryMonths = new Set()
    const shift = period === 'todo' ? 0 : year - spec.anchorYear
    const shiftedKey = key => {
      const [date, hour] = key.split('|')
      return `${Number(date.slice(0, 4)) + shift}${date.slice(4)}${hour === undefined ? '' : `|${hour}`}`
    }
    const index = new Map(spec.buckets.map((bucket, i) => [shiftedKey(bucket.key), i]))
    const inside = date => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
      if (period === 'todo') return true
      const normalized = `${Number(date.slice(0, 4)) - shift}${date.slice(4)}`
      return normalized >= from && normalized <= to
    }
    const bucketIndex = (date, hour) => {
      if (!inside(date)) return undefined
      if (spec.unit === 'año') return index.get(date.slice(0, 4))
      if (spec.unit === 'mes') return index.get(date.slice(0, 7))
      if (spec.unit === 'hora') {
        const match = String(hour || '').match(/^(\d{1,2}):[0-5]\d$/)
        const h = match && Number(match[1]) < 24 ? Number(match[1]) : 'sin-hora'
        return index.get(`${date}|${h}`)
      }
      return index.get(date)
    }
    Object.entries(allData).forEach(([date, day]) => Object.entries(day || {}).forEach(([cell, appt]) => {
      if (!appt?.paid || appt.isBlocked || appt.isNote) return
      if (isMonthlyBillingSummary(cell, appt) && period !== 'todo') {
        const normalized = `${Number(date.slice(0, 4)) - shift}${date.slice(4)}`
        const month = normalized.slice(0, 7)
        if (month < from.slice(0, 7) || month > to.slice(0, 7)) return
        const monthEnd = keyOf(new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0, 12))
        const fullMonth = `${month}-01` >= from && monthEnd <= to
        if (spec.unit !== 'mes' || !fullMonth) {
          monthlySummaries[year].push({ month: date.slice(0, 7), amount: convertAmount(apptPaidTotal(appt), date) })
          summaryMonths.add(month)
          return
        }
      }
      const i = bucketIndex(date, appt.hour || cell.split('||')[1])
      if (i === undefined) return
      income[year][i] += convertAmount(apptPaidTotal(appt), date)
      commissions[year][i] += convertAmount(commissionFor(appt, date), date)
    }))
    incomeAvailable[year] = spec.buckets.map(bucket => !summaryMonths.has(bucket.key.slice(0, 7)))
    gastos.forEach(gasto => {
      if (!gasto?.fecha || gasto.tipo === 'ingreso') return
      const i = bucketIndex(gasto.fecha, null)
      if (i === undefined) return
      const amount = convertAmount(Math.max(0, Number(gasto.monto) || 0), gasto.fecha)
      if (gasto.isFixed && (spec.unit === 'día' || spec.unit === 'hora')) fixedExpenses[year] += amount
      else if (spec.unit === 'hora') expensesWithoutTime[year] += amount
      else expenses[year][i] += amount
    })
  }
  // No mostrar una columna final vacía cuando no hay cobros sin horario.
  if (spec.unit === 'hora' && [...new Set(years)].every(year => income[year].at(-1) === 0 && commissions[year].at(-1) === 0)) {
    spec.buckets.pop()
    for (const year of new Set(years)) {
      income[year].pop(); expenses[year].pop(); commissions[year].pop(); incomeAvailable[year].pop()
    }
  }
  return { ...spec, income, expenses, commissions, fixedExpenses, expensesWithoutTime, monthlySummaries, incomeAvailable }
}

/** Los puntos futuros no representan una caída real de facturación. */
export function comparisonBucketAvailable(spec, index, year, period, today, now = new Date()) {
  const bucket = spec.buckets[index]
  if (!bucket) return false
  if (spec.unit === 'año') return Number(bucket.key) <= Number(today.slice(0, 4))
  const [date, hour] = bucket.key.split('|')
  const shifted = `${Number(date.slice(0, 4)) + year - spec.anchorYear}${date.slice(4)}`
  if (spec.unit === 'hora' && shifted === today && hour !== 'sin-hora') return Number(hour) <= now.getHours()
  return shifted <= (spec.unit === 'mes' ? today.slice(0, 7) : today)
}

/** Señalar la unidad que todavía está abierta, sin alterar su importe. */
export function comparisonBucketInProgress(spec, index, year, now = new Date()) {
  const bucket = spec.buckets[index]
  if (!bucket) return false
  const today = keyOf(now)
  if (spec.unit === 'año') return Number(bucket.key) === now.getFullYear()
  const [date, hour] = bucket.key.split('|')
  const shifted = `${Number(date.slice(0, 4)) + year - spec.anchorYear}${date.slice(4)}`
  if (spec.unit === 'mes') return shifted === today.slice(0, 7)
  if (spec.unit === 'hora') return shifted === today && hour !== 'sin-hora' && Number(hour) === now.getHours()
  return shifted === today
}
