const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),html=fs.readFileSync('world-editor.html','utf8');
const cut=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i+1);if(i<0||j<=i)throw Error(a);return html.slice(i,j)};
test('the actual Game World supports a full working day, independent hunts, shared lodging and staffed merchant transactions',()=>{
const site=vm.runInNewContext(cut('const FACILITY_SITES=','function workshopResumeDecode(')+';buildFacilitySite("base")');
const world=site.map.world,worldBefore=JSON.stringify(world),inside=new Set(site.buildings.flatMap(b=>Array.from(b.footprint,o=>o.x+','+o.z)));
const water=new Set([...site.creek.deep,...site.canal.water].map(o=>o.x+','+o.z));
const parts=new Map([site.creek.crossings,...site.canal.bridgePairs].flat().map(o=>[o.x+','+o.z,o]));
let ms=0;const x={world,MAP_W:site.map.width,MAP_H:site.map.height,facilitySite:{...site,id:'base'},poiWalkActive:true,poiWalkLevel:0,
 poiWalkX:31,poiWalkZ:33,poiWalkFacing:0,pineAIActive:false,poiMonsterStates:new Map(),poiMonsterMeshDirty:false,
 poiAudioAllowed:()=>true,poiMonsterAt:()=>null,terrainLevel:()=>0,terrainPassable:()=>true,isWallId:t=>/wall/.test(t),
 validPos:(x,z)=>x>=0&&x<site.map.width&&z>=0&&z<site.map.height,facilityFloorOwner:(x,z)=>inside.has(x+','+z)?0:null,
 facilityCreekIndex:{water,parts,shallows:new Map()},POI_MONSTER_STATS:{monsterSlime:{hp:35,attack:6}},
 POI_ECONOMY_COIN:3,POI_ECONOMY_PRICE:6,POI_PLAYER_MAX_HP:100,poiPlayerHP:100,poiCombatHud(){},
 ROAD_IDS:new Set(world.map(o=>o.type).filter(t=>t.startsWith('road'))),poiTownClockSnapshot(){
  const absoluteMinute=480+Math.floor(ms/500),minute=absoluteMinute%1440;
  return {minute,absoluteMinute,hour:Math.floor(minute/60),day:Math.floor(absoluteMinute/1440)+1};
 }};
vm.createContext(x);vm.runInContext(cut('function poiWalkPassableDoor(','let facilityCreekIndex=')+cut('function isFloor(','// Tabletop decor')+cut('const POI_SAFE_TOWN=','const poiMiniStatic=')+cut('const POI_WILD_MAX=','function poiMonsterCanMove(')+cut('const POI_TOWN_RESIDENT_ROLES=','let cameraTopDown='),x);
const phases=new Map();
for(ms=0;ms<15*60*500;ms+=380){
 x.poiTownResidentsFrame(ms);
 for(const a of x.poiTownResidentsSnapshot().actors){let seen=phases.get(a.id);if(!seen){seen=new Map();phases.set(a.id,seen)}
  if(!seen.has(a.activity))seen.set(a.activity,{minute:x.poiTownClockSnapshot().minute,hp:a.hp,x:a.x,z:a.z,y:a.y});
 }
}

for(const id of ['guildkeeper','innkeeper','diningkeeper','workshopkeeper','toolkeeper','stablekeeper']){
 const a=phases.get(id);assert(a.has('work')&&a.has('going-home')&&a.has('sleep-home'),id+' actually walks to bed after work');
}
const own=phases.get('resadventurer'),traveler=phases.get('guestadventurer');
for(const a of [own,traveler]){
 assert(a.get('fight').hp<100);
 assert(a.get('seek-inn').hp<100);
 assert.equal(a.get('rest-inn').hp,100);
 assert.equal(a.get('rest-inn').y,1);
}
assert.equal(own.get('buy-toolshop').x,59);
assert.equal(own.get('buy-toolshop').z,25);
assert(own.has('sleep-home')&&!own.has('sleep-inn'));
assert(traveler.has('sleep-inn')&&!traveler.has('sleep-home'));
assert.equal(JSON.stringify(world),worldBefore,'simulation never edits the built world');
assert.equal(x.poiPlayerHP,100,'autonomous fights do not damage a player in town');
});
