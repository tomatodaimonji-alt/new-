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
const staff=[['equipPlainStaff','ただの杖',80],['equipLongStaff','長い杖',65]];
test('both staves are real nonstacking equipments with distinct caps and sustained weapon state through reload',()=>{
 for(const [type,name,max] of staff){
  const f=fixture(),c=f.ctx;
  assert.equal(c.poiInventoryItemName(type),name);
  assert.equal(c.poiEquipmentDurabilityMax(type),max);
  assert.equal(c.poiHotbarWeaponForType(type),type);
  assert.equal(c.poiInventoryStack(type),1);
  assert.equal(c.poiInventorySanitizeCell({type,count:1,durability:max+1}),null);
  assert.equal(c.poiInventorySanitizeCell({type,count:1,durability:max}).durability,max);
  const k=c.poiHotbarRead(),item={type,count:1,durability:max-1};
  const {slots,accepted}=c.poiInventoryAccept(k,type,1,item);
  assert.equal(accepted,1);assert(c.poiEconomyWrite(c.poiInventoryEdited(k,slots)));
  const index=c.poiInventorySnapshot().hotbar.findIndex(c=>c?.type===type);
  c.poiHotbarUse(index);assert.equal(c.poiEquippedWeapon(),type);
  assert(c.poiEquipmentSpendWeapon(type));
  const reloaded=fixture(f.raw()).ctx;
  assert.equal(reloaded.poiEquippedWeapon(),type);
  assert.equal(reloaded.poiInventorySnapshot().hotbar[index].durability,max-2);
 }
});
test('staff condition travels through bag, a physical grounded item, and a dungeon chest without scaling or repairing',()=>{
 const type='equipLongStaff',item={type,count:1,durability:6};
 const cells=Array(27).fill(null);cells[0]={type:'equipWoodSword',count:1};cells[9]=item;
 const chest=Array(18).fill(null);chest[0]={type:'equipPlainStaff',count:1,durability:17};
 const f=fixture({version:1,weapon:null,potions:0,slots:cells,mineGateCleared:true,mineTreasureChest:{version:1,slots:chest}}),c=f.ctx;
 assert.equal(c.poiInventorySnapshot().bag[0].durability,6);
 assert.equal(c.poiHotbarRead().mineTreasureChest.slots[0].durability,17);
 assert.equal(f.writes(),0);
 assert(c.poiInventoryDrop({zone:'bag',index:0}).ok);
 const d=f.raw().drops[0];assert.equal(d.durability,6);
 const g=fixture(f.raw()).ctx;assert(g.poiInventoryPickup(d.x,d.z));
 assert.equal(g.poiInventorySnapshot().hotbar.find(c=>c?.type===type).durability,6);
 assert.equal(g.poiHotbarRead().mineTreasureChest.slots[0].durability,17);
});
