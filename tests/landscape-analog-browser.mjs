import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';

const html=readFileSync(process.argv[2]||'world-editor.html','utf8');
const fixtureNeedle=' const p=poiWildPick(rng);';
assert.equal(html.split(fixtureNeedle).length,2);
const regionalNeedle='function poiWildRegionalFrame(now,rng){';
assert.equal(html.split(regionalNeedle).length,2);
const fixture=html.replace(fixtureNeedle,' const p=null;').replace(regionalNeedle,regionalNeedle+'return;'); // pure movement fixture: no unrelated regular or regional encounters
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.setHeader('Cache-Control','no-store');res.end(req.url==='/seed'?'<!doctype html><title>Isolated save fixture</title>':fixture);
});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const origin='http://127.0.0.1:'+server.address().port;
const resumeKey='world-workshop-resume-v1',kitKey='world-workshop-hotbar-v1';
const kit='{"version":1,"weapon":"equipWoodSword","potions":2,"gold":18,"claimedCaches":["glade"]}';
const pos=page=>page.evaluate(()=>window.__editorTest.facility().position);
const stored=page=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),resumeKey);
const touch=(x,y,id=1)=>({x:Math.round(x),y:Math.round(y),id,radiusX:6,radiusY:6,force:.7});
async function open(browser,point,options={}){
 const {third=false,width=740,height=390}=options;
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(15000);
 await page.goto(origin+'/seed');
 await page.evaluate(({point,third,resumeKey,kitKey,kit})=>{
  localStorage.setItem(kitKey,kit);
  localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":330000}');
  localStorage.setItem(resumeKey,JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:point.x,z:point.z,y:0,facing:2},townLayout:5,townMapHeight:128,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 },{point,third,resumeKey,kitKey,kit});
 await page.goto(origin+'/?resume=1&test=1');
 await page.waitForFunction(()=>window.__editorTest?.facility?.()?.active);
 assert.deepEqual(await pos(page),{...point,level:0});
 const cdp=await context.newCDPSession(page);
 const send=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
 const pad=page.locator('#poiAnalogPad');
 return {page,context,errors,send,pad};
}
async function center(pad,ratioX=.48,ratioY=.50,id=1){
 const box=await pad.boundingBox();
 assert.ok(box&&box.width>48&&box.height>40,'landscape pad is a thumb-sized visible region');
 return touch(box.x+box.width*ratioX,box.y+box.height*ratioY,id);
}
const held=(pad)=>pad.evaluate(el=>el.hasAttribute('data-active'));
const targetIsPad=(page,p)=>page.evaluate(({x,y})=>!!document.elementFromPoint(x,y)?.closest('#poiAnalogPad'),p);
async function openField(browser){
 const point={x:102,z:93};
 const {page,context,errors,send,pad}=await open(browser,point);
 try{
  assert(await pad.isVisible());
  const start=await center(pad,.53,.44),location=await pad.boundingBox();
  assert(await targetIsPad(page,start),'lower-left touch target is not covered by other panels');
  await send('touchStart',[start]);
  await pad.evaluate((el,{start,location})=>{
   if(parseFloat(el.style.getPropertyValue('--poi-analog-x'))!==start.x-location.x||
      parseFloat(el.style.getPropertyValue('--poi-analog-y'))!==start.y-location.y)throw Error('The logical center does not follow the exact initial thumb position');
  },{start,location});
  await page.waitForTimeout(350);
  assert.deepEqual(await pos(page),{...point,level:0},'touching the pad alone does not move');
  await send('touchMove',[touch(start.x+3,start.y-4)]);
  await page.waitForTimeout(330);
  assert.deepEqual(await pos(page),{...point,level:0},'small touch motions stay within dead zone');
  await send('touchMove',[touch(start.x+44,start.y+34)]);
  await page.waitForFunction(({x,z})=>{const p=window.__editorTest.facility().position;return p.x>x&&p.z>z},point);
  await send('touchEnd',[]);
  const moved=await pos(page);
  await page.waitForTimeout(380);
  assert.deepEqual(await pos(page),moved,'lifting does not leave repeating movement behind');
  assert.equal(await held(pad),false);
  assert.equal(await pad.evaluate(el=>el.style.getPropertyValue('--poi-analog-x')),'','idle center goes back to default dock');
  const save=await stored(page);
  assert.equal(save.version,1);assert.equal(save.position.x,moved.x);assert.equal(save.position.z,moved.z);
  assert.ok(Number.isInteger(save.position.facing)&&save.position.facing>=0&&save.position.facing<4);
  assert.equal(await page.evaluate(k=>localStorage.getItem(k),kitKey),kit,'walking empty ground does not touch the kit');

  const next=await center(pad,.4,.56);
  await send('touchStart',[next]);assert(await held(pad));
  await page.setViewportSize({width:390,height:740});
  await pad.waitFor({state:'hidden'});
  await send('touchCancel',[]);
  await page.waitForTimeout(270);
  assert.deepEqual(await pos(page),moved);assert.equal(await held(pad),false);
  assert(await page.locator('[data-poi-dir="s"]').isVisible(),'portrait keeps the D-pad after rotation');
  assert.deepEqual((await stored(page)).position,save.position,'rotation itself does not relocate or rewrite position');
  assert.deepEqual(errors,[]);
 }finally{await context.close()}
}
async function bridge(browser){
 const {page,context,errors,send,pad}=await open(browser,{x:101,z:104});
 try{
  const start=await center(pad);
  await send('touchStart',[start]);
  await send('touchMove',[touch(start.x+38,start.y+30)]);
  await page.waitForFunction(()=>window.__editorTest.facility().position.z>=105);
  await send('touchEnd',[]);
  const p=await pos(page);
  assert.equal(p.x,101,'inclined input follows legal bridge direction and cannot cut sideways into water');
  assert(p.z>=105&&p.z<=107);assert.deepEqual(errors,[]);
 }finally{await context.close()}
}
async function simultaneousOrbit(browser){
 const point={x:102,z:90};
 const {page,context,errors,send,pad}=await open(browser,point,{third:true,width:844,height:390});
 try{
  const start=await center(pad),moved=touch(start.x,start.y+35),screen=await page.locator('#view').boundingBox();
  const candidate=await page.evaluate(({x,y,width,height})=>{
   for(const ry of [.58,.52,.44,.36,.29])for(const rx of [.74,.84,.64,.56]){
    const sx=x+width*rx,sy=y+height*ry,tx=sx+45,ty=sy-31;
    if(document.elementFromPoint(sx,sy)?.id==='view'&&document.elementFromPoint(tx,ty)?.id==='view')
     return [sx,sy,tx,ty];
   }
   return null;
  },screen);
  assert(candidate,'the right thumb has a clear camera drag region');
  const [x,y,tx,ty]=candidate,right=touch(x,y,2),dragged=touch(tx,ty,2);
  await send('touchStart',[start]);
  await send('touchStart',[start,right]);
  await send('touchMove',[moved,dragged]);
  await page.waitForFunction(({resumeKey,point})=>{
   const read=JSON.parse(localStorage.getItem(resumeKey));
   return Math.abs(read.view.orbitYaw)>.2&&(read.position.x!==point.x||read.position.z!==point.z);
  },{resumeKey,point});
  assert(await held(pad),'second touch orbit did not lose the left capture');
  await send('touchCancel',[]);
  assert.equal(await held(pad),false);
  const stopped=await pos(page);await page.waitForTimeout(380);
  assert.deepEqual(await pos(page),stopped,'touchcancel fully stops movement');
  assert.deepEqual(errors,[]);
 }finally{await context.close()}
}
async function simultaneousAction(browser){
 const point={x:26,z:41};
 const {page,context,errors,send,pad}=await open(browser,point,{width:844,height:390});
 try{
  await page.waitForFunction(()=>window.__editorTest.townResidents().actors.some(a=>
   a.id==='towncook'&&a.activity==='work'&&a.x===26&&a.z===42));
  const action=page.locator('#poiWalkAction');
  await page.waitForFunction(()=>document.querySelector('#poiWalkAction')?.getAttribute('aria-label')==='イネス（食堂の料理人）と話す');
  const left=await center(pad),box=await action.boundingBox();
  assert.ok(box&&box.x>left.x,'one thumb can reach the original Action once it is moved to the right');
  const right=touch(box.x+box.width/2,box.y+box.height/2,2);
  assert(await page.evaluate(({x,y})=>!!document.elementFromPoint(x,y)?.closest('#poiWalkAction'),right));
  await action.evaluate(el=>{
   window.__analogActionTrail=[];
   for(const type of ['pointerdown','pointerup','pointercancel','click'])
    el.addEventListener(type,e=>window.__analogActionTrail.push([e.type,e.isPrimary,e.pointerType]),true);
  });
  await send('touchStart',[left]);assert(await held(pad));
  await send('touchStart',[left,right]);
  await page.waitForFunction(()=>window.__analogActionTrail.some(([event,primary,type])=>event==='pointerdown'&&!primary&&type==='touch'));
  assert(await held(pad),'both touches are down before Chromium delivers their release');
  await send('touchEnd',[]); // CDP requires an empty point list to end a touch sequence
  try{await page.waitForFunction(()=>window.__editorTest.townResidents().dialogue?.id==='towncook',null,{timeout:4000})}
  catch(err){throw Error('Secondary touch did not open conversation: '+JSON.stringify(await page.evaluate(()=>window.__analogActionTrail)),{cause:err})}
  const trail=await page.evaluate(()=>window.__analogActionTrail);
  assert(trail.some(([event,primary,type])=>event==='pointerup'&&!primary&&type==='touch'),'the secondary touch really completed on the original action');
  await page.waitForFunction(()=>!document.querySelector('#poiAnalogPad').hasAttribute('data-active'));
  assert(await page.locator('#poiNpcMenu [data-npc-action="status"]').isVisible(),'one secondary tap opened the conversation');
  await page.waitForTimeout(280);
  const dialog=await page.evaluate(()=>window.__editorTest.townResidents().dialogue);
  assert.equal(dialog.text,'お腹は空いてない？　今ちょうど鍋を火にかけたところだよ。','no compatibility click activates the first menu choice again');
  assert.deepEqual(await pos(page),{...point,level:0});
  assert.deepEqual(errors,[]);
 }finally{await context.close()}
}
let browser;
try{
 browser=await chromium.launch({headless:true,
  ...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await openField(browser);
 await bridge(browser);
 await simultaneousOrbit(browser);
 await simultaneousAction(browser);
 console.log('PASS native floating thumb center, deadzone, diagonal/bridge legal walk, two-thumb orbit, release/cancel and portrait rotation');
}finally{await browser?.close();await new Promise(r=>server.close(r));}


