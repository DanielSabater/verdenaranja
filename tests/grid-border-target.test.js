import test from 'node:test'
import assert from 'node:assert/strict'
import { gridBorderTarget } from '../src/utils/gridBorderTarget.js'
const columns = [{profId:'Claudia',left:100,right:200},{profId:'Macarena',left:200,right:300}]
const rows = [{hour:'09:30',top:100,bottom:200},{hour:'10:00',top:200,bottom:300}]
test('divisorias verticales y horizontales se asignan sin huecos',()=>{
  assert.deepEqual(gridBorderTarget(200,150,columns,rows),{profId:'Macarena',hour:'09:30'})
  assert.deepEqual(gridBorderTarget(150,200,columns,rows),{profId:'Claudia',hour:'10:00'})
  assert.deepEqual(gridBorderTarget(200,200,columns,rows),{profId:'Macarena',hour:'10:00'})
})
test('el borde conserva el orden real de profesionales y coordenadas con scroll',()=>{
  assert.deepEqual(gridBorderTarget(10,10,[{profId:'Macarena',left:-20,right:80}],[{hour:'11:00',top:-50,bottom:50}]),{profId:'Macarena',hour:'11:00'})
})
test('fuera de la planilla no se inventa un destino',()=>{
  assert.equal(gridBorderTarget(99,150,columns,rows),null)
  assert.equal(gridBorderTarget(150,300,columns,rows),null)
})
