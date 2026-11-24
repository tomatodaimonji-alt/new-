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
  ';({realStep:poiDavidMobFrame,step:(o,s,t)=>{const prior=poiAimOrigin;let ok;try{poiAimOrigin=()=>({x:s.x,z:s.z-2,y:o.y});ok=poiDavidMobFrame(o,s,t)}finally{poiAimOrigin=prior};if(ok){const b=poiDavidMatch(o);for(const u of [POI_DAVID_AWAKENING.first,POI_DAVID_AWAKENING.second,POI_DAVID_AWAKENING.ready])poiDavidAwakeningTick(o,s,b,t+u);if(!s.david?.wakeDone)throw Error("post-awakening fixture unavailable");s.david.next=t+620;}return ok},tick:poiDavidCombatFrame,pose:poiDavidPose,approach:poiDavidApproach,inRoom:poiDavidIn,area:poiDavidArea,begin:poiDavidBegin,match:poiDavidMatch,incoming:poiDavidIncoming,cue:poiDavidCueGeometry,beamMesh:typeof poiDavidSweepBeamMesh==="function"?poiDavidSweepBeamMesh:null})',Object.assign(c,{POI_AIM_EPS:1e-7}));
 return {c,s,api,boss};
}

test('true departure clears current attack and uses prior legal cells home without snapping or restarting on reentry',()=>{
 const {c,s,api,boss}=setup(); c.player.z=99;
 api.step(o,s,1000); a(api.approach(o,s,boss,c.player,1650)); a(api.approach(o,s,boss,c.player,1910));
 a.deepEqual([s.x,s.z,s.fromZ],[24,102,103]);
 a(api.begin(o,s,2180,'beam'));s.hp=852;
 c.player.z=94;api.tick(2300);
 a.equal(s.david.attack,null);
 a.equal(api.pose(s,2300).phase,'return');
 a.deepEqual([s.x,s.z],[24,102],'leaving does not teleport');
 a.equal(c.stops,1);
 c.player.z=99;api.step(o,s,2400);
 c.open=()=>false;api.tick(2530);api.tick(2850);
 a.deepEqual([s.x,s.z],[24,102],'blocked route cannot jump a tile');
 a.equal(c.damage.length,0);
 c.open=()=>true;api.tick(3160);
 a.deepEqual([s.x,s.z,s.fromZ],[24,103,102],'starts next adjacent path leg');
 a.equal(api.pose(s,3210).dz,1);
 api.tick(3560);
 a.deepEqual([s.x,s.z,s.fromZ],[24,104,103]);
 a.equal(api.pose(s,3560).phase,'return','remaining real interpolation is not skipped');
 api.tick(4000);
 a.equal(api.pose(s,4000).phase,'dormant');a.equal(api.pose(s,4000).dz,-1);
 a.equal(s.hp,852,'prior live encounter did not heal/reset HP');
});
test('lethal genuine committed hit starts walk-home but cannot keep pending damage, even after player resumes',()=>{
 const {c,s,api,boss}=setup();c.player.z=99;
 api.step(o,s,1000);a(api.approach(o,s,boss,c.player,1650));
 c.player.z=101;c.stock=1;
 a(api.begin(o,s,1950,'double'));
 for(let t=1990;t<=2670;t+=40)api.tick(t);
 a.equal(c.damage.length,1);a.equal(c.damage[0].n,28);a.equal(c.stops,1);
 a.equal(api.pose(s,2670).phase,'return');
 a.deepEqual([s.x,s.z],[24,103]);
 c.poiWalkLevel=-1;c.player.y=-1;api.tick(3000);a.equal(s.z,103);
 c.poiWalkLevel=0;c.player={x:24,z:94,y:0};api.tick(3400);api.tick(3800);
 a.equal(api.pose(s,3800).phase,'dormant');a.equal(c.damage.length,1);
});

test('authored round gallery remains engaged beyond old rectangle, while north outside and exterior remain safe',()=>{
 const {api,c,s,boss}=setup();boss.room.arena=arena;c.player.z=98;
 a(api.step(o,s,1000));
 for(const p of [{x:9,z:104},{x:39,z:105},{x:24,z:119},{x:35,z:116}])
  a(api.inRoom(boss,{...p,y:0}),JSON.stringify(p));
 for(const p of [{x:24,z:93},{x:29,z:89},{x:16,z:91},{x:42,z:104},{x:39,z:118},{x:24,z:104,y:1}])
  a(!api.inRoom(boss,{y:0,...p}),JSON.stringify(p));
 c.stock=1000;c.player={x:24,z:119,y:0};
 for(let t=1650;t<4500;t+=100)api.tick(t);
 a(s.z>108&&!s.david.returning,'the live cardinal pursuit did not start the return');
 c.player={x:24,z:91,y:0};
 api.tick(4500);a(s.david.returning);
});
test('only front reach increases; actual warning fan extents follow the same ellipse in diagonal aims',()=>{
 const {api,boss}=setup();boss.room.arena=arena;
 const dx=Math.SQRT1_2,dz=-dx,q={kind:'sweep',sx:24,sz:104,y:0,dx,dz};
 const p=(f,l)=>({x:q.sx+dx*f+dz*l,z:q.sz+dz*f-dx*l,y:q.y});
 a(api.area(q,p(5.24,0)));a(!api.area(q,p(5.26,0)));
 a(api.area(q,p(0,4.18)));a(!api.area(q,p(0,4.21)));a(!api.area(q,p(-.01,0)));
 a(!api.area({...q,kind:'double'},p(3.6,0)));
 const g=api.cue(q,boss).lane,max=(f,l)=>Math.max(...Array.from({length:g.p.length/3},(_,i)=>{
  const x=g.p[i*3]-24.5,z=g.p[i*3+2]-104.5;return x*f+z*l;
 }));
 a(Math.abs(max(dx,dz)-5.25)<.015);
 a(Math.abs(max(dz,-dx)-4.20)<.015);
});
test('actual scheduled sweep reaches a front target beyond the old 4.2-tile range, but cannot hit outside gate',()=>{
 for(const after of ['stay','exit']){
  const {api,c,s,boss}=setup();boss.room.arena=arena;c.player={x:24,z:99,y:0};c.stock=1000;
  a(api.step(o,s,1000));
  for(let t=1620;t<=2100;t+=40)api.tick(t);
  a.equal(s.david.attack?.kind,'sweep','the scheduler recognizes the new committed reach');
  if(after==='exit')c.player.z=93.4;
  for(let t=2140;t<=2380;t+=40)api.tick(t);
  a.deepEqual(c.damage.map(v=>v.n),after==='stay'?[30]:[]);
 }
});
test('gallery chase stays active and can take actual legal steps toward a diagonal rim',()=>{
 const {api,c,s,boss}=setup();boss.room.arena=arena;c.player.z=98;
 a(api.step(o,s,1000));c.stock=1000;c.player={x:34,z:115,y:0};
 for(let t=1650;t<5100;t+=100)api.tick(t);
 a(s.x>26&&s.z>106&&!s.david.returning);
 const q={kind:'sweep',sx:24,sz:95,y:0,dx:0,dz:-1};
 const vertices=api.cue(q,boss).lane.p;
 a(vertices.length>0);
 a(Math.min(...vertices.filter((_,i)=>i%3===2))>=arena.minZ+.5-1e-6);
});
test('360 actual analog headings remain in the legitimate interior cells at the wall; only the entrance exits',()=>{
 const build=vm.runInNewContext(cut('const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+';buildFacilitySite');
 const site=build('base');site.id='base';const b=site.davidTemple.boss;
 const oz=b.z-104;
 const c={facilitySite:site,world:site.map.world.filter(o=>o.x>=2&&o.x<=45&&o.z>=81+oz&&o.z<=128+oz),poiWalkActive:true,poiWalkX:24,poiWalkZ:b.z,poiWalkLevel:0,
  facilityCreekIndex:null,validPos:(x,z)=>x>=0&&z>=0&&x<128&&z<site.map.height,poiMonsterAt:()=>null,
  poiIsMonster:t=>t==='monsterStoneDavid',pineSuperVehicleType:()=>false,isWallId:t=>/wall/i.test(t),
  isFloor:t=>/^(road|grass|earth|woodfloor)/.test(t)};
 const v=vm.runInNewContext(cut('function poiWalkPassableDoor(','let facilityCreekIndex=')+
  cut('function poiWalkCanStep(','function poiFreeCenter(')+cut('// BEGIN FREE MOVEMENT SOLVER','// END FREE MOVEMENT SOLVER')+
  cut('// BEGIN DAVID TEMPLE COMBAT','function poiDavidLine(')+';({advance:poiFreeAdvance,legal:poiWalkCanStep,in:poiDavidIn})',c);
 const memo=new Map(),step=(x,z,fx,fz)=>{
  const k=[x,z,fx,fz].join(',');
  if(!memo.has(k))memo.set(k,v.legal(x,z,fx,fz));return memo.get(k);
 };
 let wall=0,gate=0,wide=0;
 for(let deg=0;deg<360;deg++){
  const r=deg*Math.PI/180,x=Math.cos(r),z=Math.sin(r);let exited=false;
  const enter=(x,z,fx,fz)=>{if(fz===site.davidTemple.interior.exitZ&&z===fz-1&&x>=23&&x<=25)exited=true;return step(x,z,fx,fz)};
  const p=v.advance(b.x,b.z,x*20,z*20,.20,step,enter);
  if(exited){gate++;a(!v.in(b,{...p,y:0}),JSON.stringify({deg,p}));continue;}
  wall++;if(Math.hypot(p.x-b.x,p.z-b.z)>16.95)wide++;
  a(v.in(b,{...p,y:0}),JSON.stringify({deg,p}));
 }
 a(wall>300&&gate>5&&wide>10,'exercises wall, gate and previously lost fractional positions');
 for(const [x,z] of [[29,83],[34,89],[42,104],[40.51,109.3],[24,121],[6.3,104]])a(!v.in(b,{x,z:z+oz,y:0}),[x,z+oz]);
});
