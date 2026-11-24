import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const h=readFileSync(process.argv[2]??'release/world-editor.html','utf8');
for(const [,b] of h.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(b);
if(process.env.STREAM_PARSE_ONLY){console.log('exact scripts parse');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<!doctype html><title>Spatial seam</title>':h)});
await new Promise((r,j)=>server.listen(0,'127.0.0.1',r).once('error',j));
const base='http://127.0.0.1:'+server.address().port;
let browser,page,where='launch';
const ready=()=>page.evaluate(()=>({a:window.__editorTest?.snowPassRegion(),p:window.__editorTest?.freeMovementPose(),q:window.__editorTest?.overlandStream()}));
try{
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const ctx=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:.62});
 page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
 await page.goto(base+'/seed');await page.evaluate(()=>{
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,townLayout:5,townMapHeight:128,
   position:{x:49,z:122,y:0,facing:2},view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 });
 where='actual neighboring terrain while standing at base z122';
 await page.goto(base+'/?resume=1&test=1'+(process.env.USE_STREAM_DEFAULT?'':'&overland-stream=1'));
 await page.locator('#pineStartupCover').waitFor({state:'hidden'});
 await page.waitForFunction(()=>{const q=window.__editorTest?.overlandStream();return q?.drawing&&q.last.some(v=>v.id==='snowpass')});
 const standing=await ready();assert(standing.q.oldVariants===0&&standing.a.id==='base');
 assert(Math.abs(standing.p.z-122)<.02);
 assert.equal(await page.evaluate(()=>window.__editorTest.canStep(49,128,49,127)),false);
 await page.evaluate(()=>{
  const log=window.__overlandSamples=[];
  function frame(now){if(log.length>=600)return;const t=window.__editorTest,area=t.snowPassRegion(),p=t.freeMovementPose(),s=t.overlandStream();
   log.push({t:now,id:area.id,x:p.x+(area.id==='snowpass'?37:0),z:p.z+(area.id==='snowpass'?128:0),
    old:s.oldVariants,b:s.bytes,draw:s.drawing,n:s.effective,cover:!document.getElementById('poiSnowTransitionVeil').hidden});
   requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
 });
 const cdp=await ctx.newCDPSession(page),pad=page.locator('#poiAnalogPad'),r=await pad.boundingBox(),point={x:Math.round(r.x+r.width*.5),y:Math.round(r.y+r.height*.5),id:8};
 const send=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
 where='same held pointer runs across base to snow';
 await send('touchStart',[point]);await send('touchMove',[{...point,y:point.y+42}]);
 await page.waitForFunction(()=>{const t=window.__editorTest;return t.snowPassRegion().id==='snowpass'&&t.freeMovementPose().z>1.5});
 assert((await ready()).q.captured,'actual DOM pointer capture remains owned after the seam');
 where='same held pointer reverses and runs back to base';
 await send('touchMove',[{...point,y:point.y-42}]);
 await page.waitForFunction(()=>{const t=window.__editorTest;return t.snowPassRegion().id==='base'&&t.freeMovementPose().z<125.9});
 await send('touchEnd',[]);
 const timeline=await page.evaluate(()=>window.__overlandSamples);
 const changes=timeline.map((x,i)=>i>0&&x.id!==timeline[i-1].id?{a:timeline[i-1],b:x}:null).filter(Boolean);
 assert.equal(changes.length,2);
 for(const {a,b} of changes){
  assert(Math.hypot(a.x-b.x,a.z-b.z)<.32,JSON.stringify({a,b}));
  assert(a.draw&&b.draw&&a.old===0&&b.old===0,'both presented frames use only streamed neighboring geometry');
 }
 assert(!timeline.some(x=>x.cover));assert(timeline.every(x=>x.b<=4*1024*1024&&x.n<=18));
 assert.deepEqual(errors,[]);
 console.log('Seam rendered metrics:',JSON.stringify({changes,maxBytes:Math.max(...timeline.map(x=>x.b)),...((await ready()).q)}));
}catch(e){console.error(where,JSON.stringify(await ready().catch(()=>null)));throw e}
finally{await browser?.close();await new Promise(r=>server.close(r))}
