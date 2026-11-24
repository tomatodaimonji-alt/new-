import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync} from 'node:fs';
import {Script} from 'node:vm';
let h=readFileSync(process.argv[2]??'world-editor.html','utf8');
const key="if(facilityParams.get('test')==='1')window.__editorTest={";
assert.equal(h.split(key).length,2);
h=h.replace(key,key+`
 wideHudQA:()=>{
  const f=poiLocalFrame,cv=$('poiMiniMap'),r=el=>el.getBoundingClientRect().toJSON(),
   m=poiLocalHudMetrics(cv.clientWidth,cv.clientHeight,cv.height),ctx=cv.getContext('2d');
  const pixel=(x,z)=>{
   const px=Math.floor(m.shift+(x-f.crop.x1+.5)*m.scale),pz=Math.floor((z-f.crop.z1+.5)*m.scale);
   return [...ctx.getImageData(px,pz,1,1).data];
  };
  return {bounds:r(cv),button:r($('poiMiniOpen')),area:r($('poiLocationPanel')),
   clock:r($('poiClockHud')),party:r($('poiPartyCards')),g:m,
   known:pixel(46,125),unknown:pixel(47,125),tile:typeof f.tile==='function'?f.tile(46,125):null,
   hasUnknown:poiLocalKnown(poiLocalSurveys?.get(f.scope),47,125),state:poiMiniSnapshot(),
   center:pixel(poiWalkX,poiWalkZ),expanded:[$('poiLocalMapLarge').width,$('poiLocalMapLarge').height]};
 },
`);
for(const [,s] of h.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(s);
if(process.env.MINI_MAP_WIDE_SYNTAX_ONLY){console.log('Wider HUD native probe exact source syntax');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>Wider HUD QA</title>':h);
});
await new Promise((r,j)=>server.listen(0,'127.0.0.1',r).once('error',j));
const url='http://127.0.0.1:'+server.address().port;let browser,phase='boot',last;
const out=process.env.FACILITY_SCREENSHOTS;if(out)mkdirSync(out,{recursive:true});
const black=[0,0,0,255];
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const c=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:1});
 const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(url+'/seed');
 await p.evaluate(()=>{
  // Emulate a saved previously walked tile just beyond the central square.
  const bits=new Uint8Array(128*182/8),i=125*128+46;bits[i>>3]|=1<<(i&7);
  localStorage.setItem('world-workshop-map-survey-v1',JSON.stringify({version:1,scopes:{'base:0:surface':btoa(String.fromCharCode(...bits))}}));
  localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":360000}');
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,position:{x:24,z:125,y:0,facing:2},
   townLayout:5,townMapHeight:182,templeDepth:1,view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:0,orbitPitch:.12,orbitDistance:6.5}}));
 });
 await p.goto(url+'/?resume=1&test=1',{waitUntil:'domcontentloaded',timeout:45000});
 await p.waitForFunction(()=>window.pineStartup?.ready||window.pineStartup?.failed,null,{polling:120,timeout:45000});
 assert(await p.evaluate(()=>window.pineStartup.ready),JSON.stringify(errors));
 await p.evaluate(()=>document.fonts.ready);
 const inspect=async()=>last=await p.evaluate(()=>window.__editorTest.wideHudQA());
 function verify(s,w,h){
  assert(Math.abs(s.bounds.width-s.area.width)<.5&&Math.abs(s.bounds.right-s.area.right)<.5);
  assert(Math.abs(s.bounds.height-Math.min(100,Math.max(67,.24*h)))<1.1);
  assert(s.bounds.width>s.bounds.height&&s.bounds.right+7.5<=s.party.left&&s.party.right<=w-5);
  assert(Math.abs(s.clock.width-s.bounds.height)<1.1);
  assert.equal(s.g.scale,144/41);assert(s.g.wing>=4&&s.g.width>s.g.height);
  assert(Math.abs((s.bounds.width-2)/(s.bounds.height-2)-s.g.width/s.g.height)<.025,'same horizontal/vertical display scale');
  assert(s.tile>0);assert.notDeepEqual(s.known,black);assert(!s.hasUnknown);assert.deepEqual(s.unknown,black);
  assert.deepEqual(s.center,[255,222,127,255]);assert.deepEqual(s.expanded,[492,492]);
 }
 phase='fixed lane and genuine saved terrain beside central square';
 let s=await inspect();verify(s,844,390);
 const originalBounds=s.state.local.crop,markers=s.state.local.known;
 if(out)await p.screenshot({path:out+'/mini-hud-wide.png'});
 phase='touch actual new right wing opens separate square map, no move or extra reveal';
 await p.touchscreen.tap(s.button.right-10,s.button.top+s.button.height*.45);
 await p.locator('#poiLocalMapDialog').waitFor({state:'visible'});
 s=await inspect();assert.deepEqual(s.state.overlay.crop,originalBounds);
 assert.equal(s.state.overlay.crop.x2-s.state.overlay.crop.x1+1,41);
 assert.equal(s.state.overlay.crop.z2-s.state.overlay.crop.z1+1,41);assert(s.state.overlay.crop.x2<46);
 assert.equal(s.state.local.known,markers);assert.deepEqual([s.state.x,s.state.z],[24,125]);
 await p.locator('#poiLocalMapZoomIn').tap();s=await inspect();
 assert.equal(s.state.overlay.view.zoom,2);assert.deepEqual(s.state.overlay.crop,originalBounds);
 await p.locator('#poiLocalMapClose').tap();await p.locator('#poiLocalMapDialog').waitFor({state:'hidden'});
 phase='narrow phone recomputes backing width without movement and preserves control hits';
 await p.setViewportSize({width:568,height:320});
 await p.waitForFunction(()=>{const c=document.querySelector('#poiMiniMap');return Math.abs(c.width/c.height-c.clientWidth/c.clientHeight)<.004},{},{timeout:10000});
 s=await inspect();verify(s,568,320);
 assert.deepEqual([s.state.x,s.state.z],[24,125]);assert.equal(s.state.local.known,markers);
 if(out)await p.screenshot({path:out+'/mini-hud-wide-narrow.png'});
 await p.locator('#poiBagToggle').tap();await p.locator('#poiBagPanel').waitFor({state:'visible'});
 await p.locator('#poiBagClose').tap();await p.locator('#poiBagPanel').waitFor({state:'hidden'});
 assert.deepEqual(errors,[]);await c.close();
 console.log('Real wider closed HUD, unchanged height and tile scale, genuine saved wing terrain and unknown black, fixed expansion and shared party gutter.');
}catch(e){console.error(phase,last);throw e}
finally{await browser?.close();await new Promise(r=>server.close(r))}
