import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(process.argv[2]??'world-editor.html','utf8');
const anchor='  freeMovementPose:()=>({x:poiWalkViewX,z:poiWalkViewZ,level:poiWalkLevel}),';
function insert(s,key,tail){
 assert.equal(s.split(key).length,2,key);
 return s.replace(key,key+tail);
}
let fixture=insert(source,anchor,`
  orchestraNative:{
   read:()=>({score:typeof poiOrchestraSnapshot==='function'?poiOrchestraSnapshot():null,
    geo:poiAudioMusicZone(),indoors:poiWalkIndoor(),
    region:poiRegionAt(facilitySite,poiWalkX,poiWalkZ,false,poiWalkLevel),
    coords:[poiWalkX,poiWalkZ,poiWalkLevel],
    ctx:poiAudioContext?.state??null,time:poiAudioContext?.currentTime??0,enabled:poiAudioAllowed(),timer:poiAudioInterval!==null,
    boss:[...poiMonsterStates].find(([o])=>o.type==='monsterNorthMinotaur'&&o.x===64&&o.z===13&&o.y===-1)?.[1]?.hp??null,
    graph:window.__scoreSpy.read([poiAudioMaster,poiAudioMusic,poiAudioAmbience,poiAudioEffects],
     typeof poiOrchestraDecks==='undefined'?[]:[...poiOrchestraDecks]),
    saved:localStorage.getItem('world-workshop-audio-v2')}),
   locate:scene=>{
    // Test fixture position injection only. Browser plays through the exact
    // production timer and map geometry/spatial classifier on each move.
    const market=facilitySite.southRoad.town.market;
    const points={town:[45,41,0],outside:[87,2,0],indoor:[41,30,0],market:[market.public.x,market.public.z,0],
     mine:[115,59,-1],chapel:[76,80,-1],otherworld:[102,79,-1],northFort:[64,14,-1]};
    const p=points[scene];if(!p)throw Error(scene);
    [poiWalkX,poiWalkZ,poiWalkLevel]=p;poiWalkFromX=poiWalkViewX=poiWalkX;poiWalkFromZ=poiWalkViewZ=poiWalkZ;
    poiWalkFacing=0;poiWalkStarted=-10000;poiWalkNextReady=0;poiFreePose=null;
    poiWalkRoof();poiWalkStatus();poiWalkAvatar();return p;
   },
   hurtFoley:()=>poiSound('player-hurt')
  },`);
fixture=insert(fixture,'function poiMobFrame(now){','if(window.__qaHoldNaturalMonsterTurns)return;');
const scripts=[...fixture.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g)];
for(const [,js] of scripts)new vm.Script(js);
if(process.env.ORCHESTRA_FIXTURE_SYNTAX_ONLY){
 console.log('Fixture injected into '+scripts.length+' production scripts; full scripts parse.');
 process.exit(0);
}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<!doctype html><title>Orchestra audio harness</title>':fixture)});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const root='http://127.0.0.1:'+server.address().port;
function install(){
 window.__qaHoldNaturalMonsterTurns=true;
 // Preserve native AudioContext (no virtual clock, replacement oscillator,
 // default mixer change, or synthetic supply of a trusted touch).
 const proto=AudioContext.prototype,ids=new WeakMap(),parents=new WeakMap(),ops=new WeakMap(),decoded=new WeakSet();
 const decode=proto.decodeAudioData;
 proto.decodeAudioData=function(data,success,failure){
  const done=b=>{decoded.add(b);return b};
  const result=decode.call(this,data,success?b=>success(done(b)):undefined,failure);
  result?.then(done,()=>{});
  return result;
 };
 let serial=1,played=[];
 const id=n=>{if(!n)return null;if(!ids.has(n))ids.set(n,serial++);return ids.get(n)};
 const observe=n=>{
  id(n);const connect=n.connect,disconnect=n.disconnect;
  n.connect=function(to,...args){parents.set(n,to);return connect.call(n,to,...args)};
  n.disconnect=function(...args){if(!args.length)parents.delete(n);return disconnect.apply(n,args)};
  if(n.gain){
   const actions=[];ops.set(n,actions);
   for(const name of ['setTargetAtTime','setValueAtTime','linearRampToValueAtTime','exponentialRampToValueAtTime','cancelScheduledValues','cancelAndHoldAtTime']){
    const old=n.gain[name];if(!old)continue;
    n.gain[name]=function(...args){actions.push([name,...args]);if(actions.length>40)actions.shift();return old.apply(this,args)};
   }
  }
  return n;
 };
 for(const method of ['createGain','createBiquadFilter','createDelay','createStereoPanner','createDynamicsCompressor','createConvolver','createOscillator','createBufferSource']){
  const old=proto[method];if(!old)continue;
  proto[method]=function(...args){
   const n=observe(old.apply(this,args));
   if(n.start){
    const start=n.start,stop=n.stop;
    let wave=false,event=null;
    if(n.setPeriodicWave){const set=n.setPeriodicWave;n.setPeriodicWave=function(...v){wave=true;return set.apply(this,v)}}
    n.start=function(when,...other){
     const links=[];let sink=parents.get(n);
     for(let j=0;sink&&j<15;j++){links.push(id(sink));sink=parents.get(sink)}
     event={id:id(n),method,wave,when:when??0,at:this.context.currentTime,
      len:n.buffer?.length??null,rate:n.buffer?.sampleRate??null,loop:n.loop===true,
      duration:n.buffer?.duration??null,decoded:!!n.buffer&&decoded.has(n.buffer),links,scheduledStop:null,ended:false};
     played.push(event);if(played.length>1400)played.shift();
     n.addEventListener('ended',()=>{event.ended=true},{once:true});
     return start.apply(this,when===undefined?[]:[when,...other]);
    };
    n.stop=function(when,...rest){
     if(event)event.scheduledStop=when??this.context.currentTime;
     return stop.apply(this,when===undefined?[]:[when,...rest]);
    };
   }
   return n;
  };
 }
 const detail=n=>({id:id(n),gain:n?.gain.value??null,actions:ops.get(n)??[]});
 window.__scoreSpy={read(buses,decks){
  return {buses:buses.map(detail),decks:Object.fromEntries(decks.map(([key,x])=>[key,detail(x.bus)])),played};
 }};
}
const volumeRaw=JSON.stringify({master:83,bgm:71,se:37,enabled:true});
let browser,context,page,checkpoint='launch';const errors=[];
const qa=()=>page.evaluate(()=>window.__editorTest?.orchestraNative?.read());
const wait=(predicate,value=null,timeout=7000)=>page.waitForFunction(predicate,value,{polling:35,timeout});
const locate=scene=>page.evaluate(key=>window.__editorTest.orchestraNative.locate(key),scene);
function checkMixer(g){
 const names=['master','music','ambience','effects'],expected=[.83,.58*.71,.39*.71,.90*.37];
 g.buses.forEach((v,i)=>{
  const event=v.actions.filter(e=>e[0]==='setTargetAtTime').at(-1);
  assert(event&&Math.abs(event[1]-expected[i])<1e-6,names[i]+' original trim and saved volume');
 });
}
const waves=(g,musicId=g.buses[1].id)=>g.played.filter(e=>e.wave&&e.method==='createOscillator'&&e.links.includes(musicId));
async function scene(name){
 const id=(await qa()).graph.played.at(-1)?.id??0;
 const pos=await locate(name);assert(pos);
 await wait(({key,id})=>{
  const r=window.__editorTest.orchestraNative.read(),music=r.graph.buses[1].id,fx=r.graph.buses[3].id;
  const deck=r.graph.decks[key]?.id;
  return r.score?.active===key&&r.graph.played.some(e=>e.id>id&&e.wave&&e.links.includes(deck)&&e.links.includes(music)&&!e.links.includes(fx));
 },{key:name,id});
 return qa();
}
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 context=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:.65,isMobile:true,hasTouch:true});
 await context.addInitScript(install);
 page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(root+'/seed');
 await page.evaluate(raw=>{
  localStorage.setItem('world-workshop-audio-v2',raw);
  localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weapon:'equipWoodSword',potions:0}));
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:45,z:41,y:0,facing:0},townLayout:5,townMapHeight:128,view:{yaw:0,zoom:1,panX:0,panZ:0,level:0,
    hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.35,orbitDistance:5.5}}));
 },volumeRaw);
 await page.goto(root+'/?resume=1&test=1');
 await page.locator('#pineStartupCover').waitFor({state:'hidden'});
 await wait(()=>window.__editorTest?.orchestraNative&&document.querySelector('#viewWrap').hasAttribute('data-analog-play'));
 const action=page.locator('#poiWalkAction');
 checkpoint='actual trusted touch wakes the music';
 await action.tap();
 await wait(()=>{
  const s=window.__editorTest.orchestraNative.read(),id=s.graph.buses[1].id;
  return s.ctx==='running'&&s.score?.active==='town'&&s.graph.played.some(e=>e.wave&&e.links.includes(id));
 });
 let observed=await qa();checkMixer(observed.graph);
 assert.equal(observed.saved,volumeRaw);
 assert.equal(observed.graph.decks.town.actions.find(e=>e[0]==='setTargetAtTime'&&e[1]===1)?.[3],.30,'first app music has its verified gentle new onset');
 const stoppedTown=waves(observed.graph).map(e=>e.id);
 const masterId=observed.graph.buses[0].id;
 assert(stoppedTown.length&&waves(observed.graph).every(e=>e.links.includes(masterId)&&!e.links.includes(observed.graph.buses[3].id)));
 checkpoint='named outdoor location and rapid mixing across room boundary';
 await locate('outside');
 await wait(()=>window.__editorTest.orchestraNative.read().score?.active==='outside');
 observed=await qa();assert.equal(observed.geo,'outside');assert.deepEqual(observed.coords,[87,2,0]);assert.equal(observed.region.name,'北の林道');assert.equal(observed.region.difficulty,1);assert(!observed.indoors);
 assert(observed.score.decks.length===2,'native returning scene starts as a two-deck fade, not immediate replacement');
 const target=(key)=>observed.graph.decks[key].actions.filter(v=>v[0]==='setTargetAtTime').at(-1);
 assert(target('outside')[1]===1&&target('outside')[3]===.38,'new deck fades in softly without delaying playback');
 assert(target('town')[1]===0&&target('town')[3]===.19,'old deck keeps its existing fade out');
 assert(Math.abs(target('outside')[2]-target('town')[2])<.01,'fade operations share the actual context time');
 const outsideBus=observed.graph.decks.outside.id;
 await wait(({out})=>{
  const r=window.__editorTest.orchestraNative.read(),music=r.graph.buses[1].id,fx=r.graph.buses[3].id;
  return r.score?.active==='outside'&&r.graph.played.some(e=>e.method==='createBufferSource'&&e.decoded&&e.loop
   &&e.duration>30&&e.duration<60&&e.links.includes(out)&&e.links.includes(music)&&!e.links.includes(fx));
 },{out:outsideBus});
 observed=await qa();const field=observed.graph.played.filter(e=>e.links.includes(outsideBus));
 assert.equal(field.length,1,'outside uses only the decoded recording, never a synthesized cue during decoding');
 assert(field[0].links.includes(masterId),'field recording shares the original master mixer');
 observed=await scene('indoor');assert(observed.indoors);assert(observed.score.decks.length<=2);
 observed=await scene('town');assert(observed.score.decks.length<=2);
 await wait(()=>window.__editorTest.orchestraNative.read().score?.decks.length===1);
 checkpoint='dungeon/market/north cue scheduling';
 for(const s of ['market','mine','chapel','otherworld','northFort'])await scene(s);
 checkpoint='actual weapon touch does damage and enters battle';
 const before=await qa();assert(before.boss>0);
 await action.tap();
 await wait(boss=>{const s=window.__editorTest.orchestraNative.read();return s.boss<boss&&s.score?.active==='battle'},before.boss,9000);
 observed=await qa();checkMixer(observed.graph);assert(observed.score.voices>0&&observed.score.voices<=42);
 checkpoint='battle eventually returns to underlying fort without a new attack';
 await wait(()=>window.__editorTest.orchestraNative.read().score?.active==='northFort',null,11000);
 observed=await qa();
 const last=observed.graph.played.at(-1)?.id??0;
 checkpoint='recorded player-hit foley remains routed only through prior effects gain';
 await page.evaluate(()=>window.__editorTest.orchestraNative.hurtFoley());
 await wait(id=>{const s=window.__editorTest.orchestraNative.read(),mi=s.graph.buses[1].id,fx=s.graph.buses[3].id;
  return s.graph.played.some(e=>e.id>id&&e.method==='createBufferSource'&&e.len===4800&&e.rate===24000&&e.links.includes(fx)&&!e.links.includes(mi));
 },last);
 checkpoint='native pause stops score, dominates page foreground, and then restarts';
 await page.evaluate(()=>{
  window.__workshopAudioForeground(false);
  window.dispatchEvent(new Event('pagehide'));window.dispatchEvent(new Event('pageshow'));
 });
 await wait(()=>{const s=window.__editorTest.orchestraNative.read();return !s.enabled&&!s.timer&&s.ctx==='suspended'&&s.score?.decks.length===0});
 let paused=await qa();assert.equal(paused.score.voices,0);
 const stoppedAt=paused.graph.played.length;
 await page.waitForTimeout(450);
 assert.equal((await qa()).graph.played.length,stoppedAt,'no score or effects start while backgrounded');
 await locate('town');
 await page.evaluate(()=>window.__workshopAudioForeground(true));
 await wait(()=>{const s=window.__editorTest.orchestraNative.read();return s.enabled&&s.timer&&s.ctx==='running'&&s.score?.active==='town'});
 observed=await qa();checkMixer(observed.graph);assert.equal(observed.saved,volumeRaw);
 assert(waves(observed.graph).every(e=>e.when<e.at+.65),'actual scheduler never queues a long backlog into Web Audio');
 assert.equal(errors.length,0,errors.join('\n'));
 console.log('PASS native touch, distinct score scene scheduling, bounded fades, real hit battle, recorded SFX bus and foreground lifecycle');
}catch(e){const last=page?await qa().catch(()=>null):null;if(last)last.graph.played=last.graph.played.slice(-12);console.error(checkpoint,JSON.stringify(last),errors);throw e}
finally{await context?.close();await browser?.close();await new Promise(resolve=>server.close(resolve))}
