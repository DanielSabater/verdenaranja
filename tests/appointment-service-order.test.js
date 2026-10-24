import test from 'node:test'
import assert from 'node:assert/strict'
import { orderAppointmentServices } from '../src/utils/appointmentServiceOrder.js'

const catalog = ['A', 'B', 'C', 'D', 'E'].map(id => ({ id, name: id, price: 100, duration: 30 }))
const usual = [{ id: 'B', count: 3 }, { id: 'D', count: 5 }]
const ids = list => list.map(service => service.id)

test('Seleccionados primero, luego habituales por frecuencia y después el resto estable', () => {
  assert.deepEqual(ids(orderAppointmentServices(catalog, [catalog[4], catalog[1]], usual)), ['B', 'E', 'D', 'A', 'C'])
})
test('Al quitar una selección vuelve a su grupo correspondiente', () => {
  assert.deepEqual(ids(orderAppointmentServices(catalog, [catalog[4]], usual)), ['E', 'D', 'B', 'A', 'C'])
  assert.deepEqual(ids(orderAppointmentServices(catalog, [], usual)), ['D', 'B', 'A', 'C', 'E'])
})
test('Respeta resultados filtrados sin agregar seleccionados ni duplicarlos por cantidad', () => {
  assert.deepEqual(ids(orderAppointmentServices([catalog[0], catalog[2]], [catalog[4], catalog[2], catalog[2]], usual)), ['C', 'A'])
})
test('Sin recomendaciones conserva el orden del catálogo dentro de cada grupo', () => {
  assert.deepEqual(ids(orderAppointmentServices(catalog, [catalog[4], catalog[2]], [])), ['C', 'E', 'A', 'B', 'D'])
})
test('Admite servicios sin id y no modifica datos ni valores', () => {
  const services = [{ name: 'Manos', price: 200, duration: 40 }, { name: 'Pies', price: 300, duration: 50 }]
  const original = JSON.stringify(services)
  const result = orderAppointmentServices(services, [services[1]], [])
  assert.equal(result[0], services[1])
  assert.equal(JSON.stringify(services), original)
})
