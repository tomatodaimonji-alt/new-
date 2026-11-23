import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';

const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
assert.match(html,/id="poiChestTakeAll"/,'v209 exposes native take-all action');
assert.match(html,/function poiChestTakeAll\(/,'v209 contains actual batch transfer');
if(process.env.CHEST_ALL_LAYOUT_ONLY==='1'){console.log('PASS v209 native bulk chest control and runtime present');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url.startsWith('/seed')?'<!doctype html><title>Isolated fixture</title>':html);
});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const origin='http://127.0.0.1:'+server.address().port;
const kitKey='world-workshop-hotbar-v1',resumeKey='world-workshop-resume-v1';
const chest='#poiChestPanel',bag='#poiBagPanel',take='#poiChestTakeAll',close='#poiChestClose',decide='#poiWalkAction';
const out=process.env.FACILITY_SCREENSHOTS;if(out)await mkdir(out,{recursive:true});
const state=page=>page.evaluate(()=>window.__editorTest.facility());
const read=page=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),kitKey);
const writes=page=>page.evaluate(()=>window.__chestKitWrites);
const herb=count=>({type:'healingHerb',count}),can=count=>({type:'cannedFood',count});
const blade={type:'kitchenKnife',count:1,durability:27},wand={type:'fireWand',count:1,charges:3};
const sword={type:'equipWoodSword',count:1};
function fixture(overflow){
 const slots=Array(27).fill(null);
 slots[0]=sword;slots[1]=herb(2);
 slots[9]=herb(8);
 if(overflow)for(let i=10;i<18;i++)slots[i]=can(9);
 const items=Array(18).fill(null);
 items.splice(0,3,herb(3),blade,wand);
 return {version:1,weapon:sword.type,gold:12,goldHotbarSlot:4,potions:9,weaponDurabilityVersion:2,claimedCaches:['glade'],slots,
  ...(overflow?{kitchenChest:{version:1,slots:items}}:{})};
}
async function launch(browser,width,data){
 const ctx=await browser.newContext({viewport:{width,height:width===320?568:740},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 await ctx.addInitScript(k=>{
  const original=Storage.prototype.setItem;
  window.__chestKitWrites=[];
  Storage.prototype.setItem=function(key,value){
   if(key===k&&this===localStorage)window.__chestKitWrites.push(value);
   return original.apply(this,arguments);
  };
 },kitKey);
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
 await page.goto(origin+'/seed');
 await page.evaluate(({data,kitKey,resumeKey})=>{
  localStorage.setItem(kitKey,JSON.stringify(data));
  localStorage.setItem(resumeKey,JSON.stringify({version:1,route:'facility',id:'base',play:true,position:{x:28,z:32,y:-1,facing:3},townLayout:5,townMapHeight:128,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:-1,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 },{data,kitKey,resumeKey});
 await page.goto(origin+'/?resume=1&test=1');await ready(page);
 assert.deepEqual((await state(page)).position,{x:28,z:32,level:-1});
 return {ctx,page,errors};
}
const ready=page=>page.waitForFunction(()=>window.__editorTest?.facility?.().active);
async function open(page){
 await page.waitForFunction(()=>/チェストを開/.test(document.querySelector('#poiWalkAction')?.getAttribute('aria-label')||''));
 await page.locator(decide).tap();await page.locator(chest).waitFor({state:'visible'});await page.locator(bag).waitFor({state:'visible'});
}
async function inspectHeader(page){
 const b=page.locator(take);
 assert.equal(await b.innerText(),'全てインベントリへ入れる');
 const rect=await b.evaluate((el,close)=>{
  const r=el.getBoundingClientRect(),c=document.querySelector(close),x=c.getBoundingClientRect(),panel=el.closest('.poiChestHeader').getBoundingClientRect();
  return {next:el.nextElementSibling===c,x:r.x,right:r.right,width:r.width,height:r.height,gap:x.x-r.right,align:Math.abs(x.y-r.y),
   panelLeft:panel.left,panelRight:panel.right,closeRight:x.right,viewport:innerWidth};
 },close);
 assert(rect.next&&rect.width>80&&rect.height>=24&&rect.gap>=0&&rect.gap<16&&rect.align<=1);
 assert(rect.x>=rect.panelLeft&&rect.right<=rect.panelRight&&rect.closeRight<=rect.viewport,'button and adjacent close remain in portrait viewport');
}
async function trial(browser,width,overflow){
 const data=fixture(overflow),{ctx,page,errors}=await launch(browser,width,data);
 try{
  if(!overflow)assert.equal((await read(page)).kitchenChest,undefined);
  await open(page);await inspectHeader(page);
  const before=await read(page),log0=(await writes(page)).length,initial=(await state(page)).inventory;
  assert.equal(initial.goldHotbarSlot,4,'canonical fixture keeps reserved wallet slot before taking any loot');
  assert.equal(initial.weapon,sword.type);assert.equal(before.gold,12);
  if(overflow)assert.deepEqual(before.kitchenChest.slots.slice(0,3),[herb(3),blade,wand]);
  else assert.equal(before.kitchenChest.slots[0].type,'kitchenKnife','real first chest use generates its normal starting contents');
  if(out)await page.screenshot({path:out+'/v209-chest-'+width+'-before.png'});
  await page.locator(take).tap();
  assert.equal((await writes(page)).length-log0,1,'take all does one durable write covering both sides');
  const after=await read(page),inv=(await state(page)).inventory;
  assert.deepEqual(inv.hotbar,initial.hotbar,'no loot spills into active shortcut slots');
  assert.equal(inv.goldHotbarSlot,4);assert.equal(inv.weapon,sword.type);assert.equal(after.gold,12);
  await page.locator(chest).waitFor({state:'visible'});await page.locator(bag).waitFor({state:'visible'});
  if(overflow){
   assert.deepEqual(after.kitchenChest.slots.slice(0,3),[herb(2),blade,wand],'only merging room is used; condition and held charges stay in chest');
   assert.deepEqual(inv.bag[0],herb(9));
   const w=(await writes(page)).length;
   await page.locator(take).tap();
   assert.equal((await writes(page)).length,w,'a full transfer failure is read-only');
  }else{
   assert(after.kitchenChest.slots.every(c=>c===null));
   for(const item of before.kitchenChest.slots.filter(Boolean))assert(inv.bag.slice(0,9).some(c=>JSON.stringify(c)===JSON.stringify(item)));
  }
  if(out)await page.screenshot({path:out+'/v209-chest-'+width+'-after.png'});
  await page.reload();await ready(page);
  assert.deepEqual(await read(page),after);
  await open(page);
  assert.deepEqual((await state(page)).inventory.kitchenChest,after.kitchenChest);
  await page.locator(close).tap();await page.locator(chest).waitFor({state:'hidden'});
  assert.deepEqual(errors,[]);
 }finally{await ctx.close()}
}
let browser;
try{
 browser=await chromium.launch({headless:true,
  ...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await trial(browser,390,false);await trial(browser,320,true);
 console.log('PASS native 320/390 chest header, one-write transfer, overflow metadata, shortcuts and persistence');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
