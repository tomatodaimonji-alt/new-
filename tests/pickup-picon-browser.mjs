import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
let h=readFileSync(process.argv[2]??'world-editor.html','utf8');
const put=(a,b)=>{assert.equal(h.split(a).length,2,a);h=h.replace(a,b)};
const key="if(facilityParams.get('test')==='1')window.__editorTest={";
put(key,`
 window.__pickupPicon={
  ground:(type,x,z,fromX,fromZ,full=false)=>{
   if(!workshopResumeRestorePosition({x:fromX,z:fromZ,y:0,facing:2}))return false;
   poiMonsterStates.clear();poiDavidActive=null;poiCombatLockReset();
   let kit=poiHotbarRead(), slots=poiInventorySlots(kit).slice();
   if(full){
    for(let i=0;i<POI_HOTBAR_SIZE+POI_BAG_UNLOCKED;i++)if(!slots[i])slots[i]={type:'cannedFood',count:poiInventoryStack('cannedFood')};
    kit=poiInventoryEdited(kit,slots);
   }
   if(type==='cannedFood'||type==='healingHerb')kit={...kit,drops:[...(kit.drops||[]),{type,count:1,x,z,y:0}]};
   else {
    const reward=Object.values(POI_ORVAS_REWARDS).find(r=>r.type===type);
    if(!reward||reward.x!==x||reward.z!==z)return false;
    const {bit,...d}=reward;kit={...kit,armedDrops:[...(kit.armedDrops||[]),{...d,durability:poiEquipmentDurabilityMax(type)}]};
   }
   const written=poiEconomyWrite(kit);if(written)poiEconomyRefresh();return written;
  },
  state:()=>{
   const k=poiHotbarRead();
   return {at:[poiWalkX,poiWalkZ],events:window.__pickupSamples??[],held:k.weapon,
    items:poiInventorySlots(k).filter(Boolean).map(c=>c.type),
    drops:k.drops??[],armed:k.armedDrops??[],se:poiAudioLevels.se,
    live:(window.__pickupNodes??[]).filter(n=>poiAudioTransient.has(n)).length};
  }
 };`+key);
const dispatch=' poiAudioTransient.add(source);source.start(when);source.stop(when+(cap??(buffer.duration+.012)));';
put(dispatch,dispatch+`
 if(buffer===poiRecordedFoleyCache.get('itemPickup')){
  (window.__pickupSamples??=[]).push({n:buffer.length,rate:buffer.sampleRate,loop:source.loop,volume,when});
  (window.__pickupNodes??=[]).push(source);
 }`);
for(const [,js] of h.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(js);
if(process.env.PICON_PARSE_ONLY){console.log('Exact item pickup cue fixture parses');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const srv=createServer((q,r)=>{r.setHeader('Content-Type','text/html; charset=utf-8');r.end(q.url==='/seed'?'<title>Setup</title>':h)});
await new Promise(r=>srv.listen(0,'127.0.0.1',r));const root='http://127.0.0.1:'+srv.address().port;
let browser;
try{
 browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:.7});
 const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(16000);
 await p.goto(root+'/seed');await p.evaluate(()=>{
  localStorage.setItem('world-workshop-audio-v2','{"master":85,"bgm":0,"se":82,"enabled":true}');
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,position:{x:24,z:151,y:0,facing:2},
   townLayout:5,townMapHeight:182,templeDepth:1,view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 });
 await p.goto(root+'/?resume=1&test=1',{waitUntil:'domcontentloaded'});
 await p.locator('#pineStartupCover').waitFor({state:'hidden'});
 const q=()=>p.evaluate(()=>window.__pickupPicon.state());
 const go=async(k,x,z)=>{await p.keyboard.press(k);await p.waitForFunction(([x,z])=>{
  const q=window.__pickupPicon.state();return q.at[0]===x&&q.at[1]===z
 },[x,z]);};
 const ground=async(...args)=>assert(await p.evaluate(a=>window.__pickupPicon.ground(...a),args));
 const count=async n=>{await p.waitForFunction(n=>window.__pickupPicon.state().events.length>=n,n);assert.equal((await q()).events.length,n);};
 await ground('cannedFood',24,152,24,151);
 await go('ArrowDown',24,152);await count(1);assert((await q()).items.includes('cannedFood'));
 await ground('equipOrvasHead',24,157,24,156);
 await go('ArrowDown',24,157);await count(2);assert((await q()).items.includes('equipOrvasHead'));
 await ground('orvasSoul',24,159,24,158);
 await go('ArrowDown',24,159);await count(3);assert((await q()).items.includes('orvasSoul'));

 await p.locator('#poiBagToggle').tap();
 await p.locator('#poiHotbar [data-hotbar-slot="0"]').tap();
 const dialog=p.locator('#poiItemDetail');await dialog.waitFor({state:'visible'});
 await dialog.locator('[data-item-detail-action="back"]').tap();
 await dialog.waitFor({state:'hidden'});assert.equal((await q()).events.length,3);
 await p.locator('#poiHotbar [data-hotbar-slot="0"]').tap();
 await dialog.waitFor({state:'visible'});
 await dialog.locator('[data-item-detail-action="drop"]').tap();
 await dialog.waitFor({state:'hidden'});assert.equal((await q()).events.length,3);
 await p.locator('#poiBagClose').tap();
 const drop=await q(),sword=drop.drops.find(d=>d.type==='equipWoodSword');
 assert(sword);
 const dx=sword.x-drop.at[0],dz=sword.z-drop.at[1];assert.equal(Math.abs(dx)+Math.abs(dz),1);
 await go(dx===1?'ArrowRight':dx===-1?'ArrowLeft':dz===1?'ArrowDown':'ArrowUp',sword.x,sword.z);
 await count(4);assert((await q()).items.includes('equipWoodSword'));

 await p.evaluate(()=>{const el=document.getElementById('poiVolumeSe');el.value='0';el.dispatchEvent(new Event('input',{bubbles:true}));});
 assert.equal((await q()).se,0);
 await ground('healingHerb',24,154,24,153);
 await go('ArrowDown',24,154);await p.waitForTimeout(230);
 assert((await q()).items.includes('healingHerb'));assert.equal((await q()).events.length,4);
 await p.evaluate(()=>{const el=document.getElementById('poiVolumeSe');el.value='82';el.dispatchEvent(new Event('input',{bubbles:true}));});
 assert.equal((await q()).se,82);
 await ground('equipOrvasGreatsword',25,158,25,157,true);
 await go('ArrowDown',25,158);await p.waitForTimeout(230);
 assert((await q()).armed.some(d=>d.type==='equipOrvasGreatsword'),'real ground item remains if every slot full');
 let s=await q();assert.equal(s.events.length,4);assert.equal(s.live,0);
 assert(s.events.every(e=>e.n===3720&&e.rate===24000&&!e.loop&&e.volume===.60));assert.deepEqual(errors,[]);
 console.log('Actual item, Orvas gear and soul pickups; cancel, drop, muted successful and full failed paths; four clean one-shot buffers',JSON.stringify(s.events));
 await ctx.close();
}finally{await browser?.close();await new Promise(r=>srv.close(r))}
