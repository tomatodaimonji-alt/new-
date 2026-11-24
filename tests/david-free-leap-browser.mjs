import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
let html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const hook="if(facilityParams.get('test')==='1')window.__editorTest={";
assert.equal(html.split(hook).length,2);
html=html.replace(hook,`
 window.__freeDavidQA={
  state:()=>{
   const b=facilitySite?.davidTemple?.boss,[o,s]=[...poiMonsterStates].find(([o])=>o.type==='monsterStoneDavid')||[];
   if(!s)return null;
   const now=performance.now(),p=poiDavidGroundPoint(s,now),live=poiMonsterPose(o,s,now),d=s.david,a=d?.attack,l=s.actorFree;
   return {now,player:[poiWalkX,poiWalkZ],occupied:[s.x,s.z],x:p.x,z:p.z,t:p.t,
    rendered:[live.x-.5,live.z-.5],gait:live.david?.walkDistance,plant:d?.footPlantCount,
    awake:!!d?.awake,returning:!!d?.returning,attack:a?{kind:a.kind,sx:a.sx,sz:a.sz,leap:a.leap??null}:null,leg:l?{fromX:l.fromX,fromZ:l.fromZ,x:l.x,z:l.z,ms:l.ms}:null,
    dormant:!d?.awake,wall:facilitySite?.davidTemple?.resumeSolid.find(q=>q.type==='poiDavidWallRound'&&q.x===24&&q.z>119)?.z??null};
  },
  relocate:(x,z)=>workshopResumeRestorePosition({x,z,y:0,facing:2}),
  wallTest:()=>{
   const [o,s]=[...poiMonsterStates].find(([o])=>o.type==='monsterStoneDavid'),b=facilitySite.davidTemple.boss;
   return [poiDavidFreePlan(o,s,b,{x:24,z:119.7},24,121.3)===null,poiDavidFreePlan(o,s,b,{x:24,z:118},24.4,118.4)!==null];
  }
 };`+hook);
for(const [,s] of html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(s);
if(process.env.DAVID_FREE_PARSE_ONLY){console.log('true game movement fixture parses');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>Test seed</title>':html)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser,p,phase='boot';
const read=()=>p.evaluate(()=>window.__freeDavidQA.state());
try{
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 p=await (await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:.65})).newPage();
 p.setDefaultTimeout(15000);const errors=[];p.on('pageerror',e=>errors.push(e.message));
 const root='http://127.0.0.1:'+server.address().port;
 await p.goto(root+'/seed');await p.evaluate(()=>localStorage.setItem('world-workshop-resume-v1',JSON.stringify({
  version:1,route:'facility',id:'base',play:true,position:{x:28,z:108,y:0,facing:2},townLayout:5,townMapHeight:128,
  view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}
 })));
 await p.goto(root+'/?resume=1&test=1',{waitUntil:'domcontentloaded'});
 await p.locator('#pineStartupCover').waitFor({state:'hidden'});
 // After v290 entering the room no longer wakes David from across it.
 // First approach the new real radius, then keep the original wide
 // diagonal chase and jump assertions by stepping back during waking.
 if(/POI_DAVID_WAKE_RANGE=2(?:,|;)/.test(html)){
  phase='authored close discovery then original movement scenario';
  assert((await read()).dormant,'original far checkpoint still leaves statue dormant');
  assert(await p.evaluate(()=>window.__freeDavidQA.relocate(25,105)));
  await p.waitForFunction(()=>window.__freeDavidQA.state()?.awake,null,{timeout:6000});
  assert(await p.evaluate(()=>window.__freeDavidQA.relocate(28,108)));
 }
 phase='actual angular direction and center during live diagonal movement';
 await p.waitForFunction(()=>{const s=window.__freeDavidQA.state();return s?.leg&&s.t>.1&&s.t<.92},{},{timeout:9000});
 const a=await read();
 assert(a.leg&&Math.abs(a.leg.x-a.leg.fromX)>.2&&Math.abs(a.leg.z-a.leg.fromZ)>.2,'both axes change on the same actual movement leg');
 assert(Math.abs((a.leg.x-a.leg.fromX)-(a.leg.z-a.leg.fromZ))<.03,'diagonal is an actual trajectory, not a cardinal sequence');
 assert(Math.hypot(a.rendered[0]-a.x,a.rendered[1]-a.z)<.001);
 assert(a.gait>0&&a.gait<=1);
 assert.deepEqual(await p.evaluate(()=>window.__freeDavidQA.wallTest()),[true,true]);
 phase='attack origin comes from the actual settled fractional center';
 await p.waitForFunction(()=>window.__freeDavidQA.state()?.attack?.kind==='sweep',null,{timeout:8500});
 const strike=await read();
 assert(Math.hypot(strike.attack.sx-strike.x,strike.attack.sz-strike.z)<.001&&Math.abs(strike.x-Math.round(strike.x))>.1);
 phase='actual airborne leap launches from settled fractional path, then valid reserved landing';
 assert(await p.evaluate(()=>window.__freeDavidQA.relocate(31,109)));
 await p.waitForFunction(()=>{const d=window.__freeDavidQA.state(),l=d?.attack?.leap;
  return l&&d.now>=l.launch+105&&d.now<l.land-55;
 },null,{timeout:8000});
 const launch=await read(),l=launch.attack.leap;
 assert(Math.hypot(l.x0-strike.x,l.z0-strike.z)<.002,'takeoff shares actual fractional ground endpoint');
 assert(Number.isInteger(l.x)&&Number.isInteger(l.z));
 assert.deepEqual(l.entry,{x:Math.floor(l.x0+.5),z:Math.floor(l.z0+.5)},'proved grounded return waypoint reconnects fractional launch to original cardinal route');
 assert.equal(Math.abs(l.entry.x-l.route[0].x)+Math.abs(l.entry.z-l.route[0].z),1);
 assert(Math.hypot(launch.rendered[0]-l.x0,launch.rendered[1]-l.z0)>.2,'actual rendered leap advances through the air');
 await p.waitForFunction(({x,z})=>{const d=window.__freeDavidQA.state();return d.x===x&&d.z===z&&!d.leg;},l,{timeout:4000});
 const landed=await read();assert.equal(landed.occupied[0],l.x);assert.equal(landed.occupied[1],l.z);
 phase='exit and actual returned statue at its original position';
 assert(await p.evaluate(()=>window.__freeDavidQA.relocate(24,91)));
 await p.waitForFunction(()=>window.__freeDavidQA.state()?.returning,null,{timeout:5000});
 const retreat=await read();assert.deepEqual(retreat.player,[24,91]);assert(retreat.gait>=a.gait);
 await p.waitForFunction(()=>{const d=window.__freeDavidQA.state();return d.dormant&&d.x===24&&d.z===104&&!d.leg},null,{timeout:9000});
 assert.deepEqual(errors,[]);
 console.log('True diagonal and contact/return proofs',JSON.stringify({ground:a,origin:strike.attack,launch:l,landed:[landed.x,landed.z],final:await read()}));
}catch(e){console.error('David free native',phase,await read().catch(()=>null));throw e}
finally{await browser?.close();await new Promise(r=>server.close(r))}
