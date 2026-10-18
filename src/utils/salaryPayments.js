// Los pagos anteriores se leen sin alterar ni perder su fecha o importe.
export function salaryPayments(record = {}, professionalId, period) {
  if (Array.isArray(record.pagos)) return record.pagos
  if (!record.pagado || !(Number(record.monto) > 0)) return []
  return [{ id: `anterior:${professionalId}:${period}`, monto: Number(record.monto), fecha: record.fecha || '', profesionalId: professionalId, periodo: period, dias: record.dias || 'all', anterior: true }]
}
export function paidSalary(record, professionalId, period) {
  return salaryPayments(record, professionalId, period).reduce((sum, payment) => sum + (payment.anulado ? 0 : Number(payment.monto) || 0), 0)
}
export function appendSalaryPayment(record = {}, payment, commission) {
  const payments = salaryPayments(record, payment.profesionalId, payment.periodo)
  if (payments.some(p => p.id === payment.id)) return record
  const total = paidSalary(record, payment.profesionalId, payment.periodo)
  const amount = Number(payment.monto)
  if (!Number.isFinite(amount) || amount <= 0 || amount > Math.round((commission - total) * 100) / 100) throw new Error('Ingresá un importe mayor a cero y que no supere el saldo pendiente.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payment.fecha) || new Date(`${payment.fecha}T12:00:00`).toISOString().slice(0, 10) !== payment.fecha) throw new Error('Ingresá una fecha válida.')
  return { ...record, pagos: [...payments, payment], monto: total + amount, fecha: payment.fecha, pagado: total + amount >= commission }
}

// Conserva el movimiento original y actualiza solo el período al que pertenece.
export function cancelSalaryPayment(record = {}, professionalId, period, paymentId, reason, commission, cancelledAt = new Date().toISOString()) {
  const payments = salaryPayments(record, professionalId, period)
  const target = payments.find(payment => payment.id === paymentId)
  if (!target || target.anulado) return record
  if (!reason?.trim()) throw new Error('Indicá el motivo de la anulación.')
  const updated = payments.map(payment => payment.id === paymentId ? { ...payment, anulado: true, motivoAnulacion: reason.trim(), anuladoEn: cancelledAt } : payment)
  const active = updated.filter(payment => !payment.anulado)
  const total = Math.round(active.reduce((sum, payment) => sum + Number(payment.monto), 0) * 100) / 100
  const lastDate = active.map(payment => payment.fecha || '').sort().at(-1) || ''
  return { ...record, pagos: updated, monto: total, fecha: lastDate, pagado: active.length > 0 && total >= commission }
}
