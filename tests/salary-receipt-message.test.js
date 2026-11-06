import test from 'node:test'
import assert from 'node:assert/strict'
import { salaryReceiptAppointment, salaryReceiptMessage } from '../src/utils/salaryReceiptMessage.js'
import { createCommissionSnapshot } from '../src/utils/appointments.js'

test('el resumen refleja los días y pagos seleccionados de la liquidación', () => {
  const message = salaryReceiptMessage({
    professional: { name: 'Ana' }, period: '2026-10',
    days: [
      { dk: '2026-10-02', turnos: 2, comision: 12000, appts: [
        { clientName: 'Clienta privada', services: [{ name: 'Manicura' }, { name: 'Esmaltado' }], amount: 18000, comision: 9000 },
        { clientName: 'Otra clienta', services: [], amount: 6000, comision: 3000 },
      ] },
      { dk: '2026-10-15', turnos: 1, comision: 8000, appts: [{ services: [{ name: 'Pedicura' }], amount: 16000, comision: 8000 }] },
    ],
    stats: { turnos: 3, dias: 2, facturado: 40000, propinas: 1500, comision: 20000 }, paid: 5000, balance: 15000,
  })
  assert.match(message, /octubre 2026/i)
  assert.match(message, /02\/10: 2 turnos · comisión \$12\.000/)
  assert.match(message, /15\/10: 1 turnos · comisión \$8\.000/)
  assert.match(message, /02\/10[^\n]*\n  - Manicura \+ Esmaltado: \$18\.000\n  - Servicio sin especificar: \$6\.000/)
  assert.match(message, /15\/10[^\n]*\n  - Pedicura: \$16\.000/)
  assert.doesNotMatch(message, /Clienta privada|Otra clienta/)
  assert.doesNotMatch(message, /VERDE NARANJA|Propinas|Saldo pendiente/i)
  assert.match(message, /Ana/)
  assert.match(message, /Turnos: 3 · Días trabajados: 2/)
  assert.match(message, /Facturado: \$40\.000/)
  assert.match(message, /Comisión a liquidar: \$20\.000/)
  assert.match(message, /Pagos aplicados a estos días: \$5\.000/)
})

test('indica una selección vacía y distingue el saldo a favor', () => {
  const message = salaryReceiptMessage({ professional: { name: 'Ana' }, period: '2026-11', days: [], stats: { turnos: 0, dias: 0, facturado: 0, propinas: 0, comision: 0 }, paid: 1000, balance: -1000 })
  assert.match(message, /Sin días con turnos incluidos/)
  assert.match(message, /Saldo a favor: \$1\.000/)
  assert.doesNotMatch(message, /VERDE NARANJA|Propinas|Saldo pendiente/i)
})

test('el detalle respeta exclusiones, cobro prorrateado y condiciones guardadas', () => {
  const manos = { id: 1, name: 'Manicura', price: 10000 }
  const cafe = { id: 2, name: '☕ Café', price: 2000 }
  const extra = { id: 3, name: 'Producto', price: 3000 }
  const paid = { paid: true, services: [manos, cafe, extra], paymentSplits: [{ amount: 12000 }] }
  const catalog = [manos, cafe, { ...extra, excluidoComision: true }]
  const frozen = { ...paid, commissionSnapshot: createCommissionSnapshot(paid, 50, catalog) }
  const detail = salaryReceiptAppointment(frozen, [ { ...manos, excluidoComision: true }, cafe, extra ])
  assert.deepEqual(detail.services.map(s => s.name), ['Manicura'])
  assert.equal(detail.amount, 8000)
  assert.equal(salaryReceiptAppointment({ paid: true, services: [cafe], paymentSplits: [{ amount: 2000 }] }), null)
  assert.equal(salaryReceiptAppointment({ paid: true, services: [extra], paymentSplits: [{ amount: 3000 }] }, [{ ...extra, comisionPct: 0 }]), null)
  assert.deepEqual(salaryReceiptAppointment({ paid: true, services: [], paymentSplits: [{ amount: 2000 }] }), { services: [], amount: 2000 })
  const message = salaryReceiptMessage({ professional: { name: 'Ana' }, period: '2026-10', days: [{ dk: '2026-10-02', turnos: 2, comision: 4000, appts: [{ receiptDetail: detail }, { receiptDetail: null }] }], stats: { turnos: 2, dias: 1, facturado: 14000, comision: 4000 }, paid: 0, balance: 4000 })
  assert.match(message, /Manicura: \$8\.000/)
  assert.doesNotMatch(message, /Café|Producto|Servicio sin especificar/)
  assert.match(message, /Facturado: \$14\.000/)
  assert.match(message, /Comisión a liquidar: \$4\.000/)
})
