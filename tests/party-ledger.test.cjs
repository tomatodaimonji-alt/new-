const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(process.argv[2]||'ledger.js','utf8');
const run=s=>JSON.parse(vm.runInNewContext(`
const poiCompanionType=x=>['slimeSoul','orvasSoul','goblinSoul','skeletonSoul'].includes(x)?{hp:36,name:x+'の魂'}:null;
const poiCompanionNormalizeMode=x=>x==='follow'?'follow':x==='fight'?'fight':null;
const poiInventorySlots=k=>k.slots??[];
const poiHumanPartyMembers=k=>k.humanParty??[];
const notice=[]; const poiMessagePush=(...s)=>(notice.push(s),true);
`+source+`;JSON.stringify((()=>{${s}})())`));
test('v1 singleton migration retains HP source, pending and follow command',()=>{
 const x=run("const k={slots:[{type:'slimeSoul',durability:18}],companionSoul:{version:1,pending:'orvasSoul',active:'slimeSoul',mode:'follow'}};return {data:poiCompanionDecode(k.companionSoul),party:poiPartyMembers(k)}");
 assert.equal(x.data.pending,'orvasSoul');assert.deepEqual(x.data.members,[{id:'slimeSoul',mode:'follow'}]);assert.equal(x.party[0].hp,18);
});
test('three active monsters or mixed companions, with exact non-consuming denial message',()=>{
 const x=run(`const ids=['slimeSoul','orvasSoul','goblinSoul'];let k={slots:ids.map(type=>({type,durability:12})),humanParty:[{id:'h1',hp:18}]};const a=poiPartySoulWrite(k,ids.slice(0,2).map(id=>({id,mode:'fight'}))); const b=poiPartySoulWrite({...k,humanParty:[]},ids.map(id=>({id,mode:'fight'}))); return [poiPartyHasRoom(a),poiPartyHasRoom(b),poiPartyMembers(a).map(x=>x.id),poiPartyDenySummon(),notice]`);
 assert.deepEqual(x,[false,false,['slimeSoul','orvasSoul','h1'],{ok:false,reason:'party-full'},[['これ以上召喚できない。','notice']]]);
});
test('save decoder rejects duplicates/unowned entries; recall frees one slot without healing the held soul',()=>{
 const x=run(`const k={slots:[{type:'slimeSoul',durability:9},{type:'goblinSoul',durability:15}],companionSoul:{version:1,members:[{id:'slimeSoul'},{id:'slimeSoul'},{id:'unknown'},{id:'goblinSoul',mode:'follow'}]}};const p=poiPartySoulMembers(k);const next=poiPartySoulWrite(k,p.filter(m=>m.id!=='slimeSoul')); return [p,next.slots,poiPartySoulMembers(next),poiPartyHasRoom(next)]`);
 assert.equal(x[0].length,2);assert.equal(x[1][0].durability,9);assert.equal(x[2][0].id,'goblinSoul');assert.equal(x[2][0].mode,'follow');assert.equal(x[3],true);
});
