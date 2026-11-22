const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const html=fs.readFileSync('world-editor.html','utf8');
function setup(){
 const guard={x:102,z:13,y:0,type:'monsterSkelWarrior'},reward={id:'north-watchpost-find',x:100,z:14,y:0,type:'cannedFood',count:1};
 const c={facilitySite:{id:'base',northTrail:{watchPost:{guard,reward,leash:{x1:99,x2:103,z1:11,z2:14}}}},kit:{gold:12},world:[{...reward,type:'stone'}],poiWalkActive:true,pineAIActive:false,poiWalkLevel:0,
  validPos:()=>true,poiHotbarHasKit:()=>true,poiInventoryItemName:s=>s,poiInventoryAllowed:()=>true,poiWalkCanStep:()=>true,poiHotbarRead:()=>c.kit,poiInventoryAccept:()=>({accepted:c.full?0:1,slots:[1]}),poiInventoryEdited:(kit,slots)=>({...kit,slots}),
  poiEquipmentDurabilityMax:()=>100,poiEconomyWrite:kit=>{if(c.fail)return false;c.kit=kit;return true},poiEconomyRefresh(){},poiSound(){},toast(){}};
 vm.createContext(c);
 const a=html.indexOf('// BEGIN ARMED FOES'), b=html.indexOf('// END ARMED FOES'),d=html.indexOf('// BEGIN NORTH TRAIL CAMP'),e=html.indexOf('// END NORTH TRAIL CAMP');
 vm.runInContext(html.slice(a,b)+html.slice(d,e),c);
 return {c,guard,reward};
}
test('watch guard leash is exact-source scoped; mine warrior unchanged',()=>{
 const {c,guard}=setup(),mine={...guard,x:110,z:56,y:-1};
 assert.equal(c.poiArmedBound(guard,101,11),true);assert.equal(c.poiArmedBound(guard,101,10),false);
 assert.ok(c.poiArmedAim(guard,{x:101,z:12},101,11));assert.equal(c.poiArmedAim(guard,{x:101,z:11},101,10),null);
 assert.equal(c.poiArmedBound(mine,110,56),true);assert.equal(c.poiArmedBound(mine,105,56),false);
});
test('sword and guard claim persist atomically, and even after pickup or new actor the reward does not duplicate',()=>{
 const {c,guard}=setup();const state={x:102,z:13,hp:0};
 c.fail=true;assert.equal(c.poiArmedEnemyLoot(guard,state,()=>.5),false);assert.equal(c.kit.northWatchPostGuardLoot,undefined);
 c.fail=false;assert.equal(c.poiArmedEnemyLoot(guard,state,()=>.5),true);
 const [d]=c.kit.armedDrops;assert.deepEqual([d.id,d.type,d.y,d.durability],['north-watchpost-warrior','equipBoneSword',0,55]);
 assert.equal(c.kit.northWatchPostGuardLoot,true);assert.equal(c.poiNorthWatchGuardDefeated(guard),true);
 assert.equal(c.poiArmedDropDecode([d])[0].id,d.id);assert.equal(c.poiArmedDropDecode([{...d,y:-1}]),null);
 assert.equal(c.poiArmedPickup(102,13),true);
 assert.equal(c.kit.armedDrops.length,0);assert.equal(c.kit.northWatchPostGuardLoot,true);assert.equal(c.poiNorthWatchGuardDefeated(guard),true);
 assert.equal(c.poiArmedEnemyLoot(guard,state,()=>.5),false);
});
test('watch post can uses real floor, save success and available inventory only',()=>{
 const {c,reward}=setup();
 assert.equal(c.poiNorthTrailPickup(99,14),false);
 assert.equal(c.poiNorthTrailWatchSupply(c.kit),reward);
 c.full=true;assert.equal(c.poiNorthTrailPickup(100,14),false);c.full=false;
 c.world[0].type='earth';assert.equal(c.poiNorthTrailPickup(100,14),false);c.world[0].type='stone';
 c.fail=true;assert.equal(c.poiNorthTrailPickup(100,14),false);assert.equal(c.kit.northWatchPostSupplies,undefined);c.fail=false;
 assert.equal(c.poiNorthTrailPickup(100,14),true);assert.equal(c.kit.northWatchPostSupplies,true);assert.equal(c.kit.gold,12);
 assert.equal(c.poiNorthTrailPickup(100,14),false);
});
test('lowland blocks only real tagged water on the Game World surface',()=>{
 const {c}=setup();
 c.facilitySite.northTrail.lowland={water:[{x:115,z:12,y:0}]};
 c.world.push({x:115,z:12,y:0,type:'water'},{x:114,z:12,y:0,type:'water'});
 assert.equal(c.poiNorthTrailLowlandWater(115,12),true);
 assert.equal(c.poiNorthTrailLowlandWater(114,12),false);
 c.poiWalkLevel=-1;assert.equal(c.poiNorthTrailLowlandWater(115,12),false);
 c.poiWalkLevel=0;c.world[1].type='earth';assert.equal(c.poiNorthTrailLowlandWater(115,12),false);
});
test('watch flags survive ordinary writes without implying collection on older saves',()=>{
 for(const mark of [undefined,'true',true]){
  let raw=JSON.stringify({version:1,weapon:null,potions:0,gold:31,northWatchPostGuardLoot:mark,northWatchPostSupplies:mark}),writes=0;
  const c={facilitySite:{id:'base'},POI_PLAYER_MAX_HP:100,localStorage:{getItem:()=>raw,setItem(_k,v){raw=v;writes++}}};
  vm.createContext(c);
  const a=html.indexOf('const POI_HOTBAR_KEY='),b=html.indexOf('function poiResetCombat(',a);
  vm.runInContext(html.slice(a,b),c);
  const kit=c.poiHotbarRead();assert.equal(writes,0);
  assert.equal(kit.northWatchPostGuardLoot,mark===true?true:undefined);
  assert.equal(kit.northWatchPostSupplies,mark===true?true:undefined);
  assert.equal(c.poiHotbarSave({...kit,gold:30}),true);
  const saved=JSON.parse(raw);
  assert.equal(saved.northWatchPostGuardLoot,mark===true?true:undefined);
  assert.equal(saved.northWatchPostSupplies,mark===true?true:undefined);
  assert.equal(saved.gold,30);
 }
});
