import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {mkdir} from 'node:fs/promises';
import vm from 'node:vm';

const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const begin=html.indexOf('const FACILITY_SITES=Object.freeze('),end=html.indexOf('function workshopResumeDecode(',begin);
assert(begin>=0&&end>begin);
const site=vm.runInNewContext(html.slice(begin,end)+";buildFacilitySite('base')");
const route=site.chapel?.approach?.path;
const mark=site.chapel?.approach?.waymark;
assert(route?.length===12&&mark.x===119&&mark.z===84&&mark.y===0&&mark.type==='ruinStonePost','v207 has the authored chapel trail and fork marker');
assert(route.some(p=>p.x===119&&p.z===85),'real dry stand south of sign');
assert(route.every(p=>p.x!==118||p.z!==88),'new approach does not enter the existing realm portal');
const steps=route.slice(1).map(({x,z},i)=>{
 const p=route[i],dx=x-p.x,dz=z-p.z;assert.equal(Math.abs(dx)+Math.abs(dz),1);
 return {x,z,d:dx>0?'ArrowRight':dx<0?'ArrowLeft':dz>0?'ArrowDown':'ArrowUp'};
});
if(process.env.CHAPEL_FORK_LAYOUT_ONLY==='1'){
 console.log('PASS exact v207 authored fork and separate active stair approach');
 process.exit(0);
}
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
async function launch(browser,start){
 const ctx=await browser.newContext({viewport:{width:390,height:740},deviceScaleFactor:1,isMobile:true,hasTouch:true});
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
const action='#poiWalkAction';
const notice='礼拝堂は東。光る門ではなく、崩れた石壁の階段へ。西は乾いた帰り道。正面は浅瀬で足が遅くなる。';
async function trial(browser){
 const first=route[0],{ctx,page,errors}=await launch(browser,pos(first.x,first.z,0));
 try{
  const baseline=await map(page),raw=await stock(page),url=page.url();
  const originalSerial=(await api(page)).dungeonEntranceSerial;
  assert.equal(JSON.parse(raw).quests,undefined);
  for(const [i,{x,z,d}] of steps.entries()){
   await page.keyboard.press(d);
   if(i===steps.length-1){
    assert.deepEqual([x,z],[124,81]);
    await waitPosition(page,78,88,-1);
    break;
   }
   await waitPosition(page,x,z,0);
   assert.notEqual((await api(page)).miniMap.location,'星蝕の回廊','surfaced fork never triggers the separate glowing gate');
   await page.waitForTimeout(211);
   if(x!==119||z!==85)continue;
   const button=page.locator(action);
   assert.notEqual(await button.getAttribute('aria-label'),'道しるべを読む','only faces clue after native north turn');
   await page.keyboard.press('ArrowUp');await waitPosition(page,119,85,0);
   assert.equal(await button.getAttribute('aria-label'),'道しるべを読む');
   await button.tap();
   await page.locator('#poiMessageLog').filter({hasText:notice}).waitFor({state:'visible'});
   assert.equal(await stock(page),raw,'reading purely optional route hint does not create progress or consume a resource');
   if(out)await page.screenshot({path:out+'/v207-chapel-fork-sign.png'});
  }
  await page.waitForFunction(()=>{const s=window.__editorTest.facility();return s.musicZone==='chapel'&&s.miniMap.location==='水没した礼拝堂'});
  const inside=await api(page);
  assert.equal(inside.sceneLayer,'cellar');
  assert.equal(inside.dungeonEntranceSerial,originalSerial+1);
  assert.equal(inside.miniMap.stars,'★★★☆☆☆☆☆☆☆');
  assert.equal(await stock(page),raw);
  if(out)await page.screenshot({path:out+'/v207-chapel-fork-arrival.png'});
  await page.waitForTimeout(211);await page.keyboard.press('ArrowDown');
  await waitPosition(page,124,82,0);
  assert.equal((await api(page)).sceneLayer,'surface');
  assert.equal(page.url(),url);assert.deepEqual(await map(page),baseline);
  assert.equal(await stock(page),raw);
  for(const [k,v] of Object.entries(fixtures))if(k!==kitKey)assert.equal(await page.evaluate(key=>localStorage.getItem(key),k),v);
  assert.deepEqual(errors,[]);
 }finally{await ctx.close()}
}
let browser;
try{
 browser=await chromium.launch({headless:true,
  ...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await trial(browser);
 console.log('PASS native chapel fork sign, real dry stairs, and ordinary return without a quest or gate');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
