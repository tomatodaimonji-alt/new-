const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const h=fs.readFileSync(process.env.HTML||path.join(__dirname,'..','world-editor.html'),'utf8');
function fixture(initial=null){
 let raw=JSON.stringify(initial),fail=false;
 const c=vm.createContext({facilitySite:{id:'base'},poiWalkActive:true,poiWalkLevel:-1,poiWalkX:28,poiWalkZ:32,poiWalkFacing:3,
  poiPlayerHP:12,POI_PLAYER_MAX_HP:100,POI_PLAYER_ATTACK:20,pineAIActive:false,world:[],
  poiWalkCanStep:(x,z)=>x!==27,poiWalkAvatar(){},poiCombatHud(){},
  isFloor:()=>true,$:()=>null,toast(){},document:{querySelectorAll:()=>[]},localStorage:{getItem:()=>raw,setItem(_k,v){if(fail)throw Error('disk');raw=v}}});
 const a=h.indexOf('const POI_HOTBAR_KEY='),b=h.indexOf('function poiResetCombat(',a);vm.runInContext(h.slice(a,b),c);
 Object.assign(c,{poiKitchenChestReachable:()=>true,poiChestIsOpen:()=>true});
 return {c,fail:v=>fail=v,raw:()=>JSON.parse(raw)};
}
test('one roll and durable 18-slot chest, with atomic transfer and same persisted result after reload',()=>{
 const f=fixture();assert.equal(typeof f.c.poiOpenKitchenChest,'function');
 f.fail(true);assert.equal(f.c.poiOpenKitchenChest(()=>.399),false);assert.equal(f.raw(),null);
 f.fail(false);assert.equal(f.c.poiOpenKitchenChest(()=>.9),true);
 assert.equal(f.c.poiChestSlotAt(0).type,'kitchenKnife');assert.equal(f.c.poiChestSlotAt(1).type,'cannedFood');
 assert.equal(f.raw().kitchenChest.slots.length,18);
 f.fail(true);assert.equal(f.c.poiMoveChestInventorySlot('chest',0,'inventory',2).reason,'storage');
 assert.equal(f.c.poiChestSlotAt(0).durability,40);assert.equal(f.c.poiInventorySnapshot().hotbar[2],null);
 f.fail(false);assert.equal(f.c.poiMoveChestInventorySlot('chest',0,'inventory',2).ok,true);
 const g=fixture(f.raw());assert.equal(g.c.poiOpenKitchenChest(()=>0),true);assert.equal(g.c.poiChestSlotAt(0),null);
 assert.equal(g.c.poiInventorySnapshot().hotbar[2].durability,40);
});
test('knife wears on landed hit, can be stashed or dropped with durability, canned food heals more than herbs',()=>{
 const {c}=fixture();assert.equal(c.poiOpenKitchenChest(()=>.2),true);
 assert.equal(c.poiMoveChestInventorySlot('chest',0,'inventory',2).ok,true);c.poiHotbarUse(2);
 assert.equal(c.poiEquippedWeapon(),'kitchenKnife');assert.equal(c.poiPlayerAttackDamage(),32);
 assert.equal(c.poiKitchenKnifeSpend(),true);assert.equal(c.poiInventorySnapshot().hotbar[2].durability,39);
 assert.equal(c.poiInventoryDrop(2).ok,true);let d=c.poiInventorySnapshot().drops[0];
 assert.equal(d.durability,39);assert.equal(c.poiEquippedWeapon(),null);assert.notEqual(d.x,27);
 assert.equal(c.poiInventoryPickup(d.x,d.z),true);
 assert.equal(c.poiMoveChestInventorySlot('chest',1,'inventory',3).ok,true);c.poiHotbarUse(3);
 assert.equal(c.poiPlayerHP,67);assert.equal(c.poiInventorySnapshot().hotbar[3],null);
});
test('durability save fails closed, final hit breaks the knife without re-rolling the chest',()=>{
 const cells=Array(27).fill(null);cells[0]={type:'equipWoodSword',count:1};
 cells[1]={type:'healingHerb',count:3};cells[2]={type:'kitchenKnife',count:1,durability:1};
 const f=fixture({version:1,weaponDurabilityVersion:2,weapon:'kitchenKnife',potions:3,gold:6,slots:cells,kitchenChest:{version:1,slots:Array(18).fill(null)}});
 f.fail(true);assert.equal(f.c.poiKitchenKnifeSpend(),false);assert.equal(f.c.poiEquippedWeapon(),'kitchenKnife');
 assert.equal(f.c.poiInventorySnapshot().hotbar[2].durability,1);
 f.fail(false);assert.equal(f.c.poiKitchenKnifeSpend(),true);assert.equal(f.c.poiEquippedWeapon(),null);
 assert.equal(f.c.poiInventorySnapshot().hotbar[2],null);assert.equal(f.c.poiEconomyGold(),6);
 const reload=fixture(f.raw());assert.equal(reload.c.poiOpenKitchenChest(()=>0),true);assert.equal(reload.c.poiChestSlotAt(0),null);
 assert.equal(reload.c.poiChestSlotAt(1),null);
});
test('only committed acquisition from chest plays one item cue (including quick take and a direct transfer)',()=>{
 const f=fixture(),{c}=f,notes=[];
 c.poiSound=(...v)=>notes.push(v);
 assert.equal(c.poiOpenKitchenChest(()=>.2),true);assert.deepEqual(notes,[]);
 f.fail(true);assert.equal(c.poiMoveChestInventorySlot('chest',0,'inventory',2).reason,'storage');
 f.fail(false);assert.equal(c.poiMoveChestInventorySlot('chest',0,'inventory',27).reason,'locked');assert.deepEqual(notes,[]);
 assert.equal(c.poiQuickTransferStorage('chest',0).ok,true);assert.deepEqual(notes,[['chest-pickup','kitchenKnife']]);notes.length=0;
 assert.equal(c.poiMoveChestInventorySlot('inventory',9,'chest',2).ok,true);
 assert.equal(c.poiMoveChestInventorySlot('chest',2,'chest',0).ok,true);
 assert.equal(c.poiQuickTransferStorage('chest',2).reason,'empty');assert.deepEqual(notes,[]);
 assert.equal(c.poiQuickTransferStorage('chest',1).ok,true);notes.length=0;
 assert.equal(c.poiMoveChestInventorySlot('inventory',9,'chest',1).ok,true);
 assert.equal(c.poiMoveChestInventorySlot('chest',1,'inventory',2).ok,true);
 assert.deepEqual(notes,[['chest-pickup','cannedFood']]);
});
