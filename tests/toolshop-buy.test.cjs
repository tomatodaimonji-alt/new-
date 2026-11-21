const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||path.join(__dirname,'../world-editor.html'),'utf8');
function shop(){
 const a=html.indexOf('function poiShopIsOpen('),b=html.indexOf('function poiWalkStatus(',a);
 assert(a>=0&&b>a,'checkout UI missing');
 const ids=Object.fromEntries(['poiWalkAction','poiShopDialog','poiGoldHud','poiGoldValue','poiShopGold','poiShopBuyPotion','poiShopFeedback'].map(id=>[id,{setAttribute(k,v){this[k]=v},showModal(){this.open=true},close(){this.open=false}}]));
 let purchases=0,refresh=0;
 const ctx=vm.createContext({$:id=>ids[id],facilitySite:{id:'base'},poiWalkActive:true,pineAIActive:false,poiWalkLevel:0,
  poiWalkX:47,poiWalkZ:13,poiWalkFacing:1,world:[{x:48,z:13,y:0,type:'counterLuxury',rot:1},{x:48,z:13,y:0,type:'poiLedgerPapers',rot:3}],
  poiEconomyGold:()=>9,poiEconomyBuyPotion:()=>{purchases++;return {ok:true,gold:3,potions:4,cost:6}},
  poiHotbarRead:()=>({potions:3}),poiHotbarRender:()=>{refresh++},document:{querySelector:()=>null}});
 vm.runInContext(html.slice(a,b),ctx);
 return {ctx,ids,purchases:()=>purchases,refresh:()=>refresh};
}
test('canonical tool shop checkout only opens from its guest side, only in base play',()=>{
 const {ctx,ids}=shop();
 assert.equal(ctx.poiShopOpen(),true);assert.equal(ids.poiShopDialog.open,true);
 assert.equal(ids.poiGoldValue.textContent,'9');
 ctx.poiShopClose();ctx.poiWalkFacing=3;
 assert.equal(ctx.poiShopOpen(),false);
 ctx.poiWalkFacing=1;ctx.poiWalkLevel=1;assert.equal(ctx.poiShopOpen(),false);
 ctx.poiWalkLevel=0;ctx.facilitySite.id='toolshop';assert.equal(ctx.poiShopOpen(),false);
 ctx.facilitySite.id='base';ctx.pineAIActive=true;assert.equal(ctx.poiShopOpen(),false);
 ctx.pineAIActive=false;ctx.world=[];assert.equal(ctx.poiShopOpen(),false);
});
test('only the open, still-valid checkout can invoke a purchase',()=>{
 const {ctx,ids,purchases}=shop();
 ctx.poiShopPurchase();assert.equal(purchases(),0);
 ctx.poiShopOpen();ctx.poiShopPurchase();assert.equal(purchases(),1);
 assert.match(ids.poiShopFeedback.textContent,/購入/);
 ctx.poiWalkX=44;ctx.poiShopPurchase();assert.equal(purchases(),1);
 assert.match(html,/function poiWalkAction\(\)\{\s*if\(!poiWalkActive\|\|poiShopIsOpen\(\)\)return;\s*if\(poiShopOpen\(\)\)return;/);
});
