import test from 'node:test'
import assert from 'node:assert/strict'
import { reuseClientViewCalculation as reuse } from '../src/utils/clientViewCache.js'
test('reutiliza cálculos al reabrir e invalida al cambiar datos o día', () => {
  let calls = 0
  const history = {}, clients = []
  const calculate = () => ({ result: ++calls })
  const original = reuse('test', [history, clients, '2026-10-21'], calculate)
  assert.strictEqual(reuse('test', [history, clients, '2026-10-21'], calculate), original)
  assert.equal(calls, 1)
  assert.notStrictEqual(reuse('test', [{}, clients, '2026-10-21'], calculate), original)
  assert.equal(calls, 2)
  reuse('test', [history, [...clients], '2026-10-21'], calculate)
  reuse('test', [history, clients, '2026-10-22'], calculate)
  assert.equal(calls, 4)
})
