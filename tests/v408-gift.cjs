const vm=require('node:vm'),fs=require('node:fs'),a=require('node:assert/strict'),{test}=require('node:test');
const h=fs.readFileSync(process.argv[2]||'candidate.html','utf8');
const cut=(x,y)=>{let i=h.indexOf(x),j=h.indexOf(y,i+1);a(i>=0&&j>i,x);return h.slice(i,j)};
function boot(){
 const actor={role:{id:'frontiershopkeeper'},frontierPartyId:'human:frontiershopkeeper'},o={save:true,seen:true,calls:0};
 const kit={gold:99,goldStacks:[{slot:5,amount:10}],slots:[{type:'healingHerb',count:3},{type:'equipIronSword',count:1,durability:31}],
  frontierTrades:{frontiershopkeeper:{gold:0,cannedFood:0,healingHerb:2}}};o.kit=kit;
 const d={actor,page:'confirm',pending:{page:'sell',offer:{code:'healingHerb',sourceIndex:0}}};
 const c={poiTownDialogue:d,performance:{now:()=>100},poiTownDialogueTarget:()=>o.seen?actor:null,poiNpcTradeEligible:x=>x===actor,
  POI_NPC_TRADE_MAX_STOCK:9,POI_ECONOMY_GOLD_MAX:99,POI_NPC_TRADE_BASE_PRICES:{healingHerb:6,cannedFood:12},
  POI_FRONTIER_SHOP_ID:'frontiershopkeeper',POI_HOTBAR_SIZE:6,poiNpcTradeItems:()=>['healingHerb','cannedFood'],
  poiNpcTradeState:(k,x)=>({id:x.role.id,stock:k.frontierTrades[x.role.id],frontier:true}),
  poiHotbarRead:()=>o.kit,poiWalletGold:k=>k.gold,poiEconomyGold:()=>o.kit.gold,poiInventorySlots:k=>k.slots,
  frontierVendorStock:(k,id)=>k.frontierTrades[id],poiEquipmentPrice:()=>14,
  poiCompanionType:t=>t.endsWith('Soul'),poiInventoryStack:()=>5,poiFrontierAtCounter:()=>false,poiInventoryItemName:t=>t,
  frontierLifeRecord:k=>k.life??{items:[]},poiStorageIndexExists:(i,n)=>Number.isInteger(i)&&i>=0&&i<n,
  frontierLifeEdit:(k,_,life)=>({...k,life}),frontierLifeStock:(k,id,s)=>({...k,frontierTrades:{...k.frontierTrades,[id]:s}}),
  poiInventoryEdited:(k,slots)=>({...k,slots}),poiEconomyRefresh(){},poiEconomyWrite:k=>{if(!o.save)return false;o.calls++;o.kit=k;return true}};
 vm.createContext(c);vm.runInContext(cut('function poiNpcTradeOffer','const POI_MINE_REWARD_ID')+
  cut('function poiNpcTradeGiftAvailable','function poiValdiaGrocerRecoverPosition'),c);
 return {o,c,actor,d,select:(code,index)=>{d.pending.offer={code,sourceIndex:index};},gift:(code,index)=>c.poiNpcTradeTransaction(actor,'gift',code,index)};
}
test('gift one selected consumable despite both wallet limits, change neither wallet nor quick gold',()=>{
 const {o,c,actor,gift}=boot();
 a.equal(c.poiNpcTradeTransaction(actor,'sell','healingHerb',0).reason,'npc-funds');
 a.equal(gift('healingHerb',0).ok,true);
 a.deepEqual([o.kit.gold,o.kit.frontierTrades.frontiershopkeeper.gold,o.kit.slots[0].count,o.kit.frontierTrades.frontiershopkeeper.healingHerb],[99,0,2,3]);
 a.equal(o.kit.goldStacks[0].amount,10);
});
test('durable gear enters actual personal storage; capacity, wrong slot, lost session, counter and failed save block with no mutation',()=>{
 const {o,c,actor,d,select,gift}=boot();select('equipIronSword',1);
 for(const [reason,fn] of [['unavailable',()=>gift('equipIronSword',0)],['unavailable',()=>{d.toolshopCounter=true;return gift('equipIronSword',1)}],
  ['unavailable',()=>{d.toolshopCounter=false;o.seen=false;return gift('equipIronSword',1)}],
  ['stock',()=>{o.seen=true;o.kit.life={items:Array(9).fill({type:'equipIronSword'})};return gift('equipIronSword',1)}],
  ['storage',()=>{o.kit.life={items:[]};o.save=false;return gift('equipIronSword',1)}]]){
  a.equal(fn().reason,reason);a.equal(o.kit.slots[1].durability,31);a.equal(o.calls,0);
 }
 o.save=true;a.equal(gift('equipIronSword',1).ok,true);
 a.equal(o.kit.slots[1],null);a.equal(o.kit.life.items[0].durability,31);
 a.equal(gift('equipIronSword',1).ok,false);a.equal(o.calls,1);
});
test('selected player item detail has explicit gift beside unchanged Sell, gift checks the same pending slot',()=>{
 const {c,d}=boot();a(c.poiNpcTradeGiftAvailable(d));d.toolshopCounter=true;a(!c.poiNpcTradeGiftAvailable(d));
 a.match(cut('function poiNpcTradeDetail','function poiNpcTradePanelSync'),/poiNpcTradeButton\('gift','タダで渡す'\)/);
 a.match(cut('function poiNpcMenuChoose','function poiTownDialogueMovingTarget'),/poiNpcTradeTransaction\(d.actor,'gift',offer.code,offer.sourceIndex\)/);
});
