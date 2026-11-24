import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {Script} from 'node:vm';
const html=readFileSync(process.argv[2]||'world-editor.html','utf8');
const hook="  const arm=eye===desired?poiCameraDistance:Math.hypot(...eye.map((v,i)=>v-target[i]));";
assert.equal(html.split(hook).length,2);
const fixture=html.replace(hook,`${hook}
  window.__sharedCameraProbe=()=>({arm,eye,desired,target,yaw:poiCameraYaw,walk:[poiWalkX,poiWalkZ,poiWalkLevel],
   awake:!!poiDavidActive?.s?.david?.awake});
`);
for(const [,body] of fixture.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(body);
if(process.env.CAMERA_PARSE_ONLY){console.log('exact fixture anchors and inline JS pass');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<!doctype html><title>Seed</title>':fixture)});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
let browser;
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 for(const q of [
  {name:'watchtower exterior',x:107,z:61,y:0,yaw:0,hit:true,side:61},
  {name:'north town gate opening',x:34,z:23,y:0,yaw:0,hit:false},
  {name:'mine corridor',x:109,z:60,y:-1,yaw:Math.PI,hit:true,rotate:true},
  {name:'inactive David exterior',x:24,z:123,y:0,yaw:0,hit:true,side:121.5}
 ]){
  const ctx=await browser.newContext({viewport:{width:1120,height:500},isMobile:true,hasTouch:true,deviceScaleFactor:.72});
  const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  try{
   await p.goto(origin+'/seed');await p.evaluate(({x,z,y,yaw})=>{
    localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
     position:{x,z,y,facing:2},townLayout:5,townMapHeight:128,
     view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:y,hideUpper:false,top:false,third:true,orbitYaw:yaw,orbitPitch:.12,orbitDistance:5.5}}));
   },q);
   await p.goto(origin+'/?resume=1&test=1',{waitUntil:'domcontentloaded'});await p.locator('#pineStartupCover').waitFor({state:'hidden'});
   await p.waitForFunction(()=>window.__editorTest?.facility?.().active&&window.__sharedCameraProbe);
   const inspect=()=>p.evaluate(()=>window.__sharedCameraProbe());
   const v=await inspect();assert.deepEqual(v.walk,[q.x,q.z,q.y],q.name+' genuine live saved position');
   if(q.hit)assert(v.arm<5.35,q.name+' blocked arm '+JSON.stringify(v));
   else assert.deepEqual(v.eye,v.desired,q.name+' clear original arm');
   if(q.side)assert(v.eye[2]>=q.side,q.name+' camera remains on player-side z '+JSON.stringify(v));
   if(q.name.includes('David'))assert(!v.awake,'global collision also operates out of combat');
   const heading=({target,eye})=>Math.atan2(eye[0]-target[0],eye[2]-target[2]);
   const err=heading(v)-heading({...v,eye:v.desired});assert(Math.abs(Math.sin(err))<.0001&&Math.cos(err)>.9999,q.name+' bearing');
   if(q.rotate){
    const cdp=await ctx.newCDPSession(p),point=x=>({x,y:238,id:1,radiusX:4,radiusY:4,force:.7});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(756)]});
    for(const dx of [18,36,58])await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point(756+dx)]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await p.waitForFunction(yaw=>Math.abs(window.__sharedCameraProbe().yaw-yaw)>.18,v.yaw);
    assert(Math.abs(Math.sin(heading(await inspect())-heading(v)))>.15);
    await cdp.detach();
   }
   assert.deepEqual(errors,[]);
   console.log(q.name,JSON.stringify({eye:v.eye,arm:v.arm,target:v.target}));
  }finally{await ctx.close()}
 }
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}
