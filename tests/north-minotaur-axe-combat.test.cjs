const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(x,y)=>{const i=h.indexOf(x),j=h.indexOf(y,i+x.length);a.ok(i>=0&&j>i,x);return h.slice(i,j)};
const id='equipNorthMinotaurAxe';
function game(){
 const damage=[],sounds=[],wear=[],env={POI_PLAYER_ATTACK:20,POI_HOTBAR_SWORD_BONUS:8,poiWalkActive:true,
  poiWalkX:0,poiWalkZ:0,poiWalkLevel:-1,poiWalkFacing:0,poiPlayerWeaponPending:null,document:{hidden:false},
  poiEquippedWeapon:()=>env.weapon??id,poiWalkAvatar(){},
  poiAimWall:()=>((x,z)=>!(x===-1&&z>=1)),
  poiAimOrigin:()=>({x:0,z:0,y:-1}),
  poiAimTargetList:()=>env.targets,poiAimNewShot:shot=>({...shot,aim:{x:0,z:0,y:-1},dx:0,dz:1}),
  poiEquipmentSpendWeapon:x=>{wear.push(x);return true},
  poiSound:(...values)=>sounds.push(values),
  poiPlayerDamageTarget:(m,x,z,raw)=>{damage.push([m[0].label,raw]);m[1].hp-=raw},
  poiPlayerWeaponCancel:()=>{env.poiPlayerWeaponPending=null}};
 const api=vm.runInNewContext(cut('// BEGIN ANGULAR COMBAT MATH','// END ANGULAR COMBAT MATH')+
  cut('// BEGIN PLAYER WEAPON PROFILES','function poiPlayerWeaponCancel(')+
  cut('function poiSwordResolve(','function poiPlayerCastFireWand(')+
  cut('function poiPlayerWeaponFrame(','// A shoulder-led flat cut')+
  cut('// BEGIN WORLD MELEE REACH','// Visual release only:')+
  ';({profile:poiPlayerWeaponProfile,pose:poiPlayerProfilePose,plan:poiWorldMeleePlan,rig:poiRigidHeldRotation,start:poiPlayerStartProfile,frame:poiPlayerWeaponFrame})',env);
 return {api,env,damage,sounds,wear};
}
const target=(label,x,z,y=-1,type='monsterSkeleton')=>({id:{label,y,type},state:{hp:60},x,z});
test('boss reward axe is slow and distinct; exact front and both side boundaries contact once, with no rear/wall/floor hits',()=>{
 const {api,env,damage,wear,sounds}=game(),p=api.profile(id),iron=api.profile('equipIronSword');
 a.ok(p,'new equippable axe has an actual combat profile');
 a.deepEqual([p.range,p.damage,p.hit,p.ready,p.pose,p.speed,p.reach,p.frontArc],[2.55,34,300,800,670,2,3,true]);
 a.deepEqual([iron.range,iron.damage,iron.hit,iron.ready,iron.sweep],[2,30,108,350,true]);
 env.targets=[target('far-front',0,2.55),target('exact-right',2.55,0),target('diagonal',1.5,1.5),
  target('exact-left',-2.55,0),target('behind-side',2,-.001),target('beyond',0,2.551),
  target('different-floor',1,1,0),target('wall',-.8,1.6),target('origin',0,0)];
 a.equal(api.start(id,10),true);a.equal(env.poiAttackReady,810);
 api.frame(309);a.deepEqual(damage,[]);a.deepEqual(wear,[]);
 api.frame(310);api.frame(311);
 a.deepEqual(damage,[['far-front',34],['exact-right',34],['diagonal',34],['exact-left',34]]);
 a.deepEqual(wear,[id]);a.deepEqual(sounds,[['hit',id,false,true]]);
});
test('an empty strike uses just one air cue at contact with no weapon wear',()=>{
 const {api,env,sounds,wear}=game();
 env.targets=[target('rear',0,-1)];
 a.ok(api.start(id,20));a.deepEqual(sounds,[]);
 api.frame(319);a.deepEqual(sounds,[]);
 api.frame(320);api.frame(380);
 a.deepEqual(wear,[]);a.deepEqual(sounds,[['attack',id,false,true]]);
});
test('one grip-connected slow blade winds, sweeps the full angular envelope, and reaches 2.55 at contact',()=>{
 const {api}=game(),p=api.profile(id);a.ok(p);
 const a0=api.plan(id,p,158),a1=api.plan(id,p,300),a2=api.plan(id,p,470);
 a.equal(a0.arc,'north-player-axe');a.equal(api.pose(id,158).axePhase,'wind');
 a.equal(api.pose(id,300).axePhase,'contact');a.equal(api.pose(id,470).axePhase,'sweep');
 for(const plan of [a0,a1,a2])a.ok(Math.abs(Math.hypot(plan.side,plan.forward)-2.55)<1e-6);
 a.ok(a0.side>2.52&&a2.side< -2.52);a.ok(Math.abs(a1.side)<1e-7);
 const grip=[0,.64,0],g={x:.21,y:.85,z:.40},apex=[.4661,2.82886,0];
 for(const plan of [a0,a1,a2]){
  const rig=api.rig(plan,g,apex,grip,[1,1,1],(...v)=>v);
  const shaft=apex.map((v,i)=>v-grip[i]),hit=rig(...shaft),hand=rig(0,0,0);
  const aim=[plan.side-g.x,plan.height-g.y,plan.forward-g.z],gap=Math.hypot(...aim);
  a.ok(Math.hypot(...hit.map((v,i)=>v-aim[i]*Math.hypot(...shaft)/gap))<1e-6);
  a.ok(Math.abs(Math.hypot(...hit)-Math.hypot(...shaft))<1e-6);
  a.ok(Math.hypot(...hand)<1e-9);
 }
});
test('an all-slime sweep routes one soft contact while a mixed sweep keeps one standard material cue',()=>{
 for(const mixed of [false,true]){
  const {api,env,sounds,wear,damage}=game();
  env.targets=[target('soft',0,1,-1,'monsterSlime'),target('peer',.7,1,-1,mixed?'monsterSkeleton':'monsterSlime')];
  api.start(id,10);api.frame(310);
  a.equal(wear.length,1);a.equal(damage.length,2);
  a.deepEqual(sounds,mixed?[['hit',id,false,true]]:[['hit',id,false,true,'monsterSlime']]);
 }
});

