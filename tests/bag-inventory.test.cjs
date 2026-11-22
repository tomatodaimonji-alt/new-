const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function fixture(saved=null){
 let failure=false,raw=saved&&JSON.stringify(saved),writes=0;
 const ctx={facilitySite:{id:'base'},poiWalkActive:true,pineAIActive:false,poiWalkX:4,poiWalkZ:5,poiWalkLevel:0,poiWalkFacing:0,world:[],
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
 assert.equal(s.hotbar.length,8);assert.equal(s.bag.length,40);assert.equal(s.bagUnlocked,16);
 assert.equal(s.hotbar[0].type,'equipWoodSword');assert.equal(s.hotbar[1],null);assert.equal(f.writes(),0);
 assert.equal(f.ctx.poiInventoryMove(0,spot('bag',16)).ok,false);assert.equal(f.writes(),0);
 f.fail(true);assert.equal(f.ctx.poiInventoryMove(0,spot('bag',1)).ok,false);assert.equal(f.ctx.poiInventorySnapshot().weapon,'equipWoodSword');
 f.fail(false);assert.equal(f.ctx.poiInventoryMove(0,spot('bag',1)).ok,true);assert.equal(f.writes(),1);
 assert.deepEqual([f.raw().gold,f.raw().claimedCaches[0],f.raw().weapon],[30,'glade',null]);
 s=fixture(f.raw()).ctx.poiInventorySnapshot();assert.equal(s.bag[1].type,'equipWoodSword');assert.equal(s.hotbar[0],null);
});
test('hotbar fills before bag, never exceeds nine per stack, and permits physical bag drop and pickup',()=>{
 const slots=Array.from({length:24},(_,i)=>i===0?{type:'equipWoodSword',count:1}:i<8?{type:'healingHerb',count:9}:null);
 const f=fixture({version:1,weapon:null,potions:9,gold:12,slots});
 assert.equal(f.ctx.poiEconomyBuyPotion().ok,true);assert.equal(f.ctx.poiInventorySnapshot().bag[0].count,1);
 assert.equal(f.ctx.poiInventoryDrop(spot('bag',0)).ok,true);assert.equal(f.ctx.poiInventorySnapshot().bag[0],null);
 assert.equal(f.ctx.poiInventoryPickup(4,4),true);assert.equal(f.ctx.poiInventorySnapshot().bag[0].count,1);
 assert.equal(f.ctx.poiInventoryMove(spot('bag',0),spot('hotbar',7)).ok,true);
 assert.equal(f.ctx.poiInventorySnapshot().bag[0].count,9);assert.equal(f.ctx.poiInventorySnapshot().hotbar[7].count,1);
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
test('maximum 24-cell stash reloads exactly; full ground pickup and full shop touch nothing',()=>{
 const slots=Array.from({length:24},()=>({type:'healingHerb',count:9}));
 const original={version:1,weapon:null,potions:9,gold:12,sword:false,slots,drops:[
  {type:'equipWoodSword',x:4,z:4,y:0},{type:'healingHerb',x:4,z:3,y:0,count:2}]};
 const f=fixture(original),s=f.ctx.poiInventorySnapshot();
 assert.equal(s.potions,216);assert.equal(s.bag.slice(0,16).every(c=>c.count===9),true);assert.equal(s.bag.slice(16).every(c=>c===null),true);
 assert.equal(f.ctx.poiInventoryPickup(4,4),false);assert.equal(f.ctx.poiInventoryPickup(4,3),false);
 assert.equal(f.ctx.poiEconomyBuyPotion().reason,'full');assert.equal(f.writes(),0);assert.deepEqual(f.raw(),original);
 assert.equal(f.ctx.poiInventoryDrop(spot('bag',15)).reason,'full');assert.equal(f.writes(),0);
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
