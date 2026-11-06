import { fmt, apptComisionableTotal, commissionServicesFor, isServiceExcluido } from './appointments.js'
import { MESES_ES } from './dates.js'

export function salaryReceiptAppointment(appt, activeServices = []) {
  const services = Array.isArray(appt.services) ? appt.services : []
  const included = services.filter(service => !isServiceExcluido(service, commissionServicesFor(appt, activeServices)))
  if (services.length && !included.length) return null
  return { services: included, amount: apptComisionableTotal(appt, activeServices) }
}

export function salaryReceiptMessage({ professional, period, days, stats, paid, balance }) {
  const [year, month] = period.split('-')
  const periodLabel = `${MESES_ES[Number(month) - 1]} ${year}`
  const dayLines = days.flatMap(day => [
    `• ${day.dk.slice(8, 10)}/${day.dk.slice(5, 7)}: ${day.turnos} turnos · comisión ${fmt(day.comision)}`,
    ...(day.appts || []).flatMap(appt => {
      const detail = appt.receiptDetail === undefined ? appt : appt.receiptDetail
      if (!detail) return []
      const services = (detail.services || []).map(service => service.name?.trim()).filter(Boolean).join(' + ') || 'Servicio sin especificar'
      return [`  - ${services}: ${fmt(detail.amount)}`]
    }),
  ])
  return [
    '🧾 *RESUMEN DE LIQUIDACIÓN*',
    `👤 ${professional.name}`,
    `📅 Período: ${periodLabel}`,
    '',
    '*Días incluidos*',
    ...(dayLines.length ? dayLines : ['Sin días con turnos incluidos.']),
    '',
    `Turnos: ${stats.turnos} · Días trabajados: ${stats.dias}`,
    `Facturado: ${fmt(stats.facturado)}`,
    `*Comisión a liquidar: ${fmt(stats.comision)}*`,
    `Pagos aplicados a estos días: ${fmt(paid)}`,
    ...(balance < 0 ? [`*Saldo a favor: ${fmt(Math.abs(balance))}*`] : []),
  ].join('\n')
}
