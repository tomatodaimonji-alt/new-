import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import vm from 'node:vm';

const html=readFileSync(process.argv[2]||'world-editor.html','utf8');
const start=html.indexOf('const FACILITY_SITES=Object.freeze('),end=html.indexOf('function workshopResumeDecode(',start);
assert(start>=0&&end>start);
const site=vm.runInNewContext(html.slice(start,end)+";buildFacilitySite('base')");
const road=site.southRoad,town=road.town;
assert.equal(town.name,'街道の宿場');assert.deepEqual([town.market.receiving.stand.x,town.market.receiving.stand.z],[96,115]);
assert(road.path.some(p=>p.x===101&&p.z===104)&&road.path.some(p=>p.x===101&&p.z===105));
if(process.env.SOUTH_SHIPMENT_LAYOUT_ONLY==='1'){console.log('PASS southern shipment fixture landmarks');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const move=' a.x=p.x;a.z=p.z;a.y=p.y;a.activity=label;a.actorRetryCardinal=false;poiTownNpcVersion++;';
assert.equal(html.split(move).length,2,'instrument actual NPC step after native collision');
const trace=move+" if(a.role.id==='southmerchant')(window.southActualSteps??=[]).push({x:a.x,z:a.z,y:a.y,fromX:a.fromX,fromZ:a.fromZ,fromY:a.fromY,label});";
const fixture=html.replace(move,trace); // observers only, no time/placement/loot substitutions
const server=createServer((req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url==='/seed'?'<!doctype html><title>Disposable test save</title>':fixture);
});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const origin='http://127.0.0.1:'+server.address().port;
const kitKey='world-workshop-hotbar-v1',resumeKey='world-workshop-resume-v1',clockKey='world-workshop-town-clock-v1';
const protectedSaves={
 'forest-world-editor-v1':'{"format":"forest-world-v1","version":1,"width":30,"height":30,"size":30,"world":[{"x":2,"y":0,"z":2,"type":"stonewall","rot":1}],"models":[],"prefabs":[],"terrainHeights":[],"checks":[]}',
 'world-workshop-audio-v2':'{"master":70,"bgm":40,"se":50,"enabled":true}'
};
const day2=1440+12*60+40;
const kit={version:1,weapon:null,potions:0,gold:18,claimedCaches:['glade'],toolshopSupply:{version:1,stock:3,cargo:0,delivered:2}};
const yard=[34,61];
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const ctx=await browser.newContext({viewport:{width:390,height:740},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 // Count real persisted kit writes; observe the real actor positions at write time.
 await ctx.addInitScript(({kitKey})=>{
  const set=Storage.prototype.setItem;
  window.southKitWrites=[];
  Storage.prototype.setItem=function(key,v){
   const result=set.call(this,key,v),api=window.__editorTest;
   if(this===localStorage&&key===kitKey&&api?.townResidents){
    const actors=api.townResidents().actors;
    window.southKitWrites.push({kit:JSON.parse(v),merchant:actors.find(a=>a.id==='southmerchant'),noah:actors.find(a=>a.id==='stablekeeper')});
   }
   return result;
  };
 },{kitKey});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/seed');
 await page.evaluate(({kitKey,clockKey,resumeKey,kit,day2,protectedSaves})=>{
  for(const [key,value] of Object.entries(protectedSaves))localStorage.setItem(key,value);
  localStorage.setItem(kitKey,JSON.stringify(kit));
  localStorage.setItem(clockKey,JSON.stringify({version:1,gameMs:day2*500}));
  localStorage.setItem(resumeKey,JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:101,z:112,y:0,facing:3},townLayout:5,townMapHeight:128,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 },{kitKey,clockKey,resumeKey,kit,day2,protectedSaves});
 await page.goto(origin+'/?resume=1&test=1');
 await page.waitForFunction(()=>window.__editorTest?.facility?.()?.active,{},{timeout:14000});
 const phase=page=>page.evaluate(()=>window.__editorTest.townResidents().actors.find(a=>a.id==='southmerchant'));
 const saved=page=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),kitKey);
 await page.waitForFunction(()=>window.southActualSteps?.some(p=>p.label==='south-load'&&p.x===96&&p.z===115),{},{timeout:16000,polling:180});
 assert.deepEqual(await saved(page),kit,'loading did not persist cargo or change existing stock');
 try{
  await page.waitForFunction(k=>JSON.parse(localStorage.getItem(k))?.southShipment?.readyDay===2,kitKey,{timeout:95000,polling:225});
 }catch(error){
  const trace=await page.evaluate(()=>({steps:window.southActualSteps?.slice(-10),writes:window.southKitWrites,clock:window.__editorTest.townClock()}));
  throw new Error('Physical handoff not reached '+JSON.stringify({merchant:await phase(page),trace,errors}),{cause:error});
 }
 const {steps,writes}=await page.evaluate(()=>({steps:window.southActualSteps,writes:window.southKitWrites}));
 assert(steps.length>140,'whole physical path traversed');
 for(const s of steps)assert.equal(Math.abs(s.x-s.fromX)+Math.abs(s.z-s.fromZ)+Math.abs(s.y-s.fromY),1,'adjacent native step');
 const tile=(x,z,label)=>steps.some(s=>s.x===x&&s.z===z&&s.y===0&&s.label===label);
 assert(tile(101,105,'south-out')&&tile(101,104,'south-out'),'both bridge spans crossed');
 assert(tile(31,60,'south-out')&&tile(...yard,'south-out'),'walk ends at the actual receiving yard');
 assert.equal(writes.length,1);
 assert.deepEqual([writes[0].merchant.x,writes[0].merchant.z,writes[0].merchant.activity],[...yard,'south-handoff']);
 assert.deepEqual([writes[0].noah.x,writes[0].noah.z,writes[0].noah.activity],[35,61,'work']);
 assert.deepEqual(await saved(page),{...kit,southShipment:{version:1,lastReadyDay:2,readyDay:2,cargoDay:0}});
 await page.reload();
 await page.waitForFunction(()=>window.__editorTest?.facility?.()?.active,{},{timeout:14000});
 assert.deepEqual((await saved(page)).southShipment,{version:1,lastReadyDay:2,readyDay:2,cargoDay:0});
 await page.waitForFunction(()=>window.__editorTest?.townResidents?.()?.actors.some(a=>a.id==="southmerchant"),{},{timeout:10000});
 const reloaded=await phase(page);assert(reloaded&&!reloaded.shipment,'reload does not duplicate or teleport outbound run');
 assert.equal(await page.evaluate(()=>window.southKitWrites.length),0);
 for(const [key,value] of Object.entries(protectedSaves))assert.equal(await page.evaluate(k=>localStorage.getItem(k),key),value);
 assert.deepEqual(errors,[]);
 console.log('PASS Chromium timed Marek physical route, native bridge steps and exactly one live Noah handoff, durable across reload');
}finally{await browser?.close();await new Promise(r=>server.close(r))}

