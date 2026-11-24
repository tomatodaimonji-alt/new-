const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const html=fs.readFileSync('world-editor.html','utf8');
function runtime(extra=''){
 const start=html.indexOf('// BEGIN PLAYER WEAPON PROFILES'),end=html.indexOf('// END PLAYER WEAPON PROFILES');
 assert.ok(start>=0&&end>start,'weapon runtime present');
 const c={poiHealingCastActive:()=>false,world:[],mobs:new Map(),facilitySite:{id:'base'},poiWalkActive:true,poiWalkLevel:0,poiWalkFacing:1,poiWalkX:10,poiWalkZ:10,poiThirdPerson:false,poiWalkStarted:-10000,poiAttackReady:0,poiWalkActionStarted:0,poiWalkActionWeapon:null,now:100,validPos:()=>true,isWallId:s=>s==='wall',poiWalkPassableDoor:s=>s==='door',poiMonsterAt(x,z){return c.mobs.get(x+','+z)},terrainY:()=>0,performance:{now:()=>c.now},document:{hidden:false,querySelector:()=>null},poiWalkAvatar(){},poiSound(){},poiEquippedWeapon:()=>c.held,poiInventoryAllowed:()=>true,poiInventorySpendFireWand:()=>++c.debits>0,poiEquipmentSpendWeapon:()=>++c.wear>0,poiDamageNumber(){},poiMonsterBreak(){++c.kills},poiArmedEnemyLoot(){++c.loot},poiAnnounceDefeat(){},poiPlayerAttackDamage:()=>20,poiMonsterMeshDirty:false,pineGameActive:false,debits:0,wear:0,kills:0,loot:0,...extra};
 vm.createContext(c);vm.runInContext(html.slice(start,end),c);return c;
}
test('bow releases at draw completion, stops at first wall, and does not wear when blocked',()=>{
 const c=runtime();c.held='equipWoodBow';c.mobs.set('14,10',[{type:'monsterSlime'},{x:14,z:10,hp:50}]);
 assert.equal(c.poiPlayerStartProfile(c.held,100),true);
 c.poiPlayerWeaponFrame(424);assert.equal(c.wear,0);
 c.world.push({x:13,z:10,y:0,type:'wall'});c.poiPlayerWeaponFrame(425);c.poiPlayerWeaponFrame(1300);
 assert.equal(c.wear,0);assert.equal(c.mobs.get('14,10')[1].hp,50);
});
test('spear is weaker close up, stops at first target, routes kill and wear once',()=>{
 const c=runtime();c.held='equipWoodSpear';
 c.mobs.set('11,10',[{type:'monsterSlime'},{x:11,z:10,hp:12}]);c.mobs.set('12,10',[{type:'monsterSlime'},{x:12,z:10,hp:50}]);
 c.poiPlayerStartProfile(c.held,100);c.poiPlayerWeaponFrame(500);c.poiPlayerWeaponFrame(600);
 assert.equal(c.wear,1);assert.equal(c.kills,1);assert.equal(c.loot,1);assert.equal(c.mobs.get('12,10')[1].hp,50);
});
test('wand charges on a miss, respects cooldown, and does not wear equipped weapon',()=>{
 const c=runtime();assert.equal(c.poiPlayerCastFireWand(2).ok,true);assert.equal(c.debits,1);assert.equal(c.poiPlayerCastFireWand(2).ok,false);
 c.poiPlayerWeaponFrame(500);assert.equal(c.wear,0);assert.equal(c.debits,1);
});
test('bow hits only the first target within eight cells of its actual release position',()=>{
 const c=runtime();c.held='equipWoodBow';
 const first={x:18,z:10,hp:50},beyond={x:19,z:10,hp:50};
 c.mobs.set('18,10',[{},first]);c.mobs.set('19,10',[{},beyond]);
 c.poiPlayerStartProfile(c.held,100);c.poiPlayerWeaponFrame(425);c.poiPlayerWeaponFrame(945);
 assert.equal(first.hp,28);assert.equal(beyond.hp,50);assert.equal(c.wear,1);
 c.poiPlayerStartProfile(c.held,1200);c.poiWalkX++;c.poiWalkZ++;
 const fresh={x:19,z:11,hp:50},far={x:20,z:11,hp:50};
 c.mobs.set('19,11',[{},fresh]);c.mobs.set('20,11',[{},far]);
 c.poiPlayerWeaponFrame(1524);assert.equal(c.wear,1);
 c.poiPlayerWeaponFrame(1525);
 const flight=vm.runInContext('poiPlayerWeaponVisual',c);
 assert.deepEqual([flight.x,flight.z,flight.toX,flight.toZ],[11,11,19,11]);
 c.poiPlayerWeaponFrame(2045);
 assert.equal(c.wear,2);assert.equal(first.hp,28);assert.equal(fresh.hp,28);assert.equal(far.hp,50);
});
test('wand cannot pass initial obstacle or continue after lifecycle cancellation',()=>{
 const c=runtime();const mob={x:14,z:10,hp:50};c.mobs.set('14,10',[{},mob]);
 c.world.push({x:12,z:10,y:0,type:'wall'});
 assert.equal(c.poiPlayerCastFireWand(0).ok,true);c.world=[];
 c.poiPlayerWeaponFrame(540);assert.equal(mob.hp,50);
 c.now=900;assert.equal(c.poiPlayerCastFireWand(0).ok,true);
 c.document.hidden=true;c.poiPlayerWeaponFrame(1070);assert.equal(mob.hp,50);assert.equal(c.debits,2);
});
test('bow keeps committed cardinal flight after movement or equip switch, wears and hits only at contact',()=>{
 for(const [facing,[dx,dz]] of [[0,[0,-1]],[1,[1,0]],[2,[0,1]],[3,[-1,0]]]){
  const c=runtime();c.held='equipWoodBow';c.poiWalkFacing=facing;
  const first={x:10+8*dx,z:10+8*dz,hp:50};
  c.mobs.set(first.x+','+first.z,[{},first]);
  c.poiPlayerStartProfile(c.held,100);
  c.poiPlayerWeaponFrame(425);
  assert.equal(first.hp,50);assert.equal(c.wear,0);
  const v=vm.runInContext('poiPlayerWeaponVisual',c);
  assert.deepEqual([v.started,v.travel,v.toX,v.toZ],[425,520,first.x,first.z]);
  c.poiWalkX++;c.poiWalkFacing=(facing+1)%4;c.held='equipIronSword';
  c.poiPlayerWeaponFrame(944);assert.equal(first.hp,50);assert.equal(c.wear,0);
  c.poiPlayerWeaponFrame(945);assert.equal(first.hp,28);assert.equal(c.wear,1);
 }
});
test('fire consumes on cast and reaches eighth tile but not ninth',()=>{
 for(const [distance,expected] of [[8,16],[9,50]]){
  const c=runtime(),target={x:10+distance,z:10,hp:50};c.mobs.set(target.x+',10',[{},target]);
  assert.equal(c.poiPlayerCastFireWand(1).ok,true);assert.equal(c.debits,1);
  c.poiPlayerWeaponFrame(539);assert.equal(target.hp,50);
  c.poiPlayerWeaponFrame(540);assert.equal(target.hp,expected);assert.equal(c.wear,0);
 }
});
test('projectile checks only next cells, intercepts newly arriving target, and never revisits passed cells',()=>{
 const c=runtime(),near={x:11,z:10,hp:50},middle={x:13,z:10,hp:50},far={x:15,z:10,hp:50};
 c.mobs.set('15,10',[{},far]);assert.equal(c.poiPlayerCastFireWand(1).ok,true);
 c.poiPlayerWeaponFrame(210); // tiles 1–2 fly past while empty
 c.mobs.set('11,10',[{},near]);c.mobs.set('13,10',[{},middle]);
 c.poiPlayerWeaponFrame(265);
 assert.deepEqual([near.hp,middle.hp,far.hp],[50,16,50]);
});
test('edge, immediate wall, floor change, and first target stop before farther actors',()=>{
 const c=runtime();c.validPos=(x,z)=>x<=14&&z>=0;
 const a={x:11,z:10,hp:50},b={x:15,z:10,hp:50};
 c.mobs.set('11,10',[{},a]);c.mobs.set('15,10',[{},b]);
 assert.equal(c.poiPlayerCastFireWand(1).ok,true);
 let v=vm.runInContext('poiPlayerWeaponVisual',c);assert.equal(v.toX,14);
 c.poiPlayerWeaponFrame(154);assert.equal(a.hp,50);
 c.poiPlayerWeaponFrame(155);assert.equal(a.hp,16);assert.equal(b.hp,50);
 assert.equal(vm.runInContext('poiPlayerWeaponVisual.toX',c),11);
 c.now=800;c.world=[{x:11,z:10,y:0,type:'wall'}];
 c.poiPlayerCastFireWand(1);c.poiPlayerWeaponFrame(855);
 assert.equal(a.hp,16);assert.equal(vm.runInContext('poiPlayerWeaponVisual.toX',c),10);
 c.now=1600;c.world=[];c.poiPlayerCastFireWand(1);c.poiWalkLevel=-1;c.poiPlayerWeaponFrame(1700);
 assert.equal(vm.runInContext('poiPlayerWeaponVisual',c),null);assert.equal(a.hp,16);
});
test('released arrows debit carried bow after switch, not an equipped sword or stored/ground bow',()=>{
 const carried=Array(27).fill(null);
 carried[0]={type:'equipIronSword',durability:88};carried[10]={type:'equipWoodBow',durability:2};
 const c={kit:{weapon:'equipIronSword',slots:carried,drops:[{type:'equipWoodBow',durability:42}]},
  POI_HOTBAR_SIZE:9,POI_INVENTORY_SWORD:'equipWoodSword',poiHotbarHasKit:()=>true,
  poiHotbarWeaponForType:t=>t,poiHotbarRead:()=>c.kit,poiInventorySlots:k=>k.slots,
  poiInventoryEdited:(k,slots)=>({...k,slots}),poiEconomyWrite:k=>{c.kit=k;return true},poiEconomyRefresh(){},poiEquipmentBreakFeedback(){}};
 const a=html.indexOf('function poiEquipmentSpendWeapon('),b=html.indexOf('function poiKitchenKnifeSpend(',a);
 vm.createContext(c);vm.runInContext(html.slice(a,b),c);
 assert.equal(c.poiEquipmentSpendWeapon('equipWoodBow'),false);
 assert.equal(c.poiEquipmentSpendWeapon('equipWoodBow',true),true);
 assert.equal(c.kit.slots[10].durability,1);assert.equal(c.kit.slots[0].durability,88);
 assert.equal(c.poiEquipmentSpendWeapon('equipWoodBow',true),true);assert.equal(c.kit.slots[10],null);
 assert.equal(c.poiEquipmentSpendWeapon('equipWoodBow',true),false);assert.equal(c.kit.drops[0].durability,42);assert.equal(c.kit.weapon,'equipIronSword');
});


