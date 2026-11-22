const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),{createHash}=require('node:crypto');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)+1));
const build=vm.runInNewContext(cut('const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+';buildFacilitySite');
const {beforeArmedEncounters}=require('./mine-history-v165.cjs');
const site=beforeArmedEncounters(JSON.parse(JSON.stringify(build('base')))),world=site.map.world;
const at=(x,z,y)=>world.filter(o=>o.x===x&&o.z===z&&o.y===y);
test('flooded chapel only appends grading and exact stair pairs to the old map',()=>{
 const c=site.chapel;assert.equal(c.name,'水没した礼拝堂');
 assert.equal(createHash('sha256').update(JSON.stringify(world.slice(0,6368))).digest('hex'),'1a843d4e31ae48c3b8fa9bacf93b738ea308fc54aa3483a6a273b495628b15fb');
 assert(!build('lodging').chapel);
 assert.deepEqual(c.entrance,{x:124,z:81,y:0,type:'guildStairDown'});
 assert.deepEqual(c.exit,{x:78,z:89,y:-1,type:'guildStairUp'});
 for(const p of [c.entrance,c.exit])assert(at(p.x,p.z,p.y).some(o=>o.type===p.type)&&at(p.x,p.z,p.y).some(o=>/^(?:stone|road)/.test(o.type)));
 const surface=c.surfaceStand;
 assert.deepEqual([surface.x,surface.z],[124,82]);assert(at(123,82,0).some(o=>/grass|earth|road/.test(o.type)));
 assert(world.slice(6368).length<210);
});
test('short ford and longer genuinely dry lane reunite before a treasurable guarded one-tile gate',()=>{
 const c=site.chapel,added=world.slice(6368).filter(o=>o.y===-1),key=(x,z)=>x+','+z;
 const wet=new Set(c.shallows.map(p=>key(p.x,p.z))),deep=new Set(c.deep.map(p=>key(p.x,p.z)));
 const floor=new Set(added.filter(o=>/^(?:stone|water|moss|road\w+)$/.test(o.type)).map(o=>key(o.x,o.z)));
 const fixtures=new Set(added.filter(o=>/^(?:benchWood|brokenPillar|ruinStonePost|ancientAltar|rewardChest)$/.test(o.type)).map(o=>key(o.x,o.z)));
 const walls=new Set(added.filter(o=>/^(?:stone|moss)wall$/.test(o.type)).map(o=>key(o.x,o.z)));
 const bfs=(from,to,dry,unlocked)=>{
  const q=[[...from,0]],seen=new Set();for(let i=0;i<q.length;i++){
   const [x,z,n]=q[i],k=key(x,z);if(seen.has(k))continue;seen.add(k);
   if(x===to[0]&&z===to[1])return n;
   for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const ek=key(x+dx,z+dz);if(!floor.has(ek)||deep.has(ek)||dry&&wet.has(ek)||fixtures.has(ek)||!unlocked&&ek===key(c.gate.x,c.gate.z))continue;
    q.push([x+dx,z+dz,n+1]);
   }
  }return Infinity;
 };
 assert.deepEqual([bfs([78,88],[78,80],false,false),bfs([78,88],[78,80],true,false)],[8,14]);
 assert.equal(bfs([78,88],[78,76],true,false),Infinity);
 assert(Number.isFinite(bfs([78,88],[78,76],true,true)));
 assert(Number.isFinite(bfs([78,88],[78,89],true,false)));
 assert(at(c.elite.x,c.elite.z,-1).some(o=>o.type===c.elite.type));
 for(const k of [...wet,...deep]){const [x,z]=k.split(',').map(Number);assert(at(x,z,-1).some(o=>o.type==='water'))}
 for(const k of walls){
  assert(!floor.has(k));const [x,z]=k.split(',').map(Number);
  for(const dz of [-1,1])if(walls.has(key(x+1,z+dz)))assert(walls.has(key(x+1,z))||walls.has(key(x,z+dz)));
 }
});
