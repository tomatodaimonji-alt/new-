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
assert(site.mine?.approach?.closed?.some(p=>p.x===120&&p.z===57&&p.fallback.z===58),'v210 closes the old direct threshold');
assert.match(html,/function poiDungeonPopulationDecode\(/);
assert.match(html,/function poiDungeonPatrolStep\(/);
if(process.env.MINE_ROAM_LAYOUT_ONLY==='1'){console.log('PASS v210 threshold, ledger and patrol source');process.exit(0);}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url.startsWith('/seed')?'<!doctype html><title>Isolated fixtures</title>':html);
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
async function launch(browser,start,expected=start,seedLedger=false){
 const ctx=await browser.newContext({viewport:{width:390,height:740},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
 await page.goto(origin+'/seed');
 await page.evaluate(({fixtures,resumeKey,start,seedLedger,deathAt})=>{
  for(const [k,v] of Object.entries(fixtures))localStorage.setItem(k,v);
  localStorage.setItem('world-workshop-town-clock-v1',JSON.stringify({version:1,gameMs:(seedLedger?deathAt+6*1440:10*60)*500}));
  if(seedLedger){
   const key='world-workshop-hotbar-v1',kit=JSON.parse(localStorage.getItem(key));
   localStorage.setItem(key,JSON.stringify({...kit,dungeonPopulation:{version:1,dead:{'mine.side-slime':deathAt},questEntries:{}}}));
  }
  localStorage.setItem(resumeKey,JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:start.x,z:start.z,y:start.level,facing:0},townLayout:5,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:start.level,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 },{fixtures,resumeKey,start,seedLedger,deathAt});
 await page.goto(origin+'/?resume=1&test=1');
 await active(page);
 assert.deepEqual((await api(page)).position,expected);
 return {ctx,page,errors};
}
async function waitPosition(page,x,z,level=-1){
 await page.waitForFunction(([x,z,level])=>{
  const p=window.__editorTest.facility().position;return p.x===x&&p.z===z&&p.level===level;
 },[x,z,level],{timeout:5000});
}
const deathAt=2*1440+605;
const slime=s=>s.combat.actors.find(a=>a.type==='monsterSlime'&&a.level===-1&&a.visible&&a.hp>0);
const gate=async page=>assert.equal(await page.evaluate(()=>window.__editorTest.canStep(121,47,121,48)),false);
async function unifiedEntrance(browser){
 const stair=site.mine.stairs;
 const {ctx,page,errors}=await launch(browser,pos(stair.x,stair.z+1,0));
 async function label(){
  assert.equal((await api(page)).miniMap.location,'廃坑');
  assert.equal(await page.locator('#poiLocationName').textContent(),'廃坑');
  assert.equal(await page.locator('#poiLocationStars').textContent(),'★★★☆☆☆☆☆☆☆');
 }
 try{
  await label();
  await page.keyboard.press('ArrowUp');
  await waitPosition(page,stair.x,stair.z,-1);
  await label();
  assert.equal(await page.locator('#poiLocationPanel').evaluate(el=>el.getAnimations().length),0,
   'normal staircase descent stays in the same area without a separate announcement');
  assert.deepEqual(errors,[]);
 }finally{await ctx.close()}
}
async function oldThreshold(browser){
 const {ctx,page,errors}=await launch(browser,pos(120,57),pos(120,58));
 try{
  const world=await map(page),raw=await stock(page);
  assert.equal(await page.evaluate(()=>window.__editorTest.canStep(120,57,120,58)),false);
  let s=await api(page);
  assert.equal(s.combat.actors.find(a=>a.type==='monsterMineGuard'&&a.visible)?.hp,112);
  assert.equal(s.miniMap.location,'廃坑');
  await page.keyboard.press('ArrowUp');await waitPosition(page,120,58);
  assert.equal(await stock(page),raw);
  await page.reload();await active(page);
  assert.deepEqual((await api(page)).position,pos(120,58));
  await gate(page);assert.deepEqual(await map(page),world);
  if(out)await page.screenshot({path:out+'/v210-mine-old-closed-threshold.png'});
  assert.deepEqual(errors,[]);
 }finally{await ctx.close()}
}
async function cooldown(browser){
 const {ctx,page,errors}=await launch(browser,pos(116,61),pos(116,61),true);
 try{
  const raw=await stock(page),world=await map(page);
  assert.equal(JSON.parse(raw).dungeonPopulation.dead['mine.side-slime'],deathAt);
  assert.equal(slime(await api(page)),undefined,'valid saved six-day cooldown omits ordinary authored slime at real cold start');
  await page.reload();await active(page);
  assert.equal(slime(await api(page)),undefined);assert.equal(await stock(page),raw);
  // Advance only the durable fixture clock, then make a normal cold start.
  // Do not seed monster positions, combat outcomes, or an expired cleanup.
  await page.goto(origin+"/seed"); // leave app before setting new fixture clock
  await page.evaluate(minute=>localStorage.setItem('world-workshop-town-clock-v1',JSON.stringify({version:1,gameMs:minute*500})),deathAt+7*1440);
  await page.goto(origin+"/?resume=1&test=1");await active(page);
  await page.waitForFunction(()=>window.__editorTest.facility().combat.actors.some(a=>a.type==='monsterSlime'&&a.visible&&a.level===-1&&a.hp>0));
  const start=slime(await api(page));
  await page.waitForFunction(({x,z})=>window.__editorTest.facility().combat.actors.some(a=>
   a.type==='monsterSlime'&&a.visible&&a.level===-1&&a.hp>0&&(a.x!==x||a.z!==z)),start,{timeout:8000});
  const end=await api(page),m=slime(end);
  assert.deepEqual(end.position,pos(116,61),'player remains on safe landing while real slime roams');
  assert.equal(end.combat.playerHP,100);assert.equal(end.combat.threats.length,0);
  assert(Math.abs(m.x-120)+Math.abs(m.z-62)<=4,'actual ordinary patrol stays within its authored tether');
  assert.equal(end.combat.actors.find(a=>a.type==='monsterMineGuard'&&a.visible)?.hp,112);
  assert.equal(await stock(page),raw,'clock expiry and roaming do not spend or grant items');
  assert.deepEqual(await map(page),world);
  assert.deepEqual(errors,[]);
 }finally{await ctx.close()}
}
let browser;
try{
 browser=await chromium.launch({headless:true,
  ...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await unifiedEntrance(browser);await oldThreshold(browser);await cooldown(browser);
 console.log('PASS native old threshold fallback, safe patrol, durable cooldown reconstruction');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
