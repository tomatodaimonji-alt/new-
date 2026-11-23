import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';

const html=readFileSync(process.argv[2]||'world-editor.html','utf8');
const random=' const p=poiWildPick(rng);';
assert.equal(html.split(random).length,2);
const fixture=html.replace(random,' const p=null;');
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.setHeader('Cache-Control','no-store');
 res.end(req.url==='/seed'?'<!doctype html><title>Isolated dungeon return</title>':fixture);
});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const origin='http://127.0.0.1:'+server.address().port;
const resumeKey='world-workshop-resume-v1',kitKey='world-workshop-hotbar-v1';
const kit='{"version":1,"weapon":"equipWoodSword","potions":2,"gold":18,"claimedCaches":["glade"]}';
const routes=[
 {name:'mine staircase',point:{x:116,z:61},surface:{x:116,z:62}},
 {name:'chapel return',point:{x:78,z:88},surface:{x:124,z:82}},
 {name:'otherworld return (reduced motion)',point:{x:100,z:90},surface:{x:118,z:87},reduced:true}
];
async function check(browser,route){
 const {point,surface,reduced}=route;
 const ctx=await browser.newContext({viewport:{width:390,height:740},deviceScaleFactor:1,isMobile:true,hasTouch:true,
  reducedMotion:reduced?'reduce':'no-preference'});
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.setDefaultTimeout(15000);
 try{
  await page.addInitScript(()=>{
   window.__returnFades=[];
   const animate=Element.prototype.animate;
   Element.prototype.animate=function(keyframes,options){
    if(this.id==='poiDungeonFade')window.__returnFades.push({keyframes,duration:options.duration});
    return animate.apply(this,arguments);
   };
  });
  await page.goto(origin+'/seed');
  await page.evaluate(({point,kit,kitKey,resumeKey})=>{
   localStorage.setItem(kitKey,kit);
   localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":330000}');
   localStorage.setItem(resumeKey,JSON.stringify({version:1,route:'facility',id:'base',play:true,
    position:{x:point.x,z:point.z,y:-1,facing:2},townLayout:5,townMapHeight:128,
    view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:-1,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
  },{point,kit,kitKey,resumeKey});
  await page.goto(origin+'/?resume=1&test=1');
  await page.waitForFunction(()=>window.__editorTest?.facility?.()?.active);
  const state=()=>page.evaluate(()=>window.__editorTest.facility());
  const before=await state();
  assert.deepEqual(before.position,{...point,level:-1},route.name+' resumes at the real exit stand');
  assert.deepEqual(await page.evaluate(()=>window.__returnFades),[],'reload never fabricates transition');
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(p=>{
   const {position}=window.__editorTest.facility();
   return position.x===p.x&&position.z===p.z&&position.level===0;
  },surface);
  const after=await state();
  assert.equal(after.dungeonEntranceSerial,before.dungeonEntranceSerial,'exit is not an entry event');
  const fades=await page.evaluate(()=>window.__returnFades);
  assert.equal(fades.length,1,route.name+' invokes actual Web Animation exactly once');
  assert.equal(fades[0].duration,reduced?150:300);
  assert.equal(fades[0].keyframes[0].opacity,reduced?.36:.84);
  assert.equal(fades[0].keyframes.at(-1).opacity,0);
  assert.equal(await page.locator('#poiDungeonFade').evaluate(n=>getComputedStyle(n).pointerEvents),'none');
  // The fade's compositor clock starts on its first presented frame, which
  // can follow the dungeon mesh swap; the exact requested duration is asserted above.
  await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('#poiDungeonFade')).opacity)===0,
   undefined,{timeout:4500});
  assert.equal(await page.evaluate(k=>localStorage.getItem(k),kitKey),kit);
  assert.deepEqual(errors,[]);
 }finally{await ctx.close()}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 for(const route of routes)await check(browser,route);
 console.log('PASS native mine staircase, chapel and otherworld visual-only return fade, no entry/save writes');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
