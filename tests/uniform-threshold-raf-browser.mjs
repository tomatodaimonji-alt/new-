import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
let h=readFileSync(process.argv[2]??'world-editor.html','utf8');
const put=(a,b)=>{assert.equal(h.split(a).length,2,a);h=h.replace(a,b)};
put("if(facilityParams.get('test')==='1')window.__editorTest={",`if(facilityParams.get('test')==='1')window.__editorTest={
 uniformRAF:()=>({x:poiWalkX,z:poiWalkZ,view:[poiWalkViewX,poiWalkViewZ],active:!!poiOutdoorFrame,saved:poiOutdoorCaches.size,
  inside:poiDavidTempleEnclosedAt(facilitySite,poiWalkViewX,poiWalkViewZ,0),drew:poiOutdoorProbe.drawn.length,
  pivot:facilitySite.davidTemple?.entrance,visibility:document.visibilityState,focus:document.hasFocus(),
  frozen:poiGameFrozen(),pauseMounted:poiPauseMounted,away:poiPageAway,audio:poiAudioAllowed(),paused:poiPausedAt,
  dropped:window.pineStartup.failed||false,raw:poiWallNow(),game:performance.now(),n:window.__testRaf?.length,records:window.__testFrames?.slice(-240),
  rawRAF:window.__testRaf?.slice(-240),dirs:['n','s','e','w'].map(k=>poiCameraRelativeStep(k))}),`);
put(' requestAnimationFrame(render);',` requestAnimationFrame(render);
 window.__testFrameStart=poiWallNow();`);
put(' poiScreenNoteCaptureFrame();',` poiScreenNoteCaptureFrame();
 (window.__testFrames??=[]).push([window.__testFrameStart,poiWallNow(),poiWalkX,poiWalkZ,poiWalkViewZ]);
 if(window.__testFrames.length>240)window.__testFrames.shift();`);
for (const [,js] of h.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(js);
if(process.env.OUTDOOR_PARSE_ONLY)process.exit(0);
const {chromium}=createRequire(import.meta.url)('playwright');
const s=createServer((req,res)=>{res.setHeader('content-type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>seed</title>':h)});
await new Promise(r=>s.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+s.address().port;
let b;const errors=[];let phase='boot',read,entered,before,returned;
const enabled=process.env.UNIFORM_RAF_MODE==='prototype';
const lean=({rawRAF,records,...state})=>({...state,rawRAF:rawRAF?.slice(-8),records:records?.slice(-8)});
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const p=await b.newPage({viewport:{width:844,height:390},deviceScaleFactor:.65,isMobile:true,hasTouch:true});
 p.setDefaultTimeout(12000);p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>{function mark(t){(window.__testRaf??=[]).push(t);if(window.__testRaf.length>240)window.__testRaf.shift();requestAnimationFrame(mark)}requestAnimationFrame(mark)});
 await p.goto(url+'/seed');
 await p.evaluate(()=>localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
  position:{x:24,z:125,y:0,facing:2},townLayout:5,townMapHeight:182,templeDepth:1,
  view:{yaw:0,zoom:1,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:0,orbitPitch:.14,orbitDistance:5.6}})));
 await p.goto(url+'/?resume=1&test=1'+(enabled?'&uniform-outdoor=1':'')+(process.env.UNIFORM_SHELL_MODE==='threshold'?'&uniform-shell=1':''));await p.bringToFront();
 await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:40000});
 read=()=>p.evaluate(()=>window.__editorTest.uniformRAF());
 await p.waitForFunction(()=>window.__editorTest?.uniformRAF()?.records?.length>10,null,{timeout:12000,polling:80});
 before=await read();assert.deepEqual([before.x,before.z],[24,125]);assert.equal(before.visibility,'visible');
 async function step(dz){
  const state=await read();const i=state.dirs.findIndex(d=>d[0]===0&&d[1]===dz);assert(i>=0,JSON.stringify(lean(state)));
  const key=['ArrowUp','ArrowDown','ArrowRight','ArrowLeft'][i];
  for(let pass=0;pass<4;pass++){
   await p.keyboard.press(key);
   const n=await read();if(n.z===state.z+dz)return;
   await p.waitForTimeout(215);
  }
  throw Error('step rejected '+JSON.stringify({dz,state:lean(state),current:lean(await read())}));
 }
 phase='enter';
 for(let i=0;i<4;i++)await step(1);
 await p.waitForFunction(()=>{const q=window.__editorTest.uniformRAF();return q.inside&&q.view[1]>=128},null,{timeout:9000,polling:80});
 entered=await read();assert(!entered.active&&entered.drew===0);
 if(enabled)assert(entered.saved>0,JSON.stringify(lean(entered)));else assert.equal(entered.saved,0);
 phase='return';
 for(let i=0;i<2;i++)await step(-1);
 await p.waitForFunction(()=>{const q=window.__editorTest.uniformRAF();return !q.inside&&q.active&&q.view[1]<=127.49},null,{timeout:11000,polling:80});
 returned=await read();assert.equal(returned.visibility,'visible');assert.deepEqual(errors,[]);
 const stats=(rows)=>{const t=rows.filter(Number.isFinite);const gaps=t.slice(1).map((v,i)=>v-t[i]).sort((a,b)=>a-b);return {n:t.length,p95:gaps[Math.floor((gaps.length-1)*.95)],p99:gaps[Math.floor((gaps.length-1)*.99)],max:gaps.at(-1)}};
 console.log(JSON.stringify({enabled,before:lean(before),interior:lean(entered),returned:lean(returned),webRaf:stats(returned.rawRAF),gameRaf:stats(returned.records.map(r=>r[0]))}));
}catch(e){console.error(JSON.stringify({enabled,phase,errors,before:before&&lean(before),entered:entered&&lean(entered),current:read?lean(await read().catch(()=>({}))):null}));throw e}
finally{await b?.close();await new Promise(r=>s.close(r))}
