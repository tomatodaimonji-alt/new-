import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';

const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
assert.match(html,/const POI_MYSTIC_FIELD_OGG='[A-Za-z0-9+/=]{500,}'/,'exact build embeds local score');
function inject(s,a,b){assert.equal(s.split(a).length,2,a);return s.replace(a,b)}
const hook="  townResidents:()=>typeof poiTownResidentsSnapshot==='function'?poiTownResidentsSnapshot():null,";
let fixture=inject(html,hook,hook+`
  fieldAudioQA:{
   place:(x,z,y)=>workshopResumeRestorePosition({x,z,y,facing:0}),
   combat:()=>{
    // One real enemy wind-up exercises the production battle scene decision.
    const obj={type:'monsterSlime',x:poiWalkX+1,z:poiWalkZ,y:poiWalkLevel,rot:0};
    const s=poiCombatActorMake(obj);poiMonsterStates.set(obj,s);window.__fieldQAEnemy={obj,s};
    return poiEnemyBeginPlayer(obj,s,performance.now());
   },
   finishCombat:()=>{
    const e=window.__fieldQAEnemy;if(e){poiEnemyPending.delete(e.s);poiMonsterStates.delete(e.obj);}
   },
   snapshot:()=>({scene:poiOrchestraScene(poiAudioContext?.currentTime??0),zone:poiAudioMusicZone(),ctx:poiAudioContext?.state,
    levels:{...poiAudioLevels},deck:poiOrchestraSnapshot(),probe:window.__fieldQA?.summary(poiAudioMusic)}),
  },`);
fixture=inject(fixture,' const p=poiWildPick(rng);',' const p=null;');
fixture=inject(fixture,'function poiWildRegionalFrame(now,rng){','function poiWildRegionalFrame(now,rng){return;');

const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<!doctype html><title>Field BGM QA</title>':fixture)});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const origin='http://127.0.0.1:'+server.address().port;
let browser,checkpoint='startup';
async function launch(rejectDecode){
 const context=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:.75,isMobile:true,hasTouch:true});
 const page=await context.newPage(),errors=[],offOrigin=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(origin+'/'))offOrigin.push(r.url())});
 await context.addInitScript(({rejectDecode})=>{
  const trace={decoded:[],decodeAttempts:0,loop:[]};
  const destinations=new WeakMap(),byParam=new WeakMap(),targets=new WeakMap();
  const connect=AudioNode.prototype.connect;
  AudioNode.prototype.connect=function(node,...tail){
   if(!destinations.has(this))destinations.set(this,[]);
   destinations.get(this).push(node);
   return connect.call(this,node,...tail);
  };
  const gain=BaseAudioContext.prototype.createGain;
  BaseAudioContext.prototype.createGain=function(...a){
   const node=gain.apply(this,a);byParam.set(node.gain,node);return node;
  };
  const target=AudioParam.prototype.setTargetAtTime;
  AudioParam.prototype.setTargetAtTime=function(level,now,decay){
   const node=byParam.get(this);if(node){
    const log=targets.get(node)||[];log.push({level,now,decay});targets.set(node,log.slice(-12));
   }
   return target.call(this,level,now,decay);
  };
  const decode=BaseAudioContext.prototype.decodeAudioData;
  BaseAudioContext.prototype.decodeAudioData=function(data,good,bad){
   trace.decodeAttempts++;
   if(rejectDecode){const failure=new DOMException('Injected unsupported encoded score','EncodingError');bad?.(failure);return Promise.reject(failure)}
   const okay=b=>{if(!trace.decoded.includes(b))trace.decoded.push(b);good?.(b)};
   return decode.call(this,data,okay,bad).then(b=>{okay(b);return b});
  };
  const start=AudioBufferSourceNode.prototype.start,stop=AudioBufferSourceNode.prototype.stop;
  AudioBufferSourceNode.prototype.start=function(...a){
   const result=start.apply(this,a);
   if(this.loop&&this.buffer?.duration>5){
    const s={node:this,start:a,at:this.context.currentTime,duration:this.buffer.duration,rate:this.buffer.sampleRate,
     channels:this.buffer.numberOfChannels,decoded:trace.decoded.includes(this.buffer),loopStart:this.loopStart,loopEnd:this.loopEnd,stop:null,ended:false};
    this.addEventListener('ended',()=>{s.ended=true});trace.loop.push(s);
   }
   return result;
  };
  AudioBufferSourceNode.prototype.stop=function(...a){
   const result=stop.apply(this,a);
   const s=trace.loop.find(s=>s.node===this);if(s)s.stop=a[0]??this.context.currentTime;
   return result;
  };
  window.__fieldQA={summary:music=>{
   const stages=(n,max=4)=>{if(!n||max<1)return [];return [{v:n.gain?.value,targets:targets.get(n)||[]}].concat(stages(destinations.get(n)?.[0],max-1))};
   return {decodeAttempts:trace.decodeAttempts,decoded:trace.decoded.map(b=>b.duration),musicTargets:targets.get(music)||[],
    loop:trace.loop.map(({node,...s})=>({...s,stages:stages(destinations.get(node)?.[0])}))};
  }};
 },{rejectDecode});
 try{
  await page.goto(origin+'/seed');
  await page.evaluate(()=>{
   localStorage.setItem('world-workshop-audio-v2','{"master":78,"bgm":64,"se":72,"enabled":true}');
   localStorage.setItem('world-workshop-hotbar-v1','{"version":1,"weapon":"equipWoodSword","potions":0}');
   localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
    position:{x:66,z:4,y:0,facing:0},townLayout:5,townMapHeight:128,
    view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
  });
  await page.goto(origin+'/?resume=1&test=1');
  await page.locator('#pineStartupCover').waitFor({state:'hidden'});
  await page.waitForFunction(()=>window.__editorTest?.facility()?.active);
  await page.locator('#poiWalkAction').tap();
  await page.waitForFunction(()=>window.__editorTest.fieldAudioQA.snapshot().ctx==='running',null,{polling:35,timeout:8000});
  return {page,context,errors,offOrigin};
 }catch(e){await context.close();throw e}
}
const snapshot=page=>page.evaluate(()=>window.__editorTest.fieldAudioQA.snapshot());
const wait=(page,f,a=null,t=9000)=>page.waitForFunction(f,a,{polling:45,timeout:t});
const get=async p=>(await snapshot(p)).probe;
const fieldCount=async p=>(await get(p)).loop.length;
async function instrumental(p,scene){
 await wait(p,scene=>{
  const {deck,probe}=window.__editorTest.fieldAudioQA.snapshot();
  return deck.active===scene&&deck.voices>0&&probe.loop.every(a=>a.ended);
 },scene);
}
async function position(p,pin){assert.equal(await p.evaluate(pin=>window.__editorTest.fieldAudioQA.place(...pin),pin),true,'actual resume landing is safe: '+pin)}
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 checkpoint='authentic outdoors decode';const a=await launch(false),p=a.page;
 try{
  await wait(p,()=>window.__editorTest.fieldAudioQA.snapshot().probe.loop.length===1);
  let s=await snapshot(p),track=s.probe.loop[0];
  assert.equal(s.scene,'outside');assert(track.decoded&&track.duration>5&&track.rate>=22050&&track.channels>=1);
  assert(track.loopStart>=0&&(!track.loopEnd||track.loopEnd>track.loopStart&&track.loopEnd<=track.duration+.001));
  assert.equal(track.ended,false);
  checkpoint='battle preempts field loop';
  assert.equal(await p.evaluate(()=>window.__editorTest.fieldAudioQA.combat()),true);
  await instrumental(p,'battle');
  s=await snapshot(p);
  assert(s.probe.loop[0].stages.some(g=>g.targets.some(t=>t.level===0&&t.decay>=.05)),'real gain smoothly retires on combat entry');
  await p.evaluate(()=>window.__editorTest.fieldAudioQA.finishCombat());
  checkpoint='field resumes after genuine battle hold';
  await wait(p,()=>{const q=window.__editorTest.fieldAudioQA.snapshot();return q.scene==='outside'&&q.probe.loop.some(a=>!a.ended)});
  const n=await fieldCount(p);assert.equal(n,2,'one restarted field loop; no duplicate transport');
  for(const [scene,pin] of [['town',[55,42,0]],['indoor',[56,30,0]],['mine',[116,61,-1]],['market',[105,111,0]]]){
   checkpoint=scene+' stays on existing instruments';
   await position(p,pin);await instrumental(p,scene);assert.equal(await fieldCount(p),n);
  }
  checkpoint='native mute, background, and foreground controls';
  await position(p,[66,4,0]);await wait(p,()=>window.__editorTest.fieldAudioQA.snapshot().probe.loop.some(a=>!a.ended));
  const saved=s.levels;
  await p.locator('#poiVolumeBgm').evaluate(e=>{e.value='0';e.dispatchEvent(new Event('input',{bubbles:true}))});
  await wait(p,()=>{const q=window.__editorTest.fieldAudioQA.snapshot();
   return q.levels.bgm===0&&q.probe.musicTargets.at(-1)?.level===0});
  assert.equal((await snapshot(p)).levels.master,saved.master);assert.equal((await snapshot(p)).levels.se,saved.se);
  await p.locator('#poiVolumeBgm').evaluate((e,v)=>{e.value=String(v);e.dispatchEvent(new Event('input',{bubbles:true}))},saved.bgm);
  await p.evaluate(()=>window.__workshopAudioForeground(false));
  await wait(p,()=>{const q=window.__editorTest.fieldAudioQA.snapshot();return q.ctx==='suspended'&&q.probe.loop.every(t=>t.stop!==null)});
  await p.evaluate(()=>window.__workshopAudioForeground(true));
  await wait(p,()=>{const q=window.__editorTest.fieldAudioQA.snapshot();return q.ctx==='running'&&q.probe.loop.filter(t=>!t.ended&&t.stop===null).length===1});
  assert.equal((await get(p)).decodeAttempts,1,'own decoded score is reused across stops within the existing context');
  assert.deepEqual(a.offOrigin,[]);assert.deepEqual(a.errors,[]);
 }catch(e){console.error(checkpoint,JSON.stringify(await snapshot(p).catch(()=>null)),a.errors);throw e}
 finally{await a.context.close()}
 checkpoint='unsupported embedded decode falls back to original outdoors instruments';
 const b=await launch(true);
 try{
  await instrumental(b.page,'outside');
  await wait(b.page,()=>window.__editorTest.fieldAudioQA.snapshot().probe.decodeAttempts>0);
  assert.equal(await fieldCount(b.page),0);
  assert.deepEqual(b.offOrigin,[]);assert.deepEqual(b.errors,[]);
 }catch(e){console.error(checkpoint,JSON.stringify(await snapshot(b.page).catch(()=>null)),b.errors);throw e}
 finally{await b.context.close()}
 console.log('PASS native decoded outdoor loop, zone/battle crossfade, mixer and Activity lifecycle, offline unsupported-decode fallback');
}finally{await browser?.close();await new Promise(r=>server.close(r))}
