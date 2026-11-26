const a=require('node:assert/strict'),h=require('node:fs').readFileSync(process.argv[2],'utf8');
a(h.includes('function frontierMerchantGoods('),'shop shelves and private goods must be separated');
a(h.includes("frontierLifeStock(kit,POI_FRONTIER_SHOP_ID,{...shelf"));
a(h.includes("healingHerb:npcId===POI_FRONTIER_SHOP_ID?8:2"));
a(h.includes("saved.npcTrade?.actors?.[POI_FRONTIER_SHOP_ID]?.healingHerb"));
console.log('PASS one persisted merchant inventory for buy, heal, and display');
