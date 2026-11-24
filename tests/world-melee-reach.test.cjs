const a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),test=require('node:test');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const close=(x,y,tol=1e-6)=>a.ok(Math.abs(x-y)<=tol,`${x} versus ${y}`);
function setup(){
 const i=h.indexOf('// BEGIN WORLD MELEE REACH'),j=h.indexOf('// END WORLD MELEE REACH',i);
 a.ok(i>=0&&j>i,'player-only reach rig exists');
 const result=vm.runInNewContext(h.slice(i,j)+';({poiWorldMeleePlan,poiRigidHeldRotation,poiWorldMeleeContact})',{ POI_SWORD_HALF_WIDTH:1.5 });
 return result;
}
const cases=[
 ['equipWoodSword',1.3,108,296,true],['equipBoneSword',1.55,108,296,true],['equipIronSword',2,108,296,true],
 ['kitchenKnife',1,80,190],['equipStoneMace',1,380,620],['equipPlainStaff',1,140,300],['equipLongStaff',2,210,400]
];
test('all existing melee contact keys drive a rigid edge toward their original range',()=>{
 const {poiWorldMeleePlan:plan,poiRigidHeldRotation:rig}=setup();
 for(const [k,range,hit,pose,sweep] of cases){
  const profile={range,hit,pose,sweep};const g={x:.25,y:.86,z:.39};
  a.equal(plan(k,profile,0),null,k);
  a.equal(plan(k,profile,pose),null,k);
  const key=plan(k,profile,hit);close(key.forward,range);close(key.side,0);close(key.mix,1);
  const lead=[-.04,1.42,.01],grip=[0,.25,0];
  const tx=rig(key,g,lead,grip,[1,1,1],(...v)=>v),shaft=lead.map((v,i)=>v-grip[i]),p=tx(...shaft);
  const aim=[-g.x,key.height-g.y,range-g.z],length=Math.hypot(...shaft),gap=Math.hypot(...aim);
  for(let i=0;i<3;i++)close(p[i],aim[i]*length/gap);
  close(Math.hypot(...p),length);close(Math.hypot(...tx(0,0,0)),0);
  const N=tx(.2,.9,.3);close(Math.hypot(...N),Math.hypot(.2,.9,.3));
 }
});
test('sword tracks both sides of the actual footprint around the front contact rather than aiming all frames straight',()=>{
 const {poiWorldMeleePlan:plan}=setup();
 const p={range:2,hit:108,pose:296,sweep:true};
 const early=plan('equipIronSword',p,86),late=plan('equipIronSword',p,147);
 a.ok(early.side>.6&&late.side<-.6);
 for(const key of [early,late]){
  a.ok(Math.abs(key.side)<=1.5+1e-7);a.ok(key.forward<=2+1e-7);a.ok(key.forward>0);
 }
});
test('spear, missiles, and unprofiled or catalog tools do not use this melee prop rig',()=>{
 const {poiWorldMeleePlan:plan}=setup(),p={range:2,hit:108,pose:296,sweep:true};
 for(const k of ['equipWoodSpear','equipWoodBow','fireWand',null,'equipStoneSword','equipFryingPan']){
  a.equal(plan(k,p,108),null,k);
 }
});
test('real world avatar uses committed oblique strike angle in a late contact frame, leaving catalog mesh compact',()=>{
 const cut=(start,end)=>{const a=h.indexOf(start);return h.slice(a,h.indexOf(end,a+1))};
 const type='equipIronSword',profile={range:2,hit:108,pose:296,sweep:true};
 const heading=Math.atan2(-.6,.8),originX=10.46,originZ=17.5,now=1370;
 const e={poiWalkMesh:null,poiWalkActive:true,poiWalkActionStarted:1000,poiWalkActionWeapon:type,
  poiWalkAttackPosePending:false,poiPlayerWeaponProfile:()=>profile,
  poiAimAttack:{started:1000,y:-1,heading,meleeVisual:{clock:now,x:originX,z:originZ,dx:.6,dz:.8,forward:2}},
  poiWalkStarted:950,POI_WALK_MS:180,poiWalkLevel:-1,poiWalkFacing:0,poiWalkViewX:10,poiWalkViewZ:17,
  poiWalkFromX:10,poiWalkFromZ:17,poiWalkX:10,poiWalkZ:17,EQUIPMENT_IDS:[type],POI_SWORD_HALF_WIDTH:1.5,
  poiCreekPlayerHeight:()=>0,poiEquippedWeapon:()=>type,poiWalkSwordPose:()=>null,
  poiRoleToolGripStyle:()=>null,poiPlayerProfilePose:(_,ms)=>({strike:ms===108?1.5:0,twist:0,edgeTilt:1.45}),
  mesh(){return {p:[],n:[],c:[]}},characterHuman(){},deco(m){m.p=[-.018,1.6,.02,0,.25,0];m.n=[0,1,0,0,1,0];m.c=[.5,.5,.5,.2,.2,.2]},
  upload:m=>m};
 const source=cut('// BEGIN WORLD MELEE REACH','// END WORLD MELEE REACH')+
  cut('function poiBuildPlayerMesh(','const POI_MONSTER_BREAK_MS=')+
  cut('function characterArmRotation(','function roundStack(')+cut('function rot2(','function rotY(').split('\n')[0];
 vm.runInNewContext(source,e);
 e.poiWalkAvatar(now);a.equal(e.poiWalkAttackPosePending,true);
 const [x,y,z]=e.poiWalkMesh.p;
 close((x-originX)*.6+(z-originZ)*.8,2,.04);
 close((x-originX)*.8-(z-originZ)*.6,0,.007);
 close(y,-1.4+.03+.77,.007);
 const p=e.poiBuildPlayerMesh(type,null,null);
 a.ok(p.p[1]<1.7,'catalog uses unchanged original wrist rig');
});

