const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const html=fs.readFileSync('world-editor.html','utf8');
function runtime(extra=''){
 const start=html.indexOf('// BEGIN PLAYER WEAPON PROFILES'),end=html.indexOf('// END PLAYER WEAPON PROFILES');
 assert.ok(start>=0&&end>start,'weapon runtime present');
 const c={world:[],mobs:new Map(),facilitySite:{id:'base'},poiWalkActive:true,poiWalkLevel:0,poiWalkFacing:1,poiWalkX:10,poiWalkZ:10,poiThirdPerson:false,poiWalkStarted:-10000,poiAttackReady:0,poiWalkActionStarted:0,poiWalkActionWeapon:null,now:100,validPos:()=>true,isWallId:s=>s==='wall',poiWalkPassableDoor:s=>s==='door',poiMonsterAt(x,z){return c.mobs.get(x+','+z)},terrainY:()=>0,performance:{now:()=>c.now},document:{hidden:false,querySelector:()=>null},poiWalkAvatar(){},poiSound(){},poiEquippedWeapon:()=>c.held,poiInventoryAllowed:()=>true,poiInventorySpendFireWand:()=>++c.debits>0,poiEquipmentSpendWeapon:()=>++c.wear>0,poiDamageNumber(){},poiMonsterBreak(){++c.kills},poiArmedEnemyLoot(){++c.loot},poiAnnounceDefeat(){},poiPlayerAttackDamage:()=>20,poiMonsterMeshDirty:false,pineGameActive:false,debits:0,wear:0,kills:0,loot:0,...extra};
 vm.createContext(c);vm.runInContext(html.slice(start,end),c);return c;
}
test('bow releases at draw completion, stops at first wall, and does not wear when blocked',()=>{
 const c=runtime();c.held='equipWoodBow';c.mobs.set('14,10',[{type:'monsterSlime'},{x:14,z:10,hp:50}]);
 assert.equal(c.poiPlayerStartProfile(c.held,100),true);
 c.poiPlayerWeaponFrame(749);assert.equal(c.wear,0);
 c.world.push({x:13,z:10,y:0,type:'wall'});c.poiPlayerWeaponFrame(750);
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
test('bow hits only first target in five cells and physical windup cancels if moving',()=>{
 const c=runtime();c.held='equipWoodBow';
 const first={x:15,z:10,hp:50},beyond={x:16,z:10,hp:50};
 c.mobs.set('15,10',[{},first]);c.mobs.set('16,10',[{},beyond]);
 c.poiPlayerStartProfile(c.held,100);c.poiPlayerWeaponFrame(750);
 assert.equal(first.hp,28);assert.equal(beyond.hp,50);assert.equal(c.wear,1);
 c.poiPlayerStartProfile(c.held,1200);c.poiWalkX--;c.poiPlayerWeaponFrame(1850);
 assert.equal(c.wear,1);assert.equal(first.hp,28);
});
test('wand cannot pass initial obstacle or continue after lifecycle cancellation',()=>{
 const c=runtime();const mob={x:14,z:10,hp:50};c.mobs.set('14,10',[{},mob]);
 c.world.push({x:12,z:10,y:0,type:'wall'});
 assert.equal(c.poiPlayerCastFireWand(0).ok,true);c.world=[];
 c.poiPlayerWeaponFrame(270);assert.equal(mob.hp,50);
 c.now=900;assert.equal(c.poiPlayerCastFireWand(0).ok,true);
 c.document.hidden=true;c.poiPlayerWeaponFrame(1070);assert.equal(mob.hp,50);assert.equal(c.debits,2);
});
