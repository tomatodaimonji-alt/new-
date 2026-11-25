const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const h=fs.readFileSync(process.argv[2]||'world-editor.html','utf8');
const cut=(a,b)=>{const x=h.indexOf(a),y=h.indexOf(b,x+1);assert(x>=0&&y>x,a);return h.slice(x,y)};
const marker='// BEGIN TOWN NPC CANONICAL PURSE',end='// END TOWN NPC CANONICAL PURSE';
const point=(x,z)=>({x,z,y:0}),clock=absoluteMinute=>({absoluteMinute,minute:absoluteMinute%1440});
const guest={id:'guestadventurer',role:'adventurer'},resident={id:'resadventurer',role:'adventurer'};
const west={id:'inn-west',residentId:guest.id,stand:point(39,26)},south={id:'inn-south',residentId:null,stand:point(40,30)};
function setup(box=new Map()){
 const fixture={fail:false,at:1000};
 const clerk={role:{id:'toolkeeper',public:point(69,35),work:point(71,35)},...point(71,35),activity:'work'};
 const desk=point(41,32);const hunt=new Map();
 const c={
  facilitySite:{id:'base'},localStorage:{getItem:k=>box.get(k)??null,setItem:(k,v)=>{if(fixture.fail)throw Error('quota');box.set(k,v)}},
  POI_TOWN_INN_BEDS:[west,south],POI_TOWN_WAKE:360,POI_TOWN_RESIDENT_MELEE:14,POI_ECONOMY_COIN:3,POI_ECONOMY_PRICE:6,POI_HOTBAR_HEAL:30,
  POI_TOWN_INN:{hostId:'innkeeper',desk},poiTownNpcActors:[clerk],poiTownNpcBook:null,poiTownNpcExistsBed:()=>true,poiTownNpcHostReady:()=>true,
  poiTownNpcHere:(a,p)=>!!a&&!!p&&a.x===p.x&&a.z===p.z&&a.y===p.y,poiTownNpcAct:(a,label)=>{a.activity=label},
  poiTownNpcMove:(a,p)=>c.poiTownNpcHere(a,p),poiTownNpcStepT:()=>1,poiTownNpcStance:()=>true,poiTownNpcKey:(...a)=>a.join(','),poiTownNpcGraph:()=>({cells:new Map([['25,41,0',['kitchenCounter']],['41,33,0',['plasterwallDoor']]])}),poiTownNpcGesture(){},poiTownAmbientSpeak(){},
  poiTownClockSnapshot:()=>clock(fixture.at),poiMonsterStates:hunt,poiMonsterMeshDirty:false,poiTownNpcMelee:()=>true,poiTownNpcFaces:()=>0,
  poiTownNpcReleaseHunt(a){if(a.target)hunt.delete(a.target);a.target=null;},
  poiTownNpcCombatNear:()=>false,
  world:[{type:'counterLuxury',rot:1,x:70,z:35,y:0},{type:'poiLedgerPapers',x:70,z:35,y:0}]
 };
 vm.createContext(c);
 const ledger=h.includes(marker)?cut(marker,end):'';
 const food=h.includes('// BEGIN TOWN NPC FUNDED FOOD')?cut('// BEGIN TOWN NPC FUNDED FOOD','// END TOWN NPC FUNDED FOOD'):'';
 vm.runInContext(ledger+'\n'+food+'\n'+cut('function poiTownNpcResolve','function poiTownNpcPreyAdvance')+
  cut('function poiTownNpcEmergencyHeal','function poiTownNpcVisitorRoutine')+
  cut('function poiTownNpcBedOwner','function poiTownNpcHostReady')+
  cut('function poiTownNpcRoutine','// BEGIN TOWN DIALOGUE'),c);
 return {box,fixture,c,clerk};
}
function spawn(role=guest,p=point(69,35)){return {role,...p,coins:0,potions:0,hp:100,facing:0,index:0,restUntil:null};}
function kill(c,a,t){
 const obj={};a.target=obj;a.hitAt=t;c.poiMonsterStates.set(obj,{hp:1,townOwned:true,townHunt:a.role.id});
 c.poiTownNpcResolve(a,t);return {obj,hp:c.poiMonsterStates.get(obj)?.hp};
}
function arrive(c,a,bed,day=0){
 Object.assign(a,bed.stand,{bedId:bed.id,bedUntil:1800+day*1440,restUntil:null,npcInnBooking:bed.id,npcInnPaidFor:null});
 c.poiTownNpcRoutine(a,clock(1000+day*1440),400,{plans:2});
}
test('starting 0G is not a hidden lodging budget, and a player’s reservation cannot be converted to NPC lodging',()=>{
 const {c,box}=setup(),a=spawn(guest,west.stand);a.hp=60;arrive(c,a,west);assert.equal(a.coins,0);assert.equal(a.hp,60);
 const b=spawn(resident,point(41,32));b.hp=70;c.poiTownNpcBook={bedId:'inn-south'};
 c.poiTownNpcRoutine(b,clock(1000),400,{plans:2});assert.equal(b.bedId,undefined);
 assert.equal(c.poiTownNpcBook.bedId,'inn-south');assert.equal(box.size,0);
});
test('only two genuine kills fund one reserved bed; duplicate rest does not charge or credit twice',()=>{
 const {c}=setup(),a=spawn();kill(c,a,100);kill(c,a,510);assert.equal(a.coins,6);
 a.hp=61;arrive(c,a,west);assert.deepEqual([a.coins,a.hp],[0,100]);
 c.poiTownNpcRoutine(a,clock(1000),800,{plans:2});assert.equal(a.coins,0);
 assert.equal(c.poiTownNpcPurseAccount('innkeeper').coins,6);
});
test('potion buy, vendor credit and durable herb consumption share the displayed purse after cold reload',()=>{
 const {c,box}=setup(),a=spawn();kill(c,a,100);kill(c,a,510);
 assert.equal(c.poiTownNpcShop(a,1000,{plans:2}),true);assert.deepEqual([a.coins,a.potions],[0,1]);
 const cold=setup(box),fresh=spawn();cold.c.poiTownNpcPurseHydrate(fresh);
 assert.deepEqual([fresh.coins,fresh.potions],[0,1]);assert.equal(cold.c.poiTownNpcPurseAccount('toolkeeper').coins,6);
 fresh.hp=15;cold.fixture.fail=true;assert.equal(cold.c.poiTownNpcEmergencyHeal(fresh),false);assert.deepEqual([fresh.hp,fresh.potions],[15,1]);
 cold.fixture.fail=false;assert.equal(cold.c.poiTownNpcEmergencyHeal(fresh),true);
 const again=spawn();setup(box).c.poiTownNpcPurseHydrate(again);assert.equal(again.potions,0);
});
test('failed commit cannot award bounty, vend herbs or let an unpaid lodged NPC recover',()=>{
 const {c,fixture,box}=setup(),a=spawn();fixture.fail=true;
 assert.equal(kill(c,a,100).hp,1);assert.equal(a.coins,0);assert.equal(box.size,0);
 fixture.fail=false;kill(c,a,510);kill(c,a,920);assert.equal(a.coins,6);
 fixture.fail=true;assert.equal(c.poiTownNpcShop(a,1200,{plans:2}),true);assert.deepEqual([a.coins,a.potions],[6,0]);
 a.hp=59;arrive(c,a,west);assert.deepEqual([a.coins,a.hp],[6,59]);
});
test('legacy cold reconstructed bed preserves the sleeper without a retroactive debit',()=>{
 const {c,box}=setup(),a=spawn(guest,west.stand);a.hp=60;
 Object.assign(a,{bedId:west.id,bedUntil:1800});
 c.poiTownNpcRoutine(a,clock(1240),400,{plans:2});
 assert.equal(a.hp,100);assert.equal(a.coins,0);assert.equal(box.size,0);
});
test('a failed lethal debit does not consume monster counter timing or emit lethal feedback',()=>{
 const {c,fixture}=setup(),a=spawn();a.attackAt=1234;fixture.fail=true;
 const obj={};a.target=obj;a.hitAt=100;c.POI_MONSTER_STATS={monsterSlime:{attack:6}};
 const state={hp:1,townOwned:true,townHunt:a.role.id,counterHitAt:100,counterTargetX:a.x,counterTargetZ:a.z};
 c.poiMonsterStates.set(obj,state);c.poiTownNpcResolve(a,100);
 assert.deepEqual([state.hp,state.counterHitAt,a.coins,a.hp,a.attackAt,a.attacks],[1,null,0,94,1234,undefined]);
});
test('actual desk chain holds player spare reservation, then books and charges only after reaching a freed bed',()=>{
 const {c}=setup(),a=spawn(resident,point(41,32));
 c.poiTownNpcActors.push(a);kill(c,a,100);kill(c,a,510);a.hp=60;
 c.poiTownNpcBook={bedId:'inn-south'};
 c.poiTownNpcRoutine(a,clock(1000),1000,{plans:2});assert.equal(a.bedId,undefined);assert.equal(a.coins,6);
 c.poiTownNpcBook=null;
 c.poiTownNpcRoutine(a,clock(1001),1380,{plans:2});assert.equal(a.bedId,'inn-south');assert.equal(a.coins,6);
 c.poiTownNpcRoutine(a,clock(1002),1760,{plans:2});assert.deepEqual([a.coins,a.hp],[6,60]);
 Object.assign(a,south.stand);
 c.poiTownNpcRoutine(a,clock(1003),2140,{plans:2});assert.deepEqual([a.coins,a.hp],[0,100]);
 assert.equal(c.poiTownNpcPurseAccount('innkeeper').coins,6);
});
test('food physically uses receipt money; cold old record, no funds/handoff/write never buys food',()=>{
 const {c,fixture,box}=setup(),cook={role:{id:'towncook',role:'visitor'},...point(26,42),coins:0};
 c.poiTownNpcActors.push(cook);
 const r=(m=755)=>c.poiTownNpcFundedFood(cook,clock(m),m*500,{plans:2});
 assert.equal(r(),false);assert.equal(box.size,0);
 const a=spawn();kill(c,a,100);kill(c,a,510);a.hp=61;arrive(c,a,west);
 const purseKey='world-workshop-base-npc-purse-v1';
 const old=JSON.parse(box.get(purseKey));delete old.food;delete old.towncook;box.set(purseKey,JSON.stringify(old));
 const state=()=>c.poiTownNpcPurseRead();
 assert.equal(state().innkeeper,6);
 assert.equal(r(),true);assert.equal(state().innkeeper,6);assert.equal(state().food.inn,2);
 Object.assign(cook,point(42,31));c.poiTownNpcHostReady=()=>false;
 assert.equal(r(756),true);assert.equal(state().food.inn,2);
 c.poiTownNpcHostReady=()=>true;fixture.fail=true;r(757);assert.equal(state().innkeeper,6);
 fixture.fail=false;r(758);assert.deepEqual([state().innkeeper,state().food.inn,state().food.supplier,state().towncook,cook.coins],[2,4,6,4,4]);
 const cold=setup(box).c;assert.equal(cold.poiTownNpcPurseAccount('towncook').coins,4);
 assert.equal(state().issued,6);
 Object.assign(cook,point(26,42));assert.equal(r(759),false);assert.equal(state().food.inn,4);
});
test('real v324 kitchen and inn route uses all three authored doors, no duplicate map fabrication',()=>{
 const site=vm.runInNewContext(cut('const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+";buildFacilitySite('base')");
 site.id='base';const world=site.map.world;
 const c={facilitySite:site,world,MAP_W:site.map.width,MAP_H:site.map.height,terrainHeights:new Map(site.map.terrainHeights.map(o=>[o.x+','+o.z,o.h])),facilityCreekIndex:null};
 vm.runInNewContext(cut('const terrainKey=','const terrainY=')+cut('function terrainPassable(','function waterfallFace(')+
 cut('const STAIR_DIRECTIONS=','function elevationStairGeometry(')+cut('const ROAD_BASES=','const baseRoad=')+
 cut('const WALL_MATERIAL_IDS=','// Shared staggered timber')+h.match(/^function isFloor\(t\)\{.+\}$/m)[0]+'\n'+
 cut('function poiWalkPassableDoor','let facilityCreekIndex=')+cut('const POI_TOWN_WALK_DECOR=','function poiTownNpcExistsBed(')+
 cut('// BEGIN TOWN NPC FUNDED FOOD','// END TOWN NPC FUNDED FOOD')+
 '\nthis.route=poiTownFindPath(POI_NPC_FOOD_KITCHEN,POI_NPC_FOOD_INN); this.withHost=poiTownFindPath(POI_NPC_FOOD_KITCHEN,POI_NPC_FOOD_INN,(_,p)=>p.y===0&&p.x===41&&p.z===30);',c);
 assert.equal(c.route.length,27);
 assert(c.withHost?.length>0,'innkeeper standing at work cannot block the handoff');
 assert(!c.route.some(p=>p.x===41&&p.z===30),'default route itself avoids the innkeeper');
 for(const [x,z] of [[28,40],[33,39],[41,33]])assert(c.route.some(p=>p.x===x&&p.z===z&&p.y===0));
});
