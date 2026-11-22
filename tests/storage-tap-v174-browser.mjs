import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url.startsWith('/seed')?'<!doctype html><title>Isolated fixtures</title>':html);
});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const origin='http://127.0.0.1:'+server.address().port;
const map={format:'forest-world-v1',version:1,width:30,height:30,size:30,
 world:[{x:2,y:0,z:2,type:'stonewall',rot:1},{x:15,y:0,z:12,type:'bed',rot:2}],
 models:[],prefabs:[],terrainHeights:[],checks:[]};
const guild={...map,world:[{x:7,y:0,z:6,type:'stonewall',rot:0}]};
const fixtures={
 'forest-world-editor-v1':JSON.stringify(map,null,2),
 'world-workshop-pois-v1':JSON.stringify([
  {id:'poi-guild-primary-v87',name:'ギルド',map:guild},
  {id:'poi-adventurers-guild-v102',name:'冒険者ギルド',map:guild}],null,2),
 'pine-guild-screenshot-before-v86':JSON.stringify(guild,null,2),
 'pine-adventurers-guild-poi-before-v102':JSON.stringify({keep:'fixture'}),
 'world-workshop-guild-duplicates-v105':JSON.stringify({version:1,records:[
  {id:'poi-old-archive',name:'冒険者ギルド',map:guild}]}),
 'world-workshop-adventure-v1':'{"version":1,"x":23,"z":24,"hp":84,"monsters":[]}',
 'world-workshop-audio-v2':'{"master":81,"bgm":62,"se":88,"enabled":true}'
};
const resumeKey='world-workshop-resume-v1';
const state=page=>page.evaluate(()=>window.__editorTest?.facility?.()??null);
async function unchanged(page){
 const before=await page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),Object.keys(fixtures));
 assert.deepEqual(before,fixtures,'route must not write existing editor, Guild/archives, adventure, or audio settings');
}
const out=process.env.FACILITY_SCREENSHOTS;
if(out)await mkdir(out,{recursive:true});
const open='#enterGameWorld';
async function launch(browser,id='base',start={x:19,z:45},{camera=false,yaw=.24,orbitYaw=0,pitch=.24,townLayout=5,facing=2,kit=null,clockStart=null,fixture='',dist=5.5,level=0,width=390}={}){
 const ctx=await browser.newContext({viewport:{width,height:740},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
 await page.goto(origin+'/seed');
 await page.evaluate(({fixtures,resumeKey,id,start,camera,yaw,orbitYaw,pitch,townLayout,facing,kit,clockStart,dist,level})=>{
  for(const [k,v] of Object.entries(fixtures))localStorage.setItem(k,v);
  if(clockStart!==null)localStorage.setItem('world-workshop-town-clock-v1',JSON.stringify({version:1,gameMs:clockStart*500}));
  if(kit)localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify(kit));
  if(start)localStorage.setItem(resumeKey,JSON.stringify({version:1,route:'facility',id,play:true,position:{...start,y:level,facing},townLayout,
   view:{yaw,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:camera,orbitYaw,orbitPitch:pitch,orbitDistance:dist}}));
 },{fixtures,resumeKey,id,start,camera,yaw,orbitYaw,pitch,townLayout,facing,kit,clockStart,dist,level});
 await page.goto(origin+'/'+fixture+(start?'?resume=1&test=1':'?facility='+id+'&test=1'));
 if(!start)await page.locator(open).tap();
 await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
 assert.equal((await state(page)).id,id);
 return {ctx,page,errors};
}
const bag=i=>'#poiBagGrid [data-bag-slot="'+i+'"]';
const chest=i=>'#poiChestGrid [data-chest-slot="'+i+'"]';
const detail='#poiItemDetail';
const kitKey='world-workshop-hotbar-v1';
const inv=async page=>(await state(page)).inventory;
const read=page=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'null'),kitKey);
const herb=count=>({type:'healingHerb',count});
const sword={type:'equipWoodSword',count:1};
const can={type:'cannedFood',count:1};
function kit({bagHerbs=0,barHerbs=0,withChest=false}={}){
 const slots=Array(27).fill(null);slots[0]=sword;
 slots[1]=barHerbs?herb(barHerbs):null;slots[9]=bagHerbs?herb(bagHerbs):null;
 const base={version:1,weapon:null,potions:bagHerbs+barHerbs,gold:12,slots};
 if(withChest){
  const chestSlots=Array(18).fill(null);chestSlots[0]=herb(2);chestSlots[1]=can;
  base.kitchenChest={version:1,slots:chestSlots};
 }
 return base;
}
async function doubleTouch(ctx,page,sel){
 await page.locator('#poiBagPanel').waitFor({state:'visible'});
 assert.equal(await page.locator(detail+'[open]').count(),0,'detail no longer owns input');
 const box=await page.locator(sel).boundingBox();assert.ok(box,'rendered source at '+sel);
 const point={x:Math.round(box.x+box.width/2),y:Math.round(box.y+box.height/2)};
 await page.evaluate(({sel,point})=>{
  const source=document.querySelector(sel),hit=document.elementFromPoint(point.x,point.y);
  if(!source?.contains(hit))throw new Error('Source not hittable at '+JSON.stringify({sel,hit:hit?.outerHTML?.slice(0,160),point}));
  window.__storageTapTrace=[];
  window.__storageTapStop?.();
  const types=['pointerdown','pointerup','pointercancel','click'];
  const log=e=>{
   const b=e.target.closest?.('button');
   window.__storageTapTrace.push({type:e.type,at:performance.now(),pointer:e.pointerType,detail:e.detail,
    trusted:e.isTrusted,source:b===source,bag:b?.dataset.bagSlot,chest:b?.dataset.chestSlot,
    open:!!document.querySelector('#poiItemDetail')?.open,bagHidden:document.querySelector('#poiBagPanel')?.hidden});
  };
  types.forEach(type=>document.addEventListener(type,log,true));
  window.__storageTapStop=()=>types.forEach(type=>document.removeEventListener(type,log,true));
 },{sel,point});
 const c=await ctx.newCDPSession(page);
 // Queue the two native taps immediately; sequential RPC round trips can
 // otherwise exceed the user's window on slow software-rendered CI.
 const dispatch=(type,touchPoints)=>c.send('Input.dispatchTouchEvent',{type,touchPoints});
 try{
  await Promise.all([
   dispatch('touchStart',[{...point,id:1}]),dispatch('touchEnd',[]),
   dispatch('touchStart',[{...point,id:2}]),dispatch('touchEnd',[])
  ]);
 }finally{await c.detach()}
 const result=await page.evaluate(()=>({
  trace:window.__storageTapTrace,now:performance.now(),toast:document.querySelector('#toast')?.textContent
 }));
 console.log('touch '+sel+' '+JSON.stringify(result));
 const releases=result.trace.filter(e=>e.type==='pointerup'&&e.source);
 assert.equal(releases.length,2,'actual source receives two trusted touch releases: '+JSON.stringify(result));
 assert(releases.every(e=>e.trusted&&e.pointer==='touch'),'native pointer path, not keyboard');
 assert(releases[1].at-releases[0].at<325,'taps delivered within real gate time');
 return result;
}
async function singleWait(page,sel){
 // Observe a real touch release, then sample the popup at 170ms in the page's own
 // event clock. Host RPC/render delays cannot silently extend the sample.
 await page.evaluate(sel=>{
  document.querySelector(sel).addEventListener('pointerup',()=>{
   window.__detailAt170=new Promise(resolve=>setTimeout(()=>resolve(!!document.querySelector('#poiItemDetail').open),170));
  },{once:true,capture:true});
 },sel);
 await page.locator(sel).tap();
 assert.equal(await page.evaluate(()=>window.__detailAt170),false,'single tap does not open an eager item popup');
 await page.locator(detail+'[open]').waitFor({state:'visible'});
}
async function bagTouch(browser){
 const initial=kit({bagHerbs:2});
 const {ctx,page,errors}=await launch(browser,'base',{x:56,z:39},{width:320,kit:initial});
 try{
  const original=await page.evaluate(()=>window.__editorTest.data()),hp=(await state(page)).combat.playerHP;
  await page.locator('#poiBagToggle').tap();
  await page.locator('#poiBagPanel').waitFor({state:'visible'});
  await singleWait(page,bag(0));
  assert.deepEqual(await read(page),initial,'reading detail does not mutate the kit');
  assert.match(await page.locator(detail).innerText(),/薬草/);
  await page.keyboard.press('Escape');await page.locator(detail+'[open]').waitFor({state:'hidden'});
  assert.ok(await page.locator('#poiBagPanel').isVisible(),'Escape closes item detail alone and restores bag');
  await doubleTouch(ctx,page,bag(0));
  await page.waitForFunction(()=>window.__editorTest.facility().inventory.hotbar[1]?.type==='healingHerb');
  const s=await inv(page);
  assert.deepEqual(s.hotbar[1],herb(2));assert.equal(s.bag[0],null);
  assert.equal(s.potions,2);assert.equal((await read(page)).gold,12);
  assert.equal((await state(page)).combat.playerHP,hp,'double touch moves to the shortcut without using the herb');
  await page.waitForTimeout(340);
  assert.equal(await page.locator(detail+'[open]').count(),0,'double cancels pending detail');
  assert.deepEqual(await page.evaluate(()=>window.__editorTest.data()),original);
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
const trousers={type:'starterTrousers',count:1};
function equipKit(withChest=false){
 const base=kit({withChest});base.slots[0]=null;base.slots[9]=trousers;base.slots[10]=sword;
 base.worn={head:'starterCap',torso:'starterTunic',legs:null,feet:'starterBoots'};
 return base;
}
async function equipTouch(browser){
 const initial=equipKit();
 const {ctx,page,errors}=await launch(browser,'base',{x:56,z:39},{width:320,kit:initial});
 try{
  const original=await page.evaluate(()=>window.__editorTest.data());
  await page.locator('#poiBagToggle').tap();
  await singleWait(page,bag(0));
  assert.match(await page.locator(detail).innerText(),/ズボン/);
  assert.deepEqual(await read(page),initial);
  await page.keyboard.press('Escape');
  await page.locator(detail+'[open]').waitFor({state:'hidden'});
  await doubleTouch(ctx,page,bag(0));
  await page.waitForFunction(()=>window.__editorTest.facility().inventory.worn.legs?.type==='starterTrousers');
  let inventory=await inv(page);
  assert.equal(inventory.bag[0],null,'armor moved from its exact source index without duplication');
  assert.equal((await read(page)).worn.legs,trousers.type);
  assert.match(await page.locator('[data-gear-slot=legs]').getAttribute('aria-label'),/ズボン/);
  await doubleTouch(ctx,page,bag(1));
  await page.waitForFunction(()=>window.__editorTest.facility().inventory.weapon==='equipWoodSword');
  inventory=await inv(page);
  assert.equal(inventory.bag[1],null);
  assert.deepEqual(inventory.hotbar[0],sword,'manual bag equip behavior puts weapon in the first free shortcut');
  assert.equal(inventory.hotbar.filter(c=>c?.type==='equipWoodSword').length,1);
  await page.waitForTimeout(340);
  assert.equal(await page.locator(detail+'[open]').count(),0,'equipment double touch suppressed the delayed detail');
  assert.equal((await read(page)).gold,12);
  assert.deepEqual(await page.evaluate(()=>window.__editorTest.data()),original);
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
async function chestEquipPriority(browser){
 const initial=equipKit(true);
 const {ctx,page,errors}=await launch(browser,'base',{x:28,z:32},{width:390,level:-1,facing:3,kit:initial});
 try{
  await page.locator('#poiWalkAction').tap();
  await page.locator('#poiChestPanel').waitFor({state:'visible'});
  await doubleTouch(ctx,page,bag(0));
  await page.waitForFunction(()=>window.__editorTest.facility().inventory.kitchenChest.slots[2]?.type==='starterTrousers');
  let inventory=await inv(page);
  assert.equal(inventory.worn.legs,null,'open chest retains transfer priority over dressing');
  assert.equal(inventory.bag[0],null);
  await doubleTouch(ctx,page,bag(1));
  await page.waitForFunction(()=>window.__editorTest.facility().inventory.kitchenChest.slots[3]?.type==='equipWoodSword');
  inventory=await inv(page);
  assert.equal(inventory.weapon,null,'open chest retains weapon transfer rather than equipping');
  assert.equal(inventory.bag[1],null);
  await doubleTouch(ctx,page,chest(2));
  await page.waitForFunction(()=>window.__editorTest.facility().inventory.bag[0]?.type==='starterTrousers');
  inventory=await inv(page);
  assert.deepEqual(inventory.bag[0],trousers);
  assert.equal(inventory.kitchenChest.slots[2],null);
  assert.equal((await read(page)).gold,12);
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
async function chestTouch(browser){
 const initial=kit({barHerbs:3,withChest:true});
 const {ctx,page,errors}=await launch(browser,'base',{x:28,z:32},{width:390,level:-1,facing:3,kit:initial});
 try{
  const original=await page.evaluate(()=>window.__editorTest.data()),hp=(await state(page)).combat.playerHP;
  await page.locator('#poiWalkAction').tap();await page.locator('#poiChestPanel').waitFor({state:'visible'});
  await singleWait(page,chest(1));
  assert.deepEqual(await read(page),initial,'single chest detail is also read-only');
  await page.keyboard.press('Escape');await page.locator(detail+'[open]').waitFor({state:'hidden'});
  assert.ok(await page.locator('#poiBagPanel').isVisible(),'Escape closes item detail alone and restores bag');
  await doubleTouch(ctx,page,chest(1));
  await page.waitForFunction(()=>window.__editorTest.facility().inventory.bag[0]?.type==='cannedFood');
  let s=await inv(page);
  assert.deepEqual(s.bag[0],can);assert.equal(s.kitchenChest.slots[1],null);
  await doubleTouch(ctx,page,chest(0));
  await page.waitForFunction(()=>window.__editorTest.facility().inventory.hotbar[1]?.count===5);
  s=await inv(page);
  assert.deepEqual(s.hotbar[1],herb(5));assert.equal(s.kitchenChest.slots[0],null);
  assert.deepEqual(s.bag[0],can,'non-herb retains bag transfer');
  assert.equal(s.potions,5);assert.equal((await read(page)).gold,12);
  assert.equal((await state(page)).combat.playerHP,hp);
  await page.waitForTimeout(340);
  assert.equal(await page.locator(detail+'[open]').count(),0);
  assert.deepEqual(await page.evaluate(()=>window.__editorTest.data()),original);
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await equipTouch(browser);
 await bagTouch(browser);
 await chestTouch(browser);
 await chestEquipPriority(browser);
 console.log('PASS mobile touch: armor/weapon quick equip when closed; chest transfer priority, single details, herb routing and save protection');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
