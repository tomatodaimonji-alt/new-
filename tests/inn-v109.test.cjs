const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{test}=require('node:test');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const source=html.match(/const FACILITY_SITES[\s\S]*?(?=function facilityNavigate\()/)?.[0];
assert(source);
const build=vm.runInNewContext(source+'\n;buildFacilitySite');
const dirs=[[0,1],[-1,0],[0,-1],[1,0]],key=(x,z)=>x+','+z;
const floor=o=>/^(?:woodfloor(?:Light|Dark)?|brickfloor|stone)$/.test(o.type);
function plan(scope){
 const s=build(scope),b=s.buildings[0];
 const at=(x,z,y)=>s.map.world.filter(o=>o.x===x+b.x1&&o.z===z+b.z1&&o.y===y);
 function route(y,x,z){
  const ok=new Set(Array.from(b.floorFootprints[y],p=>key(p.x-b.x1,p.z-b.z1)));
  const seen=new Set([key(x,z)]),q=[[x,z]];
  for(let i=0;i<q.length;i++)for(const [dx,dz] of dirs){
   const nx=q[i][0]+dx,nz=q[i][1]+dz,k=key(nx,nz);
   if(!ok.has(k)||seen.has(k)||at(nx,nz,y).some(o=>!floor(o)&&!/Door$/.test(o.type)&&!['chairWood','benchWood','guildStairUp','guildStairDown'].includes(o.type)))continue;
   seen.add(k);q.push([nx,nz]);
  }
  return seen;
 }
 return {at,route};
}
test('the exact red upstairs mark gets a plant, exact yellow bench is removed, ground bench stays',()=>{
 for(const id of ['lodging','base']){
  const {at}=plan(id);
  assert.deepEqual(Array.from(at(1,4,1).filter(o=>!floor(o)),o=>o.type),['poiPottedPlant']);
  assert.ok(at(1,6,1).length&&at(1,6,1).every(floor));
  assert.ok(at(8,8,0).some(o=>o.type==='benchWood'));
 }
});
test('the stair takes ascent from the front side (+Z) to a real upstairs landing (-Z), and access stays open',()=>{
 for(const id of ['lodging','base']){
  const {at,route}=plan(id);
  assert.equal(at(10,6,0).find(o=>o.type==='guildStairUp')?.rot,0);
  assert.equal(at(10,6,1).find(o=>o.type==='guildStairDown')?.rot,0);
  assert.ok(route(0,5,9).has(key(10,7))&&at(10,7,0).every(floor));
  assert.ok(at(10,5,1).every(floor)&&at(10,5,1).some(floor));
  const upper=route(1,10,5);
  for(const p of [[4,2],[7,2],[5,8],[1,6]])assert.ok(upper.has(key(...p)),id+' upstairs still reaches '+p);
 }
});
