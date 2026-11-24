const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(x,y)=>{const i=h.indexOf(x),j=h.indexOf(y,i+x.length);a(i>=0&&j>i,x);return h.slice(i,j)};
const arena={x:24,z:104,radius:16.95,minZ:93.5};
const o={type:'monsterStoneDavid',x:24,z:104,y:0};
function setup(){
 const boss={...o,room:{minX:16,maxX:31,minZ:96,maxZ:112}},s={x:24,z:104,hp:1050,facing:2},c={
  facilitySite:{id:'base',davidTemple:{boss}},poiWalkActive:true,document:{hidden:false,addEventListener:(event,fn)=>{c.visibility=fn}},poiWalkLevel:0,poiWalkX:24,poiWalkZ:100,player:{x:24,z:101,y:0},
  poiMonsterStates:new Map([[o,s]]),poiMonsterMeshDirty:false,valid:true,roll:.99,Math:Object.assign(Object.create(Math),{random:()=>c.roll}),wall:()=>false,stock:100,damage:[],sounds:[],stops:0,open:()=>true,
  poiEnemyThreatEnabled:()=>c.valid,poiAimOrigin:()=>c.player,poiAimWall:()=>((x,z)=>!c.wall(x,z)),
  poiMobHitPlayer:(obj,now,n)=>{c.damage.push({obj,now,n});c.stock-=n;return c.stock<=0},
  poiMonsterCanMove:(x,z,state,fx,fz)=>c.open(x,z,fx,fz),poiDavidStopAttackFoley:()=>c.stops++,poiSound:id=>c.sounds.push(id),poiDavidAttackFoley:(q,_p,_b,i,phase)=>c.sounds.push({kind:q.kind,i,phase}),terrainY:()=>0,
  mesh:()=>({p:[],c:[]}),poiEnemyCuePoint:(x,z,y)=>[x+.5,.153+y*1.4,z+.5],
  quad:(m,...q)=>{m.c.push(q.pop());for(const p of q)m.p.push(...p)}
 
 };
 const api=vm.runInNewContext(cut('// BEGIN DAVID TEMPLE COMBAT','// END DAVID TEMPLE COMBAT')+
  cut('function poiAimWallLimit(','function poiAimChooseLock(')+cut('// BEGIN DAVID TEMPLE CUES','// END DAVID TEMPLE CUES')+
  ';({realStep:poiDavidMobFrame,step:(o,s,t)=>{const ok=poiDavidMobFrame(o,s,t);if(ok){const b=poiDavidMatch(o);for(const u of [POI_DAVID_AWAKENING.first,POI_DAVID_AWAKENING.second,POI_DAVID_AWAKENING.ready])poiDavidAwakeningTick(o,s,b,t+u);if(!s.david?.wakeDone)throw Error("post-awakening fixture unavailable");s.david.next=t+620;}return ok},tick:poiDavidCombatFrame,pose:poiDavidPose,approach:poiDavidApproach,inRoom:poiDavidIn,area:poiDavidArea,begin:poiDavidBegin,match:poiDavidMatch,incoming:poiDavidIncoming,cue:poiDavidCueGeometry,beamMesh:typeof poiDavidSweepBeamMesh==="function"?poiDavidSweepBeamMesh:null})',Object.assign(c,{POI_AIM_EPS:1e-7}));
 return {c,s,api,boss};
}


const arm=(api,c,s)=>{c.player.z=98;api.step(o,s,1000);c.player.z=94;api.tick(1620);return s.david.attack};
test('real distance selection commits a fixed landing, radius 7 and only a single true contact',()=>{
 const {c,s,api,boss}=setup();boss.room.arena=arena;c.stock=1000;
 const q=arm(api,c,s);a.equal(q?.kind,'leap');a(q.leap.z<=96&&q.leap.z>=95);
 a.equal(api.pose(s,1800).phase,'windup');a.equal(c.damage.length,0);
 for(let t=1700;t<=2500;t+=100)api.tick(t);
 const air=api.pose(s,2500);a.equal(air.phase,'airborne');a(air.leapHeight>0&&air.leapZ<104);
 a.equal(s.z,104,'air pose cannot change grounded occupancy early');
 c.player={x:30.85,z:q.leap.z,y:0};
 for(let t=2600;t<=3000;t+=100)api.tick(t);
 a.equal(c.damage.length,1);a(c.damage[0].n>=40);a.equal(s.z,q.leap.z);
 a.equal(api.pose(s,3000).phase,'recover');a.equal(api.incoming(o,s,28,3000),28);
});
test('real exit while airborne cancels contact and traces a visibly grounded reverse without snapping',()=>{
 const {c,s,api,boss}=setup();boss.room.arena=arena;
 const q=arm(api,c,s);a.equal(q?.kind,'leap');
 for(let t=1700;t<=2400;t+=100)api.tick(t);
 const before=api.pose(s,2400);a(before.leapHeight>1);
 c.player.z=91;api.tick(2400);a(s.david.attack===null);
 const start=api.pose(s,2400);a(Math.abs(start.leapZ-before.leapZ)<1e-8);
 api.tick(2500);const rev=api.pose(s,2500);a(rev.leapZ>start.leapZ);
 api.tick(3000);a.equal(api.pose(s,3000).phase,'dormant');a.deepEqual([s.x,s.z],[24,104]);a.equal(c.damage.length,0);
});
test('warning radius is seven actual ground tiles; moving beyond its edge, walls and extra floors cannot take the landing damage',()=>{
 for(const mode of ['outside','wall','upper','late-wall']){
  const {api,c,s,boss}=setup();boss.room.arena=arena;c.stock=1000;
  c.player={x:24,z:110,y:0};api.step(o,s,1000);c.player.z=114;api.tick(1620);
  const q=s.david.attack;a.equal(q.kind,'leap');
  const g=api.cue(q,boss).lane.p;
  a(Math.abs(Math.max(...g.filter((_,i)=>i%3===0))-(q.sx+.5+7))<.018,'cue reaches exactly 7 on clear east side');
  for(let t=1700;t<=2500;t+=100)api.tick(t);
  c.player={x:mode==='outside'?31.2:30.6,z:q.leap.z,y:mode==='upper'?1:0};
  if(mode==='wall')c.wall=(x,z)=>x===27;
  if(mode==='late-wall')c.wall=(x,z)=>z===109;
  for(let t=2600;t<3090;t+=100)api.tick(t);
  a.equal(c.damage.length,0,mode);
  if(mode==='outside'||mode==='wall')a.equal(q.executed,1,'real landing still happens after a dodge');
  else a.equal(q.executed,0,'bad floor or blocked flight cannot land an attack');
 }
});
test('a nearby player still receives original scheduler; leaps cannot spam after successful landing',()=>{
 const {api,c,s,boss}=setup();boss.room.arena=arena;c.stock=1000;
 api.step(o,s,1000);api.tick(1620);a.equal(s.david.attack.kind,'sweep');
 for(let t=1700;t<3200;t+=100)api.tick(t);
 c.player={x:24,z:114,y:0};
 for(let t=3200;t<5000&&!s.david.attack?.leap;t+=100)api.tick(t);
 const q=s.david.attack;a.equal(q.kind,'leap');
 c.player={x:24,z:97,y:0};
 for(let t=q.start+80;t<q.start+4200;t+=80){
  api.tick(t);
  a(!(s.david.attack?.kind==='leap'&&s.david.attack!==q),'private cooldown excludes a second jump');
 }
});
