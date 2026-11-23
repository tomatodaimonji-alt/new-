const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),{createHash}=require('node:crypto');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const build=vm.runInNewContext(h.slice(h.indexOf('const FACILITY_SITES=Object.freeze('),h.indexOf('function workshopResumeDecode('))+';buildFacilitySite');
const plain=s=>JSON.parse(JSON.stringify(s)),sha=s=>createHash('sha256').update(JSON.stringify(s)).digest('hex');
const base=plain(build('base')),world=base.map.world,head=world.slice(0,7456),added=world.slice(7456);
const at=(x,z)=>world.filter(o=>o.x===x&&o.z===z&&o.y===0);
const edge=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.z-b.z);
test('only the base southern limit grows; no authored object moves or changes',()=>{
 assert.deepEqual([base.map.width,base.map.height,base.map.size,base.townOffset],[128,128,128,22]);
 assert.equal(sha(head),'94aec8afd4ce646ea255d19d5bd90b71a5ad93de0a9197285d49323b4ad76b3c');
 const {southRoad,...historical}=plain(base);
 historical.map.height=96;delete historical.map.world;
 assert.equal(sha(historical),'f84cf093eb3ca246172bbc5c8f4106f5a9a408452a24402bf82c163881e2d381','all other original base metadata');

 assert.equal(sha(plain(build('artisan')).map.world),'6071fbb77539014cebbe104d49ba8fab02b29b634d2442bd37371063d5f200e1');
 assert(!build('artisan').southRoad);
 assert(added.length>=65&&added.length<=150);
 assert(added.every(o=>o.y===0&&o.x>=0&&o.x<128&&o.z>=92&&o.z<128));
 const old=new Set(head.map(o=>[o.x,o.z,o.y].join(',')));
 for(const o of added)assert(!old.has([o.x,o.z,o.y].join(',')));
 assert.deepEqual(added.filter(o=>o.z<96).map(({x,z})=>[x,z]),[[97,92],[97,93],[97,94],[97,95]]);
});
test('road and optional rest shelter are grounded; protected landing stays clear',()=>{
 const {path,shelter,arrival,reserve}=base.southRoad;
 const dry=/^(?:earth|roadGravelFull|roadCutStoneFull|roadCobbleFull)$/;
 const validate=p=>{
  for(let i=0;i<p.length;i++){
   const {x,z}=p[i],records=at(x,z);
   if(i)assert.equal(edge(p[i-1],p[i]),1);
   assert.equal(records.length,1,[x,z,records]);assert.match(records[0].type,dry);
  }
 };
 assert.deepEqual(path[0],{x:97,z:91});assert.deepEqual(path.at(-1),{x:105,z:111});
 assert(path.length>=26&&path.length<=38);validate(path);validate(shelter.path);
 assert(path.some(p=>edge(p,shelter.path[0])===0));
 assert.deepEqual(shelter.path.at(-1),{x:shelter.stand.x,z:shelter.stand.z});
 assert.equal(edge(shelter.stand,shelter),1);
 assert(at(shelter.x,shelter.z).some(o=>o.type==='marketStallWood'));
 assert(added.filter(o=>/^tree/.test(o.type)).length<=21);
 for(const o of added.filter(o=>o.x>=reserve.x1&&o.x<=reserve.x2&&o.z>=reserve.z1&&o.z<=reserve.z2))
  assert.match(o.type,dry);
 for(let z=arrival.z1;z<=arrival.z2;z++)for(let x=arrival.x1;x<=arrival.x2;x++){
  assert.equal(at(x,z).length,1);assert.match(at(x,z)[0].type,dry);
 }
});
