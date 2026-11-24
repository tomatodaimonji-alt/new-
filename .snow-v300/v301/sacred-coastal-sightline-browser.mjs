import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {mkdirSync,readFileSync} from 'node:fs';
import {Script} from 'node:vm';
let html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const replace=(a,b)=>{assert.equal(html.split(a).length,2,a);html=html.replace(a,b)};
const testApi="if(facilityParams.get('test')==='1')window.__editorTest={";
const worldDraw='draw(sceneMesh?.ground,p.vp);poiDrawSceneOcclusion(sceneMesh,p.vp);';
replace(worldDraw,`
 draw(sceneMesh?.ground,p.vp);
 const native=gl.drawArrays,prior=gl.drawElements,record=[];
 const hasTag=sceneMesh?.sacredParts??[];
 const store=(start,count)=>{
  if(gl.getParameter(gl.ARRAY_BUFFER_BINDING)!==sceneMesh?.buf)return;
  record.push([start,count,loc.sacredTempleHide?gl.getUniform(program,loc.sacredTempleHide):0]);
 };
 try{
  gl.drawArrays=function(t,start,count){store(start,count);return native.call(gl,t,start,count)};
  gl.drawElements=function(t,count,type,off){store(off/4,count);return prior.call(gl,t,count,type,off)};
  poiDrawSceneOcclusion(sceneMesh,p.vp);
 }finally{gl.drawArrays=native;gl.drawElements=prior}
 window.__nativeTempleSpans={ranges:hasTag,draws:record,
  owner:facilityVisibilityOwner(),count:sceneMesh?.count,
  roof:facilityVisibleRoofs().includes(facilitySite.buildings.findIndex(b=>b.id==='davidTemple'))};
`);
// The held candidate has a real regional stream path for the eastern
// forest. Count authored named geometry on actual baked and submitted data.
if(html.includes('function poiOverlandPresent(vp)')){
 replace(" for(const o of region.batches.get(id)||[]){", ` for(const o of region.batches.get(id)||[]){
  const tagged=typeof poiSacredTempleVisualMember==='function'&&poiSacredTempleVisualMember(region.layout,o);
  const beforeNamed=m.p.length;
  if(tagged)m.qaSacredSeen=(m.qaSacredSeen||0)+1;
 `);
 replace('  yield;\n }\n for(const group of region.roofGroups.get(id)||[]){',`
  if(tagged&&m.p.length>beforeNamed)m.qaSacredVertices=(m.qaSacredVertices||0)+(m.p.length-beforeNamed)/3;
  yield;
 }
 for(const group of region.roofGroups.get(id)||[]){
 `);
 replace(' const r=upload(m);r.bytes=bytes;', ` const r=upload(m);r.bytes=bytes;
  r.qaSacredSeen=m.qaSacredSeen||0;r.qaSacredVertices=m.qaSacredVertices||0;
 `);
 replace(' for(const o of poiOverlandCommands)draw(o.m,poiOverlandNeighborVP(vp,facilitySite.id,o.id));',`
  const chunks=[...poiOverlandMeshes.values()];
  window.__nativeTempleSpans={stream:true,
   tested:chunks.reduce((n,m)=>n+m.qaSacredSeen,0),
   named:chunks.reduce((n,m)=>n+m.qaSacredVertices,0),
   ranges:[],draws:[],roof:false,count:poiOverlandCommands.reduce((n,q)=>n+q.m.count,0)};
  for(const o of poiOverlandCommands)draw(o.m,poiOverlandNeighborVP(vp,facilitySite.id,o.id));
 `);
}
replace(testApi,testApi+`
 sacredQA:{
  frame:()=>{window.__depthRoofDraws=0;render()},
  details:()=>({port:facilitySite.southPort.market.public,portName:facilitySite.southPort.name,forest:facilitySite.southForest.rest,
    town:facilitySite.town,temple:facilitySite.davidTemple.entrance,day:poiTownClockGameMs}),
  gate:(x,z,yaw,pitch,minute)=>{const ok=workshopResumeRestorePosition({x,z,y:0,facing:2});poiCameraYaw=yaw;poiCameraPitch=pitch;poiCameraDistance=6;poiTownClockGameMs=minute*POI_TOWN_MINUTE_MS;return ok},

  admission:(x,z)=>({passable:poiWalkCanStep(x,z,poiWalkX,poiWalkZ),next:poiWalkNextReady,now:performance.now(),hp:poiPlayerHP}),
  inspect:()=>{
   const f=facilitySite.sacredForest,at=poiAimOrigin(performance.now());
   return {x:poiWalkX,z:poiWalkZ,y:poiWalkLevel,name:poiRegionAt(facilitySite,poiWalkX,poiWalkZ,false,poiWalkLevel).name,
    native:window.__nativeTempleSpans??null,parts:typeof poiSacredTempleViewAmount==='function'?poiSacredTempleViewAmount():null,path:f.route,mapH:MAP_H,roofDraws:window.__depthRoofDraws??0,seen:poiHotbarRead().sacredTempleSeen===true,reveal:f.reveal,tree:f.trees[10],fog:[...gl.getUniform(program,loc.sacredFog)],raster:window.__sacredRaster||null,
    edge:loc.sacredEdge?[...gl.getUniform(program,loc.sacredEdge)]:[0,0,0,0],scene:poiSacredForestStatus(),err:gl.getError(),directions:['n','s','e','w'].map(k=>poiCameraRelativeStep(k)),
    nearTemple:poiDavidTempleContains(facilitySite,at.x,at.z,at.y)};
  }
 },
`);
const raf=' requestAnimationFrame(render);';
replace(raf,' if(!window.__sacredManual)requestAnimationFrame(render);');
for(const [,s] of html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(s);
if(process.env.SACRED_FOREST_SYNTAX_ONLY)process.exit(0);
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>Sacred forest QA</title>':html)});
await new Promise((ok,no)=>server.listen(0,'127.0.0.1',ok).once('error',no));
const base='http://127.0.0.1:'+server.address().port;
let b,last=null,phase='startup';
try{
 b=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const ctx=await b.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:.75});
 const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.clock.install({time:new Date('2026-04-01T10:00:00Z')});
 async function seed(x,z,mapHeight=128,templeDepth){
  await p.goto(base+'/seed',{waitUntil:'domcontentloaded',timeout:45000});
  await p.evaluate(({x,z,mapHeight,templeDepth})=>{
   localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":360000}');
   localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,position:{x,z,y:0,facing:2},
    townLayout:5,townMapHeight:mapHeight,templeDepth,view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:-.15,orbitPitch:.13,orbitDistance:6}}));
  },{x,z,mapHeight,templeDepth});
  await p.goto(base+'/?resume=1&test=1',{waitUntil:'domcontentloaded',timeout:45000});
  await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:35000});
  await p.waitForFunction(()=>window.__editorTest?.facility()?.active,null,{polling:50,timeout:30000});
  await p.clock.pauseAt((await p.evaluate(()=>Date.now()))+1500);
  await p.evaluate(()=>{window.__sacredManual=true});
 }
 const inspect=async()=>last=await p.evaluate(()=>window.__editorTest.sacredQA.inspect());
 const tick=async(ms=225)=>{await p.clock.fastForward(ms);await p.evaluate(()=>window.__editorTest.sacredQA.frame());return inspect()};
 const screenshot=async name=>{if(process.env.FACILITY_SCREENSHOTS){mkdirSync(process.env.FACILITY_SCREENSHOTS,{recursive:true});await p.screenshot({path:process.env.FACILITY_SCREENSHOTS+'/'+name+'.png'});}};
 const baseline=process.env.SACRED_STOCK==='1',mode=baseline?'stock':'coastal';
 await seed(41,75);const camera=async(x,z,yaw,pitch,minute)=>{
  assert(await p.evaluate(args=>window.__editorTest.sacredQA.gate(...args),[x,z,yaw,pitch,minute]));
  let s=await tick(45);
  for(let i=0;i<3;i++)s=await tick(60);
  assert.deepEqual([s.x,s.z,s.y],[x,z,0]);assert.equal(s.err,0);return s;
 };
 const detail=await p.evaluate(()=>window.__editorTest.sacredQA.details());
 console.log('COASTAL MAP ANCHORS',JSON.stringify(detail));
 const samples=[];let observedStream=false,observedNames=0;
 function overlap(r,d){return Math.max(0,Math.min(r[1],d[0]+d[1])-Math.max(r[0],d[0]));}
 function draws(s){return s.native.ranges.reduce((n,r)=>n+s.native.draws.reduce((k,d)=>k+overlap(r,d),0),0);}
 const cases=[
  ['base-gate',41,62,-.15,.23,20],['base-gate-angle',40,62,-.30,.16,690],
  ['forest',54,119,-.65,.16,52],['forest-west-edge',49,119,-.47,.22,690],
  ['forest-other-angle',54,117,-.78,.25,690],
  ['port',detail.port.x,detail.port.z,-1.08,.20,690],
  ['port-other-angle',detail.port.x,detail.port.z,-.95,.30,52],
  ...(!baseline&&html.includes('function poiOverlandPresent(vp)')?
   [['snow-neck-lookback',49,134,-.33,.21,690],['snow-neck-far',53,135,-.45,.19,52]]:[]),
  ['approach-hidden',24,114,0,.12,690],['approach-fade',24,119,0,.12,690],
  ['entry',24,125,0,.12,690],['tunnel',24,131,0,.12,52]
 ];
 for(const [key,x,z,yaw,pitch,minute] of cases){
  phase=key;const s=await camera(x,z,yaw,pitch,minute),v=draws(s);
  samples.push({key,name:s.name,amount:s.parts,v,roof:s.native.roof,buffers:s.scene.sections,vertices:s.scene.vertices,ranges:s.native.ranges,owner:s.native.owner,submitted:s.native.draws.reduce((n,d)=>n+d[1],0)});
  assert.equal(s.mapH,182);assert(s.scene.sections<=9);assert.equal(s.seen,key==='tunnel');
  if(!baseline){
   if(s.native.stream){
    assert(s.native.count>0);assert.equal(s.native.named,0);
    observedStream=true;observedNames+=s.native.tested;
   }else assert(s.native.ranges.length>0);
   if(key==='entry'||key==='tunnel'){assert.equal(s.parts,1);assert(s.native.roof);assert(v>1e3);}
   else if(key==='approach-fade'){assert(s.parts>0&&s.parts<1);assert(s.native.roof);assert(v>1e3);assert(s.native.draws.some(d=>d[2]>0&&d[2]<1));}
   else{assert.equal(s.parts,0);assert(!s.native.roof);assert.equal(v,0);}
  }
  if(key==='forest'||key==='forest-west-edge')assert.equal(s.name,'潮風の森');
  if(key.includes('port'))assert.equal(s.name,detail.portName);
  await screenshot(mode+'-'+key);
 }
 if(!baseline){
  phase='native continuous approach from a concealed entry to solid stone';
  let s=await camera(24,114,0,.12,690),prior=s.parts,history=[];
  for(let z=115;z<=129;z++){
   const i=s.directions.findIndex(d=>d[0]===0&&d[1]===1);
   assert(i>=0);await p.keyboard.press(['ArrowUp','ArrowDown','ArrowRight','ArrowLeft'][i]);
   s=await tick(225);assert.deepEqual([s.x,s.z],[24,z]);
   assert(s.parts>=prior-1e-6);prior=s.parts;
   if(z>=124)assert.equal(s.parts,1);
   history.push([z,s.parts,draws(s)]);
  }
  assert(history.some(([,u])=>u>0&&u<1));
  assert.equal((await p.evaluate(()=>window.__editorTest.sacredQA.admission(22,129))).passable,false);
  console.log('COASTAL AUTHENTIC APPROACH',JSON.stringify(history));
 }
 if(!baseline&&html.includes('function poiOverlandPresent(vp)')){
  assert(observedStream,'actual chunk rendering used near the snow neck');
  assert(observedNames>0,'real hidden authored temple pieces reached the streamed bake filter');
 }
 if(baseline)assert(samples.find(s=>s.key==='forest').roof,'stock dome is submitted from the reported coastal forest');
 assert.deepEqual(errors,[]);
 console.log('COASTAL WEBGL SUBMISSIONS',JSON.stringify({mode,samples}));
}catch(e){console.error(phase,last&&{x:last.x,z:last.z,y:last.y,name:last.name,fog:last.fog,raster:last.raster,scene:last.scene,directions:last.directions});throw e}
finally{await b?.close();await new Promise(ok=>server.close(ok))}
