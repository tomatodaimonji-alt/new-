import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
let html=readFileSync(process.argv[2]||'world-editor.html','utf8');
function append(a,b){assert.equal(html.split(a).length,2,a);html=html.replace(a,a+b)}
append('function poiOrchestraSource(deck,source,nodes,when,end,offset=null){',`
 if(source.loop&&source.buffer)source.__templeScoreName=poiOrchestraActive;
`);
append('  freeMovementPose:()=>({x:poiWalkViewX,z:poiWalkViewZ,level:poiWalkLevel}),',`
  templeScoreQA:()=>({audio:poiOrchestraSnapshot(),running:poiAudioContext?.state==='running',scene:facilitySite?.id,
   play:poiWalkActive,pos:[poiWalkX,poiWalkZ,poiWalkLevel],pending:poiWalkNextReady,now:performance.now(),
   cover:window.pineStartup.ready,battle:typeof poiDavidBattleActive==='function'?poiDavidBattleActive(performance.now()):!!poiDavidActive?.s?.david?.awake,
   events:window.__templeScoreEvents,stops:window.__templeScoreStops}),
`);
for(const [,js] of html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(js);
if(process.env.DAVID_SCORE_LAYOUT_ONLY==='1'){console.log('Stone David score native fixture compiles exact source');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const app=createServer((req,res)=>{res.setHeader('content-type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>Audio QA</title>':html)});
await new Promise((y,n)=>app.listen(0,'127.0.0.1',y).once('error',n));
const url='http://127.0.0.1:'+app.address().port;let browser,p,trace;
try{
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
 const context=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:.75});
 p=await context.newPage();
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>{
  window.__templeScoreEvents=[];window.__templeScoreStops=[];
  const start=AudioBufferSourceNode.prototype.start,stop=AudioBufferSourceNode.prototype.stop;
  AudioBufferSourceNode.prototype.start=function(when,offset){
   const result=start.apply(this,arguments),key=this.__templeScoreName;
   if(key==='davidStill'||key==='davidAwake'||key==='outside'){
    const c=this.buffer.getChannelData(0);let energy=0;for(let i=0;i<c.length;i+=64)energy+=c[i]**2;
    window.__templeScoreEvents.push({key,loop:this.loop,seconds:this.buffer.duration,offset:offset??0,ready:window.pineStartup?.ready,energy});
   }
   return result;
  };
  AudioBufferSourceNode.prototype.stop=function(){
   if(this.__templeScoreName)window.__templeScoreStops.push(this.__templeScoreName);return stop.apply(this,arguments);
  };
 });
 await p.goto(url+'/seed');
 await p.evaluate(()=>{
  localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weapon:'equipWoodSword',potions:3,gold:0}));
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:24,z:123,y:0,facing:2},townLayout:5,townMapHeight:182,templeDepth:1,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.35,orbitDistance:5.5}}));
 });
 await p.goto(url+'/?resume=1&test=1',{waitUntil:'domcontentloaded'});
 await p.locator('#pineStartupCover').waitFor({state:'hidden'});
 const wait=(fn,v=null)=>p.waitForFunction(fn,v,{polling:35,timeout:15000});
 const state=()=>p.evaluate(()=>window.__editorTest?.templeScoreQA?.());
 const audio=async key=>{
  await wait(k=>{const t=window.__editorTest?.templeScoreQA?.();return t?.audio.active===k&&t.events.some(e=>e.key===k)},key);
  return state();
 };
 async function step(z,key,x=24){
  await p.keyboard.press(key);
  await wait(([x,z])=>{const s=window.__editorTest.templeScoreQA();return s.pos[0]===x&&s.pos[1]===z&&s.now>=s.pending},[x,z]);
 }
 const path=Array.from({length:32},(_,i)=>[24,125+i]);
 async function walkTrace(points){
  for(const [x,z] of points){
   const [cx,cz]= (await state()).pos;
   if(x===cx&&z===cz)continue;
   assert(Math.abs(x-cx)+Math.abs(z-cz)===1);
   await step(z,x>cx?'ArrowRight':x<cx?'ArrowLeft':z>cz?'ArrowDown':'ArrowUp',x);
  }
 }
 trace='existing field';let s=await audio('outside');assert.deepEqual(s.pos,[24,123,0]);assert(!s.battle);
 trace='physical forecourt before gate';await step(124,'ArrowDown');
 s=await audio('davidStill');assert.deepEqual(s.pos,[24,124,0]);assert(!s.battle);
 for(const z of [125,126,127,128])await step(z,'ArrowDown');
 s=await state();assert.equal(s.audio.active,'davidStill');assert(!s.battle);
 assert.equal(s.events.filter(e=>e.key==='davidStill').length,1);
 trace='brief boundary retrace then actual wake';
 await walkTrace(path.slice(4));
 s=await audio('davidAwake');assert(s.battle);
 const calm=s.events.find(e=>e.key==='davidStill'),dark=s.events.find(e=>e.key==='davidAwake');
 assert(calm.loop&&dark.loop&&calm.ready&&dark.ready&&calm.energy>10&&dark.energy>10);
 assert(Math.abs(calm.seconds-48)<.05&&Math.abs(dark.seconds-48)<.05);
 assert(calm.offset<.015&&dark.offset>.10&&dark.offset<48);
 assert(s.audio.decks.length<=2);
 trace='real retreat beyond entrance';
 await walkTrace(path.slice().reverse());
 await wait(()=>{const r=window.__editorTest.templeScoreQA();return r.audio.active==='davidStill'&&r.events.filter(e=>e.key==='davidStill').length===2});
 for(const z of [124,123])await step(z,'ArrowUp');
 s=await audio('outside');
 await wait(()=>window.__editorTest.templeScoreQA().audio.decks.length===1);
 s=await state();assert(!s.battle);assert.deepEqual(s.pos,[24,123,0]);
 assert(s.stops.includes('davidAwake')&&s.stops.includes('davidStill'));
 assert.equal(s.events.filter(e=>e.key==='davidAwake').length,1);
 assert.equal(s.events.filter(e=>e.key==='davidStill').length,2);
 assert.equal(s.events.filter(e=>e.key==='outside').length,2);
 assert.deepEqual(errors,[]);
 console.log('Native contiguous field → quiet courtyard → actual combat → original field; both original recordings decoded, looped once, phase offset and retired.');
}catch(e){console.error(trace,await p?.evaluate(()=>window.__editorTest?.templeScoreQA?.()).catch(()=>null));throw e}
finally{await browser?.close();await new Promise(y=>app.close(y))}
