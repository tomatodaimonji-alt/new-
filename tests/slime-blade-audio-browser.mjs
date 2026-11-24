import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const hook='  freeMovementPose:()=>({x:poiWalkViewX,z:poiWalkViewZ,level:poiWalkLevel}),';
function replaceOnce(text,from,to){assert.equal(text.split(from).length,2,'unique fixture anchor: '+from);return text.replace(from,to)}
let fixture=replaceOnce(html,hook,hook+`
  slimeBladeQA:{
   seed:(hp)=>{
    // Isolate authored actors and the autonomous spawners; keep real map ray/physics.
    poiMonsterStates.clear();

    poiCombatLockReset();
    const x=poiWalkX,z=poiWalkZ,y=poiWalkLevel,now=performance.now();
    const add=([forward,side,floor=0])=>{
     const level=y+floor;
     const fx=x+forward,fz=z+side,ix=poiFreeCell(fx),iz=poiFreeCell(fz);
     const obj={x:ix,z:iz,y:level,rot:0,type:'monsterSlime'};
     const state=poiCombatActorMake(obj),cells=new Set([ix+','+iz]);
     state.hp=hp;state.townOwned=true;
     state.actorFree={fromX:fx,fromZ:fz,x:fx,z:fz,start:now-400,ms:380,cells,endCells:cells,heading:0};
     poiMonsterStates.set(obj,state);
     return {obj,state};
    };
    window.__qaMeleeTargets=hp===null?[]:[add([.85,0])];
    window.__qaSlimeSamples=[];
    poiMonsterMeshDirty=true;poiAimLockAt=0;
   },
   status:()=>{
    const slot=poiInventorySlots(poiHotbarRead())[0];
    return {equipped:poiEquippedWeapon(),hps:window.__qaMeleeTargets?.map(({state})=>state.hp),at:poiWalkActionStarted,now:performance.now(),
     audio:poiAudioContext?.state,samples:window.__qaSlimeSamples,pending:!!poiPlayerWeaponPending,ready:poiAttackReady,durability:slot?.durability??poiEquipmentDurabilityMax(slot?.type)};
   }
  },`);
fixture=replaceOnce(fixture,' const p=poiWildPick(rng);',' const p=null;');
fixture=replaceOnce(fixture,'function poiWildRegionalFrame(now,rng){','function poiWildRegionalFrame(now,rng){return;');
// Observe after the application's actual AudioBufferSource.start(), and
// identify decoded PCM by identity in its recorded audio cache.
const audioAnchor=' poiAudioTransient.add(source);source.start(when);source.stop(when+buffer.duration+.012);';
fixture=replaceOnce(fixture,audioAnchor,audioAnchor+`
 if(window.__qaSlimeSamples){
  const id=[...poiRecordedFoleyCache].find(([,b])=>b===buffer)?.[0];
  if(id&&['steelSwing','steelImpact','playerSteelSwing','playerSteelCut','slimeImpact','defeat'].includes(id))
   window.__qaSlimeSamples.push({id,when,volume,duration:buffer.duration,rate:buffer.sampleRate});
 }`);
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url==='/seed'?'<!doctype html><title>Slime blade audio QA</title>':fixture);
});
await new Promise((r,j)=>server.listen(0,'127.0.0.1',r).once('error',j));
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const base='http://127.0.0.1:'+server.address().port;
 const ctx=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:.75,isMobile:true,hasTouch:true});
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(11000);
 const read=()=>page.evaluate(()=>window.__editorTest.slimeBladeQA.status());
 const wait=(fn,arg=null,timeout=5000)=>page.waitForFunction(fn,arg,{polling:30,timeout});
 try{
  await page.goto(base+'/seed');
  await page.evaluate(()=>{
   const slots=Array(27).fill(null);slots[0]={type:'kitchenKnife',count:1,durability:40};slots[1]={type:'equipWoodSword',count:1};
   localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weaponDurabilityVersion:2,weapon:'kitchenKnife',potions:0,slots}));
   localStorage.setItem('world-workshop-audio-v2','{"master":80,"bgm":0,"se":85,"enabled":true}');
   localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":575000}');
   localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
    position:{x:102,z:93,y:0,facing:1},townLayout:5,townMapHeight:128,
    view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
  });
  await page.goto(base+'/?resume=1&test=1');
  await page.locator('#pineStartupCover').waitFor({state:'hidden'});
  await wait(()=>window.__editorTest?.facility()?.active&&document.querySelector('#viewWrap').hasAttribute('data-analog-play'));
  const action=page.locator('#poiWalkAction');
  await page.evaluate(()=>window.__editorTest.slimeBladeQA.seed(null));
  // Physical action warms the existing user-gesture audio path; not a spy
  // substitute for Web Audio and not part of the strike assertions.
  await action.tap();
  await wait(()=>window.__editorTest.slimeBladeQA.status().audio==='running');
  for(const [startHP,endHP] of [[35,3],[20,0]]){
   await wait(()=>{const s=window.__editorTest.slimeBladeQA.status();return s.now>=s.ready&&!s.pending});
   await page.evaluate(hp=>window.__editorTest.slimeBladeQA.seed(hp),startHP);
   const before=await read();
   assert.equal(before.equipped,'kitchenKnife');
   await action.tap();
   await wait(at=>{const s=window.__editorTest.slimeBladeQA.status();return s.at>at&&!s.pending},before.at);
   const after=await read();
   assert.deepEqual(after.hps,[endHP],'live knife applies its unchanged 32 damage and can defeat a slime');
   assert.equal(after.durability,before.durability-1);
   assert.deepEqual(after.samples.map(x=>x.id),['playerSteelSwing','slimeImpact'],'real recorded knife swing and soft slime contact only, even on defeat: '+JSON.stringify(after.samples));
   assert(after.samples.every(x=>x.duration>.035&&x.rate===24000&&x.volume>0),'decoded PCM played through a real output-bus source');
   assert(after.samples[1].when>=after.samples[0].when,'actual sound scheduler plays contact after the existing swing');
  }
  assert.deepEqual(errors,[]);
 }finally{await ctx.close()}
 console.log('PASS actual landscape knife taps hit and defeat a slime with recorded swing plus soft contact, not steel or common defeat PCM');
}finally{await browser?.close();await new Promise(r=>server.close(r))}
