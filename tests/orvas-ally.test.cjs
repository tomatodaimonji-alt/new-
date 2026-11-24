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
  poiWalkLevel:0,facilitySite:{},poiEnemyThreatEnabled:()=>true,poiDavidHidden:()=>false,poiCompanionCell:()=>true,POI_COMPANION_FREE_RADIUS:.2,
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
