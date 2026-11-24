const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const block=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i+1);assert(i>=0&&j>i,'missing '+a);return html.slice(i,j)};
function setup(){
 const x={facilitySite:{id:'base'},poiWalkActive:true,poiWalkLevel:0,poiWalkFacing:0,poiWalkX:81,poiWalkZ:31,pineAIActive:false,
  poiMonsterStates:new Map(),poiMonsterMeshDirty:false,POI_MONSTER_STATS:{monsterSlime:{hp:35}},
  world:[],validPos:(x,z)=>x>=0&&z>=0&&x<96&&z<56,facilityFloorOwner:()=>null,poiMonsterAt:()=>null,
  terrainLevel:()=>0,isFloor:t=>['grass','earth','river','stone','moss'].includes(t),terrainPassable:()=>true,
  facilityCreekIndex:{water:new Set()},poiAudioAllowed:()=>true};
 vm.createContext(x);
 vm.runInContext(block('const POI_SAFE_TOWN=','function poiRegionAt(')+block('const POI_WILD_MAX=','function poiMonsterCanMove('),x);
 return x;
}
test('wild spawn candidate excludes roads, deep water, obstructions, landmarks and protected town buffer',()=>{
 const x=setup();
 const choose=()=>x.poiWildPick(()=>0);
 assert.deepEqual({...choose()},{x:88,z:31});
 for(const type of ['earth','river','stone','treeBirch','roadCobbleFull']){
  x.world=[{x:88,z:31,y:0,type}];x.poiWildInvalidate();assert.equal(choose(),null,type);
 }
 x.world=[];x.poiWildInvalidate();
 x.facilityCreekIndex.water.add('88,31');assert.equal(choose(),null);x.facilityCreekIndex.water.clear();
 x.poiWalkFacing=1;assert.equal(choose(),null,'not directly in front of player');x.poiWalkFacing=0;
 x.poiWalkX=77;x.poiWalkZ=36;assert.equal(choose(),null,'inside old watchtower');
 x.poiWalkX=55;x.poiWalkZ=43;assert.equal(choose(),null,'inside expanded town boundary');
 x.poiWalkX=60;x.poiWalkZ=45;assert.equal(x.poiWildPlayerOutside(),false);
 x.poiWalkX=63;assert.equal(x.poiWildPlayerOutside(),true);
 assert.equal(x.poiWildMobMayMove({x:63,z:45},61,45),false);
});
test('foreground outside time spawns weak transient slimes only, capped and reset without writing world',()=>{
 const x=setup(),initial=x.world,back=x.poiAudioAllowed;let now=0;
 const advance=(ms,rng=()=>0)=>{for(let i=0;i<ms;i+=100)x.poiWildSpawnFrame(now+=100,rng)};
 x.poiWalkX=19;advance(10000);assert.equal(x.poiMonsterStates.size,0);
 x.poiWalkX=81;advance(2500);assert.equal(x.poiMonsterStates.size,0);
 x.poiAudioAllowed=()=>false;advance(15000);assert.equal(x.poiMonsterStates.size,0);x.poiAudioAllowed=back;
 x.pineAIActive=true;advance(10000);assert.equal(x.poiMonsterStates.size,0);x.pineAIActive=false;
 advance(3600);assert.equal(x.poiMonsterStates.size,1);
 const [[obj,actor]]=x.poiMonsterStates;
 assert.equal(obj.type,'monsterSlime');assert(actor.wildSpawn);assert.equal(actor.hp,35);
 assert.equal(x.world,initial);assert.equal(x.world.length,0);
 advance(40000);assert.equal(x.poiMonsterStates.size,3);
 x.poiWildClear();assert.equal(x.poiMonsterStates.size,0);assert.equal(x.poiWildSnapshot().count,0);
 x.facilitySite={id:'stable'};advance(30000);assert.equal(x.poiMonsterStates.size,0);
});
test('live slimes release their transient slot when the player has traveled far away',()=>{
 const x=setup();
 for(let now=0;now<6000;now+=100)x.poiWildSpawnFrame(now,()=>0);
 assert.equal(x.poiWildSnapshot().count,1);
 x.poiWalkX=66;x.poiWalkZ=10;x.poiMonsterMeshDirty=false;
 x.poiWildSpawnFrame(6000,()=>0);
 assert.equal(x.poiWildSnapshot().count,0);
 assert.equal(x.poiMonsterStates.size,0);
 assert.equal(x.poiMonsterMeshDirty,true);
});
test('both narrow gate approaches offer reachable side-on meadow tiles without changing the distant solver',()=>{
 const x=setup(),rng=()=>0;
 const pos=(a,b,face)=>Object.assign(x,{poiWalkX:a,poiWalkZ:b,poiWalkFacing:face});
 const restricted=(range,grass)=>{
  const {x1,z1,x2,z2}=range;
  x.world=[];
  for(let z=z1;z<=z2;z++)for(let xx=x1;xx<=x2;xx++)
   if(!grass.some(p=>p[0]===xx&&p[1]===z))x.world.push({x:xx,z,y:0,type:'earth'});
  x.poiWildInvalidate();
 };
 pos(19,49,2);
 restricted({x1:6,z1:47,x2:33,z2:55},[[26,51]]);
 assert.deepEqual({...x.poiWildPick(rng)},{x:26,z:51});
 x.world.push({x:26,z:51,y:0,type:'poiFortWall'});
 x.poiWildInvalidate();assert.equal(x.poiWildGatePick(rng),null);
 pos(64,45,1);
 restricted({x1:62,z1:34,x2:80,z2:55},[[65,52]]);
 assert.deepEqual({...x.poiWildPick(rng)},{x:65,z:52});
 x.facilityCreekIndex.water.add('65,52');assert.equal(x.poiWildGatePick(rng),null);
 assert.equal(x.poiWildPick(rng),null,'near east gate does not fall back across water');
 x.facilityCreekIndex.water.clear();
 pos(19,47,2);assert.equal(x.poiWildPlayerOutside(),false);
 assert.equal(x.poiWildMobMayMove({x:19,z:48},19,47),false);
 for(const [a,b] of [[18,47],[20,47],[62,44],[62,45],[62,46]]){pos(a,b,1);assert.equal(x.poiWildPlayerOutside(),false);}
 pos(81,31,0);x.world=[];x.poiWildInvalidate();assert.deepEqual({...x.poiWildPick(rng)},{x:88,z:31});
});
