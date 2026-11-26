const a=require('node:assert/strict'),h=require('node:fs').readFileSync(process.argv[2],'utf8');
a(h.includes("dismiss:'仲間から外す'"),'party NPC should have dismissal action');
a(h.includes('function frontierPartyTalkTarget('),'party NPC talks through ordinary action');
a(h.includes('for(const a of frontierPartyTalkActors())'),'party NPC body collision');
a(h.includes('pending.where'),'handoff uses actual nearby position when legal');
console.log('PASS talk, collision and dismissal handoff are present');
