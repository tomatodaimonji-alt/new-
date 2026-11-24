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
    return {now:performance.now(),nextMob:poiNextMobTick,nextStep:poiWalkNextReady,arena:facilitySite.davidTemple.boss.room.arena,
      player:[poiWalkX,poiWalkZ,poiWalkLevel],pose:[poiWalkViewX,poiWalkViewZ],free:!!poiFreePose,hp:poiPlayerHP,boss:s?[s.x,s.z]:null,awake:!!d?.awake,returning:!!d?.returning,
      q:q?{kind:q.kind,start:q.start,cursor:q.cursor,dx:q.dx,dz:q.dz,sx:q.sx,sz:q.sz}:null,
      cue:window.__arenaCue??[],damage:window.__arenaDamage??[]};
   }
  },`);
fixture=inject(fixture,' requestAnimationFrame(render);',' if(!window.__arenaManual)requestAnimationFrame(render);');
fixture=inject(fixture,'function poiDavidMobFrame(o,s,now){','function poiDavidMobFrame(o,s,now){if(!window.__arenaManual)return false;');
fixture=inject(fixture,'function poiWildRegionalFrame(now,rng){','function poiWildRegionalFrame(now,rng){return;');
fixture=inject(fixture,'function poiWildPick(rng){','function poiWildPick(rng){return null;');
fixture=inject(fixture,'draw(poiDavidCue.lane,vp)','draw(poiDavidCue.lane,vp);if(q.kind==="sweep"){const a=window.__arenaCue??=[];if(a.length<70)a.push({start:q.start,vertices:poiDavidCue.lane.count,now})}');
fixture=inject(fixture,' const priorHP=poiPlayerHP;',' const priorHP=poiPlayerHP;if(obj.type==="monsterStoneDavid")(window.__arenaDamage??=[]).push({start:poiDavidActive?.s?.david?.attack?.start,raw,amount,now});');
// This older fixture's proof is specifically ground pursuit. The normal
// leap lane is exercised independently by david-leap-browser.
fixture=inject(fixture,'function poiDavidLeapBegin(o,s,b,p,now,distance){','function poiDavidLeapBegin(o,s,b,p,now,distance){return false;');
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
 where='real cold authored save, beyond old sweep radius';
 await p.goto(url+'/seed');
 await p.evaluate(()=>{
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:24,z:109,y:0,facing:0},townLayout:5,townMapHeight:128,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.35,orbitDistance:5.5}}));
  localStorage.setItem('world-workshop-hotbar-v1','{"version":1,"weapon":"equipWoodSword","potions":0,"gold":0}');
 });
 await p.goto(url+'/?resume=1&test=1',{waitUntil:'domcontentloaded',timeout:25000});
 await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:23000});
 await p.waitForFunction(()=>window.__editorTest?.arenaQA&&window.__editorTest.facility().active,null,{timeout:12000});
 const initial=await log();
 assert.deepEqual(initial.player,[24,109,0]);assert.deepEqual(initial.boss,[24,104]);assert.equal(initial.hp,100);
 await p.evaluate(()=>window.__editorTest.arenaQA.manual());
 const wall=await p.evaluate(()=>Date.now());await p.clock.pauseAt(wall+1500);
 const advance=async(ms=48)=>{await p.clock.fastForward(ms);await p.evaluate(()=>window.__editorTest.arenaQA.draw());};
 const until=async(pred,n)=>{let s=await log();for(let i=0;i<n&&!pred(s);i++){await advance();s=await log()}assert(pred(s),JSON.stringify(s));return s};
 const aligned=await log(),debt=Math.ceil(aligned.nextMob-aligned.now);
 if(debt>0)await p.clock.fastForward(debt+16);
 where='real scheduler and warning at 5.0 tiles';
 const pending=await until(s=>s.q?.kind==='sweep'&&s.q.cursor===0&&s.cue.some(a=>a.start===s.q.start&&a.vertices>30),53);
 assert.deepEqual([pending.q.sx,pending.q.sz,pending.q.dx,pending.q.dz],[24,104,0,1]);
 assert.equal(pending.hp,100);assert.equal(pending.damage.length,0);
 const impact=await until(s=>s.damage.some(d=>d.start===pending.q.start),16);
 const d=impact.damage.filter(x=>x.start===pending.q.start);
 assert.equal(d.length,1);assert.equal(d[0].raw,30);assert.equal(impact.hp,100-d[0].amount);
 where='physically walk the south gallery outside old rectangle';
 for(let z=110;z<=119;z++){
  await p.keyboard.press('ArrowDown');
  const s=await until(s=>s.player[1]===z&&s.now>=s.nextStep,10);
  assert.deepEqual(s.player,[24,z,0]);assert(s.awake&&!s.returning,'no old rectangular disengage: '+z);
 }
 const still=await until(s=>s.boss?.[1]>=112,50);
 assert(still.hp>0);assert.deepEqual(still.player,[24,119,0]);assert(still.awake&&!still.returning);
 where='actual fractional thumb travel beyond the old radius remains inside authored tile';
 for(let x=25;x<=29;x++){
  await p.keyboard.press('ArrowRight');
  const s=await until(s=>s.player[0]===x&&s.now>=s.nextStep,10);
  assert.deepEqual(s.player,[x,119,0]);assert(s.awake&&!s.returning);
 }
 const pad=await p.locator('#poiAnalogPad').boundingBox();assert(pad);
 const cdp=await p.context().newCDPSession(p);
 const left={x:Math.round(pad.x+pad.width/2),y:Math.round(pad.y+pad.height/2),id:1,force:.7,radiusX:4,radiusY:4};
 try{
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[left]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...left,x:left.x+8,y:left.y+37}]});
  const rim=await until(s=>s.free&&Math.hypot(s.pose[0]-24,s.pose[1]-104)>16.95,30);
  assert(rim.awake&&!rim.returning,'real fractional wall-adjacent position stays in combat');
  assert.deepEqual(rim.player,[29,120,0]);
 }finally{
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
 }
 assert.deepEqual(errors,[]);
 console.log('PASS real 5-tile sweep warning/damage and true south gallery pursuit to '+JSON.stringify(still.boss));
}catch(e){console.error(where,await (p?log().catch(()=>null):null),errors);throw e}
finally{await browser?.close();await new Promise(r=>server.close(r))}
