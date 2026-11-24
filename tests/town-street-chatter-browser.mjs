import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');
let html=readFileSync(process.argv[2]||'world-editor.html','utf8');
function inject(a,b){assert.equal(html.split(a).length,2,a);html=html.replace(a,b)}
const hook="  townResidents:()=>typeof poiTownResidentsSnapshot==='function'?poiTownResidentsSnapshot():null,";
inject(hook,hook+`
  streetFrame:()=>render(),
  streetView:()=>{
   const d=poiTownAmbient,el=$('poiTownSpeech'),r=el.getBoundingClientRect();
   const {vp}=parameters();
   const actors=poiTownNpcActors.filter(a=>a.role.id==='toolkeeper'||a.role.id==='workshopkeeper');
   return {d:poiTownAmbientSnapshot(),lines:d?.lines,visible:!el.hidden,pointer:getComputedStyle(el).pointerEvents,
     box:[r.x,r.y,r.width,r.height],text:el.textContent,
     actors:actors.map(a=>[a.role.id,a.x,a.z,a.y,a.facing,a.activity,poiTownStreetEligible(a,performance.now()),poiTownStreetPoint(a,vp),poiTownStreetClear({x:poiWalkX,z:poiWalkZ},a)])};
  },`);
const freeze='function poiTownClockFrame(now){';
inject(freeze,freeze+'if(window.__holdTownClock)return;');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<!doctype html><title>seed</title>':html)});
await new Promise((ok,no)=>server.listen(0,'127.0.0.1',ok).once('error',no));
const url='http://127.0.0.1:'+server.address().port;
let browser,last;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
 args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:.75,isMobile:true,hasTouch:true});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.__holdTownClock=true});
 await page.clock.install({time:new Date('2026-04-01T10:00:00Z')});
 const open=async()=>{
  await page.goto(url+'/seed');
  await page.evaluate(()=>{
   localStorage.setItem('world-workshop-town-clock-v1',JSON.stringify({version:1,gameMs:1100*500}));
   localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
    position:{x:65,z:43,y:0,facing:0},townLayout:5,townMapHeight:128,
    view:{yaw:0,zoom:.9,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.35,orbitDistance:5.5}}));
  });
  await page.goto(url+'/?resume=1&test=1');
  await page.locator('#pineStartupCover').waitFor({state:'hidden'});
  await page.waitForFunction(()=>window.__editorTest?.facility()?.active&&window.__editorTest?.townResidents()?.actors.length,
     null,{polling:50,timeout:10000});
 };
 const view=()=>page.evaluate(()=>window.__editorTest.streetView());
 const frame=()=>page.evaluate(()=>window.__editorTest.streetFrame());
 // The paused app clock never runs Playwright's two-RAF stability check.
 // Dispatch trusted native touch at the observed, visible button's center.
 const tapLandscapeMenu=async()=>{
  const menu=page.locator('#poiLandscapeMenuToggle');
  const box=await menu.boundingBox();assert.ok(box&&box.width>0&&box.height>0,'visible menu button');
  const before=await menu.getAttribute('aria-expanded');assert.match(before,/^(true|false)$/);
  await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);
  assert.equal(await menu.getAttribute('aria-expanded'),before==='true'?'false':'true','real touch opens/closes menu');
 };
 const step=async(ms)=>{await page.clock.fastForward(ms);await frame();return last=await view()};
 await open();
 await page.clock.pauseAt((await page.evaluate(()=>Date.now()))+1500);
 // The actual daily-life schedule, authored map, camera, and DOM draw are used;
 // no NPC positions, facing, encounter timing, or line content are seeded.
 for(let i=0;i<120;i++){const s=await step(130);if(s.d?.venue==='street'&&s.d.phase===0&&s.visible)break}
 assert.equal(last.d?.venue,'street',JSON.stringify(last));
 assert.deepEqual([last.d.guest,last.d.host].sort(),['toolkeeper','workshopkeeper']);
 assert.equal(last.pointer,'none');assert(last.box[2]>30&&last.box[3]>18);
 assert.match(last.text,/ブラム/);
 assert.deepEqual(last.actors.map(a=>a.slice(0,6)),[
   ['workshopkeeper',65,39,0,2,'evening-walk'],['toolkeeper',65,40,0,0,'evening-walk']]);
 let second;for(let i=0;i<15;i++){second=await step(120);if(second.d?.phase===1)break}
 assert(second.visible&&second.d?.phase===1);assert.match(second.text,/トビン/);
 await tapLandscapeMenu();
 const gone=await step(16);assert.equal(gone.d,null);assert.equal(gone.visible,false);
 assert.deepEqual(gone.actors.map(a=>a[4]),[2,3]);
 await tapLandscapeMenu();
 const still=await step(3500);assert.equal(still.d,null);assert.equal(still.visible,false);
 assert.deepEqual(errors,[]);
 console.log('Native authored streets: two physical neighbors face and exchange, second speech anchored, touch Menu dismisses and restores, cooldown persists');
}catch(e){console.error('last street state:',last);throw e}
finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}
