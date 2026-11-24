import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
function inject(s,a,b){assert.equal(s.split(a).length,2,a);return s.replace(a,b)}
const eyeAnchor=html.match(/  const arm=eye===desired\?(?:radius|poiCameraDistance):Math\.hypot\(\.\.\.eye\.map\(\(v,i\)=>v-target\[i\]\)\);/)?.[0];
assert(eyeAnchor,'actual perspective arm');
let fixture=inject(html,eyeAnchor,eyeAnchor+`
  if(window.__qaSkyCamera)window.__qaSkyEye={eye,target,pitch:Math.atan2(eye[1]-target[1],Math.hypot(eye[0]-target[0],eye[2]-target[2]))};`);
const api='  freeMovementPose:()=>({x:poiWalkViewX,z:poiWalkViewZ,level:poiWalkLevel}),';
fixture=inject(fixture,api,api+`
  surfaceSkyQA:{
   start:()=>{window.__qaSkyCamera=true},
   pixels:()=>{window.__qaSkyPixels=null;window.__qaSampleSky=true},
   read:()=>{
    const wrap=$('viewWrap'),cs=getComputedStyle(wrap),cv=getComputedStyle(canvas),before=getComputedStyle(wrap,'::before');
    return {x:poiWalkX,z:poiWalkZ,level:poiWalkLevel,third:poiThirdPerson,pitch:poiCameraPitch,view:window.__qaSkyEye,
     sky:wrap.hasAttribute('data-poi-sky'),analog:!!poiAnalogContact,backdrop:cs.backgroundImage,pseudo:before.backgroundImage,
     top:cs.getPropertyValue('--poi-sky-top').trim(),horizon:cs.getPropertyValue('--poi-sky-horizon').trim(),
     canvasBackground:cv.backgroundColor,glAlpha:gl.getContextAttributes()?.alpha,pixels:window.__qaSkyPixels,
     saved:JSON.parse(localStorage.getItem('world-workshop-resume-v1')||'null')?.view?.orbitPitch};
   }
  },`);
const lastDraw=' poiScreenNoteCaptureFrame();';
fixture=inject(fixture,lastDraw,`
 if(window.__qaSampleSky){
  window.__qaSampleSky=false;
  window.__qaSkyPixels=[.9,.95,.98].flatMap(v=>[.26,.42,.5,.58,.74].map(u=>{
   const rgba=new Uint8Array(4);
   gl.readPixels(Math.floor(canvas.width*u),Math.floor(canvas.height*v),1,1,gl.RGBA,gl.UNSIGNED_BYTE,rgba);
   return {u,v,a:rgba[3]};
  }));
 }`+lastDraw);
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<!doctype html><title>Sky camera QA</title>':fixture)});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const origin='http://127.0.0.1:'+server.address().port;
let browser,checkpoint='launch';
const watchdog=setTimeout(()=>{console.error('Sky browser stalled at: '+checkpoint);process.exit(1)},65000);
async function boot(position){
 const ctx=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:.75,isMobile:true,hasTouch:true});
 const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(13000);
 await p.goto(origin+'/seed');
 await p.evaluate(position=>{
  localStorage.setItem('world-workshop-hotbar-v1','{"version":1,"weapon":"equipWoodSword","potions":0}');
  localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":360000}');
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{...position,facing:2},townLayout:5,townMapHeight:128,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:position.y,hideUpper:false,top:false,third:true,orbitYaw:Math.PI,orbitPitch:.35,orbitDistance:5.5}}));
 },position);
 await p.goto(origin+'/?resume=1&test=1');
 const when=(f,a=null,t=5500)=>p.waitForFunction(f,a,{polling:40,timeout:t});
 async function loaded(){
  await p.locator('#pineStartupCover').waitFor({state:'hidden'});
  await when(()=>window.__editorTest?.facility()?.active&&document.querySelector('#viewWrap').hasAttribute('data-analog-play'));
  await p.evaluate(()=>window.__editorTest.surfaceSkyQA.start());
  await when(()=>window.__editorTest.surfaceSkyQA.read().view);
 }
 const q=()=>p.evaluate(()=>window.__editorTest.surfaceSkyQA.read());
 await loaded();
 const cdp=await ctx.newCDPSession(p);
 async function dragUp(){
  const coords=await p.evaluate(()=>{
   const stage=document.querySelector('#view').getBoundingClientRect();
   for(const fx of [.64,.68,.72,.76,.60,.80])for(const fy of [.67,.61,.55]){
    const x=Math.round(stage.left+stage.width*fx),y=Math.round(stage.top+stage.height*fy);
    if(document.elementFromPoint(x,y)?.id==='view')return [x,y];
   }
   return null;
  });
  assert(coords,'a genuine right-side camera surface remains accessible');
  const point=(x,y)=>({x,y,id:1,radiusX:4,radiusY:4,force:.7});
  const [x,y]=coords;
  const touch=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
  await touch('touchStart',[point(x,y)]);
  for(const step of [22,45,70,102,124])await touch('touchMove',[point(x,y-step)]);
  await touch('touchEnd',[]);
 }
 return {p,ctx,errors,q,when,loaded,dragUp,cdp};
}
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 checkpoint='surface existing default and right-thumb drag';
 const surface=await boot({x:66,z:4,y:0});
 try{
  const {p,q,when,loaded,dragUp}=surface;
  const normal=await q();
  assert(normal.third&&normal.level===0&&Math.abs(normal.pitch-.35)<.002,'normal third-person default remains unchanged');
  assert(normal.sky&&parseFloat(normal.horizon)>15&&parseFloat(normal.horizon)<22,'normal orbit still shows the physical horizon on unobstructed surface');
  await dragUp();
  const raised=await q();
  assert(raised.pitch<.04,'real right-thumb orbit must rise past the old .12 clamp: '+JSON.stringify(raised));
  assert(Math.abs(raised.pitch-(-.16))<.02,'raise stops at a shallow sensible limit');
  await when(()=>window.__editorTest.surfaceSkyQA.read().sky);
  const sky=await q();
  assert(sky.view.pitch<.07,'the real scene camera tilts, not just its stored preference');
  assert(sky.x===normal.x&&sky.z===normal.z&&!sky.analog,'camera gesture does not walk the player');
  assert(sky.top&&sky.horizon,'daylight colors resolve into renderer backdrop variables');
  assert(sky.backdrop!==normal.backdrop||sky.pseudo!==normal.pseudo,'computed scene backdrop visibly changes');
  assert(sky.glAlpha&&(/rgba\(0, 0, 0, 0\)|transparent/.test(sky.canvasBackground)),'the canvas can actually reveal its sky backdrop');
  await p.evaluate(()=>window.__editorTest.surfaceSkyQA.pixels());
  await when(()=>window.__editorTest.surfaceSkyQA.read().pixels?.length===15);
  assert((await q()).pixels.some(v=>v.a<=4),'real rendered upper scene has transparent sky pixels');
  checkpoint='outdoor orbit remains after resume reload';
  await when(()=>window.__editorTest.surfaceSkyQA.read().saved<.04);
  await p.reload();await loaded();
  await when(()=>window.__editorTest.surfaceSkyQA.read().sky);
  const re=await q();assert(Math.abs(re.pitch-sky.pitch)<.005&&re.view.pitch<.07,'restored upward camera has its actual former pitch and sky');
  assert.deepEqual(surface.errors,[]);
 }catch(e){console.error(checkpoint,JSON.stringify(await surface.q().catch(()=>null)),surface.errors);throw e}
 finally{await surface.cdp.detach();await surface.ctx.close()}
 checkpoint='mine dark background and right-thumb drag';
 const cellar=await boot({x:109,z:60,y:-1});
 try{
  const {p,q,when,dragUp}=cellar;
  const before=await q();
  assert(before.third&&before.level===-1);
  assert(await p.locator('#app').evaluate(el=>el.classList.contains('facilityCellar')));
  assert.equal(before.sky,false);
  await dragUp();
  await when(before=>window.__editorTest.surfaceSkyQA.read().pitch<before-.10,before.pitch);
  const after=await q();
  assert.equal(after.level,-1);assert.equal(after.sky,false,'the same physical camera gesture never shows sky in the mine');
  assert.equal(after.backdrop,before.backdrop,'original dark mine background is unchanged');
  assert.equal(after.pseudo,before.pseudo);
  assert(after.view.pitch>=.105,'mine retains the old lower camera angle, not the raised outdoor lens');
  assert.deepEqual(cellar.errors,[]);
 }catch(e){console.error(checkpoint,JSON.stringify(await cellar.q().catch(()=>null)),cellar.errors);throw e}
 finally{await cellar.cdp.detach();await cellar.ctx.close()}
 console.log('PASS real right-touch upward orbit, transparent rendered outdoor horizon, persisted tilt, and preserved underground darkness');
}finally{await browser?.close();await new Promise(r=>server.close(r));clearTimeout(watchdog)}
