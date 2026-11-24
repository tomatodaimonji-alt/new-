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
      cue:window.__arenaCue??[],damage:window.__arenaDamage??[]};
   }
  },`);
fixture=inject(fixture,' requestAnimationFrame(render);',' if(!window.__arenaManual)requestAnimationFrame(render);');
fixture=inject(fixture,'function poiDavidMobFrame(o,s,now){','function poiDavidMobFrame(o,s,now){if(!window.__arenaManual)return false;');
fixture=inject(fixture,'function poiWildRegionalFrame(now,rng){','function poiWildRegionalFrame(now,rng){return;');
fixture=inject(fixture,'function poiWildPick(rng){','function poiWildPick(rng){return null;');
fixture=inject(fixture,'draw(poiDavidCue.lane,vp)','draw(poiDavidCue.lane,vp);if(q.kind==="leap"){const a=window.__arenaCue??=[];if(a.length<70)a.push({start:q.start,vertices:poiDavidCue.lane.count,now})}');
fixture=inject(fixture,' const priorHP=poiPlayerHP;',' const priorHP=poiPlayerHP;if(obj.type==="monsterStoneDavid")(window.__arenaDamage??=[]).push({start:poiDavidActive?.s?.david?.attack?.start,raw,amount,now});');
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
 where='cold authored save, just within wake range';
 await p.goto(url+'/seed');
 await p.evaluate(()=>{
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:24,z:110,y:0,facing:0},townLayout:5,townMapHeight:128,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.35,orbitDistance:5.5}}));
  localStorage.setItem('world-workshop-hotbar-v1','{"version":1,"weapon":"equipWoodSword","potions":0,"gold":0}');
 });
 await p.goto(url+'/?resume=1&test=1',{waitUntil:'domcontentloaded',timeout:25000});
 await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:23000});
 await p.waitForFunction(()=>window.__editorTest?.arenaQA&&window.__editorTest.facility().active,null,{timeout:12000});
 const initial=await log();
 assert.deepEqual(initial.player,[24,110,0]);assert.deepEqual(initial.boss,[24,104]);assert.equal(initial.hp,100);
 await p.evaluate(()=>window.__editorTest.arenaQA.manual());
 const wall=await p.evaluate(()=>Date.now());await p.clock.pauseAt(wall+1500);
 const advance=async(ms=48)=>{await p.clock.fastForward(ms);await p.evaluate(()=>window.__editorTest.arenaQA.draw());};
 const until=async(pred,n)=>{let s=await log();for(let i=0;i<n&&!pred(s);i++){await advance();s=await log()}assert(pred(s),JSON.stringify(s));return s};
 const aligned=await log(),debt=Math.ceil(aligned.nextMob-aligned.now);
 if(debt>0)await p.clock.fastForward(debt+16);
 where='wake through real scheduler, then actual walk beyond leap threshold';
 await until(s=>s.awake,45);
 for(let z=111;z<=112;z++){
  await p.keyboard.press('ArrowDown');
  const s=await until(s=>s.player[1]===z&&s.now>=s.nextStep,10);
  assert.deepEqual(s.player,[24,z,0]);
 }
 const pending=await until(s=>s.q?.kind==='leap'&&s.q.cursor===0&&s.cue.some(a=>a.start===s.q.start&&a.vertices>50),45);
 assert(pending.q.leap.z>=110&&pending.q.leap.z<112,'the real scheduler fixes a valid tile short of player');
 assert.deepEqual(pending.boss,[24,104]);assert.equal(pending.hp,100);assert.equal(pending.damage.length,0);
 where='airborne real published mesh moves and rises before hurting';
 const airborne=await until(s=>s.renderPose?.david?.phase==='airborne'&&s.renderPose.david.leapHeight>.8,18);
 assert.deepEqual(airborne.boss,[24,104]);
 assert(airborne.renderPose.z>106&&airborne.renderPose.y>pending.renderPose.y+.8);
 assert.equal(airborne.hp,100);assert.equal(airborne.q.leap.z,pending.q.leap.z);
 where='real fixed landing and distinct recover pose';
 const recovery=await until(s=>s.damage.some(d=>d.start===pending.q.start)&&s.renderPose?.david?.phase==='recover',20);
 const d=recovery.damage.filter(x=>x.start===pending.q.start);
 assert.equal(d.length,1);assert.equal(d[0].raw,43);assert.equal(recovery.hp,100-d[0].amount);
 assert.deepEqual(recovery.boss,[pending.q.leap.x,pending.q.leap.z]);assert(recovery.now>=pending.q.hits[0]);
 assert(recovery.renderPose.david.progress>=0&&recovery.renderPose.david.progress<.5);
 assert(recovery.rig?.crouch>0.45&&recovery.rig.feet.every(y=>Math.abs(y)<1e-6),'recovery mesh keeps both feet planted with visibly bent legs');
 assert.deepEqual(errors,[]);
 console.log('PASS actual walking triggers committed jump, radius cue, visible translated airtime, one raw landing, and real recovery');
}catch(e){console.error(where,await (p?log().catch(()=>null):null),errors);throw e}
finally{await browser?.close();await new Promise(r=>server.close(r))}
