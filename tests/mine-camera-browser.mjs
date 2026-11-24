import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const html=readFileSync(process.argv[2]||'world-editor.html','utf8');
const anchor="  const arm=eye===desired?poiCameraDistance:Math.hypot(...eye.map((v,i)=>v-target[i]));";
assert.equal(html.split(anchor).length,2);
const fixture=html.replace(anchor,`${anchor}
  if(location.search.includes('test=1'))window.__mineCameraProbe=()=>{
   const mineCamera=facilitySite?.id==='base'&&poiWalkLevel===-1&&
    poiDungeonPointIn(facilitySite.mine?.bounds,Math.floor(target[0]),Math.floor(target[2]),poiWalkLevel);
   const walls=mineCamera?facilityMineCameraWalls(sceneMesh):[];
   const vector=p=>p.map((v,i)=>v-target[i]);
   return {mineCamera,requested:poiCameraYaw,actualPitch:poiCameraPitch,arm,eye,desired,target,n:walls.length,
    desiredFraction:facilityMineCameraArm(target,vector(desired),walls),actualFraction:facilityMineCameraArm(target,vector(eye),walls)};
  };`);
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url==='/seed'?'<!doctype html><title>Seed</title>':fixture);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const probe=page=>page.evaluate(()=>window.__mineCameraProbe());
async function open(browser,position){
 const ctx=await browser.newContext({viewport:{width:1120,height:500},isMobile:true,hasTouch:true});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
 await page.goto(origin+'/seed');
 await page.evaluate(position=>{
  localStorage.setItem('world-workshop-hotbar-v1','{"version":1,"weapon":"equipWoodSword","potions":0,"gold":12}');
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position,townLayout:5,townMapHeight:128,view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:position.y,hideUpper:false,top:false,
    third:true,orbitYaw:Math.PI,orbitPitch:.12,orbitDistance:5.5}}));
 },position);
 await page.goto(origin+'/?resume=1&test=1');
 await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
 await page.locator('#pineStartupCover').waitFor({state:'hidden'});
 return {ctx,page,errors};
}
let browser;
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const mine=await open(browser,{x:109,z:60,y:-1,facing:2});
 try{
  const {page,ctx}=mine;
  await page.waitForFunction(()=>window.__mineCameraProbe?.().n>0);
  const before=await probe(page);
  assert.equal(before.mineCamera,true);
  assert(before.desiredFraction<.99,'the original arm actually crosses a solid canonical wall '+JSON.stringify(before));
  assert.equal(before.actualFraction,1,'corrected eye line is clear');
  assert(before.arm>=1.75,'sensible view distance in narrow corridor');
  const facing=p=>Math.atan2(p.eye[0]-p.target[0],p.eye[2]-p.target[2]);
  assert(Math.abs(facing(before)-Math.atan2(before.desired[0]-before.target[0],before.desired[2]-before.target[2]))<.002,
    'camera correction only changes pitch or distance, never the requested orbit heading');
  // Independent right-thumb orbit still reaches WebGL and rotates normally.
  const x=756,y=238;
  assert.equal(await page.evaluate(([x,y])=>document.elementFromPoint(x,y)?.id,[x,y]),'view');
  const c=await ctx.newCDPSession(page),point=x=>({x,y,id:1,radiusX:4,radiusY:4,force:.7});
  await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(x)]});
  for(const dx of [18,36,58])await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point(x+dx)]});
  await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.waitForFunction(yaw=>Math.abs(window.__mineCameraProbe().requested-yaw)>.18,before.requested);
  const after=await probe(page);
  assert.equal(after.actualFraction,1);
  assert(Math.abs(Math.atan2(Math.sin(facing(after)-facing(before)),Math.cos(facing(after)-facing(before))))>.18);
  await c.detach();
  assert.deepEqual(mine.errors,[]);
 }finally{await mine.ctx.close()}
 const field=await open(browser,{x:41,z:43,y:0,facing:2});
 try{
  await field.page.waitForFunction(()=>!!window.__mineCameraProbe);
  const v=await probe(field.page);
  assert.equal(v.mineCamera,false);assert.deepEqual(v.eye,v.desired,'surface camera untouched');
  assert.deepEqual(field.errors,[]);
 }finally{await field.ctx.close()}
 console.log('PASS mine corridor arm avoids the actual wall, respects right-thumb orbit, and leaves surface unchanged');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}
