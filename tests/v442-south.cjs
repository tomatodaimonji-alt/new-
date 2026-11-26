const a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const h=fs.readFileSync(process.argv[2]||path.join(__dirname,'south-move-candidate.html'),'utf8');
for(const m of h.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
function range(from,to){const x=h.indexOf(from);a.ok(x>=0,from);const y=h.indexOf(to,x+from.length);a.ok(y>=0,to);return h.slice(x,y);}
const rooms=range('// BEGIN FRONTIER SOUTH RUINS','function frontierSouthRestoreFloor')+range('const FRONTIER_SOUTH_H=128;','function frontierSouthDefeatsDecode');
const actor=range('// BEGIN MONSTER FREE LEG','// END MONSTER FREE LEG');
const pursuit=range('// BEGIN SOUTH DUNGEON PURSUIT','// END SOUTH DUNGEON PURSUIT');
const shared=typeof process.argv[2]==='string' ? actor : actor+`
function poiMonsterWalkToward(o,s,now,to,legal,ms=380,max=1){
 const cells=poiMonsterActorFootprint(s.x,s.z),walk=(x,z,...rest)=>{if(!legal(x,z,...rest))return false;cells.add(x+','+z);return true;};
 const end=poiActorAdvance(s,to,max,walk,()=>true);
 if(end.stopped||Math.hypot(end.x-to.x,end.z-to.z)>1e-5)return false;
 poiMonsterActorStart(o,s,now,s,end.x,end.z,ms,cells);return true;
}`;
const mob=new Map(),spec={notice:18};
const c=vm.createContext({
 facilitySite:{id:'frontier'},performance:{now:()=>0},poiWalkLevel:-1,
 poiMonsterStates:mob,poiTownNpcActors:[],poiMonsterMeshDirty:false,POI_HUMAN_PARTY_IDS:{},
 poiStatBase:()=>({speed:3}),poiMovementFactor:()=>1,
 poiSouthSentinelSpec:()=>spec,poiSouthSentinelAim:()=>null,frontierExpeditionEnemyTurn:()=>false,
 poiCompanionAttackClear:()=>true,poiPartyActors:()=>[],poiPlayerDying:()=>false,
 poiAimOrigin:()=>({x:160,z:82}),frontierSouthChestAt:(x,z)=>x===160&&z===125
});
vm.runInContext(rooms+range('// BEGIN FREE MOVEMENT SOLVER','// END FREE MOVEMENT SOLVER')+
 range('// BEGIN ACTOR FREE MOVEMENT','// END ACTOR FREE MOVEMENT')+shared+pursuit+
 `globalThis.f={tick:frontierSouthPursuitTick,field:frontierSouthPursuitDistances,
 snap:frontierSouthPursuitSnapshot,cell:frontierSouthPursuitWalkable,sync:poiMonsterActorSync,
 pose:poiMonsterActorPoint, key:frontierSouthPursuitKey,world:FRONTIER_SOUTH_ENEMIES,foot:poiMonsterActorFootprint};`,c);
const f=c.f,first=f.world[1],block={...first,x:151},boss=f.world.at(-1);
const state=(x,z)=>({x,z,hp:100,moveStarted:-1e5,nextAttack:0});
const s=state(150,82),b=state(151,82);b.townOwned=true;
mob.set(first,s);mob.set(block,b);
const pos=()=>{
 const [x,z]=[s.x,s.z];
 a.ok(f.cell(x,z));a.ok(x!==151||z!==82,'occupied cell');
};
const d0=f.field({x:160,z:82}).get(f.key(s.x,s.z));
f.tick(0);a.ok(s.actorFree,'did not route around 151,82');a.equal(s.x,150);a.equal(s.z,82);
const p=f.pose(s.actorFree,110);a.ok(!Number.isInteger(p.x)||!Number.isInteger(p.z),'must fractional between frames');
for(const k of s.actorFree.cells){const [x,z]=k.split(',').map(Number);a.ok(f.cell(x,z));a.ok(x!==151||z!==82);a.equal(f.snap(110).enemies.get(f.key(x,z)),s);}
for(let now=10;now<3400;now+=10){f.sync(now);f.tick(now);pos();}
a.ok(f.field({x:160,z:82}).get(f.key(s.x,s.z))<d0);
a.equal(s.southPursuit,'player');
mob.clear();
const r=state(boss.x,boss.z);r.southPursuit='player';
r.expeditionCounter=null;
c.poiAimOrigin=()=>({x:160,z:113});
mob.set(boss,r);f.tick(3500);
a.ok(r.actorFree&&Math.hypot(r.actorFree.x-r.x,r.actorFree.z-r.z)>=1);
const ms=r.actorFree.ms;f.sync(3500+ms*.5);const q=f.pose(r.actorFree,3500+ms*.5);
a.ok(q.t>0&&q.t<1);a.equal(r.southPursuit,'player');
for(const k of f.foot(q.x,q.z)){const [x,z]=k.split(',').map(Number);a.ok(f.cell(x,z));}
console.log('PASS southern swept continuous motion, occupancy detour/reservations, retained pursuit and boss floor limits');
