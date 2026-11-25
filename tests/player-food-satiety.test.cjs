const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const h=fs.readFileSync(process.argv[2]||'world-editor.html','utf8');
function cut(a,b){const x=h.indexOf(a),y=h.indexOf(b,x+1);assert(x>=0&&y>x,a);return h.slice(x,y)}
const food={type:'cannedFood',count:2},herb={type:'healingHerb',count:2};
function fixture(){
 const o={kit:{slots:[food,herb,null,null,null,null,food]},fail:false,minute:1080,refresh:0,heals:0,writes:0,toast:[]};
 const c={POI_HOTBAR_SIZE:6,POI_BAG_SAVED:12,POI_CANNED:'cannedFood',POI_FIRE_WAND:'fireWand',POI_INVENTORY_HERB:'healingHerb',
  poiPlayerHP:100,POI_PLAYER_MAX_HP:100,poiTownClockRead(){},poiTownClockSnapshot:()=>({absoluteMinute:o.minute}),poiInventoryAllowed:()=>true,
  poiStorageActionResult:(r=null)=>({ok:r===null,reason:r}),poiStorageIndexExists:(n,max)=>n>=0&&n<max,
  poiInventorySlots:k=>k.slots,poiInventoryEdited:(k,slots)=>({...k,slots}),poiHotbarRead:()=>o.kit,
  poiInventorySlot:(k,i)=>k.slots[i]?.type,poiGoldHotbarSlot:()=>null,poiHealingCastActive:()=>false,
  poiHealingCastStart:()=>{o.heals++;return {ok:true,reason:null}},poiEconomyRefresh:()=>o.refresh++,
  poiEconomyWrite:k=>{if(o.fail)return false;o.writes++;o.kit=k;return true;},toast:s=>o.toast.push(s)};
 vm.createContext(c);
 const newLane=h.includes('// BEGIN PLAYER SATIETY')?cut('// BEGIN PLAYER SATIETY','// END PLAYER SATIETY'):'';
 vm.runInContext(newLane+cut('function poiUseStorageConsumable','function poiEquipmentBreakFeedback')+
  cut('function poiHotbarUse','function poiCombatActorMake'),c);
 return {c,o};
}
test('shared real dispatch allows food at full HP, only adds satiety, bag and shortcut are equivalent',()=>{
 const {c,o}=fixture();assert.equal(c.poiPlayerSatiety(o.kit),50);
 assert.equal(c.poiUseBagItem(0).ok,true);assert.equal(c.poiPlayerHP,100);
 assert.equal(o.kit.slots[6].count,1);assert.equal(c.poiPlayerSatiety(o.kit),85);
 c.poiHotbarUse(0);assert.equal(o.kit.slots[0].count,1);assert.equal(c.poiPlayerSatiety(o.kit),100);
 c.poiHotbarUse(0);assert.equal(o.writes,2);assert.equal(o.kit.slots[0].count,1);assert.match(o.toast.at(-1),/お腹|満腹/);
 assert.equal(o.heals,0);c.poiHotbarUse(1);assert.equal(o.heals,1);
 assert.equal(c.poiPlayerSatiety(o.kit),100);
});
test('satiety is derived without writes, survives JSON and a clock rollback, and saves with consumed count or not at all',()=>{
 const {c,o}=fixture();o.fail=true;
 assert.equal(c.poiUseBagItem(0).reason,'storage');assert.equal(o.kit.slots[6].count,2);assert.equal(c.poiPlayerSatiety(o.kit),50);
 o.fail=false;c.poiUseBagItem(0);
 o.kit=JSON.parse(JSON.stringify(o.kit));const w=o.writes;
 o.minute-=18;assert.equal(c.poiPlayerSatiety(o.kit),85);
 o.minute+=18+24;assert.equal(c.poiPlayerSatiety(o.kit),83);
 o.minute+=1e6;assert.equal(c.poiPlayerSatiety(o.kit),0);
 assert.equal(o.writes,w);assert.equal(c.poiPlayerHP,100);
 assert.equal(c.poiPlayerSatietyDecode({value:102,minute:1080}),null);
});
test('production hotbar serialization keeps the exact old item and chest IDs/counts alongside the new bounded field',()=>{
 const can={type:'cannedFood',count:3}, chest={version:1,slots:[{type:'cannedFood',count:2}]};
 let raw=JSON.stringify({version:1,weapon:null,potions:0,slots:[can],kitchenChest:chest});
 const c={localStorage:{getItem:()=>raw,setItem:(_,v)=>{raw=v}},poiHotbarState:null,
  POI_HOTBAR_KEY:'kit',POI_HOTBAR_POTION_MAX:99,POI_HOTBAR_SIZE:6,POI_INVENTORY_SWORD:'equipWoodSword',POI_CHEST_STORE_KEYS:['kitchenChest'],
  poiHotbarWeaponForType:()=>null,poiHotbarState:null,poiMigrateWeaponDurability(){},
  poiArmorDecode:()=>null,poiArmorWorn:()=>({}),poiWornDurabilityDecode:()=>null,poiToolshopSupplyDecode:()=>null,poiNpcTradeDecode:()=>null,
  poiGoldBagDecode:()=>null,poiQuestDecode:()=>null,poiChestDecode:x=>x,poiMineVaultGateCleared:()=>false,poiMineFindDecode:()=>null,
  poiMineFindRollDecode:()=>null,poiAnyChestHas:()=>false,poiInventoryReadDrops:()=>[],poiArmorReconcile:(_,s)=>s,poiInventoryReadSlots:s=>s,
  poiInventoryEdited:(k,s)=>({...k,slots:s}),poiInventoryOrdinarySlots:k=>k.slots,poiGoldStacksDecode:()=>[],poiHasExplicitWeaponDurability:()=>false,
  poiGoldHotbarSlot:()=>null};
 vm.createContext(c);
 vm.runInContext(cut('// BEGIN PLAYER SATIETY','// END PLAYER SATIETY')+
  cut('function poiHotbarRead','function poiEquippedWeapon'),c);
 const old=c.poiHotbarRead();assert.equal(old.satiety,undefined);assert.equal(old.slots[0].type,'cannedFood');assert.equal(old.kitchenChest.slots[0].count,2);
 assert.equal(c.poiHotbarSave({...old,satiety:{value:75,minute:1080}}),true);
 c.poiHotbarState=null;const next=c.poiHotbarRead();
 assert.deepEqual(JSON.parse(JSON.stringify(next.satiety)),{value:75,minute:1080});
 assert.equal(next.slots[0].count,3);assert.equal(next.kitchenChest.slots[0].type,'cannedFood');
});
test('mine guaranteed can stays a can, separate herb finds and original NPC shop stock remain',()=>{
 assert.match(h,/\{id:'mine-storeroom',x:109,z:55,y:-1,type:'cannedFood',count:1\}/);
 assert.match(h,/\{id:'mine-breakroom',x:108,z:65,y:-1,type:'healingHerb',count:2\}/);
 assert.match(h,/\{id:'mine-cut',x:99,z:60,y:-1,type:'healingHerb',count:1\}/);
 assert.match(h,/healingHerb:6,cannedFood:12/);
 assert.match(cut('function poiHealingCastFrame','function poiHealingCastDraw'),/cell\.type!==POI_INVENTORY_HERB[\s\S]*POI_HOTBAR_HEAL/);
});
