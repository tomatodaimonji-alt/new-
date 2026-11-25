const a=require('node:assert/strict'),{test}=require('node:test'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync('world-editor.html','utf8'),i=h.indexOf('// BEGIN WELL PLAZA TONES'),j=h.indexOf('// END WELL PLAZA TONES');a(i>=0&&j>i);
const c=vm.createContext({facilityFloorOwner:(_,z)=>z===40?1:null});
vm.runInContext(h.slice(i,j),c);
const run=s=>JSON.parse(vm.runInContext('JSON.stringify('+s+')',c));
test('select only nearest authored ground well at the existing spawn, not other maps',()=>{
 const a1=run(`[ 'base','snowpass' ].map(id=>poiWellPlazaPlan({id,spawn:{x:41,z:43}},
  [{x:80,z:80,y:0,type:'wellStone'},{x:43,z:39,y:0,type:'wellStone'},{x:41,z:43,y:1,type:'wellStone'}]))`);
 a.deepEqual(a1,[{x:43,z:39},null]);
});
test('local stone gets warmer without changing geometry, distant grass and water stay byte-equivalent',()=>{
 const v=run(`[ [43,39,'roadCobbleFull'],[100,39,'grass'],[43,39,'water'] ].map(([x,z,k])=>{
  const m={p:[4,0,7],n:[0,1,0],c:[.46,.46,.46]};poiWellPlazaTint(m,x,z,k,{x:43,z:39});return m;
 })`);
 a(v[0].c[0]>v[0].c[1]&&v[0].c[1]>v[0].c[2]);
 a.deepEqual(v.map(q=>q.p),Array(3).fill([4,0,7]));
 a.deepEqual(v.slice(1).map(q=>q.c),Array(2).fill([.46,.46,.46]));
});
test('warm selected tint on outdoor wood only, not indoor furniture or other authored parts',()=>{
 const v=run(`[ [39,'benchWood'],[40,'benchWood'],[39,'wall'],[39,'bed'] ].map(([z,type])=>{
  const m={c:[.3,.3,.3,.4,.4,.4]};poiWellPlazaWood(m,1,{type,x:43,z,y:0},{x:43,z:39});return m.c;
 })`);
 a(v[0][3]>.4);
 for(const k of v.slice(1))a.deepEqual(k,[.3,.3,.3,.4,.4,.4]);
});
