import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const hook='  freeMovementPose:()=>({x:poiWalkViewX,z:poiWalkViewZ,level:poiWalkLevel}),';
function replaceOnce(text,from,to){assert.equal(text.split(from).length,2,'unique fixture anchor: '+from);return text.replace(from,to)}
let fixture=replaceOnce(html,hook,hook+`
  staffBonkQA:{
   seed:(distance)=>{
    // Isolate authored actors and the autonomous spawners; keep real map ray/physics.
    poiMonsterStates.clear();

    poiCombatLockReset();
    const x=poiWalkX,z=poiWalkZ,y=poiWalkLevel,now=performance.now();
    const add=([forward,side,floor=0])=>{
     const level=y+floor;
     const fx=x+forward,fz=z+side,ix=poiFreeCell(fx),iz=poiFreeCell(fz);
     const obj={x:ix,z:iz,y:level,rot:0,type:'monsterSlime'};
     const state=poiCombatActorMake(obj),cells=new Set([ix+','+iz]);
     state.hp=80;state.townOwned=true;
     state.actorFree={fromX:fx,fromZ:fz,x:fx,z:fz,start:now-400,ms:380,cells,endCells:cells,heading:0};
     poiMonsterStates.set(obj,state);
     return {obj,state};
    };
    window.__qaMeleeTargets=[add([distance,0])];
    window.__qaStaffFrames=[];window.__qaStaffHits=[];window.__qaSpearFrames=[];
    poiMonsterMeshDirty=true;poiAimLockAt=0;
   },
   status:()=>{
    const slot=poiInventorySlots(poiHotbarRead()).find(c=>c?.type===poiEquippedWeapon());
    return {equipped:poiEquippedWeapon(),hps:window.__qaMeleeTargets?.map(({state})=>state.hp),at:poiWalkActionStarted,now:performance.now(),
     frames:window.__qaStaffFrames,hits:window.__qaStaffHits,spear:window.__qaSpearFrames,pending:!!poiPlayerWeaponPending,ready:poiAttackReady,durability:slot?.durability??poiEquipmentDurabilityMax(slot?.type)};
   }
  },`);
fixture=replaceOnce(fixture,' const p=poiWildPick(rng);',' const p=null;');
fixture=replaceOnce(fixture,'function poiWildRegionalFrame(now,rng){','function poiWildRegionalFrame(now,rng){return;');
// Sample the actual transformed longstaff tip vertices in the held mesh
// before its normal upload, and timestamp the unchanged real HP callback.
const propEnd="   m.n.push(dx/n,ny/n,dz/n);m.c.push(prop.c[i],prop.c[i+1],prop.c[i+2]);\n  }";
fixture=replaceOnce(fixture,propEnd,propEnd+`
  if(weapon==='equipLongStaff'&&pose&&window.__qaStaffFrames){
   let peak=0,loX=Infinity,hiX=-Infinity,loZ=Infinity,hiZ=-Infinity;
   for(let i=0;i<prop.p.length;i+=3){
    if(prop.p[i+1]>prop.p[peak+1])peak=i;
    loX=Math.min(loX,prop.p[i]);hiX=Math.max(hiX,prop.p[i]);loZ=Math.min(loZ,prop.p[i+2]);hiZ=Math.max(hiZ,prop.p[i+2]);
   }
   const tip=m.p.length-prop.p.length+peak;
   window.__qaStaffFrames.push({clock:performance.now(),phase:pose.staffPhase,bonk:!!pose.staffStrike,thrust:pose.staffThrust,
    arc:pose.meleeReach?.arc,tip:{x:m.p[tip]-x,y:m.p[tip+1]-y,z:m.p[tip+2]-z},rawSpan:Math.max(hiX-loX,hiZ-loZ)});
  }`);
const spear='function poiBuildWorldSpear(m,pose,g,rotate,x,y,z){';
fixture=replaceOnce(fixture,spear,spear+`
 if(window.__qaSpearFrames&&pose)window.__qaSpearFrames.push({clock:performance.now(),staff:!!pose.staffStrike,phase:pose.staffPhase,
  committed:Number.isFinite(pose.spearVisual?.clock)});
`);
const hit='function poiPlayerDamageTarget(monster,x,z,amount,weapon,now,silent=false,atContact=false,source=null){';
fixture=replaceOnce(fixture,hit,hit+`
 if(window.__qaStaffHits&&(weapon==='equipLongStaff'||weapon==='equipWoodSpear'))
  window.__qaStaffHits.push({amount,weapon,now});
`);
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url==='/seed'?'<!doctype html><title>Staff bonk QA</title>':fixture);
});
await new Promise((r,j)=>server.listen(0,'127.0.0.1',r).once('error',j));
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const base='http://127.0.0.1:'+server.address().port;
 const ctx=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:.60,isMobile:true,hasTouch:true});
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(11000);
 const read=()=>page.evaluate(()=>window.__editorTest.staffBonkQA.status());
 const wait=(fn,arg=null,timeout=5000)=>page.waitForFunction(fn,arg,{polling:30,timeout});
 try{
  await page.goto(base+'/seed');
  await page.evaluate(()=>{
   const slots=Array(27).fill(null);
   slots[0]={type:'equipLongStaff',count:1,durability:48};
   slots[1]={type:'equipWoodSword',count:1};
   slots[2]={type:'equipWoodSpear',count:1,durability:40};
   localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weaponDurabilityVersion:2,weapon:'equipLongStaff',potions:0,slots}));
   localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":575000}');
   localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
    position:{x:102,z:93,y:0,facing:1},townLayout:5,townMapHeight:128,
    view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
  });
  await page.goto(base+'/?resume=1&test=1');
  await page.locator('#pineStartupCover').waitFor({state:'hidden'});
  await wait(()=>window.__editorTest?.facility()?.active&&document.querySelector('#viewWrap').hasAttribute('data-analog-play'));
  const action=page.locator('#poiWalkAction');
  const strike=async(distance,weapon,expected)=>{
   await wait(()=>{const s=window.__editorTest.staffBonkQA.status();return s.now>=s.ready&&!s.pending});
   await page.evaluate(distance=>window.__editorTest.staffBonkQA.seed(distance),distance);
   const before=await read();assert.equal(before.equipped,weapon);
   await action.tap();
   await wait(at=>{const s=window.__editorTest.staffBonkQA.status();return s.at>at&&!s.pending},before.at);
   const after=await read(),damage=80-expected;
   assert.deepEqual(after.hps,[expected],weapon+' physical attack at center distance '+distance);
   assert.equal(after.durability,before.durability-(damage?1:0),'one condition point only for real contact');
   assert.deepEqual(after.hits.map(c=>c.amount),damage?[damage]:[],'real damage callback agrees with actual HP');
   return after;
  };
  const near=await strike(.95,'equipLongStaff',60);
  const far=await strike(2,'equipLongStaff',60);
  assert(Math.abs(far.ready-far.at-510)<.01&&far.hits[0].now-far.at>=210,'unchanged 210ms contact and 510ms ready');
  const overhead=[...near.frames,...far.frames].filter(f=>f.bonk&&['raise','hold','down'].includes(f.phase)).sort((a,b)=>b.tip.y-a.tip.y)[0];
  const down=far.frames.filter(f=>f.bonk&&f.phase==='down'&&f.arc==='staff-down'&&f.clock>=far.hits[0].now-2&&f.clock-far.hits[0].now<125).sort((a,b)=>b.tip.x-a.tip.x)[0];
  assert(overhead&&down,'live held mesh must show raised wood and actual downward contact: '+JSON.stringify({near:near.frames,far:far.frames}));
  assert(overhead.tip.y>1.65&&down.tip.y<1.25&&overhead.tip.y-down.tip.y>.45,'actual branch tip visibly drops through the hit, not spear thrust');
  assert(down.tip.x>1.4&&Math.abs(down.tip.z)<.65,'same actual avatar mesh still reaches its two-tile target');
  assert(down.rawSpan>=.18,'actual wood mesh is visibly substantial before hold transform');
  assert(![...near.frames,...far.frames].some(f=>Number.isFinite(f.thrust)),'staff no longer uses the old straight thrust animation');
  await strike(2.045,'equipLongStaff',80);
  await page.locator('#poiHotbar [data-hotbar-slot="2"]').tap();
  const spear=await strike(1,'equipWoodSpear',62);
  assert(spear.spear.some(f=>f.committed)&&spear.spear.every(f=>!f.staff&&!f.phase),'spear remains its own actual held thrust rig at contact');
  assert.deepEqual(errors,[]);
 }catch(e){console.error('Staff native probe',JSON.stringify(await read().catch(()=>null)),errors);throw e}
 finally{await ctx.close()}
 console.log('PASS true mobile longstaff overhead/downstroke, original 1/2-tile HP/condition, no outside hit and independent spear thrust');
}finally{await browser?.close();await new Promise(r=>server.close(r))}
