const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||path.join(__dirname,'../world-editor.html'),'utf8');
function shop(){
 const a=html.indexOf('function poiShopIsOpen('),b=html.indexOf('function poiWalkStatus(',a);
 assert(a>=0&&b>a,'checkout context missing');
 const ids=Object.fromEntries(['poiWalkAction','poiGoldValue'].map(id=>[id,{setAttribute(k,v){this[k]=v}}]));
 let purchases=0;
 const work={x:49,z:13,y:0},clerk={...work,role:{id:'toolkeeper',work,name:'道具屋の店主'},activity:'work'};
 const ctx=vm.createContext({$:id=>ids[id],poiChestIsOpen:()=>false,poiKitchenChestReachable:()=>false,facilitySite:{id:'base'},poiWalkActive:true,pineAIActive:false,poiWalkLevel:0,
  poiWalkX:47,poiWalkZ:13,poiWalkFacing:1,world:[{x:48,z:13,y:0,type:'counterLuxury',rot:1},{x:48,z:13,y:0,type:'poiLedgerPapers',rot:3}],
  poiTownNpcActors:[clerk],poiTownNpcActive:()=>ctx.facilitySite?.id==='base'&&ctx.poiWalkActive&&!ctx.pineAIActive,
  poiTownNpcKey:(x,z,y)=>[x,z,y].join(','),poiTownNpcGraph:()=>({cells:new Map([['48,13,0',ctx.world.filter(o=>o.x===48&&o.z===13&&o.y===0).map(o=>o.type)]])}),
  poiTownNpcStance:()=>true,poiTownNpcNextTile:()=>null,poiTownNpcFace(){},poiMonsterStates:new Map(),
  poiEconomyGold:()=>9,poiEconomyBuyPotion:()=>{purchases++;return {ok:true,gold:3,potions:4,cost:6}},
  performance:{now:()=>100},document:{querySelector:()=>null}});
 const d=html.match(/\/\/ BEGIN TOWN DIALOGUE\n([\s\S]*?)\/\/ END TOWN DIALOGUE/);
 vm.runInContext(d[1]+html.slice(a,b),ctx);
 return {ctx,ids,purchases:()=>purchases,clerk};
}
test('canonical staffed shop menu opens only from the guest side in base play',()=>{
 const {ctx,ids,clerk}=shop();
 assert.equal(ctx.poiTownDialogueAction(100),true);assert.equal(ctx.poiShopIsOpen(),true);
 assert(!ctx.poiTownDialogueSnapshot().actions.some(r=>r.id==='shop'));
 ctx.poiNpcMenuChoose('request',100);assert(ctx.poiTownDialogueSnapshot().actions.some(r=>r.id==='shop'));
 assert.equal(ids.poiGoldValue.textContent,'9');
 ctx.poiShopClose();clerk.activity='go-home';assert.equal(ctx.poiTownDialogueAction(101),true,'a reachable off-duty resident can still talk');
 ctx.poiNpcMenuChoose('request',101);assert(!ctx.poiTownDialogueSnapshot().actions.some(r=>r.id==='shop'),'off-duty clerk cannot sell fixed shop stock');
 ctx.poiShopClose();
 clerk.activity='work';ctx.poiWalkFacing=3;assert.equal(ctx.poiTownDialogueAction(102),false);
 ctx.poiWalkFacing=1;ctx.poiWalkLevel=1;assert.equal(ctx.poiTownDialogueAction(103),false);
 ctx.poiWalkLevel=0;ctx.facilitySite.id='toolshop';assert.equal(ctx.poiTownDialogueAction(104),false);
 ctx.facilitySite.id='base';ctx.pineAIActive=true;assert.equal(ctx.poiTownDialogueAction(105),false);
 ctx.pineAIActive=false;ctx.world=[];assert.equal(ctx.poiTownDialogueAction(106),false);
 assert.doesNotMatch(html,/<dialog id="poiShopDialog"/);
});
test('only an explicitly confirmed, still-valid 6G shop order invokes purchase',()=>{
 const {ctx,purchases}=shop();
 assert.equal(ctx.poiNpcMenuChoose('confirm',100),false);
 ctx.poiTownDialogueAction(100);ctx.poiNpcMenuChoose('request',100);ctx.poiNpcMenuChoose('shop',101);ctx.poiNpcMenuChoose('trade:shop-herb',102);
 assert.match(ctx.poiTownDialogueSnapshot().text,/6G/);assert.equal(purchases(),0);
 ctx.poiNpcMenuChoose('confirm',103);assert.equal(purchases(),1);
 assert.match(ctx.poiTownDialogueSnapshot().text,/薬草を1個買った/);
 ctx.poiNpcMenuChoose('trade:shop-herb',104);ctx.poiWalkX=44;ctx.poiNpcMenuChoose('confirm',105);
 assert.equal(purchases(),1);assert.equal(ctx.poiTownDialogueSnapshot(),null);
});
test('only a successful fixed shop transaction starts the visible sale gesture',()=>{
 const {ctx}=shop(),events=[];
 Object.assign(ctx,{poiTownNpcGesture:(a,k,t)=>events.push([a.role.id,k,t]),poiTownMotionClock:199});
 ctx.poiTownDialogueAction(100);ctx.poiNpcMenuChoose('request',100);ctx.poiNpcMenuChoose('shop',101);ctx.poiNpcMenuChoose('trade:shop-herb',102);ctx.poiNpcMenuChoose('confirm',103);
 assert.deepEqual(events,[['toolkeeper','trade-sell',199]]);
 ctx.poiEconomyBuyPotion=()=>({ok:false,reason:'funds'});
 ctx.poiNpcMenuChoose('trade:shop-herb',104);ctx.poiNpcMenuChoose('confirm',105);
 assert.equal(events.length,1);assert.match(ctx.poiTownDialogueSnapshot().text,/金貨が足りません/);
});
