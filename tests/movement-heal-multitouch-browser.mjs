import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
const html=readFileSync(process.argv[2]||'world-editor.html','utf8');
function inject(s,a,b){assert.equal(s.split(a).length,2,a);return s.replace(a,b)}
let fixture=inject(html,'function poiHotbarUse(slot){','function poiHotbarUse(slot){window.__qaShortcutCalls?.push({slot,contact:poiAnalogContact?.id,casting:poiHealingCastActive(),hp:poiPlayerHP,now:performance.now()});');
fixture=inject(fixture,'function poiAnalogGeometryChange(){',`
window.__qaShortcutStatus=()=>({contact:poiAnalogContact?.id??null, weapon:poiEquippedWeapon(),armed:poiArmedWandIndex(),
 walking:!!poiFreePose?.walking,x:poiWalkViewX,z:poiWalkViewZ,level:poiWalkLevel,scene:facilitySite?.id,death:poiPlayerDying(),travel:poiOtherworldTravelSerial,dungeon:poiDungeonEntranceSerial,cast:poiHealingCast?{start:poiHealingCast.start,end:poiHealingCast.end,index:poiHealingCast.index}:null,yaw:poiCameraYaw,attack:poiWalkActionStarted,hp:poiPlayerHP,healing:poiHealingCastActive(),item:poiInventorySlots(poiHotbarRead())[3]?.count??0,food:poiInventorySlots(poiHotbarRead())[4]?.count??0,detail:poiItemDetailIsOpen()});
window.__qaShortcutSeedHealth=value=>{poiPlayerHP=value;poiCombatHud()};
window.__qaShortcutFrame=()=>render();
function poiAnalogGeometryChange(){`);
// Isolate unrelated wandering foes and random wildlife in this fixture only.
fixture=inject(fixture,' const p=poiWildPick(rng);',' const p=null;');
fixture=inject(fixture,'function poiWildRegionalFrame(now,rng){','function poiWildRegionalFrame(now,rng){if(window.__qaShortcutCalls)return;');
fixture=inject(fixture,'function poiMobFrame(now){','function poiMobFrame(now){if(window.__qaShortcutCalls)return;');
fixture=inject(fixture,' requestAnimationFrame(render);',' if(!window.__qaHealManual)requestAnimationFrame(render);');
if(process.env.MULTI_HEAL_LAYOUT_ONLY==='1'){for(const [,js] of fixture.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Function(js);console.log('Native two-thumb healing fixture compiles');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<!doctype html><title>Two-thumb shortcuts</title>':fixture)});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const base='http://127.0.0.1:'+server.address().port;
let browser;
try{
 browser=await chromium.launch({...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--disable-features=SyntheticPointerActions']});
 const ctx=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
 const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(12000);
 await p.clock.install({time:new Date('2026-04-01T10:00:00Z')});
 await p.goto(base+'/seed');
 await p.evaluate(()=>{
  const slots=Array(27).fill(null);
  slots[0]={type:'equipWoodSword',count:1};slots[1]={type:'equipIronSword',count:1};
  slots[2]={type:'fireWand',count:1,charges:5};
  slots[3]={type:'healingHerb',count:2};slots[4]={type:'cannedFood',count:1};
  localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weapon:'equipWoodSword',potions:2,slots}));
  localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":575000}');
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:24,z:91,y:0,facing:0},townLayout:5,townMapHeight:128,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:Math.PI,orbitPitch:.35,orbitDistance:5.5}}));
 });
 await p.goto(base+'/?resume=1&test=1');
 await p.waitForFunction(()=>window.__editorTest?.facility?.()?.active&&document.querySelector('#viewWrap').hasAttribute('data-analog-play'));
 await p.locator('#pineStartupCover').waitFor({state:'hidden'});
 await p.clock.pauseAt((await p.evaluate(()=>Date.now()))+1300);
 await p.evaluate(()=>{window.__qaHealManual=true});
 const cdp=await ctx.newCDPSession(p);
 const point=async (selector,id)=>{
  const a=await p.locator(selector).boundingBox();assert(a,selector);
  return {x:Math.round(a.x+a.width/2),y:Math.round(a.y+a.height/2),id,radiusX:4,radiusY:4,force:.7};
 };
 const start=await point('#poiAnalogPad',1),moving={...start,y:start.y-50};
 const slot=i=>'#poiHotbar [data-hotbar-slot="'+i+'"]';
 const herb=await point(slot(3),2),food=await point(slot(4),3);
 const touch=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
 const status=()=>p.evaluate(()=>window.__qaShortcutStatus());
 async function frame(ms=90){
  await p.clock.fastForward(ms);await p.evaluate(()=>window.__qaShortcutFrame());return status();
 }
 async function until(accept,frames=10,step=90){
  for(let i=0;i<frames;i++){const q=await frame(step);if(accept(q))return q;}
  throw Error('missing timed native state '+JSON.stringify(await status()));
 }

 await p.evaluate(()=>{
  window.__qaShortcutCalls=[];window.__qaShortcutTouch=[];
  for(const type of ['pointerdown','pointerup','pointercancel'])document.addEventListener(type,e=>{
   const slot=e.target.closest?.('[data-hotbar-slot]')?.dataset.hotbarSlot;
   if(slot!==undefined)window.__qaShortcutTouch.push({type,slot,trusted:e.isTrusted,primary:e.isPrimary,contact:window.__qaShortcutStatus().contact});
  },true);
 });
 try{
  await p.evaluate(()=>window.__qaShortcutSeedHealth(12));
  const initial=await status();assert.equal(initial.weapon,'equipWoodSword');assert.equal(initial.item,2);assert.equal(initial.food,1);
  await touch('touchStart',[start]);await touch('touchMove',[moving]);
  await until(s=>s.walking);
  const before=await status();
  await touch('touchStart',[herb]);
  assert.equal((await status()).healing,false,'physical right thumb does not use an item until release');
  await touch('touchEnd',[herb]);
  const active=await status();
  assert.equal(active.healing,true,'secondary herb tap begins timed cast while left thumb is physically down');
  assert.equal(active.hp,12);assert.equal(active.item,2);assert.equal(active.contact,before.contact);assert.equal(active.attack,initial.attack);
  await until(q=>q.healing&&q.contact===before.contact&&q.walking&&Math.hypot(q.x-active.x,q.z-active.z)>.04,5);
  // A second right hand tap during the cast is not queued or consumed.
  await touch('touchStart',[food]);await touch('touchEnd',[food]);
  await touch('touchEnd',[moving]);
  await until(s=>!s.healing&&s.hp===42,20);
  assert.equal((await status()).item,1);assert.equal((await status()).food,1);
  const left2={...start,id:7},moving2={...left2,y:left2.y+45};
  await touch('touchStart',[left2]);await touch('touchMove',[moving2]);await until(s=>s.walking);
  const right2={...food,id:8};
  await touch('touchStart',[right2]);await touch('touchEnd',[right2]);
  const meal=await status();assert(meal.healing&&meal.contact!==null);assert.equal(meal.hp,42);assert.equal(meal.food,1);
  await touch('touchEnd',[moving2]);await until(s=>!s.healing&&s.hp===97,20);
  assert.equal((await status()).food,0);
  await p.evaluate(()=>window.__qaShortcutSeedHealth(100));
  const left3={...start,id:10},moving3={...left3,y:left3.y-50};
  await touch('touchStart',[left3]);await touch('touchMove',[moving3]);await until(s=>s.walking);
  const right3={...herb,id:11};await touch('touchStart',[right3]);await touch('touchEnd',[right3]);
  const full=await status();assert(!full.healing);assert.equal(full.hp,100);assert.equal(full.item,1);assert(full.contact!==null);
  await touch('touchEnd',[moving3]);
  const observed=await p.evaluate(()=>({calls:window.__qaShortcutCalls,touches:window.__qaShortcutTouch}));
  assert.deepEqual(observed.calls.map(q=>q.slot),[3,4,4,3],'one use attempt per physical secondary tap (no compatibility click duplication)');
  assert(observed.calls.every(q=>q.contact!==undefined));
  assert(observed.calls[1].casting,'second tap really arrived before first cast finished');
  assert(observed.touches.some(e=>e.type==='pointerup'&&e.slot==='3'&&e.trusted&&!e.primary&&e.contact===before.contact),'real secondary pointerup while left captured');
  assert.deepEqual(errors,[]);
  console.log('PASS true two-contact herb and food healing, retained movement capture, timed spend, full-HP safety');
 }catch(e){
  console.error('Terminal two-contact state',await status().catch(()=>null),await p.evaluate(()=>({calls:window.__qaShortcutCalls,touches:window.__qaShortcutTouch})).catch(()=>null),errors);
  throw e;
 }finally{await cdp.detach();await ctx.close()}
}finally{await browser?.close();await new Promise(r=>server.close(r))}
