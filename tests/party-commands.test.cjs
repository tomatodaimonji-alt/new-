const fs=require('node:fs'),vm=require('node:vm'),a=require('node:assert/strict'),{test}=require('node:test');
const h=fs.readFileSync(process.argv[2]||'world-editor.html','utf8');
const cut=(x,y)=>h.slice(h.indexOf(x),h.indexOf(y,h.indexOf(x)+x.length));
const code=[
 cut('const POI_COMPANION_SPEC=','let poiCompanionFlight='),
 cut('function poiCompanionType','function poiCompanionReconcile'),
 cut('const POI_COMPANION_MODES=','function poiCompanionTethered'),
 cut('function poiCompanionUse','function poiCompanionNormal')
].join('\n');
const mock=`
const poiCompanionAllowed=()=>true;
const poiInventorySlots=k=>k.slots;
const poiHumanPartyMembers=k=>k.humanParty??[];
let kit={slots:['slimeSoul','goblinSoul','skeletonSoul','orvasSoul'].map(type=>({type,count:1,durability:12}))},
 notices=[],fx=[],writes=0,partyHealth=[];
const poiHotbarRead=()=>kit,poiEconomyWrite=k=>{kit=k;writes++;return true},poiEconomyRefresh=()=>undefined;
const poiMessagePush=(...args)=>(notices.push(args),true);
const poiPartyWith=(id,fn)=>{const last=poiCompanionActor;poiCompanionActor={id,next:0};try{return fn()}finally{poiCompanionActor=last}};
const poiCompanionSummonIntent=(...args)=>fx.push(['summon',...args]);
const poiCompanionRecallDetach=(a,now,reason)=>fx.push(['recall',a.id,now,reason]);
let poiCompanionActor=null,poiCompanionTarget=null;const performance={now:()=>2112};
`;
const run=s=>JSON.parse(vm.runInNewContext(mock+code+';JSON.stringify((()=>{'+s+'})())'));
test('production summon commands keep all live IDs; both entry paths reject #4 transactionally',()=>{
 const r=run(`[0,1,2].forEach(i=>poiCompanionUse(kit,i));
 const saved=kit, w=writes; const first=poiCompanionCommand('summon',3,'orvasSoul');
 const second=poiCompanionUse(kit,3); return {party:poiPartyMembers(kit),first,second,unchanged:kit===saved,writes,w,notices,fx}`);
 a.deepEqual(r.party.map(x=>x.id),['slimeSoul','goblinSoul','skeletonSoul']);
 a.equal(r.w,3);a.equal(r.writes,3);a.equal(r.unchanged,true);a.equal(r.first.reason,'party-full');a.equal(r.second.reason,'party-full');
 a.deepEqual(r.notices,[['これ以上召喚できない。','notice'],['これ以上召喚できない。','notice']]);a.equal(r.fx.length,3);
});
test('actual shared limit counts a human; independent modes and recall preserve durability',()=>{
 const r=run(`kit.humanParty=[{id:'human:k',kind:'human',hp:20,mode:'follow'}];[0,1].forEach(i=>poiCompanionUse(kit,i));
 const blocked=poiCompanionUse(kit,2);
 poiCompanionCommand('follow',3,'goblinSoul');const before=poiPartyMembers(kit);
 const remove=poiCompanionUse(kit,0);const add=poiCompanionUse(kit,2);return {blocked,before,remove,add,after:poiPartyMembers(kit),inventory:kit.slots,fx}`);
 a.equal(r.blocked.reason,'party-full');a.equal(r.before[0].mode,'fight');a.equal(r.before[1].mode,'follow');a(r.remove.ok&&r.add.ok);
 a.deepEqual(r.after.map(x=>x.id),['goblinSoul','skeletonSoul','human:k']);a.equal(r.inventory[0].durability,12);
 a.deepEqual(r.fx[2],['recall','slimeSoul',2112,'manual']);
});
