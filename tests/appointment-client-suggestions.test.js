import test from 'node:test'
import assert from 'node:assert/strict'
import { appointmentClientSuggestions } from '../src/utils/appointmentClientSuggestions.js'

const clients = [
  { id: 1, name: 'Daniel Sabater', phone: '1155551234' },
  { id: 2, name: 'Daniela 1166661234', phone: '1166661234' },
]

test('No propone la ficha ya cargada al editar con teléfono separado', () => {
  assert.deepEqual(appointmentClientSuggestions('Daniel Sabater 1155551234', clients), [])
})

test('El nombre completo tampoco propone otra vez su propia ficha', () => {
  assert.deepEqual(appointmentClientSuggestions('Daniel Sabater', clients), [])
  assert.deepEqual(appointmentClientSuggestions('Daniel Sabater', [{ name: 'Daniel Sabater 1155551234' }]), [])
})

test('La misma identidad admite diferencias de formato, mayúsculas y espacios', () => {
  assert.deepEqual(appointmentClientSuggestions('DÁNIEL   SABATER 11-5555-1234', clients), [])
})

test('Sigue mostrando alternativas para cambiar nombre y buscar por fragmentos de teléfono', () => {
  assert.deepEqual(appointmentClientSuggestions('Dani', clients).map(c => c.id), [1, 2])
  assert.deepEqual(appointmentClientSuggestions('5555', clients).map(c => c.id), [1])
  assert.deepEqual(appointmentClientSuggestions('1155551234', clients).map(c => c.id), [1])
})

test('La búsqueda parcial conserva homónimos y no ofrece teléfonos que no coinciden', () => {
  const sameNames = [...clients, { id: 3, name: 'Daniel Sabater 1155551234', phone: '1155551234' }]
  assert.deepEqual(appointmentClientSuggestions('Daniel Sabater 1199991234', sameNames).map(c => c.id), [])
  // El teléfono buscado distinto no coincide con ninguna ficha: no inventar alternativas.
  assert.equal(appointmentClientSuggestions('Dani', sameNames).length, 3)
})

test('Conserva límite, tolera fichas vacías y no modifica datos', () => {
  const list = [null, {}, ...Array.from({ length: 12 }, (_, id) => ({ id, name: `Daniel ${id}` }))]
  const snapshot = JSON.stringify(list)
  assert.equal(appointmentClientSuggestions('Dan', list).length, 8)
  assert.deepEqual(appointmentClientSuggestions('', list), [])
  assert.equal(JSON.stringify(list), snapshot)
})
