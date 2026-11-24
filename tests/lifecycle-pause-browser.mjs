import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const anchor='  freeMovementPose:()=>({x:poiWalkViewX,z:poiWalkViewZ,level:poiWalkLevel}),';
assert.equal(html.split(anchor).length,2);
let h=html.replace(anchor,anchor+`
  pauseQA:{
   frame:()=>render(),
   hp:v=>{poiPlayerHP=v;poiCombatHud()},
   retainMusic:()=>!!(window.__pauseMusic=poiOrchestraDecks.get('outside')?.fieldLoop?.source),
   sameMusic:()=>!!window.__pauseMusic&&poiOrchestraDecks.get('outside')?.fieldLoop?.source===window.__pauseMusic,
   setEnemy:(axis=0)=>{
    const dx=axis===1?1:0,dz=axis===1?0:axis===4?4:1,
      o={type:'monsterSlime',x:poiWalkX+dx,z:poiWalkZ+dz,y:poiWalkLevel,rot:0};
    const s=poiCombatActorMake(o);s.hp=100;s.townOwned=true;s.nextAttack=Infinity;
    poiMonsterStates.clear();world.push(o);poiMonsterStates.set(o,s);window.__target={o,s};
    poiCombatLockReset();
   },
   enemyWindup:()=>{
    const {o,s}=window.__target;s.nextAttack=0;s.townOwned=false;return poiEnemyBeginPlayer(o,s,performance.now());
   },
   eraseEnemy:()=>{const q=window.__target;if(q){poiMonsterStates.delete(q.o);const i=world.indexOf(q.o);if(i>=0)world.splice(i,1)}window.__target=null;},
   state:()=>{
    const a=poiPlayerWeaponPending,h=poiHealingCast,enemy=window.__target?.s,ctx=poiAudioContext,k=poiHotbarRead();
    return {frozen:poiGameFrozen(),wall:window.performance.now(),now:performance.now(),
     town:poiTownClockGameMs,nextMob:poiNextMobTick,ready:poiAttackReady,npc:poiTownNpcActors.slice(0,8).map(c=>[c.x,c.z,c.y,c.mode]),
     pos:[poiWalkX,poiWalkZ,poiWalkLevel],fraction:[poiWalkViewX,poiWalkViewZ],thumb:!!poiAnalogContact,
     action:poiWalkActionStarted,attack:a?{phase:a.phase,began:a.started,type:a.type}:null,
     enemy:enemy?{x:enemy.x,z:enemy.z,hp:enemy.hp,pending:enemy.playerAttack?.pending??null}:null,
     done:h?{start:h.start,end:h.end}:null,healHp:poiPlayerHP,weapon:poiEquippedWeapon(),
     herbs:poiInventorySlots(k)[2]?.count??0,wear:poiInventorySlots(k)[1]?.durability??null,
     companion:poiCompanionSnapshot(performance.now()),
     audio:ctx?{state:ctx.state,time:ctx.currentTime,interval:poiAudioInterval!==null,
      deck:poiOrchestraActive,field:!!poiOrchestraDecks.get('outside')?.fieldLoop,notes:poiAudioNotes.size,source:poiAudioTransient.size}:null};
   }
  },`);
const raf=' requestAnimationFrame(render);';
assert.equal(h.split(raf).length,2);h=h.replace(raf,' if(!window.__pauseManual)requestAnimationFrame(render);');
for(const [,s] of h.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(s);
if(process.env.PAUSE_PARSE_ONLY)process.exit(0);
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<!doctype html>':h)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url='http://127.0.0.1:'+server.address().port;
let browser,phase='boot';
try{
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const c=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:.7,isMobile:true,hasTouch:true});
 const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>{
  window.__visibilityFixture=false;
  Object.defineProperty(document,'hidden',{get:()=>window.__visibilityFixture,configurable:true});
  window.PineLifecycle={isForeground:()=>true};
 });
 await p.clock.install({time:new Date('2026-04-01T10:00:00Z')});
 await p.goto(url+'/seed');
 await p.evaluate(()=>{
  const slots=Array(27).fill(null);slots[0]={type:'equipWoodSword',count:1};slots[1]={type:'equipWoodBow',count:1,durability:30};slots[2]={type:'healingHerb',count:2};slots[3]={type:'slimeSoul',count:1,durability:36};
  localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weaponDurabilityVersion:2,weapon:'equipWoodSword',potions:2,gold:0,slots,souls:{slimeSoul:{owned:true}}}));
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:105,z:83,y:0,facing:2},townLayout:5,townMapHeight:128,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.35,orbitDistance:5.5}}));
 });
 await p.goto(url+'/?resume=1&test=1',{waitUntil:'domcontentloaded'});
 await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:40000});
 await p.clock.pauseAt((await p.evaluate(()=>Date.now()))+500);
 await p.evaluate(()=>{window.__pauseManual=true});
 const native=on=>p.evaluate(on=>window.__workshopForegroundChanged(on),on);
 const visible=on=>p.evaluate(on=>{window.__visibilityFixture=!on;document.dispatchEvent(new Event('visibilitychange'))},on);
 const pageaway=on=>p.evaluate(on=>window.dispatchEvent(new PageTransitionEvent(on?'pagehide':'pageshow',{persisted:true})),on);
 const q=(name,value)=>p.evaluate(([name,value])=>window.__editorTest.pauseQA[name](value),[name,value]);
 const snap=()=>q('state');
 const tick=async(t)=>{await p.clock.fastForward(t);await q('frame');return snap()};
 const audio=state=>p.waitForFunction(state=>window.__editorTest.pauseQA.state().audio?.state===state,state,{polling:30,timeout:8000});
 const hit=p.locator('#poiWalkAction');
 const cdp=await c.newCDPSession(p);
 const same=(a,b,keys)=>{for(const k of keys)assert.deepEqual(b[k],a[k],k)};
 phase='trusted bow windup, short + long overlapping Android/background reasons and suspended audio';
 await p.locator('[data-hotbar-slot="1"]').tap();
 assert.equal((await snap()).weapon,'equipWoodBow');
 // A physical field step makes the actual footstep path unlock Web Audio.
 // Merely changing a weapon slot does not request audio on a fresh tab.
 const beforeStep=await snap();await p.keyboard.press('ArrowUp');const unlocked=await tick(220);
 assert.notDeepEqual(unlocked.pos,beforeStep.pos,'genuine movement delivers the unlock gesture');
 await audio('running');
 let music=await snap();
 for(let i=0;i<10&&!music.audio.field;i++)music=await tick(220);
 assert(music.audio.field&&await q('retainMusic'),'actual field AudioBufferSource is active');
 await q('setEnemy',0);await hit.tap();
 let prior=await snap();assert.equal(prior.attack?.type,'equipWoodBow',JSON.stringify(prior));assert.equal(prior.enemy.hp,100);
 await audio('running');
 await native(false);await audio('suspended');prior=await snap();
 assert(prior.frozen&&!prior.audio.interval);
 await native(false);await visible(false);
 for(let i=0;i<10;i++)await tick(i===0?23:3300);
 await native(true);await pageaway(true);await visible(true);await tick(450);
 const freeze=await snap();
 same(prior,freeze,['now','town','nextMob','npc','pos','fraction','attack','enemy','wear','companion','audio']);
 assert(freeze.wall-prior.wall>30000&&freeze.frozen);
 await pageaway(false);await audio('running');
 let after=await snap();assert(!after.frozen&&after.audio.interval);
 same(prior,after,['now','attack','enemy','wear']);assert(await q('sameMusic'),'resume preserves the same actual loop source');
 for(let i=0;i<11;i++)after=await tick(45);
 assert(after.enemy.hp<100,'existing shot lands in visible time after resuming');assert.equal(after.wear,prior.wear-1);
 const once=after.enemy.hp;for(let i=0;i<10;i++)after=await tick(45);assert.equal(after.enemy.hp,once);
 const backgroundMs=freeze.wall-prior.wall;
 phase='released long arrow stays in flight during actual page lifecycle pause';
 for(let i=0;i<7;i++)after=await tick(55);
 await q('eraseEnemy');await q('setEnemy',4);await hit.tap();
 for(let i=0;i<13&&after.attack?.phase!=='flight';i++)after=await tick(35);
 assert(after.attack?.phase==='flight'&&after.enemy.hp===100,JSON.stringify(after));
 await visible(false);prior=await snap();await tick(9500);
 same(prior,await snap(),['now','attack','enemy','wear','pos','town']);
 await visible(true);
 for(let i=0;i<11;i++)after=await tick(45);
 assert(after.enemy.hp<100&&after.wear===prior.wear-1,JSON.stringify(after));
 phase='trusted healing shortcut, stale action release discarded, cast continues exactly once';
 await q('eraseEnemy');await q('hp',10);
 await p.keyboard.press('3');prior=await tick(85);
 assert(prior.done&&prior.herbs===2&&prior.healHp===10);
 await visible(false);prior=await snap();await pageaway(true);await tick(7500);await native(true);
 same(prior,await snap(),['now','town','done','healHp','herbs']);
 await visible(true);assert((await snap()).frozen);await pageaway(false);
 after=await snap();assert(after.done&&after.healHp===10);
 for(let i=0;i<32;i++)after=await tick(48);
 assert(!after.done&&after.herbs===1&&after.healHp===40);
 phase='actual enemy attack pending and no wall time catch-up';
 await q('setEnemy',1);
 const began=await q('enemyWindup');prior=await tick(40);
 assert(prior.enemy.pending,JSON.stringify({began,prior}));
 await native(false);prior=await snap();await tick(14000);
 same(prior,await snap(),['now','town','nextMob','enemy','healHp','pos']);
 await native(true);
 for(let i=0;i<27;i++)after=await tick(45);
 assert(after.healHp<prior.healHp,'real committed enemy attack reaches contact after resume');
 phase='actual new companion command then physical thumb invalidation';
 await q('eraseEnemy');
 await p.locator('[data-hotbar-slot="3"]').tap();
 await p.locator('#poiCompanionCommands [data-companion-command="summon"]').tap({timeout:4000});
 after=await tick(60);
 assert.equal(after.companion.active,'slimeSoul');assert(after.companion.actor);
 const pad=p.locator('#poiAnalogPad'),box=await pad.boundingBox();
 assert(box);
 const x=box.x+box.width/2,y=box.y+box.height/2;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:41}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+44,y,id:41}]});
 after=await tick(32);assert(after.thumb);
 await native(false);prior=await snap();
 assert(prior.frozen&&!prior.thumb);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await tick(6500);
 same(prior,await snap(),['now','town','nextMob','npc','companion','pos','fraction','action']);
 await native(true);after=await tick(80);assert(!after.thumb);
 same(prior,after,['pos','fraction','action']);
 assert.equal(after.companion.active,'slimeSoul');
 assert.deepEqual(errors,[]);
 console.log('PAUSE NATIVE',JSON.stringify({pauseMs:backgroundMs,healing:after.herbs,audio:freeze.audio,enemyHP:after.healHp}));
}catch(e){console.error(phase);throw e}
finally{await browser?.close();await new Promise(r=>server.close(r))}
