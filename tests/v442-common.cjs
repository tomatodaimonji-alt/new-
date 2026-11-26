const fs=require('node:fs'),vm=require('node:vm'),a=require('node:assert/strict');const h=fs.readFileSync(process.argv[2]||'candidate.html','utf8');
for(const m of h.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
const fn=n=>{const m=h.match(new RegExp('^function '+n+'\\([^]*?^}','m'));a.ok(m,n);return m[0]};
const c=vm.createContext({poiFreeCell:v=>Math.floor(v+.5),POI_MONSTER_FREE_TICK:380,POI_ACTOR_RADIUS:.2,poiMonsterMeshDirty:false,
 poiMonsterActorActive:new Map(),poiActorHeading:(dx,dz)=>Math.atan2(-dx,dz),poiMovementFactor:()=>1,poiStatBase:()=>({speed:3}),
 poiActorAdvance:(from,to,max,pass)=>{
  const d=Math.hypot(to.x-from.x,to.z-from.z),r=Math.min(1,max/d),dest={x:from.x+(to.x-from.x)*r,z:from.z+(to.z-from.z)*r};
  const x=Math.floor(dest.x+.5),z=Math.floor(dest.z+.5);
  return pass(x,z,Math.floor(from.x+.5),Math.floor(from.z+.5))?{...dest,distance:d*r,stopped:false}:{...from,distance:0,stopped:true}
 }});
vm.runInContext(['poiMonsterActorFootprint','poiMonsterActorPoint','poiMonsterActorStart','poiMonsterWalkToward'].map(fn).join('\n'),c);
const o={type:'monsterGoblin'},s={x:0,z:0};const permit=(x,z)=>x<=1&&z===0;
a.ok(c.poiMonsterWalkToward(o,s,1000,{x:1,z:0},permit));
a.deepEqual([s.x,s.z],[0,0]);a.equal(c.poiMonsterActorPoint(s.actorFree,1190).x,.5);
a.ok(s.actorFree.cells.has('1,0')&&s.actorFree.cells.has('0,0'));
a.equal(c.poiMonsterWalkToward(o,s,1190,{x:2,z:0},permit),false,'cannot replace an in-progress leg');
a.equal(c.poiMonsterWalkToward(o,s,1380,{x:2,z:0},permit),false,'wall rejection');
a.ok(c.poiMonsterWalkToward(o,s,1380,{x:1,z:1},(x,z)=>x===1&&z===1));
a.equal(c.poiMonsterActorPoint(s.actorFree,1380).x,1);
a.equal(c.poiMonsterActorPoint(s.actorFree,1570).z,.5);
a.ok(c.poiMonsterMeshDirty);
console.log('PASS common swept monster leg preserves fractional point, active-leg lock, collision and reservation');
