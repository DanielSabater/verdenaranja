import test from 'node:test'
import assert from 'node:assert/strict'
import { clientSearchRank } from '../src/utils/clientSearch.js'

const names = ['Ana Maria', 'Mariana', 'Margarita', 'Ariana', 'Ari Gonzalez', 'Ari', 'Carina']
const order = (clients, query) => clients.filter(client => Number.isFinite(clientSearchRank(client, query))).sort((a, b) => clientSearchRank(a, query) - clientSearchRank(b, query))

test('Ari exacto y con apellido aparecen antes que Ariana, Mariana y Ana Maria', () => {
  const results = order(names.map(name => ({ name })), 'Ari')
  assert.deepEqual(results.slice(0, 3).map(client => client.name), ['Ari', 'Ari Gonzalez', 'Ariana'])
})

test('Una ficha con teléfono incorporado conserva la prioridad del nombre exacto', () => {
  assert.equal(clientSearchRank({ name: 'Ari 1155551234' }, 'ari'), 0)
  assert.equal(clientSearchRank({ name: 'Ari 1155551234' }, '5555'), 5)
})

test('La relevancia ignora acentos, mayúsculas y espacios adicionales', () => {
  assert.equal(clientSearchRank({ name: 'María   Pérez' }, '  MARIA PEREZ  '), 0)
  assert.equal(clientSearchRank({ name: 'María Pérez' }, 'perez'), 2)
})

test('Nombre tiene prioridad sobre notas, teléfono o servicios, sin perder coincidencias', () => {
  const clients = [{ name: 'Zoe', notes: 'Amiga de Ari' }, { name: 'Eva', topServices: [{ name: 'Tratamiento Ari' }] }, { name: 'Mariana' }, { name: 'Ari' }]
  assert.deepEqual(order(clients, 'ari').map(client => client.name), ['Ari', 'Mariana', 'Zoe', 'Eva'])
  assert.equal(clientSearchRank({ name: 'Zoe', effectivePhone: '1155554321' }, '5432'), 6)
})

test('Sin búsqueda todos tienen igual relevancia, permitiendo el orden elegido', () => {
  assert.equal(clientSearchRank({ name: 'Zoe' }, ''), 0)
  assert.equal(clientSearchRank({ name: 'Ari' }, '  '), 0)
  assert.equal(clientSearchRank({ name: 'Eva' }, 'xyz'), Infinity)
})

test('La búsqueda no modifica nombres, teléfonos ni notas', () => {
  const client = { name: 'Ári 1155551234', phone: '', notes: 'Detalle original' }
  const original = JSON.stringify(client)
  clientSearchRank(client, 'ari')
  assert.equal(JSON.stringify(client), original)
})

test('un número completo encuentra fragmentos del nombre en cualquier posición', () => {
  const clients = [{ name: 'Ana 4321' }, { name: 'Beto 1165' }, { name: 'Ceci 2178' }, { name: 'Dora 9999' }]
  assert.deepEqual(order(clients, '1165432178').map(client => client.name), ['Ana 4321', 'Beto 1165', 'Ceci 2178'])
})

test('ignora separadores del teléfono y prioriza su coincidencia completa', () => {
  const clients = [{ name: 'Ana 4321' }, { name: 'Zoe', phone: '(11) 6543-2178' }]
  assert.deepEqual(order(clients, '1165432178').map(client => client.name), ['Zoe', 'Ana 4321'])
  assert.ok(Number.isFinite(clientSearchRank({ name: 'Zoe (11) 6543-2178' }, '654321')))
})

test('un número de horario corto no basta para asociarlo a un teléfono completo', () => {
  assert.equal(clientSearchRank({ name: 'Ana 15:00', phone: '' }, '1165432178'), Infinity)
})
