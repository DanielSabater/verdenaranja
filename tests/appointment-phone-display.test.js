import test from 'node:test'
import assert from 'node:assert/strict'
import { getApptClientPhone, extractNumberFromText, ensurePhoneInName } from '../src/utils/whatsapp.js'

test('los dígitos incompletos sobreviven al guardado y se muestran en la tarjeta', () => {
  for (const partial of ['1', '1155', '1155551', '11 55-5']) {
    const input = `Ana ${partial}`
    const phone = extractNumberFromText(input)
    const appointment = { client: ensurePhoneInName(input, phone), clientPhone: phone }
    const display = getApptClientPhone(appointment, [{ name: 'Ana', phone: '1199999999' }])
    assert.equal(display.phone, partial)
    assert.equal(display.cleanName, 'Ana')
    assert.equal(appointment.client, input)
  }
})

test('el teléfono propio del turno prevalece sobre la ficha incluso si se editó', () => {
  const clients = [{ name: 'Ana', phone: '1199999999' }]
  assert.equal(getApptClientPhone({ client: 'Ana', clientPhone: '1155' }, clients).phone, '1155')
  assert.equal(getApptClientPhone({ client: 'Ana 1155' }, clients).phone, '1155')
  assert.equal(getApptClientPhone({ client: 'Ana 1155551234', clientPhone: '1155551234' }, clients).phone, '1155551234')
  assert.equal(getApptClientPhone({ client: 'Ana' }, clients).phone, '1199999999')
})
