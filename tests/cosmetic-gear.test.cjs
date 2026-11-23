const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const h=fs.readFileSync(process.env.HTML||path.join(__dirname,'..','world-editor.html'),'utf8');
function setup(initial=null){
 let raw=JSON.stringify(initial),failed=false,writes=0,avatars=0;
 const c=vm.createContext({MAX_MAP:128,facilitySite:{id:'base'},poiWalkActive:true,pineAIActive:false,poiWalkLevel:0,poiWalkFacing:0,poiWalkX:4,poiWalkZ:5,
  POI_PLAYER_ATTACK:20,poiWalkCanStep:()=>true,world:[],isFloor:()=>true,$:()=>null,document:{querySelectorAll:()=>[]},
  poiWalkAvatar(){avatars++},toast(){},localStorage:{getItem:()=>raw,setItem(_k,v){if(failed)throw Error('quota');raw=v;writes++}}});
 const a=h.indexOf('const POI_HOTBAR_KEY='),b=h.indexOf('function poiResetCombat(',a);vm.runInContext(h.slice(a,b),c);
 return {c,fail:v=>failed=v,raw:()=>JSON.parse(raw),writes:()=>writes,avatars:()=>avatars};
}
test('old sessions wear four only-visual starter pieces without spending bag slots or saving',()=>{
 const old={version:1,weapon:'equipWoodSword',potions:3,gold:21,claimedCaches:['glade']},f=setup(old);
 assert.equal(typeof f.c.poiArmorSnapshot,'function');const w=f.c.poiArmorSnapshot();
 assert.deepEqual(Object.keys(w),['head','torso','legs','feet']);
 assert.deepEqual(Object.values(w).map(s=>s.type),['starterCap','starterTunic','starterTrousers','starterBoots']);
 assert.equal(f.c.poiInventorySnapshot().bag.filter(Boolean).length,0);assert.equal(f.c.poiPlayerAttackDamage(),28);
 assert.equal(f.writes(),0);assert.deepEqual(f.raw(),old);
});
test('exact unequip/re-equip persists, cannot put armor in shortcut, and failed write rolls back',()=>{
 const f=setup(),{c}=f;
 f.fail(true);assert.equal(c.poiUnequipArmor('head').reason,'storage');
 assert.equal(c.poiArmorSnapshot().head.type,'starterCap');assert.equal(f.avatars(),0);
 f.fail(false);assert.equal(c.poiUnequipArmor('head').ok,true);
 assert.equal(c.poiArmorSnapshot().head,null);assert.equal(c.poiInventorySnapshot().bag[0].type,'starterCap');
 assert.equal(c.poiInventoryMove({zone:'bag',index:0},2).reason,'type');
 assert.equal(c.poiMoveArmorSlot({zone:'bag',index:0},{zone:'armor',part:'feet'}).reason,'type');
 const g=setup(f.raw());assert.equal(g.c.poiArmorSnapshot().head,null);
 assert.equal(g.c.poiEquipArmorFromBag(0).ok,true);
 assert.equal(g.c.poiArmorSnapshot().head.type,'starterCap');assert.equal(g.c.poiInventorySnapshot().bag[0],null);
});
test('full bag retains equipped items and dropped gear stays single and reloadable',()=>{
 const f=setup(),{c}=f;const kit=c.poiHotbarRead(),slots=Array(27).fill(null);
 slots[0]={type:'equipWoodSword',count:1};slots[1]={type:'healingHerb',count:3};
 for(let i=9;i<27;i++)slots[i]={type:'healingHerb',count:1};
 c.poiEconomyWrite(c.poiInventoryEdited(kit,slots));const save=f.raw();
 assert.equal(c.poiUnequipArmor('torso').reason,'full');assert.deepEqual(f.raw(),save);
 assert.equal(c.poiInventoryDrop({zone:'bag',index:0}).ok,true);
 assert.equal(c.poiUnequipArmor('torso').ok,true);
 c.poiWalkFacing=1;
 assert.equal(c.poiInventoryDrop({zone:'bag',index:0}).ok,true);
 const g=setup(f.raw());
 assert.equal(g.c.poiArmorSnapshot().torso,null);assert.equal(g.c.poiInventoryPickup(5,5),true);
 assert.equal(g.c.poiEquipArmorFromBag(0).ok,true);assert.equal(g.c.poiArmorSnapshot().torso.type,'starterTunic');
});
test('chest storage preserves removed armor, and malformed duplicate copies never appear',()=>{
 const f=setup(),{c}=f;c.poiKitchenChestReachable=()=>true;c.poiChestIsOpen=()=>true;
 assert.equal(c.poiOpenKitchenChest(()=>1),true);assert.equal(c.poiUnequipArmor('feet').ok,true);
 assert.equal(c.poiQuickTransferStorage('bag',0).ok,true);
 const raw=f.raw();assert.equal(raw.kitchenChest.slots[1].type,'starterBoots');assert.equal(raw.worn.feet,null);
 const g=setup(raw);assert.equal(g.c.poiArmorSnapshot().feet,null);assert.equal(g.c.poiChestSlotAt(1).type,'starterBoots');
 g.c.poiKitchenChestReachable=()=>true;g.c.poiChestIsOpen=()=>true;
 assert.equal(g.c.poiMoveChestInventorySlot('chest',1,'inventory',2).reason,'type');
 assert.equal(g.c.poiQuickTransferStorage('chest',1).ok,true);assert.equal(g.c.poiEquipArmorFromBag(0).ok,true);
 const dup=setup({...g.raw(),drops:[{type:'starterBoots',x:5,z:5,y:0,count:9}]});
 assert.equal(dup.c.poiArmorSnapshot().feet.type,'starterBoots');assert.equal(dup.c.poiInventorySnapshot().drops.length,0);
 assert.equal(dup.writes(),0);
 const reset=setup();assert.equal(reset.c.poiArmorSnapshot().feet.type,'starterBoots');assert.equal(reset.c.poiInventorySnapshot().bag.filter(Boolean).length,0);
});
