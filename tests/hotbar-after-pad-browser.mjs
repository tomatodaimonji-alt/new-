// Usage: node hotbar-after-pad-browser.mjs candidate.html [exact-v334-baseline.html]
// Hosted touch emulation, not a physical Android/WebView reproduction.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {Script} from 'node:vm';
const a="if(facilityParams.get('test')==='1')window.__editorTest={";
function instrument(file){
 let s=readFileSync(file,'utf8');
 function inject(a,b){assert.equal(s.split(a).length,2,a);s=s.replace(a,b)}
 inject(a,a+`hotbarAfterPadQA:()=>({weapon:poiHotbarRead().weapon,types:[0,1,2,3].map(i=>poiInventorySlot(poiHotbarRead(),i)),iron:poiInventoryCell(poiHotbarRead(),1)?.durability??null,held:poiAnalogContact?.id??null, calls:window.__qaHotUses??[],active:poiWalkActive}),`);
 inject('function poiHotbarUse(slot){','function poiHotbarUse(slot){(window.__qaHotUses??=[]).push(slot);');
 for(const [,s0] of s.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(s0);
 return s;
}
const entries=process.argv.slice(2);
assert(entries.length===1||entries.length===2);
const pages=entries.map(instrument);
if(process.env.HOTBAR_PARSE_ONLY==='1')process.exit(0);
const {chromium}=createRequire(import.meta.url)('playwright');
const server=createServer((q,r)=>{
 r.setHeader('Content-Type','text/html; charset=utf-8');
 r.end(q.url==='/seed'?'<title>seed</title>':pages[q.url.startsWith('/baseline')?1:0]);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port;
let browser;
try{
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 for(let i=0;i<entries.length;i++){
  const baseline=i===1,c=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
  const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(base+'/seed');
  await p.evaluate(()=>{
   const slots=Array(27).fill(null);
   slots[0]={type:'equipWoodSword',count:1,durability:70};
   slots[1]={type:'equipIronSword',count:1,durability:60};
   slots[3]={type:'healingHerb',count:1};
   localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weaponDurabilityVersion:2,weapon:'equipWoodSword',potions:1,slots}));
   localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,position:{x:49,z:119,y:0,facing:2},
    townLayout:5,townMapHeight:182,templeDepth:1,view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:0,orbitPitch:.13,orbitDistance:6}}));
  });
  await p.goto(base+(baseline?'/baseline':'/')+'?resume=1&test=1');
  await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:45000});
  await p.waitForFunction(()=>window.__editorTest?.hotbarAfterPadQA?.().active,null,{timeout:12000});
  const read=()=>p.evaluate(()=>window.__editorTest.hotbarAfterPadQA());
  const seed=await read();
  assert.equal(seed.weapon,'equipWoodSword');
  assert.deepEqual(seed.types,['equipWoodSword','equipIronSword',null,'healingHerb'],'resume retains actual fixture slots');
  assert.equal(seed.iron,60);
  // Only QA can stop compatibility clicks at Window capture; real PointerEvents
  // below still reach actual game handlers, and no game weapon setter is called.
  await p.evaluate(()=>{
   window.qaOmitHotbarClicks=true;window.qaOmitted=0;window.qaTouch={};
   for(const event of ['pointerdown','pointerup','pointercancel'])window.addEventListener(event,e=>{
    const slot=e.target.closest?.('#poiHotbar [data-hotbar-slot]');
    if(slot&&e.pointerType==='touch'&&e.isTrusted&&event==='pointerup')window.qaTouch[slot.dataset.hotbarSlot]={pointerId:e.pointerId,x:e.clientX,y:e.clientY};
   },true);
   window.addEventListener('click',e=>{
    if(window.qaOmitHotbarClicks&&e.target.closest?.('#poiHotbar [data-hotbar-slot]')){
     window.qaOmitted++;e.stopImmediatePropagation();e.preventDefault();
    }
   },true);
  });
  const center=async loc=>{const r=await loc.boundingBox();assert(r);return {x:r.x+r.width*.5,y:r.y+r.height*.5}};
  const cdp=await c.newCDPSession(p),pad=await center(p.locator('#poiAnalogPad'));
  const slot=k=>p.locator('#poiHotbar [data-hotbar-slot="'+k+'"]');
  const touch=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
  const start={...pad,id:7};
  for(const release of ['touchEnd','touchCancel']){
   await touch('touchStart',[start]);await touch('touchMove',[{...start,y:start.y-33}]);
   assert.notEqual((await read()).held,null);
   await touch(release,[]);assert.equal((await read()).held,null);
   const k=release==='touchEnd'?1:2;
   await slot(k).tap();
   const q=await read();
   assert.equal(q.weapon,baseline?'equipWoodSword':k===1?'equipIronSword':null,JSON.stringify(q));
  }
  assert.deepEqual((await read()).calls,baseline?[]:[1,2]);
  if(!baseline){
   // Delayed compatibility event on the just-finished gesture must not re-use
   // the slot. Then a normal ordinary-item trusted tap still uses legacy click.
   await p.evaluate(()=>{
    window.qaOmitHotbarClicks=false;
    const q=window.qaTouch[2],el=document.querySelector('#poiHotbar [data-hotbar-slot="2"]');
    el.dispatchEvent(new PointerEvent('click',{bubbles:true,cancelable:true,pointerType:'touch',pointerId:q.pointerId,clientX:q.x,clientY:q.y}));
   });
   assert.deepEqual((await read()).calls,[1,2]);
   const right={...(await center(slot(0))),id:9};
   await touch('touchStart',[start]);const moved={...start,y:start.y-33};await touch('touchMove',[moved]);
   await touch('touchStart',[moved,right]);
   try{await touch('touchEnd',[right]);}catch{await touch('touchMove',[moved]);}
   const seed=await read();
  assert.equal(seed.weapon,'equipWoodSword');
  assert.deepEqual(seed.types,['equipWoodSword','equipIronSword',null,'healingHerb'],'resume retains actual fixture slots');
  assert.equal(seed.iron,60);assert.notEqual((await read()).held,null);
   await touch('touchEnd',[]);
   await slot(3).tap();assert.deepEqual((await read()).calls,[1,2,0,3]);
  }
  assert.deepEqual(errors,[]);
  console.log(baseline?'Expected baseline failure reproduced (both physical taps lost without click)':'Candidate passed release/cancel, bare hand, delayed click, two-thumb and legacy herb');
  await c.close();
 }
}finally{await browser?.close();await new Promise(r=>server.close(r))}
