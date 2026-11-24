import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
function inject(s,a,b){assert.equal(s.split(a).length,2,a);return s.replace(a,b)}
const anchor='  freeMovementPose:()=>({x:poiWalkViewX,z:poiWalkViewZ,level:poiWalkLevel}),';
let fixture=inject(html,anchor,anchor+`
  northFortQA:{
   corner:()=>{
    const x=64.78,z=13.84,y=poiWalkLevel;
    if(y!==-1||!poiWalkCanStep(poiFreeCell(x),poiFreeCell(z)))throw Error('fractional southeast fixture must be on the real clear chamber floor');
    poiWalkX=poiWalkFromX=poiFreeCell(x);poiWalkZ=poiWalkFromZ=poiFreeCell(z);
    poiWalkViewX=x;poiWalkViewZ=z;
    poiFreePose={x,z,level:y,distance:0,walking:false,angle:0,changed:true};
   },
   arm:priorAxe=>{
    if(priorAxe){const state=[...poiMonsterStates].find(([o])=>o.type==='monsterNorthMinotaur')?.[1];
     if(state)state.northLastAttack='axe';}
    window.__qaFortArm=true;
   },
   motion:()=>{const now=performance.now(),a=[...poiMonsterStates].find(([o])=>o.type==='monsterNorthMinotaur')?.[1]?.playerAttack;
    return {now,nextMob:poiNextMobTick,x:poiWalkViewX,z:poiWalkViewZ,strike:a?{kind:a.northAttack,dx:a.dx,dz:a.dz,sx:a.sx,sz:a.sz,start:a.start,hit:a.hit,pending:a.pending}:null};
   },
   status:()=>{
    const spec=facilitySite?.northFort;
    const [o,s]=[...poiMonsterStates].find(([o])=>o.x===64&&o.z===13&&o.y===-1)||[],a=s?.playerAttack,now=performance.now();
    const proj=(x,y,z)=>poiWorldToScreen(parameters().vp,x,y,z);
    const point=s&&proj(s.x+.5,terrainY(s.x,s.z)+o.y*1.4+.9,s.z+.5);
    const map=window.__editorTest.facility();
    return {contacts:window.__qaFortContacts??[],signIds:map.signIds,axeCue:window.__qaFortAxeCue??[],spec:spec?{name:spec.name,entrance:spec.entrance,exit:spec.exit,surfaceStand:spec.surfaceStand,dungeonStand:spec.dungeonStand}:null,
     position:{x:poiWalkX,z:poiWalkZ,y:poiWalkLevel},pos:{x:poiWalkViewX,z:poiWalkViewZ},now,ready:poiWalkNextReady,
     mini:map.miniMap,hp:poiPlayerHP,type:o?.type,bossHP:s?.hp,boss:s?{x:s.x,z:s.z}:null,openUntil:s?.northOpenUntil??s?.northRecoverUntil??0,
     screen:!!point&&point.x>=0&&point.x<=canvas.clientWidth&&point.y>=0&&point.y<=canvas.clientHeight,
     strike:a?{kind:a.northAttack,dx:a.dx,dz:a.dz,sx:a.sx,sz:a.sz,start:a.start,hit:a.hit,pending:a.pending,visualHitAt:a.visualHitAt}:null,
     tell:window.__qaFortDraw??[],hits:window.__qaFortHits??[],counters:window.__qaFortCounters??[],action:poiWalkActionStarted,pending:!!poiPlayerWeaponPending,
     locked:!!o&&poiAimLocked?.id===o,durability:poiInventorySlots(poiHotbarRead())[0]?.durability??poiEquipmentDurabilityMax('equipWoodSword')};
   }
  },`);
// Preserve old authored encounters and geometry; remove only unrelated wild
// random spawns so the north-road route never depends on RNG/timing.
fixture=inject(fixture,' const p=poiWildPick(rng);',' const p=null;');
fixture=inject(fixture,'function poiWildRegionalFrame(now,rng){','function poiWildRegionalFrame(now,rng){return;');
const fortTick='function poiNorthMinotaurFrame(obj,s,now){';
if(fixture.includes(fortTick))fixture=inject(fixture,fortTick,fortTick+'if(window.__qaFortGateCombat&&!window.__qaFortArm)return false;');
const contactProbe='function poiNorthMinotaurCovered(a,now){';
if(fixture.includes(contactProbe))fixture=inject(fixture,contactProbe,contactProbe+`
 const observedPlayer=poiAimOrigin(now);
 (window.__qaFortContacts??=[]).push({kind:a.northAttack,now,x:observedPlayer.x,z:observedPlayer.z});
`);
fixture=inject(fixture,'function poiMobHitPlayer(obj,now',`function poiMobHitPlayer(...args){
 const [obj,now]=args,before=poiPlayerHP;
 try{return __qaFortMobHit(...args)}
 finally{if(obj.x===64&&obj.z===13&&obj.y===-1)(window.__qaFortHits??=[]).push({type:obj.type,before,after:poiPlayerHP,now})}
}
function __qaFortMobHit(obj,now`);
const counterProbe='function poiPlayerDamageTarget(monster,x,z,amount,weapon,now,silent=false,atContact=false,source=null){';
fixture=inject(fixture,counterProbe,counterProbe+`
 const [observedBoss,observedBossState]=monster||[];
 if(observedBoss?.type==='monsterNorthMinotaur')
  (window.__qaFortCounters??=[]).push({now,openUntil:observedBossState.northOpenUntil,amount,weapon});
`);
fixture=inject(fixture,'   const {x:cx,y,z:cz,attack,heading,david}=poiMonsterPose(obj,s,now),part=mesh();',`
   const {x:cx,y,z:cz,attack,heading,david}=poiMonsterPose(obj,s,now),part=mesh();
   if(obj.x===64&&obj.z===13&&obj.y===-1&&attack){const log=window.__qaFortDraw??=[];if(log.length<120)log.push({phase:attack.phase,exposed:!!attack.exposed,tell:attack.tell??0,now,kind:s.playerAttack?.northAttack});}`);
// Record actual submitted VBO vertex count and active blend opacity, after
// the real WebGL drawing call has completed. Baseline remains red by behavior.
const axeDraw=' try{for(const {gpu,alpha} of draws){gl.blendColor(0,0,0,alpha);draw(gpu,vp)}}';
if(fixture.includes('function poiDrawNorthAxeCue(now,vp){')){
 fixture=inject(fixture,axeDraw,` try{for(const {gpu,alpha} of draws){
  gl.blendColor(0,0,0,alpha);draw(gpu,vp);
  const log=window.__qaFortAxeCue??=[];
  if(log.length<120)log.push({now,drawn:gpu.count,alpha});
 }}`);
}
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<!doctype html><title>North Fort QA</title>':fixture)});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const origin='http://127.0.0.1:'+server.address().port;
let browser,checkpoint='launch';
const watchdog=setTimeout(()=>{console.error('North Fort browser stalled at '+checkpoint);process.exit(1)},110000);
const directions={'ArrowUp':[0,-1],'ArrowDown':[0,1],'ArrowLeft':[-1,0],'ArrowRight':[1,0]};
const same=(a,b)=>a.x===b.x&&a.z===b.z&&a.y===b.y;
async function boot(position,{night=false,kit={},gateCombat=false}={}){
 const ctx=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:.60,isMobile:true,hasTouch:true});
 const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(12500);
 const clockStart=new Date('2026-11-23T12:00:00Z');
 if(gateCombat){
  await p.clock.install({time:clockStart});
  await p.addInitScript(()=>{window.__qaFortGateCombat=true});
 }
 await p.goto(origin+'/seed');
 await p.evaluate(({position,night,kit})=>{
  const worn={head:null,torso:null,legs:null,feet:null};
  localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weapon:'equipWoodSword',potions:0,worn,...kit}));
  localStorage.setItem('world-workshop-town-clock-v1',JSON.stringify({version:1,gameMs:(night?23*60:11*60)*500}));
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{...position,facing:0},townLayout:5,townMapHeight:128,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:position.y,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 },{position,night,kit});
 await p.goto(origin+'/?resume=1&test=1');
 await p.locator('#pineStartupCover').waitFor({state:'hidden'});
 const when=(f,a,t=5000)=>p.waitForFunction(f,a,{polling:30,timeout:t});
 await when(()=>window.__editorTest?.facility()?.active&&document.querySelector('#viewWrap').hasAttribute('data-analog-play'),null,8500);
 const q=()=>p.evaluate(()=>window.__editorTest.northFortQA.status());
 assert.deepEqual((await q()).position,position,'normal resume restored the correct floor and coordinate');
 const step=async (key,target)=>{
  const have=(await q()).position,[dx,dz]=directions[key];
  target??={x:have.x+dx,z:have.z+dz,y:have.y};
  await when(()=>{const s=window.__editorTest.northFortQA.status();return s.now>=s.ready},null,2800);
  await p.keyboard.press(key);
  try{await when(goal=>{const v=window.__editorTest.northFortQA.status().position;return v.x===goal.x&&v.z===goal.z&&v.y===goal.y},target,4300)}
  catch(e){throw new Error('Actual '+key+' from '+JSON.stringify(have)+' to '+JSON.stringify(target)+' stalled at '+JSON.stringify(await q()),{cause:e})}
  return await q();
 };
 if(gateCombat){
  // Pausing shortly beyond page time preserves all initialized
  // timestamps. From here real CDP events drive the real input handlers, while
  // game/RAF time advances only explicitly and cannot be starved by WebGL.
  const wall=await p.evaluate(()=>Date.now());
  await p.clock.pauseAt(wall+1500);
 }
 return {p,ctx,errors,q,when,step};
}
async function counter(far){
 const tag=far?'far axe escape':'close axe flank';
 const {p,ctx,errors,q}=await boot({x:64,z:far?17:14,y:-1},{gateCombat:true});
 let cdp;
 try{
  checkpoint=tag+' ready';
  const start=await q();assert(start.screen&&start.type==='monsterNorthMinotaur'&&start.bossHP>=170);
  const pad=await p.locator('#poiAnalogPad').boundingBox(),action=await p.locator('#poiWalkAction').boundingBox();
  assert(pad&&action);
  const left={x:Math.round(pad.x+pad.width/2),y:Math.round(pad.y+pad.height/2),id:1,radiusX:4,radiusY:4,force:.7};
  cdp=await ctx.newCDPSession(p);
  const touch=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
  const ret=(fx,fz)=>touch('touchMove',[{...left,x:left.x+fx,y:left.y+fz}]);
  // Initial location only: the boss remains gated until the actual CDP
  // thumb is down. Evasion, contact, and the counter all run normally.
  if(!far)await p.evaluate(()=>window.__editorTest.northFortQA.corner());
  const corner=!far?await p.evaluate(()=>window.__editorTest.northFortQA.motion()):null;
  if(corner)assert(Math.abs(corner.x-64.78)<.001&&Math.abs(corner.z-13.84)<.001);
  const motion=()=>p.evaluate(()=>window.__editorTest.northFortQA.motion());
  // Installing/pausing a virtual clock can put performance.now behind a
  // scheduler deadline created during normal startup. Synchronize to that
  // real deadline with combat still DISARMED, before any physical touch.
  // Fast-forward skips rendering stale intermediate frames; once armed we
  // use only normal frame increments for all movement, impact and recovery.
  const initial=await motion();
  const clockDebt=Math.ceil(initial.nextMob-initial.now);
  if(clockDebt>380)await p.clock.fastForward(clockDebt+32);
  const aligned=await motion();
  assert(aligned.nextMob-aligned.now<=400&&!aligned.strike,
   'disarmed gameplay clock is synchronized: '+JSON.stringify({initial,aligned}));
  await touch('touchStart',[left]);
  assert.equal((await motion()).strike,null,'the boss did not precommit before the real thumb contact');
  await p.evaluate(()=>window.__editorTest.northFortQA.arm(false));
  let swing;
  const armedAt=await motion();
  let observed=armedAt;
  // poiMobFrame visits enemies every 380ms, even when the fixture's boss
  // gate is disarmed. Wait up to two real scheduler periods, peeking in
  // small increments so a newly committed tell never loses its windup.
  for(let i=0;i<28&&!swing;i++){
   await p.clock.runFor(32);
   observed=await motion();
   if(observed.strike?.pending)swing=observed.strike;
  }
  assert(swing,'normal RAF starts a pending boss tell: '+JSON.stringify({armedAt,observed}));
  assert.equal(swing.kind,'axe');
  if(far)assert(Math.abs(swing.dx)<.04&&swing.dz>.93,'far swing still commits straight south');
  else assert(swing.dx>.55&&swing.dz>.55,'boss commits its real attack toward the southeast flank');
  checkpoint=tag+' genuine stick evasion';
  const voluntarilySafe=m=>far?m.x>65.10:
   (m.x-swing.sx)*swing.dx+(m.z-swing.sz)*swing.dz<-.04&&Math.hypot(m.x-swing.sx,m.z-swing.sz)<=1.24;
  await ret(far?53:0,far?0:-53);
  let stance;
  for(let i=0;i<45;i++){
   await p.clock.runFor(16);
   stance=await motion();
   if(voluntarilySafe(stance))break;
  }
  assert(voluntarilySafe(stance)&&stance.now<swing.hit,'genuine stick reaches a safe counter stance during the original windup: '+JSON.stringify({swing,stance}));
  await touch('touchEnd',[]);
  checkpoint=tag+' actual contact';
  await p.clock.runFor(Math.ceil(swing.hit-stance.now)+64);
  const settled=await q(),contact=settled.contacts.find(t=>t.kind==='axe'&&t.now>=swing.hit);
  assert(contact&&settled.strike.dx===swing.dx&&settled.strike.dz===swing.dz);
  const dx=contact.x-swing.sx,dz=contact.z-swing.sz,radius=Math.hypot(dx,dz);
  assert.equal(settled.hp,start.hp,'the real committed axe strike misses a physical escape');
  assert.equal(settled.hits.length,0);assert.equal(settled.bossHP,start.bossHP,'dodging never automatically deals damage');
  if(far){
   assert(radius>4.02,'at hit time actual position is outside the 4-tile arc: '+JSON.stringify(contact));
   assert(settled.openUntil<=contact.now,'far whiff does not grant full-damage exposure in the actual state');
   await p.clock.runFor(96);
   const farPose=await q();
   assert(farPose.tell.some(d=>d.kind==='axe'&&d.now>=contact.now&&['recover','braced'].includes(d.phase)&&!d.exposed),
    'actual post-whiff render reaches a braced recovery pose');
   assert(farPose.tell.filter(d=>d.kind==='axe'&&d.now>=contact.now).every(d=>d.phase!=='open'&&!d.exposed),
    'the real post-whiff WebGL pose stays braced rather than displaying the full opening');
  }else{
   assert(dx*swing.dx+dz*swing.dz<0&&radius<=1.62+1e-6,
    'at hit time actual position is behind the committed plane and within the true close-dodge capture window: '+JSON.stringify(contact));
   assert(settled.openUntil>settled.now,'close escape exposes the boss to a practical counter');
  }
  if(!far){
   const actualStance=await motion(),gap=Math.hypot(actualStance.x-swing.sx,actualStance.z-swing.sz);
   assert(gap<=1.30&&actualStance.now<settled.openUntil,'real wooden sword starts inside 1.30 while the same dodge is still open: '+JSON.stringify({gap,actualStance}));
  }
  checkpoint=tag+' actual wooden sword';
  await p.touchscreen.tap(action.x+action.width/2,action.y+action.height/2);
  await p.clock.runFor(192);
  const end=await q();
  assert(end.action>settled.action&&!end.pending,'actual touchscreen tap dispatches and completes wooden sword');
  if(far){
   assert.equal(end.bossHP,start.bossHP,'same real wooden sword cannot counter from the safe outside position');
   assert.equal(end.durability,start.durability,'far empty swing spends no weapon durability');
   assert.equal(end.counters.length,0);
  }else{
   assert.equal(start.bossHP-end.bossHP,28,'same true sword lands all 28 damage during the close opening');
   assert(end.tell.some(d=>d.kind==='axe'&&d.now>=contact.now&&d.exposed),'near recovery visibly exposes the bull unlike the far miss');
   assert.equal(end.durability,start.durability-1);
   assert(end.counters.some(c=>c.weapon==='equipWoodSword'&&c.now>=contact.now&&c.now<c.openUntil),
    'counter is confirmed by the native HP callback during the same dodge opening, not after it expired');
  }
  assert.deepEqual(errors,[]);
  console.log('PASS '+tag+' with real motion, contact and same wood sword');
 }catch(e){console.error(checkpoint,JSON.stringify(await q().catch(()=>null)),errors);throw e}
 finally{await cdp?.detach();await ctx.close()}
}
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--disable-features=SyntheticPointerActions']});
 await counter(false);await counter(true);
}finally{await browser?.close();await new Promise(r=>server.close(r));clearTimeout(watchdog)}
