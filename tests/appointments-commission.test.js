import test from 'node:test'
import assert from 'node:assert/strict'
import { apptComisionTotal, apptComisionableTotal, apptPaidTotal, createCommissionSnapshot, hasCommissionableServices } from '../src/utils/appointments.js'

const day = '2026-10-19'
const service = { id: 'manos', name: 'Manos', price: 1000, comisionPct: 40 }
const appointment = { profId: 1, services: [service], paid: true, paymentSplits: [{ amount: 1000 }] }
const freeze = (appt, catalog = [service], globalPct = 30, exceptions = {}, professionals = []) => ({
  ...appt,
  commissionSnapshot: createCommissionSnapshot(appt, globalPct, catalog, exceptions, day, professionals),
})

test('un cobro nuevo conserva su comisión aunque cambie el catálogo y la configuración', () => {
  const paid = freeze(appointment)
  const changed = [{ ...service, comisionPct: 90, excluidoComision: true }]
  assert.equal(apptComisionTotal(paid, 80, changed, { [day]: 70 }, day, [{ id: 1, comisionPct: 60 }]), 400)
  assert.equal(apptComisionableTotal(paid, changed), 1000)
  assert.equal(hasCommissionableServices(paid, changed), true)
  assert.equal(apptPaidTotal(paid), 1000)
  assert.equal(apptComisionTotal(paid, 80, []), 400)
})

test('conserva exclusiones y comisiones cero después de modificar el catálogo', () => {
  const excluded = { ...service, excluidoComision: true }
  const paid = freeze({ ...appointment, services: [excluded] }, [excluded])
  assert.equal(apptComisionTotal(paid, 50, [service]), 0)
  assert.equal(apptComisionableTotal(paid, [service]), 0)
  assert.equal(hasCommissionableServices(paid, [service]), false)
  const zero = freeze(appointment, [{ ...service, comisionPct: 0 }])
  assert.equal(apptComisionTotal(zero, 50, [service]), 0)
})

test('fija la prioridad entre porcentaje del servicio, profesional, fecha y global', () => {
  const inherited = { ...service, comisionPct: undefined }
  const appt = { ...appointment, services: [inherited] }
  const profs = [{ id: 1, comisionPct: 45 }]
  assert.equal(apptComisionTotal(freeze(appt, [inherited], 30, {}, profs), 90), 450)
  assert.equal(apptComisionTotal(freeze(appt, [inherited], 30, { [day]: 55 }, profs), 90), 550)
  assert.equal(apptComisionTotal(freeze(appt, [inherited], 30), 90), 300)
})

test('descuentos y propinas usan el cobro neto con la comisión fijada', () => {
  const paid = freeze({ ...appointment, paymentSplits: [{ amount: 1000 }], tip: 100, discount: 100 })
  assert.equal(apptComisionTotal(paid, 90, [{ ...service, comisionPct: 90 }]), 360)
  const editedPayment = { ...paid, paymentSplits: [{ amount: 900 }] }
  assert.equal(apptComisionTotal(editedPayment, 90), 320)
  assert.deepEqual(createCommissionSnapshot(paid, 90, []), paid.commissionSnapshot)
})

test('un cobro manual sin servicios también conserva su porcentaje', () => {
  const manual = freeze({ paid: true, profId: 1, services: [], paymentSplits: [{ amount: 2000 }], tip: 200 }, [], 40)
  assert.equal(apptComisionTotal(manual, 90), 720)
})

test('anular y volver a cobrar aplica las reglas del nuevo pago', () => {
  const paid = freeze(appointment)
  const unpaid = { ...paid, paid: false, commissionSnapshot: undefined }
  const updated = [{ ...service, comisionPct: 60 }]
  assert.equal(apptComisionTotal(unpaid, 30, updated), 600)
  const repaid = { ...unpaid, paid: true, commissionSnapshot: createCommissionSnapshot(unpaid, 30, updated) }
  assert.equal(apptComisionTotal(repaid, 90, [service]), 600)
})

test('no inventa reglas para pagos antiguos ni modifica los datos de entrada', () => {
  const original = JSON.stringify(appointment)
  freeze(appointment)
  assert.equal(JSON.stringify(appointment), original)
  assert.equal(apptComisionTotal(appointment, 30, [{ ...service, comisionPct: 60 }]), 600)
})
