const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const part=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i+1);assert(i>=0&&j>i,'missing '+a);return html.slice(i,j)};
test('detail actions distinguish stackable consumables, equipment, and chest accessibility',()=>{
 const context={poiInventoryStack:t=>t==='cannedFood'?9:1,poiHotbarWeaponForType:t=>t==='kitchenKnife'?t:null};
 vm.runInNewContext(part('function poiItemDetailActions(','function poiItemDetailDescription('),context);
 const show=(zone,type,count,open)=>Array.from(context.poiItemDetailActions(zone,{type,count},open));
 assert.deepEqual(show('chest','kitchenKnife',1,true),['transfer','drop','back']);
 assert.deepEqual(show('bag','kitchenKnife',1,false),['equip','drop','back']);
 assert.deepEqual(show('bag','cannedFood',3,true),['transfer','split','use','drop','back']);
 assert.deepEqual(show('bag','cannedFood',1,false),['use','drop','back']);
 assert(!show('bag','kitchenKnife',4,true).includes('split'));
 assert.deepEqual(show('hotbar','kitchenKnife',1,true),['transfer','equip','drop','back']);
 assert.deepEqual(show('hotbar','cannedFood',3,false),['split','use','drop','back']);
 assert.deepEqual(Array.from(context.poiItemDetailActions('hotbar',{type:'cannedFood',count:3},true,false)),['transfer','use','drop','back']);
});
test('single storage tap waits only when a double transfer is available and uses one mutually exclusive callback',()=>{
 const s=vm.createContext({});vm.runInContext(part('function poiCreateStorageTapGate(','let poiItemDetailSelection'),s);
 let i=0;const timers=new Map(),calls=[];
 const tap=s.poiCreateStorageTapGate(fn=>{const k=++i;timers.set(k,fn);return k},k=>timers.delete(k),
  b=>calls.push(['single',b]),b=>calls.push(['double',b]));
 const flush=()=>{for(const [k,fn] of timers){timers.delete(k);fn()}};
 tap.select('a',true);assert.deepEqual(calls,[]);tap.select('a',true);flush();assert.deepEqual(calls,[['double','a']]);
 tap.select('b',true);tap.cancel();flush();assert.deepEqual(calls,[['double','a']]);
 tap.select('c',true);flush();tap.select('d',false);assert.deepEqual(calls,[['double','a'],['single','c'],['single','d']]);
});
test('the storage detail stops held movement repeat and blocks movement until closed',()=>{
 const open=part('function poiItemDetailOpen(','function poiItemDetailReason(');
 assert.match(open,/poiStopRepeat\(\)[\s\S]*showModal\(\)/);
 const walk=part('function poiWalkStep(','function poiWalkAction(');
 assert.match(walk,/poiItemDetailIsOpen\(\)\)return;[\s\S]*poiWalkX\+=dx/);
});
test('storage detail shares a 325ms gate; shortcuts are direct only with the bag closed',()=>{
 const wire=part('function poiBagWire(','function poiHotbarRender(');
 assert.match(wire,/poiCreateStorageTapGate\(fn=>setTimeout\(fn,325\)/);
 assert.match(wire,/if\(ref.zone==='hotbar'&&bag.hidden\)\{poiStorageTapGate.cancel\(\);poiHotbarUse\(ref.index\)\}/);
 assert.match(wire,/detailZone=zone=>zone==='bag'\|\|zone==='chest'\|\|zone==='hotbar'&&!bag.hidden/);
 assert.match(wire,/poiStorageTapGate.select\(button,detailZone\(ref.zone\)&&e.detail>0\)/);
});
test('a real stationary storage touch is handled before its compatibility click, once per contact',()=>{
 const wire=part('function poiBagWire(','function poiHotbarRender(');
 assert.match(wire,/if\(moved<10&&!wasMoved\)\{[\s\S]*poiStorageTapGate.select\(source,true\);[\s\S]*?return;/);
 assert.match(wire,/suppress\?\.button===button&&performance.now\(\)<suppress.until&&\(e.detail>0\|\|e.pointerType\|\|e.sourceCapabilities\?\.firesTouchEvents\)/);
});
