const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {test}=require('node:test');
const vm=require('node:vm');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
test('landscape touch pads move by the requested proportions while retaining floating CSS origins',()=>{
 const start=html.indexOf('/* Landscaped thumb docks and contextual action art */');
 assert.ok(start>=0);
 const css=html.slice(start,html.indexOf('</style>',start));
 assert.match(css,/@media \(orientation: landscape\) and \(pointer: coarse\) and \(min-width: 520px\)/);
 assert.match(css,/calc\(12\.5vw - var\(--poi-land-left\)\)/);
 assert.match(css,/calc\(12vw - 38px\)/);
 assert.match(css,/var\(--poi-analog-x,var\(--poi-v220-pad-rest-x\)\)/);
 assert.match(css,/#poiWalkAction\{[^}]*width:76px;height:76px;[^}]*border-radius:50%/s);
 assert.match(css,/#poiBagToggle\{[^}]*width:55px!important;height:55px!important;border-radius:50%/s);
 assert.match(css,/#poiBagToggle span\{display:none\}/);
 assert.ok(html.includes('aria-label="インベントリ" aria-expanded='));
});
function makeShop(){
 const start=html.indexOf('// BEGIN LANDSCAPE ACTION PRESENTATION'),end=html.indexOf('function poiShopClose(',start);
 assert.ok(start>=0&&end>start);
 const bag={layout:true,npc:false,menu:false,loot:false,weapon:null};
 const action={dataset:{},textContent:'',replaceChildren(item){this.art=item},setAttribute(k,v){this[k]=v}};
 const ctx=vm.createContext({
  $:k=>k==='poiWalkAction'?action:{hasAttribute(){return bag.layout}},
  document:{createElement(){return {dataset:{},textContent:'',childElementCount:0,setAttribute(){}}}},
  poiWalkActive:true,facilitySite:{id:'base'},poiEconomyGold:()=>0,poiWalletSync(){},
  poiTownDialogueTarget:()=>bag.npc,poiShopIsOpen:()=>bag.menu,poiChestIsOpen:()=>false,poiKitchenChestReachable:()=>bag.loot,
  performance:{now:()=>200},poiEquippedWeapon:()=>bag.weapon,poiInventoryPresentItem(a,cell){
   a.art.childElementCount=1;a.art.dataset.preview=cell.type;
  },
  poiInventoryItemName:x=>x
 });
 vm.runInContext(html.slice(start,end)+';this.sync=poiShopSync;this.weapon=poiLandscapeActionWeaponSync;',ctx);
 return {bag,action,ctx};
}
test('normal action presents an equipped item or fist, switches to talking when reachable, and retains context labels',()=>{
 const {bag,action,ctx}=makeShop();
 ctx.sync();
 assert.equal(action.dataset.actionArt,'fist');assert.match(action.art.innerHTML,/<svg.*data-action-fist/s);
 assert.equal(action['aria-label'],'攻撃または決定');
 bag.weapon='equipWoodSword';ctx.weapon(bag.weapon);
 assert.equal(action.dataset.actionArt,'equipWoodSword');assert.equal(action.art.dataset.preview,'equipWoodSword');
 bag.npc=true;ctx.sync();
 assert.equal(action.textContent,'話す');assert.equal(action['aria-label'],'住人と話す');assert.equal(action.dataset.actionArt,undefined);
 bag.menu=true;ctx.sync();assert.match(action.innerHTML,/選択.*決定/);assert.equal(action['aria-label'],'会話の選択肢を決定する');
 bag.menu=false;bag.loot=true;ctx.sync();assert.match(action.innerHTML,/開ける.*決定/);
 bag.loot=false;bag.npc=false;ctx.sync();assert.equal(action.dataset.actionArt,'equipWoodSword');
 bag.layout=false;ctx.sync();
 assert.equal(action.innerHTML,'攻撃<br>決定');assert.equal(action.dataset.actionArt,undefined);
});
test('landscape announcement width and center share the actual shortcut footprint',()=>{
 const css=html.slice(html.indexOf('/* Full-bleed landscape play HUD */'),html.indexOf('</style>'));
 assert.match(css,/#poiWalkPad\.active #poiHotbar\{\s*left:var\(--poi-land-control-center\)/);
 assert.match(css,/#poiMessageStack\{\s*width:var\(--poi-inventory-width\);height:80px;\s*left:var\(--poi-land-control-center\)/);
});
test('one live battery indicator relocates above the padded landscape Menu and returns to the portrait header',()=>{
 assert.equal(html.match(/id="batteryIndicator"/g)?.length,1);
 assert.equal(html.match(/await navigator\.getBattery\(\)/g)?.length,1);
 const start=html.indexOf('// BEGIN LANDSCAPE BATTERY'),end=html.indexOf('// END LANDSCAPE BATTERY',start);
 assert.ok(start>=0&&end>start);
 const header={append(el){el.parentElement=this}},holder={hidden:true,append(el){el.parentElement=this}};
 const battery={parentElement:header},ctx=vm.createContext({$:id=>id==='batteryIndicator'?battery:holder});
 vm.runInContext(html.slice(start,end)+';this.move=poiLandscapeBatterySync;',ctx);
 ctx.move(true);assert.equal(battery.parentElement,holder);assert.equal(holder.hidden,false);
 ctx.move(true);assert.equal(battery.parentElement,holder);
 ctx.move(false);assert.equal(battery.parentElement,header);assert.equal(holder.hidden,true);
 assert.match(html,/--poi-land-menu-margin:14px/);
 assert.match(html,/#poiLandscapeMenuToggle\{top:var\(--poi-land-menu-top\)\}/);
});
