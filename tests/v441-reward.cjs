const fs=require('node:fs'),vm=require('node:vm'),a=require('node:assert/strict');const h=fs.readFileSync(process.argv[2]||'candidate.html','utf8');
for(const m of h.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
const fn=n=>{const m=h.match(new RegExp('^function '+n+'\\([^]*?^}','m'));a.ok(m,n);return m[0]};
const c=vm.createContext({poiWalkActive:true,pineAIActive:false,facilitySite:{id:'frontier'},poiWalkLevel:-1,
 poiWalkX:160,poiWalkZ:125,poiWalkFacing:2,poiPlayerRayClear:()=>true,poiMonsterAt:()=>false,
 poiHotbarRead:()=>c.kit,poiEconomyWrite:k=>{c.kit=k;return true},poiInventoryOrdinarySlots:k=>k.slots||[],
 poiAnyChestHas:()=>false,poiEquipmentDurabilityMax:()=>210,poiChestDecode:x=>x,
 frontierSouthBossDefeated:()=>c.dead,dead:false,kit:{},POI_CHEST_SIZE:10,POI_INVENTORY_LIMIT:230,POI_RECOVERY_POTION:'cannedFood',
 frontierSouthRuinsOwn:()=>true});
const declarations=h.match(/const FRONTIER_SOUTH_TREASURE[\s\S]+?\nfunction frontierSouthChestAt/);
a.ok(declarations,'authored reward positions');
vm.runInContext(declarations[0].replace(/function frontierSouthChestAt$/,'')+['frontierSouthChestAt','frontierRuinsFacesChest','frontierSouthChestReachable','frontierSouthRewardInit','frontierSouthStockLoot'].map(fn).join('\n'),c);
a.equal(c.frontierSouthChestReachable(),false);a.equal(c.frontierSouthRewardInit(),false);
c.dead=true;a.equal(c.frontierSouthChestReachable(),true);
a.ok(c.frontierSouthRewardInit());
const chest=c.kit.frontierSouthChest,items=chest.slots.filter(Boolean);
a.ok(items.some(i=>i.type==='equipMithrilSword'&&i.durability===210));
a.ok(items.some(i=>i.type==='armorGaldShoes'));
chest.slots[0]=null;c.frontierSouthRewardInit();a.equal(c.kit.frontierSouthChest.slots[0],null);
a.ok(c.frontierSouthStockLoot());a.equal(c.kit.drops.length,3);a.ok(c.kit.drops.every(i=>i.y===-1));a.ok(c.kit.groundGold[0].amount>0);
c.kit.drops=[];c.frontierSouthStockLoot();a.equal(c.kit.drops.length,0,'no respawn after pickup');
c.poiWalkLevel=0;a.equal(c.frontierSouthChestReachable(),false);
console.log('PASS side loot placed once, south B1 boss lock, permanent B-tier chest contents and no respawn');
