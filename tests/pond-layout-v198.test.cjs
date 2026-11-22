const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),{createHash}=require('node:crypto');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8'),cut=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)+1));
const build=vm.runInNewContext(cut('const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+';buildFacilitySite');
const site=JSON.parse(JSON.stringify(build('base'))),world=site.map.world;
const at=(x,z)=>world.filter(o=>o.x===x&&o.z===z&&o.y===0);
const floor=/^(?:earth|stone|road\w+|grassTrampled|grassPebbles)$/;
test('the willow road continues another 29 clear steps without editing any historic cells',()=>{
 assert.equal(createHash('sha256').update(JSON.stringify(world.slice(0,6778))).digest('hex'),'8367f3ea14d25876d953cb9ac071db34fa42f596607bae4aeb73248a9b5aa40a');
 assert.deepEqual([site.map.width,site.map.height],[128,96]);assert(!build('lodging').northTrail);
 const {path,pond}=site.northTrail.marsh;
 assert.equal(path.length,30);assert.deepEqual(path[0],{x:117,z:9});assert.deepEqual(path.at(-1),{x:121,z:28});
 const b=pond.leash;
 for(let i=0;i<path.length;i++){
  const {x,z}=path[i],prior=path[i-1];
  if(prior)assert.equal(Math.abs(x-prior.x)+Math.abs(z-prior.z),1);
  assert(at(x,z).length&&at(x,z).every(o=>floor.test(o.type)),'dry road '+[x,z]);
  assert(!(x>=b.x1&&x<=b.x2&&z>=b.z1&&z<=b.z2),'main road is never inside enemy leash');
 }
 assert(world.length-6778<105);
});
test('pond has connected water, guard on wet cell, and two dry exits for the player',()=>{
 const {marsh:m}=site.northTrail,p=m.pond,k=(x,z)=>x+','+z;
 assert.equal(p.name,'アメンボの池');assert.equal(p.difficulty,2);
 assert.deepEqual(p.guard,{x:117,z:28,y:0,type:'monsterPondSkater'});
 assert(at(117,28).some(o=>o.type==='water')&&at(117,28).some(o=>o.type===p.guard.type));
 assert.deepEqual(p.reward,{id:'north-marsh-herb',type:'healingHerb',count:1,x:115,z:32,y:0});
 assert.deepEqual(at(115,32).map(o=>o.type),['earth']);
 for(const [x,z] of [[118,29],[118,30],[118,31],[118,32],[117,32],[116,32],[115,32]])
  assert(at(x,z).length&&at(x,z).every(o=>floor.test(o.type)));
 const wet=new Set(p.water.map(({x,z,y})=>{assert.equal(y,0);assert(at(x,z).some(o=>o.type==='water'));return k(x,z)}));
 const seen=new Set(),todo=[[117,28]];
 for(let i=0;i<todo.length;i++){
  const [x,z]=todo[i],key=k(x,z);if(seen.has(key))continue;seen.add(key);
  for(const [dx,dz] of [[0,1],[0,-1],[1,0],[-1,0]])if(wet.has(k(x+dx,z+dz)))todo.push([x+dx,z+dz]);
 }
 assert.equal(seen.size,wet.size);assert(wet.size>=18&&wet.size<=26);
 assert(Array.isArray(p.bank));
 assert.deepEqual(p.bank[0],{x:121,z:26});assert.deepEqual(p.bank.at(-1),{x:121,z:29});
 for(let i=0;i<p.bank.length;i++){
  const {x,z}=p.bank[i],last=p.bank[i-1];assert(!wet.has(k(x,z)));
  assert(at(x,z).length&&at(x,z).every(o=>floor.test(o.type)),'dry dodge '+[x,z]);
  if(last)assert.equal(Math.abs(last.x-x)+Math.abs(last.z-z),1);
 }
});
