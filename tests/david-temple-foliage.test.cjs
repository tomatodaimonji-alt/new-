const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const idx=h.indexOf('const FACILITY_SITES=Object.freeze('),end=h.indexOf('function workshopResumeDecode(',idx);
const result=vm.runInNewContext(h.slice(idx,end)+";buildFacilitySite('base')");
const plain=obj=>JSON.parse(JSON.stringify(obj));
const {map,davidTemple:d}=plain(result),site=map.world;
test('small natural clusters reuse existing dry landscape assets outside the historical route and battle apron',()=>{
 assert(d.ring&&!d.dome,'real latest roofless map');
 const from=site.findIndex(o=>o.type==='monsterStoneDavid')+1;
 const plants=site.slice(from,d.authored.index+d.authored.count);
 assert(plants.length>=20&&plants.length<=34);
 const trees=plants.filter(o=>o.type.startsWith('tree'));
 assert(trees.length>=5&&trees.length<=9);
 const types=new Set(plants.map(o=>o.type));
 for(const type of ['treeOak','treeBirch','tallGrass','bushFern'])assert(types.has(type),type);
 assert.equal(new Set(plants.map(o=>o.x+','+o.z)).size,plants.length);
 const route=[...d.approach,...Array.from({length:11},(_,i)=>({x:24,z:92+i})),
  ...Array.from({length:7},(_,i)=>({x:29+i,z:88}))];
 for(const o of plants){
  assert.equal(o.y,0);
  assert(Math.hypot(o.x-d.ring.x,o.z-d.ring.z)>d.ring.radius+.72);
  assert(route.every(p=>Math.hypot(p.x-o.x,p.z-o.z)>(o.type.startsWith('tree')?3:1.2)));
  assert(!site.slice(0,from).some(b=>b.x===o.x&&b.z===o.z),'no overwrite or hanging vegetation');
  if(o.type.startsWith('tree')||o.type==='bush')assert(d.resumeSolid.some(b=>b.x===o.x&&b.z===o.z&&b.type===o.type));
 }
 const counters=[plants.filter(o=>o.x<23&&o.z<96),plants.filter(o=>o.x>34&&o.z<96),plants.filter(o=>o.z>96)];
 assert(counters.every(v=>v.length>=4));
 assert(plants.every(o=>!(o.x>=13&&o.x<=35&&o.z>=93&&o.z<=115)));
});
test('authored planting has a bounded low-poly static vertex budget',()=>{
 const chunk=(a,b)=>{let i=h.indexOf(a),j=h.indexOf(b,i+1);assert(i>=0&&j>i,a);return h.slice(i,j)};
 const ids=['treePine','treeBirch','treeOak','bushFern'];
 const light=['treeRound','bush'].map(id=>h.slice(h.indexOf("case '"+id+"':")).split(String.fromCharCode(10))[0]).join(String.fromCharCode(10));
 const cases=ids.map(id=>{const a=h.indexOf("case '"+id+"':"),b=h.indexOf('break;}',a);assert(a>0&&b>a);return h.slice(a,b+7)}).join('\n');
 const emit=vm.runInNewContext(chunk('function tri(','function detailedTree(')+chunk('function expansionGeometry(','function towerPartGeometry(')+
  '\nfunction plant(m,id,x,y,z){const wood=[.4,.3,.2],leaf=[.3,.5,.3];switch(id){'+cases+light+' default:expansionGeometry(m,id,x,y,z)}};plant');
 const plants=site.slice(site.findIndex(o=>o.type==='monsterStoneDavid')+1,d.authored.index+d.authored.count);
 let total=0;
 for(const o of plants){
  const m={p:[],n:[],c:[]};
  emit(m,o.type,o.x+.5,0,o.z+.5);
  assert(m.p.length>70&&m.p.length===m.n.length&&m.p.length===m.c.length,o.type);
  const top=Math.max(...m.p.filter((v,i)=>i%3===1));
  assert(top<(o.type.startsWith('tree')?3.5:1.05),o.type+' understory does not dominate the silhouette');
  total+=m.p.length/3;
 }
 assert(total<18000,'extra static vertices '+total);
});
