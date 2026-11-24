import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {Script} from 'node:vm';
let html=readFileSync(process.argv[2]??'world-editor.html','utf8');
function put(a,b){assert.equal(html.split(a).length,2,a);html=html.replace(a,b)}
const api="if(facilityParams.get('test')==='1')window.__editorTest={";
put(api,api+`
 davidAllyQA:{
   frame:()=>render(),state:()=>{
    const d=poiDavidActive,a=poiCompanionActor,v=poiCompanionSnapshot(performance.now()),q=d?.s?.david?.attack;
    return {...v,player:poiAimOrigin(performance.now()),hpPlayer:poiPlayerHP,lastSwing:poiWalkActionStarted,
     free:a?{goal:a.freeGoal?[a.freeGoal.x,a.freeGoal.z]:null,at:a.freeAt,dx:a.freeDx,dz:a.freeDz,follow:a.freeFollows}:null,
     target:a?.davidFocus===d?.s&&!!d,hit:window.__davidAllyHits??[],
     boss:d?{hp:d.s.hp,x:d.s.x,z:d.s.z,kind:q?.kind??null,ran:q?.executed??0}:null,
     allyIn:!!(a&&d&&poiDavidIn(poiDavidMatch(d.o),poiCompanionPose(a,performance.now())))};
   }
 },
`);
put(' requestAnimationFrame(render);',' if(!window.__allyManual)requestAnimationFrame(render);');
const hit='function poiCompanionHurt(damage,now){';
put(hit,hit+"\n (window.__davidAllyHits??=[]).push({damage,now});");
for(const [,s] of html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(s);
if(process.env.ALLY_DAVID_SYNTAX_ONLY){console.log('native companion/David fixture parsed');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const srv=createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.end(req.url==='/seed'?'<title>Seed</title>':html)});
await new Promise((ok,no)=>srv.listen(0,'127.0.0.1',ok).once('error',no));
const base='http://127.0.0.1:'+srv.address().port;let b;
try{
 b=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 async function load(x,z){
  const c=await b.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:.75}),p=await c.newPage(),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.clock.install({time:new Date('2026-04-01T10:00:00Z')});
  await p.goto(base+'/seed');
  await p.evaluate(({x,z})=>{
   const slots=Array(27).fill(null);slots[0]={type:'equipWoodSword',count:1,durability:90};slots[9]={type:'slimeSoul',count:1,durability:36};
   localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weapon:'equipWoodSword',weaponDurabilityVersion:2,potions:0,slots,
    companionSoul:{version:1,active:'slimeSoul',pending:null}}));
   localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,position:{x,z,y:0,facing:2},townLayout:5,
    townMapHeight:128,view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
  },{x,z});
  await p.goto(base+'/?resume=1&test=1',{waitUntil:'domcontentloaded',timeout:45000});
  await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:35000});
  await p.waitForFunction(()=>window.__editorTest?.facility()?.active);
  await p.clock.pauseAt((await p.evaluate(()=>Date.now()))+1500);
  await p.evaluate(()=>{window.__allyManual=true});
  const snap=()=>p.evaluate(()=>window.__editorTest.davidAllyQA.state());
  const tick=async(ms=36)=>{await p.clock.fastForward(ms);await p.evaluate(()=>window.__editorTest.davidAllyQA.frame());return snap()};
  return {c,p,errors,tick,snap};
 }
 let diagonal=true,track=null;
 if(/COMPANION FRACTIONAL FOLLOW/.test(html)){
  const {c,p,errors,tick,snap}=await load(102,93),first=await snap();
  assert(first.actor);
  const cdp=await c.newCDPSession(p),box=await p.locator('#poiAnalogPad').boundingBox();
  assert(box&&box.width>40&&box.height>40);
  const point=(x,y)=>({x:Math.round(x),y:Math.round(y),id:1,radiusX:6,radiusY:6,force:.7});
  const start=point(box.x+box.width*.53,box.y+box.height*.44);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point(start.x+42,start.y+35)]});
  const seq=[];for(let i=0;i<60;i++)seq.push(await tick());
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert(seq.at(-1).player.x>first.player.x+.5&&seq.at(-1).player.z>first.player.z+.5);
  diagonal=seq.slice(1).some((s,i)=>{
   const before=seq[i].actor?.pose,after=s.actor?.pose;if(!before||!after)return false;
   return s.actor.x===seq[i].actor.x&&s.actor.z===seq[i].actor.z&&
    Math.abs(before.x-after.x)>.005&&Math.abs(before.z-after.z)>.005;
  });
  track={start:[first.player.x,first.player.z,first.actor],steps:seq.filter((_,i)=>i%5===0).map(s=>[s.player.x,s.player.z,s.actor,s.free])};
  assert.deepEqual(errors,[]);await c.close();
 }
 const {c,errors,tick,snap}=await load(24,102);
 let start=await snap(),s=start,saw=false,hit=false;
 for(let i=0;i<220;i++){
  s=await tick();saw||=s.target&&s.allyIn&&s.boss?.hp<1050;hit||=s.hit.length>0;
  if(saw&&hit)break;
 }
 assert(saw&&hit&&diagonal,JSON.stringify({saw,hit,diagonal,start,last:s,track:diagonal?null:track}));
 assert.equal(s.lastSwing,start.lastSwing,'player did not swing to prime the autonomous boss fight');
 assert.deepEqual(errors,[]);await c.close();
 console.log('Native fractional diagonal and autonomous companion/David contacts passed');
}finally{await b?.close();await new Promise(ok=>srv.close(ok))}
