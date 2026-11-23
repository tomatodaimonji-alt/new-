import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
function inject(s,a,b){assert.equal(s.split(a).length,2,a);return s.replace(a,b)}
const api='  freeMovementPose:()=>({x:poiWalkViewX,z:poiWalkViewZ,level:poiWalkLevel}),';
let fixture=inject(html,api,api+`
  bowDrawAudioQA:{
   seed:()=>{
    poiEnemyCancelPlayer();poiMonsterStates.clear();poiCombatLockReset();
    const obj={type:'monsterSlime',x:105,z:87,y:0,rot:0},state=poiCombatActorMake(obj);
    state.hp=80;state.townOwned=true;poiMonsterStates.set(obj,state);poiMonsterMeshDirty=true;
    window.__qaBowState=state;window.__qaBowLog={taps:[],draws:[],releases:[],flights:[]};
   },
   read:()=>{
    const s=window.__qaBowState,l=window.__qaBowLog;
    const slot=poiInventorySlots(poiHotbarRead())[1];
    return {audio:poiAudioContext?.state,weapon:poiEquippedWeapon(),hp:s?.hp,log:l,
     started:poiWalkActionStarted,ready:poiAttackReady,pending:!!poiPlayerWeaponPending,
     durability:slot?.durability??poiEquipmentDurabilityMax(slot?.type)};
   }
  },`);
fixture=inject(fixture,' const p=poiWildPick(rng);',' const p=null;');
fixture=inject(fixture,'function poiWildRegionalFrame(now,rng){','function poiWildRegionalFrame(now,rng){return;');
const play=' poiAudioTransient.add(source);source.start(when);source.stop(when+buffer.duration+.012);';
fixture=inject(fixture,play,play+`
 if(window.__qaBowLog&&poiRecordedFoleyCache.get('bowDraw')===buffer)
  window.__qaBowLog.draws.push({host:performance.now(),when,clock:ctx.currentTime,volume,duration:buffer.duration,rate:buffer.sampleRate});
`);
const release='   poiAudioNoiseBurst(now,.27,790,.68,.41,.028);';
fixture=inject(fixture,release,release+`
   if(weapon==='equipWoodBow'&&window.__qaBowLog)window.__qaBowLog.releases.push({host:performance.now(),clock:now});
`);
const flight=' const flight={...shot,phase:\'flight\',started:now,limit,at:0,sampleAt:now,targets:new Map(poiAimTargetList(o,shot.profile.range,now).map(c=>[c.id,c]))};';
fixture=inject(fixture,flight,flight+`
 if(shot.type==='equipWoodBow'&&window.__qaBowLog)window.__qaBowLog.flights.push({now,windup:shot.started,limit,dx:shot.dx,dz:shot.dz});
`);
const tap='function poiWalkAction(){';
fixture=inject(fixture,tap,tap+`
 if(window.__qaBowLog)window.__qaBowLog.taps.push({host:performance.now(),ready:poiAttackReady,pending:!!poiPlayerWeaponPending});
`);
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<!doctype html><title>Bow draw audio QA</title>':fixture)});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const base='http://127.0.0.1:'+server.address().port;
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const ctx=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:.75,isMobile:true,hasTouch:true});
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(11000);
 const read=()=>page.evaluate(()=>window.__editorTest.bowDrawAudioQA.read());
 const wait=(f,a=null,t=5000)=>page.waitForFunction(f,a,{polling:30,timeout:t});
 try{
  await page.goto(base+'/seed');
  await page.evaluate(()=>{
   const slots=Array(27).fill(null);slots[0]={type:'equipWoodSword',count:1};slots[1]={type:'equipWoodBow',count:1,durability:24};
   localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weaponDurabilityVersion:2,weapon:'equipWoodSword',potions:0,slots}));
   localStorage.setItem('world-workshop-audio-v2','{"master":80,"bgm":0,"se":85,"enabled":true}');
   localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":300000}');
   localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
    position:{x:105,z:83,y:0,facing:2},townLayout:5,townMapHeight:128,
    view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
  });
  await page.goto(base+'/?resume=1&test=1');
  await page.locator('#pineStartupCover').waitFor({state:'hidden'});
  await wait(()=>window.__editorTest?.facility()?.active&&document.querySelector('#viewWrap').hasAttribute('data-analog-play'));
  await page.locator('#poiHotbar [data-hotbar-slot="1"]').tap();
  await wait(()=>window.__editorTest.bowDrawAudioQA.read().audio==='running');
  assert.equal((await read()).weapon,'equipWoodBow');
  const box=await page.locator('#poiWalkAction').boundingBox();assert(box);
  await page.evaluate(()=>window.__editorTest.bowDrawAudioQA.seed());
  const touch=()=>page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);
  await touch();await touch();
  await wait(()=>{const s=window.__editorTest.bowDrawAudioQA.read();return s.log.flights.length>0&&!s.pending});
  const result=await read(),{taps,draws,releases,flights}=result.log;
  assert.equal(taps.length,2,'both physical taps reached the genuine action path');
  assert(taps[1].host<taps[1].ready,'the second physical tap actually landed inside the existing cooldown');
  assert.equal(draws.length,1,'accepted draw plays exactly one recorded sound, even with a locked tap: '+JSON.stringify(result));
  assert(draws[0].rate===24000&&draws[0].duration>.035&&draws[0].volume>0,'decoded audible PCM reached real AudioBufferSource.start');
  assert(draws[0].host>=taps[0].host&&draws[0].host-taps[0].host<90,'draw is played immediately when accepted, not when the arrow leaves');
  assert.equal(releases.length,1,'existing release whoosh still enters native Web Audio exactly once');
  assert(releases[0].host>draws[0].host&&releases[0].clock>draws[0].when,'bow draw precedes the held release on both clocks');
  assert.equal(flights.length,1,'only one actual flight');
  assert(flights[0].now-flights[0].windup>=325&&flights[0].now-flights[0].windup<635,'wind-up remains the existing 325ms threshold');
  assert(Math.abs(result.ready-result.started-1030)<.001,'actual 1030ms combat cooldown unchanged');
  assert.equal(result.hp,58,'real projectile still hits for 22 HP');
  assert.equal(result.durability,23,'actual ranged contact still debits one bow durability');
  assert.deepEqual(errors,[]);
  console.log('PASS real bow draw PCM plays once at trigger, ignores locked repeat, retains original release audio and physical hit');
 }catch(error){console.error('Bow native failure:',JSON.stringify(await read().catch(()=>null)),errors);throw error}
 finally{await ctx.close()}
}finally{await browser?.close();await new Promise(r=>server.close(r))}
