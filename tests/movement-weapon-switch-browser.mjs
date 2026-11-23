import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
const html=readFileSync(process.argv[2]||'world-editor.html','utf8');
function inject(s,a,b){assert.equal(s.split(a).length,2,a);return s.replace(a,b)}
let fixture=inject(html,'function poiHotbarUse(slot){','function poiHotbarUse(slot){window.__qaShortcutCalls?.push({slot,contact:poiAnalogContact?.id});');
fixture=inject(fixture,'function poiAnalogGeometryChange(){',`
window.__qaShortcutStatus=()=>({contact:poiAnalogContact?.id??null, weapon:poiEquippedWeapon(),armed:poiArmedWandIndex(),
 walking:!!poiFreePose?.walking,x:poiWalkViewX,z:poiWalkViewZ,yaw:poiCameraYaw,attack:poiWalkActionStarted,detail:poiItemDetailIsOpen()});
function poiAnalogGeometryChange(){`);
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
 await p.goto(base+'/seed');
 await p.evaluate(()=>{
  const slots=Array(27).fill(null);
  slots[0]={type:'equipWoodSword',count:1};slots[1]={type:'equipIronSword',count:1};
  slots[2]={type:'fireWand',count:1,charges:5};
  localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weapon:'equipWoodSword',potions:0,slots}));
  localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":575000}');
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:108,z:61,y:0,facing:0},townLayout:5,townMapHeight:128,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:Math.PI,orbitPitch:.35,orbitDistance:5.5}}));
 });
 await p.goto(base+'/?resume=1&test=1');
 await p.waitForFunction(()=>window.__editorTest?.facility()?.active&&document.querySelector('#viewWrap').hasAttribute('data-analog-play'));
 await p.locator('#pineStartupCover').waitFor({state:'hidden'});
 const cdp=await ctx.newCDPSession(p);
 const point=async (selector,id)=>{
  const a=await p.locator(selector).boundingBox();assert(a,selector);
  return {x:Math.round(a.x+a.width/2),y:Math.round(a.y+a.height/2),id,radiusX:4,radiusY:4,force:.7};
 };
 const start=await point('#poiAnalogPad',1),moving={...start,y:start.y-50};
 const slot=i=>'#poiHotbar [data-hotbar-slot="'+i+'"]';
 const iron=await point(slot(1),2),wand=await point(slot(2),3),wood=await point(slot(0),4);
 const touch=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
 const status=()=>p.evaluate(()=>window.__qaShortcutStatus());
 await p.evaluate(()=>{
  window.__qaShortcutCalls=[];window.__qaShortcutTouch=[];
  for(const type of ['pointerdown','pointerup','pointercancel'])document.addEventListener(type,e=>{
   const slot=e.target.closest?.('[data-hotbar-slot]')?.dataset.hotbarSlot;
   if(slot!==undefined)window.__qaShortcutTouch.push({type,slot,primary:e.isPrimary,contact:window.__qaShortcutStatus().contact});
  },true);
 });
 try{
  const initial=await status();
  assert.equal(initial.weapon,'equipWoodSword');
  await touch('touchStart',[start]);await touch('touchMove',[moving]);
  await p.waitForFunction(()=>window.__qaShortcutStatus().walking);
  const before=await status();
  await touch('touchStart',[iron]);
  assert.equal((await status()).weapon,'equipWoodSword','selection commits on release, not down');
  // Chromium's default CDP path accepts a sole touchEnd point, and retires
  // only that ID; touchEnd [] would release both thumbs and miss this bug.
  await touch('touchEnd',[iron]);
  const switched=await status();
  assert.equal(switched.weapon,'equipIronSword','second pointer physically selects iron without releasing the movement thumb');
  assert.equal(switched.contact,before.contact,'left movement contact is still the same pointer');
  await p.waitForFunction(({x,z})=>{const s=window.__qaShortcutStatus();return s.walking&&Math.hypot(s.x-x,s.z-z)>.04},switched);
  await touch('touchStart',[wand]);await touch('touchEnd',[wand]);
  assert.equal((await status()).armed,2,'tap wand while the same movement touch remains down');
  await touch('touchStart',[wood]);
  await touch('touchMove',[{...wood,x:wood.x+33}]);await touch('touchMove',[wood]);await touch('touchEnd',[wood]);
  const after=await status();
  assert.equal(after.armed,2,'drag away and back does not switch away from the wand');
  assert.equal(after.weapon,'equipIronSword');
  assert.equal(after.contact,before.contact);assert.equal(after.attack,initial.attack);
  assert.equal(after.yaw,initial.yaw);assert.equal(after.detail,false);
  const observed=await p.evaluate(()=>({calls:window.__qaShortcutCalls,touches:window.__qaShortcutTouch}));
  assert.deepEqual(observed.calls,[{slot:1,contact:before.contact},{slot:2,contact:before.contact}],'one use per physical right-hand tap');
  assert(observed.touches.some(e=>e.type==='pointerup'&&e.slot==='1'&&!e.primary&&e.contact===before.contact),'real secondary right-up delivered while left was captured');
  await touch('touchEnd',[moving]);
  await p.waitForFunction(()=>window.__qaShortcutStatus().contact===null);
  await p.locator(slot(0)).tap();
  assert.equal((await status()).weapon,'equipWoodSword','normal single primary tap still works');
  assert.deepEqual(errors,[]);
  console.log('PASS continued two-thumb movement with real secondary shortcut release, wand/iron selection, no accidental drag/camera/attack, and normal taps');
 }finally{await cdp.detach();await ctx.close()}
}finally{await browser?.close();await new Promise(r=>server.close(r))}
