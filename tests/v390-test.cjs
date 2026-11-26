const a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),h=fs.readFileSync(process.argv[2]||'candidate.html','utf8');
for(const m of h.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
a(h.includes("frontiershopkeeper:'equipBallpointPen'"),'Mina should hold a pen in both party and town');
a(!h.includes('if(!weapon)return null;\n if(typeof poiPlayerAttackDamage'),'unarmed damage must not be null');
a(/equipBallpointPen:\{range:1,reachStars:1,speedStars:10,/.test(h),'actual displayed stars must be one and ten');
a(h.includes('const POI_FIST_PROFILE=Object.freeze({range:1,hit:135,ready:475,pose:385,'),'the slower fist should use explicit windup, contact and cooldown');
console.log('PASS Mina has pen, finite attack, specified stars, and slower timed fist');
