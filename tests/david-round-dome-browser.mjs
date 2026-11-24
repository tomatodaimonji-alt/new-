import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const source=readFileSync(process.argv[2]??'world-editor.html','utf8');
function replace(s,a,b){assert.equal(s.split(a).length,2,a);return s.replace(a,b)}
let fixture=replace(source,"if(facilityParams.get('test')==='1')window.__editorTest={",
 "if(facilityParams.get('test')==='1')window.__editorTest={"+`
  roundDomeQA:{
   state:()=>({x:poiWalkX,z:poiWalkZ,room:facilityHiddenRoof(),visible:facilityVisibleRoofs(),view:poiThirdPerson,sky:poiSkyCanLookUp(),count:facilityRoofMeshes[facilitySite.buildings.findIndex(b=>b.id==='davidTemple')]?.count??0,
    temple:facilitySite.buildings.findIndex(b=>b.id==='davidTemple'),error:gl.getError()}),
   stepVector:key=>poiCameraRelativeStep(key),
   view:(pitch,distance)=>{poiCameraPitch=pitch;poiCameraDistance=distance;poiWalkCamera();}
  },
 `);
const draw='  else draw(facilityRoofMeshes[i],vp);';
fixture=replace(fixture,draw,`
 else {
 const probe=facilitySite.buildings[i]?.id==='davidTemple'?window.__roofPixels:null;
 let prev,w,h;
 if(probe&&!probe.result&&window.pineStartup.ready){
  w=gl.drawingBufferWidth;h=gl.drawingBufferHeight;prev=new Uint8Array(w*h*4);
  gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,prev);
 }
 draw(facilityRoofMeshes[i],vp);
 if(prev){
  const curr=new Uint8Array(prev.length);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,curr);
  let changed=0;const bins=new Set();
  for(let i=0;i<curr.length;i+=4){
   if(Math.abs(prev[i]-curr[i])+Math.abs(prev[i+1]-curr[i+1])+Math.abs(prev[i+2]-curr[i+2])+Math.abs(prev[i+3]-curr[i+3])>24){
    changed++;bins.add(Math.floor((i/4%w)/12));
   }
  }
  probe.result={changed,bins:bins.size};
 }
 }
`);
for(const [,s] of fixture.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(s);
if(process.env.DAVID_DOME_SYNTAX_ONLY){console.log('exact dome fixture scripts parse');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const srv=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>dome QA</title>':fixture)});
await new Promise((r,j)=>srv.listen(0,'127.0.0.1',r).once('error',j));
const root='http://127.0.0.1:'+srv.address().port;let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
 args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const p=await (await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:.75})).newPage(),errors=[];
 p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(16000);await p.goto(root+'/seed');
 await p.evaluate(()=>{
  localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":360000}');
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,position:{x:29,z:88,y:0,facing:2},townLayout:5,townMapHeight:128,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:-.15,orbitPitch:.12,orbitDistance:7}}));
 });
 await p.goto(root+'/?resume=1&test=1');await p.locator('#pineStartupCover').waitFor({state:'hidden'});
 const qa=()=>p.evaluate(()=>window.__editorTest.roundDomeQA.state());
 const capture=async()=>{
  await p.evaluate(()=>window.__roofPixels={result:null});
  await p.waitForFunction(()=>window.__roofPixels?.result);
  return p.evaluate(()=>window.__roofPixels.result);
 };
 let s=await qa();assert.deepEqual([s.x,s.z,s.error],[29,88,0]);assert(s.view&&s.visible.includes(s.temple)&&s.count>2000);
 const outside=await capture();assert(outside.changed>250&&outside.bins>=6,JSON.stringify(outside));
 // True third-person uses camera-relative keys: Up follows south-facing
 // camera forward, and Right follows camera right (world west).
 assert.deepEqual(await p.evaluate(()=>['n','e'].map(k=>window.__editorTest.roundDomeQA.stepVector(k))),[[0,1],[-1,0]]);
 const steps=[[29,89],[29,90],[29,91],[28,91],[27,91],[26,91],[25,91],[24,91],[24,92],[24,93],[24,94],[24,95]];
 for(const [x,z] of steps){
  const at=await qa(),key=x<at.x?'ArrowRight':'ArrowUp';await p.keyboard.press(key);
  try{await p.waitForFunction(([x,z])=>{const s=window.__editorTest.roundDomeQA.state();return s.x===x&&s.z===z},[x,z],{timeout:4000})}
  catch(error){throw new Error(`Camera-relative ${key} from ${at.x},${at.z} expected ${x},${z}; got ${JSON.stringify(await qa())}`,{cause:error})}
  await p.waitForTimeout(190);
 }
 await p.evaluate(()=>window.__editorTest.roundDomeQA.view(.26,5.5));
 s=await qa();assert.equal(s.room,s.temple);assert(s.visible.includes(s.temple),'close lower orbit looks from inside the vaulted roof');
 await p.evaluate(()=>window.__editorTest.roundDomeQA.view(.82,8));
 s=await qa();assert.equal(s.room,s.temple);assert(!s.visible.includes(s.temple),'high orbit cuts only temple roof');assert.equal(s.sky,true);
 assert(s.error===0);assert.deepEqual(errors,[]);
 console.log('real exterior dome framebuffer, same-world walk-in, close vaulted camera and high roof cut');
}finally{await browser?.close();srv.close()}
