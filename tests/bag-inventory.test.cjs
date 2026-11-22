const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function fixture(saved=null){
 let failure=false,raw=saved&&JSON.stringify(saved),writes=0;
 const ctx={poiPlayerHP:100,POI_PLAYER_MAX_HP:100,facilitySite:{id:'base'},poiWalkActive:true,pineAIActive:false,poiWalkX:4,poiWalkZ:5,poiWalkLevel:0,poiWalkFacing:0,world:[],
 localStorage:{getItem(){return raw},setItem(_key,v){if(failure)throw Error('quota');raw=v;writes++}},
 poiWalkCanStep:()=>true,isFloor:()=>true,poiWalkAvatar(){},document:{querySelectorAll:()=>[]},$(){return null},toast(){}};
 vm.createContext(ctx);
 const a=h.indexOf('const POI_HOTBAR_KEY='),b=h.indexOf('function poiResetCombat(',a);
 vm.runInContext(h.slice(a,b),ctx);
 return {ctx,raw:()=>JSON.parse(raw),writes:()=>writes,fail:v=>failure=v};
}
const spot=(zone,index)=>({zone,index});
test('legacy state opens with no writes and migrates atomically when rearranged',()=>{
 const f=fixture({version:1,weapon:'equipWoodSword',potions:0,gold:30,claimedCaches:['glade']});
 let s=f.ctx.poiInventorySnapshot();
 assert.equal(s.hotbar.length,9);assert.equal(s.bag.length,25);assert.equal(s.bagUnlocked,9);
 assert.equal(s.hotbar[0].type,'equipWoodSword');assert.equal(s.hotbar[1],null);assert.equal(f.writes(),0);
 assert.equal(f.ctx.poiInventoryMove(0,spot('bag',18)).ok,false);assert.equal(f.writes(),0);
 f.fail(true);assert.equal(f.ctx.poiInventoryMove(0,spot('bag',1)).ok,false);assert.equal(f.ctx.poiInventorySnapshot().weapon,'equipWoodSword');
 f.fail(false);assert.equal(f.ctx.poiInventoryMove(0,spot('bag',1)).ok,true);assert.equal(f.writes(),1);
 assert.deepEqual([f.raw().gold,f.raw().claimedCaches[0],f.raw().weapon],[30,'glade',null]);
 s=fixture(f.raw()).ctx.poiInventorySnapshot();assert.equal(s.bag[1].type,'equipWoodSword');assert.equal(s.hotbar[0],null);
});
test('hotbar fills before bag, never exceeds nine per stack, and permits physical bag drop and pickup',()=>{
 const slots=Array.from({length:27},(_,i)=>i===0?{type:'equipWoodSword',count:1}:i<9?{type:'healingHerb',count:9}:null);
 const f=fixture({version:1,weapon:null,potions:9,gold:12,slots});
 assert.equal(f.ctx.poiEconomyBuyPotion().ok,true);assert.equal(f.ctx.poiInventorySnapshot().bag[0].count,1);
 assert.equal(f.ctx.poiInventoryDrop(spot('bag',0)).ok,true);assert.equal(f.ctx.poiInventorySnapshot().bag[0],null);
 assert.equal(f.ctx.poiInventoryPickup(4,4),true);assert.equal(f.ctx.poiInventorySnapshot().bag[0].count,1);
 assert.equal(f.ctx.poiInventoryMove(spot('bag',0),spot('hotbar',8)).ok,true);
 assert.equal(f.ctx.poiInventorySnapshot().bag[0].count,9);assert.equal(f.ctx.poiInventorySnapshot().hotbar[8].count,1);
});
test('malformed optional slots fall back without erasing the legacy wallet, claim, or zero stock',()=>{
 const sword={type:'equipWoodSword',count:1},herb={type:'healingHerb',count:1};
 const bad=[[],Array(40).fill(null),[sword,sword,...Array(22).fill(null)],
  [sword,herb,...Array(22).fill(null)],[sword,{...herb,count:10},...Array(22).fill(null)]];
 for(const slots of bad){
  const original={version:1,weapon:'equipWoodSword',potions:0,gold:12,claimedCaches:['glade','bogus'],slots};
  const f=fixture(original),s=f.ctx.poiInventorySnapshot();
  assert.equal(s.weapon,'equipWoodSword');assert.equal(s.potions,0);assert.equal(s.hotbar[0].type,sword.type);
  assert.equal(f.ctx.poiEconomyGold(),12);assert.deepEqual(Array.from(f.ctx.poiHotbarRead().claimedCaches),['glade']);
  assert.deepEqual(f.raw(),original);assert.equal(f.writes(),0);
 }
});
test('maximum 27-cell stash reloads exactly; full ground pickup and full shop touch nothing',()=>{
 const slots=Array.from({length:27},()=>({type:'healingHerb',count:9}));
 const original={version:1,weapon:null,potions:9,gold:12,sword:false,slots,drops:[
  {type:'equipWoodSword',x:4,z:4,y:0},{type:'healingHerb',x:4,z:3,y:0,count:2}]};
 const f=fixture(original),s=f.ctx.poiInventorySnapshot();
 assert.equal(s.potions,243);assert.equal(s.bag.slice(0,18).every(c=>c.count===9),true);assert.equal(s.bag.slice(18).every(c=>c===null),true);
 assert.equal(f.ctx.poiInventoryPickup(4,4),false);assert.equal(f.ctx.poiInventoryPickup(4,3),false);
 assert.equal(f.ctx.poiEconomyBuyPotion().reason,'full');assert.equal(f.writes(),0);assert.deepEqual(f.raw(),original);
 assert.equal(f.ctx.poiInventoryDrop(spot('bag',17)).reason,'full');assert.equal(f.writes(),0);
});
test('malformed slot/drop duplication cannot produce a held sword and a ground sword',()=>{
 const sword={type:'equipWoodSword',count:1},ground={type:sword.type,x:4,z:4,y:0};
 const raw={version:1,weapon:'equipWoodSword',potions:0,gold:12,sword:false,drops:[ground],
  slots:[sword,...Array(23).fill(null)]};
 const f=fixture(raw);assert.equal(f.ctx.poiInventorySnapshot().sword,false);assert.equal(f.ctx.poiInventorySnapshot().weapon,null);
 assert.equal(f.ctx.poiInventoryPickup(4,4),true);
 const fresh=fixture(f.raw());assert.equal(fresh.ctx.poiInventorySnapshot().hotbar[0].type,sword.type);
 assert.equal(fresh.ctx.poiInventorySnapshot().drops.length,0);assert.equal(fresh.ctx.poiEquippedWeapon(),null);
 const held=fixture({...raw,sword:true});assert.equal(held.ctx.poiInventorySnapshot().drops.length,0);
 assert.equal(held.ctx.poiInventorySnapshot().hotbar[0].type,sword.type);
});
test('v155 24-cell saves open as 27 destinations without shifting any old bag row or column on reload',()=>{
 const slots=Array(24).fill(null);
 slots[7]={type:'healingHerb',count:3};slots[8]={type:'healingHerb',count:4};
 slots[15]={type:'healingHerb',count:5};slots[16]={type:'equipWoodSword',count:1};
 slots[23]={type:'healingHerb',count:6};
 const old={version:1,weapon:null,potions:9,gold:24,claimedCaches:['glade'],slots};
 const f=fixture(old),s=f.ctx.poiInventorySnapshot();
 assert.equal(s.hotbar.length,9);assert.equal(s.bag.length,25);assert.equal(s.bagUnlocked,9);
 assert.equal(s.hotbar[7].count,3);assert.equal(s.hotbar[8],null);
 assert.equal(s.bag[0].count,4);assert.equal(s.bag[7].count,5);assert.equal(s.bag[8],null);
 assert.equal(s.bag[9].type,'equipWoodSword');assert.equal(s.bag[16].count,6);assert.equal(s.bag[17],null);
 assert.equal(s.potions,18);assert.deepEqual(f.raw(),old);assert.equal(f.writes(),0);
 assert.equal(f.ctx.poiInventoryMove(spot('bag',9),spot('hotbar',8)).ok,true);
 const saved=f.raw();assert.equal(saved.slots.length,27);assert.equal(saved.gold,24);assert.deepEqual(saved.claimedCaches,['glade']);
 const fresh=fixture(saved).ctx.poiInventorySnapshot();
 assert.equal(fresh.hotbar[8].type,'equipWoodSword');assert.equal(fresh.bag[9],null);
});
test('legacy occupied slots survive reload and can only be withdrawn, not merged into or swapped',()=>{
 const slots=Array(27).fill(null);
 const sword={type:'equipWoodSword',count:1},herb={type:'healingHerb',count:2};
 slots[0]=sword;slots[1]=herb;slots[19]=herb;slots[26]={type:'cannedFood',count:3};
 const original={version:1,weapon:null,potions:4,gold:12,slots,kitchenChest:{version:1,slots:[herb,...Array(17).fill(null)]}};
 const f=fixture(original), api=f.ctx;
 api.poiChestIsOpen=api.poiKitchenChestReachable=()=>true;
 assert.equal(f.writes(),0);
 assert.deepEqual(Array.from(api.poiInventorySnapshot().bagLegacy),[10,17]);
 assert.equal(api.poiInventoryMove(1,spot('bag',10)).reason,'locked');
 assert.equal(api.poiInventoryMove(spot('bag',17),1).reason,'locked');
 assert.equal(api.poiMoveChestInventorySlot('chest',0,'inventory',20).reason,'locked');
 assert.equal(api.poiMoveChestInventorySlot('inventory',26,'chest',0).reason,'locked');
 assert.equal(f.writes(),0);assert.deepEqual(f.raw(),original);
 f.fail(true);assert.equal(api.poiQuickTransferStorage('bag',17).reason,'storage');
 assert.equal(api.poiInventorySnapshot().bag[17].count,3);
 f.fail(false);assert.equal(api.poiQuickTransferStorage('bag',17).ok,true);
 assert.equal(api.poiChestSlotAt(1).count,3);
 assert.equal(api.poiInventoryMove(spot('bag',10),1).ok,true);
 const r=fixture(f.raw());assert.equal(r.ctx.poiInventorySnapshot().hotbar[1].count,4);
 assert.deepEqual(Array.from(r.ctx.poiInventorySnapshot().bagLegacy),[]);
 assert.equal(r.ctx.poiInventoryMove(1,spot('bag',10)).reason,'locked');
});
test('pickup, purchase, quick transfer and split cannot treat locked empty slots or legacy stacks as capacity',()=>{
 const slots=Array.from({length:27},(_,i)=>i===0?{type:'equipWoodSword',count:1}:i<18?{type:'healingHerb',count:9}:i===19?{type:'healingHerb',count:3}:null);
 const original={version:1,weapon:null,potions:9,gold:12,slots,
  kitchenChest:{version:1,slots:[{type:'healingHerb',count:1},...Array(17).fill(null)]},
  drops:[{type:'healingHerb',x:4,z:3,y:0,count:2}]};
 const f=fixture(original),api=f.ctx;
 api.poiChestIsOpen=api.poiKitchenChestReachable=()=>true;
 assert.equal(api.poiEconomyBuyPotion().reason,'full');
 assert.equal(api.poiInventoryPickup(4,3),false);
 assert.equal(api.poiQuickTransferStorage('chest',0).reason,'full');
 assert.equal(api.poiSplitStorageStack('bag',10).reason,'full');
 assert.equal(f.writes(),0);
 assert.equal(api.poiMoveChestInventorySlot('inventory',17,'chest',1).ok,true);
 assert.equal(api.poiSplitStorageStack('bag',10).ok,true);
 assert.equal(api.poiInventorySnapshot().bag[10].count,1);
 assert.equal(api.poiInventorySnapshot().bag[8].count,2);
});
test('legacy-only gear and consumables remain usable without reopening locked destinations',()=>{
 const slots=Array(27).fill(null);
 slots[18]={type:'starterCap',count:1};
 slots[19]={type:'healingHerb',count:1};
 slots[26]={type:'equipWoodSword',count:1};
 const f=fixture({version:1,weapon:null,potions:1,slots,worn:{head:null,torso:'starterTunic',legs:'starterTrousers',feet:'starterBoots'}}),api=f.ctx;
 assert.deepEqual(Array.from(api.poiInventorySnapshot().bagLegacy),[9,10,17]);
 assert.equal(api.poiEquipArmorFromBag(9).ok,true);
 assert.equal(api.poiArmorSnapshot().head.type,'starterCap');
 assert.equal(api.poiMoveArmorSlot({zone:'armor',part:'head'},spot('bag',9)).reason,'locked');
 assert.equal(api.poiEquipBagItem(17).ok,true);
 assert.equal(api.poiEquippedWeapon(),'equipWoodSword');
 assert.equal(api.poiInventoryDrop(spot('bag',10)).ok,true);
 assert.deepEqual(Array.from(api.poiInventorySnapshot().bagLegacy),[]);
 assert.equal(api.poiInventoryPickup(4,4),true);
 assert.equal(f.raw().slots?.length??27,27);
});
test('double tapping a legacy herb fills hotbar stacks then empty hotbar slots without use or equipment changes',()=>{
 const slots=Array(27).fill(null);
 slots[0]={type:'equipWoodSword',count:1};slots[7]={type:'healingHerb',count:8};
 slots[26]={type:'healingHerb',count:3};
 const f=fixture({version:1,weapon:'equipWoodSword',potions:9,slots});
 f.fail(true);assert.equal(f.ctx.poiDoubleTapStorage('bag',17).reason,'storage');
 assert.equal(f.ctx.poiInventorySnapshot().bag[17].count,3);
 f.fail(false);assert.equal(f.ctx.poiDoubleTapStorage('bag',17).ok,true);
 const s=f.ctx.poiInventorySnapshot();
 assert.equal(s.weapon,'equipWoodSword');assert.equal(s.hotbar[7].count,9);assert.equal(s.hotbar[1].count,2);
 assert.equal(s.bag[17],null);assert.equal(s.potions,11);assert.equal(f.writes(),1);
});
test('chest herb reaches shortcut only if chest is usable, and full shortcut does not use empty bag',()=>{
 const slots=Array(27).fill(null);
 slots[0]={type:'equipWoodSword',count:1};
 for(let i=1;i<9;i++)slots[i]={type:'healingHerb',count:9};
 const f=fixture({version:1,weapon:null,potions:9,slots,kitchenChest:{version:1,slots:[{type:'healingHerb',count:2},...Array(17).fill(null)]}});
 const c=f.ctx;
 c.poiChestIsOpen=()=>false;c.poiKitchenChestReachable=()=>true;
 assert.equal(c.poiDoubleTapStorage('chest',0).reason,'unavailable');c.poiChestIsOpen=()=>true;
 assert.equal(c.poiDoubleTapStorage('chest',0).reason,'full');
 assert.equal(c.poiChestSlotAt(0).count,2);assert.equal(f.writes(),0);
 assert.equal(c.poiInventoryMove(8,spot('bag',0)).ok,true);
 assert.equal(c.poiDoubleTapStorage('chest',0).ok,true);
 assert.equal(c.poiInventorySnapshot().hotbar[8].count,2);assert.equal(c.poiChestSlotAt(0),null);
});
test('gold moves only to an empty unlocked bag cell, preserving amount, item positions, and old save data',()=>{
 const stash=Array(27).fill(null);
 stash[0]={type:'equipWoodSword',count:1};stash[11]={type:'healingHerb',count:3};stash[26]={type:'cannedFood',count:2};
 const original={version:1,weapon:null,potions:3,gold:31,slots:stash,claimedCaches:['glade']};
 const f=fixture(original),api=f.ctx,move=i=>api.poiMoveGoldToBag(spot('bag',i));
 assert.equal(api.poiInventorySnapshot().goldBagSlot,9);assert.equal(f.writes(),0);
 assert.equal(move(2).reason,'occupied');assert.equal(move(17).reason,'locked');
 assert.equal(api.poiMoveGoldToBag(spot('chest',0)).reason,'locked');assert.equal(f.writes(),0);
 f.fail(true);assert.equal(move(0).reason,'storage');assert.equal(api.poiInventorySnapshot().goldBagSlot,9);
 f.fail(false);assert.equal(move(0).ok,true);assert.equal(api.poiInventorySnapshot().goldBagSlot,0);
 assert.deepEqual(f.raw().slots,stash);
 assert.deepEqual(f.raw().goldBagOrder,[9,1,2,3,4,5,6,7,8,0]);
 assert.equal(api.poiInventoryMove(spot('bag',2),spot('bag',0)).ok,true);
 assert.equal(move(1).ok,true);
 assert.deepEqual(f.raw().goldBagOrder,[1,9,2,3,4,5,6,7,8,0],'item in former wallet cell does not move again');
 const restarted=fixture(f.raw());
 assert.equal(restarted.ctx.poiInventorySnapshot().goldBagSlot,1);
 assert.equal(restarted.ctx.poiEconomyGold(),31);assert.equal(restarted.ctx.poiInventorySnapshot().bag[0].count,3);
 assert.deepEqual(f.raw().claimedCaches,['glade']);assert.equal(restarted.writes(),0);
});
test('wallet placement is recoverable without canonicalization writes and carries through ordinary shop purchase',()=>{
 const identity=Array.from({length:10},(_,i)=>i);
 const wallet={version:1,weapon:null,potions:3,gold:12};
 const badSave={...wallet,goldBagOrder:[0,0,1,2,3,4,5,6,7,9]};
 const broken=fixture(badSave);
 assert.equal(broken.ctx.poiInventorySnapshot().goldBagSlot,9);assert.equal(broken.writes(),0);
 assert.deepEqual(broken.raw(),badSave);
 const f=fixture(wallet);
 assert.equal(f.ctx.poiMoveGoldToBag(spot('bag',0)).ok,true);
 assert.equal(f.ctx.poiEconomyBuyPotion().ok,true);assert.equal(f.ctx.poiEconomyGold(),6);
 assert.equal(f.ctx.poiInventorySnapshot().goldBagSlot,0);
 vm.runInContext("poiEconomyDrops.set('4,5',{amount:3})",f.ctx);
 assert.equal(f.ctx.poiEconomyCollect(4,5),true);assert.equal(f.ctx.poiEconomyGold(),9);
 assert.equal(fixture(f.raw()).ctx.poiInventorySnapshot().goldBagSlot,0);
 assert.equal(f.ctx.poiMoveGoldToBag(spot('bag',0)).ok,true);
 assert.equal(f.raw().goldBagOrder,undefined,'identity layout is omitted');
 assert.deepEqual(Array.from(f.ctx.poiInventorySnapshot().goldBagOrder),identity);
});
test('shortcut details explicitly split, equip, use and move without double-tap auto-use',()=>{
 const f=fixture({version:1,weapon:null,potions:5}),c=f.ctx;
 assert.equal(c.poiSplitStorageStack('hotbar',1).ok,true);
 assert.equal(c.poiInventorySnapshot().hotbar[1].count,2);
 assert.equal(c.poiInventorySnapshot().hotbar[2].count,3);
 assert.equal(c.poiEquipHotbarItem(0).ok,true);
 assert.equal(c.poiEquippedWeapon(),'equipWoodSword');
 vm.runInContext('poiPlayerHP=70;poiCombatHud=()=>{}',c);
 assert.equal(c.poiUseHotbarItem(1).ok,true);
 assert.equal(c.poiPlayerHP,100);
 assert.equal(c.poiDoubleTapStorage('hotbar',2).ok,true);
 assert.equal(c.poiInventorySnapshot().bag[0].count,3);
 assert.equal(c.poiInventorySnapshot().hotbar[2],null);
 assert.equal(c.poiEquippedWeapon(),'equipWoodSword');
 assert.equal(c.poiPlayerHP,100);
});
test('hotbar-to-bag is atomic and does not treat old overflow as capacity; transfer can use chest',()=>{
 const slots=Array(27).fill(null);slots[0]={type:'equipWoodSword',count:1};
 slots[1]={type:'healingHerb',count:2};
 for(let i=9;i<18;i++)slots[i]={type:'cannedFood',count:9};
 const f=fixture({version:1,weapon:'equipWoodSword',potions:2,slots,kitchenChest:{version:1,slots:Array(18).fill(null)}}),c=f.ctx;
 assert.equal(c.poiDoubleTapStorage('hotbar',0).reason,'full');
 c.poiChestIsOpen=()=>false;c.poiKitchenChestReachable=()=>true;
 assert.equal(c.poiQuickTransferStorage('hotbar',0).reason,'unavailable');
 c.poiChestIsOpen=()=>true;f.fail(true);
 assert.equal(c.poiQuickTransferStorage('hotbar',0).reason,'storage');assert.equal(f.writes(),0);
 assert.equal(c.poiEquippedWeapon(),'equipWoodSword');
 f.fail(false);assert.equal(c.poiQuickTransferStorage('hotbar',0).ok,true);
 assert.equal(c.poiEquippedWeapon(),null);assert.equal(c.poiChestSlotAt(0).type,'equipWoodSword');
});
test('mine quest acceptance is the only durable write, preserves the kit, and updates its real entry marker',()=>{
 const original={version:1,weapon:null,potions:3,gold:12,claimedCaches:['glade']};
 const f=fixture(original),c=f.ctx,actor={role:{id:'guildkeeper'}};
 c.facilitySite.mine={entrance:{x:116,z:64,y:0}};
 c.poiTownDialogueTarget=()=>actor;let paints=0;c.poiMiniUpdate=()=>paints++;
 assert.equal(c.poiQuestsForClerk()[0].label,'廃坑★★☆☆☆（調査）');
 assert.equal(c.poiQuestTitle({dungeon:'古塔',difficulty:4,kind:'hunt'}),'古塔★★★★☆（討伐）');
 assert.equal(c.poiQuestMiniTargets().length,0);assert.equal(f.writes(),0);
 assert.equal(c.poiQuestAccept('mine-survey',{role:{id:'stablekeeper'}},100).reason,'unavailable');
 assert.equal(c.poiQuestAccept('unknown',actor,100).reason,'unavailable');
 f.fail(true);assert.equal(c.poiQuestAccept('mine-survey',actor,100).reason,'storage');
 assert.equal(paints,0);assert.equal(f.writes(),0);assert.deepEqual(f.raw(),original);
 f.fail(false);assert.equal(c.poiQuestAccept('mine-survey',actor,100).ok,true);
 assert.deepEqual(f.raw(),{...original,quests:['mine-survey']});
 assert.deepEqual(JSON.parse(JSON.stringify(c.poiQuestMiniTargets())),[{id:'mine-survey',x:116,z:64,y:0}]);
 c.poiWalkLevel=-1;assert.equal(c.poiQuestMiniTargets().length,0);
 assert.equal(c.poiQuestAccept('mine-survey',actor,100).reason,'already');
 assert.equal(paints,1);assert.equal(f.writes(),1);
 const restored=fixture(f.raw());assert.equal(restored.ctx.poiQuestAccepted('mine-survey'),true);
 assert.equal(restored.writes(),0);
});
test('wallet reserves a shortcut, never consumes it as an empty destination, and returns without changing balance',()=>{
 const f=fixture({version:1,weapon:'equipWoodSword',potions:3,gold:12}),c=f.ctx;
 const h=i=>spot('hotbar',i),b=i=>spot('bag',i);
 assert.equal(c.poiMoveGoldToBag(h(0)).reason,'occupied');
 f.fail(true);assert.equal(c.poiMoveGoldToBag(h(2)).reason,'storage');assert.equal(f.writes(),0);
 f.fail(false);assert.equal(c.poiMoveGoldToBag(h(2)).ok,true);
 assert.equal(c.poiInventorySnapshot().goldHotbarSlot,2);assert.equal(f.raw().goldHotbarSlot,2);
 c.poiHotbarUse(2);assert.equal(c.poiEquippedWeapon(),'equipWoodSword');assert.equal(f.writes(),1);
 assert.equal(c.poiInventoryMove(1,h(2)).reason,'occupied');
 assert.equal(c.poiSplitStorageStack('hotbar',1).ok,true);
 assert.equal(c.poiInventorySnapshot().hotbar[2],null);assert.equal(c.poiInventorySnapshot().hotbar[3].count,2);
 assert.equal(c.poiEconomyBuyPotion().ok,true);assert.equal(c.poiEconomyGold(),6);
 assert.equal(fixture(f.raw()).ctx.poiInventorySnapshot().goldHotbarSlot,2);
 assert.equal(c.poiMoveGoldToBag({zone:'wallet-home'}).ok,true);
 assert.equal(c.poiInventorySnapshot().goldHotbarSlot,null);
 assert.equal(f.raw().goldHotbarSlot,undefined);assert.equal(f.raw().gold,6);
 assert.equal(c.poiInventoryMove(1,h(2)).ok,true);
});
test('malformed/reservation conflicts hydrate without changing the wallet or rewriting either value',()=>{
 for(const i of [0,1,-1,9,'2']){
  const seed={version:1,weapon:null,potions:3,gold:11,goldHotbarSlot:i};
  const f=fixture(seed);assert.equal(f.ctx.poiInventorySnapshot().goldHotbarSlot,null);
  assert.deepEqual(f.raw(),seed);assert.equal(f.writes(),0);
 }
});
test('reserved shortcut is not hidden capacity for chest moves, quick herbs, equipment, shop or pickups',()=>{
 const slots=Array(27).fill(null);slots[0]={type:'equipWoodSword',count:1};
 for(let i=1;i<8;i++)slots[i]={type:'healingHerb',count:9};
 for(let i=9;i<17;i++)slots[i]={type:'healingHerb',count:9};
 slots[17]={type:'cannedFood',count:9};slots[26]={type:'healingHerb',count:2};
 const original={version:1,weapon:'equipWoodSword',potions:9,gold:12,slots,goldHotbarSlot:8,
  drops:[{type:'healingHerb',x:4,z:4,y:0}],kitchenChest:{version:1,slots:[{type:'healingHerb',count:2},...Array(17).fill(null)]}};
 const f=fixture(original),c=f.ctx;
 c.poiChestIsOpen=c.poiKitchenChestReachable=()=>true;
 assert.equal(c.poiMoveChestInventorySlot('chest',0,'inventory',8).reason,'occupied');
 assert.equal(c.poiDoubleTapStorage('bag',17).reason,'full');
 assert.equal(c.poiDoubleTapStorage('chest',0).reason,'full');
 assert.equal(c.poiEconomyBuyPotion().reason,'full');
 assert.equal(c.poiInventoryPickup(4,4),false);
 assert.equal(c.poiHotbarSave({...c.poiHotbarRead(),slots:slots.map((cell,i)=>i===8?{type:'healingHerb',count:1}:cell)}),false);
 assert.deepEqual(f.raw(),original);assert.equal(f.writes(),0);
 assert.equal(c.poiMoveGoldToBag(spot('bag',0)).reason,'occupied');
 assert.equal(c.poiMoveGoldToBag(spot('chest',0)).reason,'locked');
});
test('bag equipment does not overwrite gold when all ordinary shortcuts are full',()=>{
 const slots=Array(27).fill(null);
 for(let i=0;i<8;i++)slots[i]={type:'healingHerb',count:9};
 slots[9]={type:'equipWoodSword',count:1};
 const f=fixture({version:1,weapon:null,potions:9,gold:12,slots,goldHotbarSlot:8}),c=f.ctx;
 assert.equal(c.poiEquipBagItem(0).reason,'full');assert.equal(f.writes(),0);
 assert.equal(c.poiMoveGoldToBag({zone:'wallet-home'}).ok,true);
 assert.equal(c.poiEquipBagItem(0).ok,true);
 assert.equal(c.poiInventorySnapshot().hotbar[8].type,'equipWoodSword');
});
test('legacy equipment displays full durability without rewriting; sword break is paid once and survives reload',()=>{
 const full=fixture({version:1,weapon:'equipWoodSword',potions:0});
 assert.equal(full.ctx.poiEquipmentDurabilityPercent(full.ctx.poiInventorySnapshot().hotbar[0]),100);
 assert.equal(full.ctx.poiEquipmentDurabilityPercent(full.ctx.poiArmorSnapshot().torso),100);
 assert.equal(full.writes(),0);
 assert.equal(full.ctx.poiEquipmentSpendWeapon('equipWoodSword'),true);
 assert.equal(fixture(full.raw()).ctx.poiInventorySnapshot().hotbar[0].durability,79);
 const slots=Array(27).fill(null);slots[0]={type:'equipWoodSword',count:1,durability:1};
 const f=fixture({version:1,weapon:'equipWoodSword',potions:0,slots}),c=f.ctx,sounds=[];
 c.poiSound=(...args)=>sounds.push(args);
 f.fail(true);assert.equal(c.poiEquipmentSpendWeapon('equipWoodSword'),false);assert.equal(c.poiEquippedWeapon(),'equipWoodSword');assert.equal(sounds.length,0);
 f.fail(false);assert.equal(c.poiEquipmentSpendWeapon('equipWoodSword'),true);assert.equal(c.poiEquippedWeapon(),null);
 assert.deepEqual(sounds,[['equipment-break','equipWoodSword']]);
 assert.equal(fixture(f.raw()).ctx.poiInventorySnapshot().hotbar[0],null);
 assert.equal(c.poiEquipmentSpendWeapon('equipWoodSword'),false);assert.equal(sounds.length,1);
});
test('worn gear preserves wear through bag, ground, chest and reload, and final break remains missing',()=>{
 const f=fixture({version:1,weapon:null,potions:0,worn:{head:null,torso:'starterTunic',legs:null,feet:null},wornDurability:{torso:2},
  kitchenChest:{version:1,slots:Array(18).fill(null)}}),c=f.ctx;
 const sounds=[];c.poiSound=(...args)=>sounds.push(args);
 f.fail(true);assert.equal(c.poiEquipmentWearArmor(),false);assert.equal(c.poiArmorSnapshot().torso.durability,2);
 f.fail(false);assert.equal(c.poiEquipmentWearArmor(),true);assert.equal(c.poiArmorSnapshot().torso.durability,1);
 assert.equal(c.poiUnequipArmor('torso').ok,true);
 c.poiChestIsOpen=c.poiKitchenChestReachable=()=>true;
 assert.equal(c.poiMoveChestInventorySlot('inventory',9,'chest',0).ok,true);
 assert.equal(c.poiChestSlotAt(0).durability,1);
 assert.equal(c.poiMoveChestInventorySlot('chest',0,'inventory',9).ok,true);
 c.poiChestIsOpen=()=>false;
 assert.equal(c.poiInventoryDrop(spot('bag',0)).ok,true);assert.equal(f.raw().drops[0].durability,1);
 const after=fixture(f.raw());after.ctx.poiSound=(...args)=>sounds.push(args);
 assert.equal(after.ctx.poiInventoryPickup(4,4),true);assert.equal(after.ctx.poiInventorySnapshot().bag[0].durability,1);
 assert.equal(after.ctx.poiEquipArmorFromBag(0).ok,true);assert.equal(after.ctx.poiArmorSnapshot().torso.durability,1);
 assert.equal(after.ctx.poiEquipmentWearArmor(),true);assert.equal(after.ctx.poiArmorSnapshot().torso,null);
 assert.deepEqual(sounds,[['chest-pickup','starterTunic'],['inventory-drop','starterTunic'],['item-pickup','starterTunic'],['equipment-break','starterTunic']]);
 assert.equal(fixture(after.raw()).ctx.poiArmorSnapshot().torso,null);
});
