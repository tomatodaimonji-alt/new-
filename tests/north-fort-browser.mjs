import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const routeOnly=process.argv.includes('--route-only'),bossOnly=process.argv.includes('--boss-only'),axeOnly=process.argv.includes('--axe-only');
function inject(s,a,b){assert.equal(s.split(a).length,2,a);return s.replace(a,b)}
const anchor='  freeMovementPose:()=>({x:poiWalkViewX,z:poiWalkViewZ,level:poiWalkLevel}),';
let fixture=inject(html,anchor,anchor+`
  northFortQA:{
   arm:priorAxe=>{
    if(priorAxe){const state=[...poiMonsterStates].find(([o])=>o.type==='monsterNorthMinotaur')?.[1];
     if(state)state.northLastAttack='axe';}
    window.__qaFortArm=true;
   },
   motion:()=>{const now=performance.now(),a=[...poiMonsterStates].find(([o])=>o.type==='monsterNorthMinotaur')?.[1]?.playerAttack;
    return {now,x:poiWalkViewX,z:poiWalkViewZ,strike:a?{kind:a.northAttack,dx:a.dx,dz:a.dz,sx:a.sx,sz:a.sz,start:a.start,hit:a.hit,pending:a.pending}:null};
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
     tell:window.__qaFortDraw??[],hits:window.__qaFortHits??[],action:poiWalkActionStarted,pending:!!poiPlayerWeaponPending,
     locked:!!o&&poiAimLocked?.id===o};
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
fixture=inject(fixture,'   const {x:cx,y,z:cz,attack,heading}=poiMonsterPose(obj,s,now),part=mesh();',`
   const {x:cx,y,z:cz,attack,heading}=poiMonsterPose(obj,s,now),part=mesh();
   if(obj.x===64&&obj.z===13&&obj.y===-1&&attack){const log=window.__qaFortDraw??=[];if(log.length<120)log.push({phase:attack.phase,tell:attack.tell??0,now,kind:s.playerAttack?.northAttack});}`);
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
const watchdog=setTimeout(()=>{console.error('North Fort browser stalled at '+checkpoint);process.exit(1)},125000);
const directions={'ArrowUp':[0,-1],'ArrowDown':[0,1],'ArrowLeft':[-1,0],'ArrowRight':[1,0]};
const same=(a,b)=>a.x===b.x&&a.z===b.z&&a.y===b.y;
async function boot(position,{night=false,kit={},gateCombat=false}={}){
 const ctx=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:.75,isMobile:true,hasTouch:true});
 const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(12500);
 if(gateCombat)await p.addInitScript(()=>{window.__qaFortGateCombat=true});
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
 return {p,ctx,errors,q,when,step};
}
async function route(){
 const h=await boot({x:66,z:4,y:0});
 const {p,ctx,errors,q,step,when}=h;
 try{
  checkpoint='surface authored approach';
  const original=await q(),url=p.url();
  assert.equal(original.spec?.name,'北の古砦','Fort is in the existing base world, not a new app or page');
  assert.deepEqual(original.spec.surfaceStand&&[original.spec.surfaceStand.x,original.spec.surfaceStand.z,original.spec.surfaceStand.y],[58,1,0]);
  for(let z=3;z>=1;z--)await step('ArrowUp');
  for(let x=65;x>=58;x--)await step('ArrowLeft');
  checkpoint='north gate real crossing';
  await step('ArrowUp',{x:64,z:24,y:-1});
  await when(()=>window.__editorTest.northFortQA.status().mini?.location==='北の古砦');
  await when(()=>window.__editorTest.northFortQA.status().position.y===-1&&document.querySelector('#app').classList.contains('facilityCellar'));
  // Position/HUD are updated by input before the next 3D scene submission.
  // Wait for the actual current sign VBO list; the old surface list may persist one frame.
  await when(()=>!window.__editorTest.northFortQA.status().signIds.includes('pineGuildWorldMap'),null,4500);
  let s=await q();assert.equal(s.mini.stars,'★★★★★☆☆☆☆☆');
  assert(!s.signIds.includes('pineGuildWorldMap'),'the real fort scene must not upload the surface Guild map overlay');
  const title=await p.locator('#poiLocationName').textContent();assert.equal(title,'北の古砦');
  checkpoint='actual corridor and authored boss discovery';
  for(let z=23;z>=19;z--)await step('ArrowUp');
  await when(()=>{const s=window.__editorTest.northFortQA.status();return s.screen&&s.locked});
  s=await q();assert(!s.signIds.includes('pineGuildWorldMap'),'the native scene still excludes the Guild atlas in the boss arena');assert.equal(s.type,'monsterNorthMinotaur','enters chamber and discovers the actual authored high-rank boss');
  assert(s.bossHP>=150);assert.equal(s.position.y,-1);
  checkpoint='physically return to same northern road';
  for(let z=20;z<=24;z++)await step('ArrowDown');
  await step('ArrowDown',{x:58,z:1,y:0});
  const back=await q();assert(same(back.position,{x:58,z:1,y:0}));assert.equal(p.url(),url,'fort portal makes no browser navigation');
  await when(()=>window.__editorTest.northFortQA.status().signIds.includes('pineGuildWorldMap'),null,5000);
  assert(back.hp>0);assert.deepEqual(errors,[]);
  console.log('PASS real northern road through connected rank-5 fort, boss discovery with projected target, and surface return');
 }catch(e){console.error(checkpoint,JSON.stringify(await q().catch(()=>null)),errors);throw e}
 finally{await ctx.close()}
}
async function battle(mode){
 const evade=mode==='horn-evade',edgeStand=mode==='axe-edge-stand',edgeAvoid=mode==='axe-edge-side',axEdge=edgeStand||edgeAvoid;
 const tag=mode;
 const {p,ctx,errors,q,when}=await boot({x:64,z:axEdge?17:14,y:-1},{gateCombat:true});
 let cdp;
 try{
  checkpoint=tag+': authored chamber';
  const start=await q();
  assert.equal(start.type,'monsterNorthMinotaur');
  assert.equal(start.bossHP,224);assert.equal(start.hp,100);
  assert(start.screen);
  const pad=await p.locator('#poiAnalogPad').boundingBox(),action=await p.locator('#poiWalkAction').boundingBox();
  assert(pad&&action);
  const left={x:Math.round(pad.x+pad.width/2),y:Math.round(pad.y+pad.height/2),id:1,radiusX:4,radiusY:4,force:.7};
  cdp=await ctx.newCDPSession(p);
  const touch=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
  if(evade||edgeAvoid)await touch('touchStart',[left]);
  // Arm an authored next horn after an earlier axe, while already in counter range.
  await p.evaluate(priorAxe=>window.__editorTest.northFortQA.arm(priorAxe),evade);
  const mark=await when(()=>{const s=window.__editorTest.northFortQA.motion();return s.strike?.pending&&s.strike});
  const threat=await mark.jsonValue();
  assert.equal(threat.kind,evade?'horn':'axe');
  assert(threat.hit-threat.start>=600&&threat.hit-threat.start<=1000,'both attacks wind up long enough for a real cue');
  assert(Math.abs(threat.dx)<.04&&threat.dz>.93,'windup commits south toward the initial target');
  if(edgeAvoid){
   checkpoint=tag+': real lateral movement outside four-tile edge';
   await touch('touchMove',[{...left,x:left.x+51}]);
   await when(()=>window.__editorTest.northFortQA.motion().x>=64.87,null,1800);
   await touch('touchEnd',[]);
  }
  if(evade){
   checkpoint=tag+': physical analog across lane';
   // Clear the narrow (.48) horn lane first at full lateral speed. A
   // shallower diagonal could clear it only after contact on slow WebGL.
   await touch('touchMove',[{...left,x:left.x+53}]);
   await when(()=>window.__editorTest.northFortQA.motion().x>=64.60,null,1800);
   await touch('touchEnd',[]);
  }
  checkpoint=tag+': after strike';
  await when(start=>{const s=window.__editorTest.northFortQA.status();return s.strike?.start===start&&!s.strike.pending},threat.start,4200);
  const after=await q();
  assert.equal(after.strike.dx,threat.dx);assert.equal(after.strike.dz,threat.dz,'direction never tracks after the cue');
  assert(after.tell.some(d=>d.kind===threat.kind&&d.phase==='windup'&&d.tell>0&&d.now<threat.hit),'actual bull mesh rendered its distinct warm anticipation');
  if(axEdge){
   const from=Math.hypot(start.pos.x-threat.sx,start.pos.z-threat.sz);
   assert(Math.abs(from-4)<.01,'the real strike begins at the exact new four-tile boundary');
   assert(after.axeCue.some(a=>a.drawn>=96&&a.alpha>=.16&&a.alpha<.38&&a.now>=threat.start&&a.now<threat.hit),'a real semicircle WebGL cue draws during the committed wind-up');
   await when(hit=>window.__editorTest.northFortQA.status().axeCue.some(a=>a.now>=hit&&a.drawn>=96&&a.alpha>=.26&&a.alpha<=.37),threat.hit,750);
  }
  if(edgeAvoid){
   assert(Math.hypot(after.pos.x-threat.sx,after.pos.z-threat.sz)>4.07,'physical side-step clears the arc even though still in front');
   assert.equal(after.hp,100);assert.equal(after.hits.length,0,'outside the actual semicircle takes no damage');
  }else if(!evade){
   assert.equal(after.hits.length,1);
   assert.equal(100-after.hp,33,'authored axe sweep hits an unarmored tank for real damage once');
  }else{
   assert(after.pos.x>=64.60);
   const actual=after.contacts.find(a=>a.kind==='horn'&&a.now>=threat.hit);
   assert(actual&&Math.abs(actual.x-threat.sx)>.48,'physical player was outside the horn lane at actual contact: '+JSON.stringify(actual));
   assert.equal(after.hp,100);assert.equal(after.hits.length,0);
   checkpoint=tag+': await drawn vulnerability and counter';
   await when(start=>window.__editorTest.northFortQA.status().tell.some(d=>d.kind==='horn'&&d.phase==='open'&&d.now>=start),threat.hit,1250);
   let near=await q();
   if(Math.hypot(near.pos.x-near.boss.x,near.pos.z-near.boss.z)>1.23){
    await touch('touchStart',[left]);await touch('touchMove',[{...left,x:left.x-13,y:left.y-37}]);
    await when(()=>{const s=window.__editorTest.northFortQA.status();return Math.hypot(s.pos.x-s.boss.x,s.pos.z-s.boss.z)<=1.14},null,850);
    await touch('touchEnd',[]);near=await q();
   }
   assert(near.openUntil>near.now,'the visible recovery is still active when the player attacks');
   await p.touchscreen.tap(action.x+action.width/2,action.y+action.height/2);
   await when(at=>{const s=window.__editorTest.northFortQA.status();return s.action>at&&!s.pending},near.action,3200);
   assert.equal(224-(await q()).bossHP,28,'real wooden-sword contact during the open horn recovery');
  }
  assert.deepEqual(errors,[]);
  console.log('PASS connected North Fort '+tag+' render and combat');
 }catch(e){console.error(checkpoint,JSON.stringify(await q().catch(()=>null)),errors);throw e}
 finally{await cdp?.detach();await ctx.close()}
}
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--disable-features=SyntheticPointerActions']});
 if(!bossOnly&&!axeOnly)await route();
 if(!routeOnly){
  if(!axeOnly){await battle('axe-close-stand');await battle('horn-evade')}
  await battle('axe-edge-stand');await battle('axe-edge-side');
 }
}finally{await browser?.close();await new Promise(r=>server.close(r));clearTimeout(watchdog)}
