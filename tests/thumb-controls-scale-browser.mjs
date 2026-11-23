import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const html=readFileSync(process.argv[2]||'world-editor.html','utf8');
const anchor='  freeMovementPose:()=>';
assert.equal(html.split(anchor).length,2);
const fixture=html.replace(anchor,`  thumbState:()=>({aim:poiCameraYaw,pitch:poiCameraPitch,panX,panZ,walking:!!poiFreePose?.walking,contact:!!poiAnalogContact,actionAt:poiWalkActionStarted}),
`+anchor);
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<!doctype html><title>Seed</title>':fixture)});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const snap=page=>page.evaluate(()=>window.__editorTest.thumbState());
const camera=state=>[state.aim,state.pitch]; // Pan follows the player by design; stick may not change orbit angles.
const controls=['#poiWalkAction','#poiAnalogBase','#poiAnalogKnob','#poiAnalogPad','#poiBagToggle','#poiHotbar'];
function measure(page,prior=false){
 return page.evaluate(({controls,prior})=>{
  const style=[...document.querySelectorAll('style')].find(el=>el.textContent.includes('/* BEGIN LARGE LANDSCAPE THUMB CONTROLS */'));
  const original=style?.textContent;
  if(prior&&style)style.textContent=original.replace(/\/\* BEGIN LARGE LANDSCAPE THUMB CONTROLS \*\/[\s\S]*?\/\* END LARGE LANDSCAPE THUMB CONTROLS \*\//,'');
  const b=controls.map(q=>{
   const {x,y,width:w,height:h,right,bottom}=document.querySelector(q).getBoundingClientRect();
   return {x,y,w,h,right,bottom,cx:x+w/2,cy:y+h/2};
  });
  if(prior&&style)style.textContent=original;
  return b;
 },{controls,prior});
}
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
   // The startup overlay still owns hit testing after the game marks play active.
   await p.locator('#pineStartupCover').waitFor({state:'hidden'});
   assert.equal(await p.evaluate(()=>window.pineStartup.loading),false);
   const [action,ring,knob,pad,bag,hotbar]=await measure(p);
   const [oldAction,oldRing,oldKnob,oldPad]=await measure(p,true);
   for(const [next,prior] of [[action,oldAction],[ring,oldRing],[knob,oldKnob]]){
    assert(Math.abs(next.w/prior.w-1.3)<.026,'about 30% larger '+JSON.stringify({width,next,prior}));
    assert.equal(next.h,next.w);
   }
   assert(Math.abs(action.cx-oldAction.cx)<3&&Math.abs(action.cy-oldAction.cy)<3,'same usable right thumb center');
   assert(Math.abs(ring.cx-oldRing.cx)<10&&Math.abs(ring.cy-oldRing.cy)<10,'same usable left thumb center');
   for(const rect of [action,ring,bag,hotbar])assert(rect.x>=-1&&rect.y>=-1&&rect.right<=width+1&&rect.bottom<=height+1);
   const apart=(a,b)=>a.right+3<=b.x||b.right+3<=a.x||a.bottom+3<=b.y||b.bottom+3<=a.y;
   assert(apart(bag,hotbar)&&apart(action,hotbar)&&apart(ring,hotbar)&&bag.right+6<=action.x,
    'attack, present bag, base and hotbar may not obstruct each other '+JSON.stringify({width,action,ring,bag,hotbar}));
   const hit=(x,y)=>p.evaluate(({x,y})=>document.elementFromPoint(x,y)?.closest('#poiAnalogPad,#poiWalkAction,#poiBagToggle,#poiHotbar,#view')?.id,{x,y});
   for(const [rect,id] of [[action,'poiWalkAction'],[bag,'poiBagToggle']])assert.equal(await hit(rect.cx,rect.cy),id);
   const hotkeys=p.locator('#poiHotbar button[data-hotbar-slot]:visible');
   assert.equal(await hotkeys.count(),9,'all nine real shortcut targets are visible');
   for(const el of await hotkeys.all()){
    const b=await el.boundingBox();assert.equal(await hit(b.x+b.width/2,b.y+b.height/2),'poiHotbar');
   }

   const c=await ctx.newCDPSession(p);
   const pt=(x,y,id)=>({x:Math.round(x),y:Math.round(y),id,radiusX:4,radiusY:4,force:.7});
   const touch=(type,touchPoints)=>c.send('Input.dispatchTouchEvent',{type,touchPoints});
   const start=pt(oldPad.right+14,ring.cy,1),moved={...start,y:start.y-50};
   assert(start.x>oldPad.right,'touch actually starts outside previous joystick rectangle');
   assert.equal(await hit(start.x,start.y),'poiAnalogPad','new lower-left band owns actual pointer');
   const before=await snap(p),pose0=await p.evaluate(()=>window.__editorTest.freeMovementPose());
   await touch('touchStart',[start]);await touch('touchMove',[moved]);
   await p.waitForFunction(initial=>{
    const s=window.__editorTest.thumbState(),p=window.__editorTest.freeMovementPose();
    return s.contact&&s.walking&&Math.hypot(p.x-initial.x,p.z-initial.z)>.03;
   },pose0);
   assert.deepEqual(camera(await snap(p)),camera(before),'left thumb expanded-start moves without camera motion');
   const attack=pt(action.cx,action.cy,2);
   await touch('touchStart',[moved,attack]);await touch('touchEnd',[]);
   await p.waitForFunction(x=>window.__editorTest.thumbState().actionAt>x,before.actionAt);

   // Center/right canvas remains available for camera movement after release.
   const orbit=pt(width*.68,height*.5,3);
   assert.equal(await hit(orbit.x,orbit.y),'view');
   const priorOrbit=(await snap(p)).aim;
   await touch('touchStart',[orbit]);await touch('touchMove',[{...orbit,x:orbit.x+38}]);await touch('touchEnd',[]);
   await p.waitForFunction(yaw=>Math.abs(window.__editorTest.thumbState().aim-yaw)>.04,priorOrbit);
   assert.equal((await snap(p)).contact,false);
   await c.detach();
   if(width===568){
    await p.setViewportSize({width:390,height:740});
    await p.locator('#viewWrap:not([data-analog-play])').waitFor({state:'attached'});
    const [portraitAction]=await measure(p),[oldPortrait]=await measure(p,true);
    assert.deepEqual(portraitAction,oldPortrait,'portrait controls untouched');
    assert.equal(await p.locator('.poiWalkDpad [data-poi-dir]:visible').count(),4);
   }
   assert.deepEqual(errors,[]);
  }finally{await ctx.close()}
 }
 console.log('PASS larger landscape thumb bounds and actual touch outside the old joystick, stable camera, secondary attack and untouched portrait');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}
