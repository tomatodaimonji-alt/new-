const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const h=fs.readFileSync(process.argv[2]||'world-editor.html','utf8');
function cut(a,b){const x=h.indexOf(a),y=h.indexOf(b,x+1);assert(x>=0&&y>x,a);return h.slice(x,y)}
const point=(x,z)=>({x,z,y:0}),clock=(m,d=0)=>({minute:m,absoluteMinute:d*1440+m}),asFood=p=>[p.inn,p.supplier,p.eaten,p.northMeal];
function setup(from=null){
 const box=new Map(),o={host:true,settled:true,failed:false,gesture:0};
 if(from!==null)box.set('world-workshop-base-npc-purse-v1',JSON.stringify(from));
 const c={facilitySite:{id:'base'},localStorage:{getItem:k=>box.get(k)??null,setItem:(k,v)=>{if(o.failed)throw Error('quota');box.set(k,v)}},
  poiTownNpcHere:(a,p)=>a.x===p.x&&a.z===p.z&&a.y===p.y,poiTownNpcStepT:()=>o.settled?1:.99,poiTownNpcHostReady:()=>o.host,
  poiTownNpcMove:(a,p)=>{o.target=p;return c.poiTownNpcHere(a,p)},poiTownNpcAct:(a,k)=>{a.activity=k},
  poiTownNpcKey:(...a)=>a.join(','),poiTownNpcStance:()=>true,poiTownNpcGraph:()=>({cells:new Map([['44,31,0',['benchWood']]])}),
  poiTownNpcGesture:()=>{o.gesture++}};
 vm.createContext(c);vm.runInContext(cut('// BEGIN TOWN NPC CANONICAL PURSE','// END TOWN NPC CANONICAL PURSE')+
 cut('// BEGIN TOWN NPC INN MEAL','// END TOWN NPC INN MEAL'),c);return {c,box,o};
}
const pre={version:1,issued:6,guestadventurer:{coins:0,herbs:0,night:0},resadventurer:{coins:0,herbs:0,night:-1},
 toolkeeper:0,innkeeper:2,towncook:4,food:{inn:4,supplier:6,day:0}};
const actor=()=>({role:{id:'northtraveler',role:'visitor'},...point(39,39),hp:39,potions:1,coins:0});
test('no food from opening reserve; walk to bench and commit once only when actual meetup is settled and staffed',()=>{
 const {c,o,box}=setup(pre),a=actor(),call=m=>c.poiTownNpcInnMeal(a,clock(m),m*400,{plans:2});
 assert.deepEqual(asFood(c.poiTownNpcPurseRead().food),[4,6,0,-1]);
 assert.equal(call(829),false);assert.equal(call(835),true);assert.deepEqual([o.target.x,o.target.z],[43,31]);
 assert.deepEqual(asFood(c.poiTownNpcPurseRead().food),[4,6,0,-1]);Object.assign(a,point(43,31));
 o.host=false;call(836);assert.equal(c.poiTownNpcPurseRead().food.inn,4);o.host=true;
 o.settled=false;call(837);assert.equal(c.poiTownNpcPurseRead().food.inn,4);o.settled=true;
 o.failed=true;call(838);assert.equal(c.poiTownNpcPurseRead().food.inn,4);assert.equal(o.gesture,0);
 o.failed=false;call(840);assert.deepEqual(asFood(c.poiTownNpcPurseRead().food),[3,6,1,0]);assert.equal(o.gesture,1);
 assert.deepEqual([a.hp,a.potions,a.coins,c.poiTownNpcPurseRead().issued],[39,1,0,6]);
 const cold=setup(JSON.parse([...box.values()][0])).c;cold.poiTownNpcInnMeal(a,clock(845),7000,{plans:2});assert.equal(cold.poiTownNpcPurseRead().food.inn,3);
 assert.equal(setup().c.poiTownNpcInnMeal(actor(),clock(840),0,{plans:2}),false);
});
test('next day second bought portion consumed; unrelated NPCs fail closed and normal stock reconciles',()=>{
 const {c}=setup({...pre,food:{inn:3,supplier:6,day:0,eaten:1,northMeal:0}}),a=actor();
 Object.assign(a,point(43,31));
 assert.equal(c.poiTownNpcInnMeal({...a,role:{id:'towncook'}},clock(840,1),0,{plans:2}),false);
 c.poiTownNpcInnMeal(a,clock(840,1),0,{plans:2});assert.deepEqual(asFood(c.poiTownNpcPurseRead().food),[2,6,2,1]);
 assert.equal(c.poiTownNpcInnMeal(a,clock(840,2),3000,{plans:2}),false);
});
test('actual north traveler can reach sheltered service through authored inn door well inside meal window',()=>{
 const site=vm.runInNewContext(cut('const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+";buildFacilitySite('base')");
 site.id='base';const world=site.map.world;
 const c={facilitySite:site,world,MAP_W:site.map.width,MAP_H:site.map.height,terrainHeights:new Map(site.map.terrainHeights.map(o=>[o.x+','+o.z,o.h])),facilityCreekIndex:null};
 vm.runInNewContext(cut('const terrainKey=','const terrainY=')+cut('function terrainPassable(','function waterfallFace(')+
 cut('const STAIR_DIRECTIONS=','function elevationStairGeometry(')+cut('const ROAD_BASES=','const baseRoad=')+
 cut('const WALL_MATERIAL_IDS=','// Shared staggered timber')+h.match(/^function isFloor\(t\)\{.+\}$/m)[0]+'\n'+
 cut('function poiWalkPassableDoor','let facilityCreekIndex=')+cut('const POI_TOWN_WALK_DECOR=','function poiTownNpcExistsBed(')+
 cut('// BEGIN TOWN NPC INN MEAL','// END TOWN NPC INN MEAL')+
 '\nthis.route=poiTownFindPath({x:58,z:41,y:0},POI_NPC_MEAL_POINT,(_,p)=>p.x===41&&p.z===30);',c);
 assert(c.route?.length<=30);assert(c.route.some(p=>p.x===41&&p.z===33&&p.y===0));
 assert(world.some(o=>o.type==='benchWood'&&o.x===44&&o.z===31&&o.y===0));
});
