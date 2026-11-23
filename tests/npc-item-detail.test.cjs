const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {test}=require('node:test');
const html=readFileSync(process.argv[2]||'world-editor.html','utf8');
const start=html.indexOf('function poiItemDetailCell('),end=html.indexOf('function poiItemDetailDescription(',start);
const fake={poiInventoryAllowed:()=>false,poiInventoryStack:()=>1,$:id=>id==='poiNpcInventory'?panel:undefined};
const panel={hidden:false,contains:b=>b===slot};
const slot={};
const context=vm.createContext(fake);
vm.runInContext(html.slice(start,end),context);
test('visible NPC slot can inspect its item independent of player bag',()=>{
 const cell={type:'equipLadle',count:1};
 const ref={zone:'npc',button:slot,cell};
 assert.equal(fake.poiItemDetailCell(ref),cell);
 assert.equal(fake.poiItemDetailCell({...ref,button:{}}),null,'detached slot is stale');
 panel.hidden=true;
 assert.equal(fake.poiItemDetailCell(ref),null,'closed NPC panel invalidates detail');
});
test('NPC details never expose any inventory write actions, even when a chest is open',()=>{
 assert.deepEqual(Array.from(fake.poiItemDetailActions('npc',{type:'equipLadle',count:1},true)),['back']);
});
