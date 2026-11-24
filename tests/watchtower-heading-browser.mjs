import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';

const html=readFileSync(process.argv[2]||'world-editor.html','utf8');
// Probe the eye selected by production just before its distance/FOV use.
const sharedArm="const eye=typeof facilitySharedWallCameraEye==='function'?facilitySharedWallCameraEye(target,desired):desired;";
const cameraLine='const arm=eye===desired?poiCameraDistance:Math.hypot(...eye.map((v,i)=>v-target[i]));';
assert.equal(html.split(sharedArm).length,2,'unique actual shared wall arm');
assert.equal(html.split(cameraLine).length,2,'unique final orbit eye consumption');
const at=html.indexOf(cameraLine);
assert(html.slice(at-220,at).includes(sharedArm),'the shared arm directly feeds the sampled eye');
const random=' const p=poiWildPick(rng);';
assert.equal(html.split(random).length,2);
const fixture=html.replace(random,' const p=null;').replace(cameraLine,cameraLine+`
 if(poiWalkLevel===0&&window.__towerOrbitSamples&&window.__towerOrbitSamples.length<1200){
  const v=eye.map((a,i)=>a-target[i]),seen=Math.atan2(-v[0],-v[2]);
  const delta=Math.atan2(Math.sin(seen-poiCameraYaw),Math.cos(seen-poiCameraYaw));
  window.__towerOrbitSamples.push({x:target[0],z:target[2],delta,distance:Math.hypot(...v),rise:v[1],yaw:poiCameraYaw});
 }`);
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','no-store');
 res.end(req.url==='/seed'?'<!doctype html><title>Watchtower QA fixture</title>':fixture);
});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const root='http://127.0.0.1:'+server.address().port;
const resumeKey='world-workshop-resume-v1',kitKey='world-workshop-hotbar-v1';
const kit='{"version":1,"weapon":"equipWoodSword","potions":2,"gold":18,"claimedCaches":["glade"],"towerFind":{"kind":"claimed"}}';
async function verify(browser,orbitYaw,dy,rear=false){
 const route={x:108,z:rear?55:61,y:0,facing:rear?2:0};
 const ctx=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
 try{
  await page.goto(root+'/seed');
  await page.evaluate(({route,orbitYaw,kitKey,resumeKey,kit})=>{
   localStorage.setItem(kitKey,kit);
   localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":575000}');
   localStorage.setItem(resumeKey,JSON.stringify({version:1,route:'facility',id:'base',play:true,
    position:route,townLayout:5,townMapHeight:128,view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,
     top:false,third:true,orbitYaw,orbitPitch:.35,orbitDistance:5.5}}));
  },{route,orbitYaw,kitKey,resumeKey,kit});
  await page.goto(root+'/?resume=1&test=1');
  await page.waitForFunction(()=>window.__editorTest?.facility?.()?.active);
  await page.locator('#pineStartupCover').waitFor({state:'hidden'});
  const pos=()=>page.evaluate(()=>window.__editorTest.facility().position);
  assert.deepEqual(await pos(),{x:108,z:route.z,level:0});
  const objects=await page.evaluate(()=>window.__editorTest.data().world.filter(o=>
   o.x===108&&o.z===60&&o.y===0||o.x===107&&o.z===57&&o.y===0));
  assert(objects.some(o=>o.x===108&&o.z===60&&o.type==='ruinDoorBroken'));
  assert(objects.some(o=>o.x===107&&o.z===57&&o.type==='rubble'));
  const pad=page.locator('#poiAnalogPad');
  const box=await pad.boundingBox();
  assert(box,'real landscape analog control available');
  const cdp=await ctx.newCDPSession(page);
  const p=(x,y)=>({x:Math.round(x),y:Math.round(y),id:1,radiusX:4,radiusY:4,force:.7});
  const x=box.x+box.width/2,y=box.y+box.height/2;
  await page.evaluate(()=>{window.__towerOrbitSamples=[]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p(x,y)]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[p(x,y+dy)]});
  await page.waitForFunction(rear=>{const z=window.__editorTest.freeMovementPose().z;return rear?z>58.1:z<58.9},rear);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const read=await page.evaluate(()=>window.__towerOrbitSamples);
  assert(rear?(read.some(s=>s.z<55.65)&&read.some(s=>s.z>57.1)):(read.some(s=>s.z>61.35)&&read.some(s=>s.z<59.9)),
   'the sampled rendered frames straddle the real '+(rear?'rear':'front')+' opening');
  assert(read.every(s=>Math.abs(s.x-108.5)<.04),'left input carries the avatar straight through the doorway');
  const bad=read.find(s=>!Number.isFinite(s.delta)||Math.abs(s.delta)>.015);
  assert(!bad,'desired and rendered azimuth agree with fixed thumb input: '+JSON.stringify(bad));
  const tooClose=read.find(s=>s.distance<1.65);
  assert(!tooClose,'camera must not enter or fill its view with the avatar: '+JSON.stringify(tooClose));
  assert.equal(await page.evaluate(k=>localStorage.getItem(k),kitKey),kit);
  assert.deepEqual(errors,[]);
 }finally{await ctx.close()}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await verify(browser,Math.PI,-50);
 await verify(browser,0,50);
 await verify(browser,0,-50,true);
 await verify(browser,Math.PI,50,true);
 console.log('PASS real watchtower doorway traversal and stable third-person azimuth at both held directions');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
