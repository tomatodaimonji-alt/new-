import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const h=readFileSync(process.argv[2]??'world-editor.html','utf8');
for(const [,body] of h.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(body);
if(process.env.SNOW_PASS_SYNTAX_ONLY){console.log('exact game scripts parse');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url==='/seed'?'<!doctype html><title>Ice route</title>':h);
});
await new Promise((r,j)=>server.listen(0,'127.0.0.1',r).once('error',j));
const root='http://127.0.0.1:'+server.address().port;
let b;
try{
 b=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const page=await (await b.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:.65})).newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
 await page.goto(root+'/seed');
 const stock=await page.evaluate(()=>{
  const slots=Array(27).fill(null);slots[0]={type:'equipWoodSword',count:1,durability:77};slots[1]={type:'healingHerb',count:1};
  const kit=JSON.stringify({version:1,weaponDurabilityVersion:2,weapon:'equipWoodSword',potions:1,gold:9,slots,
   drops:[{type:'healingHerb',x:50,z:126,y:0},{type:'healingHerb',x:12,z:2,y:0}]});
  localStorage.setItem('world-workshop-hotbar-v1',kit);
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:49,z:126,y:0,facing:2},townLayout:5,townMapHeight:128,view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
  return kit;
 });
 await page.goto(root+'/?resume=1&test=1');
 const state=()=>page.evaluate(()=>({area:window.__editorTest?.snowPassRegion(),p:window.__editorTest?.freeMovementPose(),
  save:JSON.parse(localStorage.getItem('world-workshop-resume-v1')),kit:localStorage.getItem('world-workshop-hotbar-v1')}));
 const at=(id,z)=>page.waitForFunction(({id,z})=>{const qa=window.__editorTest;return qa?.snowPassRegion().id===id&&Math.abs(qa.freeMovementPose().z-z)<.08},{id,z});
 await page.locator('#pineStartupCover').waitFor({state:'hidden'});await at('base',126);
 const old=await state();assert.equal(old.area.width,128);assert.equal(old.save.region,undefined);
 await page.evaluate(()=>window.__editorTest.testWound(31));
 const pad=page.locator('#poiAnalogPad'),cdp=await page.context().newCDPSession(page);
 const send=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
 const roll=async(dir,next,z=dir>0?0:127)=>{
  const r=await pad.boundingBox();assert(r);
  const p={x:Math.round(r.x+r.width*.5),y:Math.round(r.y+r.height*.5),id:7};
  await send('touchStart',[p]);await send('touchMove',[{...p,y:p.y+36*dir}]);
  await at(next,z);
  await send('touchEnd',[]);
 };
 // The actual switch must refuse a real storage failure rather than
 // persisting a half-entered region or changing the carried kit.
 await page.evaluate(()=>{
  window.__snowStorageWrite=Storage.prototype.setItem;
  Storage.prototype.setItem=function(k,v){
   if(k==='world-workshop-resume-v1'&&JSON.parse(v).region==='snowpass'){
    window.__snowRefused=true;throw new DOMException('fixture full','QuotaExceededError');
   }
   return window.__snowStorageWrite.call(this,k,v);
  };
 });
 await roll(1,'base',127);
 // At the edge, hold a new actual drag until the resolver attempts the write.
 const rect=await pad.boundingBox(),press={x:Math.round(rect.x+rect.width/2),y:Math.round(rect.y+rect.height/2),id:8};
 await send('touchStart',[press]);await send('touchMove',[{...press,y:press.y+36}]);
 await page.waitForFunction(()=>window.__snowRefused===true);
 await send('touchEnd',[]);
 const refused=await state();assert.equal(refused.area.id,'base');
 assert.equal(await page.evaluate(()=>window.__editorTest.canStep(49,128,49,127)),false,'ordinary map/path checks cannot pass through the special link');assert.equal(refused.save.region,undefined);assert.equal(refused.kit,stock);
 await page.evaluate(()=>{Storage.prototype.setItem=window.__snowStorageWrite});
 await page.waitForFunction(()=>window.__editorTest.snowPassRegion().field);
 await roll(1,'snowpass');
 await page.waitForFunction(()=>window.__editorTest.snowPassRegion().timing?.firstFrameMs>0);
 const entry=await state();
 assert.deepEqual([entry.area.width,entry.area.height,entry.area.actors,entry.area.hp],[24,29,0,69]);
 assert.deepEqual(entry.area.spawn,[12,0]);assert.equal(entry.p.x,12);assert.equal(entry.save.region,'snowpass');assert.equal(entry.kit,stock);
 assert.equal(entry.area.music,'snow','entering the active snow pass picks its own scene');
 assert.deepEqual(await page.evaluate(()=>[window.__editorTest.snowInventoryQA.clock(),window.__editorTest.snowInventoryQA.weapon()]),[true,'equipWoodSword']);
 await page.waitForTimeout(225);await page.keyboard.press('ArrowDown');await at('snowpass',1);
 assert.equal(await page.evaluate(()=>window.__editorTest.snowInventoryQA.drop(1).ok),true);
 assert.equal(await page.evaluate(()=>window.__editorTest.snowInventoryQA.gold(2).ok),true);
 const saved=JSON.parse((await state()).kit);
 assert.deepEqual(saved.drops,JSON.parse(stock).drops);
 assert.deepEqual(saved.snowDrops,[{type:'healingHerb',x:12,z:2,y:0}]);
 assert.equal(saved.snowGroundGold[0].amount,2);assert.equal(saved.gold,7);
 await page.reload();await page.locator('#pineStartupCover').waitFor({state:'hidden'});await at('snowpass',1);
 const restored=await state();assert.equal(restored.area.hp,69);assert.deepEqual(JSON.parse(restored.kit).snowDrops,saved.snowDrops);
 await page.keyboard.press('ArrowDown');await at('snowpass',2);
 const repicked=JSON.parse((await state()).kit);assert(!repicked.snowDrops?.length);assert.deepEqual(repicked.drops,saved.drops);
 await roll(-1,'base');
 await page.waitForFunction(()=>window.__editorTest.snowPassRegion().timing?.firstFrameMs>0);
 const back=await state();
 assert.equal(back.area.width,128);assert.equal(back.p.x,49);assert.equal(back.save.region,undefined);
 assert.equal(back.area.hp,69);assert.deepEqual(JSON.parse(back.kit).snowGroundGold,saved.snowGroundGold);assert(back.area.actors>0);assert.deepEqual(back.area.spawn,old.area.spawn,'base death respawn does not use local snow coordinates');assert(back.area.forest,'same loaded base still has normal forest');
 assert.deepEqual(JSON.parse(back.kit).drops,saved.drops);
 await page.waitForTimeout(225);await page.keyboard.press('ArrowUp');await at('base',126);
 await page.waitForTimeout(225);await page.keyboard.press('ArrowRight');
 await page.waitForFunction(()=>window.__editorTest.freeMovementPose().x>49.92);
 const picked=JSON.parse((await state()).kit);
 assert.deepEqual(picked.drops,[{type:'healingHerb',x:12,z:2,y:0}],'only base local ground item is collected after return');
 assert(picked.potions===2||picked.slots?.some(d=>d?.type==='healingHerb'&&d.count===2),'real base ground pickup still transfers into the same inventory');
 assert(back.area.timing.veilFrames>=1&&back.area.timing.veilMs>0,'cold return paints a visible transition before rebuilding the full world');
 assert(entry.area.activeScenes===1&&entry.area.actors===0,'only the active snow scene/actor set is submitted');
 console.log('Exact rAF switch timing/bytes',JSON.stringify({baseVertices:old.area.vertices,snowVertices:entry.area.vertices,entry:entry.area.timing,coldReturn:back.area.timing}));
 const setResume=(region,position)=>page.evaluate(([region,position])=>{
  const current=JSON.parse(localStorage.getItem('world-workshop-resume-v1'));
  if(region===null)delete current.region;else current.region=region;
  current.position=position;
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify(current));
 },[region,position]);
 await setResume('capital',{x:12,z:2,y:0,facing:2});
 await page.reload();await page.locator('#pineStartupCover').waitFor({state:'hidden'});
 await at('base',old.area.spawn[1]);
 assert.equal((await state()).p.x,old.area.spawn[0],'unknown region never reuses its local position on base');
 await setResume(null,{x:49,z:126,y:0,facing:2});
 await page.reload();await page.locator('#pineStartupCover').waitFor({state:'hidden'});await at('base',126);
 await roll(1,'snowpass');
 await page.waitForFunction(()=>window.__editorTest.snowPassRegion().timing?.firstFrameMs>0);
 await roll(-1,'base');
 await page.waitForFunction(()=>window.__editorTest.snowPassRegion().timing?.firstFrameMs>0);
 const warm=(await state()).area.timing;
 assert(warm.veilFrames>=1&&warm.veilMs>0,'warm return also paints transition while keeping no inactive base VBO');
 console.log('Exact warm return timing/bytes',JSON.stringify({warm}));
 await page.evaluate(()=>window.__editorTest.snowInventoryQA.markEditor());
 await roll(1,'snowpass');
 await page.evaluate(()=>window.__editorTest.snowInventoryQA.editor());
 const edit=await state();
 assert.equal(edit.area.id,'base');assert.equal(edit.save.play,false);assert.equal(edit.save.region,undefined);
 assert.equal(await page.evaluate(()=>window.__editorTest.snowInventoryQA.sameEditor()),true,'original unsaved base edit baseline remains distinct');
 assert.deepEqual(errors,[]);
 console.log('PASS legacy save, actual walking both borders, one region, cold reopen, base and held kit untouched');
}finally{await b?.close();await new Promise(r=>server.close(r))}
