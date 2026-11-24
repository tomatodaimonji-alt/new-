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
   const qLand=a=>a?.david?.attack?.lastContactAt??null;
   return {kit:poiInventorySlots(kit).filter(c=>poiCompanionType(c?.type)),active:kit.companionSoul?.active??null,
    actor:a?{x:a.x,z:a.z,id:a.id,attack:a.david?.attack?.kind,target:a.allyTarget?.o.type}:null,pose,body:poiCompanionMesh?.count??0,contacts:window.__orvasHits??[],
    health:poiPlayerHP,lastSwing:poiWalkActionStarted,breaks:poiMonsterBreakSnapshot(now),
    leapPacket:a?.david?.attack?.leap?{...a.david.attack.leap,boss:undefined,executed:a.david.attack.executed}:null, landed:qLand(a),
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
  distant:()=>{
   const a=poiCompanionActor;if(!a)return null;
   const p=poiCompanionPosition(a);
   for(const [dx,dz] of [[1,0],[0,1],[-1,0],[0,-1],[.8,.6],[-.8,.6]]){
    const x=Math.round(p.x+dx*9),z=Math.round(p.z+dz*9),dist=Math.hypot(x-p.x,z-p.z);
    if(!poiWalkCanStep(x,z)||!poiCompanionAttackClear(p,{x,z},a.y)||
       !poiOrvasAllyLeapPath(a,p,{x,z},(x-p.x)/dist,(z-p.z)/dist))continue;
    const o={type:'monsterSkeleton',x,z,y:a.y,rot:0},s=poiCombatActorMake(o);
    s.hp=400;s.nextAttack=performance.now()+15000;s.northReturnReady=s.nextAttack;
    poiMonsterStates.set(o,s);poiMonsterMeshDirty=true;window.__orvasFoe={o,s};return {x,z,dist};
   }
   return null;
  },
  moveIntoArc(endpoint=false){
   const a=poiCompanionActor,q=a?.david?.attack,l=q?.leap;
   if(!l||q.cursor)return null;
   const k=endpoint?1:.55,x=Math.round(l.x0+(l.x-l.x0)*k),z=Math.round(l.z0+(l.z-l.z0)*k);
   if(!poiCompanionCell(x,z,a.y,a.x,a.z))return null;
   const o={type:'monsterSkeleton',x,z,y:a.y,rot:0},state=poiCombatActorMake(o);
   state.hp=500;state.townOwned=true;state.nextAttack=performance.now()+10000;state.nextMove=state.nextAttack;
   poiMonsterStates.set(o,state);poiMonsterMeshDirty=true;
   return {x,z,reserved:poiMonsterAt(x,z,true)?.[1]===state,blocked:!poiCompanionCell(x,z,a.y,a.x,a.z)};
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
   const confirm=p.locator('#poiCompanionCommands [data-companion-command="summon"]');
   const fight=p.locator('#poiCompanionCommands [data-companion-command="fight"]');
   if(await confirm.isVisible())await confirm.tap();
   else if(await fight.isVisible())await fight.tap();
  };
  return {c,p,open,tick,until,tap,summon,errors};
 }

 for(const endpoint of [false,true]){
  phase=endpoint?'reserved exact landing':'live body under visible jump';
  const q=await load(997),p=q.p;
  try{
   await q.summon(1);
   let s=await q.until(v=>v.active==='orvasSoul'&&v.pose?.orvas&&v.body>1000);
   const swing=s.lastSwing,hero=s.health;
   assert(await p.evaluate(()=>window.__editorTest.orvasQA.distant()));
   const wind=await q.until(v=>v.actor?.attack==='leap'&&v.pose?.rig.phase==='windup');
   assert(wind.leapPacket&&wind.contacts.length===0);
   const inAir=await q.until(v=>v.actor?.attack==='leap'&&v.pose?.rig.leapHeight>.4);
   assert(inAir.contacts.length===0);
   const occupant=await p.evaluate(endpoint=>window.__editorTest.orvasQA.moveIntoArc(endpoint),endpoint);
   assert(occupant?.reserved&&occupant.blocked,JSON.stringify(occupant));
   let airFrames=0,hit;
   for(let n=0;n<60;n++){
    s=await q.tick();
    assert.equal(s.actor?.attack,'leap','visibly committed leap replaced or canceled before landing: '+JSON.stringify(s));
    if(s.pose?.rig.leapHeight>.4)airFrames++;
    if(s.leapPacket?.executed===1){hit=s;break}
   }
   assert(hit&&airFrames>=4&&hit.pose.rig.phase==='impact');
   if(endpoint){
    assert(Math.hypot(hit.actor.x-occupant.x,hit.actor.z-occupant.z)>=1);
    assert(Math.hypot(hit.actor.x-occupant.x,hit.actor.z-occupant.z)<2);
   }else assert.deepEqual([hit.actor.x,hit.actor.z],[wind.leapPacket.x,wind.leapPacket.z]);
   s=await q.until(v=>v.audio.some(a=>a.leap&&a.playing==='running')&&v.fracture>0,20);
   assert.deepEqual(s.contacts.map(c=>c.damage),[43]);assert.equal(s.foe,357);
   const rest=await q.tick(175);
   assert.equal(rest.actor.attack,'leap');assert.equal(rest.contacts.length,1);assert.equal(rest.lastSwing,swing);
   assert.equal(rest.health,hero);assert.equal(rest.bossController,false);
   assert(rest.kit.some(c=>c.type==='orvasSoul'&&c.durability===997));assert.deepEqual(q.errors,[]);
   console.log('ORVAS LEAP',JSON.stringify({phase,from:[wind.leapPacket.x0,wind.leapPacket.z0],planned:[wind.leapPacket.x,wind.leapPacket.z],actual:[hit.actor.x,hit.actor.z],airFrames,occupant,damage:s.contacts[0].damage,rubble:s.fracture,sound:s.audio.filter(a=>a.leap)}));
  }finally{await q.c.close()}
 }
}catch(e){console.error(phase,JSON.stringify(last));throw e;}
finally{await b?.close();await new Promise(ok=>server.close(ok))}
