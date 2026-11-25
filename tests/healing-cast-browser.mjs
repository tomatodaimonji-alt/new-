import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const anchor='  freeMovementPose:()=>({x:poiWalkViewX,z:poiWalkViewZ,level:poiWalkLevel}),';
assert.equal(html.split(anchor).length,2);
const fixture=html.replace(anchor,anchor+`
  healingQA:{
   hp:value=>{poiPlayerHP=value;poiCombatHud()},
   state:()=>({hp:poiPlayerHP,active:poiHealingCastActive(),pos:[poiWalkX,poiWalkZ,poiWalkLevel],
    gauge:$('poiHealingCastGauge').hidden?-1:Number($('poiHealingCastGauge').getAttribute('aria-valuenow')),
    satiety:poiPlayerSatiety(poiHotbarRead()),
    chestCan:poiHotbarRead().kitchenChest?.slots[0]?.count??0,
    slots:poiInventorySlots(poiHotbarRead()).map(x=>x?{type:x.type,count:x.count}:null),
    action:poiWalkActionStarted,pending:!!poiPlayerWeaponPending})
  },`);
for(const [,text] of fixture.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(text);
if(process.env.HEALING_LAYOUT_ONLY==='1'){console.log('PASS production anchors and injected fixture compile');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<!doctype html>':fixture)});
await new Promise((y,n)=>server.listen(0,'127.0.0.1',y).once('error',n));
const url='http://127.0.0.1:'+server.address().port;
let browser;
try{
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:.7,isMobile:true,hasTouch:true});
 const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(url+'/seed');
 await p.evaluate(()=>{
  const slots=Array(27).fill(null);slots[0]={type:'equipWoodSword',count:1};slots[1]={type:'healingHerb',count:2};slots[2]={type:'cannedFood',count:2};slots[9]={type:'cannedFood',count:1};
  const oldChest=Array(18).fill(null);oldChest[0]={type:'cannedFood',count:2};
  localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":540000}');
  localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weapon:'equipWoodSword',potions:2,sword:true,gold:0,slots,kitchenChest:{version:1,slots:oldChest}}));
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:24,z:91,y:0,facing:0},townLayout:5,townMapHeight:128,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.35,orbitDistance:5.5}}));
 });
 await p.goto(url+'/?resume=1&test=1',{waitUntil:'domcontentloaded'});
 await p.locator('#pineStartupCover').waitFor({state:'hidden'});
 const state=()=>p.evaluate(()=>window.__editorTest.healingQA.state());
 const wait=(fn,arg=null)=>p.waitForFunction(fn,arg,{timeout:10000,polling:35});
 const hit=p.locator('#poiWalkAction');
 await p.evaluate(()=>{
  const g=document.getElementById('poiHealingCastGauge');
  const readings=window.__healingGaugeSamples=[];
  new MutationObserver(()=>{if(!g.hidden)readings.push([Number(g.getAttribute('aria-valuenow')),g.firstElementChild.style.transform,!!g.offsetWidth])})
   .observe(g,{attributes:true,attributeFilter:['aria-valuenow','hidden']});
 });

 await p.evaluate(()=>window.__editorTest.healingQA.hp(10));
 assert.equal((await state()).slots[1].count,2);
 await p.keyboard.press('2');
 await wait(()=>{const s=window.__editorTest.healingQA.state();return s.active&&s.gauge>=0&&s.gauge<85});
 const started=await state();assert.equal(started.hp,10);assert.equal(started.slots[1].count,2);
 await hit.tap();
 // The sacred forest added a real pine to the old north square (24,90).
 await p.keyboard.press('ArrowLeft');
 await wait(()=>window.__editorTest.healingQA.state().pos[0]===23);
 const walking=await state();assert.equal(walking.action,started.action);assert(!walking.pending);
 await wait(()=>{const s=window.__editorTest.healingQA.state();return !s.active&&s.hp===40});
 assert.equal((await state()).slots[1].count,1);assert.equal((await state()).gauge,-1);
 const samples=await p.evaluate(()=>window.__healingGaugeSamples);
 assert(samples.some(([pct,fill,show],i)=>i>0&&pct>samples[0][0]&&fill!==samples[0][1]&&show),'real overhead HUD visibly fills');
 await hit.tap();
 assert((await state()).action>started.action,'weapon resumes after healing');
 // A legacy bag can satisfies hunger at full HP without the healing cast.
 await p.evaluate(()=>window.__editorTest.healingQA.hp(100));
 const hungry=await state();
 assert(hungry.satiety>20&&hungry.satiety<65);assert.equal(hungry.chestCan,2);
 await p.locator('#poiBagToggle').tap();
 await p.locator('#poiBagPanel [data-bag-slot="0"]').tap();
 try{
  await wait(()=>{const d=document.querySelector('#poiItemDetail');return d?.open&&document.querySelector('#poiItemDetailDescription')?.textContent});
 }catch(e){
  console.error('food detail fixture',await state(),await p.locator('#poiItemDetailName').textContent(),await p.locator('#poiBagPanel').isVisible(),errors);
  throw e;
 }
 assert.match(await p.locator('#poiItemDetailDescription').textContent(),/満腹度.*HPは回復しない.*現在の満腹度/s);
 await p.locator('[data-item-detail-action="use"]').tap();
 await wait(()=>window.__editorTest.healingQA.state().slots[9]===null);
 const afterBag=await state();
 assert(afterBag.satiety>=hungry.satiety+31&&afterBag.satiety<=hungry.satiety+35);
 assert.equal(afterBag.hp,100);assert(!afterBag.active);
 if(await p.locator('#poiBagPanel').isVisible())await p.locator('#poiBagClose').tap();
 await p.keyboard.press('3');
 await wait(()=>window.__editorTest.healingQA.state().slots[2]?.count===1);
 const afterBar=await state();
 assert(afterBar.satiety>afterBag.satiety&&afterBar.satiety>=98);
 assert.equal(afterBar.hp,100);assert(!afterBar.active);
 await p.evaluate(()=>window.__editorTest.healingQA.hp(40));
 await p.keyboard.press('2');await wait(()=>window.__editorTest.healingQA.state().active);
 await p.evaluate(()=>window.__workshopAudioForeground(false));
 assert((await state()).active);
 await p.waitForTimeout(1550);
 assert.equal((await state()).hp,40);assert.equal((await state()).slots[1].count,1);
 await p.evaluate(()=>window.__workshopAudioForeground(true));
 await wait(()=>{const s=window.__editorTest.healingQA.state();return !s.active&&s.hp===70});
 const afterHerb=await state();
 assert.equal(afterHerb.slots[1],null);assert(afterHerb.satiety<=afterBar.satiety&&afterHerb.satiety>=afterBar.satiety-2);
 await p.reload();await p.locator('#pineStartupCover').waitFor({state:'hidden'});
 await wait(()=>!!window.__editorTest?.healingQA);
 const cold=await state();
 assert.equal(cold.slots[2].count,1);assert.equal(cold.chestCan,2);
 assert.equal(cold.slots[9],null);assert(cold.satiety>=96);
 assert.deepEqual(errors,[]);
 console.log('PASS: actual food only changes satiety via bag and hotbar, herbs only HP, legacy cans survive');
}finally{await browser?.close();await new Promise(y=>server.close(y))}
