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
async function continuous(browser){
 const point={x:102,z:93};
 const {page,context,errors,send,pad}=await open(browser,point);
 try{
  assert.deepEqual(await pose(page),{...point,level:0},'exact loaded tile center');
  const start=await center(pad,.45,.45);
  await send('touchStart',[start]);
  await send('touchMove',[touch(start.x+16,start.y+7)]); // normalized heading ≈ 23.6° and submax speed
  const samples=await page.evaluate(()=>new Promise(resolve=>{
   const values=[];
   const read=t=>{
    values.push({...window.__editorTest.freeMovementPose(),cell:window.__editorTest.facility().position,t});
    if(values.length<8)requestAnimationFrame(read);else resolve(values);
   };
   requestAnimationFrame(read);
  }));
  await send('touchEnd',[]);
  const contiguous=samples.slice(1).map((p,i)=>({dx:p.x-samples[i].x,dz:p.z-samples[i].z,cell:p.cell})).filter(p=>p.dx>0&&p.dz>0);
  assert.ok(contiguous.length>=3,'render/camera actual x & z advance continuously on successive RAFs: '+JSON.stringify(samples));
  assert.ok(contiguous.some(p=>p.cell.x===point.x&&p.cell.z===point.z),'both components move before first grid step');
  for(const step of contiguous)assert.ok(Math.abs(step.dz/step.dx-7/16)<.04,'straight trajectory follows measured thumb heading');
  const stopped=await pose(page);
  await page.waitForTimeout(350);
  assert.deepEqual(await pose(page),stopped,'releasing does not drift or snap to tile center');
  const saved=await stored(page);
  assert.ok(Number.isInteger(saved.position.x)&&Number.isInteger(saved.position.z),'resume positions stay integer');
  assert.deepEqual(errors,[]);
 }finally{await context.close()}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await continuous(browser);
 console.log('PASS 23° real RAF movement, pre-grid render change, stop, canonical save');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
