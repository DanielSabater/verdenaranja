import test from 'node:test'
import assert from 'node:assert/strict'
import { appointmentClientSuggestions, suggestedClientValue, savedClientForValue, addClientDraft } from '../src/utils/appointmentClientSuggestions.js'

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

test('un teléfono completo encuentra números abreviados del nombre en cualquier posición', () => {
  const list = [{ id: 1, name: 'Ana 4321' }, { id: 2, name: 'Beto 1165' }, { id: 3, name: 'Ceci 7890' }]
  assert.deepEqual(appointmentClientSuggestions('1165432178', list).map(c => c.id), [1, 2])
  assert.deepEqual(appointmentClientSuggestions('4321', list).map(c => c.id), [1])
})

test('prioriza coincidencias completas y conserva varias opciones parciales sin confundirlas', () => {
  const list = [{ id: 1, name: 'Ana 4321' }, { id: 2, name: 'Beto', phone: '1165432178' }, { id: 3, name: 'Ceci 1165' }]
  assert.deepEqual(appointmentClientSuggestions('1165432178', list).map(c => c.id), [2, 1, 3])
})

test('ignora números cortos de horarios al comparar contra un teléfono completo', () => {
  assert.deepEqual(appointmentClientSuggestions('1165432178', [{ name: 'Ana 11:00' }, { name: 'Beto 15' }]), [])
})

test('busca también teléfonos con separadores incluidos en el nombre', () => {
  assert.equal(appointmentClientSuggestions('55551234', [{ name: 'Ana 11-5555-1234' }]).length, 1)
})

test('al elegir una sugerencia reemplaza la consulta por el nombre guardado, sin agregar el teléfono buscado', () => {
  const client = { name: 'Ana 4321', phone: '' }
  assert.equal(suggestedClientValue('1165432178', client), 'Ana 4321')
  assert.deepEqual(client, { name: 'Ana 4321', phone: '' })
  assert.equal(suggestedClientValue('Ana', { name: 'Ana', phone: '1165432178' }), 'Ana')
})

test('la ficha guardada requiere coincidencia de los datos y no sólo del nombre limpio', () => {
  const saved = { id: 1, name: 'Ana 4321', phone: '' }
  assert.equal(savedClientForValue('Ana 4321', [saved]), saved)
  assert.equal(savedClientForValue('Ana 4321 1165432178', [saved]), null)
  assert.equal(savedClientForValue('Ana 1165432178', [saved]), null)
  assert.equal(savedClientForValue('1165432178', [saved]), null)
})

test('los teléfonos estructurados guardados siguen asociados a la ficha seleccionada', () => {
  const saved = { id: 1, name: 'Ana', phone: '1165432178' }
  assert.equal(savedClientForValue('Ana', [saved]), saved)
  assert.equal(savedClientForValue('Ana 1165432178', [saved]), saved)
  assert.equal(savedClientForValue('Ana 1199999999', [saved]), null)
})

test('guardar una edición crea sólo la ficha explícita y no modifica otras por coincidencia parcial', () => {
  const existing = { id: 1, name: 'Ana 4321', phone: '' }
  const clients = [existing]
  const saved = addClientDraft(clients, 'Ana 1165432178', '1165432178', 2)
  assert.equal(saved.length, 2)
  assert.equal(saved[0], existing)
  assert.equal(saved[1].name, 'Ana 1165432178')
  assert.equal(saved[1].phone, '1165432178')
  assert.deepEqual(clients, [{ id: 1, name: 'Ana 4321', phone: '' }])
  assert.equal(addClientDraft(saved, 'Ana 1165432178', '1165432178', 3), saved)
  assert.equal(addClientDraft(clients, '', '', 4), clients)
})
