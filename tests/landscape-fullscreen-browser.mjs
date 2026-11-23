import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';

const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.setHeader('Cache-Control','no-store');res.end(req.url==='/seed'?'<!doctype html>':html);
});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const root='http://127.0.0.1:'+server.address().port;
const kitKey='world-workshop-hotbar-v1', audioKey='world-workshop-audio-v2';
const editorKey='forest-world-editor-v1', resumeKey='world-workshop-resume-v1';
const saved={
 [kitKey]:'{"version":1,"weapon":"equipWoodSword","potions":3,"gold":12,"claimedCaches":["glade"]}',
 [audioKey]:'{"master":72,"bgm":39,"se":68}',
 [editorKey]:'{"format":"forest-world-v1","version":1,"size":16,"width":16,"height":16,"terrainHeights":[],"world":[{"x":1,"z":1,"y":0,"type":"stonewall","rot":0}],"models":[],"prefabs":[],"checks":[]}'
};
const point={x:26,z:41,y:0,facing:2};
const gamePosition=page=>page.evaluate(()=>window.__editorTest.facility().position);
const snapshot=page=>page.evaluate(keys=>Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)])),Object.keys(saved));
async function hit(locator,expectHit=true){
 const box=await locator.evaluate(el=>{
  const r=el.getBoundingClientRect(),target=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
  return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom,viewportW:innerWidth,viewportH:innerHeight,hit:el.contains(target),cover:target?.id||target?.className};
 });
 assert(box.w>1&&box.h>1&&box.x>=-1&&box.y>=-1&&box.right<=box.viewportW+1&&box.bottom<=box.viewportH+1,locator+' clipped: '+JSON.stringify(box));
 if(expectHit)assert(box.hit,locator+' tap obstructed: '+JSON.stringify(box));
 return box;
}
async function launch(browser,width,height){
 const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.setDefaultTimeout(15000);
 await page.goto(root+'/seed');
 await page.evaluate(({saved,point,resumeKey})=>{
  for(const [key,value] of Object.entries(saved))localStorage.setItem(key,value);
  localStorage.setItem('world-workshop-town-clock-v1',JSON.stringify({version:1,gameMs:11*60*500}));
  localStorage.setItem(resumeKey,JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:point,townLayout:5,townMapHeight:128,view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,
    hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 },{saved,point,resumeKey});
 await page.goto(root+'/?resume=1&test=1');
 await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
 return {ctx,page,errors};
}
const menuSelector='#poiLandscapeMenu',toggleSelector='#poiLandscapeMenuToggle';
const currentVersion=html.match(/<h1>[^<]*（(v[0-9]+)）<\/h1>/)?.[1];
assert(currentVersion,'canonical HTML has a current release label');
const currentVersionPattern=new RegExp('\\b'+currentVersion+'\\b','i');
const version=page=>page.getByText(currentVersionPattern).filter({visible:true});
const actionItem=(page,name)=>page.locator(menuSelector+' button[data-landscape-action="'+name+'"]');
async function openMenu(page){
 const toggle=page.locator(toggleSelector),menu=page.locator(menuSelector);
 if(!(await menu.isVisible())){await hit(toggle);await toggle.tap()}
 await menu.waitFor({state:'visible'});return menu;
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 for(const [width,height] of [[568,320],[844,390]]){
  const {ctx,page,errors}=await launch(browser,width,height);
  try{
   const stage=await hit(page.locator('#viewWrap[data-analog-play]'),false);
   assert(stage.x<=1&&stage.y<=1&&stage.right>=width-1&&stage.bottom>=height-1,'landscape scene fills viewport: '+JSON.stringify(stage));
   const normalControls=page.locator('#app > header,#app > footer,#mobileTabs,#quickTools,#poiGameTools > button,#pineCheckToolbar');
   for(const control of await normalControls.all())assert.equal(await control.isVisible(),false,control+' is normally hidden');
   const mini=await hit(page.locator('#poiMiniHud'),false);
   const pad=await hit(page.locator('#poiAnalogPad'));
   const action=await hit(page.locator('#poiWalkAction'));
   const bag=await hit(page.locator('#poiBagToggle'));
   const bar=await hit(page.locator('#poiHotbar'),false);
   const toggle=await hit(page.locator(toggleSelector));
   assert.equal(await version(page).count(),0,'ordinary gameplay does not label the version');
   assert(mini.x<32&&mini.y<24,'minimap sits immediately at upper-left');
   assert(pad.x<32&&pad.y>mini.y+mini.h,'pad remains below the minimap near lower-left');
   assert(action.w>62&&action.h>56&&action.x>width*.72&&width-action.right>=12&&height-action.bottom>=7,'large action button has a deliberate inward margin');
   assert(bag.right<action.x&&action.x-bag.right<=20&&Math.abs(bag.bottom-action.bottom)<=12,'bag is adjacent to action');
   assert(bar.right<=bag.x+1&&bar.x>=pad.x+pad.w-1,'bar does not overlap either thumb target');
   assert(toggle.x>width*.72&&toggle.y<40&&toggle.w>=40&&toggle.h>=40,'upper-right menu has a thumb-sized touch target');
   const baseline=await snapshot(page);
   assert.deepEqual(baseline,saved,'fixture exists on startup without save writes');
   assert.deepEqual(await gamePosition(page),{x:point.x,z:point.z,level:0});
   const menu=await openMenu(page);await hit(menu,false);
   assert.match(await page.locator(toggleSelector).innerText(),/メニュー/);
   assert.equal(await menu.locator('button:visible').count(),3);
   assert.match(await menu.innerText(),currentVersionPattern,'expanded menu displays the current version');
   assert.equal(await version(page).count(),1,'menu is the only visible version label');
   const view=actionItem(page,'view'),audio=actionItem(page,'volume'),reset=actionItem(page,'reset');
   for(const command of [view,audio,reset])await hit(command);
   assert.match(await view.innerText(),/視点/);
   assert.match(await audio.innerText(),/音量/);
   assert.match(await reset.innerText(),/初期化/);
   const beforeView=await page.locator('#poiThirdView').textContent();
   await view.tap();
   await page.waitForFunction(old=>document.querySelector('#poiThirdView').textContent!==old,beforeView);
   await openMenu(page);await audio.tap();
   const mixer=page.locator('#poiSoundPanel');
   await mixer.waitFor({state:'visible'});
   for(const slider of await mixer.locator('input[type="range"]').all())await hit(slider);
   await openMenu(page);await hit(audio);await audio.tap();await mixer.waitFor({state:'hidden'});
   await openMenu(page);await reset.tap();
   const confirm=page.locator('#poiResetGameDialog');
   await confirm.waitFor({state:'visible'});await hit(confirm,false);
   await hit(page.locator('#poiResetGameCancel'));await page.locator('#poiResetGameCancel').tap();
   await confirm.waitFor({state:'hidden'});
   assert.deepEqual(await snapshot(page),baseline,'menus and reset cancel never touch kit/audio/editor saves');
   assert.deepEqual(await gamePosition(page),{x:point.x,z:point.z,level:0},'reset cancel retains position');
   await openMenu(page);
   await page.setViewportSize({width:390,height:740});
   await page.locator('#poiAnalogPad').waitFor({state:'hidden'});
   await page.locator(toggleSelector+'[hidden]').waitFor({state:'attached'});
   assert.equal(await page.locator(toggleSelector).isVisible(),false);
   assert.equal(await menu.isVisible(),false);
   await page.locator('#app > header').waitFor({state:'visible'});
   assert.equal(await page.locator('.poiWalkDpad [data-poi-dir]:visible').count(),4);
   await page.locator('#poiGameTools').waitFor({state:'visible'});
   const portraitAction=await hit(page.locator('#poiWalkAction'));
   assert(Math.abs(portraitAction.x+portraitAction.w/2-195)<20,'portrait action still centered');
   const check=page.locator('#pineCheckMode');
   await check.tap();
   assert.equal(await check.getAttribute('aria-pressed'),'true','portrait can still enable edit markers');
   await page.setViewportSize({width,height});
   await page.locator(toggleSelector).waitFor({state:'visible'});
   assert.equal(await check.getAttribute('aria-pressed'),'false','rotating to play exits edit-mark mode without deleting saved marks');
   await hit(page.locator('#poiAnalogPad'));
   assert.equal(await menu.isVisible(),false,'rotation does not reactivate an old overlay');
   assert.equal(await version(page).count(),0,'version goes away when the menu closes');
   assert.equal(await mixer.isVisible(),false,'rotation does not reactivate old mixer');
   assert.deepEqual(await snapshot(page),baseline,'rotate and inspect does not write saves');
   assert.deepEqual(errors,[]);
  }finally{await ctx.close()}
 }
 console.log('PASS fullscreen landscape touch HUD at 568x320 and 844x390, menu actions, cancel and unchanged portrait/save');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
