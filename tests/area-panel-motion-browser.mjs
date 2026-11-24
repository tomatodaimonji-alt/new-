import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {mkdir} from 'node:fs/promises';
import vm from 'node:vm';

const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
assert.match(html,/function poiLocationMotion\(/,'v210 supplies the existing-panel motion');
if(process.env.AREA_MOTION_LAYOUT_ONLY==='1'){console.log('PASS native location motion preflight');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
// Suppress only unrelated random surface spawns so exact save bytes remain
// a meaningful assertion even with slower headless WebGL.
const randomPick=' const p=poiWildPick(rng);';
assert.equal(html.split(randomPick).length,2);
const fixture=html.replace(randomPick,' const p=null;');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url.startsWith('/seed')?'<!doctype html><title>Isolated fixtures</title>':fixture);
});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const origin='http://127.0.0.1:'+server.address().port;
const kitKey='world-workshop-hotbar-v1',resumeKey='world-workshop-resume-v1';
const fixtures={
 [kitKey]:'{"version":1,"weapon":"equipWoodSword","potions":0,"gold":12,"claimedCaches":["glade"]}',
 'forest-world-editor-v1':'{"format":"forest-world-v1","version":1,"width":30,"height":30,"size":30,"world":[{"x":2,"y":0,"z":2,"type":"stonewall","rot":1}],"models":[],"prefabs":[],"terrainHeights":[],"checks":[]}',
 'world-workshop-audio-v2':'{"master":70,"bgm":40,"se":50,"enabled":true}'
};
const out=process.env.FACILITY_SCREENSHOTS;if(out)await mkdir(out,{recursive:true});
const api=page=>page.evaluate(()=>window.__editorTest.facility());
const map=page=>page.evaluate(()=>window.__editorTest.data());
const stock=page=>page.evaluate(key=>localStorage.getItem(key),kitKey);
const pos=(x,z,level=-1)=>({x,z,level});
const active=page=>page.waitForFunction(()=>window.__editorTest?.facility?.().active);
async function launch(browser,start,reduced=false,viewport={width:320,height:740}){
 const ctx=await browser.newContext({viewport,deviceScaleFactor:1,isMobile:true,hasTouch:true,reducedMotion:reduced?'reduce':'no-preference'});
 await ctx.addInitScript(()=>{
  const run=Element.prototype.animate;window.__locationAnimations=[];
  Element.prototype.animate=function(){
   const handle=run.apply(this,arguments);
   if(this.id==='poiLocationPanel')window.__locationAnimations.push(handle);
   return handle;
  };
 });
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
 await page.goto(origin+'/seed');
 await page.evaluate(({fixtures,resumeKey,start})=>{
  for(const [k,v] of Object.entries(fixtures))localStorage.setItem(k,v);
  localStorage.setItem('world-workshop-town-clock-v1',JSON.stringify({version:1,gameMs:10*60*500}));
  localStorage.setItem(resumeKey,JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:start.x,z:start.z,y:start.level,facing:0},townLayout:5,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:start.level,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 },{fixtures,resumeKey,start});
 await page.goto(origin+'/?resume=1&test=1');
 await active(page);
 assert.deepEqual((await api(page)).position,start);
 return {ctx,page,errors};
}
async function waitPosition(page,x,z,level=-1){
 await page.waitForFunction(([x,z,level])=>{
  const p=window.__editorTest.facility().position;return p.x===x&&p.z===z&&p.level===level;
 },[x,z,level],{timeout:5000});
}
const panel='#poiLocationPanel';
const count=page=>page.evaluate(()=>window.__locationAnimations.length);
async function assertTwoRows(page){
 const r=await page.locator(panel).evaluate(el=>{
  const name=el.querySelector('#poiLocationName'),stars=el.querySelector('#poiLocationStars'),ink=document.createRange();
  ink.selectNodeContents(stars);
  const rr=ink.getBoundingClientRect(),st=stars.getBoundingClientRect(),nd=name.getBoundingClientRect();
  return {text:stars.textContent,aria:stars.getAttribute('aria-label'),rows:nd.bottom<=st.top+.25,
   contained:rr.left>=st.left-.3&&rr.right<=st.right+.3,actualTextWidth:rr.width,available:st.width};
 });
 assert.equal(r.text,'★☆☆☆☆☆☆☆☆☆');
 assert.equal(r.aria,'危険度 1／10');
 assert(r.rows&&r.contained,'dedicated second row fits ten stars: '+JSON.stringify(r));
}

async function step(page,d,x,z){
 await page.keyboard.press(d);await waitPosition(page,x,z,0);await page.waitForTimeout(211);
}
async function trial(browser,reduced,viewport={width:320,height:740}){
 const landscape=viewport.width>viewport.height;
 const {ctx,page,errors}=await launch(browser,pos(112,9,0),reduced,viewport);
 try{
  const before=await stock(page),world=await map(page);
  assert.equal(await page.locator('#poiLocationName').innerText(),'北の林道');
  assert.equal(await count(page),0,'first resume shows settled panel');
  await page.waitForFunction(()=>!window.pineStartup.loading);
  assert.equal(await count(page),0,"hidden fallback spawn does not count as a displayed transition");
  await assertTwoRows(page);
  await step(page,'ArrowRight',113,9);
  assert.equal(await page.locator('#poiLocationName').innerText(),'外','leaving the named forest reaches ordinary exterior on the waterside road');
  assert.equal(await count(page),reduced?0:1);
  await assertTwoRows(page);
  if(!reduced){
   // Pause/scrub the actual Web Animation at its peak, avoiding dependence
   // on SwANGLE rendering/screenshot speed in CI.
   const sizes=await page.locator(panel).evaluate(el=>{
    const a=window.__locationAnimations[0];
    const duration=a.effect.getTiming().duration;
    a.pause();a.currentTime=duration*.24;
    const rect=node=>{const {left,right,top,width}=node.getBoundingClientRect();return {left,right,top,width}};
    const clock=document.querySelector('#poiClockHud'),mini=document.querySelector('#poiMiniMap');
    const result={...rect(el),clock:rect(clock),map:rect(mini),origin:getComputedStyle(el).transformOrigin,duration};
    result.peakShadow=getComputedStyle(el).boxShadow;
    a.currentTime=1050;result.afterOldDuration=rect(el);
    a.currentTime=duration;
    result.original={...rect(el),clock:rect(clock),map:rect(mini)};
    a.currentTime=duration*.5; // keep real motion active so second boundary must cancel it
    return result;
   });
   if(landscape){
    assert(Math.abs(sizes.width-sizes.original.width)<.2);
    assert(Math.abs(sizes.left-sizes.original.left)<.2&&sizes.right<=viewport.width-10,'fixed area stays in its own lane');
    assert.equal(sizes.duration,1750);
    assert.equal(sizes.afterOldDuration.left,sizes.original.left,'late animation also stays put');
    assert.match(sizes.peakShadow,/inset/);
   }else assert(sizes.width>sizes.original.width*1.20&&sizes.left>sizes.original.left+4&&sizes.duration===1050);
   assert.deepEqual(sizes.clock,sizes.original.clock,'existing clock is never displaced by location transform');
   assert.deepEqual(sizes.map,sizes.original.map,'minimap is never displaced by location transform');
   assert(sizes.origin.startsWith('0px'));
   if(out)await page.screenshot({path:out+'/v210-location-panel-motion.png'});
  }
  await step(page,'ArrowRight',114,9);
  assert.equal(await count(page),reduced?0:1,'same visible name/stars do not restart motion');
  await step(page,'ArrowLeft',113,9);
  await step(page,'ArrowLeft',112,9);
  assert.equal(await page.locator('#poiLocationName').innerText(),'北の林道');
  assert.equal(await count(page),reduced?0:2);
  if(!reduced){
   const ended=await page.evaluate(()=>{
    const [old,current]=window.__locationAnimations;current.finish();
    return {old:old.playState,style:getComputedStyle(document.querySelector('#poiLocationPanel')).transform};
   });
   assert.equal(ended.old,'idle','rapid reverse cancels the existing transition');
   assert.equal(ended.style,'none','finished panel restores original transform exactly');
  }else assert.equal(await page.locator(panel).evaluate(el=>getComputedStyle(el).transform),'none');
  assert.equal(await stock(page),before);assert.deepEqual(await map(page),world);
  assert.deepEqual(errors,[]);
 }finally{await ctx.close()}
}
let browser;
try{
 browser=await chromium.launch({headless:true,
  ...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await trial(browser,false);await trial(browser,true);
 await trial(browser,false,{width:568,height:320});
 await trial(browser,false,{width:1120,height:500});
 await trial(browser,true,{width:844,height:390});
 console.log('PASS unchanged portrait and fixed landscape cue and safe surrounding layout, and reduced motion');
}finally{await browser?.close();await new Promise(r=>server.close(r));}

