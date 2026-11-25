const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(x,y)=>html.slice(html.indexOf(x),html.indexOf(y,html.indexOf(x)+x.length));
function setup(){
 const handlers={},uses=[],captured=new Set(),bar={addEventListener(k,f){(handlers[k]??=[]).push(f)}};
 const button={dataset:{hotbarSlot:'0'},setPointerCapture(id){captured.add(id)}};
 let now=1000,from={x:28,y:40};
 const c=vm.createContext({performance:{now:()=>now}, $:()=>({hasAttribute:()=>true}),poiAnalogAllowed:()=>true,
  poiInventoryAllowed:()=>true,poiHotbarRead:()=>({}),poiGoldHotbarSlot:()=>8,poiInventorySlot:()=>c.type,
  poiHotbarWeaponForType:k=>k==='equipWoodSword',poiHotbarUse:i=>uses.push(i),poiStorageTapGate:{cancel(){}},
  POI_HOTBAR_SIZE:9,POI_FIRE_WAND:'fireWand',poiBagKeySource:null,poiAnalogContact:{id:2},
  poiAnalogPad:{removeAttribute(){},style:{removeProperty(){}},hasPointerCapture:()=>false},poiFreePose:{walking:true},
  window:{addEventListener(){}},document:{elementFromPoint:()=>button,addEventListener(){}},type:'equipWoodSword'});
 vm.runInContext(cut('function poiWireMovingWeaponShortcuts(','function poiBagWire(')+cut('function poiAnalogStop(','function poiAnalogFrame('),c);
 c.poiWireMovingWeaponShortcuts(bar,{hidden:true},n=>n);
 const fire=(kind,p={})=>{const e={pointerId:3,isPrimary:false,pointerType:'touch',button:0,clientX:from.x,clientY:from.y,target:button,
  preventDefault(){this.prevented=true},stopImmediatePropagation(){this.stop=true},...p};for(const f of handlers[kind]||[])f(e);return e};
 return {c,uses,fire,captured,tick(n){now+=n},release(id=2){c.poiAnalogStop({pointerId:id});a.equal(c.poiAnalogContact,null)}};
}
test('short physical weapon tap works immediately after actual pad release without a compatibility click',()=>{
 const f=setup();f.release();f.fire('pointerdown',{isPrimary:true});f.fire('pointerup',{isPrimary:true});
 a.deepEqual(f.uses,[0]);a(f.fire('click',{isPrimary:true}).stop,'optional compatibility click cannot double use');
});
test('overlap right-down then pad release, and a fresh same-slot unidentified compatibility click never loses a physical input',()=>{
 const f=setup();f.fire('pointerdown');f.release();f.fire('pointerup');a.deepEqual(f.uses,[0]);
 f.tick(20);f.c.type=null;f.fire('pointerdown',{pointerId:4,isPrimary:true});f.fire('pointerup',{pointerId:4,isPrimary:true});
 a.deepEqual(f.uses,[0,0]);
 const legacy={pointerId:0,pointerType:'',sourceCapabilities:{firesTouchEvents:true}};
 a(f.fire('click',legacy).stop);a(f.fire('click',legacy).stop);
});
test('cancel and drag cannot equip; mouse and keyboard compatibility clicks remain free',()=>{
 const f=setup();f.release();f.fire('pointerdown',{isPrimary:true});f.fire('pointercancel',{isPrimary:true});f.fire('pointerup',{isPrimary:true});
 f.fire('pointerdown',{isPrimary:true});f.fire('pointermove',{isPrimary:true,clientX:50});f.fire('pointerup',{isPrimary:true,clientX:50});
 a.deepEqual(f.uses,[]);a.equal(f.fire('click',{pointerType:'mouse'}).stop,undefined);a.equal(f.fire('click',{pointerType:'',pointerId:0}).stop,undefined);
});
test('pad pointercancel and a new primary weapon tap work; opening dialogue or bag during tap still blocks',()=>{
 for(const kind of ['pointerup','pointercancel','lostpointercapture']){
  const f=setup();f.c.poiAnalogStop({pointerId:2,type:kind});
  f.fire('pointerdown',{isPrimary:true});f.fire('pointerup',{isPrimary:true});a.deepEqual(f.uses,[0],kind);
 }
 const f=setup();f.release();f.fire('pointerdown',{isPrimary:true});f.c.poiAnalogAllowed=()=>false;
 f.fire('pointerup',{isPrimary:true});a.deepEqual(f.uses,[]);
});
test('fresh primary consumables and allies still use ordinary click, never the new weapon handler',()=>{
 for(const type of ['healingHerb','cannedFood','slimeSoul','gold']){
  const f=setup();f.release();f.c.type=type;f.c.poiCompanionType=t=>t==='slimeSoul';
  a(!f.fire('pointerdown',{isPrimary:true}).prevented);
  a(!f.fire('pointerup',{isPrimary:true}).prevented);a.deepEqual(f.uses,[],type);
  a(!f.fire('click',{isPrimary:true}).stop,type);
 }
});
