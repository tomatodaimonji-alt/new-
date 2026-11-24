import a from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync} from 'node:fs';
import {Script} from 'node:vm';
const baseline=process.env.CLOSE_BEAM_BASELINE==='1';
let h=readFileSync(process.argv[2]??'world-editor.html','utf8');
const rep=(s,t)=>{a.equal(h.split(s).length,2,s);h=h.replace(s,t)};
const api="if(facilityParams.get('test')==='1')window.__editorTest={";
rep(api,api+`
  closeBeamTest:{
   frame:()=>render(),
   set:(distance=0)=>{
    if(!workshopResumeRestorePosition({x:111,z:60,y:0,facing:1}))return false;
    poiMonsterStates.clear();poiCombatLockReset();
    const timed=performance.now(),x=111+distance,z=60;
    if(distance){
     const o={type:'monsterSlime',x:Math.round(x),z,y:0,rot:0},s=poiCombatActorMake(o);
     s.hp=100;s.townOwned=true;
     s.actorFree={x,z,fromX:x,fromZ:z,ms:1,start:timed-10,heading:0,cells:new Set(),endCells:new Set()};
     poiMonsterStates.set(o,s);window.__closeBeamTarget=s;
    }else window.__closeBeamTarget=null;
    poiMonsterMeshDirty=true;
    poiThirdPerson=true;cameraTopDown=false;poiCameraYaw=-Math.PI/2+.91;poiCameraPitch=.47;poiCameraDistance=4.6;
    return poiEquippedWeapon()==='equipOrvasHead';
   },
   ready:()=>poiAttackReady,
   shot:()=>{
    const q=poiOrvasPlayerBeam;
    return {start:poiWalkActionStarted,loaded:!!q,t:performance.now(),wear:poiInventorySlots(poiHotbarRead())[2]?.durability,
     target:window.__closeBeamTarget?.hp,lock:poiAimLocked?.id.type,near:q?.near,
     rays:q?.rays.map(r=>({x:r.x,z:r.z,h:r.h,dir:r.dir,visual:r.visualEnd,flat:r.visualLimit,y:r.visualHeight})),
     eyes:poiWalkMesh?.orvasEyeSockets,gpu:poiOrvasBeamGpu?.count,
     marks:poiOrvasGroundTraces.filter(m=>m.player&&m.start>=poiWalkActionStarted).length,error:gl.getError()};
   }
  },
`);
rep(' requestAnimationFrame(render);',' if(!window.__closeBeamManual)requestAnimationFrame(render);');
for(const [,s] of h.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(s);
if(process.env.CLOSE_BEAM_PARSE_ONLY)process.exit();
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>seed</title>':h)});
await new Promise((r,j)=>server.listen(0,'127.0.0.1',r).once('error',j));
const origin='http://127.0.0.1:'+server.address().port;
let b;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const p=await b.newPage({viewport:{width:1100,height:500},isMobile:true,hasTouch:true,deviceScaleFactor:1});
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.clock.install({time:new Date('2026-04-01T10:00:00Z')});
 await p.goto(origin+'/seed');
 await p.evaluate(()=>{
  const slots=Array(27).fill(null);slots[0]={type:'equipWoodSword',count:1,durability:30};slots[2]={type:'equipOrvasHead',count:1,durability:5};
  localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weapon:'equipOrvasHead',weaponDurabilityVersion:2,slots,potions:0}));
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,position:{x:111,z:60,y:0,facing:1},
   townLayout:5,townMapHeight:182,templeDepth:1,view:{yaw:0,zoom:1,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:0,orbitPitch:.2,orbitDistance:6.7}}));
 });
 await p.goto(origin+'/?resume=1&test=1');await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:30000});
 await p.clock.pauseAt(await p.evaluate(()=>Date.now()+3300));
 await p.evaluate(()=>window.__closeBeamManual=true);
 const frame=async(ms=0)=>{if(ms)await p.clock.fastForward(ms);await p.evaluate(()=>window.__editorTest.closeBeamTest.frame())};
 const read=()=>p.evaluate(()=>window.__editorTest.closeBeamTest.shot());
 const screen=async(name)=>{
  if(process.env.FACILITY_SCREENSHOTS){mkdirSync(process.env.FACILITY_SCREENSHOTS,{recursive:true});
   await p.screenshot({path:process.env.FACILITY_SCREENSHOTS+'/'+name+'.png'})}
 };
 const run=async distance=>{
  await frame(1800);
  a(await p.evaluate(d=>window.__editorTest.closeBeamTest.set(d),distance));
  await frame();const initial=await read();
  const q=await p.locator('#poiWalkAction').boundingBox();a(q);await p.touchscreen.tap(q.x+q.width/2,q.y+q.height/2);
  let r=await read();a(r.start>initial.start);
  await frame(437);r=await read();a(r.loaded&&r.wear===initial.wear-1&&r.error===0,JSON.stringify(r));
  return r;
 };
 const close=await run(.56);
 await screen(baseline?'baseline-adjacent':'fixed-adjacent');
 console.log('near',JSON.stringify(close));
 if(baseline){a.equal(close.target,100);process.exitCode=0}
 else{
  a.equal(close.target,52,'one hit on actual locked fractional nearby slime');a(close.near&&close.gpu>30&&close.marks===0);
  for(const [i,r] of close.rays.entries()){
   a(r.dir&&r.y<r.h&&r.flat>0);
   a(Math.abs(r.x+r.dir.x*r.visual-111.56)<1e-7&&Math.abs(r.z+r.dir.z*r.visual-60)<1e-7);
   const eye=close.eyes[i];
   a(Math.hypot(eye[0]-.5-r.x,eye[1]-r.h,eye[2]-.5-r.z)<1e-7,'contacting ray starts on the real held socket');
  }
  await frame(162);a.equal((await read()).target,52,'visual tail never repeats damage');
  const far=await run(5);
  a(far.target===52&&!far.near&&far.rays.every(r=>!r.dir),JSON.stringify(far));
  const miss=await run(0);a(miss.target===undefined&&!miss.near&&miss.gpu>0,JSON.stringify(miss));
  console.log('far and open miss',JSON.stringify({far,miss}));
 }
 a.deepEqual(errors,[]);
}finally{await b?.close();await new Promise(r=>server.close(r))}
