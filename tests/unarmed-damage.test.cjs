const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function cut(start,end){
 const i=h.indexOf(start),j=h.indexOf(end,i+start.length);
 a.ok(i>=0&&j>i,start);return h.slice(i,j);
}
const constants=['POI_PLAYER_ATTACK','POI_KNIFE_BONUS','POI_HOTBAR_SWORD_BONUS'].map(k=>{
 const match=h.match(new RegExp('\\b'+k+'=(\\d+)'));
 a.ok(match,k);return 'const '+k+'='+match[1]+';';
}).join('\n');
const knife=h.match(/\bPOI_KNIFE=('kitchenKnife')/);
a.ok(knife);
const runtime=constants+'const POI_KNIFE='+knife[1]+';'+cut('function poiPlayerAttackDamage(','const POI_ECONOMY_COIN=')+
 cut('// BEGIN PLAYER WEAPON PROFILES','function poiPlayerWeaponCancel(')+
 cut('function poiPlayerDamageTarget(','function poiPlayerWeaponResolve(')+
 cut('function poiWalkAction(){','function poiWalkReset(');
function session(angular=true){
 const target=[{type:'monsterSlime'},{x:7,z:8,hp:35}],c={
  target,nearby:true,now:1000,poiAttackReady:0,poiWalkActionStarted:0,
  poiWalkActionWeapon:null,poiWalkActive:true,poiWalkX:6,poiWalkZ:8,poiWalkLevel:0,poiWalkFacing:1,
  facilitySite:true,pineGameActive:false,poiMonsterMeshDirty:false,weapon:null,spent:0,sounds:[],damage:[],traces:[],
  poiEquippedWeapon:()=>c.weapon,performance:{now:()=>c.now},poiKitchenChestReachable:()=>false,
  poiShopIsOpen:()=>false,poiChestIsOpen:()=>false,poiWalkAvatar(){},
  poiMonsterAt(x,z){c.traces.push({x,z});return c.nearby?target:null},
  poiEquipmentSpendWeapon(){c.spent++;return true},
  poiSound(...args){c.sounds.push(args)},
  terrainY:()=>0,poiDamageNumber(x,y,z,n){c.damage.push(n)},
  poiPlayerStartProfile:()=>false,
 };
 if(angular){
  c.poiAimNewShot=(shot,now)=>({...shot,now});
  c.poiAimTrace=(shot,range,now)=>{c.traces.push({range,profile:shot.profile.range,now});return {x:7,z:8,monster:c.nearby?target:null}};
 }
 const api=vm.runInNewContext(runtime+';({action:poiWalkAction,damage:poiPlayerAttackDamage,profile:poiPlayerWeaponProfile,grades:poiPlayerWeaponGrades,range:poiPlayerWeaponRange})',c);
 return {c,api};
}
test('bare hands deal 14 on the real action→HP path, immediately and once per original 300ms',()=>{
 for(const angular of [true,false]){
  const {c,api}=session(angular);
  api.action();a.equal(c.target[1].hp,21);
  a.equal(api.damage(),14,'ordinary unequipped status uses the same damage');
  a.deepEqual(c.damage,[14]);a.equal(c.spent,0);
  a.equal(c.poiWalkActionStarted,1000);a.equal(c.poiAttackReady,1300);
  a.deepEqual(c.traces,[angular?{range:1,profile:1,now:1000}:{x:7,z:8}]);
  c.now=1299;api.action();a.equal(c.target[1].hp,21);
  c.now=1300;c.nearby=false;api.action();a.equal(c.target[1].hp,21);
  a.deepEqual(c.damage,[14]);a.equal(c.spent,0);
  a.deepEqual(c.sounds,[['attack',null],['hit',null,false],['attack',null]]);
  a.equal(api.range(null),1);
  a.deepEqual(JSON.parse(JSON.stringify(api.grades(null))),{speed:3,reach:1});
 }
});
test('all equipped damage including weapons derived from shared base is byte-identical numerically',()=>{
 const {api}=session();
 const baseline={kitchenKnife:32,equipWoodBow:22,equipWoodSpear:24,equipStoneMace:32,equipWoodSword:28,
  equipBoneSword:24,equipIronSword:30,equipNorthMinotaurAxe:34,equipPlainStaff:23,equipLongStaff:20,
  equipFryingPan:26,equipLadle:17,equipBallpointPen:12,fireWand:34};
 for(const [name,n] of Object.entries(baseline)){
  a.equal(api.profile(name).damage,n,name);
  a.equal(api.damage(name),n,name);
 }
});
