const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{test}=require('node:test');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const source=html.match(/const FACILITY_SITES[\s\S]*?(?=function facilityNavigate\()/)?.[0];
assert(source);
const build=vm.runInNewContext(source+'\n;buildFacilitySite');
const dir=[[0,1],[-1,0],[0,-1],[1,0]],key=(x,z)=>x+','+z;
const floor=o=>/^(?:woodfloor(?:Light|Dark)?|brickfloor|stone)$/.test(o.type);
const walkable=o=>floor(o)||/(?:Door|StairUp|StairDown)$/.test(o.type);
function plan(scope){
 const site=build(scope),rot=scope==='base'?3:0,b=site.buildings[rot?1:0];
 const toWorld=(x,z)=>rot?[b.x1+z,b.z2-x]:[b.x1+x,b.z1+z];
 const at=(x,z,y=0)=>{const [wx,wz]=toWorld(x,z);return Array.from(site.map.world.filter(o=>o.x===wx&&o.z===wz&&o.y===y),o=>({...o,rot:(o.rot+4-rot)%4}));};
 const route=(x,z,y=0)=>{const q=[[x,z]],seen=new Set([key(x,z)]);
  for(let i=0;i<q.length;i++)for(const [dx,dz] of dir){
   const a=q[i][0]+dx,c=q[i][1]+dz,k=key(a,c),cell=at(a,c,y);
   if(a<0||a>13||c<0||c>9||seen.has(k)||!cell.some(o=>floor(o)||o.type.startsWith('guildStair'))||cell.some(o=>!walkable(o)))continue;
   seen.add(k);q.push([a,c]);
  }
  return seen;
 };
 return {at,route,toWorld};
}
test('cashier uses exactly the two screenshot marks and leaves a safe adjacent staff standing area',()=>{
 for(const scope of ['kitchen','base']){
  const {at,route}=plan(scope);
  for(const z of [7,8])assert.equal(at(7,z).find(o=>o.type==='counterWood')?.rot,1);
  assert.equal(at(7,8).find(o=>o.type==='poiLedgerPapers')?.rot,3);
  assert.ok(at(8,8).some(o=>o.type==='stoolRound'));
  assert.ok(at(9,4).some(o=>o.type==='counterWood')&&at(10,4).some(o=>o.type==='counterWood'));
  assert.ok(at(9,4).every(o=>o.type!=='poiLedgerPapers')&&at(9,3).every(floor));
  const walk=route(5,9);
  assert.ok(!walk.has(key(8,8)), 'stool and chair tiles are physically occupied');
  for(const p of [[6,7],[6,8],[8,7],[9,6],[9,8],[2,7],[12,8]])assert.ok(walk.has(key(...p)),scope+' reach '+p);
 }
});
test('kitchen has a coherent stone and serving-counter divider, two clear staff routes and no lost WC/cellar access',()=>{
 for(const scope of ['kitchen','base']){
  const {at,route}=plan(scope),walk=route(5,9);
  for(let x=0;x<=13;x++){
   const connector=at(x,4).find(o=>/(?:stonewall(?:Door)?|counterWood)$/.test(o.type));
   assert.ok(connector,scope+' uninterrupted kitchen divider at '+x);
   assert.equal(connector.type==='stonewallDoor',x===4||x===11);
  }
  for(const i of [4,11]){
   assert.equal(at(i,4).find(o=>o.type==='stonewallDoor')?.rot,0);
   assert.ok(walk.has(key(i,5))&&walk.has(key(i,4))&&walk.has(key(i,3)),scope+' cross staff passage '+i);
  }
  for(const p of [[2,7],[10,1],[4,8],[8,6],[12,8],[10,5],[6,7]])assert.ok(walk.has(key(...p)),scope+' preserved access '+p);
  assert.equal(at(3,7).find(o=>o.type==='stonewallDoor')?.rot,1);
  assert.ok(at(11,1).some(o=>o.type==='guildStairDown')&&at(11,1,-1).some(o=>o.type==='guildStairUp'));
  assert.ok(route(12,1,-1).has(key(8,4)));
 }
});
