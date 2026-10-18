import test from 'node:test'
import assert from 'node:assert/strict'
import { moneyDraft, parseArgentineMoney, formatArgentineMoney, pastedArgentineMoney, moneyCaret } from '../src/utils/argentineMoney.js'
test('escritura progresiva, borrado y centavos sin cambiar el número', () => {
  for (const [raw, expected] of [['3','3'],['3000','3.000'],['30.000,','30.000,'],['30.000,5','30.000,5'],['30.000,50','30.000,50'],['',''],[',','0,']]) assert.equal(moneyDraft(raw),expected)
  assert.equal(parseArgentineMoney('30.000,50'),30000.5)
  assert.equal(formatArgentineMoney(30000.5),'30.000,50')
  assert.equal(formatArgentineMoney(0.01),'0,01')
  assert.equal(moneyDraft('1,234'),null)
  assert.equal(moneyDraft('-12'),null)
})
test('pegado argentino explícito y rechazo de formatos ambiguos', () => {
  assert.equal(pastedArgentineMoney('$ 30.000,50'),'30.000,50')
  assert.equal(pastedArgentineMoney('30000,50'),'30.000,50')
  for (const value of ['30,000.50','30000.50','30.00','-10','NaN','1,234','1e3']) assert.equal(pastedArgentineMoney(value),null)
  assert.ok(Number.isNaN(parseArgentineMoney('')))
})
test('cursor conserva posición lógica al insertar separadores', () => {
  assert.equal(moneyCaret('30.000,50',3),4)
  assert.equal(moneyCaret('30.000,50',6),7)
  assert.equal(moneyCaret('3.000',0),0)
})
