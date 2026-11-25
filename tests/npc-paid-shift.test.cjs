const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const h=fs.readFileSync(process.argv[2]||'world-editor.html','utf8');
const cut=(a,b)=>{const x=h.indexOf(a),y=h.indexOf(b,x+1);assert(x>=0&&y>x,a);return h.slice(x,y)};
const pt=(x,z)=>({x,z,y:0}),clock=m=>({minute:m,absoluteMinute:1440+m});
const seed={version:1,issued:9,guestadventurer:{coins:0,herbs:0,night:-1},resadventurer:{coins:9,herbs:0,night:-1},
 toolkeeper:0,innkeeper:0,towncook:0,food:{inn:2,supplier:8,day:-1,eaten:0,northMeal:-1},procDay:-1,procSerial:0,order:null};
function fixture(source=seed){
 const o={fail:false,settled:true,gesture:0};let raw=JSON.stringify(source);
 const marta={role:{id:'diningkeeper',work:pt(31,36)},...pt(31,36),activity:'work',coins:0},
 ines={role:{id:'towncook',work:pt(26,42)},...pt(26,42),activity:'work',coins:0},
 buyer={role:{id:'resadventurer',role:'adventurer'},...pt(45,72),hp:95,coins:9,potions:1};
 const c={facilitySite:{id:'base'},localStorage:{getItem:()=>raw,setItem:(_,v)=>{if(o.fail)throw Error('quota');raw=v}},
  poiTownNpcActors:[marta,ines,buyer],poiTownNpcHere:(a,p)=>a.x===p.x&&a.z===p.z&&a.y===p.y,
  poiTownNpcStepT:()=>o.settled?1:.99,poiTownNpcMove:(a,p)=>{o.target=p;return c.poiTownNpcHere(a,p)},
  poiTownNpcAct:(a,activity)=>{a.activity=activity},poiTownNpcGesture:()=>{o.gesture++},
  poiTownNpcKey:(...q)=>q.join(','),poiTownNpcStance:()=>true,poiTownNpcGraph:()=>({cells:new Map([
   ['32,37,0',['counterWood']],['33,39,0',['stonewallDoor']],['25,42,0',['kitchenStove']]])})};
 vm.createContext(c);vm.runInContext(cut('// BEGIN TOWN NPC CANONICAL PURSE','// END TOWN NPC CANONICAL PURSE')+
  cut('// BEGIN TOWN NPC PAID SHIFT','// END TOWN NPC PAID SHIFT'),c);
 return {o,c,buyer,marta,ines,raw:()=>raw,tick:(m=930)=>c.poiTownNpcPaidShift(buyer,clock(m),m*400,{plans:2})};
}
test('only settled staffed purchase debits Yuris, credits Marta and Ines, consumes free stock, grants real bounded experience',()=>{
 const v=fixture(),{o,c,buyer,marta,ines}=v;
 assert.equal(v.tick(910),false);assert.equal(v.tick(925),true);assert.deepEqual([o.target.x,o.target.z],[32,38]);
 assert.equal(c.poiTownNpcPurseRead().food.supplier,8);Object.assign(buyer,pt(32,38));
 ines.activity='idle';v.tick(926);assert.equal(c.poiTownNpcPurseRead().food.supplier,8);ines.activity='work';
 marta.activity='idle';v.tick(927);assert.equal(c.poiTownNpcPurseRead().food.supplier,8);marta.activity='work';
 o.settled=false;v.tick(928);assert.equal(c.poiTownNpcPurseRead().food.supplier,8);o.settled=true;
 o.fail=true;v.tick(929);assert.deepEqual([buyer.coins,marta.coins,ines.coins,o.gesture],[9,0,0,0]);
 o.fail=false;v.tick(930);
 const p=c.poiTownNpcPurseRead();assert.deepEqual([buyer.coins,marta.coins,ines.coins,p.food.supplier,p.shift.served,p.shift.xp,p.issued],[6,2,1,7,1,1,9]);
 assert.deepEqual([buyer.hp,buyer.potions],[95,1]);
 const cold=fixture(p);Object.assign(cold.buyer,pt(32,38));assert.equal(cold.tick(934),false);assert.equal(cold.c.poiTownNpcPurseRead().shift.xp,1);
});
test('no shift or wage without surplus, no stealing reserved holdings or inn fallback',()=>{
 const poor={...seed,issued:6,resadventurer:{...seed.resadventurer,coins:6}};
 const money=fixture(poor);assert.equal(money.tick(),false);
 const rest=fixture({...seed,food:{inn:2,supplier:2,day:0,eaten:6,northMeal:0}});
 assert.equal(rest.tick(),false);assert.equal(rest.c.poiTownNpcPurseRead().shift.xp,0);
 const enemy=fixture();enemy.buyer.target={};assert.equal(enemy.tick(),false);
});
test('actual resident reaches the existing customer counter via real dining entrance with enough game time',()=>{
 const {c,buyer,marta,ines}=fixture();
 const site=vm.runInNewContext(cut('const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+";buildFacilitySite('base')");
 site.id='base';const world=site.map.world;
 Object.assign(c,{facilitySite:site,world,MAP_W:site.map.width,MAP_H:site.map.height,POI_TOWN_RESIDENT_TICK:380,
  terrainHeights:new Map(site.map.terrainHeights.map(o=>[o.x+','+o.z,o.h])),facilityCreekIndex:null});
 for(const key of ['poiTownNpcGraph','poiTownNpcStance','poiTownNpcHere','poiTownNpcActors','poiTownNpcKey'])delete c[key];
 vm.runInContext(cut('const terrainKey=','const terrainY=')+cut('function terrainPassable(','function waterfallFace(')+
 cut('const STAIR_DIRECTIONS=','function elevationStairGeometry(')+cut('const ROAD_BASES=','const baseRoad=')+
 cut('const WALL_MATERIAL_IDS=','// Shared staggered timber')+h.match(/^function isFloor\(t\)\{.+\}$/m)[0]+'\n'+
 cut('function poiWalkPassableDoor','let facilityCreekIndex=')+cut('const POI_TOWN_WALK_DECOR=','function poiTownNpcExistsBed(')+
 cut('function poiTownNpcPlayerBlocksStep','function poiTownNpcReleaseHunt')+
 cut('function poiTownNpcStepT','function poiTownNpcVisualPosition')+
 '\nthis.activeActors=poiTownNpcActors;',c);
 c.activeActors.push(marta,ines,buyer);
 c.poiTownNpcActorOccupied=(x,z,y,except)=>c.activeActors.some(b=>b!==except&&b.x===x&&b.z===z&&b.y===y);
 const route=[];
 for(let i=0;i<94;i++){
  const now=i*380,m=915+Math.floor(now/500);
  c.poiTownNpcPaidShift(buyer,clock(m),now,{plans:2});
  route.push([buyer.x,buyer.z]);
  if(c.poiTownNpcPurseRead().shift.served===1){assert(m<985);break}
 }
 assert(route.some(([x,z])=>x===33&&z===39));assert.deepEqual([buyer.x,buyer.z],[32,38]);
 assert.deepEqual([buyer.coins,marta.coins,ines.coins],[6,2,1]);
});
