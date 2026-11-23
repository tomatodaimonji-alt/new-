const a=require('node:assert/strict'),test=require('node:test'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(x,y)=>{const i=h.indexOf(x),j=h.indexOf(y,i+1);a.ok(i>=0&&j>i,x);return h.slice(i,j)};
function fixture(count=3,sealed=false,wildBand=null){
 const states=new Map(),attacks=new Set();
 for(let z=1;z<=count;z++){
  const obj={type:'monsterGoblin',x:0,z,y:0};
  states.set(obj,{x:0,z,hp:40,wildSpawn:wildBand!==null,fromX:0,fromZ:z,nextAttack:0,moveStarted:-1e4});
 }
 const env={poiMonsterStates:states,poiNextMobTick:0,poiWalkActive:true,poiWalkX:0,poiWalkZ:0,poiWalkLevel:0,
  poiWalkViewX:0,poiWalkViewZ:0,poiMonsterMeshDirty:false,facilitySite:{id:'base'},pineGameActive:false,
  terrainLevel:()=>0,poiWildPlayerOutside:()=>true,facilityCreekIndex:null,poiWildExterior:x=>Math.abs(x)<=wildBand,
  poiMineEarlyMayMove:()=>true,poiEnemyThreatEnabled:()=>true,world:[],poiWalkPassableDoor:t=>t==='woodwallDoor',
  poiActorSameGrade:()=>true,poiTownNpcActorOccupied:()=>false,poiFreeCell:x=>Math.floor(x+.5),
  poiEnemyAttackSourceValid:()=>true,poiEnemyBeginPlayer:(o,s)=>{attacks.add(o);s.nextAttack+=2000},
  poiActorAdvance:(from,to,max,legal)=>{
   const dx=to.x-from.x,dz=to.z-from.z,d=Math.hypot(dx,dz),k=Math.min(1,max/d),x=from.x+dx*k,z=from.z+dz*k;
   if(!legal(Math.floor(x+.5),Math.floor(z+.5),Math.floor(from.x+.5),Math.floor(from.z+.5)))return {...from,stopped:true,distance:0};
   return {x,z,distance:d*k};
  },
  poiActorHeading:()=>0,POI_ACTOR_RADIUS:.2,
  poiMonsterAt:(x,z,_reserve,state)=>[...states].find(([o,s])=>s!==state&&o.y===0&&s.hp>0&&(
   s.actorFree?.cells.has(x+','+z)||s.x===x&&s.z===z)),
  poiWalkCanStep:(x,z,_fx,_fz,s)=>(!sealed||x===0)&&!env.poiMonsterAt(x,z,true,s),poiPlayerRayClear:(x,z)=>!sealed||x===0,
  poiMonsterCanMove:(x,z,s,fx,fz)=>!(x===0&&z===0)&&(!sealed||x===0)&&!env.poiMonsterAt(x,z,true,s)&&
   (!s.wildSpawn||env.poiWildMobMayMove(s,x,z,fx,fz)),
 };
 vm.createContext(env);vm.runInContext(cut('function terrainPassable(','function waterfallFace(')+
  cut('function poiWildMobMayMove(','function poiWildSpawnTerrain(')+cut('// BEGIN ENEMY ANGLES','// END ENEMY ANGLES')+cut('// BEGIN MONSTER FREE LEG','// END MONSTER FREE LEG')+
  cut('function poiMonsterChaseFree(','// Hand-authored standing points'),env);
 const step=t=>{env.poiMonsterActorSync(t);env.poiMobFrame(t)};
 return {env,states,attacks,step};
}
test('three same-column followers occupy three different legal attack positions rather than waiting forever',()=>{
 const f=fixture();
 for(let t=0;t<4500;t+=380){
  f.step(t);
  const occupied=[...f.states.values()].map(({x,z})=>x+','+z);
  a.equal(new Set(occupied).size,occupied.length,'solid non-overlapping actors');
  a(!occupied.includes('0,0'),'player remains solid');
 }
 a.equal(f.attacks.size,3);
 a.ok([...f.states.values()].some(s=>s.x!==0));
});
test('single enemy / duo is unchanged, and a one-wide corridor never permits wall jumps',()=>{
 for(const [n,sealed] of [[1,false],[2,false],[3,true]]){
  const f=fixture(n,sealed);
  for(let t=0;t<3500;t+=380)f.step(t);
  a.equal(f.attacks.size,1);
  a.ok([...f.states.values()].every(s=>s.x===0));
 }
});
test('real wild movement predicate needs an inbound cardinal edge; outdoor queue splits only inside its leash',()=>{
 for(const [band,attacks] of [[4,3],[0,1]]){
  const f=fixture(3,false,band);
  a.equal(f.env.terrainPassable(1,1,1,1),false);
  for(let t=0;t<4500;t+=380)f.step(t);
  a.equal(f.attacks.size,attacks);
  a([...f.states.values()].every(s=>Math.abs(s.x)<=band));
 }
});
