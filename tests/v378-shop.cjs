const a=require('node:assert/strict'),h=require('node:fs').readFileSync(process.argv[2],'utf8');
a(h.includes("id:'frontierStore',name:'道具屋'"),'convert the existing store');
a(h.includes("const POI_FRONTIER_SHOP_ID='frontiershopkeeper'"),'dedicated counter merchant');
a(h.includes("poiFrontierAtCounter(actor)"),'must require a real counter position');
a(!h.includes("[81,28,'monsterSlime',0],[87,34,'monsterSlime',2]"),'remove the old fixed pair');
a(h.includes("const FRONTIER_WILD_MAX=5"),'five simultaneous outdoor slimes');
a(h.includes("poiWildBeyondNotice(x,z,player,'monsterSlime')"));
console.log('PASS Frontier shop, authentic counter, randomized spawn scope');
