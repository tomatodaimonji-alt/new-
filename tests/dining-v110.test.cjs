const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{test}=require('node:test');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const snippet=html.match(/const FACILITY_SITES[\s\S]*?(?=function facilityNavigate\()/)?.[0];
assert(snippet);
const build=vm.runInNewContext(snippet+'\n;buildFacilitySite');
const dirs=[[0,1],[-1,0],[0,-1],[1,0]],key=(x,z)=>x+','+z;
const walkable=o=>/^(woodfloor(?:Light|Dark)?|brickfloor|stone)$|(?:Door|StairUp|StairDown)$/.test(o.type);
function plan(scope){
 const s=build(scope),group=scope==='base',b=s.buildings[group?1:0];
 const world=(x,z)=>group?[b.x1+z,b.z2-x]:[b.x1+x,b.z1+z];
 const local=(x,z)=>group?[b.z2-z,x-b.x1]:[x-b.x1,z-b.z1];
 const at=(x,z,y=0)=>{const [wx,wz]=world(x,z);return s.map.world.filter(o=>o.x===wx&&o.z===wz&&o.y===y)
  .map(o=>({...o,rot:(o.rot+(group?1:0))%4}));};
 function route(y,x,z){
  const valid=new Set(Array.from(b.floorFootprints[y],p=>key(...local(p.x,p.z))));
  const seen=new Set([key(x,z)]),q=[[x,z]];
  for(let i=0;i<q.length;i++)for(const [dx,dz] of dirs){
   const nx=q[i][0]+dx,nz=q[i][1]+dz,k=key(nx,nz);
   if(!valid.has(k)||seen.has(k)||at(nx,nz,y).some(o=>!walkable(o)))continue;
   seen.add(k);q.push([nx,nz]);
  }
  return seen;
 }
 return {at,route,world,s,b};
}
test('dining hall grows only toward the old exterior, with matching stone toilet door and dedicated sign',()=>{
 for(const scope of ['kitchen','base']){
  const {at,b,world}=plan(scope);
  assert.equal(b.footprint.length,140);
  assert.deepEqual(Array.from(at(3,7).filter(o=>o.type.endsWith('Door')),o=>[o.type,o.rot]),[['stonewallDoor',1]]);
  assert.equal(at(1,6).find(o=>o.type==='guildLatrine')?.rot,3);
  assert.ok(at(4,9).some(o=>o.type==='poiDiningSign'&&o.rot===0)&&at(4,9).some(o=>o.type==='stonewall'));
  assert.ok(at(5,9).some(o=>o.type==='stonewallDoor'&&o.rot===0));
  if(scope==='base')assert.deepEqual(world(5,9),[11,17]);
 }
});
test('seated chairs cannot block the full-tile dining loop, facilities or entry counter',()=>{
 for(const scope of ['kitchen','base']){
  const {at,route}=plan(scope),hall=route(0,5,9);
  for(const col of [4,8,12])for(let z=5;z<=8;z++){
   assert.ok(at(col,z).length&&at(col,z).every(walkable),scope+' unobstructed lane '+[col,z]);
   assert.ok(hall.has(key(col,z)),scope+' can reach lane '+[col,z]+' without walking through chairs');
  }
  const seated=[[5,6],[7,6],[6,5],[9,6],[11,6],[10,7]];
  for(const p of seated)assert.ok(at(...p).some(o=>o.type==='chairWood')&&!hall.has(key(...p)));
  for(const z of [7,8])assert.ok(at(7,z).some(o=>o.type==='counterWood'&&o.rot%2===1));
  for(const p of [[6,7],[6,8],[8,7],[8,8],[2,7],[10,5],[10,1]])assert.ok(hall.has(key(...p)),scope+' reach '+p);
 }
});
test('cellar corner stair holes and approach are aligned in both directions',()=>{
 for(const scope of ['kitchen','base']){
  const {at,route}=plan(scope),up=at(11,1,-1).find(o=>o.type==='guildStairUp'),down=at(11,1).find(o=>o.type==='guildStairDown');
  assert.equal(up?.rot,3);assert.equal(down?.rot,3);
  assert.ok(!at(11,1).some(o=>walkable(o)&&!o.type.startsWith('guildStair')));
  assert.ok(at(5,3).some(o=>o.type==='brickfloor'));
  assert.ok(route(0,5,9).has(key(10,1)));
  const cellar=route(-1,12,1);
  for(const p of [[11,1],[12,2],[8,4]])assert.ok(cellar.has(key(...p)),scope+' cellar reach '+p);
 }
});
