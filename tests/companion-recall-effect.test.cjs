const {test}=require('node:test'),a=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function cut(x,y){const i=h.indexOf(x),j=h.indexOf(y,i+1);a(i>=0&&j>i,x);return h.slice(i,j)}
test('the real last pose gradually dissolves, ages out, and does not track a moving player',()=>{
 const c=vm.createContext({POI_COMPANION_RECALL_MS:560});
 vm.runInContext(cut('function poiCompanionRecallFrame(','function poiCompanionRecallCancel('),c);
 const event={start:100,opacity:.72};const f=t=>c.poiCompanionRecallFrame(event,t);
 const s=f(100),l=f(360),e=f(610);
 a.equal(s.opacity,.72);a.equal(s.scale,1);a.equal(s.rise,0);
 a(l.opacity<s.opacity&&l.opacity>0);a(l.scale<s.scale&&l.scale>0);a(l.rise>0);
 a(e.spark>0&&e.scale<l.scale);a.equal(f(660),null);
});
test('durable manual return and committed player death own the visual start; ally zero remains shatter-only',()=>{
 const manual=cut('function poiCompanionUse(','function poiCompanionNormal(');
 a(manual.indexOf('poiEconomyWrite(next)')<manual.indexOf('poiCompanionRecallDetach('));
 const death=cut('function poiPlayerDeathBegin(','function poiPlayerDeathSnapshot(');
 a(death.indexOf('poiPlayerDeath={')<death.indexOf('poiCompanionPlayerDeathDetach('));
 const ally=cut('function poiCompanionHurt(','function poiCompanionEnemyContact(');
 a.doesNotMatch(ally,/poiCompanionRecallDetach\(/);a.match(ally,/poiMonsterBreak\(/);
});
test('death detaches the exact active actor, preserves durable roster, and replays once only after real relocation',()=>{
 const world=[],where={site:{},travel:1},a0={id:'orvasSoul'},slots=[{type:'orvasSoul',count:1,durability:317}],kit={slots,gold:7,companionSoul:{version:1,active:'orvasSoul',pending:'slimeSoul',mode:'fight'}};
 const detached=[],calls=[],death={relocated:false};
 const c=vm.createContext({world,poiPlayerDeath:death,poiPlayerDying:()=>c.poiPlayerDeath!==null,poiCompanionPlace:()=>where,
  poiHotbarHasKit:()=>true,poiHotbarRead:()=>kit,poiInventorySlots:k=>k.slots,poiCompanionActor:a0,poiCompanionSummonTicket:null,
  poiCompanionRecallDetach:(a,t,r)=>(detached.push([a.id,t,r]),true),poiCompanionSummonIntent:(...x)=>calls.push(x)});
 vm.runInContext(cut('let poiCompanionRejoinTicket=','function poiCompanionRecallTransform('),c);
 a.equal(c.poiCompanionPlayerDeathDetach(300),true);
 a.deepEqual(detached,[['orvasSoul',300,'player-death']]);a.equal(kit.slots[0].durability,317);a.equal(kit.companionSoul.active,'orvasSoul');
 a.equal(c.poiCompanionRecallRejoin(a0,340),false);a.equal(calls.length,0);
 death.relocated=true;death.blackAt=1800;c.poiPlayerDeath=null;
 a.equal(c.poiCompanionRecallRejoin(a0,1980),true);a.equal(c.poiCompanionRecallRejoin(a0,1990),false);
 a.deepEqual(calls,[['orvasSoul',1980]]);
});
