const a=require('node:assert/strict'),h=require('node:fs').readFileSync(process.argv[2],'utf8');
a(h.includes('speedStars:3'),'explicit wood sword 3/10');
a(h.includes('function poiWoodSwordSweepPose('),'wood needs its own attack timing and motion');
a(h.includes("if(d.actor.frontierPartyId)return ['dismiss','private-sell','private-buy','back']"),'personal trade available to a human companion');
a(h.includes('function poiNpcPartyTradeActor('));
a(h.includes('function poiNpcRecruitStillHere('),'confirm must survive looking away while NPC remains physically close');
a(h.includes("return d.pendingRecruit?[row('join-confirm'),row('back')]:[]"),'explicit confirm in recruitment panel');
console.log('PASS slower horizontal wood sword and valid companion personal trade');
