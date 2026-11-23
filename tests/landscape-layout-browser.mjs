import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';

const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<!doctype html>':html)});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const origin='http://127.0.0.1:'+server.address().port;
const out=process.env.FACILITY_SCREENSHOTS;if(out)await mkdir(out,{recursive:true});
const kitKey='world-workshop-hotbar-v1',kit='{"version":1,"weapon":"equipWoodSword","potions":3,"gold":12,"claimedCaches":["glade"]}';
const cook={x:26,z:41,y:0,facing:2},chest={x:28,z:32,y:-1,facing:3};
const snap=page=>page.evaluate(()=>window.__editorTest.facility().position);
async function launch(browser,width,height,p){
 const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const page=await ctx.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 page.setDefaultTimeout(15000);await page.goto(origin+'/seed');
 await page.evaluate(({p,kitKey,kit})=>{
  localStorage.setItem(kitKey,kit);
  localStorage.setItem('world-workshop-town-clock-v1',JSON.stringify({version:1,gameMs:11*60*500}));
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:p,townLayout:5,townMapHeight:128,view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:p.y,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 },{p,kitKey,kit});
 await page.goto(origin+'/?resume=1&test=1');await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
 assert.deepEqual(await snap(page),{x:p.x,z:p.z,level:p.y});return {ctx,page,errors};
}
async function fits(locator,stage='body',hit=true){
 const outcome=await locator.evaluate((el,{stage,hit})=>{
  const r=el.getBoundingClientRect(),root=document.querySelector(stage).getBoundingClientRect();
  const target=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
  const inside=r.width>=1&&r.height>=1&&r.left>=Math.max(0,root.left)-1&&r.top>=Math.max(0,root.top)-1&&
   r.right<=Math.min(innerWidth,root.right)+1&&r.bottom<=Math.min(innerHeight,root.bottom)+1;
  return {inside,hit:!hit||el.contains(target),cover:target?.id||target?.className,w:r.width,h:r.height,x:r.x,y:r.y,bottom:r.bottom,right:r.right};
 },{stage,hit});
 assert(outcome.inside&&outcome.hit,locator+' not usable: '+JSON.stringify(outcome));return outcome;
}
async function verifyControls(page,width){
 await page.locator('#viewWrap[data-analog-play]').waitFor({state:'visible'});
 const pad=await fits(page.locator('#poiAnalogPad'),'#viewWrap');
 const action=await fits(page.locator('#poiWalkAction'),'#viewWrap');
 const mini=await fits(page.locator('#poiMiniHud'),'#viewWrap',false);
 const bag=await fits(page.locator('#poiBagToggle'),'#viewWrap');
 const bar=await fits(page.locator('#poiHotbar'),'#viewWrap',false);
 assert(pad.x<width*.1&&action.right>width*.86&&bag.right<action.x,'left thumb / right action / adjacent bag');
 const clear=(a,b)=>a.right<=b.x||b.right<=a.x||a.bottom<=b.y||b.bottom<=a.y;
 assert(mini.x<width*.15&&mini.y<pad.y&&clear(bar,bag)&&clear(bar,action)&&clear(bar,pad)&&bar.x>pad.x,
  'upper-left map and centered nonoverlapping shortcuts');
 for(const tool of await page.locator('#poiGameTools > button:visible').all())await fits(tool,'#viewWrap');
 for(const tool of await page.locator('#quickTools > button:visible').all())await fits(tool,'#viewWrap');
 for(const item of await page.locator('#poiHotbar > button').all()){
  const r=await fits(item,'#viewWrap');assert(r.w>=22&&r.h>=22,'landscape shortcut remains tappable');
 }
 assert.equal(await page.locator('.poiWalkDpad [data-poi-dir]:visible').count(),0);
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 for(const [width,height] of [[568,320],[844,390]]){
  const {ctx,page,errors}=await launch(browser,width,height,cook);
  try{
   await verifyControls(page,width);
   if(out)await page.screenshot({path:out+'/v214-landscape-'+width+'.png'});
   const menu=page.locator('#poiLandscapeMenuToggle');
   const sound=page.locator('#poiLandscapeMenu button[data-landscape-action="volume"]');
   await menu.tap();await sound.tap();
   const mixer=page.locator('#poiSoundPanel');await mixer.waitFor({state:'visible'});
   await fits(mixer,'#viewWrap',false);
   for(const slider of await mixer.locator('input[type="range"]').all())await fits(slider,'#viewWrap');
   await sound.tap();await mixer.waitFor({state:'hidden'});await menu.tap();
   await page.waitForFunction(()=>document.querySelector('#poiWalkAction').getAttribute('aria-label')==='住人と話す');
   await page.locator('#poiWalkAction').tap();
   const inspect=page.locator('#poiNpcMenu [data-npc-action="status"]');
   await inspect.waitFor({state:'visible'});await fits(inspect,'#viewWrap');await inspect.tap();
   const npc=page.locator('#poiNpcInventory');
   await npc.waitFor({state:'visible'});await fits(npc,'#viewWrap',false);
   const ladle=npc.locator('[data-npc-item="equipLadle"]');
   assert((await fits(ladle,'#viewWrap')).w>=22);
   await ladle.tap();const detail=page.locator('#poiItemDetail');assert.match(await detail.locator('h2').innerText(),/おたま/);
   await fits(detail.getByRole('button',{name:'戻る'}));await detail.getByRole('button',{name:'戻る'}).tap();
   await npc.locator('#poiNpcInventoryClose').tap();
   const saved=await page.evaluate(key=>localStorage.getItem(key),kitKey);
   await page.setViewportSize({width:390,height:740});
   await page.locator('#poiAnalogPad').waitFor({state:'hidden'});
   assert.equal(await page.locator('.poiWalkDpad [data-poi-dir]:visible').count(),4);
   const act=await fits(page.locator('#poiWalkAction'),'#viewWrap');assert(Math.abs(act.x+act.w/2-195)<20,'portrait D-pad stays centered');
   assert.equal(saved,kit);assert.equal(await page.evaluate(key=>localStorage.getItem(key),kitKey),saved);
   assert.deepEqual(errors,[]);
  }finally{await ctx.close()}
 }
 const c=await launch(browser,568,320,chest);
 try{
  const {page}=c;
  await page.waitForFunction(()=>document.querySelector('#poiWalkAction').getAttribute('aria-label')?.includes('チェストを開'));
  await page.locator('#poiWalkAction').tap();
  const bag=page.locator('#poiBagPanel'),ch=page.locator('#poiChestPanel');
  await ch.waitFor({state:'visible'});
  const a=await fits(bag,'#viewWrap',false),b=await fits(ch,'#viewWrap',false);
  assert(a.right<b.x,'player bag and chest are side by side');
  assert((await fits(page.locator('#poiChestTakeAll'),'#viewWrap')).w>=85);
  await page.locator('#poiChestTakeAll').tap();
  if(out)await page.screenshot({path:out+'/v214-landscape-chest.png'});
  await fits(page.locator('#poiChestClose'),'#viewWrap');
  await page.locator('#poiChestClose').tap();await ch.waitFor({state:'hidden'});
  assert.deepEqual(c.errors,[]);
 }finally{await c.ctx.close()}
 console.log('PASS landscape controls, NPC detail, chest and existing portrait controls at real touch viewports');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
