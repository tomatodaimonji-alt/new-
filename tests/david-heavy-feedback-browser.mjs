import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const key='  freeMovementPose:()=>({x:poiWalkViewX,z:poiWalkViewZ,level:poiWalkLevel}),';
function inject(s,a,b){assert.equal(s.split(a).length,2,a);return s.replace(a,b)}
let fixture=inject(html,key,key+`
  arenaQA:{
   manual:()=>{window.__arenaManual=true},
   draw:()=>render(),
   get:()=>{
    const m=[...poiMonsterStates].find(([o])=>o.type==='monsterStoneDavid'),s=m?.[1],d=s?.david,q=d?.attack;
    const renderPose=m?poiMonsterPose(m[0],s,performance.now()):null;
    const rig=renderPose?.david?poiDavidRig(renderPose.david):null;
    return {now:performance.now(),nextMob:poiNextMobTick,nextStep:poiWalkNextReady,arena:facilitySite.davidTemple.boss.room.arena,
      player:[poiWalkX,poiWalkZ,poiWalkLevel],pose:[poiWalkViewX,poiWalkViewZ],free:!!poiFreePose,hp:poiPlayerHP,boss:s?[s.x,s.z]:null,awake:!!d?.awake,returning:!!d?.returning,renderPose:renderPose?{x:renderPose.x,y:renderPose.y,z:renderPose.z,david:renderPose.david}:null,
      rig:rig?{crouch:rig.leapCrouch??0,feet:rig.feet.map(p=>p[1])}:null,q:q?{kind:q.kind,start:q.start,cursor:q.cursor,dx:q.dx,dz:q.dz,sx:q.sx,sz:q.sz,leap:q.leap,hits:q.hits}:null,
      cue:window.__arenaCue??[],steps:window.__davidStepSources??[],shakes:window.__davidProjected??[],damage:window.__arenaDamage??[]};
   }
  },`);
fixture=inject(fixture,' requestAnimationFrame(render);',' if(!window.__arenaManual)requestAnimationFrame(render);');
fixture=inject(fixture,'function poiDavidMobFrame(o,s,now){','function poiDavidMobFrame(o,s,now){if(!window.__arenaManual)return false;');
fixture=inject(fixture,'function poiWildRegionalFrame(now,rng){','function poiWildRegionalFrame(now,rng){return;');
fixture=inject(fixture,'function poiWildPick(rng){','function poiWildPick(rng){return null;');
fixture=inject(fixture,'draw(poiDavidCue.lane,vp)','draw(poiDavidCue.lane,vp);if(q.kind==="leap"){const a=window.__arenaCue??=[];if(a.length<70)a.push({start:q.start,vertices:poiDavidCue.lane.count,now})}');
fixture=inject(fixture,' const priorHP=poiPlayerHP;',' const priorHP=poiPlayerHP;if(obj.type==="monsterStoneDavid")(window.__arenaDamage??=[]).push({start:poiDavidActive?.s?.david?.attack?.start,raw,amount,now});');
fixture=inject(fixture,'function poiDavidLeapBegin(o,s,b,p,now,distance){','function poiDavidLeapBegin(o,s,b,p,now,distance){return false;'); // separate leap QA exercises the genuine jump
fixture=inject(fixture,"  if(ctx?.state==='running')try{poiTryRecordedFoley('davidFootPlant',ctx.currentTime,gain,poiDavidTrackAttackFoley)}catch{}",`  if(ctx?.state==='running')try{
    poiTryRecordedFoley('davidFootPlant',ctx.currentTime,gain,(source,node)=>{
     poiDavidTrackAttackFoley(source,node);
     (window.__davidStepSources??=[]).push({now,gain,buffer:source.buffer.length,distance});
    });
   }catch{}`);
fixture=inject(fixture," if(typeof poiDavidImpactVp==='function')p.vp=poiDavidImpactVp(p,now);",
 ` if(typeof poiDavidImpactVp==='function'){
  const old=p.vp;p.vp=poiDavidImpactVp(p,now);
  if(old!==p.vp){const e=poiDavidHeavyBump;(window.__davidProjected??=[]).push({now,start:e?.start,cap:e?.cap,dy:Math.abs(p.vp[13]-old[13])});}
 }`);
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
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 p=await browser.newPage({viewport:{width:844,height:390},deviceScaleFactor:.7,isMobile:true,hasTouch:true});
 p.on('pageerror',e=>errors.push(e.message));
 await p.clock.install({time:new Date('2026-11-24T12:00:00Z')});
 where='cold authored save, distance six to wake';
 await p.goto(url+'/seed');
 await p.evaluate(()=>{
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:24,z:156,y:0,facing:0},townLayout:5,townMapHeight:182,templeDepth:1,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.35,orbitDistance:5.5}}));
  localStorage.setItem('world-workshop-hotbar-v1','{"version":1,"weapon":"equipWoodSword","potions":0,"gold":0}');
 });
 await p.goto(url+'/?resume=1&test=1',{waitUntil:'domcontentloaded',timeout:25000});
 await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:23000});
 await p.waitForFunction(()=>window.__editorTest?.arenaQA&&window.__editorTest.facility().active,null,{timeout:12000});
 const initial=await log();
 assert.deepEqual(initial.player,[24,156,0]);assert.deepEqual(initial.boss,[24,158]);assert.equal(initial.hp,100);
 await p.evaluate(()=>window.__editorTest.arenaQA.manual());
 const wall=await p.evaluate(()=>Date.now());await p.clock.pauseAt(wall+1500);
 const advance=async(ms=48)=>{await p.clock.fastForward(ms);await p.evaluate(()=>window.__editorTest.arenaQA.draw());};
 const until=async(pred,n)=>{let s=await log();for(let i=0;i<n&&!pred(s);i++){await advance();s=await log()}assert(pred(s),JSON.stringify(s));return s};
 const aligned=await log(),debt=Math.ceil(aligned.nextMob-aligned.now);
 if(debt>0)await p.clock.fastForward(debt+16);
 where='trusted mobile gesture audio unlocks';
 await p.touchscreen.tap(450,185);
 where='wake naturally and walk north to pull the boss';
 await until(s=>s.awake,45);
 for(let z=97;z>=95;z--){
  await p.keyboard.press('ArrowUp');
  const s=await until(s=>s.player[1]===z&&s.now>=s.nextStep,10);
  assert.deepEqual(s.player,[24,z,0]);
 }
 where='real gait step starts a decoded Web Audio source and projected contact';
 const planted=await until(s=>s.steps.some(e=>e.buffer===7440)&&s.shakes.some(e=>e.cap===.024&&e.dy>0),55);
 assert(planted.boss[1]<158);assert.equal(new Set(planted.steps.map(e=>e.now)).size,planted.steps.length);
 assert(planted.steps.every(e=>e.gain>0&&e.gain<.39));
 const orig=planted.steps.length;
 where='real sword contact projects its own small camera bump while statue is planted';
 const swung=await until(s=>s.q?.kind==='sweep'&&s.shakes.some(e=>e.cap===.036&&e.dy>0),48);
 assert(swung.steps.length>=orig);
 const still=swung.steps.length;
 await advance(180);
 const fixed=await log();assert.equal(fixed.steps.length,still,'holding still during recovery makes no extra foot sounds');
 assert.deepEqual(errors,[]);
 console.log('PASS live David planted source + projected step/sweep contact; no phantom stationary sounds');
}catch(e){console.error(where,await (p?log().catch(()=>null):null),errors);throw e}
finally{await browser?.close();await new Promise(r=>server.close(r))}
