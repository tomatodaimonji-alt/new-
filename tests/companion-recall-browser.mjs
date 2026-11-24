import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {mkdirSync,readFileSync} from 'node:fs';
import {Script} from 'node:vm';
let h=readFileSync(process.argv[2]??'world-editor.html','utf8');
const inject=(a,b)=>{assert.equal(h.split(a).length,2,a);h=h.replace(a,b);};
const api="if(facilityParams.get('test')==='1')window.__editorTest={";
inject(api,api+`
 recallQA:{
  frame:()=>render(),
  at:()=>{
   const now=performance.now(),a=poiCompanionActor,k=poiHotbarRead(),e=poiCompanionRecallEvent,fx=e&&poiCompanionRecallFrame(e,now);
   const pose=poiCompanionDrawPose,bar=poiCompanionWorldBar?.el;
   const summon=poiCompanionSummonEvent;
   return {now,xy:[poiWalkX,poiWalkZ,poiWalkLevel],free:[poiWalkViewX,poiWalkViewZ],pointer:poiAnalogContact?.id??null,walking:!!poiFreePose?.walking,hp:poiPlayerHP,death:poiPlayerDeathSnapshot(),
    active:k.companionSoul?.active??null,mode:poiCompanionMode(k),token:poiInventorySlots(k)[5]?.durability??null,
    ally:a?{id:a.id,x:a.x,z:a.z,aliveHit:!!a?.attackMotion?.pending}:null,pose:pose?[pose.x,pose.y,pose.z]:null,
    fx:e?{id:e.id,reason:e.reason,origin:[e.x,e.y,e.z],vertices:e.vertices,frame:fx,sound:!!e.played}:null,
    summon:summon?.actor===a&&a?{id:a.id,start:summon.start}:null,show:!$('poiCompanionHud').hidden,
    hpLabel:$('poiCompanionHudHpValue').textContent,bar:!!bar&&!bar.hidden,
    blocks:a?poiCompanionBlocksHostileTile(a.x,a.z,a.y,now):null,
    navBlock:e?poiCompanionBlocksHostileTile(Math.floor(e.x),Math.floor(e.z),poiWalkLevel,now):null,
    breaks:poiMonsterBreakSnapshot(now),lastEnemy:window.__recallHit??null,
    enemy:window.__recallEnemy?[window.__recallEnemy[1].x,window.__recallEnemy[1].z,window.__recallEnemy[1].hp]:null};
  },
  enemy:()=>{
   const a=poiCompanionActor;
   const spots=[[1,0],[-1,0],[0,1],[0,-1]].map(([x,z])=>[poiWalkX+x,poiWalkZ+z]);
   spots.sort((b,c)=>Math.hypot(c[0]-a.x,c[1]-a.z)-Math.hypot(b[0]-a.x,b[1]-a.z));
   const p=spots.find(([x,z])=>poiWalkCanStep(x,z,poiWalkX,poiWalkZ)&&!poiMonsterAt(x,z,true)&&
    poiCompanionAttackClear({x:poiWalkX,z:poiWalkZ},{x,z},poiWalkLevel));
   if(!p)return false;
   const o={type:'monsterSkeleton',x:p[0],z:p[1],y:poiWalkLevel,rot:0},s=poiCombatActorMake(o);
   s.nextAttack=performance.now();poiMonsterStates.set(o,s);poiMonsterMeshDirty=true;poiPlayerHP=1;poiCombatHud();
   window.__recallEnemy=[o,s];return true;
  },
  retire:()=>{const e=window.__recallEnemy;if(e){poiMonsterStates.delete(e[0]);poiMonsterMeshDirty=true;}},
  hurt:amount=>poiCompanionHurt(amount,performance.now()),
 },
`);
inject(' requestAnimationFrame(render);',' if(!window.__recallManual)requestAnimationFrame(render);');
inject('function poiWildRegionalFrame(now,rng){','function poiWildRegionalFrame(now,rng){return;');
inject('function poiWildPick(rng){','function poiWildPick(rng){return null;');
inject('function poiMobHitPlayer(obj,now,attackDamage){','function poiMobHitPlayer(obj,now,attackDamage){\n if(obj===window.__recallEnemy?.[0])window.__recallHit={type:obj.type,now,prior:poiPlayerHP};');
for(const [,body] of h.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(body);
if(process.env.RECALL_PARSE_ONLY){console.log('Parsed actual recall/death actor test');process.exit(0);}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf8');res.end(req.url==='/seed'?'<title>seed</title>':h)});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const url='http://127.0.0.1:'+server.address().port;
let browser,phase='boot',last;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const ctx=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:.75});
 const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(16000);
 await p.clock.install({time:new Date('2026-04-01T10:00:00Z')});await p.goto(url+'/seed');
 await p.evaluate(()=>{
  const slots=Array(27).fill(null);slots[0]={type:'equipWoodSword',count:1,durability:90};slots[5]={type:'orvasSoul',count:1,durability:317};
  localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weaponDurabilityVersion:2,weapon:'equipWoodSword',potions:0,slots,
   companionSoul:{version:1,active:'orvasSoul',pending:null,mode:'follow'}}));
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,position:{x:102,z:93,y:0,facing:2},
   townLayout:5,townMapHeight:182,templeDepth:1,view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:0,orbitPitch:.25,orbitDistance:5.5}}));
 });
 const load=async()=>{
  await p.goto(url+'/?resume=1&test=1',{waitUntil:'domcontentloaded'});await p.bringToFront();
  await p.locator('#pineStartupCover').waitFor({state:'hidden'});await p.waitForFunction(()=>window.__editorTest?.facility()?.active&&!document.hidden);
  await p.evaluate(()=>window.__recallManual=true);
  for(const pad of [12_000,30_000]){try{await p.clock.pauseAt((await p.evaluate(()=>Date.now()))+pad);break;}catch(e){if(pad===30_000||!String(e).includes('Cannot fast-forward to the past'))throw e;}}
 };
 await load();
 const read=async()=>last=await p.evaluate(()=>window.__editorTest.recallQA.at());
 const step=async(ms=45)=>{await p.clock.fastForward(ms);await p.evaluate(()=>window.__editorTest.recallQA.frame());return read()};
 const until=async(fn,n=150)=>{let q=await read();for(let i=0;i<n&&!fn(q);i++)q=await step();assert(fn(q),JSON.stringify(q));return q};
 const slot=p.locator('#poiHotbar [data-hotbar-slot="5"]'),btn=k=>p.locator('#poiCompanionCommands [data-companion-command="'+k+'"]');
 const shot=async n=>{if(process.env.FACILITY_SCREENSHOTS){mkdirSync(process.env.FACILITY_SCREENSHOTS,{recursive:true});await p.screenshot({path:process.env.FACILITY_SCREENSHOTS+'/'+n+'.png'});}};
 const live=await until(q=>q.ally?.id==='orvasSoul'&&q.pose&&q.show);assert.equal(live.hpLabel,'317/1050');assert(!live.summon);
 phase='real manual recall retires actor and HP marker immediately but preserves fixed fading geometry';
 const cdp=await ctx.newCDPSession(p);
 const touch=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
 const point=async(control,id)=>{const r=await control.boundingBox();assert(r);return {x:r.x+r.width/2,y:r.y+r.height/2,id};};
 const stick=await point(p.locator('#poiAnalogPad'),1),moving={...stick,y:stick.y-35};
 await touch('touchStart',[stick]);await touch('touchMove',[moving]);
 const held=await until(q=>q.pointer!==null&&q.walking);
 const secondary=async control=>{const pt=await point(control,7);await touch('touchStart',[pt]);await touch('touchEnd',[pt]);};
 await secondary(slot);await secondary(btn('dismiss'));
 const start=await read();assert.equal(start.pointer,held.pointer);assert.equal(start.active,null);assert.equal(start.ally,null);assert.equal(start.fx?.reason,'manual');
 assert.equal(start.token,317);assert(!start.show);assert(start.fx.vertices>1000);
 assert(Math.hypot(start.fx.origin[0]-held.pose[0],start.fx.origin[2]-held.pose[2])<.001);
 const middle=await step(250);assert(!middle.ally&&!middle.navBlock&&!middle.bar);assert.deepEqual(middle.fx.origin,start.fx.origin);
 assert(middle.fx.frame.opacity>0&&middle.fx.frame.opacity<1&&middle.fx.frame.spark>0);
 assert.equal(middle.pointer,held.pointer);assert(Math.hypot(middle.free[0]-held.free[0],middle.free[1]-held.free[1])>.08);
 await touch('touchEnd',[]);await cdp.detach();
 await shot('manual-recall-mid');
 const released=await step(400);assert.equal(released.fx,null);assert.equal(released.token,317);
 phase='separate true named summon and live card';
 await slot.tap();await btn('summon').tap();await until(q=>q.ally?.id==='orvasSoul');
 await slot.tap();await btn('follow').tap();
 const waiting=await until(q=>q.show&&q.mode==='follow'&&!q.summon);assert.equal(waiting.hpLabel,'317/1050');
 phase='true hostile normal attack kills player and living companion gently dissolves, recover same ally and actual status';
 assert(await p.evaluate(()=>window.__editorTest.recallQA.enemy()));
 const lethal=await until(q=>q.death&&q.hp===0);
 assert.equal(lethal.lastEnemy?.type,'monsterSkeleton');assert.equal(lethal.lastEnemy.prior,1);
 assert(!lethal.ally&&!lethal.navBlock&&!lethal.bar);assert.equal(lethal.fx?.reason,'player-death');
 assert.equal(lethal.active,'orvasSoul');assert.equal(lethal.mode,'follow');assert.equal(lethal.token,317);
 const deathGlow=await step(255);assert(deathGlow.fx?.frame?.spark>0&&!deathGlow.ally&&!deathGlow.navBlock);
 assert.deepEqual(deathGlow.fx.origin,lethal.fx.origin);await shot('player-death-companion-recall-mid');
 phase='background during genuine death recall preserves its exact in-memory glow and rejoin';
 await p.evaluate(()=>{
  window.__workshopForegroundChanged(false);
  window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));
 });
 const beforeBg=await read(),duringBg=await step(9500);
 for(const key of ['now','xy','death','fx','active','token','mode'])assert.deepEqual(duringBg[key],beforeBg[key],key);
 await p.evaluate(()=>window.__workshopForegroundChanged(true));
 assert.deepEqual((await step(450)).fx,beforeBg.fx,'foreground callback cannot override cached pagehide');
 await p.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
 assert.deepEqual((await read()).fx,beforeBg.fx,'resumed scene retains same visible recall phase');

 await p.evaluate(()=>window.__editorTest.recallQA.retire());
 const vaporGone=await until(q=>!!q.death&&!q.fx&&!q.ally);assert.equal(vaporGone.token,317);
 const respawn=await until(q=>!q.death&&q.ally?.id==='orvasSoul'&&q.show);
 assert.equal(respawn.hp,100);assert.equal(respawn.mode,'follow');assert.equal(respawn.token,317);assert.equal(respawn.hpLabel,'317/1050');assert(!respawn.fx);
 assert.equal(respawn.summon?.id,'orvasSoul');const oneRejoin=respawn.summon.start;
 const after=await step(150);assert.equal(after.summon?.start,oneRejoin);assert.equal(after.token,317);
 await shot('active-ally-hp-live-after-respawn');
 phase='own zero remains real shatter, never impersonates player-death recall';
 assert(await p.evaluate(()=>window.__editorTest.recallQA.hurt(317)));
 const broken=await step(30);assert.equal(broken.token,null);assert.equal(broken.active,null);assert.equal(broken.ally,null);assert.equal(broken.fx,null);
 assert(broken.breaks.some(d=>d.type==='monsterStoneDavid'&&d.parts.length>0));
 assert.deepEqual(errors,[]);console.log('PASS trusted manual recall, genuine incoming fatal attack, same wounded live ally and restored HUD; own death remains shatter',JSON.stringify({manual:start.fx.vertices,defeat:lethal.lastEnemy,restored:respawn.hpLabel,actor:respawn.ally.id}));
}catch(e){console.error(phase,JSON.stringify(last));throw e}
finally{await browser?.close();await new Promise(ok=>server.close(ok))}
