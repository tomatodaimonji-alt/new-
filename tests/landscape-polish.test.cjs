const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),test=require('node:test');
const full=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const creekStart=full.indexOf('  // Woodland creek:');
const spawn=full.indexOf('  spawn={x:19,z:21};',creekStart);
assert(creekStart>=0&&spawn>creekStart);
const after=full.slice(0,creekStart)+full.slice(spawn);
const a=after.indexOf('  // Small east-side rest glade and staggered grass shoulders');
const b=after.indexOf('  spawn={x:19,z:21};',a+1);
assert(a>=0&&b>a,'missing landscape dressing block');
const before=after.slice(0,a)+after.slice(b);
function parse(html,id){
 const a=html.indexOf('const FACILITY_SITES=Object.freeze('),b=html.indexOf('function workshopResumeDecode(',a);
 return JSON.parse(JSON.stringify(vm.runInNewContext(html.slice(a,b)+';buildFacilitySiteLegacyFrame('+JSON.stringify(id)+')')));
}
test('a lightly furnished eastern rest glade leaves existing town and trail intact',()=>{
 const a=parse(before,'base'),b=parse(after,'base'),saved=new Set(a.map.world.map(JSON.stringify));
 assert.deepEqual([b.map.width,b.map.height,b.spawn,b.buildings],[a.map.width,a.map.height,a.spawn,a.buildings]);
 for(const id of ['lodging','kitchen','workshop','artisan','stable','homes','toolshop']) assert.deepEqual(parse(after,id),parse(before,id),id);
 const added=b.map.world.filter(x=>!saved.delete(JSON.stringify(x)));
 assert.equal(saved.size,0);
 assert(added.some(o=>o.x===65&&o.z===33&&o.type==='benchWood'));
 assert(added.some(o=>o.x===67&&o.z===33&&o.type==='grassTrampled'));
 assert(added.some(o=>o.x===22&&o.z===53&&o.type==='grassMeadow'));
 assert(added.length<=28);
 assert(!added.some(o=>/tree|fence|wall/i.test(o.type)));
 for(const [x,z] of [[67,38],[68,35],[34,53],[10,41],[19,42]]) assert(!added.some(o=>o.x===x&&o.z===z));
});
test('implicit base grass blends at adjacent tile corners without more geometry',()=>{
 const known=after.indexOf('function pineBaseNatureTint(');
 const end=after.indexOf('function ',after.indexOf('\n}',after.indexOf('function addFloorTile(',known))+3);
 const prim=after.slice(after.indexOf('function tri('),after.indexOf('\n',after.indexOf('function quad(')));
 const helpers=after.slice(after.indexOf('function surfaceNoise('),after.indexOf('function roadConnections('));
 const run=vm.runInNewContext(prim+'\n'+helpers+'\n'+after.slice(known,end)+`;((blend)=>{
   const ms=[{p:[],n:[],c:[]},{p:[],n:[],c:[]}];
   ms.forEach((m,i)=>addFloorTile(m,64+i,37,'grass',99999,0,blend?(typeof pineBaseGrassCorner==='function'?pineBaseGrassCorner:pineBaseNatureTint(64+i,37)):null));
   return ms;
 })`,{ROAD_IDS:new Set()});
 const [a,b]=run(true);
 assert.equal(a.p.length,18);assert.equal(b.p.length,18);
 assert.deepEqual(Array.from(a.c.slice(15,18)),Array.from(b.c.slice(0,3)));
 assert.notDeepEqual(Array.from(a.c.slice(0,3)),Array.from(a.c.slice(15,18)));
 const [normal]=run(false);
 assert.deepEqual(Array.from(normal.c.slice(0,3)),Array.from(normal.c.slice(15,18)));
});
