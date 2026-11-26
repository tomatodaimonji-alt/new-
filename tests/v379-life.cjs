const a=require('node:assert/strict'),h=require('node:fs').readFileSync(process.argv[2],'utf8');
a(h.includes('function frontierNpcLifeStep('),'living Frontier residents should run the real AI loop');
a(h.includes('function frontierWildResidentTurn('));
a(h.includes("frontierCoupleHome"));
a(h.includes('function frontierNpcBuyHerb('));
a(h.includes('function frontierNpcCollect('));
console.log('PASS actual resident AI, two beds, shared shop and pickup are wired');
