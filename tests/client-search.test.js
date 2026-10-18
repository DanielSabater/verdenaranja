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
