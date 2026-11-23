const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function fixture(){
 const actor={role:{id:'toolkeeper',role:'keeper',name:'道具屋',work:{x:5,z:3,y:0}},x:5,z:3,y:0,activity:'work'};
 const spoke=[],ended=[],trades=[],c=vm.createContext({$:()=>null,performance:{now:()=>100},poiTownNpcActive:()=>true,
  poiTownNpcActors:[actor],poiWalkX:5,poiWalkZ:5,poiWalkLevel:0,poiWalkFacing:0,poiMonsterStates:new Map(),
  world:[{x:5,z:4,y:0,type:'counterLuxury',rot:0}],
  poiTownNpcKey:(x,z,y)=>[x,z,y].join(','),poiTownNpcGraph:()=>({cells:new Map([['5,4,0',['counterLuxury']]])}),poiTownNpcStance:()=>true,poiTownNpcNextTile:()=>({y:0}),poiShopSync(){},
  poiTownNpcFace(a,f){a.facing=f},poiShopCheckout:()=>true,poiTownPlayerService:()=>null,
  poiMessageSpeak:(...a)=>spoke.push(a),poiMessageEndSpeech:()=>ended.push(true),
  poiNpcTradeCatalog:()=>[{code:'h',name:'薬草',price:5,quantity:2,canTrade:true}],
  poiNpcTradeTransaction:(...args)=>{trades.push(args);return {ok:true,gold:3}}
 });
 vm.runInContext(html.match(/\/\/ BEGIN TOWN DIALOGUE\n([\s\S]*?)\/\/ END TOWN DIALOGUE/)[1],c);
 const state=()=>JSON.parse(JSON.stringify(c.poiTownDialogueSnapshot()));
 return {c,actor,spoke,ended,trades,state};
}
test('a real desk opens glass menus, direction wraps, confirmation trades and Back restores announcements',()=>{
 const {c,actor,state,ended,trades}=fixture();
 assert.equal(c.poiTownDialogueAction(200),true);assert.equal(actor.facing,2);
 assert.deepEqual(state().actions.map(x=>x.id),['talk','status','request','back']);
 c.poiNpcMenuStep(-1);assert.equal(state().index,3);
 c.poiNpcMenuChoose('request',210);assert.deepEqual(state().actions.map(x=>x.id),['shop','sell','buy','recruit','back']);
 c.poiNpcMenuChoose('recruit',220);assert.equal(state().text,'今は忙しい');
 c.poiNpcMenuChoose('buy',230);c.poiNpcMenuChoose('trade:h',240);
 assert.equal(trades.length,0);assert(c.poiNpcTradeSessionMatches(actor,'buy'));
 c.poiNpcMenuChoose('confirm',250);assert.deepEqual(trades[0],[actor,'buy','h']);
 c.poiNpcMenuBack(260);c.poiNpcMenuBack(270);c.poiNpcMenuBack(280);
 assert.equal(state(),null);assert.equal(ended.length,1);
});
test('a sleeping NPC emits zzz without a menu, facing, or pause',()=>{
 const {c,actor,spoke,state}=fixture();actor.activity='sleep-home';actor.z=4;actor.facing=1;
 assert.equal(c.poiTownDialogueAction(200),true);
 assert.equal(state().sleeping,true);assert.equal(state().text,'zzz...');assert.equal(spoke.at(-1)[1],'zzz...');
 assert.equal(c.poiNpcMenuActive(),false);assert.equal(actor.facing,1);
 assert.equal(c.poiTownDialogueUpdate(240),null);assert.equal(actor.activity,'sleep-home');
});
