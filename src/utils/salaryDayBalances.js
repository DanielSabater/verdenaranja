import { salaryPayments } from './salaryPayments.js'

// Reparte cada pago entre los días que incluía, según su comisión pendiente.
export function salaryDayBalances(record, professionalId, period, breakdown) {
  const days = Object.fromEntries(breakdown.map(day => [day.dk, { commission: Math.max(0, Math.round(day.comision * 100)), paid: 0 }]))
  for (const payment of salaryPayments(record, professionalId, period)) {
    if (payment.anulado) continue
    const eligible = Object.keys(days).filter(day => payment.dias === 'all' || !payment.dias || payment.dias.includes(day))
    const pending = eligible.reduce((sum, day) => sum + Math.max(0, days[day].commission - days[day].paid), 0)
    let remaining = Math.min(pending, Math.round(Number(payment.monto) * 100) || 0)
    let weight = pending
    for (const day of eligible) {
      const balance = Math.max(0, days[day].commission - days[day].paid)
      const share = weight > 0 ? Math.min(balance, Math.round(remaining * balance / weight)) : 0
      days[day].paid += share
      remaining -= share
      weight -= balance
    }
  }
  return Object.fromEntries(Object.entries(days).map(([day, value]) => [day, {
    commission: value.commission / 100,
    paid: value.paid / 100,
    status: value.commission > 0 && value.paid >= value.commission ? 'paid' : value.paid > 0 ? 'partial' : 'pending'
  }]))
}
