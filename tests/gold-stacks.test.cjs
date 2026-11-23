const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function setup(raw={version:1,weapon:null,potions:3,gold:21}){
 const a=html.indexOf('const POI_HOTBAR_KEY='),b=html.indexOf('function poiHotbarSwordIcon(',a);
 let mem=JSON.stringify(raw),fail=false;
 const x={MAX_MAP:128,facilitySite:{id:'base'},poiWalkActive:true,pineAIActive:false,poiWalkLevel:0,poiWalkX:3,poiWalkZ:4,poiWalkFacing:1,
  poiWalkCanStep:()=>true,poiHotbarRender(){},poiWalkAvatar(){},poiShopIsOpen:()=>false,toast(){},poiSound(){},poiMessagePush:()=>true,
  isFloor:t=>t==='river',world:[],localStorage:{getItem:()=>mem,setItem(_k,v){if(fail)throw Error('disk');mem=v}}};
 vm.createContext(x);vm.runInContext(html.slice(a,b),x);
 return {x,save:()=>JSON.parse(mem),fail:v=>{fail=v}};
}
const wallet={zone:'wallet'},copy=a=>JSON.parse(JSON.stringify(a));
function stackRef(p){return p.slot<9?{zone:'hotbar',index:p.slot}:{zone:'bag',index:p.slot-9}}
test('legacy wallet splits a real separate cell without changing total or legacy slot encoding, and reload retains it',()=>{
 const h=setup();const result=h.x.poiSplitGoldStack(wallet);
 assert(result.ok);assert.equal(h.save().gold,21);assert.equal(h.x.poiWalletGold(h.x.poiHotbarRead()),11);
 const [split]=h.save().goldStacks;assert.equal(split.amount,10);assert(!h.save().slots?.some(c=>c?.type==='gold'));
 const re=setup(h.save());assert.deepEqual(copy(re.x.poiInventoryCell(re.x.poiHotbarRead(),stackRef(split))),{type:'gold',count:10});
 assert.equal(re.x.poiWalletGold(re.x.poiHotbarRead()),11);
});
test('drop consumes exactly selected stack, never all-wallet, only after successful one-write placement',()=>{
 const h=setup();assert(h.x.poiSplitGoldStack(wallet).ok);
 const before=h.save(),ref=stackRef(before.goldStacks[0]);
 h.fail(true);assert.equal(h.x.poiDropGoldStack(ref).reason,'storage');assert.deepEqual(h.save(),before);
 h.fail(false);assert(h.x.poiDropGoldStack(ref).ok);assert.equal(h.save().gold,11);
 assert.equal(h.save().groundGold[0].amount,10);assert(!h.save().goldStacks);
 assert(h.x.poiGroundGoldPickup(4,4));assert.equal(h.save().gold,21);
});
test('primary drop leaves split stack intact; spending uses total and trims only when wallet is exhausted',()=>{
 const h=setup();assert(h.x.poiSplitGoldStack(wallet).ok);
 assert(h.x.poiEconomyWrite({...h.x.poiHotbarRead(),gold:13}));
 assert.equal(h.x.poiWalletGold(h.x.poiHotbarRead()),3);assert.equal(h.save().goldStacks[0].amount,10);
 assert(h.x.poiDropGoldStack(wallet).ok);assert.equal(h.save().gold,10);assert.equal(h.save().groundGold[0].amount,3);
 assert(h.x.poiEconomyWrite({...h.x.poiHotbarRead(),gold:4}));assert.equal(h.x.poiWalletGold(h.x.poiHotbarRead()),0);
 assert.equal(h.save().goldStacks[0].amount,4);
});
test('single coin and full inventory cannot split, and malformed reservations cannot erase ordinary items or duplicate funds',()=>{
 const a=setup({version:1,weapon:null,potions:3,gold:1});assert.equal(a.x.poiSplitGoldStack(wallet).reason,'single');assert.equal(a.save().gold,1);
 const slots=Array(27).fill(null);slots[0]={type:'equipWoodSword',count:1};
 for(let i=1;i<18;i++)slots[i]={type:'healingHerb',count:1};
 const b=setup({version:1,weapon:'equipWoodSword',potions:9,gold:21,slots});
 assert.equal(b.x.poiSplitGoldStack(wallet).reason,'full');
 const c=setup({version:1,weapon:'equipWoodSword',potions:3,gold:21,goldStacks:[{slot:0,amount:10},{slot:13,amount:25},{slot:30,amount:6}]});
 assert.equal(c.x.poiInventoryCell(c.x.poiHotbarRead(),0).type,'equipWoodSword');
 assert(c.x.poiWalletGold(c.x.poiHotbarRead())>=0);
 assert.equal(c.x.poiEconomyGold(),21);
});
test('last unlocked bag cell receives a visible split and follows later item relocations without loss',()=>{
 const slots=Array(27).fill(null);slots[0]={type:'equipWoodSword',count:1};
 for(let i=9;i<=16;i++)slots[i]={type:'healingHerb',count:1};
 const h=setup({version:1,weapon:'equipWoodSword',potions:8,gold:21,slots});
 assert(h.x.poiSplitGoldStack(wallet).ok);
 assert.deepEqual(h.save().goldStacks,[{slot:17,amount:10}]);
 const snap=copy(h.x.poiInventorySnapshot());
 assert.equal(snap.bagUnlocked,9);assert.deepEqual(snap.bag[8],{type:'gold',count:10});
 assert(h.x.poiInventoryMove({zone:'bag',index:8},{zone:'hotbar',index:7}).ok);
 assert.deepEqual(h.save().goldStacks,[{slot:7,amount:10}]);assert.equal(h.save().gold,21);
 assert(h.x.poiInventoryMove({zone:'hotbar',index:0},{zone:'bag',index:8}).ok);
 const re=setup(h.save());
 assert.deepEqual(copy(re.x.poiInventorySnapshot().hotbar[7]),{type:'gold',count:10});
 assert.equal(re.x.poiInventorySnapshot().bag[8].type,'equipWoodSword');
});
test('coin details are split/back only and unrelated item actions remain unchanged',()=>{
 const start=html.indexOf('function poiItemDetailActions('),end=html.indexOf('function poiItemDetailDescription(',start);
 const c={poiInventoryStack:()=>9,poiHotbarWeaponForType:()=>false};
 const actions=vm.runInNewContext(html.slice(start,end)+';poiItemDetailActions;',c);
 assert.deepEqual([...actions('wallet',{type:'gold',count:9},true,true)],['split','back']);
 assert.deepEqual([...actions('hotbar',{type:'gold',count:1},true,true)],['back']);
 assert.deepEqual([...actions('bag',{type:'gold',count:9},true,false)],['back']);
 assert.deepEqual([...actions('bag',{type:'healingHerb',count:3},true,true)],['transfer','split','use','drop','back']);
});
test('real shop purchases continue to use the full balance and preserve split stacks until needed',()=>{
 const h=setup();assert(h.x.poiSplitGoldStack(wallet).ok);
 assert(h.x.poiEconomyBuyPotion().ok);
 assert.equal(h.save().gold,15);assert.equal(h.save().goldStacks[0].amount,10);assert.equal(h.x.poiWalletGold(h.x.poiHotbarRead()),5);
 const after=h.save();
 h.fail(true);assert.equal(h.x.poiEconomyBuyPotion().reason,'storage');assert.deepEqual(h.save(),after);
 h.fail(false);assert(h.x.poiEconomyBuyPotion().ok);
 assert.equal(h.save().gold,9);assert.equal(h.save().goldStacks[0].amount,9);assert.equal(h.x.poiWalletGold(h.x.poiHotbarRead()),0);
 assert.equal(h.save().potions,5);
});
