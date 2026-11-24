const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(x,y)=>{const i=h.indexOf(x),j=h.indexOf(y,i+x.length);a.ok(i>=0&&j>i,x);return h.slice(i,j)};
function staff(){
 const c={POI_PLAYER_ATTACK:20,POI_HOTBAR_SWORD_BONUS:8,POI_SWORD_HALF_WIDTH:1.5};
 const o=vm.runInNewContext(cut('// BEGIN PLAYER WEAPON PROFILES','function poiPlayerWeaponCancel(')+
  cut('// BEGIN WORLD MELEE REACH','// Visual release only:')+
  cut('function characterArmRotation(','function roundStack(')+
  ';({profile:poiPlayerWeaponProfile("equipLongStaff"),pose:ms=>poiPlayerProfilePose("equipLongStaff",ms),'+
  'plan:ms=>poiWorldMeleePlan("equipLongStaff",poiPlayerWeaponProfile("equipLongStaff"),ms),rig:poiRigidHeldRotation,characterArmRotation})',c);
 return o;
}
const close=(actual,expected)=>a.ok(Math.abs(actual-expected)<1e-7,[actual,expected]);
test('weapon tuning stays 2 tiles with unchanged 20 damage at 210 ms, and the arm rises rearward before chopping',()=>{
 const s=staff(),p=s.profile;
 a.deepEqual([p.range,p.damage,p.hit,p.ready,p.pose],[2,20,210,510,400]);
 const hold=s.pose(108),hit=s.pose(210),follow=s.pose(243);
 a.equal(hold.staffStrike,true);a.equal(hold.staffPhase,'hold');
 a.equal(hit.staffPhase,'down');a.equal(follow.staffPhase,'follow');
 a.equal(hold.staffThrust,undefined,'not the former spear-like jab');
 const hand=pose=>{const [,y,z]=s.characterArmRotation(pose.strike,pose.sweep)(0,.55-.965,.028);return [y,z]};
 a.ok(hand(hold)[0]>.20&&hand(hold)[1]<-.12,'grip is visibly lifted behind shoulder');
 a.ok(hand(hit)[1]>.30,'hands swing through in front at real contact');
 a.ok(hand(follow)[0]<hand(hit)[0],'hand follows down after contact');
});
test('one grip-connected shaft arcs high and rearward, reaches exact forward contact and falls below it',()=>{
 const s=staff(),w=s.plan(110),a1=s.plan(147),a2=s.plan(183),at=s.plan(210),after=s.plan(254);
 a.equal(w.arc,'staff-down');a.ok(w.height>2.20&&w.forward<.06);
 a.ok(a1.height>a2.height&&a2.height>at.height&&at.height>after.height);
 a.ok(a1.forward<a2.forward&&a2.forward<at.forward);
 close(at.height,.74);close(at.forward,2);close(at.mix,1);close(at.side,0);
 const handle=[0,.64,0],apex=[-.026,2.18,.02],g={x:.26,y:.91,z:.39};
 for(const plan of [w,a1,a2,at,after]){
  const rig=s.rig(plan,g,apex,handle,[1,1,1],(...v)=>v);
  const tip=rig(...apex.map((v,i)=>v-handle[i])),held=rig(0,0,0);
  const length=Math.hypot(...apex.map((v,i)=>v-handle[i]));
  const aim=[plan.side-g.x,plan.height-g.y,plan.forward-g.z],gap=Math.hypot(...aim);
  for(let i=0;i<3;i++)close(tip[i],aim[i]*length/gap);
  close(Math.hypot(...tip),length);close(Math.hypot(...held),0);
 }
});
test('skeleton long staff alone uses the corresponding overhead visual, retaining original engine timing',()=>{
 const api=vm.runInNewContext(cut('// BEGIN ENEMY ATTACK MOTION','// END ENEMY ATTACK MOTION')+
  ';({pose:poiEnemyVisualAttack})',{});
 const strike={start:10,hit:670,pending:true,dx:0,dz:1,visualHitAt:null};
 const state={playerAttack:strike};
 const held=api.pose('monsterSkelLongStaff',state,400);
 a.equal(held.variant,'staff-overhead');a.equal(held.phase,'windup');a.ok(held.pitch<-.65);
 strike.pending=false;strike.visualHitAt=670;
 const contact=api.pose('monsterSkelLongStaff',state,670);
 a.equal(contact.phase,'impact');a.ok(contact.pitch>.74);
 a.equal(strike.hit-strike.start,660);
 a.equal(api.pose('monsterSkelSpearman',state,670).variant,'spear-thrust');
});

