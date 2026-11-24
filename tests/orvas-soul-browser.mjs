import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {mkdirSync,readFileSync} from 'node:fs';
import {Script} from 'node:vm';
let html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const put=(a,b)=>{assert.equal(html.split(a).length,2,a);html=html.replace(a,b)};
const api="if(facilityParams.get('test')==='1')window.__editorTest={";
put(api,api+`
 orvasQA:{
  frame:()=>render(),
  see:()=>{
   const kit=poiHotbarRead(),a=poiCompanionActor,now=performance.now(),pose=a?poiCompanionWorldPose(a,now):null;
   return {kit:poiInventorySlots(kit).filter(c=>poiCompanionType(c?.type)),active:kit.companionSoul?.active??null,
    actor:a?{x:a.x,z:a.z,id:a.id,attack:a.david?.attack?.kind,target:a.allyTarget?.o.type}:null,pose,body:poiCompanionMesh?.count??0,contacts:window.__orvasHits??[],
    health:poiPlayerHP,lastSwing:poiWalkActionStarted,breaks:poiMonsterBreakSnapshot(now),
    bossController:!!poiDavidActive,boss: [...poiMonsterStates].some(([o])=>!!poiDavidMatch(o)),mode:poiCompanionMode(kit),
    fracture:poiOrvasAllyEffects.raised?.gpu?.count??0,cue:poiOrvasAllyEffects.cue?.beam?.count??0,
    audio:window.__orvasNativeFoley??[],bar:$('poiCompanionHudHp')?.max,clock:now,foe:window.__orvasFoe?.s.hp??null,
    x:poiWalkX,z:poiWalkZ,y:poiWalkLevel,dir:['n','s','e','w'].map(k=>poiCameraRelativeStep(k))};
  },
  neutralMatch:()=>{
   const a=poiCompanionActor;
   const pair=[...poiMonsterStates].find(([o])=>poiDavidMatch(o));if(!a||!pair)return null;
   const now=performance.now(),p=poiCompanionWorldPose(a,now),boss=poiMonsterPose(...pair,now);
   const g=mesh(),f=mesh();poiCompanionOrvasMesh(g,{...p,heading:0,x:0,y:0,z:0,rig:boss.david});
   poiDavidGeometry(f,0,0,0,boss.david);
   return {n:g.p.length,same:g.p.every((v,i)=>v===f.p[i])&&g.c.every((v,i)=>v===f.c[i]),ally:p.scale,boss:boss.david?.phase};
  },
  opponent:(attacks=false)=>{
   const a=poiCompanionActor;if(!a)return null;
   const opts=attacks?[[-1,0],[1,0],[0,-1],[0,1]]:[[1,1],[-1,-1],[1,-1],[-1,1],[1,0],[-1,0],[0,1],[0,-1]];
   for(const [dx,dz] of opts){
    const x=a.x+dx,z=a.z+dz;
    if(!poiWalkCanStep(x,z)||poiMonsterAt(x,z,true)||x===poiWalkX&&z===poiWalkZ||!poiCompanionAttackClear({x,z},a,a.y))continue;
    const o={type:'monsterSkeleton',x,z,y:a.y,rot:0},s=poiCombatActorMake(o);poiMonsterStates.set(o,s);poiMonsterMeshDirty=true;
    if(attacks&&!poiEnemyBeginPlayer(o,s,performance.now(),{x:a.x,z:a.z,actor:a})){poiMonsterStates.delete(o);continue}
    if(!attacks){s.hp=400;s.nextAttack=performance.now()+17000;s.northReturnReady=s.nextAttack;}
    window.__orvasFoe={o,s};
    return {initial:s.hp,pending:!!s.playerAttack?.pending,dist:Math.hypot(dx,dz)};
   }
   return null;
  }
 },
`);
put(' requestAnimationFrame(render);',' if(!window.__orvasManual)requestAnimationFrame(render);');
put('function poiWildRegionalFrame(now,rng){','function poiWildRegionalFrame(now,rng){return;');
put('function poiWildPick(rng){','function poiWildPick(rng){return null;');
const damage='function poiPlayerDamageTarget(monster,x,z,amount,weapon,now,silent=false,atContact=false,source=null){';
put(damage,damage+"\n if(source?.companion)(window.__orvasHits??=[]).push({before:monster[1].hp,damage:amount,now,kind:poiCompanionActor?.david?.attack?.kind});");
const track='function poiDavidTrackAttackFoley(source,gain,q=null){';
put(track,track+`
 if(q?.ally)(window.__orvasNativeFoley??=[]).push({kind:q.kind,leap:!!q.davidLeapImpact,playing:source.context.state,loop:source.loop,
   name:source.buffer===poiDavidAlienCache?'alien':[...poiRecordedFoleyCache].find(([id,buffer])=>buffer===source.buffer)?.[0]});
`);
for(const [,js] of html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(js);
if(process.env.ORVAS_SOUL_SYNTAX_ONLY){console.log('Orvas native fixture parses');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>Soul QA</title>':html)});
await new Promise((ok,no)=>server.listen(0,'127.0.0.1',ok).once('error',no));const base='http://127.0.0.1:'+server.address().port;
let b,last,phase='boot';
try{
 b=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--autoplay-policy=no-user-gesture-required','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const screenshot=process.env.FACILITY_SCREENSHOTS;if(screenshot)mkdirSync(screenshot,{recursive:true});
 async function load(hp,x=102,z=93,already=false){
  const c=await b.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:.75}),p=await c.newPage(),errors=[];
  p.on('pageerror',e=>errors.push(e.message));await p.clock.install({time:new Date('2026-04-01T10:00:00Z')});
  await p.goto(base+'/seed');
  await p.evaluate(({hp,x,z,already})=>{
   const slots=Array(27).fill(null);slots[0]={type:'equipWoodSword',count:1,durability:150};slots[1]={type:'orvasSoul',count:1,durability:hp};slots[2]={type:'slimeSoul',count:1,durability:29};
   localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weaponDurabilityVersion:2,weapon:null,potions:0,slots,
    ...(already?{companionSoul:{version:1,active:'orvasSoul',pending:null}}:{})}));
   localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,position:{x,z,y:0,facing:2},
    townLayout:5,townMapHeight:182,templeDepth:1,view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:0,orbitPitch:.24,orbitDistance:6.7}}));
  },{hp,x,z,already});
  const open=async()=>{
   await p.goto(base+'/?resume=1&test=1',{waitUntil:'domcontentloaded',timeout:45000});
   await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:35000});
   await p.waitForFunction(()=>window.__editorTest?.facility()?.active,null,{polling:50,timeout:30000});
   await p.clock.pauseAt((await p.evaluate(()=>Date.now()))+1500);
   await p.evaluate(()=>{window.__orvasManual=true});
  };
  await open();
  const tick=async(ms=37)=>{await p.clock.fastForward(ms);await p.evaluate(()=>window.__editorTest.orvasQA.frame());
   return last=await p.evaluate(()=>window.__editorTest.orvasQA.see())};
  const until=async(fn,n=120)=>{for(let i=0;i<n;i++){const s=await tick();if(fn(s))return s}throw Error(JSON.stringify(last))};
  const tap=slot=>p.locator('#poiHotbar [data-hotbar-slot="'+slot+'"]').tap();
  const summon=async slot=>{
   await tap(slot);
   const follow=p.locator('#poiCompanionCommands [data-companion-command="follow"]');
   if(await follow.isVisible())await p.locator('#poiCompanionCommands [data-companion-command="fight"]').tap();
  };
  return {c,p,open,tick,until,tap,summon,errors};
 }
 phase='real Orvas shortcut, its distinct live stone mesh and ordinary hostile hit';
 let q=await load(997),p=q.p;
 let s=await q.tick(),oldSwing=s.lastSwing,oldHP=s.health;
 assert(s.kit.some(c=>c.type==='orvasSoul'&&c.durability===997));
 await q.summon(1);s=await q.until(v=>v.active==='orvasSoul'&&v.pose?.orvas&&v.body>1000);
 assert.equal(s.bar,1050);assert.equal(s.pose.scale,1);assert(s.kit.some(c=>c.type==='slimeSoul'&&c.durability===29));
 if(screenshot)await p.screenshot({path:screenshot+'/orvas-soul-live.png'});
 assert(await p.evaluate(()=>window.__editorTest.orvasQA.opponent(false)));
 const wind=await q.until(v=>v.pose?.orvas&&v.pose?.rig.phase==='windup');
 assert.equal(wind.contacts.length,0);
 s=await q.until(v=>v.contacts.length>0);assert.equal(s.contacts.length,1);assert.equal(s.contacts[0].damage,30);
 assert(s.foe<s.contacts[0].before);assert.equal(s.lastSwing,oldSwing);assert.equal(s.bossController,false);
 // Force no sequence timing or contacts. The original allied scheduler must
 // naturally discover and cycle three additional native original attacks.
 s=await q.until(v=>v.contacts.some(h=>h.kind==='stomp')&&v.fracture>0,185);
 assert.deepEqual(s.contacts.filter(h=>h.kind==='double').map(h=>h.damage),[28,35]);
 assert(s.contacts.some(h=>h.kind==='stomp'&&h.damage===39));
 s=await q.until(v=>v.contacts.some(h=>h.kind==='beam')&&v.cue>0,170);
 assert(s.contacts.some(h=>h.kind==='beam'&&h.damage===47));
 assert(s.audio.some(e=>e.name==='alien'&&e.loop&&e.playing==='running'));
 for(const name of ['davidBladeSweep','davidSwordFirst','davidSwordSecond','davidHeavyStomp'])
  assert(s.audio.some(e=>e.name===name&&e.playing==='running'),JSON.stringify(s.audio));
 assert.equal(s.lastSwing,oldSwing);assert.equal(s.health,oldHP);

 await q.summon(2);s=await q.until(v=>v.active==='slimeSoul'&&v.actor?.id==='slimeSoul');
 assert(s.kit.some(c=>c.type==='orvasSoul'&&c.durability===997));
 await q.summon(1);s=await q.until(v=>v.active==='orvasSoul'&&v.actor?.id==='orvasSoul');
 assert.equal(s.bar,1050);
 phase='real command dismisses without shatter, and resummon keeps the old token HP';
 await q.tap(1);
 await p.locator('#poiCompanionCommands').waitFor({state:'visible'});
 await p.locator('#poiCompanionCommands [data-companion-command="dismiss"]').tap();
 s=await q.until(v=>v.active===null&&v.actor===null);
 assert(s.kit.some(c=>c.type==='orvasSoul'&&c.durability===997));assert(!s.breaks.some(v=>v.type==='monsterStoneDavid'));
 await q.summon(1);s=await q.until(v=>v.actor?.id==='orvasSoul');
 phase='cold navigation preserves actual damaged HP and selected distinct ally';
 await p.clock.resume();await q.open();s=await q.until(v=>v.active==='orvasSoul'&&v.pose?.orvas);
 assert(s.kit.some(c=>c.type==='orvasSoul'&&c.durability===997));assert.deepEqual(q.errors,[]);await q.c.close();
 phase='narrow real room preserves full-size original guardian without relocating player or changing durable HP';
 q=await load(777,56,33,true);s=await q.until(v=>v.pose?.orvas&&v.body>1000);
 assert.equal(s.pose.scale,1);assert.deepEqual([s.x,s.z,s.y],[56,33,0]);assert(s.kit.some(c=>c.type==='orvasSoul'&&c.durability===777));
 await q.c.close();
 phase='active Orvas actually follows through the original physical gate and corridor with HP unchanged';
 q=await load(1050,24,126,true);p=q.p;s=await q.until(v=>v.pose?.orvas);const entryActor={...s.actor};
 const step=async(x,z)=>{
  const dx=x-s.x,dz=z-s.z,i=s.dir.findIndex(d=>d[0]===dx&&d[1]===dz);assert(i>=0);
  await p.keyboard.press(['ArrowUp','ArrowDown','ArrowRight','ArrowLeft'][i]);s=await q.tick(225);
  assert.deepEqual([s.x,s.z,s.y],[x,z,0]);
 };
 for(const [x,z] of [[24,127],[24,128],[24,129],[25,129],[25,130],[25,131],[24,131],[23,131],[23,132]])await step(x,z);
 s=await q.until(v=>v.pose?.orvas&&v.actor.z>=128);
 assert(entryActor.z<128&&s.actor.z>=128);assert.equal(s.pose.scale,1);
 assert(s.kit.some(c=>c.type==='orvasSoul'&&c.durability===1050));
 assert.equal(s.bossController,false);assert.deepEqual(q.errors,[]);
 await q.c.close();
 phase='original statue and allied unscaled mesh coexist in their real chamber';
 q=await load(1050,24,154,true);s=await q.until(v=>v.pose?.orvas&&v.boss&&v.body>1000);
 assert.equal(s.bossController,false);
 const match=await q.p.evaluate(()=>window.__editorTest.orvasQA.neutralMatch());
 assert(match?.same&&match.n>3000&&match.ally===1&&match.boss==='dormant',JSON.stringify(match));
 if(screenshot)await q.p.screenshot({path:screenshot+'/orvas-twins-full-size.png'});
 const walk=async(x,z)=>{
  const dx=x-s.x,dz=z-s.z,i=s.dir.findIndex(d=>d[0]===dx&&d[1]===dz);assert(i>=0);
  await q.p.keyboard.press(['ArrowUp','ArrowDown','ArrowRight','ArrowLeft'][i]);s=await q.tick(225);
  assert.deepEqual([s.x,s.z,s.y],[x,z,0]);
 };
 for(const z of [155,156,157])await walk(24,z);
 s=await q.until(v=>v.bossController&&v.actor?.target==='monsterStoneDavid'&&v.actor?.attack,180);
 const intro=s.lastSwing;
 for(const z of [156,155,154,153,152,151,150,149,148])await walk(24,z);
 assert(Math.hypot(s.x-s.actor.x,s.z-s.actor.z)>4&&s.actor.target==='monsterStoneDavid'&&s.bossController);
 s=await q.until(v=>v.actor?.attack&&v.actor?.target==='monsterStoneDavid',100);
 assert.equal(s.lastSwing,intro,'actual ally continues the canonical fight without a player attack');
 for(const z of [147,146,145,144,143,142,141])await walk(24,z);
 s=await q.until(v=>!v.actor?.attack,120);
 assert(!s.actor?.attack,'leaving actual authored chamber clears an allied commitment');
 assert.deepEqual(q.errors,[]);
 await q.c.close();
 phase='real hostile attack breaks low remaining Orvas durability, deletes only his token, shatters';
 q=await load(1,102,93,true);s=await q.until(v=>v.pose?.orvas);const hp=s.health;
 const shot=await q.p.evaluate(()=>window.__editorTest.orvasQA.opponent(true));assert(shot?.pending);
 s=await q.until(v=>v.active===null&&v.breaks.some(x=>x.type==='monsterStoneDavid'));
 assert.equal(s.health,hp);assert(!s.kit.some(c=>c.type==='orvasSoul'));
 assert(s.kit.some(c=>c.type==='slimeSoul'&&c.durability===29));assert.deepEqual(q.errors,[]);
 console.log('Native defended ally: authentic Orvas model, one hostile contact, saved HP, narrow fit and ordinary hostile lethal fracture');
}catch(e){console.error(phase,last);throw e}
finally{await b?.close();await new Promise(ok=>server.close(ok))}
