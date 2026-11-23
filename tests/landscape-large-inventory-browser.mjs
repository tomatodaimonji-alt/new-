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
async function open(browser,width,height,spawn=point){
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.setDefaultTimeout(15000);await page.goto(origin+'/seed');
 await page.evaluate(({point,kitKey,kit})=>{
  localStorage.setItem(kitKey,kit);
  localStorage.setItem('world-workshop-town-clock-v1',JSON.stringify({version:1,gameMs:11*60*500}));
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:point,townLayout:5,townMapHeight:128,view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:point.y,
    hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 },{point:spawn,kitKey,kit});
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
const metrics=[
 {width:568,height:320,rows:2,hotMin:37,hotMax:40,itemMin:33,itemMax:36},
 {width:844,height:390,rows:1,hotMin:47,hotMax:53,itemMin:50,itemMax:54.5},
 {width:1120,height:500,rows:1,hotMin:58,hotMax:60,itemMin:53,itemMax:55}
];
const inRange=(n,min,max)=>n>=min&&n<=max;
let browser;
try{
 browser=await chromium.launch({headless:true,
  ...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 for(const m of metrics){
  const {context,page,errors}=await open(browser,m.width,m.height);
  try{
   const bar=page.locator('#poiHotbar'),slots=bar.locator('button[data-hotbar-slot]');
   const [pad,frame,bagKey,action]=await Promise.all([
    box(page.locator('#poiAnalogPad')),box(bar,false),box(page.locator('#poiBagToggle')),box(page.locator('#poiWalkAction'))
   ]);
   const clear=(a,b)=>a.right+3<=b.x||b.right+3<=a.x||a.bottom+3<=b.y||b.bottom+3<=a.y;
   assert(clear(frame,pad)&&clear(frame,bagKey)&&clear(frame,action)&&bagKey.right<action.x,'safe gaps from both thumb corners');
   assert.equal(await slots.count(),9);
   assert.deepEqual(await slots.evaluateAll(nodes=>nodes.map(x=>+x.dataset.hotbarSlot)),Array.from({length:9},(_,i)=>i));
   const cells=await Promise.all((await slots.all()).map(slot=>box(slot)));
   assert.equal(new Set(cells.map(c=>Math.round(c.y))).size,m.rows);
   if(m.rows===2){
    assert.equal(cells.filter(c=>Math.abs(c.y-cells[0].y)<1).length,5);
    assert(cells[5].x>cells[0].x,'the four-slot second row is centered instead of spilling into thumb controls');
   }
   for(const {w,h} of cells)assert(inRange(w,m.hotMin,m.hotMax)&&Math.abs(w-h)<1,JSON.stringify({width:m.width,w,h}));
   await page.locator('#poiBagToggle').tap();
   const bag=page.locator('#poiBagPanel');
   await bag.waitFor({state:'visible'});
   const bagPanel=await box(bag,false);
   assert(bagPanel.bottom+3<=frame.y,'player bag fits above the actual hotbar height');
   const item=await box(bag.locator('[data-bag-slot="0"]'));
   assert(inRange(item.w,m.itemMin,m.itemMax)&&Math.abs(item.w-item.h)<1,'larger player slot: '+JSON.stringify({m,item}));
   await bag.locator('#poiBagClose').tap();await bag.waitFor({state:'hidden'});
   await page.waitForFunction(()=>document.querySelector('#poiWalkAction')?.getAttribute('aria-label')==='住人と話す');
   await page.locator('#poiWalkAction').tap();
   const dialogue=page.locator('#poiMessagePanel'),choices=page.locator('#poiNpcMenu');
   await dialogue.waitFor({state:'visible'});
   const speech=await box(dialogue,false),menu=await box(choices,false);
   assert(Math.abs(speech.x-frame.x)<1&&Math.abs(speech.right-frame.right)<1&&Math.abs(speech.h-80)<1,
    'dialogue aligns both edges with the actual shortcut footprint '+JSON.stringify({m,speech,frame}));
   assert(speech.x>=pad.right+4&&speech.bottom+3<=frame.y&&menu.bottom<speech.y,'speech and options stay above shortcuts while keeping left touch lane clear');
   assert.match(await dialogue.locator('#poiMessageHeading').textContent(),/イネス/);
   const allChoices=await choices.locator('button[data-npc-action]').all();
   assert.equal(allChoices.length,4);
   for(const choice of allChoices)await box(choice);
   await choices.locator('[data-npc-action="status"]').tap();
   const npc=page.locator('#poiNpcInventory'),ladle=npc.locator('[data-npc-item="equipLadle"]');
   await npc.waitFor({state:'visible'});
   assert((await box(npc,false)).bottom+3<=frame.y);
   const [npcSlot,npcGear]=await Promise.all([box(ladle),box(npc.locator('[data-npc-gear-slot="weapon"]'))]);
   assert.equal(npcSlot.w,item.w);assert.equal(npcGear.w,item.w);
   await ladle.tap();assert.equal(await page.locator('#poiItemDetailName').textContent(),'おたま');
   await page.locator('#poiItemDetail').getByRole('button',{name:'戻る'}).tap();
   await npc.locator('#poiNpcInventoryClose').tap();
   assert.equal(await page.evaluate(k=>localStorage.getItem(k),kitKey),kit,'inspection leaves the same save bytes');
   if(m.width===568){
    await page.setViewportSize({width:390,height:740});
    await page.locator('#poiAnalogPad').waitFor({state:'hidden'});
    await page.locator('#viewWrap:not([data-analog-play])').waitFor({state:'attached'});
    assert.equal(await page.locator('.poiWalkDpad [data-poi-dir]:visible').count(),4);
    const port=await Promise.all((await slots.all()).map(x=>box(x)));
    assert.equal(new Set(port.map(c=>Math.round(c.y))).size,1,'portrait slot row unchanged');
   }
   assert.deepEqual(errors,[]);
   console.log(m.width+'x'+m.height+': hotbar '+cells[0].w.toFixed(1)+'px × '+m.rows+' rows, NPC and player '+item.w.toFixed(1)+'px');
  }finally{await context.close()}
 }
 const chest=await open(browser,568,320,{x:28,z:32,y:-1,facing:3});
 try{
  const {page}=chest;
  await page.waitForFunction(()=>document.querySelector('#poiWalkAction')?.getAttribute('aria-label').includes('チェストを開'));
  await page.locator('#poiWalkAction').tap();
  await page.locator('#poiChestTakeAll').tap();
  await page.locator('#poiChestClose').tap();
  const announcement=page.locator('#poiMessagePanel');
  await announcement.waitFor({state:'visible'});
  assert.equal(await announcement.locator('#poiMessageHeading').textContent(),'アナウンス');
  assert.match(await announcement.locator('#poiMessageLog').textContent(),/インベントリ|移した/);
  const panel=await box(announcement,false),bar=await box(page.locator('#poiHotbar'),false);
  assert(Math.abs(panel.x-bar.x)<1&&Math.abs(panel.right-bar.right)<1&&Math.abs(panel.h-80)<1&&panel.bottom<bar.y,
   'real chest announcement matches shortcut width and stays above it');
  assert.deepEqual(chest.errors,[]);
 }finally{await chest.context.close()}
 console.log('PASS larger inventory, shortcut, speech and announcement targets with reachable choices and unchanged portrait');
}finally{await browser?.close();await new Promise(r=>server.close(r))}
