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
const route=site.southRoad?.path,shelter=site.southRoad?.shelter;
assert(route&&shelter&&site.map.height===128&&site.map.width===128,'v209 must extend actual Game World south');
const oldLimit=route.findIndex(p=>p.x===97&&p.z===95);
assert(oldLimit>=0&&route[oldLimit+1].x===97&&route[oldLimit+1].z===96,'existing position borders the expansion');
const blade={x:97,z:96,y:0,type:'equipBoneSword',durability:53};
const xy=({x,z})=>[x,z];
const points=p=>p.map(xy);
const directions=(a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1];assert.equal(Math.abs(dx)+Math.abs(dz),1);return dx>0?'ArrowRight':dx<0?'ArrowLeft':dz>0?'ArrowDown':'ArrowUp'};
const original=points(route.slice(oldLimit));assert.deepEqual(original.at(-1),[105,111]);
const branch=points(shelter.path);
for(const list of [original,branch])for(let i=1;i<list.length;i++)directions(list[i-1],list[i]);
if(process.env.SOUTH_ROAD_LAYOUT_ONLY==='1'){
 console.log('PASS v209 authored south-boundary route, connector, rest shelter, arrival');process.exit(0);
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
 [kitKey]:JSON.stringify({version:1,weapon:"equipWoodSword",potions:0,gold:12,claimedCaches:["glade"],drops:[blade]}),
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
 if(process.env.SOUTH_ROAD_PROFILE==='1')await ctx.addInitScript(()=>{
  const p=WebGLRenderingContext.prototype,upload=p.bufferData,draw=p.drawArrays;
  window.__southGl={draws:0,uploads:0,uploadBytes:0};
  p.bufferData=function(_target,data){const g=window.__southGl;g.uploads++;g.uploadBytes+=typeof data==='number'?data:data?.byteLength||0;return upload.apply(this,arguments)};
  p.drawArrays=function(){window.__southGl.draws++;return draw.apply(this,arguments)};
 });
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
 await page.goto(origin+'/seed');
 await page.evaluate(({fixtures,resumeKey,start})=>{
  for(const [k,v] of Object.entries(fixtures))localStorage.setItem(k,v);
  localStorage.setItem('world-workshop-town-clock-v1',JSON.stringify({version:1,gameMs:10*60*500}));
  localStorage.setItem(resumeKey,JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:start.x,z:start.z,y:start.level,facing:2},townLayout:5,
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
const inv=info=>[...info.inventory.hotbar,...info.inventory.bag].filter(c=>c?.type===blade.type);
const storedResume=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),resumeKey);
const rawMap=async page=>await page.evaluate(()=>window.__editorTest.data());
async function walk(page,path){
 for(const [x,z] of path){
  const p=(await api(page)).position;
  await page.keyboard.press(directions([p.x,p.z],[x,z]));
  try{await waitPosition(page,x,z,0)}catch(e){throw new Error('Walk from '+[p.x,p.z]+' to '+[x,z]+' stopped at '+JSON.stringify((await api(page)).position),{cause:e})}
  await page.waitForTimeout(210);
 }
}
async function trial(browser){
 const {ctx,page,errors}=await launch(browser,pos(...original[0],0));
 try{
  const world=await rawMap(page),initial=await stock(page),url=page.url(),entry=await api(page);
  assert.deepEqual([world.width,world.height],[128,128]);
  assert.deepEqual(entry.position,pos(97,95,0),'old layout-5 saved coordinates do not shift on upgrade');
  assert.deepEqual(JSON.parse(initial).drops,[blade]);
  assert.equal(inv(entry).length,0);
  await page.locator('#poiWalkAction').tap(); // genuine gesture wakes native audio
  await page.waitForFunction(()=>window.__editorTest.facility().musicZone==='outside');
  await walk(page,original.slice(1,2));
  await page.waitForFunction(()=>window.__editorTest.facility().inventory.bag.concat(window.__editorTest.facility().inventory.hotbar).some(c=>c?.type==='equipBoneSword'));
  const saved=await storedResume(page),picked=await stock(page);
  assert.equal(saved.townLayout,5);assert.equal(saved.townMapHeight,128);
  assert.deepEqual(saved.position,{x:97,z:96,y:0,facing:2});
  assert.equal(JSON.parse(picked).drops,undefined);
  assert.deepEqual(inv(await api(page)),[{type:blade.type,count:1,durability:blade.durability}]);
  if(out)await page.screenshot({path:out+'/v209-south-new-edge.png'});
  await page.reload();await active(page);
  assert.deepEqual((await api(page)).position,pos(97,96,0),'cold reload restores real new south row, without snapping or translating');
  assert.equal(await stock(page),picked);
  await page.locator('#poiWalkAction').tap();
  for(const [x,z] of original.slice(2)){
   await walk(page,[[x,z]]);
   if(x===branch[0][0]&&z===branch[0][1]){
    await walk(page,branch.slice(1));
    assert.deepEqual((await api(page)).position,pos(shelter.stand.x,shelter.stand.z,0));
    assert(world.world.some(o=>o.x===shelter.x&&o.z===shelter.z&&o.type===shelter.type),'actual shelter prop borders native path');
    if(out)await page.screenshot({path:out+'/v209-south-shelter.png'});
    await walk(page,branch.slice(0,-1).reverse());
   }
  }
  // This same browser journey now crosses the native paired span when authored.
  for(const part of site.southRoad.creek?.bridgePairs.flat()||[]){
   assert(original.some(([x,z])=>x===part.x&&z===part.z),'native crossing lies on the same tested walk');
   assert(world.world.some(o=>o.x===part.x&&o.z===part.z&&o.y===0&&o.type==='river'));
   assert(world.world.some(o=>o.x===part.x&&o.z===part.z&&o.y===0&&o.type===part.type&&o.rot===part.rot));
  }
  const expectedMusic=site.southRoad.town?'market':'outside';
  await page.waitForFunction(zone=>window.__editorTest.facility().musicZone===zone,expectedMusic);
  const end=await api(page);
  assert.deepEqual(end.position,pos(105,111,0));
  assert.equal(end.musicZone,expectedMusic);assert.equal(end.sceneLayer,'surface');
  if(site.southRoad.town)assert.equal(end.miniMap.location,site.southRoad.town.name);
  assert.equal(end.dungeonEntranceSerial,entry.dungeonEntranceSerial);
  assert.equal(page.url(),url);
  assert.equal(await stock(page),picked,'ordinary travel never grants equipment or quest progress');
  assert.equal(JSON.parse(picked).quests,undefined);
  assert.deepEqual(await rawMap(page),world);
  for(const [k,v] of Object.entries(fixtures))if(k!==kitKey)assert.equal(await page.evaluate(key=>localStorage.getItem(key),k),v);
  assert.deepEqual(errors,[]);
  if(out)await page.screenshot({path:out+'/v209-south-arrival.png'});
  if(process.env.SOUTH_ROAD_PROFILE==='1')console.log('Chromium traversal counters, no Android inference',await page.evaluate(()=>window.__southGl));
 }finally{await ctx.close()}
}
let browser;
try{
 browser=await chromium.launch({headless:true,
  ...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await trial(browser);
 console.log('PASS native road past former south boundary, ordinary pickup/reload, shelter and unobstructed arrival');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
