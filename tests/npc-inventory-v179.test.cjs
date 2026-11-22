const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(process.env.HTML||path.join(__dirname,'../world-editor.html'),'utf8');
test('NPC bag contains only positive carried holdings and model-backed gear, never commerce stock',()=>{
 const a=html.indexOf('function poiNpcInventoryItems('),b=html.indexOf('function poiNpcInventoryView(',a);
 assert(a>=0&&b>a,'read-only inventory item projection missing');
 const c=vm.createContext({});vm.runInContext(html.slice(a,b),c);
 const inventory=(coins,herbs)=>JSON.parse(JSON.stringify(c.poiNpcInventoryItems({coins,herbs,stock:{cannedFood:9}})));
 assert.deepEqual(inventory(5,2),[{type:'gold',count:5},{type:'healingHerb',count:2}]);
 assert.deepEqual(inventory(0,0),[]);assert.deepEqual(inventory(-1,0),[]);
});
test('NPC inspection and player inventory use one geometry and square cell contract',()=>{
 const pad=html.slice(html.indexOf('<div id="poiWalkPad">'),html.indexOf('<div id="viewBar">'));
 assert.match(pad,/<section id="poiBagPanel"[\s\S]+<section id="poiNpcInventory" hidden>/);
 assert.match(html,/#poiNpcInventory,#poiBagPanel\{position:absolute;left:calc\(50% - var\(--poi-pad-nudge\)\);[\s\S]*?width:calc\(9 \* var\(--poi-bag-cell\) \+ 38px\)/);
 assert.match(html,/#poiNpcInventoryBody,#poiBagGrid\{display:grid;grid-template-columns:calc\(5 \* var\(--poi-bag-cell\) \+ 12px\)[^}]+height:calc\(5 \* var\(--poi-bag-cell\) \+ 12px\)/);
 assert.match(html,/#poiNpcInventoryItems,#poiBagSlots\{grid-column:1;grid-row:1;display:grid;grid-template-columns:repeat\(5,var\(--poi-bag-cell\)\);\s*grid-template-rows:repeat\(5,var\(--poi-bag-cell\)\)/);
});
