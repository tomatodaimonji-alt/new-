import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync} from 'node:fs';
import {Script} from 'node:vm';
const revised=readFileSync(process.argv[2]??'world-editor.html','utf8'),
 old=process.argv[3]?readFileSync(process.argv[3],'utf8'):null;
for(const [,s] of revised.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(s);
if(old)assert.equal(old.slice(old.indexOf('</style>')),revised.slice(revised.indexOf('</style>')),'HTML and all map/game input logic match the before release exactly');
if(process.env.MAP_SHELL_SYNTAX_ONLY==='1'){console.log('Shell-only map change, actual source parses');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url==='/seed'?'<title>Local map shell QA</title>':req.url.startsWith('/before')?old:revised);
});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const url='http://127.0.0.1:'+server.address().port;let browser,phase='boot';
const out=process.env.FACILITY_SCREENSHOTS;
if(out)mkdirSync(out,{recursive:true});
const full={width:844,height:390};
const hash=s=>createHash('sha256').update(s).digest('hex');
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 async function open(which){
  const c=await browser.newContext({viewport:full,isMobile:true,hasTouch:true,deviceScaleFactor:1}),
   p=await c.newPage(),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.goto(url+'/seed');
  await p.evaluate(()=>{
   localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":360000}');
   localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,position:{x:24,z:125,y:0,facing:2},
    townLayout:5,townMapHeight:182,templeDepth:1,view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:0,orbitPitch:.12,orbitDistance:6.5}}));
  });
  await p.goto(url+'/'+which+'?resume=1&test=1',{waitUntil:'domcontentloaded',timeout:45000});
  await p.waitForFunction(()=>window.pineStartup?.ready||window.pineStartup?.failed,null,{polling:120,timeout:45000});
  assert(await p.evaluate(()=>window.pineStartup.ready),JSON.stringify(errors));
  await p.evaluate(()=>document.fonts.ready);
  const dialog=p.locator('#poiLocalMapDialog');
  const snapshot=()=>p.evaluate(()=>{
   const node=id=>document.getElementById(id),r=id=>node(id).getBoundingClientRect().toJSON();
   const dialog=node('poiLocalMapDialog'),cv=node('poiLocalMapLarge'),ctx=cv.getContext('2d'),state=window.__editorTest.facility(),rect=r('poiLocalMapDialog');
   // Compare the actual color of every tile, away from possible font/arrow
   // antialias. The before/after renders at matched zoom still compare all PNG bytes.
   const raw=ctx.getImageData(0,0,cv.width,cv.height).data,samples=[];
   for(let z=0;z<41;z++)for(let x=0;x<41;x++){
    if(z===0&&x>=39||Math.abs(x-20)<=1&&Math.abs(z-20)<=1)continue;
    const i=(Math.floor((z+.5)*cv.height/41)*cv.width+Math.floor((x+.5)*cv.width/41))*4;
    samples.push(raw[i],raw[i+1],raw[i+2],raw[i+3]);
   }
   return {d:rect,c:r('poiLocalMapLarge'),head:r('poiLocalMapHeader'),zoom:r('poiLocalMapControls'),close:r('poiLocalMapClose'),
    bg:getComputedStyle(dialog).backgroundColor,ref:getComputedStyle(node('poiLocationPanel')).backgroundColor,
    scrim:getComputedStyle(dialog,'::backdrop').backgroundColor,cv:[cv.width,cv.height],
    focus:document.activeElement?.id,pos:state.position,frame:state.miniMap,
    corner:Array.from(ctx.getImageData(5,32,1,1).data),samples,raster:cv.toDataURL()};
  });
  await p.locator('#poiMiniOpen').tap();await dialog.waitFor({state:'visible'});
  return {c,p,errors,dialog,snapshot};
 }
 let before,oldZoom,oldReset;
 if(old){
  phase='before screenshot of the exact released WebGL map';
  const q=await open('before');before=await q.snapshot();
  assert.deepEqual(before.pos,{x:24,z:125,level:0});
  assert(before.d.width<before.d.height,'the old ordinary landscape shell was tall');
  if(out)await q.p.screenshot({path:out+'/expanded-map-before.png'});
  await q.p.locator('#poiLocalMapZoomIn').tap();oldZoom=await q.snapshot();
  await q.p.locator('#poiLocalMapZoomOut').tap();oldReset=await q.snapshot();
  assert.deepEqual(q.errors,[]);await q.c.close();
 }
 phase='ordinary landscape same geographic sample and matching glass';
 const q=await open('after'),s=await q.snapshot(),{p}=q;
 const eq=(l,r)=>assert(Math.abs(l-r)<1,JSON.stringify([l,r]));
 const square=(s,w,h)=>{
  eq(s.c.width,s.c.height);assert.deepEqual(s.cv,[492,492]);
  assert(s.d.left>=7&&s.d.top>=6&&s.d.right<=w-7&&s.d.bottom<=h-6);
  assert(s.c.left>s.d.left&&s.c.top>s.d.top&&s.c.right<s.d.right&&s.c.bottom<s.d.bottom);
 };
 const land=(s,w,h)=>{
  square(s,w,h);assert(s.d.width/s.d.height>1.24);
  for(const node of [s.head,s.zoom,s.close])assert(node.left>=s.c.right+9&&node.right<s.d.right&&node.bottom<s.d.bottom);
  assert(s.head.bottom<s.zoom.top);
 };
 land(s,844,390);
 assert.equal(s.bg,s.ref);assert.match(s.bg,/0\.54\)/);assert.match(s.scrim,/0\.32\)/);
 assert.equal(s.focus,'poiLocalMapClose');assert.equal(await p.locator('#poiLocalMapTitle').innerText(),'周辺地図');
 assert.deepEqual(s.corner,[0,0,0,255]);assert(s.frame.local.known>2);
 assert.equal(s.frame.local.crop.x2-s.frame.local.crop.x1+1,41);assert.equal(s.frame.local.crop.z2-s.frame.local.crop.z1+1,41);
 if(before){assert.deepEqual(s.frame.overlay,before.frame.overlay);assert.equal(hash(s.raster),hash(before.raster),'identical actual 41×41 raster to the released game');}
 if(out)await p.screenshot({path:out+'/expanded-map-after.png'});
 await p.locator('#poiLocalMapZoomIn').tap();const zoom=await q.snapshot();
 assert.equal(zoom.frame.overlay.view.zoom,2);
 if(oldZoom){assert.deepEqual(zoom.frame.overlay,oldZoom.frame.overlay);assert.equal(hash(zoom.raster),hash(oldZoom.raster));}
 await p.locator('#poiLocalMapZoomOut').tap();const reset=await q.snapshot();
 assert.deepEqual(reset.frame.overlay,s.frame.overlay);
 assert.deepEqual(reset.samples,oldReset?.samples??s.samples);
 phase='genuine touch pinch, same frozen geographic bounds and no gameplay movement';
 const a=await p.locator('#poiLocalMapLarge').boundingBox(),cdp=await q.c.newCDPSession(p);
 const point=(id,x,y)=>({id,x:a.x+a.width*x,y:a.y+a.height*y});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(1,.42,.52),point(2,.58,.52)]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point(1,.16,.52),point(2,.84,.52)]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 let v=await q.snapshot();
 assert.equal(v.frame.overlay.view.zoom,4);assert.deepEqual(v.frame.overlay.crop,s.frame.overlay.crop);
 await p.keyboard.press('ArrowRight');v=await q.snapshot();
 assert.deepEqual(v.pos,s.pos);assert(v.frame.overlay.visible.x2<=s.frame.overlay.crop.x2+1);
 await cdp.detach();
 await p.locator('#poiLocalMapZoomOut').tap();await p.locator('#poiLocalMapZoomOut').tap();
 assert.deepEqual((await q.snapshot()).samples,s.samples);
 phase='short landscape, portrait fallback and original touch close';
 await p.setViewportSize({width:568,height:320});const narrow=await q.snapshot();land(narrow,568,320);
 assert.deepEqual(narrow.samples,s.samples);
 if(out)await p.screenshot({path:out+'/expanded-map-after-narrow.png'});
 await p.setViewportSize({width:390,height:844});const portrait=await q.snapshot();square(portrait,390,844);
 assert(portrait.head.bottom<portrait.c.top&&portrait.zoom.top>portrait.c.bottom);
 assert.deepEqual(portrait.samples,s.samples);
 await p.locator('#poiLocalMapClose').tap();await q.dialog.waitFor({state:'hidden'});
 await p.locator('#poiMiniOpen').tap();await q.dialog.waitFor({state:'visible'});
 await p.keyboard.press('Escape');await q.dialog.waitFor({state:'hidden'});
 assert.deepEqual(q.errors,[]);await q.c.close();
 console.log('Native same WebGL map bytes, true landscape glass frame, real zoom/pinch/close, and intact narrow/portrait layout.');
}catch(e){console.error(phase);throw e}
finally{await browser?.close();await new Promise(r=>server.close(r))}
