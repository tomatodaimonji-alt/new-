const a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.argv[2],'utf8');
a(h.includes('const WORKSHOP_AUTOSAVE_MS=1000;'));
const s=h.match(/\/\/ BEGIN FRONTIER RUINS DEFEAT LEDGER\n([\s\S]*?)\/\/ END FRONTIER RUINS DEFEAT LEDGER/);
a(s);
let saved={gold:8};let writes=0;
const context={
 facilitySite:{id:'frontier'},FRONTIER_RUINS:{MOBS:[{x:1,z:1},{x:2,z:2}],ARENA_MOBS:[{x:2,z:2,type:'monsterGoblin'},{x:4,z:4,type:'monsterSlime'}]},
 frontierRuinsArenaAt:(x,z)=>x===2&&z===2,poiHotbarRead:()=>saved,poiEconomyWrite:v=>{saved=v;writes++;return true}
};
vm.runInNewContext(s[1]+'\nthis.api={frontierRuinsDefeatKey,frontierRuinsDefeatsDecode,frontierRuinsRememberMob};',context);
const x=context.api,o={x:1,z:1,y:0,type:'monsterSlime'};
a(x.frontierRuinsRememberMob(o,{hp:0}));a(!x.frontierRuinsRememberMob(o,{hp:0}));
a(!x.frontierRuinsRememberMob({...o,type:'monsterGoblin'},{hp:0}));
a(!x.frontierRuinsRememberMob({...o,x:4,z:4},{hp:1}));
a.equal(writes,1);a.equal(saved.gold,8);
a.equal(Array.from(x.frontierRuinsDefeatsDecode([...saved.frontierRuinsDefeats,'fake',...saved.frontierRuinsDefeats])).join(),x.frontierRuinsDefeatKey(o));
for(const m of h.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
console.log('PASS 1s save gate and bounded durable fixed-spawn ledger');
