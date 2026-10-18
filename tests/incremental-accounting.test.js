import test from 'node:test'
import assert from 'node:assert/strict'
import { createIncrementalAccountingIndex, summarizeAccountingDay, createIncrementalBillingComparison, incrementalDayDetail, incrementalAccountingIndex } from '../src/utils/incrementalAccounting.js'
import { aggregateBillingComparison } from '../src/utils/billingComparison.js'
import { apptPaidTotal, apptComisionTotal } from '../src/utils/appointments.js'

const service = { id: 's', name: 'Manos', price: 100, comisionPct: 40 }
const rules = { professionals: [{ id: 'p', name: 'Profesional' }], services: [service], comisionPct: 40, dateExceptions: {} }
const paid = (amount = 100, extra = {}) => ({ paid: true, profId: 'p', hour: '09:30', services: [{ ...service, price: amount }], payMethod: 'efectivo', ...extra })
const original = () => ({
  '2025-10-01': { historico_2025: paid(1500, { services: [{ name: 'Total Facturación Mensual', price: 1500 }] }) },
  '2026-09-10': { a: paid(250, { discount: 20 }), b: paid(100, { paid: false }) },
  '2026-10-17': { a: paid(200, { tip: 20, paymentSplits: [{ methodId: 'debito', amount: 120 }, { methodId: 'efectivo', amount: 100 }] }), b: paid(100, { hour: undefined }) },
})
const expenses = [{ fecha: '2026-10-17', monto: 50 }, { fecha: '2026-10-01', monto: 400, isFixed: true }, { fecha: '2026-09-10', monto: 30 }]
const fields = ['incomeByProf','comisionByProf','incomeByMethod','turnsByProf','incomeByService','countByService','incomeByDOW']
function fullTotals(data, from, to, config) {
  const result = { totalIncome: 0, totalTurns: 0, ...Object.fromEntries(fields.map(field => [field, {}])) }
  for (const p of config.professionals) for (const field of fields.slice(0,2).concat('turnsByProf')) result[field][p.id] = 0
  for (let day=0; day<7; day++) result.incomeByDOW[day]=0
  for (const [date, day] of Object.entries(data)) {
    if (date<from || date>to) continue
    for (const appt of Object.values(day)) {
      if (!appt?.paid) continue
      const amount=apptPaidTotal(appt), add=(field,key,value)=>result[field][key]=(result[field][key]||0)+value
      result.totalIncome+=amount;result.totalTurns++
      add('incomeByProf',appt.profId,amount);add('turnsByProf',appt.profId,1)
      add('comisionByProf',appt.profId,apptComisionTotal(appt,config.comisionPct,config.services,config.dateExceptions,date,config.professionals))
      add('incomeByDOW',new Date(date+'T12:00:00').getDay(),amount)
      for(const s of appt.services||[]){add('incomeByService',s.name,parseFloat(s.price)||0);add('countByService',s.name,1)}
      if(appt.paymentSplits?.length) for(const split of appt.paymentSplits)add('incomeByMethod',split.methodId,parseFloat(split.amount)||0)
      else if(appt.payMethod)add('incomeByMethod',appt.payMethod,amount)
    }
  }
  return result
}

test('totales incrementales equivalen al recorrido completo: pagos, descuentos, propinas y divisiones', () => {
  const index=createIncrementalAccountingIndex(), data=original()
  index.update(data,rules)
  for(const [from,to] of [['2026-01-01','2026-12-31'],['2026-10-01','2026-10-31'],['2026-09-10','2026-09-10']])
    assert.deepEqual(index.totals(from,to,rules.professionals),fullTotals(data,from,to,rules))
})

test('un pago hoy o antiguo recalcula solo el día modificado y actualiza por diferencias', () => {
  const calls=[], index=createIncrementalAccountingIndex((date,day,r)=>{calls.push(date);return summarizeAccountingDay(date,day,r)})
  let data=original();index.update(data,rules);const before=index.totals('2026-01-01','2026-12-31',rules.professionals)
  calls.length=0
  index.update(data,rules);assert.deepEqual(calls,[])
  for(const date of ['2026-10-17','2026-09-10']){
    data={...data,[date]:{...data[date],a:paid(500)}};index.update(data,rules)
    assert.deepEqual(calls.splice(0),[date])
    assert.deepEqual(index.totals('2026-01-01','2026-12-31',rules.professionals),fullTotals(data,'2026-01-01','2026-12-31',rules))
  }
  assert.equal(before.totalIncome,530)
})

test('borrado y movimiento entre días restan y suman sin conservar importes fantasma', () => {
  const index=createIncrementalAccountingIndex();let data=original();index.update(data,rules);index.totals('2026-01-01','2026-12-31',rules.professionals)
  const moved=data['2026-09-10'].a
  data={...data,'2026-09-10':{},'2026-10-17':{...data['2026-10-17'],moved}}
  index.update(data,rules);assert.deepEqual(index.totals('2026-01-01','2026-12-31',rules.professionals),fullTotals(data,'2026-01-01','2026-12-31',rules))
  data={...data};delete data['2026-10-17'];index.update(data,rules)
  assert.deepEqual(index.totals('2026-01-01','2026-12-31',rules.professionals),fullTotals(data,'2026-01-01','2026-12-31',rules))
})

test('servicios, profesionales, porcentaje y excepciones invalidan días aunque no cambien turnos', () => {
  const calls=[], index=createIncrementalAccountingIndex((date,day,r)=>{calls.push(date);return summarizeAccountingDay(date,day,r)}),data=original()
  index.update(data,rules);index.totals('2026-01-01','2026-12-31',rules.professionals)
  for(const change of [{services:[{...service,comisionPct:20}]},{professionals:[{id:'p',comisionPct:30}]},{comisionPct:25},{dateExceptions:{'2026-10-17':{p:10}}}]){
    calls.length=0;const next={...rules,...change};index.update(data,next)
    assert.equal(calls.length,Object.keys(data).length)
    assert.deepEqual(index.totals('2026-01-01','2026-12-31',next.professionals),fullTotals(data,'2026-01-01','2026-12-31',next))
  }
})

const options = (data,gastos=expenses,extra={}) => ({allData:data,gastos,years:[2026,2025],period:'anual',from:'2026-01-01',to:'2026-12-31',commissionFor:(a,date)=>apptComisionTotal(a,rules.comisionPct,rules.services,rules.dateExceptions,date,rules.professionals),...extra})

test('comparativa incremental equivale a la completa en todos los períodos e históricos sin detalle', () => {
  for(const extra of [{},{period:'mes',from:'2026-10-01',to:'2026-10-31'},{period:'semana',from:'2026-10-12',to:'2026-10-17'},{period:'dia',from:'2026-10-17',to:'2026-10-17'},{period:'todo',from:'2025-01-01',to:'2026-12-31'},{period:'custom',from:'2026-09-05',to:'2026-10-20'}]){
    const calculate=createIncrementalBillingComparison(),args=options(original(),expenses,extra)
    assert.deepEqual(calculate(args,[]),aggregateBillingComparison(args))
    assert.deepEqual(calculate(args,[]),aggregateBillingComparison(args))
  }
})

test('comparativa: pago nuevo/antiguo, borrado, traslado y gastos mantienen equivalencia y no recalculan comisiones intactas', () => {
  let data=original(),gastos=expenses,calls=[]
  const calculate=createIncrementalBillingComparison(),commissionFor=(a,date)=>{calls.push(date);return a.services[0].price*.4}
  const check=()=>{const args=options(data,gastos,{commissionFor});const result=calculate(args,[]);const saved=[...calls];assert.deepEqual(result,aggregateBillingComparison({...args,commissionFor:a=>a.services[0].price*.4}));return saved}
  check();calls=[];check();assert.deepEqual(calls,[])
  data={...data,'2026-10-17':{...data['2026-10-17'],a:paid(500)}};calls=[];check();assert.ok(calls.every(date=>date==='2026-10-17'));assert.ok(calls.length>0)
  data={...data,'2026-09-10':{...data['2026-09-10'],a:paid(600)}};calls=[];check();assert.deepEqual(calls,['2026-09-10'])
  data={...data,'2026-10-17':{},'2026-10-18':{a:paid(500)}};check()
  data={...data};delete data['2026-10-18'];check()
  gastos=[...gastos,{fecha:'2026-10-17',monto:75}];check()
  gastos=gastos.filter(g=>g.fecha!=='2026-09-10');check()
})

test('comparativa invalida ante moneda/configuración y conserva resultados anteriores inmutables', () => {
  const calculate=createIncrementalBillingComparison(),data=original(),args=options(data)
  const first=calculate(args,[40,'ARS']),snapshot=structuredClone(first)
  const changed={...args,convertAmount:value=>value/100,commissionFor:a=>a.services[0].price*.2}
  assert.deepEqual(calculate(changed,[20,'USD']),aggregateBillingComparison(changed))
  assert.deepEqual(first,snapshot)
})

test('Hoy puede agregar y quitar la columna Sin hora después de un cambio',()=>{
  const calculate=createIncrementalBillingComparison();let data={'2026-10-17':{a:paid(100)}}
  const check=()=>{const args=options(data,[],{period:'dia',from:'2026-10-17',to:'2026-10-17'});assert.deepEqual(calculate(args,[]),aggregateBillingComparison(args))}
  check();data={...data,'2026-10-17':{a:paid(100,{hour:undefined})}};check();data={'2026-10-17':{}};check()
})

test('el histórico incorpora y elimina años sin conservar buckets anteriores',()=>{
  const calculate=createIncrementalBillingComparison();let data=original()
  for(const next of [data,{...data,'2024-04-01':{a:paid(700)}},{}]){
    data=next;const args=options(data,[],{period:'todo',from:'2024-01-01',to:'2026-12-31'})
    assert.deepEqual(calculate(args,[]),aggregateBillingComparison(args))
  }
})

test('los importes decimales mantienen precisión monetaria tras actualizaciones',()=>{
  const index=createIncrementalAccountingIndex();let data={}
  for(let i=1;i<=20;i++)data[`2026-10-${String(i).padStart(2,'0')}`]={a:paid(10.23+i/100)}
  index.update(data,rules);index.totals('2026-01-01','2026-12-31',rules.professionals)
  for(let i=0;i<100;i++){
    data={...data,'2026-10-17':{a:paid(20.37+i/100)}};index.update(data,rules)
    const actual=index.totals('2026-01-01','2026-12-31',rules.professionals),expected=fullTotals(data,'2026-01-01','2026-12-31',rules)
    assert.ok(Math.abs(actual.totalIncome-expected.totalIncome)<1e-9)
    assert.equal(Math.round(actual.totalIncome*100),Math.round(expected.totalIncome*100))
  }
})


test('detalle diario reutiliza días intactos e invalida turnos, gastos o reglas', () => {
  const scope = [], a = {}, b = {}, expenseA = { monto: 10 }, expenseB = { monto: 20 }
  let calls = 0
  const calculate = () => ++calls
  const first = incrementalDayDetail(scope, '2026-10-17', a, [expenseA], [40], calculate)
  incrementalDayDetail(scope, '2026-09-10', b, [expenseB], [40], calculate)
  assert.equal(incrementalDayDetail(scope, '2026-10-17', a, [expenseA], [40], calculate), first)
  assert.equal(calls, 2)
  incrementalDayDetail(scope, '2026-10-17', {}, [expenseA], [40], calculate)
  assert.equal(calls, 3)
  incrementalDayDetail(scope, '2026-09-10', b, [{ monto: 30 }], [40], calculate)
  assert.equal(calls, 4)
  incrementalDayDetail(scope, '2026-09-10', b, [expenseB], [20], calculate)
  assert.equal(calls, 5)
})


test('pagar y desmarcar un turno pendiente actualiza el día y conserva la fotografía previa',()=>{
  const config={...rules,professionals:[...rules.professionals]};let data=original()
  const before=incrementalAccountingIndex(data,config,'2026-01-01','2026-12-31'),saved=structuredClone(before.totals)
  data={...data,'2026-09-10':{...data['2026-09-10'],b:paid(300)}}
  const after=incrementalAccountingIndex(data,config,'2026-01-01','2026-12-31')
  assert.deepEqual(after.totals,fullTotals(data,'2026-01-01','2026-12-31',config))
  assert.deepEqual(before.totals,saved)
  assert.equal(before.days().get('2026-09-10').totalTurns,1)
  data={...data,'2026-09-10':{...data['2026-09-10'],b:paid(300,{paid:false})}}
  assert.deepEqual(incrementalAccountingIndex(data,config,'2026-01-01','2026-12-31').totals,saved)
})
