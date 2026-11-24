import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const leapMode=process.argv.includes('--leap'),fatal=process.argv.includes('--fatal');
const kind=leapMode?'leap':'stomp';
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const leapRadius=Number(html.match(/POI_DAVID_LEAP_RADIUS=([0-9.]+)/)?.[1]);
const key='  freeMovementPose:()=>({x:poiWalkViewX,z:poiWalkViewZ,level:poiWalkLevel}),';
function inject(s,a,b){assert.equal(s.split(a).length,2,a);return s.replace(a,b)}
let fixture=inject(html,key,key+`
  arenaQA:{
   manual:()=>{window.__arenaManual=true},
   armLethal:()=>{poiPlayerHP=1;poiCombatHud()},
   draw:()=>render(),
   leapTarget:()=>workshopResumeRestorePosition({x:24,z:112,y:0,facing:0}),
   audio:()=>poiAudioContext?.state,
   selectStomp:()=>{const s=poiDavidActive?.s;if(!s?.david||s.david.attack)return false;s.david.cycle=2;return true},
   get:()=>{
    const m=[...poiMonsterStates].find(([o])=>o.type==='monsterStoneDavid'),s=m?.[1],d=s?.david,q=d?.attack;
    const renderPose=m?poiMonsterPose(m[0],s,performance.now()):null;
    const rig=renderPose?.david?poiDavidRig(renderPose.david):null;
    return {now:performance.now(),nextMob:poiNextMobTick,nextStep:poiWalkNextReady,arena:facilitySite.davidTemple.boss.room.arena,
      player:[poiWalkX,poiWalkZ,poiWalkLevel],pose:[poiWalkViewX,poiWalkViewZ],free:!!poiFreePose,hp:poiPlayerHP,boss:s?[s.x,s.z]:null,awake:!!d?.awake,returning:!!d?.returning,renderPose:renderPose?{x:renderPose.x,y:renderPose.y,z:renderPose.z,david:renderPose.david}:null,
      rig:rig?{crouch:rig.leapCrouch??0,feet:rig.feet.map(p=>p[1])}:null,cracks:window.__crackFrames??[],quakes:window.__quakeFrames??[],audio:window.__impactAudio??[],
      death:poiPlayerDeathSnapshot(),fade:document.getElementById('poiDeathFade')?.style.opacity,crackLive:!!poiDavidFissureMesh?.gpu,
      rock:window.__raisedStoneFrames??[],rockBuffers:window.__raisedStoneBuffers??[],rockLive:!!poiDavidRaisedStoneMesh?.gpu,
      event:poiDavidFissure?{start:poiDavidFissure.start,radius:poiDavidFissure.radius,duration:poiDavidFissure.fissureMs,quake:poiDavidFissure.quakeMs}:null,
      wakes:!!d?.wakeDone,q:q?{kind:q.kind,start:q.start,cursor:q.cursor,dx:q.dx,dz:q.dz,sx:q.sx,sz:q.sz,leap:q.leap,hits:q.hits}:null,
      cue:window.__arenaCue??[],damage:window.__arenaDamage??[]};
   }
  },`);
fixture=inject(fixture,' requestAnimationFrame(render);',' if(!window.__arenaManual)requestAnimationFrame(render);');
fixture=inject(fixture,'function poiDavidMobFrame(o,s,now){','function poiDavidMobFrame(o,s,now){if(!window.__arenaManual)return false;');
fixture=inject(fixture,'function poiWildRegionalFrame(now,rng){','function poiWildRegionalFrame(now,rng){return;');
fixture=inject(fixture,'function poiWildPick(rng){','function poiWildPick(rng){return null;');
fixture=inject(fixture,'try{gl.blendColor(0,0,0,alpha);draw(g,vp,0,Math.min(g.count,count))}',`try{
  gl.blendColor(0,0,0,alpha);draw(g,vp,0,Math.min(g.count,count));
  (window.__crackFrames??=[]).push({now,age,n:Math.min(g.count,count),alpha,fx:e.x,fz:e.z,leap:e.leap,radius:e.radius});
 }`);
fixture=inject(fixture,'  poiDavidRaisedStoneMesh={e,gpu:upload(geometry,prior?.buf??null,gl.STATIC_DRAW)};',`
  poiDavidRaisedStoneMesh={e,gpu:upload(geometry,prior?.buf??null,gl.STATIC_DRAW)};
  let lo=Infinity,hi=-Infinity;
  for(let i=1;i<geometry.p.length;i+=3){lo=Math.min(lo,geometry.p[i]);hi=Math.max(hi,geometry.p[i])}
  (window.__raisedStoneBuffers??=[]).push({start:e.start,height:hi-lo,n:poiDavidRaisedStoneMesh.gpu.count,...geometry.broken});
`);
fixture=inject(fixture,' draw(poiDavidRaisedStoneMesh.gpu,lifted);',`
 draw(poiDavidRaisedStoneMesh.gpu,lifted);
 (window.__raisedStoneFrames??=[]).push({age,start:e.start,n:poiDavidRaisedStoneMesh.gpu.count,offset});
`);
fixture=inject(fixture,' const priorHP=poiPlayerHP;',' const priorHP=poiPlayerHP;if(obj.type==="monsterStoneDavid")(window.__arenaDamage??=[]).push({start:poiDavidActive?.s?.david?.attack?.start,raw,amount,now});');
fixture=inject(fixture,` const out=new Float32Array(frame.vp);
 for(let i=0;i<16;i+=4)out[i+1]+=dy*out[i+3];`,` const out=new Float32Array(frame.vp);
 for(let i=0;i<16;i+=4)out[i+1]+=dy*out[i+3];
 if(grounded)(window.__quakeFrames??=[]).push({at:now,age,dy,leap:e.leap});`);
fixture=inject(fixture,' poiAudioTransient.add(source);source.start(when);source.stop(when+(cap??(buffer.duration+.012)));',`
 poiAudioTransient.add(source);source.start(when);source.stop(when+(cap??(buffer.duration+.012)));
 const match=[...poiRecordedFoleyCache].find(([name,b])=>b===buffer&&(name==='davidHeavyStomp'||name==='davidLeapStomp'));
 if(match)(window.__impactAudio??=[]).push({name:match[0],duration:buffer.duration,current:source.context.currentTime,when,
    gain:gain.gain.value,linked:poiAudioEffects.context===source.context,impact:poiDavidImpact?.start});
`);
for(const [,js] of fixture.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(js);
if(process.env.DAVID_LAYOUT_ONLY==='1'){console.log('PASS exact browser fixture anchors and inline syntax');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<!doctype html><title>Temple arena QA</title>':fixture)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
let browser,where='launch',p;
const log=()=>p.evaluate(()=>window.__editorTest.arenaQA.get());
const errors=[];
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--autoplay-policy=no-user-gesture-required','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 p=await browser.newPage({viewport:{width:844,height:390},deviceScaleFactor:.7,isMobile:true,hasTouch:true});
 p.on('pageerror',e=>errors.push(e.message));
 await p.clock.install({time:new Date('2026-11-24T12:00:00Z')});
 where='cold authored save, just within wake range';
 await p.goto(url+'/seed');
 await p.evaluate(()=>{
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:24,z:102,y:0,facing:0},townLayout:5,townMapHeight:128,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.35,orbitDistance:5.5}}));
  localStorage.setItem('world-workshop-hotbar-v1','{"version":1,"weapon":"equipWoodSword","potions":0,"gold":0}');
 });
 await p.goto(url+'/?resume=1&test=1',{waitUntil:'domcontentloaded',timeout:25000});
 await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:23000});
 await p.waitForFunction(()=>window.__editorTest?.arenaQA&&window.__editorTest.facility().active,null,{timeout:12000});
 const initial=await log();
 assert.deepEqual(initial.player,[24,102,0]);assert.deepEqual(initial.boss,[24,104]);assert.equal(initial.hp,100);
 await p.evaluate(()=>window.__editorTest.arenaQA.manual());
 await p.touchscreen.tap(606,167);
 await p.waitForFunction(()=>window.__editorTest.arenaQA.audio()==='running');
 const wall=await p.evaluate(()=>Date.now());await p.clock.pauseAt(wall+1500);
 const advance=async(ms=48)=>{await p.clock.fastForward(ms);await p.evaluate(()=>window.__editorTest.arenaQA.draw());};
 const until=async(pred,n)=>{let s=await log();for(let i=0;i<n&&!pred(s);i++){await advance();s=await log()}assert(pred(s),JSON.stringify(s));return s};
 const aligned=await log(),debt=Math.ceil(aligned.nextMob-aligned.now);
 if(debt>0)await p.clock.fastForward(debt+16);
 where='true scheduling after wake';
 await until(s=>s.awake,45);
 if(leapMode)assert(await p.evaluate(()=>window.__editorTest.arenaQA.leapTarget()));
 else assert(await p.evaluate(()=>window.__editorTest.arenaQA.selectStomp()));
 const selected=await until(s=>s.q?.kind===kind&&s.q.cursor===0,140);
 assert.equal(selected.cracks.length,0,'no ground fracture during the tell');
 assert.equal(selected.rock.length,0,'no emerging stone during the tell');
 assert.equal(selected.audio.length,0);assert.equal(selected.hp,100);
 if(fatal)await p.evaluate(()=>window.__editorTest.arenaQA.armLethal());
 where='actual contact submits native audio, shaking projection and growing ground fracture';
 const recent=await until(s=>s.q?.kind===kind&&s.q.cursor===1&&s.cracks.length>=3,56);
 assert(recent.damage.some(d=>d.start===selected.q.start&&d.raw===(leapMode?43:39)));
 assert.equal(recent.audio.length,1);
 const audio=recent.audio[0],e=recent.event;
 assert.equal(audio.name,leapMode?'davidLeapStomp':'davidHeavyStomp');
 assert(Math.abs(audio.duration-(leapMode?1.46:1.15))<.001&&audio.linked&&audio.gain>0);
 assert.equal(audio.impact,e.start);
 assert(e.radius===(leapMode?leapRadius:6)&&e.quake===(leapMode?935:705));
 assert(recent.cracks.every(f=>f.age>=0&&f.n>0&&f.alpha>0&&f.radius===e.radius));
 assert(recent.cracks.at(-1).n>recent.cracks[0].n,'cracks spread from the real landing point');
 assert(Math.hypot(recent.cracks[0].fx-selected.q.sx-.5,recent.cracks[0].fz-selected.q.sz-.5)<1);
 const late=await until(s=>s.now>e.start+540,34);
 const rock=late.rock.filter(f=>f.start===e.start),uploads=late.rockBuffers.filter(f=>f.start===e.start);
 assert.equal(uploads.length,1,'actual opaque stone packet uploaded once');
 assert(rock.length>=3&&rock.every(f=>f.age>=0&&f.n===uploads[0].n));
 assert(uploads[0].n%3===0&&uploads[0].n>=(leapMode?800:420));
 assert(uploads[0].slabs>=(leapMode?3:2)&&uploads[0].chips>=8&&uploads[0].width>=(leapMode?1.45:.94));
 assert(uploads[0].height>=(leapMode?.54:.34),'native stone geometry is significantly above floor');
 assert(rock[0].offset<-.15&&rock.some(r=>Math.abs(r.offset)<.002),'stones physically emerge from floor');
 if(process.env.DAVID_STONE_ARTIFACT){
  const {mkdirSync}=await import('node:fs');mkdirSync(process.env.DAVID_STONE_ARTIFACT,{recursive:true});
  await p.screenshot({path:process.env.DAVID_STONE_ARTIFACT+'/'+(fatal?'fatal-leap':kind)+'-peak.png'});
 }
 if(fatal){
  where='real fatal leap keeps both opaque and fissure passes through visible fade, then clears on black relocation';
  assert.equal(late.hp,0);assert.equal(late.death?.phase,'pause');
  const fading=await until(s=>s.death?.phase==='out'&&s.death.opacity>.72,32);
  assert.equal(fading.hp,0);assert.deepEqual(fading.player,recent.player);
  assert(fading.now>e.start+e.duration,'visible death window outlasts normal lifetime');
  assert(fading.rockLive&&fading.crackLive&&Math.abs(fading.rock.at(-1).age-(fading.now-e.start))<2);
  assert(fading.cracks.at(-1).alpha>.65&&Math.abs(fading.cracks.at(-1).age-(fading.now-e.start))<2);
  const black=await until(s=>s.death?.relocated,10);
  assert.equal(black.fade,'1');assert.deepEqual(black.player,[24,91,0],'contextual respawn uses actual forecourt checkpoint, not city');assert(black.hp>0);
  assert(!black.rockLive&&!black.crackLive&&!black.event,'neither geometric effect survives relocation');
  assert.equal(black.damage.length,1);assert.equal(black.audio.length,1);
  assert.deepEqual(errors,[]);
  console.log('PASS real lethal leap retains both WebGL passes until opaque relocation, with exactly one real damage contact');
  process.exitCode=0;
 }else{
 const sinking=await until(s=>s.now>e.start+(leapMode?1200:960),25);
 assert(sinking.rock.filter(f=>f.start===e.start).at(-1).offset<-.10,'stones sink before expiring');
 assert(late.quakes.some(f=>f.age>450&&Math.abs(f.dy)>.00002),'visible rumble lasts past prior camera duration');
 assert(late.cracks.at(-1).alpha<recent.cracks.at(-1).alpha,'draw opacity fades within the extended lifetime');
 const almost=await until(s=>s.now>e.start+e.duration+20,38);
 const prior=almost.cracks.length;await advance(120);const ended=await log();
 assert.equal(ended.cracks.length,prior,'no fracture draw beyond its extended lifetime');
 assert.equal(ended.rock.length,almost.rock.length,'no raised stone draw beyond fissure lifespan');
 assert(!ended.rockLive,'native stone buffer released after expiry');
 console.log(JSON.stringify({kind,audio,e,cracks:[recent.cracks[0],recent.cracks.at(-1)],rock:uploads[0],quakeLate:late.quakes.at(-1)}));
 assert.deepEqual(errors,[]);
 console.log('PASS actual '+kind+' contact and native WebAudio/WebGL crack and extended rumble');
 }
}catch(e){console.error(where,await (p?log().catch(()=>null):null),errors);throw e}
finally{await browser?.close();await new Promise(r=>server.close(r))}
