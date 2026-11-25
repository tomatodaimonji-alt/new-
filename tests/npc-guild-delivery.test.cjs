const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const h=fs.readFileSync(process.argv[2]||'world-editor.html','utf8');
const cut=(a,b)=>{const x=h.indexOf(a),y=h.indexOf(b,x+1);assert(x>=0&&y>x,a);return h.slice(x,y)};
const coord=(x,z)=>({x,z,y:0}),clock=m=>({minute:m,absoluteMinute:1440+m}),std={version:1,issued:10,
 guestadventurer:{coins:0,herbs:0,night:0},resadventurer:{coins:0,herbs:0,night:-1},
 toolkeeper:0,innkeeper:6,towncook:4,food:{inn:2,supplier:6,day:0,eaten:2,northMeal:1}};
function setup(seed=std){
 let raw=JSON.stringify(seed),fail=false;
 const flags={host:true,settled:true},cook={role:{id:'towncook',work:coord(26,42)},...coord(26,42),activity:'work'},host={role:{id:'guildkeeper',work:coord(56,27)},...coord(56,27),activity:'work'};
 const c={facilitySite:{id:'base'},localStorage:{getItem:()=>raw,setItem:(k,v)=>{if(fail)throw Error('quota');raw=v}},poiTownNpcActors:[host,cook],
 poiTownNpcGraph:()=>({cells:new Map([['52,30,0',['guildWallQuestBoard']],['56,28,0',['counterWood']],['41,33,0',['plasterwallDoor']],['25,41,0',['kitchenCounter']],['28,40,0',['stonewallDoor']]])}),
 poiTownNpcKey:(...q)=>q.join(','),poiTownNpcStance:()=>true,poiTownNpcStepT:()=>flags.settled?1:.99,poiTownNpcHostReady:()=>flags.host,
 poiTownNpcAct:(a,k)=>{a.activity=k},poiTownNpcHere:(a,p)=>a.x===p.x&&a.z===p.z&&a.y===p.y,
 poiTownNpcMove:(a,p)=>{flags.goal=p;return c.poiTownNpcHere(a,p)}};
 vm.createContext(c);vm.runInContext(cut('// BEGIN TOWN NPC CANONICAL PURSE','// END TOWN NPC CANONICAL PURSE')+
 cut('// BEGIN TOWN NPC GUILD PROCUREMENT','// END TOWN NPC GUILD PROCUREMENT')+(h.includes('// BEGIN TOWN NPC GUILD COURIER')?cut('// BEGIN TOWN NPC GUILD COURIER','// END TOWN NPC GUILD COURIER'):''),c);
 return {c,flags,host,cook,fail:b=>fail=b};
}
const actor=()=>({role:{id:'westbasketweaver'},gatewayStep:2,recessed:false,...coord(50,42)});
test('physical inn authorization to staffed Guild only: 4G escrow and two reserved, one order, no instant delivery',()=>{
 const o=setup(),{c,flags,host}=o,a=actor(),tick=m=>c.poiTownNpcProcure(a,clock(m),m*400,{plans:2});
 const s=()=>c.poiTownNpcPurseRead();assert.equal(s().order,null);assert.equal(tick(580),false);
 assert.equal(tick(595),true);assert.deepEqual([flags.goal.x,flags.goal.z],[42,31]);
 Object.assign(a,coord(56,29));assert.equal(tick(596),true);assert.equal(s().order,null);
 Object.assign(a,coord(42,31));flags.host=false;tick(597);assert.equal(s().order,null);
 flags.host=true;tick(598);assert.deepEqual([flags.goal.x,flags.goal.z],[56,29]);
 Object.assign(a,coord(56,29));host.activity='idle';tick(610);assert.equal(s().order,null);
 host.activity='work';flags.settled=false;tick(611);assert.equal(s().order,null);flags.settled=true;
 o.fail(true);tick(612);assert.equal(s().order,null);assert.equal(s().innkeeper,6);
 o.fail(false);tick(613);assert.equal(s().order.id,'base:food:1');
 assert.deepEqual([s().innkeeper,s().order.escrow,s().order.quantity,s().food.inn,s().food.supplier],[2,4,2,2,6]);
 assert.equal(tick(614),false);assert.equal(s().issued,10);
 const copy=setup(JSON.parse(JSON.stringify(s()))).c;
 assert.equal(copy.poiTownNpcProcureExpire({minute:690,absoluteMinute:2130}),true);
 assert.equal(copy.poiTownNpcPurseRead().order,null);assert.equal(copy.poiTownNpcPurseRead().innkeeper,6);
 assert.equal(copy.poiTownNpcProcure(actor(),clock(616),99999,{plans:2}),false);
});
test('no order intent before real meals or funds; another actor cannot request',()=>{
 const a=actor(),testGate=(seed,actor)=>setup(seed).c.poiTownNpcProcure(actor,clock(595),0,{plans:2});
 assert.equal(testGate({...std,food:{inn:2,supplier:8,day:-1,eaten:0,northMeal:-1}},a),false);
 assert.equal(testGate({...std,issued:7,innkeeper:3},a),false);
 assert.equal(testGate(std,{...a,role:{id:'northlamplearner'}}),false);
});
test('real messenger walk from work through inn and Guild doors stays within the planned time budget',()=>{
 const site=vm.runInNewContext(cut('const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+";buildFacilitySite('base')");
 site.id='base';const world=site.map.world;
 const c={facilitySite:site,world,MAP_W:site.map.width,MAP_H:site.map.height,terrainHeights:new Map(site.map.terrainHeights.map(o=>[o.x+','+o.z,o.h])),facilityCreekIndex:null};
 vm.runInNewContext(cut('const terrainKey=','const terrainY=')+cut('function terrainPassable(','function waterfallFace(')+
 cut('const STAIR_DIRECTIONS=','function elevationStairGeometry(')+cut('const ROAD_BASES=','const baseRoad=')+
 cut('const WALL_MATERIAL_IDS=','// Shared staggered timber')+h.match(/^function isFloor\(t\)\{.+\}$/m)[0]+'\n'+
 cut('function poiWalkPassableDoor','let facilityCreekIndex=')+cut('const POI_TOWN_WALK_DECOR=','function poiTownNpcExistsBed(')+
 cut('// BEGIN TOWN NPC GUILD PROCUREMENT','// END TOWN NPC GUILD PROCUREMENT')+
 '\nthis.routes=[poiTownFindPath({x:50,z:42,y:0},POI_NPC_PROC_INN),poiTownFindPath(POI_NPC_PROC_INN,POI_NPC_PROC_GUILD)];',c);
 const [p1,p2]=c.routes;assert.equal(p1.length,21);assert.equal(p2.length,34);
 for(const [x,z] of [[41,33],[56,38]])assert(p2.some(p=>p.x===x&&p.z===z&&p.y===0));
 assert((p1.length+p2.length)*380<30e3);
 assert(world.some(o=>o.type==='guildWallQuestBoard'&&o.x===52&&o.z===30&&o.y===0));
});
test('reserved stock can never be sold by the direct cook path, free stock can',()=>{
 const {c}=setup();
 vm.runInContext(cut('function poiTownNpcFoodEligible','// END TOWN NPC FUNDED FOOD'),c);
 const p={innkeeper:4,food:{inn:2,supplier:2,day:0},order:{quantity:2}};
 assert.equal(c.poiTownNpcFoodEligible(p,2200),false);
 p.food.supplier=4;assert.equal(c.poiTownNpcFoodEligible(p,2200),true);
});
test('posted escrow has one physical claimant, pickup from working cook, settled delivery and cold-safe exactly once',()=>{
 const o=setup(),{c,flags,host,cook}=o,a=actor();
 Object.assign(a,coord(42,31));c.poiTownNpcProcure(a,clock(596),1000,{plans:2});
 Object.assign(a,coord(56,29));c.poiTownNpcProcure(a,clock(600),1500,{plans:2});
 const tick=m=>c.poiTownNpcProcCourier(a,clock(m),m*400,{plans:2}),state=()=>c.poiTownNpcPurseRead();
 assert.equal(state().order.claim,null);host.activity='idle';tick(601);assert.equal(state().order.claim,null);host.activity='work';
 tick(602);assert.equal(state().order.claim,'westbasketweaver');
 assert.equal(c.poiTownNpcProcCourier({...a,role:{id:'northlamplearner'}},clock(603),0,{plans:2}),false);
 Object.assign(a,coord(42,31));tick(605);assert.deepEqual([flags.goal.x,flags.goal.z],[27,42]);assert.equal(state().food.inn,2);
 Object.assign(a,coord(27,42));cook.activity='idle';tick(625);assert.equal(state().order.picked,false);
 cook.activity='work';o.fail(true);tick(626);assert.equal(state().order.picked,false);
 o.fail(false);tick(628);assert.equal(state().order.picked,true);assert.equal(state().food.inn,2);
 const reloaded=setup(state()),fresh={...actor(),...coord(42,31)};
 reloaded.c.poiTownNpcProcCourier(fresh,clock(632),100,{plans:2});assert.equal(reloaded.c.poiTownNpcPurseRead().food.inn,2);
 Object.assign(a,coord(42,31));flags.settled=false;tick(646);assert.equal(state().food.inn,2);
 flags.settled=true;flags.host=false;tick(647);assert.equal(state().food.inn,2);
 flags.host=true;o.fail(true);tick(648);assert.equal(state().order.picked,true);assert.equal(cook.coins,undefined);
 o.fail(false);tick(650);assert.deepEqual([state().order,state().innkeeper,state().towncook,cook.coins,state().food.inn,state().food.supplier,state().food.day],[null,2,8,8,4,4,1]);
 assert.equal(tick(651),false);assert.equal(state().towncook,8);
});
test('production mover can complete all four legs within the advancing clock and avoids working supplier/host',()=>{
 const o=setup(),{c,host,cook}=o,a=actor();
 const site=vm.runInNewContext(cut('const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+";buildFacilitySite('base')");
 site.id='base';
 Object.assign(c,{POI_TOWN_RESIDENT_TICK:380,facilitySite:site,world:site.map.world,MAP_W:site.map.width,MAP_H:site.map.height,
  terrainHeights:new Map(site.map.terrainHeights.map(o=>[o.x+','+o.z,o.h])),facilityCreekIndex:null});
 // Use real navigation/step/tick code; only project GPU pose as unit time.
 delete c.poiTownNpcKey;delete c.poiTownNpcGraph;delete c.poiTownNpcStance;delete c.poiTownNpcHere;delete c.poiTownNpcActors;
 vm.runInContext(cut('const terrainKey=','const terrainY=')+cut('function terrainPassable(','function waterfallFace(')+
 cut('const STAIR_DIRECTIONS=','function elevationStairGeometry(')+cut('const ROAD_BASES=','const baseRoad=')+
 cut('const WALL_MATERIAL_IDS=','// Shared staggered timber')+h.match(/^function isFloor\(t\)\{.+\}$/m)[0]+'\n'+
 cut('function poiWalkPassableDoor','let facilityCreekIndex=')+cut('const POI_TOWN_WALK_DECOR=','function poiTownNpcExistsBed(')+
 cut('function poiTownNpcPlayerBlocksStep','function poiTownNpcReleaseHunt')+
 cut('function poiTownNpcStepT','function poiTownNpcVisualPosition')+
 '\nthis.activeActors=poiTownNpcActors;',c);
 c.activeActors.push(host,cook,a);
 c.poiTownNpcActorOccupied=(x,z,y,except)=>c.activeActors.some(b=>b!==except&&!b.recessed&&b.x===x&&b.z===z&&b.y===y);
 const moved=[],stages=new Set();
 for(let i=0;i<165;i++){
  const now=i*380,m=590+Math.floor(now/500),time=clock(m),budget={plans:2};
  if(!c.poiTownNpcProcCourier(a,time,now,budget))c.poiTownNpcProcure(a,time,now,budget);
  const p=c.poiTownNpcPurseRead();if(p.order?.picked)stages.add('picked');if(p.order?.claim)stages.add('claimed');
  if(p.food.inn===4){assert(m<720);break}
  moved.push([a.x,a.z]);
 }
 assert.equal(c.poiTownNpcPurseRead().food.inn,4);assert.deepEqual([...stages],['claimed','picked']);
 assert(moved.some(([x,z])=>x===56&&z===29)&&moved.some(([x,z])=>x===27&&z===42));
});
test('late carried order refunds unchanged stock and old courier cannot later finish it',()=>{
 const seed={...std,innkeeper:2,procSerial:1,procDay:1,
  order:{id:'base:food:1',quantity:2,escrow:4,posted:2040,expires:2108,claim:'westbasketweaver',picked:true}};
 const o=setup(seed),a={...actor(),...coord(42,31),npcProcCarry:'base:food:1'};
 assert.equal(o.c.poiTownNpcProcCourier(a,clock(668),1000,{plans:2}),false);
 o.fail(true);assert.equal(o.c.poiTownNpcProcureExpire(clock(668)),false);assert.equal(o.c.poiTownNpcPurseRead().innkeeper,2);
 o.fail(false);assert.equal(o.c.poiTownNpcProcureExpire(clock(668)),true);assert.equal(o.c.poiTownNpcProcureExpire(clock(669)),false);
 const p=o.c.poiTownNpcPurseRead();assert.deepEqual([p.innkeeper,p.towncook,p.food.inn,p.food.supplier,p.order],[6,4,2,6,null]);
 assert.equal(o.c.poiTownNpcProcCourier(a,clock(670),1400,{plans:2}),false);
});
