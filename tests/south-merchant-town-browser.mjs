import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import vm from 'node:vm';

const html=readFileSync(process.argv[2]||'world-editor.html','utf8');
const begin=html.indexOf('const FACILITY_SITES=Object.freeze('),end=html.indexOf('function workshopResumeDecode(',begin);
assert(begin>=0&&end>begin);
const site=vm.runInNewContext(html.slice(begin,end)+";buildFacilitySite('base')");
const road=site.southRoad,town=road?.town;
assert.equal(town.name,'街道の宿場');
const xy=({x,z})=>[x,z],pos=(x,z)=>({x,z,level:0});
const route=road.path.map(xy);
const bridgeIndex=route.findIndex(([x,z])=>x===101&&z===103);
assert(bridgeIndex>=0);
assert.deepEqual(JSON.parse(JSON.stringify(route.slice(bridgeIndex,bridgeIndex+4))),[[101,103],[101,104],[101,105],[101,106]]);
assert.deepEqual(JSON.parse(JSON.stringify(xy(town.market.public))),[101,112]);
assert.equal(town.market.public.facing,3);
assert(site.map.world.some(o=>o.x===town.market.counter.x&&o.z===town.market.counter.z&&o.y===0&&o.type==='counterWood'));
const routeEnd=JSON.parse(JSON.stringify(route.at(-1)));
assert.deepEqual(routeEnd,[105,111]);
if(process.env.SOUTH_TOWN_LAYOUT_ONLY==='1'){
 console.log('PASS south merchant layout fixture coordinates');process.exit(0);
}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const randomPick=' const p=poiWildPick(rng);';
assert.equal(html.split(randomPick).length,2);
const fixture=html.replace(randomPick,' const p=null;'); // unrelated random outdoor spawns only
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','no-store');
 res.end(req.url==='/seed'?'<!doctype html><title>Disposable save fixture</title>':fixture);
});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const origin='http://127.0.0.1:'+server.address().port;
const kitKey='world-workshop-hotbar-v1',resumeKey='world-workshop-resume-v1',clockKey='world-workshop-town-clock-v1';
const protectedSaves={
 'forest-world-editor-v1':'{"format":"forest-world-v1","version":1,"width":30,"height":30,"size":30,"world":[{"x":2,"y":0,"z":2,"type":"stonewall","rot":1}],"models":[],"prefabs":[],"terrainHeights":[],"checks":[]}',
 'world-workshop-audio-v2':'{"master":70,"bgm":40,"se":50,"enabled":true}'
};
const kit=JSON.stringify({version:1,weapon:'equipWoodSword',potions:0,gold:18,claimedCaches:['glade']});
const screenshots=process.env.FACILITY_SCREENSHOTS;if(screenshots)await mkdir(screenshots,{recursive:true});
const api=page=>page.evaluate(()=>window.__editorTest.facility());
const inventory=page=>page.evaluate(key=>localStorage.getItem(key),kitKey);
const actor=page=>page.evaluate(()=>window.__editorTest.townResidents().actors.find(a=>a.id==='southmerchant'));
async function launch(browser,point,minute){
 const ctx=await browser.newContext({viewport:{width:390,height:740},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(16000);
 await page.goto(origin+'/seed');
 await page.evaluate(({point,minute,kitKey,kit,resumeKey,clockKey,protectedSaves})=>{
  for(const [key,value] of Object.entries(protectedSaves))localStorage.setItem(key,value);
  localStorage.setItem(kitKey,kit);
  localStorage.setItem(clockKey,JSON.stringify({version:1,gameMs:minute*500}));
  localStorage.setItem(resumeKey,JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:point.x,z:point.z,y:0,facing:point.facing??2},townLayout:5,townMapHeight:128,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 },{point,minute,kitKey,kit,resumeKey,clockKey,protectedSaves});
 await page.goto(origin+'/?resume=1&test=1');
 await page.waitForFunction(()=>window.__editorTest?.facility?.()?.active);
 assert.deepEqual((await api(page)).position,pos(point.x,point.z));
 return {ctx,page,errors};
}
async function walk(page,path){
 for(const [x,z] of path){
  const from=(await api(page)).position,dx=x-from.x,dz=z-from.z;
  assert.equal(Math.abs(dx)+Math.abs(dz),1,'adjacent planned walking destination');
  // Wait for visual step-lock to elapse using the established browser harness.
  await page.keyboard.press(dx>0?'ArrowRight':dx<0?'ArrowLeft':dz>0?'ArrowDown':'ArrowUp');
  try{await page.waitForFunction(([x,z])=>{const p=window.__editorTest.facility().position;return p.x===x&&p.z===z&&p.level===0},[x,z],{timeout:5000})}
  catch(error){throw new Error('Blocked '+JSON.stringify({from,x,z,actual:(await api(page)).position}),{cause:error})}
  await page.waitForTimeout(210);
 }
}
const action=(page,key)=>page.locator('#poiNpcMenu button[data-npc-action="'+key+'"]');
async function verifyDay(browser){
 const {ctx,page,errors}=await launch(browser,{x:101,z:103},10*60);
 try{
  const url=page.url(),first=await api(page);
  await page.locator('#poiWalkAction').tap();
  await page.waitForFunction(()=>window.__editorTest.facility().musicZone==='outside');
  await walk(page,route.slice(bridgeIndex+1,bridgeIndex+4));
  assert.equal((await api(page)).sceneLayer,'surface');
  if(screenshots)await page.screenshot({path:screenshots+'/south-town-bridge.png'});
  await walk(page,route.slice(bridgeIndex+4));
  await page.waitForFunction(()=>document.querySelector('#poiLocationName')?.textContent==='街道の宿場'&&window.__editorTest.facility().musicZone==='market');
  assert(await page.locator('#poiLocationName').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'full town name fits the live location panel');
  assert.equal((await api(page)).dungeonEntranceSerial,first.dungeonEntranceSerial);
  assert.equal(page.url(),url,'bridge and district use the same Game World URL');
  assert.equal(await inventory(page),kit,'no gear or progress side effect from walking');
  if(screenshots)await page.screenshot({path:screenshots+'/south-town-arrival.png'});
  // Enter via the authored visitor door, not the delivery/storage side.
  const publicPath=[[104,111],[103,111],[103,112],[102,112],[101,112]];
  await walk(page,publicPath);
  await page.keyboard.press('ArrowLeft'); // occupied counter cell: face west, don't pass through
  assert.deepEqual((await api(page)).position,pos(101,112));
  const work=town.market.work;
  await page.waitForFunction((p)=>window.__editorTest.townResidents().actors.some(a=>a.id==='southmerchant'&&a.name==='マレク'&&a.activity==='work'&&a.x===p.x&&a.z===p.z&&a.y===0),work);
  assert.ok(await actor(page));
  await page.locator('#poiWalkAction').tap();
  await action(page,'status').tap();
  assert((await page.locator('#poiNpcStatus').getAttribute('aria-label')).includes('マレク'));
  await page.locator('#poiNpcInventoryClose').tap();
  if(!(await action(page,'request').isVisible()))await page.locator('#poiWalkAction').tap();
  await action(page,'request').tap();await action(page,'buy').tap();
  const panel=page.locator('#poiNpcTradePanel');
  await panel.waitFor({state:'visible'});
  assert.match(await panel.innerText(),/マレク（宿場の商人）の販売品/);
  const herb=panel.locator('[data-npc-action="trade:healingHerb"]');
  assert(await herb.count()===1,'actual merchant has an offer to buy');
  assert(await herb.isEnabled());
  await herb.tap();
  assert.match(await page.locator('#poiNpcTradeDetail').innerText(),/薬草/);
  assert(await panel.locator('button[data-npc-action="confirm"]').isEnabled());
  assert.equal(await inventory(page),kit,'inspection and an unconfirmed offer cannot mutate the wallet');
  for(const [key,value] of Object.entries(protectedSaves))assert.equal(await page.evaluate(k=>localStorage.getItem(k),key),value);
  assert.deepEqual(errors,[]);
  if(screenshots)await page.screenshot({path:screenshots+'/south-town-merchant.png'});
 }finally{await ctx.close()}
}
async function verifyNight(browser){
 const {ctx,page,errors}=await launch(browser,{...town.inn.door,facing:0},22*60);
 try{
  const bed=town.inn.bedStand;
  await page.waitForFunction((p)=>window.__editorTest.townResidents().actors.some(a=>a.id==='southmerchant'&&a.activity==='sleep-home'&&a.x===p.x&&a.z===p.z&&a.y===0),bed);
  assert.equal(page.url(),origin+'/?resume=1&test=1');
  assert.equal(await inventory(page),kit);
  assert.deepEqual(errors,[]);
 }finally{await ctx.close()}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await verifyDay(browser);
 if(process.env.SOUTH_MERCHANT_NIGHT==='1')await verifyNight(browser);
 console.log('PASS Chromium portrait route, district music, live counter interaction and nonmutating merchant offer');
}finally{await browser?.close();await new Promise(r=>server.close(r))}
