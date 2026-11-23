import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import vm from 'node:vm';

const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const begin=html.indexOf('const FACILITY_SITES=Object.freeze('),end=html.indexOf('function workshopResumeDecode(',begin);
assert(begin>=0&&end>begin);
const site=JSON.parse(JSON.stringify(vm.runInNewContext(html.slice(begin,end)+";buildFacilitySite('base')")));
const at=(x,z)=>({x,z,level:0});
const vertices=[[121,28],[121,33],[124,33],[124,42],[122,42],[122,49],[121,49],[121,51]];
const route=[];
let [x,z]=vertices[0];
for(const [tx,tz] of vertices.slice(1))while(x!==tx||z!==tz){
 x+=Math.sign(tx-x);z+=Math.sign(tz-z);route.push([x,z]);
}
const objectsAt=(x,z)=>site.map.world.filter(o=>o.x===x&&o.z===z&&o.y===0);
const walkable=/^(earth|stone|road\w+|grassTrampled|grassPebbles)$/;
const well=objectsAt(119,44).find(o=>o.type==='wayfarerWell');
assert(well,'v199 authored traveler well at (119,44,0) is missing');
assert.deepEqual(site.northTrail.wayfarer.path.map(c=>[c.x,c.z]),[vertices[0],...route]);
for(const [x,z] of [...route,[121,44],[120,44]]) {
 const tiles=objectsAt(x,z);
 assert(tiles.some(t=>walkable.test(t.type)),`authored dry floor at (${x},${z})`);
 assert(!tiles.some(t=>/(?:^water$|^tree|^rock|^boulder|wall|^monster)/i.test(t.type)),`no blocking water or prop at (${x},${z})`);
}
if(process.env.WELL_LAYOUT_ONLY==='1'){
 console.log('PASS authored v199 through-road, well tile and dry one-cell approach');
 process.exit(0);
}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url.startsWith('/seed')?'<!doctype html><title>Isolated fixtures</title>':html);
});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const origin='http://127.0.0.1:'+server.address().port;
const kitKey='world-workshop-hotbar-v1',resumeKey='world-workshop-resume-v1';
const fixtures={
 [kitKey]:'{"version":1,"weapon":"equipWoodSword","potions":3,"gold":12,"claimedCaches":["glade"]}',
 'forest-world-editor-v1':JSON.stringify({format:'forest-world-v1',version:1,width:30,height:30,size:30,world:[{x:2,y:0,z:2,type:'stonewall',rot:1}],models:[],prefabs:[],terrainHeights:[],checks:[]}),
 'world-workshop-audio-v2':'{"master":81,"bgm":62,"se":88,"enabled":true}'
};
const out=process.env.FACILITY_SCREENSHOTS;
if(out)await mkdir(out,{recursive:true});

const state=page=>page.evaluate(()=>window.__editorTest?.facility?.()??null);
const map=page=>page.evaluate(()=>window.__editorTest.data());
const stock=page=>page.evaluate(k=>localStorage.getItem(k),kitKey);
const position=async page=>(await state(page)).position;
async function launch(browser,start,facing=2){
 const ctx=await browser.newContext({viewport:{width:390,height:740},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
 await page.goto(origin+'/seed');
 await page.evaluate(({fixtures,resumeKey,start,facing})=>{
  for(const [k,v] of Object.entries(fixtures))localStorage.setItem(k,v);
  localStorage.setItem('world-workshop-town-clock-v1',JSON.stringify({version:1,gameMs:10*60*500}));
  localStorage.setItem(resumeKey,JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:start.x,z:start.z,y:0,facing},townLayout:5,
   view:{yaw:.24,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 },{fixtures,resumeKey,start,facing});
 await page.goto(origin+'/?resume=1&test=1');
 await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
 assert.deepEqual(await position(page),at(start.x,start.z));
 return {ctx,page,errors};
}
const directions={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]};
async function singleStep(page,x,z,touch=false){
 const from=await position(page);
 const dx=x-from.x,dz=z-from.z;
 assert.equal(Math.abs(dx)+Math.abs(dz),1,'test only uses physical cardinal steps');
 const key=Object.keys(directions).find(k=>directions[k][0]===dx&&directions[k][1]===dz);
 if(touch){
  const d={ArrowUp:'n',ArrowDown:'s',ArrowLeft:'w',ArrowRight:'e'}[key];
  await page.locator('[data-poi-dir="'+d+'"]').tap();
 }else await page.keyboard.press(key);
 await page.waitForFunction(([x,z])=>{
  const p=window.__editorTest.facility().position;return p.x===x&&p.z===z&&p.level===0;
 },[x,z],{timeout:5000});
}
const calm=page=>page.waitForTimeout(210); // ordinary movement cooldown
async function expectHud(page,name,stars){
 await page.waitForFunction(([n,s])=>{const m=window.__editorTest.facility().miniMap;return m.location===n&&m.stars===s;},[name,stars]);
 assert.equal(await page.locator('#poiLocationName').innerText(),name);
}
async function exactProtection(page,original){
 assert.deepEqual(await map(page),original,'authored exploration never edits map data');
 for(const [key,value] of Object.entries(fixtures))if(key!==kitKey)
  assert.equal(await page.evaluate(k=>localStorage.getItem(k),key),value);
}
async function assertJourneyState(page,old){
 await page.locator('#poiPlayerHp').waitFor({state:'visible'});
 assert.equal(await page.locator('#poiPlayerStamina,#poiPlayerStaminaValue,.poiStaminaMetric').count(),0,'no stamina meter in play HUD');
 assert.equal(await stock(page),old,'visiting the well does not grant healing items, gold, or quests');
 const visibleOtherUi=await page.evaluate(()=>['#poiNpcMenu','#poiChestPanel','#poiBagPanel'].some(s=>{
  const e=document.querySelector(s);return e&&!e.hidden&&e.getClientRects().length>0;
 }));
 assert.equal(visibleOtherUi,false,'examining the well does not open inventory or dialogue choices');
}
async function trial(browser){
 const {ctx,page,errors}=await launch(browser,at(121,28));
 try{
  const original=await map(page),raw=await stock(page),url=page.url();
  assert.equal(JSON.parse(raw).quests,undefined);
  for(const [i,[x,z]] of route.entries()){
   await singleStep(page,x,z,i===0);await calm(page);
   if(x!==122||z!==44)continue;
   await expectHud(page,'丘の街道','★☆☆☆☆☆☆☆☆☆');

   // One genuine touch turn off the main road.
   await singleStep(page,121,44,true);await calm(page);
   assert.notEqual(await page.locator('#poiWalkAction').getAttribute('aria-label'),'井戸を調べる','well action requires cardinal adjacency');
   await singleStep(page,120,44);await calm(page);
   await expectHud(page,'外','★☆☆☆☆☆☆☆☆☆');
   assert.equal((await state(page)).combat.threats.length,0,'optional well rest area is not a combat encounter');
   const action=page.locator('#poiWalkAction');
   await action.filter({hasText:'調べる'}).waitFor({state:'visible'});
   assert.equal(await action.getAttribute('aria-label'),'井戸を調べる');
   await action.tap();
   await page.locator('#poiMessageLog').filter({hasText:'冷たい水の音がする。旅人が腰を下ろせるベンチがある。'}).waitFor({state:'visible'});
   assert.deepEqual(await position(page),at(120,44),'read action leaves avatar on original dry stand tile');
   assert.equal(page.url(),url);
   await assertJourneyState(page,raw);
   if(out)await page.screenshot({path:out+'/v199-traveler-well.png'});
   await singleStep(page,121,44);await calm(page);
   await singleStep(page,122,44);await calm(page);
  }
  assert.deepEqual(await position(page),at(121,51));
  assert.equal(page.url(),url,'entire route remains on same play page and floor');
  assert.equal((await state(page)).inventory.weapon,'equipWoodSword');
  await assertJourneyState(page,raw);
  await exactProtection(page,original);assert.deepEqual(errors,[]);
  await page.reload();await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
  assert.deepEqual(await position(page),at(121,51),'ordinary resume restores old-track endpoint');
  assert.equal(await stock(page),raw);
  if(out)await page.screenshot({path:out+'/v199-through-road.png'});
 }finally{await ctx.close()}
}
async function nativeTapPace(browser){
 const {ctx,page,errors}=await launch(browser,at(124,34),2);
 try{
  const target=page.locator('[data-poi-dir="s"]');
  const box=await target.boundingBox();
  assert(box);
  await target.evaluate(el=>{
   window.__wellTapEvents=[];
   for(const type of ['pointerdown','pointerup'])el.addEventListener(type,e=>{
    window.__wellTapEvents.push({type:e.type,at:performance.now(),trusted:e.isTrusted,pointer:e.pointerType});
   },{capture:true});
  });
  const cdp=await ctx.newCDPSession(page);
  const touch={x:(box.x+box.width/2),y:(box.y+box.height/2)};
  try{
   // Enqueue all four ordered trusted input packets before awaiting any,
   // avoiding between-tap Playwright stability waits and CI round trips.
   await Promise.all(['touchStart','touchEnd','touchStart','touchEnd'].map(type=>
    cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchStart'?[touch]:[]})));
  }finally{await cdp.detach()}
  const events=await page.evaluate(()=>window.__wellTapEvents);
  assert.deepEqual(events.map(e=>e.type),['pointerdown','pointerup','pointerdown','pointerup']);
  assert(events.every(e=>e.trusted&&e.pointer==='touch'));
  assert(events[2].at-events[1].at<=280,`real taps must arrive inside the former dash window: ${JSON.stringify(events)}`);
  assert(events[1].at-events[0].at<=230,"first tap is physically short enough for the former rule");
  let pos=await position(page);
  assert.equal(pos.x,124);
  assert(pos.z===35||pos.z===36,'two short taps cause one or two legal cells, never held auto-repeat');
  assert.deepEqual((await state(page)).walk,{stepMs:175,walkMs:175});
  await calm(page);await singleStep(page,124,pos.z+1);
  assert.deepEqual((await state(page)).walk,{stepMs:175,walkMs:175},'subsequent legal step still moves at walking speed');
  await assertJourneyState(page,fixtures[kitKey]);
  assert.deepEqual(errors,[]);
 }finally{await ctx.close()}
}
let browser;
try{
 browser=await chromium.launch({headless:true,
  ...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await trial(browser);
 await nativeTapPace(browser);
 console.log('PASS native portrait dry through-road and optional well reading with unchanged inventory and safe resume');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
