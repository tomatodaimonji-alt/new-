const a=require('node:assert/strict'),h=require('node:fs').readFileSync(process.argv[2],'utf8');
a(h.includes('function poiSleepingNpcDraw('),'sleeping NPC needs sleeping indicator');
a(h.includes("el.textContent='Zzz…'"));
a(h.includes("if(!visible.has(a)){el.remove();"));
a(h.includes('function poiNpcGreetingBlockedByLock('));
a(h.includes('function frontierFollowSpeed('));
console.log('PASS sleeping residents show Zzz and wake clears it');
