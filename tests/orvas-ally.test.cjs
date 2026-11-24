const fs=require('node:fs'),vm=require('node:vm'),a=require('node:assert/strict'),t=require('node:test');
const h=fs.readFileSync(process.env.PRODUCT||'world-editor.html','utf8');
t.test('full-scale unmodified native rig; allied driver never takes hostile slot',()=>{
 const s=h.slice(h.indexOf('function poiCompanionOrvasScale'),h.indexOf('const poiCompanionOrvasFragments'));
 const v=vm.runInNewContext(s+';({scale:poiCompanionOrvasScale,model:poiCompanionOrvasMesh})',{mesh:()=>({p:[],n:[],c:[]}),poiDavidGeometry(m){m.p=[1,2,3];m.n=[0,1,0];m.c=[.91,.17,.09]}});
 for(const y of [-1,0,1])a.equal(v.scale({y}),1);
 const m={p:[],n:[],c:[]};v.model(m,{rig:{},x:8,y:0,z:3,heading:0,scale:1});
 a.deepEqual(m,{p:[9,2,6],n:[0,1,0],c:[.91,.17,.09]});
 const i=h.indexOf('// BEGIN ORVAS ALLY BOSS RUNTIME'),j=h.indexOf('// END ORVAS ALLY BOSS RUNTIME');
 a(i>=0&&j>i);a(!/poiDavidActive\s*=/.test(h.slice(i,j)));
});
function battle(){
 const seen=[],fx=[],p={x:8,z:8,y:0},q={x:8,z:8,y:0,id:'orvasSoul'},allyAttack={x:0,z:1,facing:0};
 const foe={type:'monsterSkeleton',x:11,z:8,y:0},s={x:11,z:8,hp:500},other={type:'monsterSlime',x:9,z:9,y:0},friend={x:9,z:9,hp:500,townOwned:true};
 const b=vm.createContext({poiMonsterStates:new Map([[foe,s],[other,friend]]),poiWalkX:p.x,poiWalkZ:p.z,
  poiCompanionPosition:a=>({x:a.px??a.x,z:a.pz??a.z}),poiAimOrigin:()=>p,poiMonsterPose:(o,s)=>({x:s.x+.5,z:s.z+.5}),
  poiCompanionAttackClear:()=>true,poiCompanionEncounterAllows:()=>true,poiDungeonVisualVisible:()=>true,
  poiWalkLevel:0,facilitySite:{},poiEnemyThreatEnabled:()=>true,
  poiDavidBattleActive:()=>true,poiDavidMatch:()=>({x:11,z:8,y:0,room:{minX:0,maxX:40,minZ:0,maxZ:40}}),poiDavidHidden:()=>false,poiCompanionCell:()=>true,POI_COMPANION_FREE_RADIUS:.2,
  poiAimWall:()=>()=>true,poiAimWallLimit:(_p,d,n,pass)=>b.block?.(d,n)??n,
  poiPlayerDamageTarget:([o,s],x,z,amount,weapon,now,silent,contact,source)=>{s.hp-=amount;seen.push({o,amount,now,source})},
  poiDavidAttackFoley:q=>fx.push(q.kind),poiDavidHeavyContact:k=>fx.push(k),poiDavidFinishBeamFoley:()=>{},
  poiDavidFoleySources:new Map(),poiDavidBeamAudioEnd:()=>{},poiOrvasBladeTrace:()=>{},poiOrvasBeamTrace:()=>{},poiDavidImpactStomp:q=>fx.push(q.davidLeapImpact?'leap':'fracture')});
 const cut=(a,z)=>h.slice(h.indexOf(a),h.indexOf(z,h.indexOf(a)+a.length));
 vm.runInContext(cut('const POI_DAVID_PATTERNS=','let poiDavidActive=')+
  cut('const POI_DAVID_SWEEP_FORWARD','// BEGIN DAVID DIRECTIONAL BEAM')+
  cut('const POI_DAVID_BEAM_GROW','function poiDavidBeamAudioEnd')+
  cut('function poiDavidArea(','const poiDavidLeapClamp')+
  cut('// BEGIN ORVAS ALLY BOSS RUNTIME','// END ORVAS ALLY BOSS RUNTIME'),b);
 return {b,p,q,foe,s,other,friend,seen,fx};
}
t.test('proactive shared four patterns, true boss contact damage, no ally victim or repeat damage',()=>{
 const {b,q,foe,friend,seen,fx}=battle();let now=50;
 vm.runInContext('poiDavidBeamSide=()=>1',b);
 for(const [kind,delta] of [['sweep',[30]],['double',[28,35]],['stomp',[39]],['beam',[47,36]]]){
  const since=seen.length;
  a.equal(b.poiOrvasAllyEngage(q,now),q);
  const attack=q.david.attack;a.equal(attack.kind,kind);
  a.equal(b.poiOrvasAllyResolve(q,now+100,'fight'),true);a.equal(seen.length,since);
  for(let step=200;step<=3000&&q.david.attack;step+=100)b.poiOrvasAllyResolve(q,now+step,'fight');
  a.deepEqual(seen.slice(since).map(x=>x.amount),delta);
  a(seen.every(x=>x.o===foe&&x.source.companion));
  now+=3800;
 }
 a.equal(friend.hp,500);a(fx.includes('fracture'));
});
t.test('live changing-wall LOS, unlandable leap abort, follow and hidden-frame cancellation',()=>{
 const {b,q,s,seen,fx}=battle();
 b.poiOrvasAllyEngage(q,100);
 b.block=()=>0;
 b.poiOrvasAllyResolve(q,300,'fight');b.poiOrvasAllyResolve(q,660,'fight');a.equal(seen.length,0);
 b.poiOrvasAllyResolve(q,677,'follow');a.equal(q.david.attack,null);
 b.block=null;s.x=17;
 b.poiOrvasAllyEngage(q,1400);a.equal(q.david.attack.kind,'leap');
 b.poiOrvasAllyResolve(q,1800,'fight');b.poiOrvasAllyResolve(q,2250,'fight');
 b.block=()=>0;b.poiOrvasAllyResolve(q,2460,'fight');
 a.equal(q.david.attack,null);a.equal(q.x,8);a.equal(seen.length,0);
 b.block=null;b.poiOrvasAllyEngage(q,8500);a.equal(q.david.attack.kind,'leap');
 b.poiOrvasAllyResolve(q,8900,'fight');b.poiOrvasAllyResolve(q,9250,'fight');b.poiOrvasAllyResolve(q,9560,'fight');
 a(q.x>8);a.equal(seen.at(-1).amount,43);a(fx.includes('leap'));
 b.poiOrvasAllyResolve(q,11000,'fight');a.equal(q.david.attack,null);
});

t.test('established canonical boss is retained across an actual arena-sized retreat, not a true room exit',()=>{
 const {b,p,q,foe,s,seen}=battle();
 foe.type='monsterStoneDavid';s.david={awake:true};
 b.poiOrvasAllyEngage(q,1000);
 a(b.poiOrvasAllyBossLatch(q,1100));
 p.x=34;p.z=30;b.poiWalkX=34;b.poiWalkZ=30;
 a(b.poiOrvasAllyBossLatch(q,1300));
 b.poiOrvasAllyResolve(q,1350,'fight');
 b.poiOrvasAllyResolve(q,1560,'fight');
 a.deepEqual(seen.map(v=>v.amount),[30]);
 p.x=41;b.poiWalkX=41;
 b.poiOrvasAllyResolve(q,1597,'fight');
 a(!b.poiOrvasAllyBossLatch(q,1597));a.equal(q.david.attack,null);
});
t.test('the production rubble emitter honors implicit outdoor terrain but not water or an absent cellar floor',()=>{
 const code=h.slice(h.indexOf('function poiDavidRaisedStoneGeometry('),h.indexOf('const globalpoiDavidImpact='));
 const mesh=()=>({p:[],n:[],c:[]}), tri=(m,A,B,C,col)=>{m.p.push(...A,...B,...C);m.c.push(...col,...col,...col)};
 const c=vm.createContext({mesh,tri,poiAimWall:()=>null,poiDavidArena:()=>null,poiDavidIn:()=>true,poiDavidRoomRay:(q,b,d,n)=>n,
  poiDavidFractureFloors:e=>e.floors,facilitySite:{id:'base'},validPos:()=>true,MAP_W:128,MAP_H:182,
  ROAD_IDS:new Set(['roadBrownFull']),ROAD_DIAGONALS:new Set(),terrainY:()=>0,pineEastGroundColor:()=>[.28,.65,.34],
  addFloorTile(m,x,z,id,area,adjacent,tint){
   a.equal(id,'grass');const col=tint(x,z);
   tri(m,[x,0,z],[x,0,z+1],[x+1,0,z+1],col);tri(m,[x,0,z],[x+1,0,z+1],[x+1,0,z],col);
  }});
 vm.runInContext(code,c);
 const e={x:103.1,z:93.9,sx:103,sz:93,y:0,radius:6,arena:{},floors:new Map()};
 const outdoor=c.poiDavidRaisedStoneGeometry(e,e.arena);
 a(outdoor.broken.slabs>0&&outdoor.broken.chips>0&&outdoor.p.length>100);
 a.equal(c.poiDavidRaisedStoneGeometry({...e,y:-1},e.arena).p.length,0);
 const water=new Map(Array.from({length:17*17},(_,i)=>[String(95+i%17)+','+String(85+(i/17|0)),'water']));
 a.equal(c.poiDavidRaisedStoneGeometry({...e,floors:water},e.arena).p.length,0);
});
t.test('follow/dismiss clear only ally-origin traces, not the old unrelated boss or player effects',()=>{
 const {b,q}=battle();
 const oldBoss={kind:'beam'},oldPlayer={kind:'double',player:true},own={kind:'beam',player:true,ally:true};
 b.poiOrvasGroundTraces=[oldBoss,own,oldPlayer];b.poiOrvasGroundDirty=false;
 b.poiOrvasAllyEngage(q,100);
 b.poiOrvasAllyStop(q,130,true);
 a.equal(q.david.attack,null);a.deepEqual(b.poiOrvasGroundTraces,[oldBoss,oldPlayer]);
 a.equal(b.poiOrvasGroundDirty,true);
});
