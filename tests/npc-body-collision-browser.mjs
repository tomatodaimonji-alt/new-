import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
const html=readFileSync(process.argv[2]||'world-editor.html','utf8');
const insert='function poiTownNpcStepT(a,now){';
assert.equal(html.split(insert).length,2);
const fixture=html.replace(' const p=poiWildPick(rng);',' const p=null;').replace(insert,`
let testBody;
window.__npcBodyFixture=(x,z)=>{
 testBody ||= poiTownNpcActors.find(a=>a.role?.id==='northtraveler') || poiTownNpcActors.find(a=>!a.recessed&&!a.death);
 if(!testBody)throw new Error('Town NPCs not yet initialized');
 const a=testBody;
 a.x=a.fromX=x;a.z=a.fromZ=z;a.y=a.fromY=poiWalkLevel;
 a.recessed=false;a.death=null;a.actorLeg=null;a.moveAt=NaN;
 return a.role.id;
};
`+insert).replace('function poiTownNpcRoutine(a,clock,now,budget){','function poiTownNpcRoutine(a,clock,now,budget){\n if(a===testBody)return;');
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<!doctype html><title>Fixture</title>':fixture);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const ctx=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
 const start={x:102,z:93},body={x:103,z:93};
 await page.goto(origin+'/seed');
 await page.evaluate(({x,z})=>{
  localStorage.setItem('world-workshop-hotbar-v1','{"version":1,"weapon":null,"potions":2,"gold":18,"claimedCaches":["glade"]}');
  localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":575000}');
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x,z,y:0,facing:2},townLayout:5,townMapHeight:128,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 },start);
 await page.goto(origin+'/?resume=1&test=1');
 await page.waitForFunction(()=>window.__editorTest?.facility()?.active);
 assert(await page.evaluate(({x,z})=>window.__editorTest.canStep(x,z,x-1,z),body),'floor is open before collision');
 await page.waitForFunction(({x,z})=>{try{return window.__npcBodyFixture(x,z)}catch{return false}},body);
 await page.keyboard.press('ArrowRight');
 assert.equal((await page.evaluate(()=>window.__editorTest.facility().position)).x,start.x,'cardinal walking does not cross resident');
 const box=await page.locator('#poiAnalogPad').boundingBox();
 const point=(x,y)=>({x:Math.round(x),y:Math.round(y),id:1,radiusX:4,radiusY:4,force:.7});
 const anchor=point(box.x+box.width*.5,box.y+box.height*.42);
 const cdp=await ctx.newCDPSession(page);
 const touch=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
 const pose=()=>page.evaluate(()=>window.__editorTest.freeMovementPose());
 await touch('touchStart',[anchor]);await touch('touchMove',[point(anchor.x+52,anchor.y)]);
 await page.waitForFunction(()=>window.__editorTest.freeMovementPose().x>=102.58);
 await page.waitForTimeout(190);
 const stopped=await pose();
 assert(Math.abs(stopped.x-102.6)<.03,'physical touch rests at circular contact, not at a full-tile stop: '+JSON.stringify(stopped));
 assert(Math.abs(stopped.z-93)<.01);
 await touch('touchMove',[point(anchor.x+38,anchor.y+25)]);
 await page.waitForFunction(()=>window.__editorTest.freeMovementPose().z>93.45);
 await touch('touchEnd',[]);
 assert.deepEqual(errors,[]);
 console.log('PASS physical thumb and cardinal input stay outside a real town NPC; thumb slides sideways');
 await ctx.close();
}finally{await browser?.close();await new Promise(r=>server.close(r))}
