import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';

const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.setHeader('Cache-Control','no-store');res.end(req.url==='/seed'?'<!doctype html><title>Isolated inventory sizing fixture</title>':html);
});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const origin='http://127.0.0.1:'+server.address().port;
const point={x:26,z:41,y:0,facing:2};
const kitKey='world-workshop-hotbar-v1',kit='{"version":1,"weapon":"equipWoodSword","potions":3,"gold":12,"claimedCaches":["glade"]}';
async function open(browser,width,height,spawn=point,overflow=false){
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.setDefaultTimeout(15000);await page.goto(origin+'/seed');
 await page.evaluate(({point,kitKey,kit,overflow})=>{
  if(!overflow)localStorage.setItem(kitKey,kit);
  else{
   const slots=Array(27).fill(null);
   slots[0]={type:'equipWoodSword',count:1};
   slots[1]={type:'healingHerb',count:3}; // Must match legacy kit.potions, or hydration rejects the whole slot array.
   for(let i=18;i<27;i++)slots[i]={type:'cannedFood',count:1};
   localStorage.setItem(kitKey,JSON.stringify({...JSON.parse(kit),slots}));
  }
  localStorage.setItem('world-workshop-town-clock-v1',JSON.stringify({version:1,gameMs:11*60*500}));
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:point,townLayout:5,townMapHeight:128,view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:point.y,
    hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 },{point:spawn,kitKey,kit,overflow});
 await page.goto(origin+'/?resume=1&test=1');await page.waitForFunction(()=>window.__editorTest?.facility?.()?.active);
 return {context,page,errors};
}
async function box(locator,requireTouch=true){
 const r=await locator.evaluate(el=>{
  const r=el.getBoundingClientRect(),target=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
  return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom,vw:innerWidth,vh:innerHeight,
   hit:el.contains(target),cover:target?.id||target?.className};
 });
 assert(r.w>1&&r.h>1&&r.x>=-1&&r.y>=-1&&r.right<=r.vw+1&&r.bottom<=r.vh+1,locator+' clipped '+JSON.stringify(r));
 if(requireTouch)assert(r.hit,locator+' obstructed '+JSON.stringify(r));
 return r;
}
const match=(a,b,label)=>assert(Math.abs(a.x-b.x)<=.6&&Math.abs(a.right-b.right)<=.6,label+' '+JSON.stringify({a,b}));
const almost=(a,b,label)=>{for(const k of ['x','y','w','h'])assert(Math.abs(a[k]-b[k])<=.6,label+': '+k+' '+JSON.stringify({a,b}))};
async function baseline(page,locators){
 // Calculate the exact before-change geometry from the same stage and insets.
 return page.evaluate(selectors=>{
  const style=[...document.querySelectorAll('style')].find(el=>el.textContent.includes('/* BEGIN ALIGNED LANDSCAPE BAG */'));
  if(!style)throw Error('aligned CSS is absent');
  const css=style.textContent;
  style.textContent=css.replace(/\/\* BEGIN ALIGNED LANDSCAPE BAG \*\/[\s\S]*?\/\* END ALIGNED LANDSCAPE BAG \*\//,'');
  const boxes=selectors.map(sel=>{const {x,y,width:w,height:h,right,bottom}=document.querySelector(sel).getBoundingClientRect();return {x,y,w,h,right,bottom}});
  style.textContent=css;return boxes;
 },locators);
}
const metrics=[[568,320],[844,390],[1120,500],[528,320]];
const panel='#poiBagPanel',slot='#poiBagSlots [data-bag-slot="0"]',avatar='#poiAvatarPreview';
let browser;
try{
 browser=await chromium.launch({headless:true,
  ...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 for(const [width,height] of metrics){
  const {context,page,errors}=await open(browser,width,height,point,width===528);
  try{
   const stage=page.locator('#viewWrap');
   await page.locator('#viewWrap[data-analog-play]').waitFor({state:'attached'});
   if(width===528)await stage.evaluate(el=>{
    el.style.setProperty('--poi-land-left','36px');el.style.setProperty('--poi-land-right','13px');
   });
   const bar=await box(page.locator('#poiHotbar'),false);
   await page.locator('#poiBagToggle').tap();await page.locator(panel).waitFor({state:'visible'});
   const [bag,cell,doll,close,gold]=await Promise.all([
    box(page.locator(panel),false),box(page.locator(slot)),box(page.locator(avatar)),
    box(page.locator('#poiBagClose')),box(page.locator('#poiBagWallet'))
   ]);
   assert.equal(await page.locator('#poiBagGoldDrop').count(),0,'coin placement comes from the wallet, not a header button');
   match(bag,bar,'bag left/right follow actual hotbar at '+width);
   assert(bag.bottom+3<=bar.y,'stable gap above the top shortcut row');
   assert(Math.abs(cell.w-cell.h)<.6,'bag cells remain square');
   for(const control of [cell,doll,close,gold])assert(control.x>=bag.x&&control.right<=bag.right+.4);
   if(width>=844){
    const [oldCell,oldDoll,oldBag]=await baseline(page,[slot,avatar,panel]);
    assert(Math.abs(oldCell.w-cell.w)<.6,'standard inventory cell size stays unchanged');
    assert(doll.w>60,'right character preview remains usable');
    assert(Math.abs((doll.w-oldDoll.w)-(bag.w-oldBag.w))<.6,'only the flexible character area absorbs the width difference');
   }
   if(width===568)assert(cell.w>=32,'ordinary compact bag keeps touch-sized item buttons');
   if(width===528){
    const savedBefore=await page.evaluate(k=>localStorage.getItem(k),kitKey);
    const expected=Array.from({length:9},(_,i)=>i+9);
    const savedOverflow=await page.evaluate(()=>window.__editorTest.facility().inventory.bagLegacy);
    assert.deepEqual(savedOverflow,expected,'real kit decoder retained all nine overflow item IDs');
    const legacy=page.locator('#poiBagSlots [data-bag-legacy]:visible');
    assert.deepEqual(await legacy.evaluateAll(buttons=>buttons.map(button=>Number(button.dataset.bagSlot))),expected,
     'every pre-existing overflow slot remains accessible');
    for(const cell of await legacy.all()){
     const hit=await box(cell);
     assert(hit.x>=bag.x&&hit.right<=bag.right&&hit.bottom<=bag.bottom);
    }
    await legacy.last().tap();await page.locator('#poiItemDetail').waitFor({state:'visible'});
    await page.locator('#poiItemDetail [data-item-detail-action="back"]').tap();
    assert.equal(await page.evaluate(k=>localStorage.getItem(k),kitKey),savedBefore,'inspecting overflow does not rewrite its save');
   }
   if(width===568){
    await page.locator('#poiBagClose').tap();
    await page.waitForFunction(()=>document.querySelector('#poiWalkAction')?.getAttribute('aria-label')==='住人と話す');
    await page.locator('#poiWalkAction').tap();
    await page.locator('#poiNpcMenu [data-npc-action="status"]').tap();
    const npc=page.locator('#poiNpcInventory');
    await npc.waitFor({state:'visible'});
    almost(await box(npc,false),(await baseline(page,['#poiNpcInventory']))[0],'NPC panel remains unchanged');
    await npc.locator('#poiNpcInventoryClose').tap();
    await npc.waitFor({state:'hidden'});
   }
   assert.deepEqual(errors,[]);
  }finally{await context.close()}
 }
 // The NPC status Back button can return to a still-open conversation. The
 // game correctly blocks the bag in that state, so use a fresh independent
 // portrait session to test its real controls and baseline geometry.
 const portrait=await open(browser,390,740,{x:41,z:43,y:0,facing:1});
 try{
  const {page}=portrait;
  await page.locator('#viewWrap:not([data-analog-play])').waitFor({state:'attached'});
  assert.equal(await page.locator('.poiWalkDpad [data-poi-dir]:visible').count(),4);
  await page.locator('#poiBagToggle').tap();await page.locator(panel).waitFor({state:'visible'});
  const [portraitBag,portraitCell]=await Promise.all([box(page.locator(panel),false),box(page.locator(slot))]);
  const old=await baseline(page,[panel,slot]);
  almost(portraitBag,old[0],'player portrait-mode layout remains unchanged');
  almost(portraitCell,old[1],'portrait inventory item target remains unchanged');
  assert.deepEqual(portrait.errors,[]);
 }finally{await portrait.context.close()}
 const {context,page,errors}=await open(browser,568,320,{x:28,z:32,y:-1,facing:3});
 try{
  await page.waitForFunction(()=>document.querySelector('#poiWalkAction')?.getAttribute('aria-label')?.includes('チェストを開'));
  await page.locator('#poiWalkAction').tap();
  await page.locator('#poiChestPanel').waitFor({state:'visible'});
  const current=await Promise.all([box(page.locator(panel),false),box(page.locator('#poiChestPanel'),false),box(page.locator('#poiChestTakeAll'))]);
  const old=await baseline(page,[panel,'#poiChestPanel','#poiChestTakeAll']);
  current.forEach((rect,i)=>almost(rect,old[i],'separate chest transfer layout remains unchanged'));
  assert(current[0].right<current[1].x);
  await page.locator('#poiChestClose').tap();await page.locator('#poiChestPanel').waitFor({state:'hidden'});
  assert.deepEqual(errors,[]);
 }finally{await context.close()}
 console.log('PASS standalone landscape bag matches both shortcut edges, keeps roomy targets and accessible overflow, leaves NPC/chest/portrait unchanged');
}finally{await browser?.close();await new Promise(r=>server.close(r))}
