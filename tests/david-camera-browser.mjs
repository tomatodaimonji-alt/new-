import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const src=readFileSync(process.argv[2]??'world-editor.html','utf8');let html=src;
const inject=(a,b)=>{assert.equal(html.split(a).length,2,a);html=html.replace(a,b)};
const hook="if(facilityParams.get('test')==='1')window.__editorTest={";
inject(hook,`
 window.__davidCameraTest={
  live:()=>({at:[poiWalkX,poiWalkZ,poiWalkLevel],yaw:poiCameraYaw,pitch:poiCameraPitch,awake:!!poiDavidActive?.s?.david?.awake,
    third:poiThirdPerson,ready:performance.now()>=poiWalkNextReady,distance:poiCameraDistance,gpu:gl.getError()}),
  setup:(x,z)=>workshopResumeRestorePosition({x,z,y:0,facing:2}),
  frame:()=>render(),
  capture:control=>{
   window.__davidCameraDisable=control;window.__davidCameraCapture=null;
   render();
   return window.__davidCameraCapture;
  },
  limits:()=>{
   const b=facilitySite.davidTemple.boss,positions=facilitySite.davidTemple.resumeSolid.filter(o=>o.type==='poiDavidWallRound'&&o.x===24&&o.z>poiWalkZ);
   const stop=positions[0];if(!stop)return null;
   return {wall:stop.z,walk:poiWalkCanStep(stop.x,stop.z,stop.x,stop.z-1),
    beam:poiDavidLine({x:stop.x,z:stop.z-1,y:0},{x:stop.x,z:stop.z+1,y:0},b)};
  }
 };`+hook);
const arm="  const templeEye=typeof facilityDavidCameraEye==='function'?facilityDavidCameraEye(target,desired):desired;";
inject(arm,"  const templeEye=window.__davidCameraDisable?desired:facilityDavidCameraEye(target,desired);\n window.__davidClipWitness={arm:Math.hypot(...templeEye.map((v,i)=>v-target[i])),raw:Math.hypot(...desired.map((v,i)=>v-target[i])),clipped:templeEye!==desired};");
const frame=' requestAnimationFrame(render);';
inject(frame,' if(!window.__davidCameraManual)requestAnimationFrame(render);');
// Read actual GPU color/depth results after the production render, not a mock geometry pass.
const opaque=' poiDrawHitFlashSpan(poiWalkMesh,vp,0,poiWalkMesh.count,poiHitFlashAmount(poiPlayerHitFlashAt,now));';
inject(opaque,`
 const avatarProbe=window.__davidCameraManual&&window.__davidCameraCapture===null;
 let avatarBefore=null,aw=0,ah=0,ax=0,ay=0;
 if(avatarProbe){
  const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight;
  aw=Math.floor(w*.36);ah=Math.floor(h*.60);ax=Math.floor(w*.32);ay=Math.floor(h*.12);
  avatarBefore=new Uint8Array(aw*ah*4);gl.readPixels(ax,ay,aw,ah,gl.RGBA,gl.UNSIGNED_BYTE,avatarBefore);
 }
 `+opaque+`
 if(avatarBefore){
  const after=new Uint8Array(avatarBefore.length);
  gl.readPixels(ax,ay,aw,ah,gl.RGBA,gl.UNSIGNED_BYTE,after);
  let opacity=0;for(let i=0;i<after.length;i+=4)if(Math.abs(after[i]-avatarBefore[i])+Math.abs(after[i+1]-avatarBefore[i+1])+Math.abs(after[i+2]-avatarBefore[i+2])>16)opacity++;
  window.__davidOpaquePixels=opacity;
 }
 `);
const tail=" if(typeof poiHitstopMarkDrawn==='function')poiHitstopMarkDrawn(performance.now());";
inject(tail,tail+`
 if(window.__davidCameraManual){
  const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,x=Math.floor(w*.16),y=Math.floor(h*.17),cw=Math.floor(w*.68),ch=Math.floor(h*.65),pixels=new Uint8Array(cw*ch*4);
  gl.readPixels(x,y,cw,ch,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
  const bins=new Set();for(let i=0;i<pixels.length;i+=4)bins.add((pixels[i]>>5)+8*(pixels[i+1]>>5)+64*(pixels[i+2]>>5));
  window.__davidCameraCapture={...window.__davidClipWitness,bins:bins.size,opaque:window.__davidOpaquePixels,pixels:Array.from(pixels)};
 }
`);
for(const [,body] of html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(body);
if(process.env.DAVID_CAMERA_PARSE_ONLY){console.log('exact instrumented camera candidate parses');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>Local seed</title>':html)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
let browser,phase='boot';
try{
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const ctx=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:.67});
 const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(15000);
 await p.clock.install({time:new Date('2026-04-01T10:00:00Z')});
 await p.goto(origin+'/seed');await p.evaluate(()=>{
  localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":360000}');
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,position:{x:24,z:91,y:0,facing:2},
   townLayout:5,townMapHeight:128,view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:0,orbitPitch:.14,orbitDistance:5.5}}));
 });
 await p.goto(origin+'/?resume=1&test=1',{waitUntil:'domcontentloaded'});
 await p.locator('#pineStartupCover').waitFor({state:'hidden'});
 await p.waitForFunction(()=>window.__davidCameraTest?.live().third);
 await p.clock.pauseAt(await p.evaluate(()=>Date.now()+1200));
 await p.evaluate(()=>{window.__davidCameraManual=true});
 const get=()=>p.evaluate(()=>window.__davidCameraTest.live());
 const cap=disable=>p.evaluate(disable=>window.__davidCameraTest.capture(disable),disable);
 const walk=async(z)=>{
  await p.keyboard.press('ArrowUp');
  await p.clock.fastForward(230);await p.evaluate(()=>window.__davidCameraTest.frame());
  assert.deepEqual((await get()).at,[24,z,0]);
 };
 phase='old outdoor save and real centered aperture';
 const far=await cap(false);assert(!far.clipped,'normal exterior camera remains unchanged');
 for(const z of [92,93,94,95,96,97,98])await walk(z);
 assert((await get()).awake,'real center gate crossing awakens existing boss');
 phase='actual near-side movement then original camera-facing input';
 assert(await p.evaluate(()=>window.__davidCameraTest.setup(24,116)));
 await walk(117);await walk(118);
 const inwardArm=await cap(false);
 assert(!inwardArm.clipped,'view from the inner side of the ring keeps original distance');
 const cdp=await ctx.newCDPSession(p);
 const from={x:640,y:132,id:7},dest={...from,x:247};
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[from]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[dest]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 const real=await get();
 assert(Math.abs(real.yaw-Math.PI)<.08&&real.awake&&real.third,'real right-side camera drag points behind the wall');
 phase='same-frame blocked and corrected GPU color plus unchanged solid wall';
 const limitsBefore=await p.evaluate(()=>window.__davidCameraTest.limits());
 const blocked=await cap(true),safe=await cap(false);
 const limitsAfter=await p.evaluate(()=>window.__davidCameraTest.limits());
 assert.deepEqual(limitsAfter,limitsBefore);
 assert(limitsAfter&&!limitsAfter.walk&&!limitsAfter.beam,'physical stone and beam blocking still on');
 assert(blocked&&!blocked.clipped&&safe?.clipped&&safe.arm<blocked.arm-.5);
 assert(safe.pixels.length===blocked.pixels.length&&safe.pixels.length>10000);
 let different=0;
 for(let i=0;i<safe.pixels.length;i+=4)
  if(Math.abs(safe.pixels[i]-blocked.pixels[i])+Math.abs(safe.pixels[i+1]-blocked.pixels[i+1])+Math.abs(safe.pixels[i+2]-blocked.pixels[i+2])>36)different++;
 const ratio=different/(safe.pixels.length/4);
 assert(ratio>.30&&safe.bins>blocked.bins,'large actual scene region recovers more than the legacy small dither hole');
 phase='inside the authored entrance wing, exterior remains intact';
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...from,x:370,id:8}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...from,x:763,id:8}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 assert(Math.abs((await get()).yaw)<.08,'trusted camera drag returns to the actual wing-facing bearing, starts outside joystick zone');
 assert(await p.evaluate(()=>window.__davidCameraTest.setup(29,95)));
 await p.clock.fastForward(230);await p.evaluate(()=>window.__davidCameraTest.frame());
 const wingBefore=await cap(true),wingAfter=await cap(false);
 assert(!wingBefore.clipped&&wingAfter.clipped&&wingAfter.arm<wingBefore.arm-.5,
  'same real input clamps the view clear of the solid authored entrance wing');
 assert(wingAfter.opaque>100&&wingAfter.opaque>wingBefore.opaque+80,'real wing correction uncovers the opaque avatar, not merely the old stipple silhouette: '+JSON.stringify([wingBefore.opaque,wingAfter.opaque]));
 console.log('Actual entrance wing camera framebuffer',JSON.stringify({blocked:wingBefore.arm,safe:wingAfter.arm,bins:[wingBefore.bins,wingAfter.bins],opaque:[wingBefore.opaque,wingAfter.opaque]}));
 assert.deepEqual(errors,[]);assert.equal((await get()).gpu,0);
 console.log('Real temple wall camera framebuffer',JSON.stringify({blocked:{arm:blocked.arm,bins:blocked.bins},safe:{arm:safe.arm,bins:safe.bins},ratio,limitsAfter}));
} catch(e){console.error('David camera native:',phase);throw e}
finally{await browser?.close();await new Promise(r=>server.close(r))}
