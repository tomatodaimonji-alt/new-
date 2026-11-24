import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
let h=readFileSync(process.argv[2]??'world-editor.html','utf8');
const install=(a,b)=>{assert.equal(h.split(a).length,2,a);h=h.replace(a,b)};
const mark="if(facilityParams.get('test')==='1')window.__editorTest={";

install(' const r=poiDavidRig(pose),P=v=>',' const r=poiDavidRig(pose);if(window.__finish)window.__finish.draw={pose,right:r.hands[1],left:r.hands[0]};const P=v=>');
install(" let kind=POI_DAVID_ORDER[d.cycle%POI_DAVID_ORDER.length];"," if(window.__finishManual)return false;\n let kind=POI_DAVID_ORDER[d.cycle%POI_DAVID_ORDER.length];");
install(mark,`
 window.__finish={
  frame:()=>render(),
  prepare:hp=>{
   const {o,s}=poiDavidActive??{};
   if(!s?.david?.wakeDone||s.david.attack)return false;
   poiPlayerHP=hp;
   return poiDavidBegin(o,s,performance.now(),'double');
  },
  state:()=>{
   const live=poiDavidActive,s=live?.s,d=s?.david,q=d?.attack;
   return {now:performance.now(),d:d&&{wake:d.wakeDone,next:d.next,returning:!!d.returning,finish:!!d.deathFinish},
    q:q&&{cursor:q.cursor,landed:q.landed,executed:q.executed,hits:q.hits,until:q.until},
    death:poiPlayerDeathSnapshot(),draw:window.__finish.draw,hp:poiPlayerHP,boss:s?[s.x,s.z]:null};
  }
 }; `+mark);
install(' requestAnimationFrame(render);',' if(!window.__finishManual)requestAnimationFrame(render);');
for(const [,js] of h.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(js);
if(process.env.DAVID_DEATH_FINISH_PARSE_ONLY){console.log('Exact death-finish browser fixture parses');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const srv=createServer((q,r)=>{r.setHeader('Content-Type','text/html; charset=utf-8');r.end(q.url==='/seed'?'<title>Seed</title>':h)});
await new Promise(r=>srv.listen(0,'127.0.0.1',r));
const root='http://127.0.0.1:'+srv.address().port;let browser;
try{
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 for(const lethal of [false,true]){
  const ctx=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:.65});
  const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(20000);
  await p.clock.install({time:new Date('2026-04-01T10:00:00Z')});
  await p.goto(root+'/seed');await p.evaluate(()=>localStorage.setItem('world-workshop-resume-v1',JSON.stringify({
   version:1,route:'facility',id:'base',play:true,position:{x:24,z:156,y:0,facing:2},townLayout:5,townMapHeight:182,templeDepth:1,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}
  })));
  await p.goto(root+'/?resume=1&test=1',{waitUntil:'domcontentloaded'});await p.locator('#pineStartupCover').waitFor({state:'hidden'});
  await p.clock.pauseAt(await p.evaluate(()=>Date.now()+150));
  await p.evaluate(()=>{window.__finishManual=true});

  const qa=()=>p.evaluate(()=>window.__finish.state());
  const frame=async(ms=40)=>{await p.clock.fastForward(ms);await p.evaluate(()=>window.__finish.frame());};
  const until=async(check,limit=95)=>{let q=await qa();for(let i=0;i<limit&&!check(q);i++){await frame();q=await qa()}assert(check(q),JSON.stringify(q));return q};
  await until(s=>s.d?.wake&&s.now>=s.d.next);
  assert(await p.evaluate(hp=>window.__finish.prepare(hp),lethal?1:100),JSON.stringify(await qa()));
  if(!lethal){
   const live=await until(s=>s.q?.executed===2);
   assert(live.hp>0&&live.hp<100&&!live.death&&!live.d.finish&&live.q.landed===2,JSON.stringify(live));
   assert.deepEqual(errors,[]);await ctx.close();continue;
  }
  const dead=await until(s=>s.death?.phase==='pause');
  assert.equal(dead.hp,0);assert(dead.q?.cursor===1&&dead.q.executed===1&&dead.d.finish&&!dead.d.returning,JSON.stringify(dead));
  const after=await until(s=>s.q?.cursor===2&&s.draw?.pose?.contact===2);
  assert.equal(after.hp,0);assert.equal(after.q.executed,1);assert.equal(after.q.landed,1);
  assert.notDeepEqual(after.draw.right,dead.draw.right);
  assert.equal(after.death.opacity,0);
  await until(s=>!s.d?.finish&&(!s.q));
  const respawn=await until(s=>s.death?.relocated);
  assert(respawn.hp>0&&respawn.death.blackAt-dead.death.start>=1650);
  const cleared=await until(s=>!s.death);assert.equal(cleared.hp,respawn.hp);assert(!cleared.q);
  for(let i=0;i<12;i++)await frame();assert.equal((await qa()).hp,respawn.hp);assert(!(await qa()).q);
  assert.deepEqual(errors,[]);
  console.log('Actual lethal blade, rendered second blade without another hit, then original return and defeated-player respawn');
  await ctx.close();
 }
}finally{await browser?.close();await new Promise(r=>srv.close(r))}
