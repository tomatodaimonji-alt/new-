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
    const now=performance.now(),pose=m&&poiMonsterPose(m[0],s,now),rig=pose?.david&&poiDavidRig(pose.david);
    const part=mesh();window.__travelEdgeRows=[];if(pose)poiDavidGeometry(part,pose.x,pose.y,pose.z,pose.david);
    return {gait:pose?{z:pose.z,phase:pose.david.phase,kind:pose.david.kind,amount:pose.david.walkAmount,
      distance:pose.david.walkDistance,heading:pose.heading,feet:rig.feet,bladeEdges:window.__travelEdgeRows,vertices:part.p.length/3,mesh:poiMonsterMesh?.count??0}:null,
      now,nextMob:poiNextMobTick,nextStep:poiWalkNextReady,arena:facilitySite.davidTemple.boss.room.arena,
      player:[poiWalkX,poiWalkZ,poiWalkLevel],pose:[poiWalkViewX,poiWalkViewZ],free:!!poiFreePose,hp:poiPlayerHP,boss:s?[s.x,s.z]:null,awake:!!d?.awake,returning:!!d?.returning,
      q:q?{kind:q.kind,start:q.start,cursor:q.cursor,dx:q.dx,dz:q.dz,sx:q.sx,sz:q.sz}:null,
      cue:window.__arenaCue??[],damage:window.__arenaDamage??[]};
   }
  },`);
fixture=inject(fixture,'  const base=ring(.26,.25,.078),taper=ring(2.68,.16,.068);',
 '  const base=ring(.26,.25,.078),taper=ring(2.68,.16,.068);if(window.__travelEdgeRows?.length<2)window.__travelEdgeRows.push({edge:taper[2][1]-taper[0][1],face:taper[1][1]-taper[3][1],tip:tip[1]-g[1]});');
fixture=inject(fixture,' requestAnimationFrame(render);',' if(!window.__arenaManual)requestAnimationFrame(render);');
fixture=inject(fixture,'function poiDavidMobFrame(o,s,now){','function poiDavidMobFrame(o,s,now){if(!window.__arenaManual)return false;');
// With the additive leap feature installed, testing plain foot travel
// requires keeping the optional distance jump off. Its exact native
// encounter is covered by david-leap-browser, not by this stride test.
const extraLeap='function poiDavidLeapBegin(o,s,b,p,now,distance){';
if(fixture.includes(extraLeap))fixture=inject(fixture,extraLeap,extraLeap+'return false;');
fixture=inject(fixture,'function poiWildRegionalFrame(now,rng){','function poiWildRegionalFrame(now,rng){return;');
fixture=inject(fixture,'function poiWildPick(rng){','function poiWildPick(rng){return null;');
fixture=inject(fixture,'draw(poiDavidCue.lane,vp)','draw(poiDavidCue.lane,vp);if(q.kind==="sweep"){const a=window.__arenaCue??=[];if(a.length<70)a.push({start:q.start,vertices:poiDavidCue.lane.count,now})}');
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
 const samples=[];
 const advance=async(ms=48)=>{await p.clock.fastForward(ms);await p.evaluate(()=>window.__editorTest.arenaQA.draw());samples.push((await log()).gait);};
 const until=async(pred,n)=>{let s=await log();for(let i=0;i<n&&!pred(s);i++){await advance();s=await log()}assert(pred(s),JSON.stringify(s));return s};
 const aligned=await log(),debt=Math.ceil(aligned.nextMob-aligned.now);
 if(debt>0)await p.clock.fastForward(debt+16);
 where='wait for real awakening completion without altering the boss clock';
 await until(s=>s.awake&&s.gait&&!['dormant','wake'].includes(s.gait.phase),106);
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
 const activeStride=g=>g?.kind==null&&g?.phase==='ready'&&g.amount>.999&&g.vertices>400&&g.mesh>400&&Math.abs(g.heading)<.07;
 const still=await until(s=>s.boss?.[1]>=112&&samples.filter(activeStride).length>=8,78);
 assert(still.hp>0);assert.deepEqual(still.player,[24,119,0]);assert(still.awake&&!still.returning);
 where='real frame-by-frame stone stride across authored chase cells';
 const straight=samples.filter(activeStride);
 assert(straight.length>=8,JSON.stringify(straight));
 for(const g of straight){
  assert.equal(g.bladeEdges.length,2);
  for(const b of g.bladeEdges) assert(b.edge>.245&&Math.abs(b.face)<.01&&b.tip<-1.8,JSON.stringify(g));
 }
 let longest=0,swing=0;
 for(const a of straight)for(const b of straight){
  if(b.distance<=a.distance||b.distance-a.distance>1.70)continue;
  for(let i=0;i<2;i++){
   const low=straight.filter(g=>g.distance>=a.distance&&g.distance<=b.distance);
   if(a.feet[i][1]||b.feet[i][1]||low.some(g=>g.feet[i][1]>.005))continue;
   if(Math.abs((a.z+a.feet[i][2])-(b.z+b.feet[i][2]))>.04)continue;
   longest=Math.max(longest,b.z-a.z);
   swing=Math.max(swing,...low.map(g=>g.feet[1-i][1]));
  }
 }
 assert(longest>=1.03&&swing>.35,JSON.stringify({longest,swing,straight}));
 assert.deepEqual(errors,[]);
 console.log('PASS real frame/mesh pursuit, vertical cutting edges and unchanged downward shaft angle, fixed terrain foot spanning >1 cell and preserved 5-tile sweep', {longest,swing});
}catch(e){console.error(where,await (p?log().catch(()=>null):null),errors);throw e}
finally{await browser?.close();await new Promise(r=>server.close(r))}
