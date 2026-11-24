import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {mkdirSync,readFileSync} from 'node:fs';
import {Script} from 'node:vm';
let html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const replace=(a,b)=>{assert.equal(html.split(a).length,2,a);html=html.replace(a,b)};
const testApi="if(facilityParams.get('test')==='1')window.__editorTest={";
replace(testApi,testApi+`
 sacredQA:{
  frame:()=>{window.__depthRoofDraws=0;render()},
  gate:(x,z,yaw,pitch,minute)=>{const ok=workshopResumeRestorePosition({x,z,y:0,facing:2});poiCameraYaw=yaw;poiCameraPitch=pitch;poiCameraDistance=6;poiTownClockGameMs=minute*POI_TOWN_MINUTE_MS;return ok},

  admission:(x,z)=>({passable:poiWalkCanStep(x,z,poiWalkX,poiWalkZ),next:poiWalkNextReady,now:performance.now(),hp:poiPlayerHP}),
  inspect:()=>{
   const f=facilitySite.sacredForest,at=poiAimOrigin(performance.now()),frame=poiLocalFrame,entry=facilitySite.davidTemple.entrance;
   const local=frame&&{crop:frame.crop,x:frame.x,z:frame.z,length:frame.cells.length,
    center:frame.cells[POI_LOCAL_HALF*POI_LOCAL_SIDE+POI_LOCAL_HALF],
    entry:entry.x>=frame.crop.x1&&entry.x<=frame.crop.x2&&entry.z>=frame.crop.z1&&entry.z<=frame.crop.z2?
     frame.cells[(entry.z-frame.crop.z1)*POI_LOCAL_SIDE+entry.x-frame.crop.x1]:null};
   return {x:poiWalkX,z:poiWalkZ,y:poiWalkLevel,name:poiRegionAt(facilitySite,poiWalkX,poiWalkZ,false,poiWalkLevel).name,
    path:f.route,mapH:MAP_H,roofDraws:window.__depthRoofDraws??0,local,isConcealed:frame?.concealed,seen:poiHotbarRead().sacredTempleSeen===true,reveal:f.reveal,tree:f.trees[10],fog:[...gl.getUniform(program,loc.sacredFog)],raster:window.__sacredRaster||null,
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
 const baseline=process.env.SACRED_STOCK==='1',mode=baseline?'stock':'veil';
 await seed(41,75);const camera=async(x,z,yaw,pitch,minute)=>{
  assert(await p.evaluate(args=>window.__editorTest.sacredQA.gate(...args),[x,z,yaw,pitch,minute]));
  let s=await tick(45);
  if(z===125)for(let i=0;i<4;i++)s=await tick(85);
  assert.deepEqual([s.x,s.z,s.y],[x,z,0]);assert.equal(s.err,0);
  assert(s.local?.center>0,'real local minimap records the physical player cell');
  assert.deepEqual([s.local.x,s.local.z],[x,z]);
  const {x1,z1,x2,z2}=s.local.crop;
  assert.deepEqual([x1,z1,x2,z2],[x-20,z-20,x+20,z+20]);assert.equal(s.local.length,41*41);
  return s;
 };
 phase='actual 21:21 screenshot east trail and two nearby yaw angles';
 const samples=[];
 for(const minute of [1281,690]){
  for(const [x,z,yaw,pitch] of [[41,75,-.16,.04],[41,77,-.42,.13],[38,79,-.20,.08]]){
   const s=await camera(x,z,yaw,pitch,minute);samples.push({x,z,minute,yaw,local:s.fog[2],edge:s.edge});
   assert.equal(s.name,'外');assert.equal(s.fog[2],0);assert.equal(s.isConcealed,true);assert.equal(s.seen,false);assert.equal(s.local.entry,null);assert.equal(s.roofDraws,0);
   if(baseline)assert.equal(s.edge[3],0);else assert(s.edge[3]>.73);
   await screenshot(mode+'-east-'+minute+'-'+x+'-'+z);
  }
 }
 phase='ordinary meadow and gates remain clear through day/night, and forecourt reveals';
 for(const [x,z,yaw,pitch,m,key] of [[23,49,-.08,.14,1281,'west'],[41,69,-.42,.12,690,'south'],[24,125,0,.12,1281,'reveal']]){
  const s=await camera(x,z,yaw,pitch,m);
  if(key==='reveal'){assert.equal(s.edge[3],0);assert.equal(s.isConcealed,true);assert.equal(s.seen,false);assert.equal(s.local.entry,0,'the actual door cell remains uncharted even within the local crop');assert(s.scene.active);}
  else{assert.equal(s.roofDraws,0);assert(s.edge[3]<.09);}
  await screenshot(mode+'-'+key);
 }
 assert.deepEqual(errors,[]);
 console.log('EAST EDGE REAL CAMERA',JSON.stringify({mode,samples}));
}catch(e){console.error(phase,last&&{x:last.x,z:last.z,y:last.y,name:last.name,fog:last.fog,raster:last.raster,scene:last.scene,directions:last.directions});throw e}
finally{await b?.close();await new Promise(ok=>server.close(ok))}
