const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function span(a,b){const i=h.indexOf(a),j=h.indexOf(b,i+a.length);assert(i>=0&&j>i,a);return h.slice(i,j)}
function setup({open=true,origin='wallet',funds=21,areaPanel=false,split=false}={}){
 const rect={left:100,right:220,top:60,bottom:220},canvas={},walletLog=[],dropLog=[],moveLog=[],details=[];
 function node(zone,{hidden=false,disabled=false,box=rect}={}){
  return {zone,hidden,disabled,dataset:{},handlers:{},focus(){},hasAttribute:()=>false,setPointerCapture(){},
   addEventListener(type,fn){(this.handlers[type]??=[]).push(fn)},getBoundingClientRect:()=>box,
   closest(){return this.zone?this:null}};
 }
 const bag=node(null,{hidden:!open}),bar=node(null,{box:{left:0,right:400,top:260,bottom:300}});
 const from=node(origin),dest=node('bag'),elements={poiBagPanel:bag,poiHotbar:bar,poiBagToggle:node(),poiChestPanel:node(null,{hidden:true}),
  poiLocationPanel:node(null,{hidden:!areaPanel,box:{left:275,right:340,top:65,bottom:92}}),
  poiItemDragPreview:node(),poiChestClose:node(),poiItemDetail:node(),viewWrap:node(null,{box:{left:0,right:400,top:0,bottom:300}})};
 let hit=null;
 const c={document:{hidden:false,elementFromPoint:()=>hit,addEventListener(){},querySelector:()=>null},window:{addEventListener(){}},
  $:id=>elements[id],canvas,poiBagCancelDrag:null,poiBagKeySource:null,poiStorageTapGate:null,poiStoragePressGate:null,setTimeout:()=>1,clearTimeout(){},
  poiInventoryAllowed:()=>true,poiCreateStorageTapGate:()=>({cancel(){},select(){}}),poiGoldDropWire(){},poiBagSlotRef:b=>({zone:b.zone,index:0}),
  poiDropGoldStack:ref=>{walletLog.push(ref);return{ok:true}},poiBagSelectSource(){},poiEconomyGold:()=>funds,
  poiWalletGold:()=>funds,poiHotbarRead:()=>({}),poiItemDetailCell:ref=>(split||ref.zone==='wallet')&&funds?{type:'gold',count:funds}:null,
  poiInventoryCell:()=>({type:'healingHerb'}),poiInventoryDrop:ref=>{dropLog.push(ref);return{ok:true}},poiMoveGoldToBag:r=>{moveLog.push(r);return{ok:true}},
  poiChestCloseFromUi(){},poiItemDetailOpen(button){details.push(button)},poiItemDetailIsOpen:()=>false,poiInventoryMove:()=>({ok:true}),toast(){},performance:{now:()=>100}};
 const gameplay=span('function poiBagGestureTarget(','function poiItemDragPosition(')+span('function poiBagWire(','function poiHotbarRender(');
 vm.runInNewContext(gameplay+';poiBagWire();',c);
 const common={isPrimary:true,button:0,pointerId:8,preventDefault(){}};
 const container=open?bag:bar;
 const act=(mode,land)=>{
  for(const fn of container.handlers.pointerdown||[])fn({...common,target:from,clientX:145,clientY:105});
  const entries={outside:[300,80,canvas],tapped:[145,105,from],short:[151,105,canvas],inside:[206,110,canvas],hud:[320,100,{}],slot:[182,130,dest]};
  const [x,y,target]=entries[land];hit=target;
  for(const fn of container.handlers[mode]||[])fn({...common,target,clientX:x,clientY:y});
 };
 return {act,walletLog,dropLog,moveLog,details,from};
}
test('inventory removes the former placement button and quantity prompt, retaining the item detail',()=>{
 assert.doesNotMatch(h,/poiBagGoldDrop/);assert.doesNotMatch(h,/id="poiGoldDropDialog"/);assert.match(h,/id="poiItemDetail"/);
});
test('actual storage pointerup drops just the selected coin source into uncovered world',()=>{
 const f=setup();f.act('pointerup','outside');assert.equal(f.walletLog[0].zone,'wallet');assert.deepEqual(f.dropLog,[]);assert.equal(f.details.length,0);
});
test('taps, HUD, short releases, protected inventory, empty wallet and canceled touches never initiate a pile',()=>{
 for(const land of ['tapped','short','inside','hud']){const f=setup();f.act('pointerup',land);assert.deepEqual(f.walletLog,[],land);assert.equal(f.details.length,land==='tapped'?1:0)}
 const empty=setup({funds:0});empty.act('pointerup','outside');assert.deepEqual(empty.walletLog,[]);
 const canceled=setup();canceled.act('pointercancel','outside');assert.deepEqual(canceled.walletLog,[]);
});
test('internal wallet reorder, ordinary item swipe, and closed shortcut behavior remain separate',()=>{
 const f=setup();f.act('pointerup','slot');assert.equal(f.moveLog.length,1);assert.equal(f.walletLog.length,0);
 const g=setup({origin:'bag'});g.act('pointerup','outside');assert.equal(g.dropLog.length,1);assert.equal(g.walletLog.length,0);
 const closed=setup({open:false});closed.act('pointerup','outside');assert.equal(closed.walletLog.length,0);
});

test('pointer-transparent animated location panel protects its current rectangle beyond the mini HUD',()=>{
 for(const origin of ['wallet','bag']){
  const f=setup({origin,areaPanel:true});
  // The release hits canvas, not the transparent transformed area panel.
  f.act('pointerup','outside');
  assert.equal(f.walletLog.length,0);
  assert.equal(f.dropLog.length,0);
 }
});

test('a split coin on belt gets Details from a tap while inventory is open',()=>{
 const f=setup({origin:'hotbar',split:true});f.act('pointerup','tapped');
 assert.deepEqual(f.details,[f.from]);assert.equal(f.dropLog.length,0);assert.equal(f.walletLog.length,0);
});
