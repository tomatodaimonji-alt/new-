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
const W='fireWand',A='armorIronTorso',bow='equipWoodBow',cell=(type,extra={})=>({type,count:1,...extra});
test('all added combat equipment equips or wears through old storage and kit paths',()=>{
 const f=fixture(),c=f.ctx;
 for(const type of [bow,'equipWoodSpear','equipStoneMace','equipBoneSword','equipIronSword']){
  assert.equal(c.poiHotbarWeaponForType(type),type);
  assert(c.poiEquipmentDurabilityMax(type)>0);
  assert.equal(c.poiInventorySanitizeCell(cell(type)).type,type);
 }
 const k=c.poiHotbarRead(),s=c.poiInventorySlots(k).slice();
 s[2]=cell(bow,{durability:5});s[9]=cell(A,{durability:3});assert(c.poiEconomyWrite(c.poiInventoryEdited(k,s)));
 c.poiHotbarUse(2);assert.equal(c.poiEquippedWeapon(),bow);
 assert(c.poiEquipmentSpendWeapon(bow));assert.equal(fixture(f.raw()).ctx.poiInventorySnapshot().hotbar[2].durability,4);
 assert(c.poiEquipArmorFromBag(0).ok);
 const reload=fixture(f.raw()).ctx;assert.equal(reload.poiArmorWorn(reload.poiHotbarRead()).torso,A);
 assert.equal(reload.poiArmorSnapshot().torso.durability,3);
});
test('a finite nonstackable wand keeps charges across grounds, transfer, reload and failed spend',()=>{
 const f=fixture(),c=f.ctx;
 assert.equal(c.poiHotbarWeaponForType(W),null);assert.equal(c.poiInventoryStack(W),1);
 assert.equal(c.poiInventorySanitizeCell(cell(W,{charges:0})),null);
 assert.equal(c.poiInventorySanitizeCell(cell(W,{charges:6})),null);
 const k=c.poiHotbarRead(),s=c.poiInventorySlots(k).slice();s[2]=cell(W,{charges:2});
 assert(c.poiEconomyWrite(c.poiInventoryEdited(k,s)));
 f.fail(true);assert.equal(c.poiInventorySpendFireWand(2),false);assert.equal(c.poiInventorySnapshot().hotbar[2].charges,2);
 f.fail(false);assert.equal(c.poiInventoryDrop(2).ok,true);
 const d=f.raw().drops.at(-1);assert.equal(d.charges,2);
 const g=fixture(f.raw()),q=g.ctx;assert(q.poiInventoryPickup(d.x,d.z));
 const i=q.poiInventorySnapshot().hotbar.findIndex(e=>e?.type===W);
 assert(i>=0);assert(q.poiInventorySpendFireWand(i));assert.equal(q.poiInventorySnapshot().hotbar[i].charges,1);
 assert(q.poiInventorySpendFireWand(i));assert.equal(q.poiInventorySnapshot().hotbar[i],null);
 assert.equal(q.poiInventorySpendFireWand(i),false);
});
test('old two-weapon migration does not scale new weapons',()=>{
 const slots=Array(27).fill(null);slots[0]=cell('equipWoodSword',{durability:20});slots[2]=cell(bow,{durability:5});
 const c=fixture({version:1,weapon:null,potions:0,slots}).ctx;
 assert.equal(c.poiInventorySnapshot().hotbar[0].durability,40);
 assert.equal(c.poiInventorySnapshot().hotbar[2].durability,5);
});
test('both inventory use routes defer to a single cast handler and separate chest copies keep independent charges',()=>{
 const saved={version:1,weapon:'equipWoodSword',potions:0,slots:Array(27).fill(null),
  kitchenChest:{version:1,slots:Array(18).fill(null)},mineGateCleared:true,mineTreasureChest:{version:1,slots:Array(18).fill(null)}};
 saved.slots[0]=cell('equipWoodSword');saved.slots[3]=cell(W,{charges:5});saved.slots[9]=cell(W,{charges:4});
 saved.kitchenChest.slots[0]=cell(W,{charges:2});saved.mineTreasureChest.slots[0]=cell(W,{charges:3});
 const f=fixture(saved), c=f.ctx, calls=[];
 c.poiPlayerCastFireWand=i=>{calls.push(i);return {ok:c.poiInventorySpendFireWand(i),reason:null}};
 c.poiHotbarUse(3);assert.equal(c.poiUseBagItem(0).ok,true);
 assert.deepEqual(calls,[3,9]);assert.equal(c.poiEquippedWeapon(),'equipWoodSword');
 assert.equal(c.poiInventorySnapshot().hotbar[3].charges,4);assert.equal(c.poiInventorySnapshot().bag[0].charges,3);
 assert.equal(f.raw().kitchenChest.slots[0].charges,2);assert.equal(f.raw().mineTreasureChest.slots[0].charges,3);
 assert.equal(c.poiInventoryCellName(c.poiInventorySnapshot().hotbar[3]),'火の杖（4）');
});
