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
const shortcut=i=>'#poiHotbar [data-hotbar-slot="'+i+'"]';
const dialogAction=id=>detail+' [data-item-detail-action="'+id+'"]';
const hp=async page=>(await state(page)).combat.playerHP;
const allHerbs=s=>[...s.hotbar,...s.bag].filter(c=>c?.type==='healingHerb').reduce((n,c)=>n+c.count,0);
async function bagOpen(page){
 await page.locator('#poiBagToggle').tap();
 await page.locator('#poiBagPanel').waitFor({state:'visible'});
}
async function bagClose(page){
 await page.locator('#poiBagClose').tap();
 await page.locator('#poiBagPanel').waitFor({state:'hidden'});
}
async function select(page,label){
 await page.locator(dialogAction(label)).tap();
}
async function dismiss(page){
 await select(page,'back');
 await page.locator(detail+'[open]').waitFor({state:'hidden'});
}
async function actualActions(page){
 return page.locator(detail+' [data-item-detail-action]:not([hidden])').evaluateAll(nodes=>nodes.map(e=>e.dataset.itemDetailAction));
}
async function equipInPanel(browser){
 const initial=kit({barHerbs:4});
 const {ctx,page,errors}=await launch(browser,'base',{x:56,z:39},{width:320,kit:initial,facing:2});
 try{
  const original=await page.evaluate(()=>window.__editorTest.data());
  await page.evaluate(()=>window.__editorTest.testWound(60));
  const injured=await hp(page);assert.equal(injured,40);
  await bagOpen(page);
  await singleWait(page,shortcut(1));
  assert.match(await page.locator(detail).innerText(),/薬草/);
  assert.equal(await hp(page),injured,'touching the shortcut alone never heals with inventory open');
  assert.deepEqual(await read(page),initial,'detail is read-only before choosing an action');
  let actions=await actualActions(page);
  for(const id of ['use','split','drop','back'])assert(actions.includes(id),id+' available for shortcut herb');
  await select(page,'split');
  let i=await inv(page);
  assert.equal(allHerbs(i),4,'splitting conserves the total');
  assert.equal(i.hotbar.filter(c=>c?.type==='healingHerb').length,2,'split stays within the shortcuts');
  assert.equal(await hp(page),injured);
  await select(page,'use');
  await page.locator(detail+'[open]').waitFor({state:'hidden'});
  assert.equal(await hp(page),70,'explicit Use heals and then closes the details');
  assert.equal(allHerbs(await inv(page)),3);
  await singleWait(page,shortcut(0));
  actions=await actualActions(page);assert(actions.includes('equip'));
  await select(page,'equip');
  await page.waitForFunction(()=>window.__editorTest.facility().inventory.weapon==='equipWoodSword');
  const equipped=await read(page);
  await page.locator(shortcut(8)).tap();
  await page.waitForTimeout(360);
  assert.equal(await page.locator(detail+'[open]').count(),0);
  assert.equal((await inv(page)).weapon,'equipWoodSword','empty shortcut never disarms while bag is open');
  assert.deepEqual(await read(page),equipped);
  const holder=(await inv(page)).hotbar.findIndex(c=>c?.type==='healingHerb');
  assert(holder>=0);
  const registered=(await inv(page)).hotbar[holder].count;
  await singleWait(page,shortcut(holder));
  await select(page,'drop');
  await page.locator(detail+'[open]').waitFor({state:'hidden'});
  await page.waitForFunction(()=>window.__editorTest.facility().inventory.drops.some(c=>c.type==='healingHerb'));
  i=await inv(page);
  const dropped=i.drops.find(c=>c.type==='healingHerb');
  const droppedCount=dropped.count??1; // a single ground drop omits count
  assert.equal(allHerbs(i)+droppedCount,3);
  assert(droppedCount>=1&&droppedCount<=registered);
  assert.equal((await read(page)).gold,12);
  const stored=await read(page);
  await bagClose(page);await page.reload();
  await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
  assert.deepEqual(await read(page),stored,'explicit use, split, drop and equipped selection persist');
  assert.deepEqual(await page.evaluate(()=>window.__editorTest.data()),original);
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close()}
}
async function closedDirect(browser){
 const initial=kit({barHerbs:2});
 const {ctx,page,errors}=await launch(browser,'base',{x:56,z:39},{width:390,kit:initial});
 try{
  assert.equal(await page.locator('#poiBagPanel').isVisible(),false);
  await page.evaluate(()=>window.__editorTest.testWound(50));
  await page.locator(shortcut(1)).tap();
  await page.waitForFunction(()=>window.__editorTest.facility().combat.playerHP===80);
  assert.deepEqual((await inv(page)).hotbar[1],herb(1));
  assert.equal(await page.locator(detail+'[open]').count(),0,'normal closed-bag shortcut immediately uses');
  await page.locator(shortcut(0)).tap();
  assert.equal((await inv(page)).weapon,'equipWoodSword');
  await page.locator(shortcut(8)).tap();
  assert.equal((await inv(page)).weapon,null,'empty shortcut keeps existing closed-bag unequip behavior');
  await bagOpen(page);
  await page.keyboard.press('2');
  await page.locator(detail+'[open]').waitFor({state:'visible'});
  assert.equal(await hp(page),80,'numeric shortcut inspects rather than using with inventory open');
  await dismiss(page);
  await doubleTouch(ctx,page,shortcut(1));
  await page.waitForFunction(()=>window.__editorTest.facility().inventory.bag[0]?.type==='healingHerb');
  assert.deepEqual((await inv(page)).bag[0],herb(1));
  assert.equal((await inv(page)).hotbar[1],null);
  assert.equal(await hp(page),80,'double touch stows the whole shortcut stack without healing');
  await page.waitForTimeout(340);
  assert.equal(await page.locator(detail+'[open]').count(),0,'double cancels pending detail');
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close()}
}
async function chestPanel(browser){
 const initial=kit({barHerbs:3,withChest:true});
 const {ctx,page,errors}=await launch(browser,'base',{x:28,z:32},{width:390,level:-1,facing:3,kit:initial});
 try{
  await page.locator('#poiWalkAction').tap();
  await page.locator('#poiChestPanel').waitFor({state:'visible'});
  await singleWait(page,shortcut(1));
  assert((await actualActions(page)).includes('transfer'),'open chest permits explicit shortcut transfer');
  assert.equal((await inv(page)).hotbar[1].count,3);
  await select(page,'transfer');
  await page.locator(detail+'[open]').waitFor({state:'hidden'});
  const i=await inv(page);
  assert.equal(i.hotbar[1],null);
  assert.equal(i.kitchenChest.slots.reduce((n,c)=>n+(c?.type==='healingHerb'?c.count:0),0),5);
  assert.deepEqual(i.kitchenChest.slots[1],can);
  assert.equal((await read(page)).gold,12);
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close()}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await equipInPanel(browser);await closedDirect(browser);await chestPanel(browser);
 console.log('PASS native mobile shortcut details, explicit use/split/equip/drop, empty tap and closed direct behavior, chest transfer and save protections');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
