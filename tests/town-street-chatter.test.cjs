const {test}=require('node:test'),a=require('node:assert/strict'),{readFileSync}=require('node:fs'),vm=require('node:vm');
const html=readFileSync(process.env.HTML||'world-editor.html','utf8');
function fixture(){
 const i=html.indexOf('// BEGIN TOWN STREET CHATTER'),j=html.indexOf('// END TOWN STREET CHATTER');
 a.ok(i>=0&&j>i,'street encounter must exist in the real app');
 const calls=[],el={hidden:true,textContent:'',style:{},dataset:{}},state={active:true,cover:null,blocks:new Set(),modal:false,faces:calls,visits:0,screen:true};
 const a0={x:5,z:5,y:0,role:{id:'mina',name:'ミナ'},activity:'visit',facing:0},b={x:6,z:5,y:0,role:{id:'seo',name:'セオ'},activity:'market-browse',facing:2};
 const c=vm.createContext({state,canvas:{clientWidth:800,clientHeight:400},document:{hidden:false,querySelector:()=>state.modal},
  poiTownAmbient:null,poiTownDialogue:null,poiWalkX:5,poiWalkZ:7,poiWalkLevel:0,
  facilityDoorTiles:new Set(),facilityCellKey:(x,z,y)=>[x,z,y].join(),
  facilityFloorOwner:()=>state.cover,facilityHiddenRoof:()=>null,
  poiTownNpcGraph:()=>({}),poiTownNpcNextTile:(_from,x,z)=>{state.visits++;return state.blocks.has(x+','+z)?null:{x,z,y:0}},
  poiTownNpcActors:[a0,b],poiTownNpcFace:(p,f)=>{calls.push([p.role.id,f]);p.facing=f},
  poiTownNpcStepT:p=>p.t??1,poiTownNpcActive:()=>state.active,poiTownNpcSleeping:p=>!!p.sleeping,
  poiWorldToScreen:(_,x,_y,z)=>state.screen?{x:x*30,y:z*30}:null,terrainY:()=>0,
  $:()=>null,poiTownAmbientLines:[],poiTownDialogueElement:()=>el,poiTownNpcDisplayName:r=>r.name,
  poiTownAmbientNear:p=>p.y===c.poiWalkLevel&&Math.hypot(p.x-c.poiWalkX,p.z-c.poiWalkZ)<=10,
  poiTownAmbientVisible:()=>true,poiTownSpeechResolvePlacement:p=>({...p,left:p.x,top:p.y,side:'natural'}),
  poiTownDialogueUpdate:()=>null});
 const ambientStart=html.indexOf('// Speech here is attached'),ambientEnd=html.indexOf('// END TOWN DIALOGUE',ambientStart);
 const ambient=html.slice(ambientStart,ambientEnd);
 delete c.poiTownAmbient;delete c.poiTownAmbientNear;delete c.poiTownAmbientVisible;
 c.poiEnemyAttackTrace=vm.runInNewContext(html.slice(html.indexOf('function poiEnemyAttackTrace('),html.indexOf('function poiEnemyDiagonalType('))+';poiEnemyAttackTrace');
 const run=(s)=>vm.runInContext(s,c);run(ambient);
 const snap=()=>JSON.parse(JSON.stringify(run('poiTownAmbientSnapshot()')));
 return {c,a0,b,snap,state,el,draw:t=>run('poiTownDialogueDraw('+t+',[])'),run};
}
test('public pair faces each other and actually renders two brief lines on different speakers; then both resume and a second pair cannot immediately start',()=>{
 const f=fixture();f.draw(1000);a.equal(f.snap(),null);
 f.draw(4200);a.equal(f.snap()?.venue,'street');a.equal(f.el.hidden,false);a.match(f.el.textContent,/^ミナ\n/);
 a.deepEqual(f.state.faces,[['mina',1],['seo',3]]);a.equal(f.run('poiTownStreetHolds(poiTownNpcActors[0])'),true);
 f.draw(5700);a.match(f.el.textContent,/^セオ\n/);a.equal(f.snap().phase,1);
 f.draw(7500);a.equal(f.snap(),null);a.equal(f.el.hidden,true);a.equal(f.a0.facing,0);a.equal(f.b.facing,2);
 f.draw(9000);a.equal(f.snap(),null);
});
test('same-floor wall, doorway, asleep/work, blocked sight from player and offscreen reject without modifying actors',()=>{
 for(const mutate of [
  f=>f.b.y=1,f=>f.b.activity='work',f=>f.b.sleeping=true,f=>f.state.screen=false,
  f=>f.state.blocks.add('5,6'),f=>f.c.facilityDoorTiles.add('6,5,0'),f=>f.state.cover=1,
  f=>f.b.actorLeg={},f=>f.b.supplyCarrying=true,
 ]){
  const f=fixture();mutate(f);f.draw(1000);f.draw(4200);a.equal(f.snap(),null);a.equal(f.state.faces.length,0);
 }
});
test('a menu, approaching player action, or real merchant speech takes priority and restores actor facing',()=>{
 for(const interrupt of [f=>f.state.modal=true,f=>f.c.poiTownDialogue={},f=>{f.c.poiWalkX=99},f=>{f.state.screen=false},
  f=>f.run('poiTownAmbientSpeak("shop",poiTownNpcActors[0],poiTownNpcActors[1],4300)')]){
  const f=fixture();f.draw(1000);f.draw(4200);a.equal(f.snap().venue,'street');
  interrupt(f);f.draw(4320);a.notEqual(f.snap()?.venue,'street');a.equal(f.a0.facing,0);a.equal(f.b.facing,2);
 }
});
test('search inspects a fixed roster prefix and avoids tracing culled scenes each rendered frame',()=>{
 const f=fixture();f.c.poiTownNpcActors=Array.from({length:1000},(_,i)=>({...f.a0,role:{id:'r'+i},x:99}));
 f.draw(1000);f.draw(4200);a.equal(f.snap(),null);a.equal(f.state.visits,0);
});

test('authored central plaza schedule contains an uncovered face-to-face pair within the real roster search and approach graph',()=>{
 const cut=(x,y)=>{const i=html.indexOf(x),j=html.indexOf(y,i+1);a.ok(i>=0&&j>i,x);return html.slice(i,j)};
 const site=vm.runInNewContext(cut('const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+";buildFacilitySite('base')");
 site.id='base';
 const c={facilitySite:site,world:site.map.world,MAP_W:site.map.width,MAP_H:site.map.height,
  terrainHeights:new Map(site.map.terrainHeights.map(o=>[o.x+','+o.z,o.h])),facilityCreekIndex:null,
  poiWalkX:65,poiWalkZ:43,poiWalkLevel:0};
 c.facilityFloorMasks=site.buildings.map(b=>({floors:new Map(Object.entries(b.floorFootprints)
  .map(([y,pts])=>[Number(y),new Set(pts.map(p=>p.x+','+p.z))]))}));
 vm.runInNewContext(cut('const terrainKey=','const terrainY=')+cut('function terrainPassable(','function waterfallFace(')+
  cut('const STAIR_DIRECTIONS=','function elevationStairGeometry(')+cut('const ROAD_BASES=','const baseRoad=')+
  cut('const WALL_MATERIAL_IDS=','// Shared staggered timber')+html.match(/^function isFloor\(t\)\{.+\}$/m)[0]+'\n'+
  cut('function poiWalkPassableDoor(','let facilityCreekIndex=')+
  cut('const POI_TOWN_WALK_DECOR=','function poiTownNpcExistsBed(')+
  cut('const POI_TOWN_RESIDENT_ROLES=','const POI_TOWN_NPC_BASE_GEAR=')+
  html.match(/^const POI_TOWN_OPEN=.*;$/m)[0]+'\n'+
  cut('const POI_TOWN_KEEPER_DAY=','// Only cold-start placement')+
  cut('function poiEnemyAttackTrace(','function poiEnemyDiagonalType(')+
  cut('function facilityFloorOwner(','function facilityValidLanding(')+
  cut('const facilityCellKey=','function facilityPrepareFloorMasks(')+
  cut('// BEGIN TOWN STREET CHATTER','// END TOWN STREET CHATTER'),c);
 const result=vm.runInContext(`
  for(const o of world)if(poiWalkPassableDoor(o.type))facilityDoorTiles.add(facilityCellKey(o.x,o.z,o.y));
  const role=key=>POI_TOWN_RESIDENT_ROLES.find(r=>r.id===key);
  const at=key=>poiTownDailyPlan(role(key),{minute:1100,absoluteMinute:1100});
  const forge=at('workshopkeeper'),shop=at('toolkeeper'),player={x:65,z:43,y:0};
  JSON.stringify({
   ids:['workshopkeeper','toolkeeper'].map(id=>POI_TOWN_RESIDENT_ROLES.indexOf(role(id))),
   positions:[forge.goal,shop.goal],activities:[forge.label,shop.label],
   outside:[player,forge.goal,shop.goal].every(p=>facilityFloorOwner(p.x,p.z,p.y)===null),
   clear:poiTownStreetClear(player,forge.goal)&&poiTownStreetClear(player,shop.goal)&&poiTownStreetClear(forge.goal,shop.goal)
  });
 `,c);
 const f=JSON.parse(result);
 a.ok(f.ids.every(i=>i>=0&&i<24));a.deepEqual(f.positions,[{x:65,z:39,y:0,facing:2},{x:65,z:40,y:0,facing:3}]);
 a.deepEqual(f.activities,['evening-walk','evening-walk']);a.equal(f.outside,true);a.equal(f.clear,true);
});
