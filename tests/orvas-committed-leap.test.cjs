const fs=require('node:fs'),vm=require('node:vm'),a=require('node:assert/strict'),t=require('node:test');
const h=fs.readFileSync(process.env.PRODUCT||'world-editor.html','utf8');
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

const frame=(b,q,attack,mode='fight')=>{
 for(let now=attack.start+100;now<attack.leap.land;now+=100)b.poiOrvasAllyResolve(q,now,mode);
};
t.test('a live creature moving under the committed arc does not cancel the landing into beam',()=>{
 const {b,q,s,seen,fx}=battle();s.x=18;
 b.poiOrvasAllyEngage(q,100);
 const attack=q.david.attack;
 a.equal(attack.kind,'leap');
 frame(b,q,attack);
 // Dynamic occupation on the already-selected arc is not a newly closed wall.
 b.poiCompanionCell=(x,z)=>x!==12||z!==8;
 b.poiOrvasAllyResolve(q,attack.leap.land,'fight');
 a.equal(q.david.attack,attack,'the visible leap must complete, not yield to the beam chooser');
 a.equal(q.x,attack.leap.x);
 a.equal(attack.executed,1);a.deepEqual(seen.map(x=>x.amount),[43]);a.equal(fx.filter(k=>k==='leap').length,1);
 for(let now=attack.leap.land+50;now<attack.until;now+=100){
  a(b.poiOrvasAllyResolve(q,now,'fight'));a.equal(q.david.attack,attack);
 }
 a.equal(seen.length,1);
});
t.test('occupied landing picks the nearest lawful point along the trajectory and lands once',()=>{
 const {b,q,s,seen,fx}=battle();s.x=18;
 b.poiOrvasAllyEngage(q,100);const attack=q.david.attack;const x=attack.leap.x;
 frame(b,q,attack);
 b.poiCompanionCell=(cx,cz)=>cx!==x||cz!==8;
 b.poiOrvasAllyResolve(q,attack.leap.land,'fight');
 a.equal(q.david.attack,attack);a.equal(q.x,x-1);
 a.equal(attack.sx,x-1);a.equal(attack.executed,1);
 a.deepEqual(seen.map(x=>x.amount),[43]);a.equal(fx.filter(k=>k==='leap').length,1);
});
t.test('a wall closing mid-flight clips the nearest legal landing and the shockwave does not pass it',()=>{
 const {b,q,s,seen,fx}=battle();s.x=18;
 b.poiOrvasAllyEngage(q,100);const attack=q.david.attack;
 frame(b,q,attack);
 b.block=(_dir,len)=>Math.min(len,3.5);
 b.poiOrvasAllyResolve(q,attack.leap.land,'fight');
 a.equal(q.david.attack,attack);a.equal(q.x,11);
 a.equal(attack.executed,1);a.equal(seen.length,0);a.equal(fx.filter(k=>k==='leap').length,1);
});
t.test('target death alone cannot cancel canonical-room leap; actual arena exit can',()=>{
 for(const leave of [false,true]){
  const {b,p,q,foe,s,fx}=battle();
  foe.type='monsterStoneDavid';s.x=18;s.david={awake:true};
  b.poiOrvasAllyEngage(q,100);const attack=q.david.attack;
  a.equal(attack.kind,'leap');
  frame(b,q,attack);
  s.hp=0;
  if(leave){p.x=41;b.poiWalkX=41;}
  b.poiOrvasAllyResolve(q,attack.leap.land,'fight');
  a.equal(attack.executed,leave?0:1);a.equal(fx.filter(k=>k==='leap').length,leave?0:1);
 }
});
