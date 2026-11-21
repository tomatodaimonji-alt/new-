import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const server=createServer((req,res)=>{
 res.setHeader('content-type','text/html; charset=utf-8');
 res.end(req.url.startsWith('/seed')?'<!doctype html><title>Test fixtures</title>':html);
});
await new Promise((yes,no)=>server.listen(0,'127.0.0.1',yes).once('error',no));
const origin='http://127.0.0.1:'+server.address().port;
const idList=['lodging','kitchen','workshop','base'];
const map=(type)=>({format:'forest-world-v1',version:1,width:30,height:30,size:30,world:[{x:2,y:0,z:2,type,rot:0}],terrainHeights:[],models:[],prefabs:[]});
const fixture={
 'forest-world-editor-v1':JSON.stringify(map('stonewall'),null,2),
 'world-workshop-pois-v1':JSON.stringify([{name:'ギルド',id:'poi-guild-primary-v87',map:map('woodwall')},{name:'冒険者ギルド',id:'poi-adventurers-guild-v102',map:map('stonewall')}],null,2),
 'world-workshop-adventure-v1':JSON.stringify({version:1,x:23,z:24,monsters:[]},null,2),
 'pine-adventurers-guild-poi-before-v102':'{"untouched":true}',
 'pine-guild-screenshot-before-v86':JSON.stringify(map('stonewall'),null,2)
};
const step=(page,dx,dz)=>page.keyboard.press(dx===1?'ArrowRight':dx===-1?'ArrowLeft':dz===1?'ArrowDown':'ArrowUp');
const snap=async page=>page.evaluate(()=>window.__editorTest?.facility?.()??null);
const inside=(b,x,z)=>x>b.x1&&x<b.x2&&z>b.z1&&z<b.z2;
function route(map,start,check){
 const id=(x,z)=>x+','+z;
 const taken=new Set();
 const open=new Set(['woodfloor','stone','earth','grass','sand','chairWood','chairClassic','stoolRound','flowerField','bushFlower','tallGrass','lantern','woodfloorLight','woodfloorDark','brickfloor','roadCobbleFull','roadCutStoneFull','roadGravelFull','grassWild']);
 for(const o of map.world)if(o.y===0&&!open.has(o.type)&&!/(?:Door|DoorOpen|Entrance)$/.test(o.type))taken.add(id(o.x,o.z));
 const q=[start],prev=new Map([[id(start.x,start.z),null]]);
 for(let i=0;i<q.length;i++){
  const here=q[i];
  if(check(here.x,here.z)){
   const out=[];for(let at=here;at;at=prev.get(id(at.x,at.z)))out.push(at);
   return out.reverse();
  }
  for(const [dx,dz] of [[0,-1],[0,1],[-1,0],[1,0]]){
   const x=here.x+dx,z=here.z+dz,k=id(x,z);
   if(x<0||z<0||x>=map.width||z>=map.height||prev.has(k)||taken.has(k))continue;
   prev.set(k,here);q.push({x,z});
  }
 }
 return null;
}
async function walk(page,steps){
 assert(steps?.length>1,'no eligible walking route');
 let from=steps[0];
 for(const point of steps.slice(1)){
  await step(page,point.x-from.x,point.z-from.z);
  const found=await snap(page);
  assert.deepEqual(found.position,point,'walking failed at '+JSON.stringify(point));
  await page.waitForTimeout(185);from=point;
 }
}
const expectStore=async page=>assert.deepEqual(await page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),Object.keys(fixture)),fixture);
async function seed(page){
 await page.goto(origin+'/seed');
 await page.evaluate(f=>{for(const [k,v] of Object.entries(f))localStorage.setItem(k,v)},fixture);
}
const out=process.env.FACILITY_SCREENSHOTS;
if(out)await mkdir(out,{recursive:true});
let browser;
try{
 browser=await chromium.launch({...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const desktop=await browser.newPage({viewport:{width:1210,height:800}});
 desktop.setDefaultTimeout(4500);
 const errors=[];
 desktop.on('pageerror',e=>errors.push(e.message));
 await seed(desktop);
 await desktop.goto(origin+'/?test=1');
 assert((await desktop.evaluate(()=>window.__editorTest?.state()))?.glLink,'WebGL init');
 await desktop.locator('#poiSampleCategories .categoryRow').click();
 assert.equal(await desktop.locator('[data-facility-id]').count(),4,'built-in POI entries');
 assert.equal(await desktop.locator('#poiSampleCategories button').filter({hasText:'冒険者ギルド'}).count(),1,'existing guild still selectable');
 await expectStore(desktop);
 for(const id of idList){
  if(id==='lodging') await desktop.locator('[data-facility-id="lodging"]').click();
  else await desktop.goto(origin+'/?facility='+id+'&test=1');
  const start=await snap(desktop);
  assert(start,'preview was not active');
  assert.equal(start.id,id);
  assert.deepEqual(start.position,start.spawn);
  assert.equal(start.hiddenRoof,null);
  await expectStore(desktop);
  const [download]=await Promise.all([desktop.waitForEvent('download'),desktop.locator('#facilityExport').click()]);
  assert.equal(download.suggestedFilename(),'workshop-facility-'+id+'.json');
  const exported=JSON.parse(readFileSync(await download.path(),'utf8'));
  assert.equal(exported.format,'forest-world-v1');
  assert(exported.world.length>40&&exported.width<=128);
  assert.equal(start.buildings.length,id==='base'?3:1);
  assert(start.roofMeshes.every(count=>count>0));
  if(out)await desktop.screenshot({path:out+'/'+id+'.png'});
  for(const [index,b] of start.buildings.entries()){
   const beforeStep=await snap(desktop);
   await walk(desktop,route(exported,beforeStep.position,(x,z)=>inside(b,x,z)));
   assert.equal((await snap(desktop)).hiddenRoof,index,'wrong roof hidden at building '+index);
   if(out&&id==='base')await desktop.screenshot({path:out+'/base-room-'+index+'.png'});
   if(id==='base') {
    const here=await snap(desktop);
    await walk(desktop,route(exported,here.position,(x,z)=>here.buildings.every(other=>!inside(other,x,z))));
    assert.equal((await snap(desktop)).hiddenRoof,null,'roof did not restore');
   }
  }
  await expectStore(desktop);
  await desktop.reload();
  assert.deepEqual((await snap(desktop)).position,start.spawn);
  assert.equal((await snap(desktop)).hiddenRoof,null);
  await expectStore(desktop);
  await desktop.locator('#returnEditorWorld').click();
  await desktop.waitForURL(url=>!url.searchParams.has('facility'));
  await desktop.waitForFunction(()=>window.__editorTest?.state?.().glLink===true);
  assert.equal(await snap(desktop),null);
  const restored=await desktop.evaluate(()=>window.__editorTest?.state());
  assert(restored?.world.some(o=>o.x===2&&o.z===2&&o.type==='stonewall'));
  await expectStore(desktop);
  console.log('PASS: '+id+' navigation, rendering, walking, JSON, storage and reload');
 }
 // Force editor reload on browser Back (launch default disables BFCache) with a
 // legacy snapshot that normal v102 boot would install and persist automatically.
 const historyPage=await browser.newPage({viewport:{width:1210,height:800}});
 await historyPage.goto(origin+'/?test=1');
 const historical=map('stonewall');
 historical.world=Array.from({length:100},(_,i)=>({x:i%10,z:Math.floor(i/10),y:0,type:i<3?'counterWood':'stonewall',rot:0}));
 const historicalJson=JSON.stringify(historical,null,2);
 await historyPage.evaluate(raw=>{
  localStorage.setItem('pine-guild-screenshot-before-v86',raw);
  localStorage.setItem('world-workshop-pois-v1','[ ]');
 },historicalJson);
 await historyPage.locator('#poiSampleCategories .categoryRow').click();
 await historyPage.locator('[data-facility-id="base"]').click();
 assert.equal((await snap(historyPage)).id,'base');
 await historyPage.goBack();
 assert(new URL(historyPage.url()).searchParams.has('facility-return'));
 assert.equal(await historyPage.evaluate(()=>localStorage.getItem('world-workshop-pois-v1')),'[ ]');
 assert.equal(await historyPage.evaluate(()=>localStorage.getItem('pine-guild-screenshot-before-v86')),historicalJson);
 console.log('PASS: browser Back preserves pending legacy guild data');
 assert.deepEqual(errors,[],'desktop page errors');
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
 mobile.on('pageerror',e=>errors.push(e.message));
 await seed(mobile);
 await mobile.goto(origin+'/?facility=base&test=1');
 assert.equal((await snap(mobile)).id,'base');
 for(const css of ['#returnEditorWorld','#facilityExport','[data-poi-dir="n"]']){
  const loc=mobile.locator(css);assert(await loc.isVisible(),css+' not visible');
  const box=await loc.boundingBox();assert(box.x>=0&&box.y>=0&&box.x+box.width<=390&&box.y+box.height<=844,css+' overflowed');
 }
 const pad=await mobile.locator('#poiWalkPad').boundingBox();
 const north=await mobile.locator('[data-poi-dir="n"]').boundingBox();
 assert(pad.height<=180&&north.width>=44&&north.height>=44,'compact touch controls');
 const mobileStart=(await snap(mobile)).position;
 await mobile.locator('[data-poi-dir="n"]').tap();
 assert.deepEqual((await snap(mobile)).position,{x:mobileStart.x,z:mobileStart.z-1},'touch movement');
 if(out)await mobile.screenshot({path:out+'/mobile.png'});
 await expectStore(mobile);
 assert.deepEqual(errors,[],'page errors');
 console.log('PASS: New POI discovery, WebGL, four preview routes and exports, real keyboard door passage and roof switching, reload, return, unchanged save bytes, mobile controls.');
}finally{
 await browser?.close();await new Promise(resolve=>server.close(resolve));
}
