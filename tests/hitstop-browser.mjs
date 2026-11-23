import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const hook='  freeMovementPose:()=>({x:poiWalkViewX,z:poiWalkViewZ,level:poiWalkLevel}),';
function replaceOnce(text,from,to){assert.equal(text.split(from).length,2,'unique fixture anchor: '+from);return text.replace(from,to)}
let fixture=replaceOnce(html,hook,hook+`
  hitstopQA:{
   seed:({points,wall})=>{
    window.__qaHitstopFrames=[];
    // Isolate authored actors and the autonomous spawners; keep real map ray/physics.
    poiMonsterStates.clear();
    if(window.__qaMeleeWall)world=world.filter(o=>o!==window.__qaMeleeWall);
    poiCombatLockReset();
    const x=poiWalkX,z=poiWalkZ,y=poiWalkLevel,now=performance.now();
    const add=([forward,side,floor=0])=>{
     const level=y+floor;
     const fx=x+forward,fz=z+side,ix=poiFreeCell(fx),iz=poiFreeCell(fz);
     const obj={x:ix,z:iz,y:level,rot:0,type:'monsterSlime'};
     const state=poiCombatActorMake(obj),cells=new Set([ix+','+iz]);
     state.hp=100;state.townOwned=true;
     state.actorFree={fromX:fx,fromZ:fz,x:fx,z:fz,start:now-400,ms:380,cells,endCells:cells,heading:0};
     poiMonsterStates.set(obj,state);
     return {obj,state};
    };
    window.__qaMeleeTargets=points.map(add);
    window.__qaMeleeWall=wall?{x:x+wall[0],y,z:z+wall[1],rot:0,type:'wall'}:null;
    if(window.__qaMeleeWall)world.push(window.__qaMeleeWall);
    poiMonsterMeshDirty=true;poiAimLockAt=0;
   },
   status:()=>{
    const slot=poiInventorySlots(poiHotbarRead())[0];
    return {equipped:poiEquippedWeapon(),hps:window.__qaMeleeTargets?.map(({state})=>state.hp),at:poiWalkActionStarted,now:performance.now(),
     frames:window.__qaHitstopFrames,pending:!!poiPlayerWeaponPending,ready:poiAttackReady,durability:slot?.durability??poiEquipmentDurabilityMax(slot?.type)};
   }
  },`);
fixture=replaceOnce(fixture,' const p=poiWildPick(rng);',' const p=null;');
fixture=replaceOnce(fixture,'function poiWildRegionalFrame(now,rng){','function poiWildRegionalFrame(now,rng){return;');
// Observe real game updates and actual submitted WebGL draw path without
// reproducing hitstop state, animation math or HP damage inside the test.
fixture=replaceOnce(fixture,'function poiWalkFrame(now){',
 'function poiWalkFrame(now){if(window.__qaHitstopFrames)window.__qaHitstopFrames.push({part:"simulation",clock:now,host:performance.now()});');
fixture=replaceOnce(fixture,'  try{draw(poiWalkMesh,vp)}',
 '  try{draw(poiWalkMesh,vp);if(window.__qaHitstopFrames)window.__qaHitstopFrames.push({part:"avatar",clock:now,host:performance.now()});}');
fixture=replaceOnce(fixture,' gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);',
 ' gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);if(window.__qaHitstopFrames)window.__qaHitstopFrames.push({part:"canvas",clock:now,host:performance.now()});');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url==='/seed'?'<!doctype html><title>Hitstop QA</title>':fixture);
});
await new Promise((r,j)=>server.listen(0,'127.0.0.1',r).once('error',j));
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const base='http://127.0.0.1:'+server.address().port;
 const ctx=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.setDefaultTimeout(16000);
 await page.clock.install();
 await page.goto(base+'/seed');
 await page.evaluate(()=>{
  localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weapon:'equipWoodSword',potions:0}));
  localStorage.setItem('world-workshop-town-clock-v1',JSON.stringify({version:1,gameMs:575000}));
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:102,z:93,y:0,facing:1},townLayout:5,townMapHeight:128,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 });
 await page.goto(base+'/?resume=1&test=1');
 await page.waitForFunction(()=>window.__editorTest?.facility()?.active&&window.pineStartup&&!pineStartup.loading);
 await page.waitForFunction(()=>document.querySelector('#viewWrap').hasAttribute('data-analog-play'));
 await page.locator('#pineStartupCover').waitFor({state:'hidden'});
 const btn=await page.locator('#poiWalkAction').boundingBox();assert(btn);
 await page.clock.pauseAt((await page.evaluate(()=>Date.now()))+500);
 const tap=()=>page.touchscreen.tap(btn.x+btn.width/2,btn.y+btn.height/2);
 const state=()=>page.evaluate(()=>window.__editorTest.hitstopQA.status());
 const frames=async (delay=16)=>{
  await page.clock.runFor(delay);
  return await state();
 };
 const scenario=async (points,wall,expectedHP,stop)=>{
  await frames(560);
  await page.evaluate(({points,wall})=>window.__editorTest.hitstopQA.seed({points,wall}),{points,wall});
  const seeded=await frames(),before=seeded.at;
  assert.equal(seeded.equipped,'equipWoodSword');
  await tap();
  let s=await state();
  assert(s.at>before&&s.pending,'genuine landscape touch starts a pending swing');
  let last=s;
  for(let i=0;i<12&&s.pending;i++){last=s;s=await frames()}
  assert(!s.pending,'the swing resolves on a real RAF');
  assert.deepEqual(s.hps,expectedHP,'fixture asserts actual target HP changes before testing any pause');
  assert.equal(s.durability,seeded.durability-(stop?1:0),'actual durability debits once across struck targets');
  const contactHost=s.frames.slice(last.frames.length).find(f=>f.part==='simulation')?.host;
  assert(Number.isFinite(contactHost),'timed contact entered the genuine update path');
  const checkpoint=s.frames.length;
  for(let i=0;i<6;i++)s=await frames();
  const after=s.frames.slice(checkpoint),simulation=after.filter(f=>f.part==='simulation'),avatar=after.filter(f=>f.part==='avatar'),canvas=after.filter(f=>f.part==='canvas');
  assert(simulation.length>=2&&avatar.length>=2&&canvas.length>=2,'actual update and WebGL avatar draw resume; no permanent pause');
  const first=simulation[0].host-contactHost;
  if(stop){
   assert(first>=40&&first<=68,'first resumed update expected about 50ms after contact; got '+first+'ms');
   const lastContactAvatar=s.frames.slice(0,checkpoint).findLast(f=>f.part==='avatar');
   assert(lastContactAvatar,'an actual pre-impact frame was drawn');
   assert([...avatar,...canvas].filter(f=>f.host<simulation[0].host).every(f=>f.clock<=lastContactAvatar.clock+.001),
    'WebGL pose must not advance while simulation is held');
   assert(avatar.some(f=>f.clock>lastContactAvatar.clock),'actual WebGL pose advances after the hold');
  }else{
   assert(first>0&&first<=20,'miss or wall must not pause frame updates; got '+first+'ms');
  }
  return first;
 };
 const single=await scenario([[.8,0]],null,[72],true);
 const multi=await scenario([[.6,0],[1.1,-1.3],[1.1,1.3]],null,[72,72,72],true);
 assert(Math.abs(single-multi)<=16,'multi-target slash shares the original pause instead of stacking it');
 await scenario([],null,[],false);
 await scenario([[1.05,0]],[1,0],[100],false);
 assert.deepEqual(errors,[]);
 console.log('PASS physical player-hit stop, actual held/resumed simulation and WebGL pose, one hold per multi-hit, zero on misses/walls');
}finally{await browser?.close();await new Promise(r=>server.close(r))}
