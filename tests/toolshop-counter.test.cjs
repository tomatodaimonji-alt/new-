const fs=require('node:fs'),vm=require('node:vm'),a=require('node:assert/strict'),{test}=require('node:test');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function cut(x,y){const i=h.indexOf(x),j=h.indexOf(y,i+1);if(i<0||j<0)throw Error('missing '+x);return h.slice(i,j)}
test('official live counter distinguishes the customer side; normal NPC menus and other sellers stay intact',()=>{
 const actor={role:{id:'toolkeeper',work:{x:71,z:35,y:0}},x:71,z:35,y:0,activity:'work'};
 const world=[{x:70,z:35,y:0,type:'counterLuxury',rot:1},{x:70,z:35,y:0,type:'poiLedgerPapers',rot:3}];
 const cx=vm.createContext({poiWalkX:69,poiWalkZ:35,poiWalkLevel:0,poiWalkFacing:1,poiWalkActive:true,pineAIActive:false,
  poiTownDialogue:null,facilitySite:{id:'base',townOffset:22},world,performance:{now:()=>100},
  poiTownNpcActive:()=>true,poiTownNpcActors:[actor],poiTownDialogueTarget:()=>actor,
  poiTownNpcGraph:()=>({cells:new Map([['70,35,0',world.map(o=>o.type)]])}),poiTownNpcKey:(x,z,y)=>[x,z,y].join(','),
  poiTownNpcStance:()=>true,poiMonsterStates:new Map(),isFloor:()=>false});
 vm.runInContext(cut('function poiShopCheckout(','function poiWalletSync(')+cut('const POI_NPC_MENU_LABELS=','function poiTownNpcStatus(')+
 cut('function poiTownCounterTalkReachable(','// BEGIN NPC LIVE TALK'),cx);
 const ids=(d,field='id')=>Array.from(cx.poiNpcMenuRows(d),r=>r[field]);
 a.equal(cx.poiNpcToolshopCounter(actor),true);
 a.deepEqual(ids({actor,page:'toolshop'},'label'),['買う','売る','戻る']);
 a.deepEqual(ids({actor,page:'root'}),['talk','status','request','back']);
 a.deepEqual(ids({actor,page:'request'}),['recruit','back']);
 a.deepEqual(ids({actor:{role:{id:'towncook'}},page:'request'}),['sell','buy','recruit','back']);
 for(const [obj,k,v] of [[cx,'poiWalkFacing',3],[cx,'poiWalkX',72],[cx,'poiWalkLevel',1],[actor,'activity','supply-return'],[actor,'z',36],[actor,'death',true],[world[0],'rot',0]]){
  const before=obj[k];obj[k]=v;a.equal(cx.poiNpcToolshopCounter(actor),false,k);obj[k]=before;
 }
 world.push({x:70,z:35,y:0,type:'stonewallPlain'});a.equal(cx.poiNpcToolshopCounter(actor),false);world.pop();
 const removed=world.pop();a.equal(cx.poiNpcToolshopCounter(actor),false);world.push(removed);
 const other={...actor};a.equal(cx.poiNpcToolshopCounter(other),false,'must be the actual live clerk');
 cx.poiTownDialogue={actor,toolshopCounter:true,page:'confirm',pending:{page:'sell',offer:{code:'healingHerb',sourceIndex:3}}};
 a.equal(cx.poiNpcTradeSessionMatches(actor,'sell','healingHerb',3),true);
 a.equal(cx.poiNpcTradeSessionMatches(actor,'sell','healingHerb',4),false);
 cx.poiWalkFacing=3;a.equal(cx.poiNpcTradeSessionMatches(actor,'sell','healingHerb',3),false,'stale transaction revoked');
});
