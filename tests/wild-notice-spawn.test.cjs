const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(a,b)=>{const i=h.indexOf(a),j=h.indexOf(b,i+1);assert(i>=0&&j>i,a);return h.slice(i,j)};
function setup(){
 const ctx={facilitySite:{id:'base'},poiWalkActive:true,poiWalkLevel:0,poiWalkFacing:0,poiWalkX:80,poiWalkZ:70,
  poiAimOrigin:()=>null,pineAIActive:false,pineGameActive:false,poiNextMobTick:0,
  poiMonsterStates:new Map(),poiMonsterMeshDirty:false,POI_MONSTER_STATS:{monsterSlime:{hp:35}},
  world:[],validPos:()=>true,facilityFloorOwner:()=>null,poiMonsterAt:()=>null,
  terrainLevel:()=>0,isFloor:t=>t==='grass',terrainPassable:()=>true,poiWalkCanStep:()=>true,
  facilityCreekIndex:{water:new Set()},poiAudioAllowed:()=>true,poiMineEarlyMayMove:()=>true,
  poiTownNpcActorOccupied:()=>false,performance:{now:()=>0},poiArmedBound:()=>true,poiArmedAim:()=>false,poiCombatActorMake:()=>({hp:50})};
 vm.createContext(ctx);
 vm.runInContext(cut('const POI_SAFE_TOWN=','function poiRegionAt(')+cut('const POI_WILD_MAX=','// BEGIN POND SKATER')+
  cut('// BEGIN FREE MOVEMENT SOLVER','// END FREE MOVEMENT SOLVER')+
  cut('// BEGIN ACTOR FREE MOVEMENT','// END ACTOR FREE MOVEMENT')+
  cut('// BEGIN MONSTER FREE LEG','// END MONSTER FREE LEG')+
  cut('function poiMobFrame(','// Hand-authored standing points'),ctx);
 return ctx;
}
const dist=(p,x,z)=>Math.hypot(p.x-x,p.z-z);
test('a timed field birth retries beyond both the live player pose and the AI tile',()=>{
 const x=setup(),input=[0,0,0,0,1/4],rng=()=>input.shift()??0;
 x.poiAimOrigin=()=>({x:80.56,z:70,y:0});
 for(let now=0;now<=5500;now+=100)x.poiWildSpawnFrame(now,rng);
 const [[o]]=x.poiMonsterStates;
 assert(o&&dist(o,80.56,70)>6.5,'the attempted candidate only 6.44 from the fractional player must be skipped');
 assert.deepEqual([o.x,o.z],[88,70],'the next deterministic legal draw still produces a birth');
});
test('both gate and armed route random births enforce their applicable radius without removing all opportunities',()=>{
 const x=setup();
 Object.assign(x,{poiWalkX:19,poiWalkZ:49,poiWalkFacing:2});
 const p=x.poiWildGatePick(()=>0);
 assert(p&&dist(p,19,49)>6.5,'reachable gate meadow cannot be used inside the slime recognition radius');
 const home={x:82,z:70,y:0,type:'monsterSkelArcher'};
 Object.assign(x,{poiWalkX:80,poiWalkZ:70});x.facilitySite.armedEncounters=[home];x.world=[home];
 x.poiWildRegionalFrame(1000,()=>0);
 assert.equal(x.poiMonsterStates.size,0,'a nearby armed home has no legal birth outside its 8-tile range');
 Object.assign(x,{poiWalkX:75});x.poiWildRegionalFrame(2200,()=>0);
 const spawned=x.poiMonsterStates.get(home);
 assert(spawned&&dist(spawned,75,70)>8,'first actual regional archer must spawn beyond extended ranged recognition');
});
test('a wild slime can roam into recognition and subsequently chase without respawning',()=>{
 const x=setup();
 for(let now=0;now<=5500;now+=100)x.poiWildSpawnFrame(now,()=>0);
 const [[o,s]]=x.poiMonsterStates;
 assert.equal(o.x,87);
 // Make deterministic bearings by offering only the safe westward component.
 vm.runInContext('Math.random=()=>.5',x);
 for(let t=6000;t<10000;t+=380){
  x.poiMonsterActorSync(t);x.poiMobFrame(t);
  if(s.x<87&&dist(s,80,70)<=6.5)break;
 }
 assert(s.x<87&&dist(s,80,70)<=6.5,'production roaming crosses the recognition boundary');
 x.terrainPassable=()=>true;x.poiMonsterCrowdNormal=()=>false;x.poiEnemyAdjacent=()=>false;
 const before=dist(s,80,70);
 for(let t=10000;t<11200;t+=380){x.poiMonsterActorSync(t);x.poiMobFrame(t);}
 assert(dist(s,80,70)<before,'same live actor then takes ordinary pursuit steps');
 assert.equal(x.poiMonsterStates.get(o),s);
});
