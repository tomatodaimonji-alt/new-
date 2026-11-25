const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const html=fs.readFileSync(process.argv[2]||'world-editor.html','utf8');
const cut=(a,b)=>{const x=html.indexOf(a),y=html.indexOf(b,x+1);assert(x>=0&&y>x,a);return html.slice(x,y)};
const source=()=>cut('// BEGIN TOWN GATEWAY VISITORS','// END TOWN GATEWAY VISITORS');
const pos=p=>[p.x,p.z,p.y];
function runtime(opts={}){
 const site=vm.runInNewContext(cut('const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+";buildFacilitySite('base')");
 site.id='base';const world=site.map.world;
 const c={facilitySite:site,world,MAP_W:site.map.width,MAP_H:site.map.height,terrainHeights:new Map(site.map.terrainHeights.map(o=>[o.x+','+o.z,o.h])),facilityCreekIndex:null,
 poiWalkX:0,poiWalkZ:0,poiWalkLevel:0,poiWalkViewX:0,poiWalkViewZ:0,poiTownDialogue:null,poiTownAmbient:null,poiWalkPlayerPose:()=>null,
 poiTownNpcAct(a,label){a.activity=label},poiTownNpcPlayerBlocksStep:()=>false,poiTownNpcStepT:a=>a.stepping?.8:1,
 parameters:()=>({vp:[]}),terrainY:()=>0,poiOverlandBoxVisible:()=>opts.visible??false};
 vm.createContext(c);vm.runInContext(cut('const terrainKey=','const terrainY=')+cut('function terrainPassable(','function waterfallFace(')+
 cut('const STAIR_DIRECTIONS=','function elevationStairGeometry(')+cut('const ROAD_BASES=','const baseRoad=')+
 cut('const WALL_MATERIAL_IDS=','// Shared staggered timber')+html.match(/^function isFloor\(t\)\{.+\}$/m)[0]+'\n'+
 cut('function poiWalkPassableDoor','let facilityCreekIndex=')+
 cut('const POI_TOWN_WALK_DECOR=','function poiTownNpcExistsBed(')+source()+
 '\nthis.roles=poiTownGatewayRoles(); this.actors=poiTownNpcActors;this.routine=poiTownGatewayRoutine;',c);
 return c;
}
test('two roles take real authored routes across different gates and use distinct off-lane dwell spots',()=>{
 const c=runtime(),roles=Array.from(c.roles);assert.equal(roles.length,2);
 assert.equal(new Set(roles.map(r=>r.originId)).size,2);
 assert.equal(new Set(roles.map(r=>r.gatewayId)).size,2);
 assert(roles[0].arrives+45<roles[1].arrives);
 for(const r of roles){
  const pts=[r.home,...r.gateway,r.work,r.public];assert(pts.every(p=>c.poiTownNpcStance(p)));
  const lengths=pts.slice(1).map((p,i)=>c.poiTownFindPath(pts[i],p)?.length);
  assert(lengths.every(n=>n>0&&n<=58),JSON.stringify(lengths));assert.equal(lengths[1],2);
  const back=c.poiTownFindPath(r.gateway[1],r.gateway[0]);assert.equal(back.length,2);
  assert(c.world.some(o=>o.type==='poiFortGate'&&o.x===(r.gateway[0].x+r.gateway[1].x)/2&&o.z===(r.gateway[0].z+r.gateway[1].z)/2&&o.y===0));
  assert(c.world.some(o=>o.type.startsWith('road')&&o.x===r.work.x&&o.z===r.work.z));
 }
});
test('visible arrival waits, follows the gate, then never vanishes during final step, watched exit or talk',()=>{
 const opts={visible:true},c=runtime(opts),role=c.roles[0],a={role,...role.home,recessed:true},log=[],b={plans:2};c.actors.push(a);
 c.poiTownNpcMove=(a,p)=>{log.push(pos(p));Object.assign(a,p);return true};
 const tick=(m,i)=>c.routine(a,{minute:m,absoluteMinute:m},i*400,b);
 assert.equal(tick(role.arrives,1),true);assert(a.recessed);assert(!log.length);
 opts.visible=false;
 for(let i=2;i<=4;i++)tick(role.arrives+1,i);
 assert(!a.recessed);assert.deepEqual(log,[...Array.from(role.gateway,pos),pos(role.work)]);
 for(let i=5;i<=6;i++)tick(role.leaves,i);
 a.stepping=true;tick(role.leaves,7);assert(!a.recessed);assert.deepEqual(pos(a),pos(role.home));
 a.stepping=false;opts.visible=true;tick(role.leaves,8);assert(!a.recessed);
 opts.visible=false;c.poiTownDialogue={actor:a};tick(role.leaves,9);assert(!a.recessed);
 c.poiTownDialogue=null;tick(role.leaves,10);assert(a.recessed);
 assert.deepEqual(log.slice(3,6),[pos(role.gateway[1]),pos(role.gateway[0]),pos(role.home)]);
});
test('off-duty rejects entry with no navigation or camera work; body cannot overlap at entry',()=>{
 const c=runtime(),role=c.roles[1],a={role,...role.home,recessed:true};c.actors.push(a,{...role.home,recessed:false});
 c.parameters=()=>{throw Error('unexpected camera')};
 c.poiTownNpcMove=()=>{throw Error('unexpected navigation')};
 c.routine(a,{minute:40,absoluteMinute:40},0,{plans:2});
 c.routine(a,{minute:role.arrives,absoluteMinute:role.arrives},400,{plans:2});
 assert(a.recessed);
});
test('production mover walks both routings through the actual gate cells and out again',()=>{
 const c=runtime();vm.runInContext(cut('function poiTownNpcPlayerBlocksStep','function poiTownNpcReleaseHunt'),c);
 c.poiTownNpcActorOccupied=(x,z,y,a)=>c.actors.some(b=>b!==a&&!b.recessed&&b.x===x&&b.z===z&&b.y===y);
 for(const r of c.roles)c.actors.push({role:r,recessed:true,...r.home});
 const run=(m,base)=>{
  const position=c.actors.map(()=>[]);
  for(let i=0;i<200;i++)for(const [j,a] of c.actors.entries()){
   c.routine(a,{minute:m,absoluteMinute:m},base+i*380,{plans:2});
   if(!a.recessed)position[j].push([a.x,a.z]);
  }
  return position;
 };
 const paths=run(700,0);assert(c.actors.every(a=>a.activity==='visit'&&!a.recessed));
 assert(paths[0].some(([x,z])=>x===23&&z===49));assert(paths[1].some(([x,z])=>x===34&&z===22));
 const out=run(1230,200*380);assert(c.actors.every(a=>a.recessed));
 assert(out[0].some(([x,z])=>x===23&&z===49));assert(out[1].some(([x,z])=>x===34&&z===22));
});
