import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
let h=readFileSync(process.argv[2]??'world-editor.html','utf8');
const insert=(a,b)=>{assert.equal(h.split(a).length,2,a);h=h.replace(a,b)};
const mark="if(facilityParams.get('test')==='1')window.__editorTest={";
insert(mark,`
 window.__trackedTest={
  frame:()=>render(),
  stage:(slot,x,z)=>{
   if(!workshopResumeRestorePosition({x:24,z:108,y:0,facing:1}))return false;
   poiMonsterStates.clear();poiCombatLockReset();
   const add=(n,x,z)=>{
    const o={x:Math.round(x),z:Math.round(z),y:0,type:'monsterSlime',rot:0,qa:n},s=poiCombatActorMake(o);
    s.hp=100;s.townOwned=true;s.x=s.fromX=x;s.z=s.fromZ=z;
    poiMonsterStates.set(o,s);poiMonsterMeshDirty=true;return [o,s];
   };
   const q=window.__trackedTest;
   q.add=add;q.target=add('pinned',x,z);
   q.alt=null;return poiEquipHotbarItem(slot)?.ok;
  },
  alternate:(x,z)=>{const q=window.__trackedTest;q.alt=q.add('alternate',x,z)},
  moveTarget:(x,z)=>{
   const s=window.__trackedTest.target[1];s.x=s.fromX=x;s.z=s.fromZ=z;
  },
  state:()=>{
   const q=window.__trackedTest,a=poiPlayerWeaponPending,aim=poiAimAttack,v=poiPlayerWeaponVisual,p=poiAimOrigin(performance.now()),
    marker=poiCombatLockUpdate(p,performance.now());
   return {now:performance.now(),ready:poiAttackReady,started:poiWalkActionStarted,pos:[p.x,p.z],side:q.target?.[1]?.hp,
    alternate:q.alt?.[1]?.hp,target:a?.track?.obj?.qa??aim?.track?.obj?.qa,marker:marker?.id?.qa,
    cursor:a?.orvasCursor,pending:!!a,actual:q.actual,
    flight:v&&{dx:v.dx,dz:v.dz,origin:[v.aim.x,v.aim.z],type:v.type}};
  }
 };`+mark);
const upload='function poiBuildPlayerMesh(weapon,pose,gear,stride=0,r=0,x=0,y=0,z=0,heading=null,worldSpear=false){';
insert(upload,upload+`if(worldSpear&&window.__trackedTest)window.__trackedTest.actual={weapon,heading,x:x-.5,z:z-.5};`);
insert(' requestAnimationFrame(render);',' if(!window.__trackManual)requestAnimationFrame(render);');
for(const [,js] of h.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(js);
if(process.env.ATTACK_TRACK_PARSE_ONLY){console.log('Exact committed attack native fixture parses');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>tracking QA</title>':h)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
let b;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:.68});
 const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(18000);
 await p.clock.install({time:new Date('2026-04-01T10:00:00Z')});
 await p.goto(url+'/seed');
 await p.evaluate(()=>{
  const slots=Array(27).fill(null);slots[0]={type:'equipWoodSword',count:1,durability:100};
  slots[2]={type:'equipOrvasTwinGreatswords',count:1,durability:210};slots[3]={type:'equipWoodBow',count:1,durability:100};
  localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weaponDurabilityVersion:2,weapon:null,potions:0,slots}));
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:24,z:108,y:0,facing:1},townLayout:5,townMapHeight:128,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 });
 await p.goto(url+'/?resume=1&test=1',{waitUntil:'domcontentloaded'});await p.locator('#pineStartupCover').waitFor({state:'hidden'});
 await p.clock.pauseAt(await p.evaluate(()=>Date.now()+195));
 await p.evaluate(()=>{window.__trackManual=true});
 const q=()=>p.evaluate(()=>window.__trackedTest.state());
 const frame=async(ms=40)=>{await p.clock.fastForward(ms);await p.evaluate(()=>window.__trackedTest.frame());return q()};
 const until=async(fn,max=75)=>{let s=await q();for(let i=0;i<max&&!fn(s);i++)s=await frame();assert(fn(s),JSON.stringify(s));return s};
 const tap=async()=>{
  const k=await p.locator('#poiWalkAction').boundingBox();assert(k);
  await p.touchscreen.tap(k.x+k.width/2,k.y+k.height/2);
 };
 const pad=await p.locator('#poiAnalogPad').boundingBox();assert(pad);
 const stick={x:Math.round(pad.x+pad.width/2),y:Math.round(pad.y+pad.height/2),id:1,radiusX:5,radiusY:5,force:.8};
 const cd=await ctx.newCDPSession(p);
 const send=(type,touchPoints)=>cd.send('Input.dispatchTouchEvent',{type,touchPoints});
 const push=async()=>{await send('touchStart',[stick]);await send('touchMove',[{...stick,y:stick.y+25}]);};
 const end=()=>send('touchEnd',[]);
 const begin=async(i,x,z)=>{
  await until(s=>!s.pending&&s.now>=s.ready);
  assert(await p.evaluate(([i,x,z])=>window.__trackedTest.stage(i,x,z),[i,x,z]));
  await frame();
  await tap();
  const live=await until(s=>s.pending&&s.target==='pinned',12);
  assert.equal(live.marker,'pinned');return live;
 };
 const first=await begin(2,26,108);
 await p.evaluate(()=>window.__trackedTest.alternate(23.4,108.3));
 await push();
 let moved=await until(s=>Math.abs(s.pos[1]-first.pos[1])>.7,15);
 await end();
 assert(Math.abs(moved.actual.heading-first.actual.heading)>.20,JSON.stringify({first,moved}));
 assert.equal(moved.marker,'pinned');assert.equal(moved.target,'pinned');
 const one=await until(s=>s.cursor===1,35);
 assert.equal(one.side,54);assert.equal(one.alternate,100);
 // Move the exact same authored instance to a new bearing between the
 // downstrokes. The deliberately closer alternate remains behind.
 await p.evaluate(()=>window.__trackedTest.moveTarget(26.3,107.8));
 const two=await until(s=>!s.pending&&s.side===8,30);
 assert.equal(two.alternate,100);assert.equal(two.target,'pinned');
 assert(Math.abs(two.actual.heading-one.actual.heading)>.02);
 await begin(2,26,108);
 await p.evaluate(()=>{window.__trackedTest.moveTarget(31,108);window.__trackedTest.alternate(26,108)});
 const escape=await until(s=>!s.pending,40);
 assert.equal(escape.side,100);assert.equal(escape.alternate,100);
 await begin(3,27,108);
 await p.evaluate(()=>window.__trackedTest.moveTarget(27,110));
 const released=await until(s=>s.flight?.type==='equipWoodBow',20);
 assert(released.flight.dx>.7&&released.flight.dz>.4,JSON.stringify(released));
 await p.evaluate(()=>window.__trackedTest.moveTarget(27,106));
 const flying=await frame();
 assert.equal(flying.flight.dz,released.flight.dz);assert.equal(flying.flight.dx,released.flight.dx);
 assert.deepEqual(errors,[]);
 console.log('Actual touched twins maintain same enemy during physical stick strafe and two strikes; escaped pin does not substitute; bow remains fixed from true release.',JSON.stringify({one:one.side,two:two.side,moved:moved.pos,flight:released.flight}));
 await ctx.close();
}finally{await b?.close();await new Promise(r=>server.close(r))}
