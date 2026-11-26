const a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.argv[2],'utf8');
const block=h.match(/\/\/ BEGIN FRONTIER RUINS TORCHES\n([\s\S]*?)\/\/ END FRONTIER RUINS TORCHES/);
const grid=h.slice(h.indexOf('const FRONTIER_RUINS=(()=>{'),h.indexOf('function frontierRuinsGeometry(){'));
const ctx={frontierBurrowFloor:()=>-5};vm.runInNewContext(grid+block[1]+'\nthis.data={FRONTIER_RUINS_TORCHES,FRONTIER_RUINS};',ctx);
const {FRONTIER_RUINS_TORCHES:list,FRONTIER_RUINS:{cells}}=ctx.data;
const candles=list.filter(v=>v.kind==='candle');a.equal(candles.length,13);
for(const t of candles){
 a(t.wall,'floor candles must become wall sconces');
 const [x,z]=t.wall;
 a(cells.has(Math.floor(t.x)+','+Math.floor(t.z)),'candle must remain in walkable room');
 a(Math.abs(Math.floor(t.x)-Math.floor(x+(x-t.x)*.08))+Math.abs(Math.floor(t.z)-Math.floor(z+(z-t.z)*.08))===1,'mount crosses a cardinal wall');
 a(!cells.has(Math.floor(x+(x-t.x)*.08)+','+Math.floor(z+(z-t.z)*.08)),'there must be a wall behind the bracket');
 a(t.y>=-3.5&&Math.hypot(x-t.x,z-t.z)<.34);
}
for(const m of h.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
console.log('PASS 13 elevated sconces mounted on real ruin walls; game script syntax');
