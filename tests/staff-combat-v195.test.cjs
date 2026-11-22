const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const html=fs.readFileSync('world-editor.html','utf8');
function runtime(){
 const c={world:[],mobs:new Map(),facilitySite:{id:'base'},poiWalkActive:true,poiWalkLevel:-1,poiWalkFacing:1,poiWalkX:10,poiWalkZ:10,poiWalkActionStarted:0,poiWalkActionWeapon:null,poiAttackReady:0,validPos:()=>true,isWallId:s=>s==='wall',poiWalkPassableDoor:s=>s==='door',poiMonsterAt(x,z){return c.mobs.get(x+','+z)},terrainY:()=>0,document:{hidden:false},poiWalkAvatar(){},poiSound(){},poiEquippedWeapon:()=>c.held,poiEquipmentSpendWeapon:()=>++c.wear>0,poiDamageNumber(){},poiMonsterMeshDirty:false,pineGameActive:false,wear:0};
 vm.createContext(c);vm.runInContext(html.slice(html.indexOf('// BEGIN PLAYER WEAPON PROFILES'),html.indexOf('// END PLAYER WEAPON PROFILES')),c);return c;
}
test('long staff hits at one and two tiles equally, wears only hits, and respects the first solid wall',()=>{
 for(const [x,blocked,expected] of [[11,false,30],[12,false,30],[12,true,50],[13,false,50]]){
  const c=runtime();c.held='equipLongStaff';const enemy={x,z:10,hp:50};
  c.mobs.set(x+',10',[{},enemy]);if(blocked)c.world.push({x:11,z:10,y:-1,type:'wall'});
  assert.equal(c.poiPlayerStartProfile(c.held,100),true);
  c.poiPlayerWeaponFrame(299);assert.equal(enemy.hp,50);
  c.poiPlayerWeaponFrame(310);assert.equal(enemy.hp,expected);assert.equal(c.wear,expected===50?0:1);
 }
});
test('plain staff has its own swing cadence and short reach',()=>{
 const c=runtime(),p=c.poiPlayerWeaponProfile('equipPlainStaff');
 assert.deepEqual([p.range,p.damage,p.ready],[1,23,350]);
});
test('mage actual release queues a floor-scoped bolt bounded by committed target and current solid wall',()=>{
 const c=runtime(),a={obj:{type:'monsterSkelMage'},sx:10,sz:10,x:14,z:10,y:-1};
 assert.equal(c.poiEnemyMageBoltRelease(a,800),4);
 let seen=vm.runInContext('poiEnemyMageBolts.at(-1)',c);
 assert.deepEqual([seen.x,seen.z,seen.toX,seen.toZ,seen.y,seen.started],[10,10,14,10,-1,800]);
 c.world.push({x:12,z:10,y:-1,type:'wall'});
 assert.equal(c.poiEnemyMageBoltRelease(a,850),1);
 seen=vm.runInContext('poiEnemyMageBolts.at(-1)',c);assert.equal(seen.toX,11);
 const count=vm.runInContext('poiEnemyMageBolts.length',c);
 assert.equal(c.poiEnemyMageBoltRelease({...a,y:0},860),0);
 assert.equal(c.poiEnemyMageBoltRelease({...a,obj:{type:'monsterSlime'}},860),0);
 assert.equal(vm.runInContext('poiEnemyMageBolts.length',c),count);
 c.poiPlayerWeaponCancel();assert.equal(vm.runInContext('poiEnemyMageBolts.length',c),0);
});
