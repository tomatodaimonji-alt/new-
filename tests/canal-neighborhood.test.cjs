const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const block=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i+1);assert(i>=0&&j>i,a);return html.slice(i,j)};
const build=vm.runInNewContext(block('const FACILITY_SITES=','function workshopResumeDecode(')+';buildFacilitySiteLegacyFrame');
const site=build('base'),at=(x,z)=>site.map.world.filter(o=>o.x===x&&o.z===z&&o.y===0);
const ctx=vm.createContext({facilitySite:{...site,id:'base'},world:site.map.world,poiWalkLevel:0,poiWalkActive:true,
 validPos:(x,z)=>x>=0&&x<96&&z>=0&&z<56,terrainY:()=>0,poiIsMonster:()=>false,poiMonsterAt:()=>null,
 pineSuperVehicleType:()=>false,isFloor:t=>/^(?:road|grass|woodfloor|stone$|earth$|moss$|river$|brickfloor$)/.test(t),
 isWallId:t=>/wall/i.test(t),facilityFloorOwner:()=>null,bridgeSpanElevation:()=>0});
vm.runInContext(block('function poiWalkPassableDoor(','function poiWalkCamera(')+';facilityRefreshCreek()',ctx);
function route(from,to){
 const q=[from],k=(x,z)=>x+','+z,seen=new Set([k(...from)]),goal=k(...to);
 const aMin=Math.min(from[0],to[0])-7,aMax=Math.max(from[0],to[0])+7,bMin=Math.min(from[1],to[1])-4,bMax=Math.max(from[1],to[1])+4;
 for(let i=0;i<q.length;i++){
  const [x,z]=q[i];if(k(x,z)===goal)return true;
  for(const [dx,dz] of [[0,1],[1,0],[0,-1],[-1,0]]){
   const a=x+dx,b=z+dz,key=k(a,b);
   if(!seen.has(key)&&a>=aMin&&a<=aMax&&b>=bMin&&b<=bMax&&ctx.poiWalkCanStep(a,b,x,z)){seen.add(key);q.push([a,b])}
  }
 }
 return false;
}
test('a connected two-tile canal has two complete bridges and preserves the creek and wall collision',()=>{
 assert.deepEqual([site.map.width,site.map.height,site.buildings.length],[96,56,10]);
 assert.equal(site.canal?.water.length,34);
 for(let x=52;x<=68;x++)for(const z of [31,32]){
  assert.equal(at(x,z).filter(o=>o.type==='river').length,1);
  if(x===55||x===67)assert(ctx.poiWalkCanStep(x,z,x,z-1),'walkable crossing '+[x,z]);
  else assert(!ctx.poiWalkCanStep(x,z,x,z-1),'channel off crossing '+[x,z]);
 }
 for(const x of [55,67]){
  assert(!ctx.poiWalkCanStep(x,31,x-1,31),'no sidestep over railing');
  assert(route([x,30],[x,33]));
 }
 assert(ctx.poiWalkCanStep(68,38,67,38),'old woodland bridge');
 assert(ctx.poiWalkCanStep(62,45,61,45),'east gate');
 for(const z of [31,32]){
  assert(at(62,z).some(o=>o.type==='poiFortWall'));
  assert(at(69,z).some(o=>o.type==='river'),'connected to existing creek');
 }
});
test('real homes have a bed, toilet and sink, and all three doors are reachable from the guild plaza',()=>{
 for(const [id,x,z] of [['cottage',50,41],['rowhouse',56,29],['gardener',54,36]]){
  const b=site.buildings.find(p=>p.id===id);assert.deepEqual([b.entrance.x,b.entrance.z],[x,z]);
  const occupied=new Set(Array.from(b.footprint,p=>p.x+','+p.z));
  const items=site.map.world.filter(o=>o.y===0&&occupied.has(o.x+','+o.z));
  for(const t of ['bed','guildLatrine','kitchenSink'])assert(items.some(o=>o.type===t),id+' '+t);
  assert(route([34,20],[x,z]),id+' clear through streets');
 }
});
test('an edited bridge pair closes only its own crossing, never the two other bridges',()=>{
 const i=ctx.world;ctx.world=i.filter(o=>!(o.x===55&&o.z===32&&o.type==='bridgeStoneEnd'));ctx.facilityRefreshCreek();
 assert(!ctx.poiWalkCanStep(55,31));assert(ctx.poiWalkCanStep(67,31));assert(ctx.poiWalkCanStep(68,38));
 ctx.world=i;ctx.facilityRefreshCreek();
});
test('only old layout checkpoints inside the two moved homes translate',()=>{
 const migrate=vm.runInNewContext(block('function workshopResumeTownPosition(','function workshopResumeRestore(')+';workshopResumeTownPosition');
 const f=(x,z,townLayout)=>{const p=migrate({position:{x,z,y:0,facing:2},townLayout});return [p.x,p.z]};
 assert.deepEqual(f(48,41,2),[56,28]);assert.deepEqual(f(37,37,2),[49,38]);
 assert.deepEqual(f(48,41,3),[48,41]);assert.deepEqual(f(79,16),[34,15]);
 assert.deepEqual(f(19,21,2),[19,21]);assert.deepEqual(f(55,30,2),[55,30]);
});
