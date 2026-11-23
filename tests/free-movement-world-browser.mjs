import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';

const html=readFileSync(process.argv[2]||'world-editor.html','utf8');
const fixtureNeedle=' const p=poiWildPick(rng);';
assert.equal(html.split(fixtureNeedle).length,2);
const fixture=html.replace(fixtureNeedle,' const p=null;'); // deterministically remove unrelated random field encounters
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.setHeader('Cache-Control','no-store');res.end(req.url==='/seed'?'<!doctype html><title>Isolated save fixture</title>':fixture);
});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const origin='http://127.0.0.1:'+server.address().port;
const resumeKey='world-workshop-resume-v1',kitKey='world-workshop-hotbar-v1';
const kit='{"version":1,"weapon":"equipWoodSword","potions":2,"gold":18,"claimedCaches":["glade"]}';
const pos=page=>page.evaluate(()=>window.__editorTest.facility().position);
const stored=page=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),resumeKey);
const touch=(x,y,id=1)=>({x:Math.round(x),y:Math.round(y),id,radiusX:6,radiusY:6,force:.7});
async function open(browser,point,options={}){
 const {third=false,width=740,height=390}=options;
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(15000);
 await page.goto(origin+'/seed');
 await page.evaluate(({point,third,resumeKey,kitKey,kit})=>{
  localStorage.setItem(kitKey,kit);
  localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":330000}');
  localStorage.setItem(resumeKey,JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:point.x,z:point.z,y:0,facing:2},townLayout:5,townMapHeight:128,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 },{point,third,resumeKey,kitKey,kit});
 await page.goto(origin+'/?resume=1&test=1');
 await page.waitForFunction(()=>window.__editorTest?.facility?.()?.active);
 assert.deepEqual(await pos(page),{...point,level:0});
 const cdp=await context.newCDPSession(page);
 const send=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
 const pad=page.locator('#poiAnalogPad');
 return {page,context,errors,send,pad};
}
async function center(pad,ratioX=.48,ratioY=.50,id=1){
 const box=await pad.boundingBox();
 assert.ok(box&&box.width>48&&box.height>40,'landscape pad is a thumb-sized visible region');
 return touch(box.x+box.width*ratioX,box.y+box.height*ratioY,id);
}
const held=(pad)=>pad.evaluate(el=>el.hasAttribute('data-active'));
const targetIsPad=(page,p)=>page.evaluate(({x,y})=>!!document.elementFromPoint(x,y)?.closest('#poiAnalogPad'),p);

const pose=page=>page.evaluate(()=>window.__editorTest.freeMovementPose());

async function push(send,pad,dx,dy){
 const at=await center(pad,.5,.45);
 await send('touchStart',[at]);await send('touchMove',[touch(at.x+dx,at.y+dy)]);
}
const landing={x:100,z:90,level:-1},surface={x:118,z:87,level:0};
async function portal(browser){
 const {page,context,errors,send,pad}=await open(browser,{x:118,z:87});
 const state=()=>page.evaluate(()=>window.__editorTest.facility());
 const waitAt=p=>page.waitForFunction(p=>{
  const a=window.__editorTest.facility().position;
  return a.x===p.x&&a.z===p.z&&a.level===p.level;
 },p);
 try{
  await push(send,pad,0,50);
  await waitAt(landing);
  assert.equal((await state()).dungeonEntranceSerial,1);
  assert.equal(await held(pad),false);
  await page.waitForTimeout(450);
  assert.deepEqual(await pos(page),landing,'a held thumb stops immediately at the authored portal arrival');
  const inner=await stored(page);
  assert.deepEqual([inner.position.x,inner.position.z,inner.position.y],[100,90,-1]);
  await send('touchEnd',[]);
  await push(send,pad,0,50);
  await waitAt(surface);
  await send('touchEnd',[]);
  await page.waitForTimeout(300);
  assert.deepEqual(await pos(page),surface,'return portal does not move the player farther or bounce');
  assert.equal(await page.evaluate(k=>localStorage.getItem(k),kitKey),kit);
  assert.deepEqual(errors,[]);
 }finally{await context.close()}
}
async function market(browser){
 for(const z of [111,112]){
  const {page,context,errors,send,pad}=await open(browser,{x:103,z});
  try{
   const type=await page.evaluate(z=>window.__editorTest.data().world.find(o=>o.x===102&&o.z===z&&o.y===0&&/plasterwall/.test(o.type))?.type,z);
   assert.equal(type,z===111?'plasterwallWindow':'plasterwallDoor','the two neighboring real wall/door cells are unchanged');
   await push(send,pad,-50,0);
   if(z===111){
    await page.waitForTimeout(480);
    assert.deepEqual(await pos(page),{x:103,z,level:0});
    const a=await pose(page);
    assert(a.x>=102.61&&a.x<102.99,'player approaches the window but its footprint stays clear');
   }else{
    await page.waitForFunction(()=>window.__editorTest.facility().position.x===101);
    assert.equal((await pos(page)).z,112,'the authored door permits ordinary movement into the market');
   }
   await send('touchEnd',[]);assert.deepEqual(errors,[]);
  }finally{await context.close()}
 }
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await market(browser);
 await portal(browser);
 console.log('PASS actual continuous input through an authored doorway and portal exactly once, blocked by its adjacent wall, preserving existing save');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
