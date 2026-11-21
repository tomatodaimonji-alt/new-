import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const server=createServer((req,res)=>{
 res.setHeader('content-type','text/html; charset=utf-8');
 res.end(req.url.startsWith('/seed')?'<!doctype html><title>Save fixture</title>':html);
});
await new Promise((res,rej)=>server.listen(0,'127.0.0.1',res).once('error',rej));
const origin='http://127.0.0.1:'+server.address().port;
const resumeKey='world-workshop-resume-v1';
const map={format:'forest-world-v1',version:1,width:30,height:30,size:30,terrainHeights:[],models:[],prefabs:[],
 world:[{x:2,y:0,z:2,type:'stonewall',rot:0}]};
const fixtures={
 'forest-world-editor-v1':JSON.stringify(map,null,2),
 'world-workshop-pois-v1':JSON.stringify([{id:'poi-adventurers-guild-v102',name:'冒険者ギルド',map}],null,2),
 'world-workshop-adventure-v1':JSON.stringify({version:1,x:24,z:24,monsters:[]},null,2),
 'pine-guild-screenshot-before-v86':JSON.stringify(map,null,2)
};
const expectStorage=async p=>assert.deepEqual(await p.evaluate(keys=>
 Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),Object.keys(fixtures)),fixtures);
const state=async p=>p.evaluate(()=>window.__editorTest?.facility?.()??null);
const resume=async p=>p.evaluate(k=>JSON.parse(localStorage.getItem(k)),resumeKey);
const open=async(ctx,p,query,errors)=>{if(p)await p.close();const next=await ctx.newPage();
 next.on('pageerror',e=>errors.push(e.message));await next.goto(origin+'/'+query);return next;};
let browser;
try{
 const args=['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'];
 browser=await chromium.launch({args,headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
 const ctx=await browser.newContext({viewport:{width:1210,height:800}});
 const errors=[];
 let page=await open(ctx,null,'seed',errors);
 await page.evaluate(f=>{for(const [k,v] of Object.entries(f))localStorage.setItem(k,v)},fixtures);
 page=await open(ctx,page,'?facility=base&test=1',errors);
 assert.equal((await state(page)).active,false);
 await page.locator('#poiWalkToggle').click();
 const start=(await state(page)).position;
 let changed=null;
 for(const [key,dx,dz] of [['ArrowUp',0,-1],['ArrowDown',0,1],['ArrowRight',1,0],['ArrowLeft',-1,0]]){
  const x=start.x+dx,z=start.z+dz;
  if(!await page.evaluate(([x,z])=>window.__editorTest.canStep(x,z),[x,z]))continue;
  await page.keyboard.press(key);changed={x,z,level:0};assert.deepEqual((await state(page)).position,changed);break;
 }
 assert(changed,'base spawn has no reachable adjacent cell');
 assert.deepEqual((await resume(page)).position,{x:changed.x,z:changed.z,y:0,facing:(await resume(page)).position.facing});
 page=await open(ctx,page,'',errors); // Android cold launch URL
 assert.equal(await page.locator('#facilitySessionName').textContent(),'プレイヤー拠点');
 assert.equal(await page.locator('#poiWalkToggle').getAttribute('aria-pressed'),'true');
 assert.equal((await resume(page)).position.x,changed.x);
 assert.equal((await resume(page)).position.z,changed.z);
 await expectStorage(page);
 page=await open(ctx,page,'?revision=1763711111000',errors); // Android updater URL
 assert.equal(await page.locator('#poiWalkToggle').getAttribute('aria-pressed'),'true');
 assert.equal((await resume(page)).position.x,changed.x);
 assert.equal((await resume(page)).position.z,changed.z);
 await expectStorage(page);
 page=await open(ctx,page,'?resume=1&test=1',errors);
 assert.deepEqual((await state(page)).position,changed);
 page=await open(ctx,page,'?facility=kitchen&test=1',errors);
 assert.equal((await state(page)).id,'kitchen');assert.equal((await state(page)).active,false);
 await page.locator('#facilityExit').click();
 await page.waitForURL(u=>u.searchParams.get('facility-return')==='1');
 assert.equal(await page.locator('#facilitySessionActions').isVisible(),false);
 page=await open(ctx,page,'',errors);
 assert.equal(await page.locator('#facilitySessionActions').isVisible(),false);
 assert.equal((await resume(page)).route,'editor');
 await expectStorage(page);
 await page.evaluate(k=>localStorage.setItem(k,JSON.stringify({version:1,route:'facility',id:'unknown',play:true})),resumeKey);
 // go to an empty document first so its pagehide cannot overwrite injected test checkpoint
 await page.goto(origin+'/seed');
 await page.evaluate(k=>localStorage.setItem(k,JSON.stringify({version:1,route:'facility',id:'unknown',play:true})),resumeKey);
 page=await open(ctx,page,'?revision=1763711111001',errors);
 assert.equal(await page.locator('#facilitySessionActions').isVisible(),false);
 await expectStorage(page);
 await page.goto(origin+'/seed');
 const innPoint={x:7,z:5,y:1,facing:0}; // Clear north-west bedroom cell.
 await page.evaluate(([key,position])=>localStorage.setItem(key,JSON.stringify({
  version:1,route:'facility',id:'lodging',play:true,position
 })),[resumeKey,innPoint]);
 page=await open(ctx,page,'?resume=1&test=1',errors);
 assert.deepEqual((await state(page)).position,{x:innPoint.x,z:innPoint.z,level:1});
 assert.match(await page.locator('#poiWalkCoords').textContent(),/2階/);
 await expectStorage(page);
 assert.deepEqual(errors,[]);
 console.log('PASS: previous POI play and position after cold and updater restart, explicit route/return, invalid target fallback, byte-identical original saves.');
}finally{
 await browser?.close();await new Promise(res=>server.close(res));
}
