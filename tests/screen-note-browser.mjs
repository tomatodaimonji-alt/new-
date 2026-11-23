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
 res.setHeader('Cache-Control','no-store');
 res.end(req.url==='/seed'?'<!doctype html><title>Isolated screen note fixture</title>':fixture);
});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const origin='http://127.0.0.1:'+server.address().port;
const point={x:102,z:93,y:0,facing:2};
const key='world-workshop-resume-v1';
const protectedSaves={
 'forest-world-editor-v1':'{"format":"forest-world-v1","version":1,"width":30,"height":30,"size":30,"world":[],"models":[],"prefabs":[],"terrainHeights":[],"checks":[]}',
 'world-workshop-hotbar-v1':'{"version":1,"weapon":"equipWoodSword","potions":2,"gold":18,"claimedCaches":["glade"]}',
 'world-workshop-audio-v2':'{"master":70,"bgm":40,"se":50,"enabled":true}'
};
const game=page=>page.evaluate(()=>{const f=window.__editorTest.facility();return {position:f.position,actionAt:f.combat.actionAt}});
const snapshot=page=>page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),Object.keys(protectedSaves));
const pixels=loc=>loc.evaluate(el=>{
 const ctx=el.getContext('2d'),image=ctx.getImageData(0,0,el.width,el.height).data;
 let opaque=0,blue=0,leftBlue=0,rightBlue=0;const tones=new Set();
 for(let i=0;i<image.length;i+=4){
  if(i%68===0&&image[i+3]>80)tones.add((image[i]<<16)|(image[i+1]<<8)|image[i+2]);
  if(image[i+3]>80)opaque++;
  if(image[i+3]>130&&image[i+2]>image[i+1]+25&&image[i+2]>image[i]+45){
   blue++;if((i/4)%el.width<el.width*.44)leftBlue++;else rightBlue++;
  }
 }
 return {opaque,blue,leftBlue,rightBlue,tones:tones.size};
});
async function note(page){
 await page.locator('#poiLandscapeMenuToggle').tap();
 await page.locator('[data-landscape-action="note"]').tap();
 await page.locator('#viewWrap[data-screen-note="edit"]').waitFor();
}
let browser,context;
try{
 browser=await chromium.launch({headless:true,
  ...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 context=await browser.newContext({viewport:{width:740,height:390},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.setDefaultTimeout(15000);
 await page.goto(origin+'/seed');
 await page.evaluate(({key,point,protectedSaves})=>{
  for(const [k,v] of Object.entries(protectedSaves))localStorage.setItem(k,v);
  localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":330000}');
  localStorage.setItem(key,JSON.stringify({version:1,route:'facility',id:'base',play:true,position:point,townLayout:5,townMapHeight:128,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 },{key,point,protectedSaves});
 await page.goto(origin+'/?resume=1&test=1');
 await page.waitForFunction(()=>window.__editorTest?.facility?.()?.active);
 const before=await game(page),saved=await snapshot(page);
 const action=await page.locator('#poiWalkAction').boundingBox();
 assert.equal(await page.locator('#poiScreenNoteLayer').isVisible(),false);
 await note(page);
 const ink=page.locator('#poiScreenNoteInk'),still=page.locator('#poiScreenNoteStill');
 const tool=k=>page.locator('button[data-screen-note="'+k+'"]');
 const frozen=await pixels(still);
 assert(frozen.opaque>10000&&frozen.tones>12,'still contains the rendered 3D scene, not a blank opaque frame');
 assert.equal((await pixels(ink)).opaque,0);
 assert(await tool('undo').isDisabled());
 const viewport=await ink.boundingBox();
 assert(viewport&&viewport.x<2&&viewport.y<2&&viewport.width>=739&&viewport.height>=389);
 const cdp=await context.newCDPSession(page);
 const pointAt=(x,y)=>({x:Math.round(x),y:Math.round(y),id:1,radiusX:4,radiusY:4,force:.58});
 const send=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
 async function stroke(fractions){
  const pts=fractions.map(([x,y])=>pointAt(viewport.x+x*viewport.width,viewport.y+y*viewport.height));
  await send('touchStart',[pts[0]]);
  for(const p of pts.slice(1))await send('touchMove',[p]);
  await send('touchEnd',[]);
 }
 await stroke([[.22,.22],[.26,.27],[.30,.26],[.35,.35],[.41,.22]]);
 await tool('undo').waitFor();
 assert.equal(await tool('undo').isDisabled(),false,'pointerup completed the first stroke');
 const first=await pixels(ink);
 assert(first.leftBlue>100&&first.rightBlue===0,'real touch makes a dark blue ballpoint-like trace in its original region');
 await stroke([[.47,.47],[.50,.63],[.57,.52],[.62,.59],[.66,.52]]);
 assert((await pixels(ink)).rightBlue>50,'second stroke has separately visible ink');
 await tool('undo').tap();
 const remaining=await pixels(ink);
 assert.equal(remaining.rightBlue,0,'undo completely erases the most recent stroke');
 assert(remaining.leftBlue>first.leftBlue*.85,'undo retains the first visible stroke after canvas replay');
 await tool('done').tap();
 await page.locator('#viewWrap[data-screen-note="present"]').waitFor();
 assert.equal(await page.locator('#poiScreenNoteTools').isVisible(),false);
 assert.equal((await pixels(ink)).blue,remaining.blue,'done keeps the writing on the displayed scene');
 // Physical click at the normal action center and a keyboard walk do not leak through.
 await page.touchscreen.tap(action.x+action.width/2,action.y+action.height/2);
 await page.keyboard.press('ArrowDown');
 await page.waitForTimeout(500);
 assert.deepEqual(await game(page),before,'no walking or attack while inspecting the annotated screenshot');
 assert.deepEqual(await snapshot(page),saved,'notes and their controls do not write game/audio/world saves');
 await note(page);
 assert.equal((await pixels(ink)).blue,remaining.blue,'reopening from Menu retains the same sheet');
 await tool('clear').tap();
 assert.equal((await pixels(ink)).opaque,0,'clear affects only the temporary annotation');
 assert(await tool('undo').isDisabled());
 await tool('close').tap();
 await page.locator('#poiScreenNoteLayer').waitFor({state:'hidden'});
 assert.deepEqual(await game(page),before);
 await note(page);
 await stroke([[.30,.32],[.36,.43],[.43,.34]]);
 assert((await pixels(ink)).blue>30);
 await page.setViewportSize({width:390,height:740});
 await page.locator('#poiAnalogPad').waitFor({state:'hidden'});
 await page.locator('#poiScreenNoteLayer[hidden]').waitFor({state:'attached'});
 assert.equal(await page.locator('#poiScreenNoteLayer').isVisible(),false);
 assert.equal(await page.locator('#poiLandscapeMenuToggle').isVisible(),false);
 assert.equal(await page.locator('.poiWalkDpad [data-poi-dir]:visible').count(),4);
 await page.setViewportSize({width:740,height:390});
 await page.locator('#poiLandscapeMenuToggle').waitFor({state:'visible'});
 await note(page);
 assert.equal((await pixels(ink)).opaque,0,'a landscape note never leaks to another orientation or session');
 assert.deepEqual(await snapshot(page),saved);
 assert.deepEqual(errors,[]);
 console.log('PASS real touch screenshot notes: rendered still, ink, undo, completion/reopen, gesture and key isolation, clear and portrait');
}finally{await context?.close();await browser?.close();await new Promise(r=>server.close(r))}
