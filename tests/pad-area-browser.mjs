import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const html=readFileSync(process.argv[2]||'world-editor.html','utf8');
const anchor='  freeMovementPose:()=>';
assert.equal(html.split(anchor).length,2);
const fixture=html.replace(anchor,`  expandedPadState:()=>({yaw:poiCameraYaw,pitch:poiCameraPitch,contact:!!poiAnalogContact,
   walking:!!poiFreePose?.walking,action:poiWalkActionStarted,weapon:poiEquippedWeapon()}),
`+anchor);
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<!doctype html><title>Seed</title>':fixture)});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const snap=page=>page.evaluate(()=>window.__editorTest.expandedPadState());
const center=box=>({x:Math.round(box.x+box.width/2),y:Math.round(box.y+box.height/2)});
let browser;
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 for(const [width,height] of [[568,320],[844,390],[1120,500]]){
  const ctx=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true});
  try{
   const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(15000);
   await p.goto(origin+'/seed');
   await p.evaluate(()=>{
    localStorage.setItem('world-workshop-hotbar-v1','{"version":1,"weapon":null,"potions":3,"gold":12}');
    localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
     position:{x:108,z:61,y:0,facing:0},townLayout:5,townMapHeight:128,view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:Math.PI,orbitPitch:.35,orbitDistance:5.5}}));
   });
   await p.goto(origin+'/?resume=1&test=1');
   await p.waitForFunction(()=>window.__editorTest?.facility?.().active&&document.querySelector('#viewWrap[data-analog-play]'));
   await p.locator('#pineStartupCover').waitFor({state:'hidden'});
   const bar=await p.locator('#poiHotbar').boundingBox(),pad=await p.locator('#poiAnalogPad').boundingBox();
   const rest=center(await p.locator('#poiAnalogBase').boundingBox());
   const hit=(coord,selector)=>p.evaluate(({coord,selector})=>document.elementFromPoint(coord.x,coord.y)?.closest(selector)?.id??null,{coord,selector});
   const c=await ctx.newCDPSession(p);
   const pt=(x,y,id)=>({x:Math.round(x),y:Math.round(y),id,radiusX:4,radiusY:4,force:.7});
   const touch=(type,touchPoints)=>c.send('Input.dispatchTouchEvent',{type,touchPoints});
   const start=pt(width*.361,bar.y-25,1),moved=pt(start.x,start.y-50,1);
   assert(start.x>pad.x+pad.width+28,'start is outside both old joystick box and 28px extension');
   assert(start.x<width*.39&&start.y<bar.y&&start.y>bar.y-30,'qualifying left start just above shortcuts');
   assert.equal(await hit(start,'#view'),'view','gesture begins on actual camera canvas');
   const before=await snap(p),pose0=await p.evaluate(()=>window.__editorTest.freeMovementPose());
   await touch('touchStart',[start]);await touch('touchMove',[moved]);
   await p.waitForFunction(initial=>{
    const s=window.__editorTest.expandedPadState(),p=window.__editorTest.freeMovementPose();
    return s.contact&&s.walking&&Math.hypot(p.x-initial.x,p.z-initial.z)>.03;
   },pose0);
   assert.deepEqual(center(await p.locator('#poiAnalogBase').boundingBox()),{x:start.x,y:start.y},'floating origin is the actual press position');
   const across=pt(width*.46,moved.y,1);
   await touch('touchMove',[across]);
   const dragged=await snap(p);
   assert(dragged.contact);assert.deepEqual([dragged.yaw,dragged.pitch],[before.yaw,before.pitch],
    'crossing to the right does not transfer an established left touch to camera');

   const orbit=pt(width*.70,height*.43,2);
   assert.equal(await hit(orbit,'#view'),'view','right canvas is available to another thumb');
   await touch('touchStart',[across,orbit]);
   await touch('touchMove',[across,{...orbit,x:orbit.x+44}]);
   await p.waitForFunction(old=>{
    const s=window.__editorTest.expandedPadState();return s.contact&&Math.abs(s.yaw-old)>.12;
   },before.yaw);
   await touch('touchEnd',[]);
   await p.waitForFunction(()=>!window.__editorTest.expandedPadState().contact);
   assert.deepEqual(center(await p.locator('#poiAnalogBase').boundingBox()),rest,'same visible resting anchor and size');

   const socket=p.locator('#poiHotbar [data-hotbar-slot="0"]');
   const hotkey=center(await socket.boundingBox());
   assert.equal(await hit(hotkey,'#poiHotbar'),'poiHotbar');
   await socket.tap();await p.waitForFunction(()=>window.__editorTest.expandedPadState().weapon==='equipWoodSword');

   // Left start before second-finger Attack remains independent as before.
   const left=pt(start.x,start.y,3),attack=center(await p.locator('#poiWalkAction').boundingBox());
   const oldAction=(await snap(p)).action;
   await touch('touchStart',[left]);
   await p.waitForFunction(()=>window.__editorTest.expandedPadState().contact);
   await touch('touchStart',[left,pt(attack.x,attack.y,4)]);await touch('touchEnd',[]);
   await p.waitForFunction(at=>window.__editorTest.expandedPadState().action>at,oldAction);
   assert.deepEqual(errors,[]);
   await c.detach();
  }finally{await ctx.close()}
 }
 console.log('PASS expanded left canvas beside shortcut for 3 phone widths, isolated right orbit, secondary attack, and real shortcuts');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}
