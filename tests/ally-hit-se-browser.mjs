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
    hitsSE:window.__allyHitSEEntries??[],pending:a?.attackMotion?.pending??false,slimeImpact:a?.attackMotion?.visualHitAt??null,
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
  addLeapVictim:()=>{
   const a=poiCompanionActor,l=a?.david?.attack?.leap;
   if(!l)return null;
   for(const [dx,dz] of [[0,2],[0,-2],[2,0],[-2,0]]){
    const x=l.x+dx,z=l.z+dz;
    if(!poiCompanionCell(x,z,a.y,a.x,a.z)||!poiCompanionAttackClear(l,{x,z},a.y))continue;
    const o={type:'monsterSkeleton',x,z,y:a.y,rot:0},s=poiCombatActorMake(o);
    s.hp=300;s.nextAttack=performance.now()+15000;s.nextMove=s.nextAttack;
    poiMonsterStates.set(o,s);poiMonsterMeshDirty=true;return [x,z];
   }
   return null;
  },
  slipAway:()=>{
   const a=poiCompanionActor,p=a?.attackMotion,t=p?.target;
   if(!p?.pending||!t)return false;
   for(const [dx,dz] of [[0,3],[0,-3],[3,0],[-3,0]]){
    const x=t.s.x+dx,z=t.s.z+dz;
    if(Math.hypot(x-a.x,z-a.z)<2||!poiCompanionCell(x,z,a.y,t.s.x,t.s.z))continue;
    t.s.x=t.s.fromX=x;t.s.z=t.s.fromZ=z;t.s.actorFree=null;t.s.nextMove=performance.now()+10000;
    return true;
   }
   return false;
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
// Observe real Web Audio source.start events inside the shared hit path,
// not merely that an SFX branch was requested by the game.
const soundStart=html.indexOf('function poiSound('),soundEnd=html.indexOf('\nfunction poiAudioSyncLifecycle(',soundStart);
const original=html.slice(soundStart,soundEnd),close=original.lastIndexOf('}');
aSound(original.includes('try{')&&close>0);
function aSound(v){assert(v,'exact shared player hit sound anchor')}
const traced=original.replace(' const now=ctx.currentTime;',` const now=ctx.currentTime;
 const prior=window.__allyHitSECurrent;
 if(kind==='hit')window.__allyHitSECurrent={weapon,defeated,atContact,state:ctx.state,starts:[],recorded:[]};
 try{`);
const tail=traced.lastIndexOf('}');
html=html.slice(0,soundStart)+traced.slice(0,tail)+`}finally{
  if(kind==='hit'){(window.__allyHitSEEntries??=[]).push(window.__allyHitSECurrent);window.__allyHitSECurrent=prior}
 }
}`+traced.slice(tail+1)+html.slice(soundEnd);
const rec='function poiTryRecordedFoley(';
const at=html.indexOf(rec),br=html.indexOf('{',at);
aSound(at>0&&br>at);
html=html.slice(0,br+1)+`if(window.__allyHitSECurrent)window.__allyHitSECurrent.recorded.push(arguments[0]);`+html.slice(br+1);
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
  p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>{
   for(const [kind,proto] of [['sample',AudioBufferSourceNode.prototype],['tone',OscillatorNode.prototype]]){
    const start=proto.start;
    proto.start=function(...args){
     const r=start.apply(this,args),hit=window.__allyHitSECurrent;
     if(hit)hit.starts.push([kind,this.context.state,args[0]??0]);
     return r;
    };
   }
  });
  await p.clock.install({time:new Date('2026-04-01T10:00:00Z')});
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


 phase='real named Orvas summon, actual leap damage group and separate native Foley';
 let q=await load(997),p=q.p,s;
 try{
  await q.summon(1);s=await q.until(v=>v.active==='orvasSoul'&&v.body>1000);
  const hero=s.health,swing=s.lastSwing;
  assert(await p.evaluate(()=>window.__editorTest.orvasQA.distant()));
  const pre=await q.until(v=>v.actor.attack==='leap'&&v.pose?.rig.phase==='windup');
  assert.equal(pre.hitsSE.length,0);assert.equal(pre.contacts.length,0);
  assert(await p.evaluate(()=>window.__editorTest.orvasQA.addLeapVictim()));
  s=await q.until(v=>v.contacts.length>=2);
  assert.deepEqual(s.contacts.map(c=>c.damage),[43,43]);assert.equal(s.foe,357);
  assert(s.audio.some(a=>a.leap&&a.name==='davidLeapStomp'),'native original landing Foley is still separate');
  assert.equal(s.hitsSE.length,1,'one shared player-style contact effect for both actually damaged targets');
  assert.equal(s.hitsSE[0].weapon,null);assert(s.hitsSE[0].atContact&&s.hitsSE[0].state==='running');
  assert.deepEqual(s.hitsSE[0].starts.map(a=>a[0]),['sample','tone']);
  assert.equal(s.health,hero);assert.equal(s.lastSwing,swing);assert.deepEqual(q.errors,[]);
  console.log(phase,JSON.stringify({contacts:s.contacts,sound:s.hitsSE,leap:s.audio.filter(a=>a.leap)}));
 }finally{await q.c.close()}
 for(const miss of [true,false]){
  phase=miss?'actual slime windup then committed footprint miss':'actual slime leap hits and sounds once';
  q=await load(997);p=q.p;
  try{
   await q.summon(2);s=await q.until(v=>v.active==='slimeSoul'&&v.body>100);
   assert(await p.evaluate(()=>window.__editorTest.orvasQA.opponent(false)));
   s=await q.until(v=>v.pending);
   assert.equal(s.hitsSE.length,0);
   if(miss)assert(await p.evaluate(()=>window.__editorTest.orvasQA.slipAway()));
   s=await q.until(v=>v.slimeImpact!==null);
   assert.equal(s.contacts.length,miss?0:1);
   assert.equal(s.hitsSE.length,miss?0:1);
   if(!miss)assert.deepEqual(s.hitsSE[0].starts.map(a=>a[0]),['sample','tone']);
   assert.deepEqual(q.errors,[]);console.log(phase,JSON.stringify({contacts:s.contacts,sound:s.hitsSE,foe:s.foe}));
  }finally{await q.c.close()}
 }
}catch(e){console.error(phase,JSON.stringify(last));throw e;}
finally{await b?.close();await new Promise(ok=>server.close(ok))}
