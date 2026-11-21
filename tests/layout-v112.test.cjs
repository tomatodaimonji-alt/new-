const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{test}=require('node:test');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const source=html.match(/const FACILITY_SITES[\s\S]*?(?=function facilityNavigate\()/)?.[0];
assert(source);
const build=vm.runInNewContext(source+'\n;buildFacilitySite');
const dirs=[[0,1],[-1,0],[0,-1],[1,0]],key=(x,z)=>x+','+z;
function local(scope,id){
 const s=build(scope),b=s.buildings[scope==='base'?(id==='kitchen'?1:2):0],rotation=scope==='base'?(id==='kitchen'?3:1):0;
 const world=(x,z)=>rotation===3?[b.x1+z,b.z2-x]:rotation===1?[b.x2-z,b.z1+x]:[b.x1+x,b.z1+z];
 const at=(x,z,y=0)=>{const [wx,wz]=world(x,z);
  return Array.from(s.map.world.filter(o=>o.x===wx&&o.z===wz&&o.y===y),o=>({...o,rot:(o.rot+4-rotation)%4}));};
 function route(){
  const q=[[5,9]],seen=new Set([key(5,9)]);
  for(let i=0;i<q.length;i++)for(const [dx,dz] of dirs){
   const nx=q[i][0]+dx,nz=q[i][1]+dz,k=key(nx,nz),cell=at(nx,nz);
   if(seen.has(k)||!cell.some(o=>/^(woodfloor(?:Light|Dark)?|stone|brickfloor)$/.test(o.type))||
      cell.some(o=>!/^(woodfloor(?:Light|Dark)?|stone|brickfloor)$|(?:Door|StairUp|StairDown)$/.test(o.type)))continue;
   seen.add(k);q.push([nx,nz]);
  }
  return seen;
 }
 return {at,route,b};
}
test('food-hall marked service counter has supported paperwork and a dedicated stool on its staff side',()=>{
 for(const scope of ['kitchen','base']){
  const {at,route}=local(scope,'kitchen');
  assert.ok(at(9,4).some(o=>o.type==='counterWood'));
  assert.equal(at(9,4).find(o=>o.type==='poiLedgerPapers')?.rot,2);
  assert.ok(at(9,3).some(o=>o.type==='stoolRound'));
  assert.ok(at(10,4).some(o=>o.type==='counterWood'));
  assert.ok(at(7,8).some(o=>o.type==='counterWood'), 'unmarked entry counter unchanged');
  const walk=route();
  assert.ok(!walk.has(key(9,3)), 'occupied stool counted as obstacle');
  for(const col of [4,8,12])for(let z=5;z<=8;z++)assert.ok(walk.has(key(col,z)),scope+' aisle '+[col,z]);
  for(const p of [[2,7],[6,8],[8,7],[10,5],[10,1],[9,2]])assert.ok(walk.has(key(...p)),scope+' route '+p);
 }
});
test('workshop work-order desk, supported paperwork and stool fit without blocking shop routes',()=>{
 for(const scope of ['workshop','base']){
  const {at,route}=local(scope,'workshop'),walk=route();
  assert.equal(at(3,5).find(o=>o.type==='counterWood')?.rot,3);
  assert.equal(at(3,5).find(o=>o.type==='poiLedgerPapers')?.rot,1);
  assert.ok(at(2,5).some(o=>o.type==='stoolRound'));
  assert.ok(!walk.has(key(2,5)));
  assert.ok(at(5,1).some(o=>o.type==='displayShelf')&&at(4,1).some(o=>o.type==='table'));
  for(const p of [[5,8],[4,8],[1,5],[4,5],[3,6],[4,2],[9,3],[8,6]])assert.ok(walk.has(key(...p)),scope+' route '+p);
 }
});
