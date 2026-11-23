import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const anchor='  freeMovementPose:()=>({x:poiWalkViewX,z:poiWalkViewZ,level:poiWalkLevel}),';
function inject(s,a,b){assert.equal(s.split(a).length,2,a);return s.replace(a,b)}
let fixture=inject(html,anchor,anchor+`
  guardianDuelQA:{
   arm:()=>{window.__qaDuelArmed=true},
   status:()=>{
    const rows=[...poiMonsterStates],boss=rows.find(([o])=>o.type==='monsterMineGuard'&&o.x===120&&o.z===55&&o.y===-1);
    const o=boss?.[0],s=boss?.[1],a=s?.playerAttack,now=performance.now();
    return {hp:poiPlayerHP,bossHP:s?.hp,bossPose:s?{x:s.x,z:s.z}:null,now,openUntil:s?.guardOpenUntil??0,
     pose:{x:poiWalkViewX,z:poiWalkViewZ},walk:{x:poiWalkX,z:poiWalkZ,y:poiWalkLevel},weapon:poiEquippedWeapon(),
     threats:poiEnemyThreatTiles(now).filter(t=>t.type==='monsterMineGuard'),
     strike:a?{start:a.start,hit:a.hit,dx:a.dx,dz:a.dz,pending:a.pending,trial:!!a.guardTrial,visualHitAt:a.visualHitAt}:null,
     draw:window.__qaDuelDraw??[],hits:window.__qaDuelHits??[],action:poiWalkActionStarted,actionPending:!!poiPlayerWeaponPending,
     onScreen:o?!!poiWorldToScreen(parameters().vp,s.x+.5,terrainY(s.x,s.z)+o.y*1.4+.75,s.z+.5):false};
   }
  },`);
// Do not consume a first swing during the visual startup cover on slow
// Chromium; from arm onward the exact authored action engine runs normally.
fixture=inject(fixture,'function poiEnemyBeginPlayer(obj,s,now){',
 'function poiEnemyBeginPlayer(obj,s,now){if(obj.type==="monsterMineGuard"&&!window.__qaDuelArmed)return false;');
fixture=inject(fixture,'function poiMobHitPlayer(obj,now,attackDamage){',`function poiMobHitPlayer(obj,now,attackDamage){
 const before=poiPlayerHP;
 try{return __qaGuardianHit(obj,now,attackDamage)}
 finally{if(obj.type==='monsterMineGuard')(window.__qaDuelHits??=[]).push({before,after:poiPlayerHP,now})}
}
function __qaGuardianHit(obj,now,attackDamage){`);
// Read the actual pose used in the monster WebGL mesh build, not merely a
// threat flag computed as part of the AI. Frame probes do not drive the game.
fixture=inject(fixture,'   const {x:cx,y,z:cz,attack,heading}=poiMonsterPose(obj,s,now),part=mesh();',`
   const {x:cx,y,z:cz,attack,heading}=poiMonsterPose(obj,s,now),part=mesh();
   if(obj.type==='monsterMineGuard'&&attack){const log=window.__qaDuelDraw??=[];if(log.length<110)
    log.push({now,phase:attack.phase,exposed:!!attack.exposed,tell:attack.tell??0,pitch:attack.pitch,dx:s.playerAttack?.dx,dz:s.playerAttack?.dz});}`);
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<!doctype html><title>Guardian duel QA</title>':fixture)});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const origin='http://127.0.0.1:'+server.address().port;
let browser,checkpoint='launch';
const watchdog=setTimeout(()=>{console.error('Guardian browser stalled at '+checkpoint);process.exit(1)},65000);
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--disable-features=SyntheticPointerActions']});
 for(const evade of [false,true]){
  const ctx=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:.75,isMobile:true,hasTouch:true});
  const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(13000);
  const tag=evade?'sidestep':'stand';
  const q=()=>p.evaluate(()=>window.__editorTest.guardianDuelQA.status());
  const when=(predicate,arg,timeout=4500)=>p.waitForFunction(predicate,arg,{polling:25,timeout});
  let cdp;
  try{
   checkpoint=tag+': boot';
   await p.goto(origin+'/seed');
   await p.evaluate(()=>{
    const worn={head:null,torso:null,legs:null,feet:null};
    localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weapon:'equipWoodSword',potions:0,worn}));
    localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":575000}');
    localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
     position:{x:120,z:56,y:-1,facing:0},townLayout:5,townMapHeight:128,
     view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:-1,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
   });
   await p.goto(origin+'/?resume=1&test=1');
   await p.locator('#pineStartupCover').waitFor({state:'hidden'});
   await when(()=>window.__editorTest?.facility()?.active&&document.querySelector('#viewWrap').hasAttribute('data-analog-play'),null,9000);
   const initial=await q();
   assert(initial.bossHP>=80&&initial.hp===100&&initial.weapon==='equipWoodSword','actual authored boss and same clean old-save wooden sword load');
   assert.deepEqual(initial.walk,{x:120,z:56,y:-1});
   assert(initial.onScreen,'guardian is physically in the visible game view');
   const action=await p.locator('#poiWalkAction').boundingBox();
   const pad=await p.locator('#poiAnalogPad').boundingBox();
   assert(action&&pad);
   const hit=()=>p.touchscreen.tap(action.x+action.width/2,action.y+action.height/2);
   const originalHP=initial.bossHP;
   if(!evade){
    checkpoint=tag+': frontal wood sword';
    await hit();
    await when(at=>{const s=window.__editorTest.guardianDuelQA.status();return s.action>at&&!s.actionPending},initial.action);
    const front=await q();
    assert(originalHP-front.bossHP>0&&originalHP-front.bossHP<=10,'frontal defender reduces real wooden-sword damage: '+JSON.stringify(front));
   }
   cdp=await ctx.newCDPSession(p);
   const left={x:Math.round(pad.x+pad.width/2),y:Math.round(pad.y+pad.height/2),id:1,force:.7,radiusX:4,radiusY:4};
   const touch=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
   if(evade)await touch('touchStart',[left]); // hold neutral until the tell.
   checkpoint=tag+': committed tell';
   await p.evaluate(()=>window.__editorTest.guardianDuelQA.arm());
   const next=await when(()=>{const s=window.__editorTest.guardianDuelQA.status();return s.strike?.pending&&s});
   const committed=await next.jsonValue();
   assert(committed.strike.trial,'actual authored guardian started the new encounter swing');
   assert(committed.strike.hit-committed.strike.start>=600&&committed.strike.hit-committed.strike.start<=900,'readable wind-up');
   assert(Math.abs(committed.strike.dx)<.04&&committed.strike.dz>.92,'hammer initially commits to the player directly south');
   if(evade){
    checkpoint=tag+': physical evade';
    await touch('touchMove',[{...left,x:left.x+34,y:left.y-14}]);
    // The small forward component keeps the final real analog pose within
    // wooden-sword range after moving outside the committed narrow lane.
    await when(()=>window.__editorTest.guardianDuelQA.status().pose.x>120.86,null,2000);
    await touch('touchEnd',[]);
   }
   checkpoint=tag+': contact and recovery';
   await when(start=>{const s=window.__editorTest.guardianDuelQA.status();return s.strike?.start===start&&!s.strike.pending},committed.strike.start,4500);
   const contact=await q();
   assert.equal(contact.strike.dx,committed.strike.dx);assert.equal(contact.strike.dz,committed.strike.dz);
   assert(contact.draw.some(d=>d.phase==='windup'&&d.tell>0&&Number.isFinite(d.pitch)&&d.now<committed.strike.hit),'real rendered hammer anticipation has visible pose and warm tell');
   if(evade){
    assert(contact.pose.x>=120.86,'thumb actually escaped the line on its side');
    assert.equal(contact.hp,initial.hp,'committed direction did not follow the sidestep');
    assert.equal(contact.hits.length,0);
    assert(contact.openUntil>contact.now,'successful evade opens a real recovery window');
    checkpoint=tag+': visible opening and raw wooden-sword punish';
    await when(at=>window.__editorTest.guardianDuelQA.status().draw.some(d=>d.phase==='open'&&d.exposed&&d.now>=at),contact.strike.visualHitAt,850);
    let near=await q();
    if(Math.hypot(near.pose.x-120,near.pose.z-55)>1.23){
     // If the CDP stop landed one frame past attack distance, take a
     // short genuine step in during recovery rather than forcing a pose.
     await touch('touchStart',[left]);await touch('touchMove',[{...left,x:left.x-31,y:left.y-9}]);
     await when(()=>{const p=window.__editorTest.guardianDuelQA.status().pose;return Math.hypot(p.x-120,p.z-55)<1.15},null,850);
     await touch('touchEnd',[]);
     near=await q();
    }
    assert(near.openUntil>near.now,'recovery is still active when the player counterattacks');
    await hit();
    await when(at=>{const s=window.__editorTest.guardianDuelQA.status();return s.action>at&&!s.actionPending},initial.action,3500);
    assert.equal(originalHP-(await q()).bossHP,28,'same wooden sword now deals its unchanged raw damage');
   }else{
    assert.equal(contact.hits.length,1,'standing triggers exactly one authored guardian hit');
    assert(contact.hp<=75&&contact.hp>=70,'unguarded player takes 25–30 damage: '+JSON.stringify(contact.hits));
   }
   assert.deepEqual(errors,[]);
   console.log(tag+' guardian path passed');
  }catch(e){console.error('Guardian duel failed in '+checkpoint,JSON.stringify(await q().catch(()=>null)),errors);throw e}
  finally{await cdp?.detach();await ctx.close()}
 }
 console.log('PASS authored mine guardian telegraph, frontal tank/guard, genuine side evade and full raw wooden-sword recovery punish');
}finally{await browser?.close();await new Promise(r=>server.close(r));clearTimeout(watchdog)}
