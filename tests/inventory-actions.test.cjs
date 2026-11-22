const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const h=fs.readFileSync(process.env.HTML||path.join(__dirname,'..','world-editor.html'),'utf8');
function setup(){
 const mem=new Map(),feedback=[];
 let failed=false;
 const c=vm.createContext({facilitySite:{id:'base'},poiWalkActive:true,pineAIActive:false,poiWalkLevel:-1,
  poiKitchenChestReachable:()=>true,poiChestIsOpen:()=>true,poiPlayerHP:10,POI_PLAYER_MAX_HP:100,$:()=>null,
  document:{querySelectorAll:()=>[]},poiWalkAvatar(){},poiCombatHud(){},poiHealPlayerFeedback:n=>feedback.push(n),toast(){},
  localStorage:{getItem:k=>mem.get(k),setItem(k,v){if(failed)throw Error('disk');mem.set(k,v)}}});
 const a=h.indexOf('const POI_HOTBAR_KEY='),b=h.indexOf('function poiResetCombat(',a);vm.runInContext(h.slice(a,b),c);
 c.poiKitchenChestReachable=()=>true;c.poiChestIsOpen=()=>true;c.poiOpenKitchenChest(()=>0);return {c,feedback,mem,fail:v=>failed=v};
}
const at=(c,z,i)=>c.poiInventorySnapshot()[z][i];
test('quick moves use first empty bag or chest, require open access, and never touch hotbar',()=>{
 const {c}=setup();
 assert.equal(typeof c.poiQuickTransferStorage,'function');
 assert.equal(c.poiQuickTransferStorage('chest',0).ok,true);
 assert.equal(at(c,'bag',0).type,'kitchenKnife');assert.equal(at(c,'hotbar',2),null);
 assert.equal(c.poiQuickTransferStorage('chest',1).ok,true);
 assert.equal(at(c,'bag',1).type,'cannedFood');
 c.poiChestIsOpen=()=>false;assert.equal(c.poiQuickTransferStorage('bag',0).reason,'unavailable');
 assert.equal(at(c,'bag',0).type,'kitchenKnife');
 c.poiChestIsOpen=()=>true;assert.equal(c.poiQuickTransferStorage('bag',1).ok,true);
 assert.equal(c.poiChestSlotAt(0).type,'cannedFood');assert.equal(at(c,'bag',1),null);
});
test('split uses floor/ceiling halves, respects grid and locked slots, and never loses a failed write',()=>{
 const {c,fail}=setup();
 assert.equal(c.poiInventoryMove(1,{zone:'bag',index:8}).ok,true);
 fail(true);assert.equal(c.poiSplitStorageStack('bag',8).reason,'storage');assert.equal(at(c,'bag',8).count,3);
 fail(false);assert.equal(c.poiSplitStorageStack('bag',8).ok,true);
 assert.equal(at(c,'bag',8).count,1);assert.equal(at(c,'bag',7).count,2);assert.equal(at(c,'bag',9),null);
 assert.equal(c.poiSplitStorageStack('bag',7).ok,true);assert.equal(at(c,'bag',6).count,1);
 assert.equal(c.poiSplitStorageStack('bag',8).reason,'single');
 assert.equal(c.poiSplitStorageStack('bag',18).reason,'locked');
 assert.equal(c.poiInventorySnapshot().potions,3);
});
test('bag equip and use save atomically and are unavailable directly from chest',()=>{
 const {c,fail,feedback}=setup();
 c.poiQuickTransferStorage('chest',0);c.poiQuickTransferStorage('chest',1);
 fail(true);assert.equal(c.poiEquipBagItem(0).reason,'storage');assert.equal(at(c,'hotbar',2),null);
 assert.equal(c.poiUseBagItem(1).reason,'storage');assert.equal(c.poiPlayerHP,10);assert.deepEqual(feedback,[]);
 fail(false);assert.equal(c.poiEquipBagItem(0).ok,true);assert.equal(at(c,'bag',0),null);
 assert.equal(at(c,'hotbar',2).type,'kitchenKnife');assert.equal(c.poiEquippedWeapon(),'kitchenKnife');
 assert.equal(c.poiUseBagItem(1).ok,true);assert.equal(c.poiPlayerHP,65);assert.deepEqual(feedback,[55]);assert.equal(at(c,'bag',1),null);
 assert.equal(c.poiEquipBagItem(18).reason,'locked');assert.equal(c.poiUseBagItem(18).reason,'locked');
});
test('full destinations do not swap, split, or write over equipment',()=>{
 const {c,mem}=setup(),state=()=>[...mem.values()][0];
 let kit=c.poiHotbarRead(),slots=Array.from({length:27},(_,i)=>i?{type:'healingHerb',count:2}:{type:'equipWoodSword',count:1});
 c.poiEconomyWrite(c.poiInventoryEdited(kit,slots));const full=state();
 assert.equal(c.poiQuickTransferStorage('chest',0).reason,'full');assert.equal(c.poiSplitStorageStack('bag',0).reason,'full');
 assert.equal(state(),full);assert.equal(c.poiChestSlotAt(0).type,'kitchenKnife');
 assert.equal(c.poiMoveChestInventorySlot('chest',0,'inventory',9).ok,true);
 const shifted=state();assert.equal(c.poiEquipBagItem(0).reason,'full');
 assert.equal(c.poiSplitStorageStack('bag',0).reason,'single');
 assert.equal(state(),shifted);assert.equal(at(c,'bag',0).type,'kitchenKnife');
});
