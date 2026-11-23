const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{createHash}=require('node:crypto');
const {beforeSouthCreek,beforeSouthTown}=require('./mine-history-v165.cjs');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const build=vm.runInNewContext(html.slice(html.indexOf('const FACILITY_SITES=Object.freeze('),html.indexOf('function workshopResumeDecode('))+';buildFacilitySite');
const s=JSON.parse(JSON.stringify(build('base'))),w=s.map.world,k=(x,z)=>x+','+z,at=new Map();
for(const o of w.filter(o=>o.y===0)){const key=k(o.x,o.z);if(!at.has(key))at.set(key,[]);at.get(key).push(o);}
const floor=/^(?:earth|grass\w*|road\w+|woodfloor\w*|stone|brickfloor)$/;
const walk=o=>floor.test(o.type)||/wallDoor$/.test(o.type);
function route(a,goal,{strictFloor=false,avoid=[]}={}){
 const q=[[a.x,a.z]],seen=new Set([k(a.x,a.z)]),blocked=new Set(avoid.map(p=>k(p.x,p.z)));
 for(let i=0;i<q.length;i++){
  const [x,z]=q[i];if(x===goal.x&&z===goal.z)return true;
  for(const [xx,zz] of [[x-1,z],[x+1,z],[x,z-1],[x,z+1]]){
   const key=k(xx,zz),cell=at.get(key)||[];
   if(xx<94||xx>116||zz<108||zz>122||seen.has(key)||blocked.has(key)||!cell.every(walk)||strictFloor&&!cell.some(o=>floor.test(o.type)))continue;
   seen.add(key);q.push([xx,zz]);
  }
 }
 return false;
}
test('two purpose-built traversable buildings connect the old arrival, market, receiving and residence',()=>{
 const t=s.southRoad?.town;assert(t);
 assert.deepEqual(t.bounds,{x1:94,x2:116,z1:108,z2:122,y:0});
 assert.equal(t.name,'街道の宿場');
 const spawn={x:105,z:111};
 for(const p of [t.market.door,t.market.public,t.market.work,t.market.receiving.door,t.market.receiving.stand,t.inn.door,t.inn.home,t.inn.bedStand])
  assert(route(spawn,p,{strictFloor:true}),JSON.stringify(p)+' must lie on a clear authored approach');
 assert(route(t.market.work,t.inn.bedStand,{strictFloor:true}),'bed reached from work');
 assert(route(t.market.receiving.apron,t.market.receiving.stand,{strictFloor:true,avoid:[t.market.door]}),
  'deliveries have a separate usable yard door');
 assert(route(spawn,{x:115,z:115},{strictFloor:true}),'inn washroom has a clear four-tile interior');
 assert(route(spawn,{x:115,z:119},{strictFloor:true}),'inn private room has more than one clear stance');
 assert(at.get(k(t.market.receiving.cabinet.x,t.market.receiving.cabinet.z)).some(o=>o.type===t.market.receiving.cabinet.type));
 assert(at.get(k(t.inn.bed.x,t.inn.bed.z)).some(o=>o.type==='bed'));
 assert.deepEqual(s.buildings.slice(-2).map(b=>b.id),['southMarket','southInn']);
 for(const b of s.buildings.slice(-2))
  assert(w.filter(o=>o.y===1&&/^roof/.test(o.type)&&o.x>=b.x1&&o.x<=b.x2&&o.z>=b.z1&&o.z<=b.z2).length===b.footprint.length);
});
test('town is append-only, uses only the reservation and leaves independent built sites untouched',()=>{
 const prior=beforeSouthCreek(s),head=prior.map.world,tail=w.slice(beforeSouthTown(s).map.world.length);
 assert.equal(createHash('sha256').update(JSON.stringify(head)).digest('hex'),'8fe11e1cf6f3fb771d952c85cbe32d78bf72d0632515637bf4c7c8a2869d21d4');
 assert(tail.length>=350&&tail.length<=560);
 assert(tail.every(o=>o.x>=94&&o.x<=116&&o.z>=108&&o.z<=122&&o.y>=0&&o.y<=1));
 const floorSlots=new Set();
 for(const o of w.filter(o=>o.y===0&&floor.test(o.type))){
  const p=k(o.x,o.z);assert(!floorSlots.has(p),'unique ground surface '+p);floorSlots.add(p);
 }
 assert.equal(build('artisan').buildings.length,1);
});
