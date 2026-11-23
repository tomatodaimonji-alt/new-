import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const random=' const p=poiWildPick(rng);';
assert.equal(html.split(random).length,2);
const fixture=html.replace(random,' const p=null;');
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.setHeader('Cache-Control','no-store');res.end(req.url==='/seed'?'<!doctype html><title>Isolated touch controls</title>':fixture);
});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const origin='http://127.0.0.1:'+server.address().port;
const field={x:102,z:93,y:0,facing:2},cook={x:26,z:41,y:0,facing:2};
const kitKey='world-workshop-hotbar-v1',kit='{"version":1,"weapon":"equipWoodSword","potions":3,"gold":12,"claimedCaches":["glade"]}';
async function launch(browser,width,height,point=field,batterySupported=true){
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 await context.addInitScript(supported=>{
  const readings=new EventTarget();readings.level=.64;readings.charging=false;
  window.__testBatteryReadings=readings;
  Object.defineProperty(navigator,'getBattery',{configurable:true,value:supported?()=>Promise.resolve(readings):undefined});
 },batterySupported);
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.setDefaultTimeout(15000);await page.goto(origin+'/seed');
 await page.evaluate(({point,kitKey,kit})=>{
  localStorage.setItem(kitKey,kit);
  localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":330000}');
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:point,townLayout:5,townMapHeight:128,view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:point.y,
    hideUpper:false,top:false,third:true,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 },{point,kitKey,kit});
 await page.goto(origin+'/?resume=1&test=1');await page.waitForFunction(()=>window.__editorTest?.facility?.()?.active);
 await page.locator('#viewWrap[data-analog-play]').waitFor();return {page,context,errors};
}
const center=r=>[r.x+r.w/2,r.y+r.h/2];
async function rect(element,hitRequired=false){
 const r=await element.evaluate(el=>{
  const r=el.getBoundingClientRect(),at=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
  return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom,vw:innerWidth,vh:innerHeight,
   hit:el.contains(at),cover:at?.id||at?.className,radius:getComputedStyle(el).borderRadius};
 });
 assert(r.w>0&&r.h>0&&r.x>=-1&&r.y>=-1&&r.right<=r.vw+1&&r.bottom<=r.vh+1,element+' clipped '+JSON.stringify(r));
 if(hitRequired)assert(r.hit,element+' blocked '+JSON.stringify(r));
 return r;
}
const apart=(a,b)=>a.right<=b.x+1||b.right<=a.x+1||a.bottom<=b.y+1||b.bottom<=a.y+1;
let browser;
try{
 browser=await chromium.launch({headless:true,
  ...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 for(const [w,h] of [[568,320],[844,390],[1120,500]]){
  const {page,context,errors}=await launch(browser,w,h);
  try{
   const action=page.locator('#poiWalkAction'),bag=page.locator('#poiBagToggle'),pad=page.locator('#poiAnalogPad'),ring=page.locator('#poiAnalogBase');
   const [a,b,p,r,bar]=await Promise.all([rect(action,true),rect(bag,true),rect(pad,true),rect(ring),rect(page.locator('#poiHotbar'))]);
   const [leftX,leftY]=center(r),[rightX,rightY]=center(a);
   assert(Math.abs(leftX/w-.125)<.012&&Math.abs(leftY/h-.775)<.015,'left thumb near marked position: '+JSON.stringify({leftX,leftY,w,h}));
   assert(Math.abs(rightX/w-.88)<.012&&Math.abs(rightY/h-.77)<.015,'action near marked position: '+JSON.stringify({rightX,rightY,w,h}));
   assert(a.radius==='50%'&&a.w===a.h&&b.radius==='50%'&&b.w===b.h,'action and backpack are circular');
   assert(b.right<=a.x-5&&center(b)[1]-rightY>=2&&center(b)[1]-rightY<=9,'backpack stays left of and slightly lower than action');
   assert(apart(bar,a)&&apart(bar,b)&&apart(bar,p),'neither thumb control obscures shortcuts');
   assert.equal(await bag.getAttribute('aria-label'),'インベントリ');
   assert(await bag.locator('svg').isVisible()&&!(await bag.locator('span').isVisible()),'backpack icon is visible without print');
   const menuToggle=page.locator('#poiLandscapeMenuToggle'),battery=page.locator('#poiLandscapeBattery');
   await page.waitForFunction(()=>document.querySelector('#batteryPercent')?.textContent==='64%');
   const [toggleBox,batteryBox]=await Promise.all([rect(menuToggle,true),rect(battery)]);
   assert(w-toggleBox.right>=19&&Math.abs(toggleBox.right-batteryBox.right)<1&&batteryBox.bottom+3<=toggleBox.y,
    'battery shares the padded Menu edge and sits immediately above it');
   assert.equal(await page.locator('#batteryIndicator').count(),1);
   await page.evaluate(()=>{window.__batteryIdentity=document.querySelector('#batteryIndicator')});
   if(w!==1120){
    await menuToggle.tap();const menu=page.locator('#poiLandscapeMenu'),volume=menu.locator('[data-landscape-action="volume"]');
    await volume.tap();
    const mixer=page.locator('#poiSoundPanel');await mixer.waitFor({state:'visible'});
    const [popup,mix]=await Promise.all([rect(menu),rect(mixer)]);
    assert(mix.right+5<=popup.x,'shifted popover and mixer remain separate at '+w+' pixels');
    for(const slider of await mixer.locator('input[type=range]').all())await rect(slider,true);
    await volume.tap();await menuToggle.tap();
   }
   assert.equal(await action.getAttribute('aria-label'),'攻撃または決定');
   assert.equal(await action.getAttribute('data-action-art'),'equipWoodSword');
   const item=action.locator('canvas[data-item-model="equipWoodSword"]');
   assert(await item.isVisible(),'button contains existing equipped item art');
   assert(await item.evaluate(el=>{const d=el.getContext('2d').getImageData(0,0,el.width,el.height).data;
    for(let i=3;i<d.length;i+=4)if(d[i]>150)return true;return false}),'real icon pixels in the reused canvas');
   assert.equal(await page.evaluate(k=>localStorage.getItem(k),kitKey),kit,'placement and art do not change save bytes');
   if(w===568){
    const session=await context.newCDPSession(page);
    const point={x:Math.round(p.x+p.w*.46),y:Math.round(p.y+p.h*.27),id:1,radiusX:6,radiusY:6,force:.55};
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
    await page.waitForFunction(()=>document.querySelector('#poiAnalogPad')?.hasAttribute('data-active'));
    const shifted=await rect(ring);
    assert(Math.abs(center(shifted)[0]-point.x)<1&&Math.abs(center(shifted)[1]-point.y)<1,'new hit area still floats exactly at the thumb');
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await page.waitForFunction(()=>!document.querySelector('#poiAnalogPad')?.hasAttribute('data-active'));
    assert.deepEqual(center(await rect(ring)),center(r),'release restores the dock');
    await page.locator('#poiHotbar [data-hotbar-slot="8"]').tap();
    await action.locator('[data-action-fist]').waitFor();
    assert.equal(await action.getAttribute('data-action-art'),'fist');
    const time=await page.evaluate(()=>window.__editorTest.facility().combat.actionAt);
    await action.tap();
    await page.waitForFunction(was=>window.__editorTest.facility().combat.actionAt>was,time);
    await page.setViewportSize({width:390,height:740});
    await page.locator('#viewWrap:not([data-analog-play])').waitFor({state:'attached'});
    assert(await page.evaluate(()=>document.querySelector('header #batteryIndicator')===window.__batteryIdentity),'portrait reuses the exact live indicator');
    assert.equal(await battery.isVisible(),false);
    await page.evaluate(()=>{window.__testBatteryReadings.level=.42;window.__testBatteryReadings.charging=true;
      window.__testBatteryReadings.dispatchEvent(new Event('levelchange'))});
    await page.waitForFunction(()=>document.querySelector('header #batteryPercent')?.textContent==='42%');
    assert.match(await page.locator('#batteryIndicator').getAttribute('aria-label'),/充電中/);
    assert.equal(await action.getAttribute('data-action-art'),null);
    assert.equal(await action.innerHTML(),'攻撃<br>決定');
    assert(await bag.locator('span').isVisible(),'portrait label is intact');
    assert.equal(await page.locator('.poiWalkDpad [data-poi-dir]:visible').count(),4);
   }
   assert.deepEqual(errors,[]);
  }finally{await context.close()}
 }
 const {page,context,errors}=await launch(browser,844,390,cook,false);
 try{
  assert.equal(await page.locator('#poiLandscapeBattery #batteryPercent').textContent(),'--%','no invented charge if Battery API is unavailable');
  const action=page.locator('#poiWalkAction');
  await page.waitForFunction(()=>document.querySelector('#poiWalkAction')?.getAttribute('aria-label')==='イネス（食堂の料理人）と話す');
  assert.equal(await action.textContent(),'話す');
  await action.tap();
  assert.equal(await action.getAttribute('aria-label'),'会話の選択肢を決定する');
  assert.match(await action.innerText(),/選択[\s\S]*決定/);
  await page.locator('#poiNpcMenu [data-npc-action="status"]').tap();
  const npc=page.locator('#poiNpcInventory');await npc.waitFor({state:'visible'});
  await npc.locator('#poiNpcInventoryClose').tap();
  assert.equal(await page.evaluate(k=>localStorage.getItem(k),kitKey),kit,'conversation and art remain read only');
  assert.deepEqual(errors,[]);
 }finally{await context.close()}
 console.log('PASS marked round touch controls, actual equipped icon, unarmed fist/attack, speech and unchanged portrait');
}finally{await browser?.close();await new Promise(r=>server.close(r))}

