import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
let h=readFileSync(process.argv[2]??'world-editor.html','utf8');
function inject(a,b){assert.equal(h.split(a).length,2,a);h=h.replace(a,b)}
const opt="if(facilityParams.get('test')==='1')window.__editorTest={";
inject(opt,opt+`
 localMapQA:{
  frame:()=>render(),
  read:()=>({pos:[poiWalkX,poiWalkZ,poiWalkLevel],swing:poiWalkActionStarted,mini:poiMiniSnapshot(),
   bounds:facilitySite.davidTemple.entrance,deep:facilitySite.map.height,seen:poiHotbarRead().sacredTempleSeen===true,
   dialog:poiLocalModalOpen(),focus:document.activeElement?.id,site:facilitySite.id,
   active:poiWalkActive,scope:poiLocalFrame?.scope}),
  tile:(x,z)=>{
   const f=poiLocalFrame,c=$('poiMiniMap'),r=f.crop,b=r.x2-r.x1+1;
   if(x<r.x1||x>r.x2||z<r.z1||z>r.z2)return null;
   const px=Math.floor((c.width-c.height)/2+(x-r.x1+.5)*c.height/b),pz=Math.floor((z-r.z1+.5)*c.height/b);
   const bits=poiLocalSurveys?.get(f.scope);
   return {known:poiLocalKnown(bits,x,z),resolved:f.cells[(z-r.z1)*b+x-r.x1],
     rgba:Array.from(c.getContext('2d').getImageData(px,pz,1,1).data)};
  },
  screen:(x,z)=>Array.from($('poiLocalMapLarge').getContext('2d').getImageData(x,z,1,1).data),
 },
`);
inject(' requestAnimationFrame(render);',' if(!window.__localManual)requestAnimationFrame(render);');
for(const [,js] of h.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(js);
if(process.env.LOCAL_MINIMAP_SYNTAX_ONLY){console.log('Local map native fixture exact source/injected syntax');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const svc=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>Local Map QA</title>':h)});
await new Promise((ok,fail)=>svc.listen(0,'127.0.0.1',ok).once('error',fail));
const url='http://127.0.0.1:'+svc.address().port;
let browser,c,p,phase='boot',errors=[];
const display={viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:1};
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 c=await browser.newContext(display);p=await c.newPage();p.setDefaultTimeout(28000);
 await p.goto(url+'/seed');
 await p.evaluate(()=>{
  localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":360000}');
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,position:{x:24,z:125,y:0,facing:2},
    townLayout:5,townMapHeight:182,templeDepth:1,view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:0,orbitPitch:.12,orbitDistance:6.5}}));
 });
 async function open(){
  p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(28000);
  await p.goto(url+'/?resume=1&test=1',{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>window.pineStartup?.ready||window.pineStartup?.failed,null,{polling:120,timeout:45000});
  assert(await p.evaluate(()=>window.pineStartup.ready),JSON.stringify(errors));
  await p.waitForFunction(()=>window.__editorTest?.localMapQA.read()?.mini?.local,null,{polling:120});
  await p.clock.install({time:new Date('2026-04-01T10:00:00Z')});
  await p.clock.pauseAt((await p.evaluate(()=>Date.now()))+1500);await p.evaluate(()=>window.__localManual=true);
 }
 await open();
 const read=()=>p.evaluate(()=>window.__editorTest.localMapQA.read());
 const frame=async(ms=230)=>{await p.clock.fastForward(ms);await p.evaluate(()=>window.__editorTest.localMapQA.frame());return read()};
 const step=async(key,x,z)=>{await p.keyboard.press(key);const q=await frame();assert.deepEqual(q.pos,[x,z,0],JSON.stringify(q));return q};
 const tile=(x,z)=>p.evaluate(([x,z])=>window.__editorTest.localMapQA.tile(x,z),[x,z]);
 const large=(x,z)=>p.evaluate(([x,z])=>window.__editorTest.localMapQA.screen(x,z),[x,z]);
 const black=[0,0,0,255];
 let s=await frame(),m=s.mini,bounds=m.local.crop,swing=s.swing;
 assert.equal(s.deep,182);assert(!s.seen);assert.deepEqual(bounds,{x1:4,z1:105,x2:44,z2:145});
 assert.equal(s.scope,'base:0:surface');
 assert((await tile(24,124)).known);assert.notDeepEqual((await tile(24,124)).rgba,black);
 assert.deepEqual((await tile(9,140)).rgba,black);
 assert.equal((await tile(24,s.bounds.z)).resolved,0,'the hidden temple does not become a HUD landmark from the approach');
 phase='real touch opens same map crop, zoom and pan never extend its source';
 await p.locator('#poiMiniOpen').tap();s=await read();assert(s.dialog);assert.deepEqual(s.mini.overlay.crop,bounds);
 assert.equal(s.focus,'poiLocalMapClose');assert.deepEqual(await large(5,5),black);
 await p.locator('#poiLocalMapZoomIn').tap();s=await read();assert.equal(s.mini.overlay.view.zoom,2);
 await p.locator('#poiLocalMapZoomIn').tap();s=await read();assert.equal(s.mini.overlay.view.zoom,4);
 for(let i=0;i<10;i++){await p.keyboard.press('ArrowRight');await p.keyboard.press('ArrowDown')}
 s=await read();assert.deepEqual(s.pos,[24,125,0]);assert.equal(s.swing,swing);
 assert.deepEqual(s.mini.overlay.crop,bounds);
 assert.deepEqual(s.mini.overlay.visible,{x1:34.75,z1:135.75,x2:45,z2:146});
 assert.deepEqual(await large(123,123),black);
 await p.locator('#poiLocalMapZoomOut').tap();await p.locator('#poiLocalMapZoomOut').tap();s=await read();
 assert.equal(s.mini.overlay.view.zoom,1);
 assert.deepEqual(s.mini.overlay.visible,{x1:4,z1:105,x2:45,z2:146});
 const cdp=await c.newCDPSession(p),r=await p.locator('#poiLocalMapLarge').boundingBox();
 const point=(id,x,z)=>({id,x:r.x+r.width*x,y:r.y+r.height*z});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(1,.42,.53),point(2,.58,.53)]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point(1,.16,.53),point(2,.84,.53)]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 s=await read();assert.equal(s.mini.overlay.view.zoom,4,'real two-finger pinch increases cost-free display scale');
 assert.deepEqual(s.mini.overlay.crop,bounds);await cdp.detach();
 await p.locator('#poiLocalMapClose').tap();await p.clock.fastForward(36);
 assert(!(await read()).dialog);
 phase='actual walk, gate arrival, side-wall shading and delayed survey save';
 const builds=m.topologyBuilds;
 for(const z of [126,127]){s=await step('ArrowUp',24,z);assert.deepEqual(s.mini.local.crop,{x1:4,z1:z-20,x2:44,z2:z+20});}
 assert.equal(s.mini.topologyBuilds,builds);
 for(let z=128;z<=140;z++)s=await step('ArrowUp',24,z);
 assert(s.seen);assert.equal(s.mini.topologyBuilds,builds+1);
 assert((await tile(24,137)).known);
 assert(!(await tile(30,139)).known,'the survey stopped at the real sealed passage walls');
 assert.deepEqual((await tile(30,139)).rgba,black);
 assert((await tile(24,124)).known,'a visited stretch remains charted outside the current sight radius');
 await frame(2110);
 const survey=await p.evaluate(()=>localStorage.getItem('world-workshop-map-survey-v1'));
 assert(survey?.length>1000&&survey.length<4200);
 phase='cold WebGL page restores prior footprints but not unexplored regions';
 const saved=await c.storageState();await c.close();c=await browser.newContext({...display,storageState:saved});p=await c.newPage();await open();
 s=await frame();assert.deepEqual(s.pos,[24,140,0]);assert(s.seen);
 assert((await tile(24,124)).known);assert(!(await tile(37,142)).known);
 assert.deepEqual((await tile(37,142)).rgba,black);assert.deepEqual(errors,[]);
 console.log('Native fixed HUD crop/black pixels, frozen geographic range through zoom & pan, real covered walk, no topology rebuild per stride, and cold persistent survey.');
}catch(e){console.error(phase,errors);throw e}
finally{await browser?.close();await new Promise(ok=>svc.close(ok))}
