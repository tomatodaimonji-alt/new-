const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function setup(record){
 let bytes=JSON.stringify(record),writes=0,attrs=new Map(),value={textContent:'0'};
 const wallet={toggleAttribute(k,on){if(on)attrs.set(k,'');else attrs.delete(k)},hasAttribute:k=>attrs.has(k),getAttribute:k=>attrs.get(k),setAttribute:(k,v)=>attrs.set(k,v)};
 const c=vm.createContext({$:id=>id==='poiBagWallet'?wallet:id==='poiGoldValue'?value:null,facilitySite:{id:'base'},poiWalkActive:true,pineAIActive:false,poiWalkLevel:0,document:{querySelectorAll:()=>[]},world:[],
  localStorage:{getItem:()=>bytes,setItem(_k,v){bytes=v;writes++}}});
 const span=(a,b)=>h.slice(h.indexOf(a),h.indexOf(b,h.indexOf(a)+1));
 vm.runInContext(span('const POI_HOTBAR_KEY=','function poiResetCombat(')+span('function poiWalletSync(','function poiShopSync('),c);
 return {c,attrs,value,raw:()=>JSON.parse(bytes),writes:()=>writes};
}
const saved={version:1,weapon:null,potions:2,goldHotbarSlot:4};
test('positive shortcut spends to zero, frees slot, and future gold returns to wallet without evicting new items',()=>{
 const f=setup({...saved,gold:1}),{c}=f;
 assert.equal(c.poiInventorySnapshot().goldHotbarSlot,4);
 assert(c.poiEconomyWrite({...c.poiHotbarRead(),gold:0}));
 assert.equal(c.poiInventorySnapshot().goldHotbarSlot,null);assert.equal(f.raw().goldHotbarSlot,undefined);
 assert.equal(c.poiMoveGoldToBag({zone:'hotbar',index:5}).ok,false);
 assert.equal(c.poiInventoryMove({zone:'hotbar',index:1},{zone:'hotbar',index:4}).ok,true);
 assert(c.poiEconomyWrite({...c.poiHotbarRead(),gold:3}));
 const g=setup(f.raw()).c,s=g.poiInventorySnapshot();
 assert.equal(s.goldHotbarSlot,null);assert.equal(s.hotbar[4].type,'healingHerb');assert.equal(s.potions,2);assert.equal(g.poiEconomyGold(),3);
 assert.equal(g.poiMoveGoldToBag({zone:'hotbar',index:5}).ok,true);assert.equal(g.poiInventorySnapshot().goldHotbarSlot,5);
});
test('already zero old saves open without rewrites and the wallet numeral and icon are absent until positive',()=>{
 const f=setup(saved);assert.equal(f.c.poiInventorySnapshot().goldHotbarSlot,null);assert.equal(f.writes(),0);
 f.c.poiWalletSync(0);assert.equal(f.value.textContent,'');assert(f.attrs.has('data-wallet-empty'));
 f.c.poiWalletSync(1);assert.equal(f.value.textContent,'1');assert(!f.attrs.has('data-wallet-empty'));
 assert.match(h,/#poiBagWallet\[data-wallet-empty\]\s+svg/);
});
