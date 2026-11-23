import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const hook='  freeMovementPose:()=>({x:poiWalkViewX,z:poiWalkViewZ,level:poiWalkLevel}),';
assert.equal(html.split(hook).length,2,'unique test-only API anchor');
const fixture=html.replace(hook,hook+`
  swordSweepQA:{
   seed:(withWall)=>{
    if(!window.__qaSwordLaneReady){poiMonsterStates.clear();poiCombatLockReset();window.__qaSwordLaneReady=true}
    for(const p of window.__qaSwordTargets||[])poiMonsterStates.delete(p.obj);
    if(window.__qaSwordWall)world=world.filter(o=>o!==window.__qaSwordWall);
    const x=poiWalkX,z=poiWalkZ,y=poiWalkLevel,now=performance.now();
    const add=(forward,side,level=y)=>{
     const fx=x+forward,fz=z+side,ix=poiFreeCell(fx),iz=poiFreeCell(fz);
     const obj={x:ix,z:iz,y:level,rot:0,type:'monsterSlime'};
     const state=poiCombatActorMake(obj),cells=new Set([ix+','+iz]);
     state.hp=100;state.townOwned=true;
     state.actorFree={fromX:fx,fromZ:fz,x:fx,z:fz,start:now-400,ms:380,cells,endCells:cells,heading:0};
     poiMonsterStates.set(obj,state);
     return {obj,state};
    };
    window.__qaSwordTargets=[add(.64,0),add(1.29,-1.49),add(.97,1.49),add(.97,1.51),add(1.31,-.7),add(-.11,-1.3),add(.92,.80,y+1)];
    window.__qaSwordWall=withWall?{x,y,z:z+1,rot:0,type:'wall'}:null;
    if(window.__qaSwordWall)world.push(window.__qaSwordWall);
    poiMonsterMeshDirty=true;poiAimLockAt=0;
   },
   status:()=>{
    const slot=poiInventorySlots(poiHotbarRead())[0];
    return {hps:window.__qaSwordTargets?.map(({state})=>state.hp),at:poiWalkActionStarted,now:performance.now(),
     pending:!!poiPlayerWeaponPending,ready:poiAttackReady,durability:slot?.durability??poiEquipmentDurabilityMax(slot?.type)};
   }
  },`).replace(' const p=poiWildPick(rng);',' const p=null;');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url==='/seed'?'<!doctype html><title>Sword sweep QA</title>':fixture);
});
await new Promise((r,j)=>server.listen(0,'127.0.0.1',r).once('error',j));
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const ctx=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const base='http://127.0.0.1:'+server.address().port;
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
 const status=()=>page.evaluate(()=>window.__editorTest.swordSweepQA.status());
 const action=page.locator('#poiWalkAction');
 const initial=await status();
 for(const withWall of [false,true]){
  await page.waitForFunction(()=>{const s=window.__editorTest.swordSweepQA.status();return s.now>s.ready&&!s.pending});
  const prior=(await status()).at;
  await page.evaluate(flag=>window.__editorTest.swordSweepQA.seed(flag),withWall);
  await action.tap();
  await page.waitForFunction(prior=>{const s=window.__editorTest.swordSweepQA.status();return s.at>prior&&!s.pending},prior);
  const s=await status();
  assert.deepEqual(s.hps,[72,72,withWall?100:72,100,100,100,100],
   'one true sword hit per visible target in the sweep; wall, sides, range, rear and floor remain bounded');
  assert.equal(s.durability,initial.durability-(withWall?2:1),'one durability per sweep, never per target');
 }
 assert.deepEqual(errors,[]);
 console.log('PASS physical landscape sword tap, wide simultaneous hits, wall/floor/range and one durability per sweep');
}finally{await browser?.close();await new Promise(r=>server.close(r))}
