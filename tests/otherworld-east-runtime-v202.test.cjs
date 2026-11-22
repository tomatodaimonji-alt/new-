const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const h=fs.readFileSync('world-editor.html','utf8');
function fixture(){
 const archer={x:109,z:88,y:-1,type:'monsterSkelArcher',bounds:{x1:105,x2:113,z1:85,z2:91,y:-1}},staff={x:120,z:82,y:-1,type:'monsterSkelLongStaff',bounds:{x1:115,x2:123,z1:79,z2:86,y:-1}};
 const reward={id:'otherworld-east-supply',x:121,z:84,y:-1,type:'cannedFood',count:1};
 const c={facilitySite:{id:'base',otherworld:{bounds:{x1:95,x2:125,z1:72,z2:92,y:-1},gate:{z:76},dungeonStand:{z:90},expansion:{originalBounds:{x1:95,x2:108,z1:72,z2:92,y:-1},guard:[archer,staff],cells:[{x:106,z:85}],reward}}},poiWalkLevel:-1,poiWalkX:121,poiWalkZ:84,poiWalkActive:true,pineAIActive:false,world:[{...reward,type:'stone'}],kit:{gold:17},write:false,
  poiInventoryAllowed:()=>true,poiHotbarRead:()=>c.kit,poiInventoryAccept:()=>({slots:[1],accepted:c.full?0:1}),poiInventoryEdited:(k,slots)=>({...k,slots}),poiEconomyWrite:k=>{if(c.fail)return false;c.kit=k;return true},poiEconomyRefresh(){},poiSound(){},toast(){},validPos:()=>true,poiEquipmentDurabilityMax:()=>100};
 vm.createContext(c);
 const extract=(a,b)=>h.slice(h.indexOf(a),h.indexOf(b,h.indexOf(a)+1));
 vm.runInContext(extract('function poiDungeonPointIn','function poiChapelWater')+extract('function poiOtherworldEnemyMayFight','// END OTHERWORLD TRAVEL')+
  extract('// BEGIN ARMED FOES','// END ARMED FOES')+extract('// BEGIN NORTH TRAIL CAMP','// END NORTH TRAIL CAMP'),c);return {c,archer,staff,reward};
}
test('expanded foe identities are exact and their pursuit is independently bounded; old duel and gate unchanged',()=>{
 const {c,archer,staff}=fixture();
 assert.equal(c.poiOtherworldEnemyMayFight(archer,109,88),true);
 assert.equal(c.poiOtherworldEnemyMayFight(archer,104,88),false);
 assert.equal(c.poiOtherworldEnemyMayFight(staff,121,84),true);
 assert.equal(c.poiOtherworldEnemyMayFight(staff,114,85),false);
 assert.equal(c.poiOtherworldEnemyMayFight({x:106,z:78,y:-1,type:'monsterSkelKnight'},109,81),false);
 assert.equal(c.poiOtherworldEnemyMayFight({x:106,z:78,y:-1,type:'monsterSkelKnight'},106,85),false);
 c.poiOtherworldGateOpen=()=>false;
 assert.equal(c.poiOtherworldResumeBlocked({x:100,z:74,y:-1}),true);
 assert.equal(c.poiOtherworldResumeBlocked({x:120,z:74,y:-1}),false);
});
test('both guarded new sources drop guaranteed separate B1 weapon IDs and old source persists',()=>{
 const {c,archer,staff}=fixture();
 for(const source of [archer,staff])assert.equal(c.poiArmedEnemyLoot(source,{...source,hp:0},()=>.5),true);
 assert.deepEqual(Array.from(c.kit.armedDrops,d=>[d.id,d.type,d.y,d.durability]),[['otherworld-east-archer','equipWoodBow',-1,55],['otherworld-east-staff','equipLongStaff',-1,55]]);
 assert.equal(c.poiArmedDropDecode(c.kit.armedDrops).length,2);
 assert.equal(c.poiArmedDropDecode([{...c.kit.armedDrops[0],y:0}]),null);
 assert.equal(c.poiArmedLootOptions({x:105,z:86,y:0,type:'monsterSkelArcher'},()=>.5)[0][0],'monsterSkelArcher');
});
test('can must fit fully, persist, be on exact stone and in current Otherworld',()=>{
 const {c,reward}=fixture();
 assert.ok(c.poiOtherworldEastSupply(c.kit));
 c.poiWalkLevel=0;assert.equal(c.poiOtherworldEastSupply(c.kit),null);c.poiWalkLevel=-1;
 c.poiWalkX=120;c.poiWalkZ=60;assert.equal(c.poiOtherworldEastSupply(c.kit),null);c.poiWalkX=121;c.poiWalkZ=84;
 assert.equal(c.poiNorthTrailPickup(120,84),false);
 c.world[0].type='earth';assert.equal(c.poiNorthTrailPickup(121,84),false);c.world[0].type='stone';
 c.full=true;assert.equal(c.poiNorthTrailPickup(121,84),false);c.full=false;
 c.fail=true;assert.equal(c.poiNorthTrailPickup(121,84),false);c.fail=false;
 assert.equal(c.kit.otherworldEastSupplyFound,undefined);
 assert.equal(c.poiNorthTrailPickup(121,84),true);assert.equal(c.kit.otherworldEastSupplyFound,true);assert.equal(c.kit.gold,17);
 assert.equal(c.poiNorthTrailPickup(121,84),false);
});
