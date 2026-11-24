import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {mkdirSync,readFileSync} from 'node:fs';
import {Script} from 'node:vm';
let source=readFileSync(process.argv[2]??'world-editor.html','utf8');
const anchor='function poiUniformBuildDraw(x,z,phase,render){';
assert.equal(source.split(anchor).length,2);
source=source.replace(anchor,anchor+`
 if(window.__uniformObserve&&poiOutdoorFrame){
  window.__uniformCalls??=[]; window.__uniformCalls.push({x,z,phase});
 }
`);
const a="if(facilityParams.get('test')==='1')window.__editorTest={";
let html=source.replace(a,a+`
 outdoorQA:{
  frameStats:()=>window.__frameWitness??[],
  z:()=>poiWalkZ,
  town:()=>facilitySite.davidTemple?.entrance,
  directions:()=>['n','s','e','w'].map(k=>poiCameraRelativeStep(k)),
  warm:()=>({z:poiWalkZ,x:poiWalkX,view:[poiWalkViewX,poiWalkViewZ],frozen:poiGameFrozen(),now:performance.now(),inside:poiDavidTempleEnclosedAt(facilitySite,poiWalkViewX,poiWalkViewZ,0),
    active:!!poiOutdoorFrame,saved:poiOutdoorCaches.size,drew:poiOutdoorProbe.drawn.length,built:poiOutdoorProbe.built}),

  at:(x,z,yaw,minute)=>{
   const ok=workshopResumeRestorePosition({x,z,y:0,facing:2});
   poiCameraYaw=yaw;poiCameraPitch=.13;poiCameraDistance=6;poiTownClockGameMs=minute*POI_TOWN_MINUTE_MS;
   return ok;
  },
  paint:()=>render(),
  frame:()=>{
   window.__uniformObserve=true;window.__uniformCalls=[];const start=window.performance.now();render();window.__uniformObserve=false;const renderMs=window.performance.now()-start;
   const p=parameters(),w=canvas.width,h=canvas.height,data=new Uint8Array(w*h*4);
   gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,data);
   let snow=0,green=0,opaque=0;
   for(let y=h*.40|0;y<h*.63;y++)for(let x=w*.35|0;x<w*.65;x++){
    const i=(y*w+x)*4,r=data[i],g=data[i+1],b=data[i+2];
    if(data[i+3]<230)continue;opaque++;
    if(r>135&&g>147&&b>155&&b>=r&&g>r)snow++;
    if(g>r*1.12&&g>b*1.07)green++;
   }
   const ref=poiOverlandInspect(),lo=typeof poiOutdoorProbe==='undefined'?null:poiOutdoorProbe;
   return {calls:window.__uniformCalls,stream:poiOverlandDrawing,x:poiWalkX,z:poiWalkZ,site:facilitySite.id,pose:[poiWalkViewX,poiWalkViewZ],w,h,snow,green,opaque,
    weights:poiUniformOutdoorWeights(poiWalkViewX,poiWalkViewZ,85,150),held:!!poiAnalogContact,renderMs,enabled:!!poiOutdoorFrame,query:POI_OUTDOOR_LOD,low:lo?.drawn??[],farBytes:poiOutdoorFarBytes,
    resident:poiOutdoorCaches.size,maxBakeMs:lo?.maxBakeMs,nearBytes:ref.bytes,err:gl.getError()};
  }
 },`);
const r=' requestAnimationFrame(render);';
assert.equal(html.split(r).length,2);html=html.replace(r,' if(!window.__outdoorManual){(window.__frameWitness??=[]).push(performance.now());if(window.__frameWitness.length>180)window.__frameWitness.shift();requestAnimationFrame(render);}');
for(const [,js] of html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(js);
if(process.env.OUTDOOR_PARSE_ONLY)process.exit(0);
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>seed</title>':html)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
let browser,phase='startup',last,errors=[];
try{
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const c=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:.75,isMobile:true,hasTouch:true});
 const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));
 p.on('console',m=>{if(m.type()==='error')console.log('PAGE',m.text().slice(0,350));});
 const enabled=process.env.OUTDOOR_STOCK!=='1';
 await p.goto(url+'/seed');
 await p.evaluate(()=>{
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:84,z:115,y:0,facing:2},townLayout:5,townMapHeight:182,templeDepth:1,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:-.78,orbitPitch:.13,orbitDistance:6}}));
 });
 await p.goto(url+'/?resume=1&test=1'+(enabled?'&uniform-outdoor=1':''),{waitUntil:'domcontentloaded'});
 await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:40000});
 await p.waitForFunction(()=>window.__editorTest?.outdoorQA&&window.__editorTest?.facility()?.active,null,{timeout:12000,polling:35})
  .catch(async e=>{console.error('BOOT',await p.evaluate(()=>({url:location.href,keys:Object.keys(window.__editorTest??{}),startup:window.pineStartup?.failed,query:location.search})),errors);throw e});

 await p.evaluate(()=>{window.__outdoorManual=true});
 const shot=async key=>{if(!process.env.FACILITY_SCREENSHOTS)return;
  mkdirSync(process.env.FACILITY_SCREENSHOTS,{recursive:true});
  await p.screenshot({path:process.env.FACILITY_SCREENSHOTS+'/'+key+'.png'});
 };
 const sample=()=>p.evaluate(()=>window.__editorTest.outdoorQA.frame());
 const set=(...a)=>p.evaluate(a=>window.__editorTest.outdoorQA.at(...a),a);
 const out=[];
 for(const [name,x,z,yaw] of [['stock-gate',41,43,0],['stock-port',84,115,-.8],['stream-port',84,127,Math.PI]]){
  phase=name;assert(await set(x,z,yaw,690));
  await p.evaluate(count=>{for(let i=0;i<count;i++)window.__editorTest.outdoorQA.paint()},64);
  last=await sample();
  assert.deepEqual([last.x,last.z],[x,z]);assert.equal(last.err,0);assert(last.farBytes+last.nearBytes<=4*2**20);
  if(name==='stock-gate')assert(!last.stream&&last.calls.some(e=>e.phase==='stock')&&last.calls.some(e=>e.phase==='stock-roof'),JSON.stringify(last));
  if(name==='stock-port')assert(!last.stream&&last.calls.some(e=>e.phase==='stock-local'),JSON.stringify(last));
  if(name==='stream-port')assert(last.stream&&last.calls.some(e=>e.phase==='stream'),JSON.stringify(last));
  assert(last.calls.length<1400,JSON.stringify(last));
  out.push({name,groups:[...new Set(last.calls.map(e=>e.phase))],calls:last.calls.length,near:last.nearBytes,far:last.farBytes});
  await shot(name);
 }
 phase='ordinary RAF and true player input at real north tunnel threshold, preserving external cache without drawing it';
 await p.bringToFront(); const entrance=await p.evaluate(()=>window.__editorTest.outdoorQA.town());
 assert(entrance&&await set(entrance.x,entrance.z-2,0,690));
 await p.evaluate(()=>{for(let i=0;i<100;i++)window.__editorTest.outdoorQA.paint()});
 const warm=()=>p.evaluate(()=>window.__editorTest.outdoorQA.warm()), before=await warm();
 assert(before.active&&before.saved>3&&!before.inside,JSON.stringify(before));
 await p.evaluate(()=>{window.__frameWitness=[];window.__outdoorManual=false;window.__editorTest.outdoorQA.paint()});
 async function step(dz){
  const start=await warm(), directions=await p.evaluate(()=>window.__editorTest.outdoorQA.directions());
  const i=directions.findIndex(d=>d[0]===0&&d[1]===dz);
  assert(i>=0,JSON.stringify(directions));const key=['ArrowUp','ArrowDown','ArrowRight','ArrowLeft'][i];
  for(let attempt=0;attempt<4;attempt++){
   await p.keyboard.press(key);
   try{await p.waitForFunction(z=>window.__editorTest.outdoorQA.z()===z,start.z+dz,{timeout:320,polling:40});return}
   catch(e){if(await p.evaluate(()=>window.__editorTest.outdoorQA.z())!==start.z)throw e}
  }
  throw Error(JSON.stringify({start,latest:await warm(),directions,dz}));
 }
 for(let i=0;i<6&&(await warm()).z<entrance.z+1;i++)await step(1);
 await p.waitForFunction(()=>{const q=window.__editorTest.outdoorQA.warm();return q.inside&&!q.active},null,{timeout:10000,polling:65}).catch(async()=>{throw Error(JSON.stringify({before,insideFailure:await warm(),entrantFrames:await p.evaluate(()=>window.__editorTest.outdoorQA.frameStats().slice(-12)),errors,entrance}))});
 const inside=await warm();
 assert(inside.inside&&!inside.active&&inside.saved>3&&inside.drew===0,JSON.stringify({before,inside}));
 for(let i=0;i<4&&(await warm()).z>=entrance.z;i++)await step(-1);
 await p.waitForFunction(()=>{const q=window.__editorTest.outdoorQA.warm();return !q.inside&&q.active},null,{timeout:10000,polling:65}).catch(async()=>{throw Error(JSON.stringify({before,inside,exitFailure:await warm(),exitFrames:await p.evaluate(()=>window.__editorTest.outdoorQA.frameStats().slice(-12)),errors,entrance}))});
 const exit=await warm();
 assert(!exit.inside&&exit.active&&exit.saved>3&&exit.built>=inside.built,JSON.stringify({before,inside,exit}));
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({out,temple:{before,inside,exit}},null,1));
}catch(e){console.error('PHASE',phase,JSON.stringify(last),errors);throw e}
finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
