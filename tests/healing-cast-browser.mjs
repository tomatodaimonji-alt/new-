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
  const slots=Array(27).fill(null);slots[0]={type:'equipWoodSword',count:1};slots[1]={type:'healingHerb',count:2};slots[9]={type:'cannedFood',count:1};
  localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weapon:'equipWoodSword',potions:2,sword:true,gold:0,slots}));
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
 // Inventory modal calls the actual shared use route and closes on accepted cast.
 await p.locator('#poiBagToggle').tap();
 await p.locator('[data-bag-slot="0"]').tap();
 await p.locator('[data-item-detail-action="use"]').tap();
 await wait(()=>window.__editorTest.healingQA.state().active);
 assert.equal((await state()).slots[9].count,1);
 await p.locator('#poiBagPanel').waitFor({state:'hidden'});
 await wait(()=>{const s=window.__editorTest.healingQA.state();return !s.active&&s.hp===95});
 assert.equal((await state()).slots[9],null);
 await p.keyboard.press('2');await wait(()=>window.__editorTest.healingQA.state().active);
 await p.evaluate(()=>window.__workshopAudioForeground(false));
 assert((await state()).active);
 await p.waitForTimeout(1550);
 assert.equal((await state()).hp,95);assert.equal((await state()).slots[1].count,1);
 await p.evaluate(()=>window.__workshopAudioForeground(true));
 await wait(()=>{const s=window.__editorTest.healingQA.state();return !s.active&&s.hp===100});
 assert.equal((await state()).slots[1],null);
 assert.deepEqual(errors,[]);
 console.log('PASS actual hotbar and bag healing with overhead gauge, movement, blocked attack and native pause and exact resumption');
}finally{await browser?.close();await new Promise(y=>server.close(y))}
