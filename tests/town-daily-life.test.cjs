const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.GAME||require('node:path').join(__dirname,'../world-editor.html'),'utf8');
const cut=(a,b)=>{ const i=h.indexOf(a),j=h.indexOf(b,i+a.length);assert(i>=0&&j>i,a);return h.slice(i,j); };
const clock=(minute,day=1)=>({minute,day,absoluteMinute:(day-1)*1440+minute});
function setup(full=false){
 const site=vm.runInNewContext(cut('const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+";buildFacilitySite('base')");
 site.id='base';const world=site.map.world;
 const parts=new Map([site.creek.crossings,...site.canal.bridgePairs].flat().map(o=>[o.x+','+o.z,o]));
 const c={facilitySite:site,world,MAP_W:site.map.width,MAP_H:site.map.height,terrainHeights:new Map(site.map.terrainHeights.map(o=>[o.x+','+o.z,o.h])),facilityCreekIndex:{parts,shallows:new Map()},
  poiWalkActive:true,pineAIActive:false,poiWalkLevel:0,poiWalkX:15,poiWalkZ:30,poiWalkFacing:0,poiWalkFromX:15,poiWalkFromZ:30,poiWalkStarted:0,poiWalkStepMs:175,
  poiAudioAllowed:()=>true,poiMonsterAt:()=>null,poiMonsterStates:new Map(),poiMonsterMeshDirty:false,
  POI_ECONOMY_COIN:3,POI_ECONOMY_PRICE:6,POI_HOTBAR_HEAL:30,POI_PLAYER_MAX_HP:100,poiPlayerHP:100,poiCombatHud(){},
  POI_MONSTER_STATS:{monsterSlime:{hp:35,attack:6}},POI_SOUTH_MERCHANT_ID:'southmerchant',POI_PLAYER_NPC_CLEARANCE:.56,POI_PLAYER_NPC_EPS:1e-6,POI_WALK_MS:175,
  poiWildExterior:()=>false,poiWildSpawnTerrain:()=>new Set(),facilityFloorOwner:()=>null,
  minute:0,poiTownClockSnapshot:()=>clock(c.minute%1440,Math.floor(c.minute/1440)+1)
 };
 vm.runInNewContext(cut('const terrainKey=','const terrainY=')+cut('function terrainPassable(','function waterfallFace(')+
 cut('const STAIR_DIRECTIONS=','function elevationStairGeometry(')+cut('const ROAD_BASES=','const baseRoad=')+
 cut('const WALL_MATERIAL_IDS=','// Shared staggered timber')+h.match(/^function isFloor\(t\)\{.+\}$/m)[0]+'\n'+
 cut('function poiWalkPassableDoor(','let facilityCreekIndex=')+
 cut('const POI_TOWN_RESIDENT_ROLES=',full?'let cameraTopDown=':'function poiTownNpcInit(')+
 (full?cut('function poiTownNpcPlayerBodyBlocks(','// BEGIN ACTOR FREE MOVEMENT'):'') ,c);
 c.roster=vm.runInNewContext('POI_TOWN_RESIDENT_ROLES',c);
 return c;
}
const inside=(p,q)=>p.x===q.x&&p.z===q.z&&p.y===q.y;
test('keepers stagger personal shifts but all authored work goals remain at every public service time',()=>{
 const c=setup(),keepers=c.roster.filter(o=>o.role==='keeper');
 let starts=[],nights=[];
 for(const role of keepers){
  const first=Array.from({length:450},(_,m)=>m).find(m=>c.poiTownDailyPlan(role,clock(m))?.label==='going-work');
  assert(Number.isInteger(first),role.id);starts.push(first);
  const last=Array.from({length:360},(_,i)=>1080+i).find(m=>c.poiTownDailyPlan(role,clock(m))?.label==='going-home');nights.push(last);
  for(let m=450;m<1080;m+=15){
   const p=c.poiTownDailyPlan(role,clock(m));assert.equal(p.label,'work');assert(inside(p.goal,role.work));
  }
 }
 assert(new Set(starts).size>=4);assert(new Set(nights).size>=4);
});
test('visible day visitors have individual named errands, shift weekends and leave normally',()=>{
 const c=setup(), role=id=>c.roster.find(o=>o.id===id);
 assert.equal(c.poiTownDailyPlan(role('westpeddler'),clock(850)).label,'market-browse');
 assert.equal(c.poiTownDailyPlan(role('northtraveler'),clock(840)).label,'meal-break');
 assert.equal(c.poiTownDailyPlan(role('towncook'),clock(875)).label,'market-browse');
 assert.equal(c.poiTownDailyPlan(role('towncook'),clock(650)).label,'work');
 const a=c.poiTownDailyPlan(role('canalcourier'),clock(1150,1));
 const b=c.poiTownDailyPlan(role('canalcourier'),clock(1150,2));
 assert.notEqual(a.label,b.label);assert.equal(b.recessed,true);
 assert.equal(c.poiTownDailyPlan(role('westpeddler'),clock(1200)).recessed,true);
});
test('night porter is visible across midnight with known public rounds apart from north watch and no service or bed',()=>{
 const c=setup(), night=c.poiTownDailyRoles().find(a=>a.id==='nightporter');
 assert(night);assert(!night.bed);assert(!night.workBuilding);
 const labels=new Set();
 for(const m of [1180,1240,1320,1380,0,80,160,260,340]){
  const p=c.poiTownDailyPlan(night,clock(m));assert(!p.recessed,m);labels.add(p.label);
 }
 assert(labels.size>=2);assert(c.poiTownDailyPlan(night,clock(660)).recessed);
 for(let m=0;m<1440;m+=15){
  const guard=c.poiTownDutyRoles().filter(o=>o.role==='watch').some(o=>!c.poiTownDutyPlan(o,m).recessed);
  assert(guard||!c.poiTownDailyPlan(night,clock(m)).recessed,m);
 }
});
test('every new phase goal lies on the real map and daily connections preserve actual legal routes',()=>{
 const c=setup();
 for(const role of [...c.roster,...c.poiTownDailyRoles()]){
  let prev=null;
  for(let m=0;m<2880;m++){
   const p=c.poiTownDailyPlan(role,clock(m%1440,Math.floor(m/1440)+1));if(!p)continue;
   assert(c.poiTownNpcStance(p.goal),role.id+' '+m+' '+JSON.stringify(p.goal));
   if(prev&&!inside(p.goal,prev.goal))
    assert(c.poiTownFindPath(prev.goal,p.goal)?.length,role.id+' '+m+' '+JSON.stringify([prev.goal,p.goal]));
   prev=p;
  }
 }
});
test('real dawn-to-dawn ticks travel through visible day/evening/night phases and staff actual service stations',()=>{
 const c=setup(true),phases=new Map(),porter=new Set(),opens=[];
 const world=JSON.stringify(c.world);
 for(let now=0;now<24*60*500;now+=130){
  c.minute=300+Math.floor(now/500);
  c.poiTownResidentsFrame(now);
  const actors=c.poiTownResidentsSnapshot().actors;
  const inTown=actors.find(a=>a.id==='nightporter');assert(inTown);
  if(c.minute>=1200&&c.minute<=1660){assert(!inTown.recessed);porter.add(inTown.x+','+inTown.z);}
  for(const a of actors){
   if(!phases.has(a.id))phases.set(a.id,new Set());
   phases.get(a.id).add(a.activity);
  }
  if(c.minute===460&&opens.length===0)
   for(const a of actors.filter(a=>a.role==='keeper')) if(a.id!=='southmerchant')opens.push([a.id,a.activity]);
 }
 assert.equal(opens.length,6);
 for(const [id,phase] of opens)assert.equal(phase,'work',id);
 assert(porter.size>=4,'night worker actually traverses the road between public stops');
 for(const [id,label] of [['westpeddler','market-browse'],['towncook','market-browse'],['northtraveler','meal-break'],['canalcourier','evening-delivery'],['guildkeeper','evening-walk']])
  assert(phases.get(id).has(label),id+' reached '+label);
 assert.equal(JSON.stringify(c.world),world,'timed routine cannot edit map or items');
});
test('a resumed player on a scheduled public stop never starts inside a resident and can leave naturally',()=>{
 const c=setup(true);c.minute=850;c.poiWalkX=c.poiWalkFromX=52;c.poiWalkZ=c.poiWalkFromZ=44;
 c.poiTownResidentsFrame(0);
 const miner=()=>c.poiTownResidentsSnapshot().actors.find(a=>a.id==='westpeddler');
 assert(!inside(miner(),{x:52,z:44,y:0}));assert(inside(miner().goal,{x:52,z:44,y:0}));
 for(let t=400;t<3000;t+=400){c.poiTownResidentsFrame(t);assert(!inside(miner(),{x:52,z:44,y:0}));}
 c.poiWalkX=c.poiWalkFromX=14;c.poiWalkZ=c.poiWalkFromZ=30;
 for(let t=3000;t<6800;t+=400)c.poiTownResidentsFrame(t);
 assert(inside(miner(),{x:52,z:44,y:0}));assert.equal(miner().activity,'market-browse');
});
