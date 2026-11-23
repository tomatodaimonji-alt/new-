const {test}=require('node:test'), assert=require('node:assert/strict'), vm=require('node:vm'), fs=require('node:fs');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function setup(){
 const begin=html.indexOf('function poiWireMovingWeaponShortcuts('), wire=html.indexOf('function poiBagWire(){'), end=html.indexOf('function poiHotbarRender(){',wire);
 assert(wire>=0&&end>wire);
 const node=(data={})=>{
  const handlers={};
  return {dataset:data,hidden:true,disabled:false,addEventListener(type,fn,capture){(handlers[type]||=[]).push([fn,!!capture])},
   emit(type,e={}){e.type=type;e.target??=this;e.preventDefault=()=>{e.defaultPrevented=true};e.stopImmediatePropagation=()=>{e.stopped=true};
    for(const [fn] of (handlers[type]||[]).slice().sort((a,b)=>Number(b[1])-Number(a[1]))){fn(e);if(e.stopped)break}
    return e},focus(){},setPointerCapture(){},closest(){return this}};
 };
 const ids=Object.fromEntries(['poiHotbar','poiBagPanel','poiBagToggle','poiChestPanel','poiItemDragPreview','poiChestTakeAll','poiChestClose','poiBagClose','poiItemDetail','viewWrap'].map(k=>[k,node()]));
 ids.viewWrap.hasAttribute=()=>c.landscape;
 const button=node({hotbarSlot:'2'}),switches=[],document=node();
 document.querySelector=()=>null; document.elementFromPoint=()=>c.hit;
 const c={document,window:node(),landscape:true,hit:button,poiAnalogContact:{id:4},poiAnalogAllowed:()=>c.allowed,allowed:true,poiInventoryAllowed:()=>true,poiStorageTapGate:null,poiBagKeySource:null,$:id=>ids[id],
  performance:{now:()=>c.now},now:100,setTimeout:()=>1,clearTimeout(){},poiChestCloseFromUi(){},poiItemDetailOpen(){},
  poiCreateStorageTapGate:()=>({cancel(){},select(){}}),poiBagSlotRef:()=>({zone:'hotbar',index:2}),
  poiInventoryCell:()=>({type:c.type}),poiInventorySlot:()=>c.type,poiHotbarRead:()=>({}),poiHotbarWeaponForType:t=>t==='equipIronSword'?t:null,
  POI_HOTBAR_SIZE:9,POI_FIRE_WAND:'fireWand',poiHotbarUse:i=>switches.push(i),type:'equipIronSword'};
 vm.runInNewContext(html.slice(begin>=0?begin:wire,end)+'\npoiBagWire();',c);
 const pointer=(event,extra={})=>ids.poiHotbar.emit(event,{target:button,pointerType:'touch',button:0,pointerId:9,isPrimary:false,clientX:130,clientY:250,...extra});
 return {c,ids,pointer,switches};
}
test('right touch selects once independently of synthetic click while left pad stays active',()=>{
 const h=setup();h.pointer('pointerdown');h.pointer('pointerup');
 assert.deepEqual(h.switches,[2],'independent second touch really changes the shortcut');
 assert.equal(h.c.poiAnalogContact.id,4,'left contact is not affected');
 h.pointer('click');assert.deepEqual(h.switches,[2],'matching touch-generated click is suppressed, not dispatched twice');
 h.pointer('click',{pointerType:'mouse',pointerId:1,detail:1});assert.deepEqual(h.switches,[2,2],'real mouse click still works');
});
test('drag excursion, canceled pointer, modal, bag, and consumable cannot select on secondary pulse',()=>{
 for(const mode of ['move','outside','cancel','modal','bag','portrait','consumable','no-stick']){
  const h=setup();if(mode==='bag')h.ids.poiBagPanel.hidden=false;if(mode==='portrait')h.c.landscape=false;if(mode==='consumable')h.c.type='healingHerb';
  if(mode==='no-stick')h.c.poiAnalogContact=null;
  h.pointer('pointerdown');
  if(mode==='move')h.pointer('pointermove',{clientX:149});
  if(mode==='outside')h.c.hit=null;
  if(mode==='cancel')h.pointer('pointercancel');
  if(mode==='modal')h.c.allowed=false;
  h.pointer('pointerup');assert.deepEqual(h.switches,[],mode);
 }
});
test('wand is a weapon for moving shortcuts; changing left contact after down does not invalidate right release',()=>{
 const h=setup();h.c.type='fireWand';h.pointer('pointerdown');h.c.poiAnalogContact=null;h.pointer('pointerup');
 assert.deepEqual(h.switches,[2]);
});
