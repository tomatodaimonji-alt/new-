const fs=require('node:fs'),vm=require('node:vm'),a=require('node:assert/strict');
const s=fs.readFileSync(process.argv[2],'utf8'),cut=(a,b)=>s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)+1));
const current={weapon:'equipIronSword',worn:{torso:null},slots:[{type:'starterTunic',count:1,durability:31},{type:'equipIronSword',count:1}]};
const c={facilitySite:{id:'frontier'},POI_STARTER_ARMOR:{torso:'starterTunic'},POI_FRESH_ARMOR:{torso:null},FRONTIER_FITTED_GEAR:{torso:'starterTunic'},POI_HOTBAR_SIZE:2,POI_BAG_UNLOCKED:1,POI_BAG_SAVED:1,
 poiInventoryAllowed:()=>true,poiStorageIndexExists:(i,n)=>i>=0&&i<n,poiHotbarRead:()=>current,poiInventorySlots:k=>k.slots,poiArmorWorn:k=>k.worn,
 poiArmorCategory:t=>t==='starterTunic'?'torso':null,poiArmorCell:(type,durability)=>type?{type,count:1,durability}:null,poiGoldHotbarSlot:()=>null,
 poiStorageActionResult:(reason=null)=>({ok:!reason,reason}),poiWornDurabilityDecode:o=>o.torso?{torso:o.torso}:null,
 poiEconomyWrite:n=>{Object.assign(current,n);if(!n.wornDurability)delete current.wornDurability;return true},poiInventoryEdited:(k,slots)=>({...k,slots}),
 poiEconomyRefresh:()=>{},poiWalkAvatar:()=>{},poiHotbarWeaponForType:t=>t==='equipIronSword'?t:null};
vm.runInNewContext(cut('function poiMoveArmorSlot(','function poiEquipArmorFromBag(')+cut('function poiEquipHotbarItem(','function poiUseHotbarItem('),c);
a(c.poiEquipHotbarItem(0).ok);a.equal(current.worn.torso,'starterTunic');a.equal(current.slots[0],null);a.equal(current.wornDurability.torso,31);a.equal(current.weapon,'equipIronSword');
a(c.poiMoveArmorSlot({zone:'armor',part:'torso'},{zone:'hotbar',index:0}).ok);
a.equal(current.worn.torso,null);a.equal(current.slots[0].durability,31);
a.equal(c.poiMoveArmorSlot({zone:'armor',part:'torso'},{zone:'hotbar',index:1}).ok,false);
a(!cut('function poiArmorReconcile(','function poiMoveArmorSlot(').includes('hot||'));
for(const m of s.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
console.log('PASS quick equip and return preserve armor durability and equipped weapon; hotbar armor survives reconciliation');
