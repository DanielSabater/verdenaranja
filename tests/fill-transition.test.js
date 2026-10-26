import test from 'node:test'
import assert from 'node:assert/strict'
import { createFillTransition, FILL_TRANSITION_MS } from '../src/utils/fillTransition.js'

function setup() {
  const states = []
  const jobs = new Map()
  let sequence = 0
  const controller = createFillTransition({
    onChange: state => states.push(state),
    schedule: (callback, delay) => { const id = ++sequence; jobs.set(id, { callback, delay }); return id },
    cancel: id => jobs.delete(id),
  })
  const finish = () => { const [id, job] = jobs.entries().next().value; jobs.delete(id); job.callback() }
  return { controller, states, jobs, finish }
}

test('espera al final del relleno y rechaza clics duplicados antes de ejecutar una única acción', () => {
  const { controller, states, jobs, finish } = setup()
  let payments = 0
  const details = { keys: ['turno-a', 'turno-b'], date: '2026-10-26', direction: 'forward' }
  assert.equal(controller.run(details, () => payments++), true)
  assert.equal(controller.run(details, () => payments++), false)
  assert.equal(payments, 0)
  assert.equal(jobs.size, 1)
  assert.equal([...jobs.values()][0].delay, FILL_TRANSITION_MS)
  assert.deepEqual(states, [details])
  finish()
  assert.equal(payments, 1)
  assert.equal(states.at(-1), null)
  assert.equal(controller.run({ direction: 'backward' }, () => payments--), true)
  finish()
  assert.equal(payments, 0)
})

test('al desmontar cancela la acción pendiente', () => {
  const { controller, jobs } = setup()
  let calls = 0
  controller.run({ direction: 'forward' }, () => calls++)
  controller.dispose()
  assert.equal(jobs.size, 0)
  assert.equal(calls, 0)
})

test('respeta movimiento reducido ejecutando directamente, sin espera artificial', () => {
  const { controller, states, jobs } = setup()
  let calls = 0
  controller.run({ direction: 'forward' }, () => calls++, true)
  assert.equal(calls, 1)
  assert.equal(jobs.size, 0)
  assert.deepEqual(states, [null])
})
