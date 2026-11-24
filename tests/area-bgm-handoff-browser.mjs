import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
let html=readFileSync(process.argv[2]||'world-editor.html','utf8');
function append(a,b){assert.equal(html.split(a).length,2,a);html=html.replace(a,a+b)}
append(" const bus=ctx.createGain(),output=ctx.createGain();output.gain.value=0;",`
 output.gain.__zone=scene;window.__audioGateNodes.set(output,scene);
`);
append('function poiOrchestraSource(deck,source,nodes,when,end,offset=null){',`
 if(source.loop&&source.buffer)source.__templeScoreName=poiOrchestraActive;
`);
append('  freeMovementPose:()=>({x:poiWalkViewX,z:poiWalkViewZ,level:poiWalkLevel}),',`
  templeScoreQA:()=>({audio:poiOrchestraSnapshot(),running:poiAudioContext?.state==='running',scene:facilitySite?.id,
   play:poiWalkActive,pos:[poiWalkX,poiWalkZ,poiWalkLevel],pending:poiWalkNextReady,now:performance.now(),
   cover:window.pineStartup.ready,battle:typeof poiDavidBattleActive==='function'?poiDavidBattleActive(performance.now()):!!poiDavidActive?.s?.david?.awake,
   events:window.__templeScoreEvents,stops:window.__templeScoreStops,ramps:window.__bgmRamps,links:window.__bgmLinks}),
`);
for(const [,js] of html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(js);
if(process.env.AREA_BGM_LAYOUT_ONLY==='1'){console.log('Area BGM handoff native fixture compiles exact source');process.exit(0)}
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
  window.__templeScoreEvents=[];window.__templeScoreStops=[];window.__bgmRamps=[];window.__bgmLinks=[];window.__audioGateNodes=new WeakMap();
  const ramp=AudioParam.prototype.linearRampToValueAtTime,set=AudioParam.prototype.setValueAtTime,connect=AudioNode.prototype.connect;
  AudioParam.prototype.linearRampToValueAtTime=function(to,t){
   if(this.__zone)window.__bgmRamps.push({zone:this.__zone,kind:'end',to,t});
   return ramp.apply(this,arguments);
  };
  AudioParam.prototype.setValueAtTime=function(to,t){
   if(this.__zone)window.__bgmRamps.push({zone:this.__zone,kind:'set',to,t});
   return set.apply(this,arguments);
  };
  AudioNode.prototype.connect=function(to){
   if(window.__audioGateNodes.has(to))window.__bgmLinks.push(window.__audioGateNodes.get(to));
   return connect.apply(this,arguments);
  };

  const start=AudioBufferSourceNode.prototype.start,stop=AudioBufferSourceNode.prototype.stop;
  AudioBufferSourceNode.prototype.start=function(when,offset){
   const result=start.apply(this,arguments),key=this.__templeScoreName;
   if(key==='davidStill'||key==='davidAwake'||key==='outside'){
    const c=this.buffer.getChannelData(0);let energy=0;for(let i=0;i<c.length;i+=64)energy+=c[i]**2;
    window.__templeScoreEvents.push({key,loop:this.loop,seconds:this.buffer.duration,offset:offset??0,ready:window.pineStartup?.ready,energy,when});
   }
   return result;
  };
  AudioBufferSourceNode.prototype.stop=function(){
   if(this.__templeScoreName)window.__templeScoreStops.push({key:this.__templeScoreName,t:this.context.currentTime});return stop.apply(this,arguments);
  };
 });
 await p.goto(url+'/seed');
 await p.evaluate(()=>{
  localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weapon:'equipWoodSword',potions:3,gold:0}));
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:24,z:91,y:0,facing:2},townLayout:5,townMapHeight:128,
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
 async function step(z,key){
  await p.keyboard.press(key);
  await wait(z=>{const s=window.__editorTest.templeScoreQA();return s.pos[0]===24&&s.pos[1]===z&&s.now>=s.pending},z);
 }
 trace='existing field';let s=await audio('outside');assert.deepEqual(s.pos,[24,91,0]);assert(!s.battle);
 trace='physical entrance and calm';for(const z of [92,93,94])await step(z,'ArrowDown');
 s=await audio('davidStill');assert(!s.battle);
 assert.equal(s.events.filter(e=>e.key==='davidStill').length,1);
 trace='actual arena awakening';
 await step(95,'ArrowDown');await step(96,'ArrowDown');await step(97,'ArrowDown');await step(98,'ArrowDown');
 s=await audio('davidAwake');assert(s.battle);
 const calm=s.events.find(e=>e.key==='davidStill'),dark=s.events.find(e=>e.key==='davidAwake');
 assert(calm.loop&&dark.loop&&calm.ready&&dark.ready&&calm.energy>10&&dark.energy>10);
 assert(Math.abs(calm.seconds-48)<.05&&Math.abs(dark.seconds-48)<.05);
 assert(calm.offset<.015&&dark.offset>.10&&dark.offset<48);
 assert(s.audio.decks.length<=2);
 trace='real retreat beyond entrance';
 for(const z of [97,96,95,94,93,92,91])await step(z,'ArrowUp');
 s=await audio('outside');
 await wait(()=>window.__editorTest.templeScoreQA().audio.decks.length===1);
 s=await state();assert(!s.battle);assert.deepEqual(s.pos,[24,91,0]);
 assert(s.stops.some(z=>z.key==='davidAwake')&&s.stops.some(z=>z.key==='davidStill'));
 // Actual AudioParam events and source timestamps on the same AudioContext:
 // the dry and both reflection routes meet one last gain before master BGM.
 for(const key of ['outside','davidStill','davidAwake'])assert(s.links.filter(z=>z===key).length>=3,key+' dry and both delayed taps share final gate');
 const keys=['outside','davidStill','davidAwake','outside'];
 const created=s.events.map(e=>e.key);
 assert.deepEqual(created,keys);
 for(let i=1;i<keys.length;i++){
  const gone=s.stops.find(z=>z.key===keys[i-1]),incoming=s.events[i];
  const zero=s.ramps.find(z=>z.zone===keys[i-1]&&z.kind==='end'&&z.to===0&&z.t<=incoming.when);
  const began=s.ramps.find(z=>z.zone===keys[i]&&z.kind==='set'&&z.to===0&&z.t>=zero?.t);
  const up=s.ramps.find(z=>z.zone===keys[i]&&z.kind==='end'&&z.to===1&&z.t>=incoming.when);
  assert(zero&&gone&&began&&up&&gone.t>=zero.t-.002&&incoming.when>=gone.t&&incoming.when>=began.t,
    JSON.stringify({keys:keys.slice(i-1,i+1),gone,zero,began,up,incoming}));
  assert(Math.abs(up.t-began.t-1)<.004);
 }

 assert.equal(s.events.filter(e=>e.key==='davidAwake').length,1);
 assert.equal(s.events.filter(e=>e.key==='davidStill').length,1);
 assert.equal(s.events.filter(e=>e.key==='outside').length,2);
 assert.deepEqual(errors,[]);
 console.log('Physical field → courtyard → combat → field; verified old native dry/wet gain reaches exact zero before next buffer starts from zero.');
}catch(e){console.error(trace,await p?.evaluate(()=>window.__editorTest?.templeScoreQA?.()).catch(()=>null));throw e}
finally{await browser?.close();await new Promise(y=>app.close(y))}
