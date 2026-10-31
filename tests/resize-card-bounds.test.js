import test from 'node:test'
import assert from 'node:assert/strict'
import { resizeCardBounds } from '../src/utils/resizeCardBounds.js'
const base = { origHourIdx: 4, hourIdx: 4, origSlots: 3, slots: 3, deltaY: 0 }
test('borde superior sigue al cursor y conserva el final al extender hacia arriba',()=>{
  const p = {...base, edge:'top', hourIdx:3, slots:4, deltaY:-60}
  const b = resizeCardBounds(p)
  assert.equal((p.hourIdx-p.origHourIdx)*100+b.top, p.deltaY+2)
  assert.equal(b.bottom,2)
})
test('borde superior sigue al cursor al acortar y al cruzar un intervalo',()=>{
  for(const deltaY of [20,49,51,80,140]){
    const snapped=Math.round(deltaY/100)
    const p={...base,edge:'top',deltaY,hourIdx:4+snapped,slots:3-snapped}
    const b=resizeCardBounds(p)
    assert.equal(snapped*100+b.top,deltaY+2)
    assert.equal(b.bottom,2)
  }
})
test('borde inferior mantiene el inicio y conserva su comportamiento continuo',()=>{
  assert.deepEqual(resizeCardBounds({...base,edge:'bottom',slots:4,deltaY:70}),{top:2,bottom:32})
})
