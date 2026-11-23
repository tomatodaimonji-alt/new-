import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
const original=readFileSync(process.argv[2]||'world-editor.html','utf8');
let html=original;
function instrument(anchor,replacement){
 assert.equal(html.split(anchor).length,2,anchor);html=html.replace(anchor,replacement);
}
instrument(' const p=poiWildPick(rng);',' const p=null;');
instrument('function poiSound(kind,weapon=null,defeated=false){',`function poiSound(kind,weapon=null,defeated=false){
 if(window.__steps&&['step','chapel-water-step','door-open','door-close'].includes(kind))window.__steps.push({kind,weapon,...window.__stride});
`);
instrument('function poiAnalogFrame(now){',`function poiAnalogFrame(now){
 if(window.__stride)window.__stride.frame=now;
`);
instrument(' if(result.stopped||poiWalkLevel!==level||poiOtherworldTravelSerial!==travel||poiAnalogContact!==c){',` if(window.__stride)window.__stride.distance+=result.distance;
 if(result.stopped||poiWalkLevel!==level||poiOtherworldTravelSerial!==travel||poiAnalogContact!==c){`);
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<!doctype html><title>Fixture</title>':html);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
let browser;
async function open(point){
 const context=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(18000);
 await page.goto(origin+'/seed');
 await page.evaluate(({x,z})=>{
  localStorage.setItem('world-workshop-hotbar-v1','{"version":1,"weapon":null,"potions":2,"gold":18,"claimedCaches":["glade"]}');
  localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":330000}');
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x,z,y:0,facing:2},townLayout:5,townMapHeight:128,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 },point);
 await page.goto(origin+'/?resume=1&test=1');
 await page.waitForFunction(()=>window.__editorTest?.facility()?.active);
 const p=await page.locator('#poiAnalogPad').boundingBox();
 const start={x:Math.round(p.x+p.width/2),y:Math.round(p.y+p.height/2),id:1,radiusX:5,radiusY:5,force:.7};
 const cdp=await context.newCDPSession(page);
 const send=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
 const push=async(dx,dz)=>{await send('touchStart',[start]);await send('touchMove',[{...start,x:start.x+dx,y:start.y+dz}]);};
 await page.evaluate(()=>{window.__steps=[];window.__stride={distance:0,frame:0};});
 const log=()=>page.evaluate(()=>window.__steps);
 return {context,page,errors,log,push,release:()=>send('touchEnd',[])};
}
try {
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const diagonal=await open({x:24,z:24});
 try{
  await diagonal.push(46,46);
  await diagonal.page.waitForFunction(()=>window.__stride.distance>=3.55);
  await diagonal.release();
  const events=await diagonal.log();
  console.log('native diagonal',events);
  assert(events.length>=4);
  assert.equal(new Set(events.map(e=>e.frame)).size,events.length,'one ordinary step per animation frame at most');
  for(let i=0;i<4;i++)assert(Math.abs(events[i].distance-(.5+i))<.25,'ordinary cue follows one physical stride across cardinal cell boundaries');
  await diagonal.page.waitForTimeout(300);
  assert.equal((await diagonal.log()).length,events.length,'no cue after thumb lifts');
  assert.deepEqual(diagonal.errors,[]);
 }finally{await diagonal.context.close()}
 for(const z of [111,112]){
  const market=await open({x:103,z});
  try{
   await market.push(-55,0);
   if(z===111){
    await market.page.waitForFunction(()=>window.__stride.distance>.28);
    await market.page.waitForTimeout(330);
    assert((await market.page.evaluate(()=>window.__stride.distance))<.31);
    assert.deepEqual(await market.log(),[],'authored market wall blocks steps while the thumb stays held');
   }else{
    await market.page.waitForFunction(()=>window.__editorTest.facility().position.x<=101);
    const events=await market.log();
    assert.deepEqual(events.filter(e=>e.kind!=='step').map(e=>e.kind),['door-open','door-close']);
   }
   await market.release();assert.deepEqual(market.errors,[]);
  }finally{await market.context.close()}
 }
 console.log('PASS native touch diagonal stride, idle/blocking, and doorway foley');
}finally{await browser?.close();await new Promise(r=>server.close(r))}
