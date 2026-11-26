const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm');
const h=fs.readFileSync(process.argv[2],'utf8');
function block(a,b){return h.slice(h.indexOf(a),h.indexOf(b,h.indexOf(a)))}
const ctx=vm.createContext({facilitySite:{id:'frontier'},MAP_W:256,MAP_H:128,POI_SQUARE_FIELD_SIDE:256,
 poiTownNpcNav:null,POI_TOWN_WALK_DECOR:new Set(['lantern']),world:[],BRIDGE_IDS:new Set(),facilityCreekIndex:null,
 poiTownNpcKey:(x,z,y)=>[x,z,y].join(','),poiTownNpcHere:(a,b)=>a&&b&&a.x===b.x&&a.z===b.z&&a.y===b.y,
 frontierVillageFence:()=>false,terrainPassable:()=>true,poiOverlandTownCertified:()=>false,
 isFloor:t=>['stone','brickfloor','roadBasaltFull'].includes(t),poiWalkPassableDoor:t=>t==='stonewallDoor',
 isWallId:t=>t.startsWith('stonewall'),frontierWalkableProp:t=>t==='rockMossy'});
vm.runInContext(block('// BEGIN FRONTIER SOUTH RUINS','function frontierSouthGrade')+
 block('function poiTownNpcGraph','// BEGIN STREAMED CERTIFIED TOWN PATH')+
 block('function poiTownFindPath(','function poiTownNpcExistsBed(')+
 block('// BEGIN LINEA SOUTH EXPEDITION','// END LINEA SOUTH EXPEDITION')+
 `;frontierSouthPopulate((x,z,type,rot,y)=>world.push({x,z,type,rot,y}));
 globalThis.fn={goal:frontierExpeditionGoal,route:frontierExpeditionRoute,path:poiTownFindPath};`,ctx);
const {goal,route,path}=ctx.fn;
for(const [id,side] of [['frontierregna',-1],['frontierlyzel',1]]){
 let from={x:134+side,z:27,y:0};const initial=from;
 for(const phase of ['out','back','north']){
  let count=0;
  for(let step=0;step<route({phase}).length;step++){
   const to=goal({phase,step},id),p=path(from,to);
   assert.ok(p,`${id} ${phase} can access ${JSON.stringify(to)} from ${JSON.stringify(from)}`);
   assert.ok(p.length<200);count+=p.length;
   if(from.y!==to.y)assert.ok(p.some(p=>p.x===160&&p.z===77&&p.y===to.y));
   from=to;
  }
  assert.ok(count>20,`${phase} travel not instant`);
 }
 assert.ok(from.z===0&&from.y===0&&initial.z>from.z);
}
console.log('PASS expedition actual route/path graph both actors, surface approach, stairs down/up, all rooms, north exit');
