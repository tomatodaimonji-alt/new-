const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const point=(x,z,y=0,facing=0)=>({x,z,y,facing});
function setup(){
 const a=html.indexOf('const POI_TOWN_RESIDENT_TICK='),b=html.indexOf('let cameraTopDown=',a);
 assert(a>=0&&b>a,'missing resident runtime');
 const host={id:'innkeeper',name:'宿屋',type:'humanVillager',role:'keeper',work:point(2,2),home:point(1,1),bed:point(1,2)};
 const guest={id:'adventurer',name:'冒険者',type:'humanKnight',role:'adventurer',work:point(8,2),home:point(1,4),bed:point(1,5)};
 const bed={id:'guest-1',x:4,z:2,y:1,stand:point(4,3,1,0)};
 const x={POI_TOWN_RESIDENT_ROLES:[host,guest],POI_TOWN_INN_BEDS:[bed],POI_TOWN_INN:{hostId:host.id,desk:point(2,3)},MAP_W:12,MAP_H:8,
  facilitySite:{id:'base'},poiWalkActive:true,pineAIActive:false,poiAudioAllowed:()=>true,
  poiWalkX:2,poiWalkZ:3,poiWalkLevel:0,poiWalkFacing:0,poiPlayerHP:46,POI_PLAYER_MAX_HP:100,
  poiCombatHud(){},poiTownClockSnapshot:()=>({minute:x.minute,hour:Math.floor(x.minute/60),day:1,absoluteMinute:x.minute}),
  minute:480,terrainPassable:()=>true,terrainY:()=>0,facilityCreekIndex:null,
  isFloor:t=>t==='woodfloor',isWallId:t=>t==='stonewall',poiWalkPassableDoor:t=>t==='woodwallDoor',
  POI_ECONOMY_COIN:3,POI_ECONOMY_PRICE:6,POI_HOTBAR_HEAL:30,POI_WILD_MAX:3,POI_MONSTER_STATS:{monsterSlime:{hp:35,attack:6}},poiMonsterStates:new Map(),poiWildActors:new Set(),
  poiWildExterior:()=>false,poiWildSpawnTerrain:()=>new Set(),
  world:[{...point(1,2),type:'bed'},{...point(1,5),type:'bed'},{...point(4,2,1),type:'bed'},
   {...point(3,3),type:'guildStairUp'},{...point(3,3,1),type:'guildStairDown'},
   {...point(4,3,1),type:'woodfloor'}]};
 vm.createContext(x);vm.runInContext(html.slice(a,b),x);
 return x;
}
test('paired stairs are entered and left as grid edges, with missing stair and blocked beds rejected',()=>{
 const x=setup();
 const p=x.poiTownFindPath(point(2,3),point(4,3,1));
 assert.deepEqual(Array.from(p,o=>[o.x,o.z,o.y]),[[3,3,1],[4,3,1]]);
 assert.equal(x.poiTownFindPath(point(2,3),point(4,2,1)),null);
 x.world=x.world.filter(o=>o.type!=='guildStairDown');
 assert.equal(x.poiTownFindPath(point(2,3),point(4,3,1)),null);
});
test('host service books a real bed once, reserves it against others and heals only next to that bed',()=>{
 const x=setup();
 x.poiTownResidentsFrame(0);
 assert.equal(x.poiTownPlayerService(),'book');
 assert.equal(x.poiTownRequestPlayerLodging().ok,true);
 assert.equal(x.poiTownRequestPlayerLodging().reason,'booked');
 assert.equal(x.poiTownResidentsSnapshot().innBeds[0].occupant,'player');
 assert.equal(x.poiTownRestPlayer().ok,false);assert.equal(x.poiPlayerHP,46);
 Object.assign(x,{poiWalkX:4,poiWalkZ:3,poiWalkLevel:1});
 assert.equal(x.poiTownPlayerService(),'rest');
 assert.equal(x.poiTownRestPlayer().ok,true);assert.equal(x.poiPlayerHP,100);
 assert.equal(x.poiTownPlayerService(),null);
});
test('adventurer trades actual blows with a slime then reports HP without changing the map or coins',()=>{
 const x=setup(),obj={type:'monsterSlime',y:0};
 const slime={x:8,z:2,hp:35,townOwned:true,townHunt:'adventurer'};
 x.poiMonsterStates.set(obj,slime);
 const a={role:{id:'adventurer'},x:7,z:2,y:0,facing:0,hp:100,attacks:0,attackAt:0,target:obj};
 assert(x.poiTownNpcFight(a,0,{plans:2}));
 assert.equal(a.activity,'fight');assert.equal(slime.hp,22);assert.equal(a.hp,94);
 assert(x.poiTownNpcFight(a,500,{plans:2}));assert.equal(a.attacks,1);
 assert(x.poiTownNpcFight(a,800,{plans:2}));
 assert(x.poiTownNpcFight(a,1600,{plans:2}));
 assert.equal(a.attacks,3);assert.equal(a.coins,3);assert.equal(slime.hp,0);assert.equal(a.hp,88);assert.equal(a.target,null);
});
test('healthy traveler checks in before night; a resident gives back a healed spare room and goes home',()=>{
 const x=setup(),bed=x.POI_TOWN_INN_BEDS[0];
 const status=()=>x.poiTownResidentsSnapshot().actors.find(a=>a.id==='adventurer');
 const run=(minute,first)=>{x.minute=minute;for(let i=0;i<50;i++)x.poiTownResidentsFrame(first+i*400)};
 bed.residentId='adventurer';
 run(1035,0);assert.equal(status().activity,'rest-inn');assert.equal(status().bedId,bed.id);
 run(1290,30000);assert.equal(status().activity,'sleep-inn');assert.equal(status().y,1);
 x.poiTownResidentsReset();delete bed.residentId;
 run(480,60000);
 vm.runInContext("poiTownNpcActors.find(a=>a.role.id==='adventurer').hp=70",x);
 run(650,90000);assert.equal(status().activity,'rest-inn');assert.equal(status().hp,100);
 run(675,120000);assert.equal(status().bedId,null);assert.notEqual(status().activity,'rest-inn');
 run(1300,150000);assert.equal(status().activity,'sleep-home');assert.equal(status().y,0);
});
test('NPC prey never consumes or claims a natural player slime',()=>{
 const x=setup(),natural={type:'monsterSlime',y:0},wild={x:8,z:2,hp:35,wildSpawn:true};
 x.poiMonsterStates.set(natural,wild);x.poiWildActors.add(natural);
 x.poiWildExterior=()=>true;x.poiWalkX=-20;
 const a={role:{id:'adventurer'},x:7,z:2,y:0,index:0,encounterAt:0};
 const npc=x.poiTownNpcPickTarget(a,300);
 assert(npc&&npc!==natural);assert(!wild.townHunt);
 const state=x.poiMonsterStates.get(npc);assert(state.townOwned&&!state.wildSpawn);
 assert.deepEqual([...x.poiWildActors],[natural]);
 a.target=npc;x.poiTownNpcReleaseHunt(a);
 assert(!x.poiMonsterStates.has(npc));assert(x.poiMonsterStates.has(natural));
 assert.equal(wild.hp,35);
});
test('NPC shop needs a real working keeper and counter, buys one with NPC gold and uses it in an emergency',()=>{
 const x=setup(),clerk={id:'toolkeeper',name:'店主',type:'humanMerchant',role:'keeper',work:point(6,4,0,3),public:point(4,4,0,1),home:point(6,3),bed:point(6,2)};
 x.POI_TOWN_RESIDENT_ROLES.push(clerk);
 x.world.push({...point(5,4),type:'counterLuxury',rot:1},{...point(5,4),type:'poiLedgerPapers'});
 x.poiTownResidentsFrame(0);
 const a=vm.runInContext("poiTownNpcActors.find(a=>a.role.id==='adventurer')",x);
 Object.assign(a,{...clerk.public,hp:100,coins:6,potions:0,target:null});
 x.world.pop();assert.equal(x.poiTownNpcShop(a,900,{plans:2}),false);assert.equal(a.coins,6);
 x.world.push({...point(5,4),type:'poiLedgerPapers'});
 assert.equal(x.poiTownNpcShop(a,900,{plans:2}),true);
 assert.equal(a.activity,'buy-toolshop');assert.equal(a.coins,0);assert.equal(a.potions,1);
 assert.equal(x.poiTownNpcShop(a,1100,{plans:2}),true);assert.equal(a.potions,1);
 a.hp=34;assert(x.poiTownNpcEmergencyHeal(a));assert.equal(a.hp,64);assert.equal(a.potions,0);
 assert.equal(x.poiPlayerHP,46);
});
