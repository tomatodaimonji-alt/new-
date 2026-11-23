const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function extract(a,b){
 const i=html.indexOf(a),j=html.indexOf(b,i+a.length);assert(i>=0&&j>i,a+' missing');return html.slice(i,j);
}
function setup(weapon,{dx=1,dz=0,analog=false}={}){
 let now=1000;const contacts=[],enemies=new Map(),origin=analog?{x:10.12,z:9.91}:{x:10,z:10};
 const c={world:[],poiMonsterStates:enemies,facilitySite:{id:'base'},poiWalkActive:true,poiWalkLevel:0,poiWalkFacing:1,
  poiWalkX:10,poiWalkZ:10,poiWalkFromX:10,poiWalkFromZ:10,poiWalkStarted:0,poiWalkStepMs:160,POI_WALK_MS:160,
  poiFreePose:analog?{...origin,level:0,angle:Math.atan2(-dx,dz)}:null,
  poiWalkActionStarted:0,poiWalkActionWeapon:null,poiAttackReady:0,validPos:()=>true,isWallId:s=>s==='wall',poiWalkPassableDoor:s=>s==='door',
  poiMonsterPose:(_o,s)=>({x:s.cx+.5,z:s.cz+.5,y:0}),terrainY:()=>0,document:{hidden:false,querySelector:()=>null},
  poiWalkAvatar(){},poiCreekPlayerHeight:()=>0,poiSound(){},poiShopIsOpen:()=>false,poiChestIsOpen:()=>false,poiKitchenChestReachable:()=>false,
  poiEquippedWeapon:()=>weapon,poiEquipmentSpendWeapon:()=>{c.wear++;return true},poiDamageNumber(...a){contacts.push(a)},
  poiMonsterMeshDirty:false,pineGameActive:false,pineAIActive:false,wear:0,
  performance:{now:()=>now},POI_PLAYER_ATTACK:20,POI_KNIFE:'kitchenKnife',POI_KNIFE_BONUS:12,POI_HOTBAR_SWORD_BONUS:8};
 vm.createContext(c);
 vm.runInContext(extract('// BEGIN ANGULAR COMBAT MATH','// END PLAYER WEAPON PROFILES')+'\n'+
    extract('function poiPlayerAttackDamage(','\n')+'\n'+extract('function poiWalkAction(){','function poiWalkReset('),c);
 function target(forward,side=0,level=0){
  const cx=origin.x+dx*forward-dz*side,cz=origin.z+dz*forward+dx*side;
  const x=Math.floor(cx+.5),z=Math.floor(cz+.5),o={type:'monsterSlime',x,z,y:level},s={x,z,cx,cz,hp:100};
  enemies.set(o,s);return s;
 }
 function attack(){
  const start=now;
  c.poiWalkAction();
  for(const t of [16,64,110,180,220,260,300,400,600]){
   now=start+t;c.poiPlayerWeaponFrame(now);
  }
 }
 const yaw=()=>vm.runInContext('poiAimAttack?.heading',c);
 return {c,contacts,target,attack,yaw,begin:()=>c.poiWalkAction(),frame:at=>{now=at;c.poiPlayerWeaponFrame(at)}};
}
for(const weapon of ['equipWoodSword','equipBoneSword','equipIronSword']){
 test(weapon+' hits both 1.5-tile sides in one action, without increasing reach, damage or wear',()=>{
  const h=setup(weapon);
  const center=h.target(.6),left=h.target(1.29,-1.49),right=h.target(.96,1.49),reach=h.target(1.30,.71);
  const off=h.target(.96,1.51),far=h.target(1.31,-.71),rear=h.target(-.10,1.2),otherFloor=h.target(.85,-.8,1);
  h.attack();
  const damage=h.c.poiPlayerAttackDamage(weapon);
  for(const s of [center,left,right,reach])assert.equal(s.hp,100-damage,'each center within sweep is damaged exactly once');
  for(const s of [off,far,rear,otherFloor])assert.equal(s.hp,100,'outside boundary, behind or on a different floor');
  assert.equal(h.contacts.length,4);
  assert.equal(h.c.wear,1,'durability should not scale with number of enemies');
 });
}
test('the same swing tests every target LOS separately, and retains unblocked flank contact',()=>{
 const h=setup('equipWoodSword');
 const center=h.target(.65),clear=h.target(.97,-1.25),occluded=h.target(.97,1.25);
 h.c.world.push({type:'wall',x:10,z:11,y:0});
 h.attack();
 assert(center.hp<100);assert(clear.hp<100);assert.equal(occluded.hp,100);
 assert.equal(h.contacts.length,2);assert.equal(h.c.wear,1);
});
test('oblique continuous aim rotates the swing with the avatar rather than along either grid axis',()=>{
 const n=Math.hypot(2,1),dx=2/n,dz=1/n,h=setup('equipIronSword',{dx,dz,analog:true});
 const center=h.target(.57),flank=h.target(1.27,-1.41),outside=h.target(1.14,1.51);
 h.attack();
 assert(Math.abs(h.yaw()-Math.atan2(-dx,dz))<1e-6,'visual heading matches oblique combat');
 assert(center.hp<100);assert(flank.hp<100);assert.equal(outside.hp,100);
});
test('fists and long staff keep single-target traces and current wear semantics',()=>{
 for(const weapon of [null,'equipLongStaff']){
  const h=setup(weapon),center=h.target(.72),flank=h.target(.96,1.24);
  h.attack();assert(center.hp<100);assert.equal(flank.hp,100);
  assert.equal(h.contacts.length,1);assert.equal(h.c.wear,weapon?1:0);
 }
});
test('empty sword action shows a swing without spending durability',()=>{
 const h=setup('equipWoodSword');
 h.attack();assert.equal(h.c.wear,0);assert.equal(h.contacts.length,0);
 assert.equal(h.c.poiWalkActionStarted,1000);assert(Number.isFinite(h.yaw()));
});

test('true sword contact is at 108 ms; movement does not replace tap origin or yaw',()=>{
 const h=setup('equipWoodSword',{analog:true}),center=h.target(.72),flank=h.target(.9,1.35);
 h.begin();assert.equal(center.hp,100);assert.equal(h.c.wear,0);
 h.c.poiFreePose={x:12.1,z:9.91,level:0,angle:Math.PI/2};
 h.c.poiWalkX=12;h.c.poiWalkFacing=3;
 h.frame(1107);assert.equal(center.hp,100);assert.equal(flank.hp,100);
 h.frame(1108);assert(center.hp<100);assert(flank.hp<100);assert.equal(h.contacts.length,2);
 assert(Math.abs(h.yaw()+Math.PI/2)<1e-6,'animation yaw stays at tap heading');
 assert.equal(h.c.wear,1);
});
