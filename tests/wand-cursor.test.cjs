const assert=require('node:assert/strict'),{test}=require('node:test'),vm=require('node:vm'),fs=require('node:fs');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(a,b)=>{const i=h.indexOf(a),j=h.indexOf(b,i+1);assert(i>=0&&j>i,a);return h.slice(i,j)};
test('Fire Wand actual stance and rendered cursor share the exact wand cell including swaps, cycles and charge updates',()=>{
 let rendered=[],avatar=[],kit={weapon:'sword',slots:Array(27).fill(null)},companion=4;
 const wam={type:'fireWand',charges:2}, twin={type:'fireWand',charges:2};
 kit.slots[0]={type:'sword'};kit.slots[2]=wam;kit.slots[3]=twin;
 const c={POI_HOTBAR_SIZE:9,POI_BAG_SAVED:18,POI_FIRE_WAND_MAX_CHARGES:4,POI_FIRE_WAND:'fireWand',
  poiHotbarHasKit:()=>true,poiHotbarRead:()=>kit,poiInventorySlots:k=>k.slots,poiInventoryAllowed:()=>true,
  poiStorageIndexExists:(i,n)=>i>=0&&i<n,poiBagSetOpen(){},poiShopSync(){},poiEconomyGold(){return 0},
  poiInventoryEdited:(k,s)=>({...k,slots:s}),poiEconomyWrite:k=>{kit=k;return true},
  poiStorageActionResult:()=>({ok:true}),poiCompanionSelectedShortcut:()=>companion,poiCompanionClearShortcut:()=>{companion=null},
  poiHotbarRender:()=>rendered.push(Array.from({length:9},(_,i)=>c.poiInventorySelected(i)).findIndex(Boolean)),
  poiWalkAvatar:()=>avatar.push(c.poiArmedWandIndex())};
 vm.createContext(c);
 vm.runInContext(cut('let poiArmedWand=null','// BEGIN HEALING ITEM CAST')+cut('function poiInventorySelected(','function poiInventoryAccept(')+cut('function poiEconomyRefresh(','const POI_TOOLSHOP_INITIAL'),c);
 assert(c.poiWandArm(2).ok);assert.equal(rendered.at(-1),2);assert.equal(avatar.at(-1),2);assert.equal(companion,null);
 kit.slots[6]=wam;kit.slots[2]=null;c.poiEconomyRefresh();
 assert.equal(c.poiArmedWandIndex(),6);assert.equal(rendered.at(-1),6);
 assert(c.poiInventorySpendFireWand(6));assert.equal(rendered.at(-1),6);assert.equal(kit.slots[3].charges,2);
 assert(c.poiInventorySpendFireWand(6));assert.equal(rendered.at(-1),0);assert.equal(c.poiArmedWandIndex(),null);
 assert(c.poiWandArm(3).ok);assert.equal(rendered.at(-1),3);
 kit.slots[10]=twin;kit.slots[3]={type:'fireWand',charges:2};c.poiEconomyRefresh();
 assert.equal(c.poiArmedWandIndex(),10);assert.equal(rendered.at(-1),-1,'bag-only arm does not highlight a hotbar wand or sword');
 kit.slots[10]=null;c.poiEconomyRefresh();assert.equal(rendered.at(-1),0);assert.equal(avatar.at(-1),null);
 assert(c.poiWandArm(3).ok);c.poiWandDisarm();assert.equal(rendered.at(-1),0);assert.equal(avatar.at(-1),null);
});
