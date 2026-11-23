import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const hook=' const p=poiWildPick(rng);';
assert.ok(html.includes(hook));
const fixture=html.replace(hook,' const p=null;'); // route/perf uncontaminated by random field spawns
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.setHeader('Cache-Control','no-store');res.end(req.url==='/seed'?'<!doctype html>':fixture);
});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const origin='http://127.0.0.1:'+server.address().port;
const snapshot=page=>page.evaluate(()=>{
 const f=window.__editorTest.facility();
 return {position:f.position,roof:f.buildings[f.hiddenRoof]?.id??null,cut:f.buildings[f.sceneCutOwner]?.id??null};
});
const counts=page=>page.evaluate(()=>({...window.__innGL}));
function touched(x,y,id=1){return {x:Math.round(x),y:Math.round(y),id,radiusX:6,radiusY:6,force:.7}}
async function route(browser,start,name,delta,cut){
 const ctx=await browser.newContext({viewport:{width:740,height:390},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 await ctx.addInitScript(()=>{
  const proto=WebGLRenderingContext.prototype,write=proto.bufferData,patch=proto.bufferSubData;
  const uploads=window.__innGL={large:0,fullBytes:0,partialBytes:0};
  proto.bufferData=function(target,source,...rest){
   const bytes=typeof source==='number'?source:source?.byteLength||0;
   if(bytes>=2_000_000)uploads.large++;
   uploads.fullBytes+=bytes;
   return write.call(this,target,source,...rest);
  };
  proto.bufferSubData=function(target,offset,source,...rest){
   uploads.partialBytes+=source?.byteLength||0;
   return patch.call(this,target,offset,source,...rest);
  };
 });
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(16000);
 const kit='{"version":1,"weapon":"equipWoodSword","potions":2,"gold":18,"claimedCaches":["glade"]}';
 const door={x:start.x+delta.x,z:start.z+delta.z,level:0};
 try{
  await page.goto(origin+'/seed');
  await page.evaluate(({start,kit})=>{
   localStorage.setItem('world-workshop-hotbar-v1',kit);
   localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":330000}');
   localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
    position:{...start,y:0,facing:2},townLayout:5,townMapHeight:128,
    view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
  },{start,kit});
  await page.goto(origin+'/?resume=1&test=1');
  await page.waitForFunction(()=>window.pineStartup&&!pineStartup.loading&&window.__editorTest?.facility?.()?.active);
  await page.waitForFunction(()=>document.querySelector('#poiAnalogPad')?.hidden===false);
  assert.deepEqual(await snapshot(page),{position:{...start,level:0},roof:null,cut:null});
  const base=await counts(page);
  assert(base.large>0,'observed initial outdoor surface VBO upload');
  const cdp=await ctx.newCDPSession(page);
  const pad=page.locator('#poiAnalogPad'),box=await pad.boundingBox();
  assert.ok(box?.height>50&&box.width>50);
  const x=box.x+box.width*.45,y=box.y+box.height*.45;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touched(x,y)]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touched(x+delta.x*26,y+delta.z*26)]});
  await page.waitForFunction(({delta,start})=>{
   const f=window.__editorTest.facility(),p=f.position;
   return (p.x-start.x)*delta.x+(p.z-start.z)*delta.z>=1;
  },{delta,start});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const entered=await snapshot(page),observed=await counts(page);
  assert.equal(entered.roof,name,'real roof hides on reaching authored entrance');
  assert.equal(entered.cut,cut);
  assert(entered.position.level===door.level);
  assert.equal(observed.large,base.large,'no large VBO construction on first threshold');
  assert(observed.partialBytes-base.partialBytes<50_000,'bounded optional local tint updates');
  if(cut)assert(observed.partialBytes>base.partialBytes,'main inn switches its own exact lamp tint');
  else assert.equal(observed.partialBytes,base.partialBytes,'one-storey south inn retains existing scene');
  assert.equal(await page.evaluate(()=>localStorage.getItem('world-workshop-hotbar-v1')),kit);
  assert.deepEqual(errors,[]);
 }finally{await ctx.close()}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await route(browser,{x:41,z:34},'lodging',{x:0,z:-1},'lodging');
 await route(browser,{x:107,z:116},'southInn',{x:1,z:0},null);
 console.log('PASS authored main and south inn first-entry roof transitions without large VBO uploads');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
