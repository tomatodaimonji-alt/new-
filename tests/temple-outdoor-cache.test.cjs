const a=require('node:assert/strict'),{test}=require('node:test'),vm=require('node:vm');
const h=require('node:fs').readFileSync(process.env.WARM_HTML??'world-editor.html','utf8');
test('exact lifecycle parks real cached handles without frame publication and clears on deep approach or identity changes',()=>{
 const start=h.indexOf('let poiStockOutdoorWarm=null;');a(start>=0);
 const source=h.slice(start,h.indexOf('function poiOutdoorLate(',start));
 const site={id:'base'},world=[],snow={},far=new Map([['real',{bytes:100}]]);let now=10,inside=false;
 const state={facilitySite:site,world,poiOverlandSnow:snow,POI_SHARED_GROUND:true,POI_OUTDOOR_FAR_PEAK:768,POI_OVERLAND_GPU_LIMIT:4096,
  poiOutdoorCaches:far,poiOutdoorFarBytes:100,poiOutdoorProbe:{drawn:['old']},poiOutdoorPlan:{key:'plan'},poiOutdoorFrame:null,poiWalkActive:true,poiWalkLevel:0,
  poiWalkViewX:24,poiWalkViewZ:127,poiOverlandMeshes:new Map(),facilitySurfaceEdited:false,cameraTopDown:false,pineAIActive:false,
  canvas:{addEventListener(){}},window:{addEventListener(){}},performance:{now:()=>now},
  poiOutdoorLodMayRun:()=>!inside,poiDavidTempleEnclosedAt:()=>inside,poiOverlandGlobal:(id,x,z)=>[x,z]};
 state.poiOutdoorDrop=k=>{state.poiOutdoorFarBytes=0;far.delete(k)};
 vm.createContext(state);vm.runInContext(source,state);
 state.poiOutdoorLodBegin();const original=far.get('real');a(state.poiOutdoorFrame);
 inside=true;state.poiWalkViewZ=129;now=1000;state.poiOutdoorLodBegin();
 a.equal(state.poiOutdoorFrame,null);a.equal(state.poiOutdoorProbe.drawn.length,0);a.equal(far.get('real'),original);
 inside=false;state.poiWalkViewZ=127;now=1200;state.poiOutdoorLodBegin();a.equal(far.get('real'),original);a(state.poiOutdoorFrame);
 inside=true;state.poiWalkViewZ=129;now=1600;state.poiOutdoorLodBegin();a.equal(far.get('real'),original);
 now=950000;state.poiOutdoorLodBegin();a.equal(far.get('real'),original);
 state.poiWalkViewZ=134;state.poiOutdoorLodBegin();a.equal(far.size,0);
 inside=false;state.poiWalkViewZ=127;
 far.set('real',original);state.poiOutdoorFarBytes=100;state.poiOutdoorLodBegin();
 inside=true;
 state.poiOverlandMeshes.set('pressure',{bytes:4000});
 a.equal(state.poiStockOutdoorWarmBlock(),'budget');
 state.poiOverlandMeshes.clear();
 state.world=[];state.poiOutdoorLodBegin();a.equal(far.size,0);a.equal(state.poiOutdoorFrame,null);
});
test('cache disposes immediately on actual map edits, region transitions, and GL context disposal',()=>{
 for(const anchor of ["function commit(){poiOutdoorSpecs.delete(world);poiStockOutdoorWarmClear('map-edit');","function facilityLoadMap(map,quietPresentation=false){\n poiStockOutdoorWarmClear('map-load');",
  "poiWalkFrameNoRegionRemote(!cold);\n poiStockOutdoorWarmClear('region-change');\n facilitySite=incoming;",
  "canvas.addEventListener('webglcontextlost',()=>poiStockOutdoorWarmClear('context-loss'))","window.addEventListener('pagehide',()=>poiStockOutdoorWarmClear('page-hide'))"])
  a(h.includes(anchor),anchor);
});
