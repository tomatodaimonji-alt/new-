const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
test('the detail dialog places the shared item-art slot beside the current name',()=>{
 assert.match(html,/<div id="poiItemDetailHeader">\s*<div id="poiItemDetailIcon" aria-hidden="true">[\s\S]*?class="hotbar-icon"[\s\S]*?class="hotbar-count"[\s\S]*?<h2 id="poiItemDetailName">/);
 assert.match(html,/#poiItemDetailHeader\{[^}]*grid-template-columns:clamp\(42px,12vw,48px\) minmax\(0,1fr\)/);
 assert.match(html,/poiInventoryPresentItem\(\$\('poiItemDetailIcon'\),cell\)/);
});
test('item art copies the exact inventory canvases and shows counts without stealing or rebuilding icons',()=>{
 const a=html.indexOf('function poiInventoryPresentItem('),b=html.indexOf('function poiItemDetailRender()',a);
 assert(a>=0&&b>a,'shared presenter missing');
 const art={dataset:{},children:[],replaceChildren(copy){this.children=[copy]}},count={};
 const host={querySelector:q=>q==='.hotbar-icon'?art:count};
 const models=Object.fromEntries(['kitchenKnife','cannedFood','equipWoodSword','healingHerb'].map(type=>[type,{width:96,height:96,dataset:{itemModel:type}}]));
 const copied=[],canvas=()=>({dataset:{},getContext:()=>({drawImage:src=>copied.push(src)})});
 const scope=vm.createContext({document:{createElement:canvas},poiHotbarSwordIcon:()=>models.equipWoodSword,
  poiHotbarHerbIcon:()=>models.healingHerb,poiLootContentIcon:type=>models[type]});
 vm.runInContext(html.slice(a,b),scope);
 for (const type of Object.keys(models)){
  scope.poiInventoryPresentItem(host,{type,count:3});
  assert.equal(copied.at(-1),models[type]);assert.notEqual(art.children[0],models[type]);
  assert.equal(art.children[0].dataset.itemModel,type);
  assert.equal(count.textContent,/^(?:healingHerb|cannedFood)$/.test(type)?'3':'');
 }
 const n=copied.length;scope.poiInventoryPresentItem(host,{type:'healingHerb',count:1});
 assert.equal(count.textContent,'1');assert.equal(copied.length,n,'art unchanged on count update');
});
