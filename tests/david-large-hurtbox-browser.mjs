import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
let h=readFileSync(process.argv[2]??'world-editor.html','utf8');
const install=(a,b)=>{assert.equal(h.split(a).length,2,a);h=h.replace(a,b)};
const mark="if(facilityParams.get('test')==='1')window.__editorTest={";

install(" let kind=POI_DAVID_ORDER[d.cycle%POI_DAVID_ORDER.length];"," if(window.__finishManual)return false;\n let kind=POI_DAVID_ORDER[d.cycle%POI_DAVID_ORDER.length];");
install(mark,`
 window.__finish={
  frame:()=>render(),
  place:()=>{
   const {o,s}=poiDavidActive,now=performance.now(),p=poiMonsterPose(o,s,now,true);
   const origin={x:p.x-.5+1.42,z:p.z-.5-.20,y:0};
   if(!workshopResumeRestorePosition({x:Math.round(origin.x),z:Math.round(origin.z),y:0,facing:3}))return null;
   poiFreePose={x:origin.x,z:origin.z,level:0,distance:0,walking:false,angle:Math.PI/2};
   poiWalkFacing=3;poiCombatLockReset();
   return origin;
  },
  state:()=>{
   const {o,s}=poiDavidActive||{},p=o&&poiMonsterPose(o,s,performance.now(),true);
   const a=poiAimOrigin(performance.now()),slot=poiInventorySlots(poiHotbarRead())[0];
   return {now:performance.now(),ready:s?.david?.wakeDone,weapon:poiEquippedWeapon(),hp:s?.hp,
    pending:!!poiPlayerWeaponPending,action:poiWalkActionStarted,durability:slot?.durability,
    a,p:p&&{x:p.x-.5,z:p.z-.5,heading:p.heading}};
  }
 };`+mark);
install(' requestAnimationFrame(render);',' if(!window.__finishManual)requestAnimationFrame(render);');
for(const [,js] of h.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(js);
if(process.env.DAVID_HURTBOX_PARSE_ONLY){console.log('Exact giant-hurtbox browser fixture parses');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const srv=createServer((q,r)=>{r.setHeader('Content-Type','text/html; charset=utf-8');r.end(q.url==='/seed'?'<title>Seed</title>':h)});
await new Promise(r=>srv.listen(0,'127.0.0.1',r));
const root='http://127.0.0.1:'+srv.address().port;let browser;
try{
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 {
  const ctx=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:.65});
  const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(20000);
  await p.clock.install({time:new Date('2026-04-01T10:00:00Z')});
  await p.goto(root+'/seed');await p.evaluate(()=>{const slots=Array(27).fill(null);slots[0]={type:'kitchenKnife',count:1,durability:40};slots[1]={type:'equipWoodSword',count:1};
   localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weaponDurabilityVersion:2,weapon:'kitchenKnife',potions:0,slots}));
   localStorage.setItem('world-workshop-resume-v1',JSON.stringify({
   version:1,route:'facility',id:'base',play:true,position:{x:24,z:102,y:0,facing:2},townLayout:5,townMapHeight:128,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}
  }));});
  await p.goto(root+'/?resume=1&test=1',{waitUntil:'domcontentloaded'});await p.locator('#pineStartupCover').waitFor({state:'hidden'});
  await p.clock.pauseAt(await p.evaluate(()=>Date.now()+150));
  await p.evaluate(()=>{window.__finishManual=true});


  const qa=()=>p.evaluate(()=>window.__finish.state());
  const frame=async(ms=40)=>{await p.clock.fastForward(ms);await p.evaluate(()=>window.__finish.frame());};
  const until=async(check,limit=95)=>{let q=await qa();for(let i=0;i<limit&&!check(q);i++){await frame();q=await qa()}assert(check(q),JSON.stringify(q));return q};
  await until(s=>s.ready);
  assert(await p.evaluate(()=>window.__finish.place()));
  await frame(20);
  const before=await qa();
  assert.equal(before.weapon,'kitchenKnife');
  assert(Math.hypot(before.a.x-before.p.x,before.a.z-before.p.z)>1.35,JSON.stringify(before));
  const button=await p.locator('#poiWalkAction').boundingBox();assert(button);
  await p.touchscreen.tap(button.x+button.width/2,button.y+button.height/2);
  const after=await until(s=>s.action>before.action&&!s.pending,15);
  assert(after.hp<before.hp,JSON.stringify({before,after}));
  assert.equal(after.durability,before.durability-1);
  assert.deepEqual(errors,[]);
  console.log('Physical 1-tile knife damaged actual David outside center range',JSON.stringify({before,after}));
  await ctx.close();
 }
}finally{await browser?.close();await new Promise(r=>srv.close(r))}
