const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const h=fs.readFileSync(process.env.HTML||path.join(__dirname,'..','world-editor.html'),'utf8');
function fixture(initial={version:1,weapon:'equipWoodSword',potions:3,gold:40,claimedCaches:['glade'],towerFind:{kind:'claimed'}}){
 let raw=JSON.stringify(initial),fail=false,day=1,session=true,writes=0;
 const role={id:'stablekeeper',role:'keeper'},actor={role,activity:'work',x:4,z:5,y:0};
 const c=vm.createContext({poiTownNpcActors:[actor],POI_TOWN_RESIDENT_ROLES:[role],poiTownNpcActive:()=>true,
  poiTownClockSnapshot:()=>({day}),poiNpcTradeSessionMatches:(x,mode)=>session&&x===actor&&['buy','sell'].includes(mode),
  facilitySite:{id:'base'},poiWalkActive:true,poiWalkLevel:0,poiWalkX:4,poiWalkZ:6,pineAIActive:false,$:()=>null,document:{querySelectorAll:()=>[]},
  toast(){},localStorage:{getItem:()=>raw,setItem(_k,v){if(fail)throw Error('quota');raw=v;writes++}}});
 const a=h.indexOf('const POI_HOTBAR_KEY='),b=h.indexOf('function poiResetCombat(',a);
 vm.runInContext(h.slice(a,b),c);
 return {c,actor,fail:v=>fail=v,day:v=>day=v,session:v=>session=v,raw:()=>JSON.parse(raw),writes:()=>writes};
}
const row=(f,mode,code)=>f.c.poiNpcTradeCatalog(f.actor,mode).find(i=>i.code===code);
test('personal prices are distinct, fixed shop price stays 6 and browsing is read-only',()=>{
 const f=fixture();
 assert.equal(typeof f.c.poiNpcTradeCatalog,'function');
 assert.deepEqual(Array.from(f.c.poiNpcTradeCatalog(f.actor,'buy'),i=>[i.code,i.base,i.price,i.quantity]),[['healingHerb',6,9,2],['cannedFood',12,18,1]]);
 assert.deepEqual(Array.from(f.c.poiNpcTradeCatalog(f.actor,'sell'),i=>[i.code,i.base,i.price,i.quantity]),[['healingHerb',6,3,3],['cannedFood',12,6,0]]);
 assert.equal(f.writes(),0);
 const previous=f.c.poiEconomyGold();assert.equal(f.c.poiEconomyBuyPotion().ok,true);assert.equal(previous-f.c.poiEconomyGold(),6);
});
test('individual purchase/debit/sale/stock/reload are atomic and new day restores ordinary supply',()=>{
 const f=fixture(),a=f.actor,saved=f.raw();
 f.fail(true);assert.equal(f.c.poiNpcTradeTransaction(a,'buy','healingHerb').reason,'storage');
 assert.deepEqual(f.raw(),saved);assert.equal(row(f,'buy','healingHerb').quantity,2);
 f.fail(false);assert.equal(f.c.poiNpcTradeTransaction(a,'buy','healingHerb').gold,31);
 assert.equal(f.c.poiNpcTradeTransaction(a,'buy','healingHerb').gold,22);
 assert.equal(f.c.poiNpcTradeTransaction(a,'buy','healingHerb').reason,'stock');
 const g=fixture(f.raw());assert.equal(row(g,'buy','healingHerb').quantity,0);
 assert.equal(g.c.poiNpcTradeTransaction(g.actor,'sell','healingHerb').gold,25);
 assert.equal(row(g,'buy','healingHerb').quantity,1);assert.equal(g.c.poiHotbarRead().potions,4);
 assert.equal(g.raw().weapon,'equipWoodSword');assert.deepEqual(g.raw().claimedCaches,['glade']);assert.deepEqual(g.raw().towerFind,{kind:'claimed'});
 g.day(2);assert.equal(row(g,'buy','healingHerb').quantity,2);assert.equal(g.raw().npcTrade.day,1);
});
test('unrelated, asleep, mismatched, full and unaffordable operations preserve kit',()=>{
 const f=fixture({version:1,weapon:null,potions:0,gold:1}),a=f.actor;
 assert.equal(f.c.poiNpcTradeTransaction({...a},'buy','healingHerb').reason,'unavailable');
 assert.equal(f.c.poiNpcTradeTransaction(a,'buy','kitchenKnife').reason,'item');
 assert.equal(f.c.poiNpcTradeTransaction(a,'buy','healingHerb').reason,'funds');
 assert.equal(f.c.poiNpcTradeTransaction(a,'sell','healingHerb').reason,'empty');
 f.session(false);assert.equal(f.c.poiNpcTradeTransaction(a,'buy','healingHerb').reason,'unavailable');
 f.session(true);a.activity='sleep-home';assert.equal(f.c.poiNpcTradeCatalog(a,'buy').length,0);assert.equal(f.writes(),0);
});
test('capacity, distant trades, and malformed stored actor data cannot write or duplicate',()=>{
 const slots=Array.from({length:27},(_,i)=>i?{type:'healingHerb',count:9}:{type:'equipWoodSword',count:1});
 const f=fixture({version:1,weapon:null,potions:9,gold:40,slots,npcTrade:{version:1,day:1,actors:{
  outsider:{healingHerb:8,cannedFood:8},stablekeeper:{healingHerb:783,cannedFood:1}
 }}});
 assert.equal(row(f,'buy','cannedFood').quantity,1);
 assert.equal(f.c.poiNpcTradeTransaction(f.actor,'buy','cannedFood').reason,'full');
 f.actor.y=1;assert.equal(f.c.poiNpcTradeTransaction(f.actor,'sell','healingHerb').reason,'unavailable');
 f.actor.y=0;f.actor.z=2;assert.equal(f.c.poiNpcTradeTransaction(f.actor,'sell','healingHerb').reason,'unavailable');
 assert.equal(f.writes(),0);assert.equal(f.c.poiHotbarRead().npcTrade,undefined);
 f.actor.z=5;assert.equal(f.c.poiNpcTradeTransaction(f.actor,'sell','healingHerb').ok,true);
 assert.equal(f.c.poiInventorySnapshot().hotbar[1].count,9);
 assert.equal(f.c.poiInventorySnapshot().bag[0].count,8);
 assert.deepEqual(Object.keys(f.raw().npcTrade.actors),['stablekeeper']);
});
test('selling removes exactly one from the chosen hotbar or legacy bag stack and no other',()=>{
 const slots=Array(27).fill(null);slots[0]={type:'equipWoodSword',count:1};
 for(const [i,count] of [[1,2],[9,3],[26,4]])slots[i]={type:'healingHerb',count};
 const f=fixture({version:1,weapon:'equipWoodSword',potions:9,gold:20,slots});
 const rows=f.c.poiNpcTradeSellRows(f.actor),counts=()=>[1,9,26].map(i=>f.c.poiHotbarRead().slots[i].count);
 assert.deepEqual(Array.from(rows,r=>[r.sourceIndex,r.quantity]),[[1,2],[9,3],[26,4]]);
 assert.equal(f.c.poiNpcTradeTransaction(f.actor,'sell','healingHerb',0).reason,'item');assert.equal(f.writes(),0);
 f.fail(true);assert.equal(f.c.poiNpcTradeTransaction(f.actor,'sell','healingHerb',26).reason,'storage');assert.deepEqual(counts(),[2,3,4]);
 f.fail(false);assert.equal(f.c.poiNpcTradeTransaction(f.actor,'sell','healingHerb',1).gold,23);assert.deepEqual(counts(),[1,3,4]);
 assert.equal(f.c.poiNpcTradeTransaction(f.actor,'sell','healingHerb',26).gold,26);assert.deepEqual(counts(),[1,3,3]);
});
