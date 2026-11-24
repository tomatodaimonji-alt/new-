import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
let h=readFileSync(process.argv[2]??'world-editor.html','utf8');
const put=(a,b)=>{assert.equal(h.split(a).length,2,a);h=h.replace(a,b)};
const head="if(facilityParams.get('test')==='1')window.__editorTest={";
put(head,head+`
 threatAlly:{
  frame:()=>render(),
  see:()=>{
   const a=poiCompanionActor,k=poiHotbarRead(),o=window.__foe,s=o&&poiMonsterStates.get(o),d=poiDavidActive?.s?.david,
     q=d?.attack??s?.playerAttack;
   const canonical=[...poiMonsterStates].find(([id,state])=>poiDavidMatch(id)&&state.hp>0);
   const view=poiAimOrigin(performance.now());
   return {hero:[poiWalkX,poiWalkZ],hp:poiPlayerHP,now:performance.now(),
    wakeProbe:{ready:poiNextMobTick,visual:[view.x,view.z,view.y],hidden:document.hidden,focus:document.hasFocus(),
     authored:canonical?{x:canonical[1].x,z:canonical[1].z,hp:canonical[1].hp}:null},a:a?{x:a.x,z:a.z,id:a.id,att:a.david?.attack?.kind}:null,
    ahp:poiInventorySlots(k).find(c=>c?.type==='orvasSoul')?.durability,
    directions:['n','s','e','w'].map(k=>poiCameraRelativeStep(k)),original:!!d,awaken:!!d?.wakeDone,
    q:q?{kind:q.kind??o?.type,committed:(q.targetAlly??q.companionVictim)===a,pending:q.pending,
     start:q.start,hit:q.hits?.[0]??q.hit,sx:q.sx,sz:q.sz,dx:q.dx,dz:q.dz,cursor:q.cursor,x:q.x,z:q.z}:null,
    cue:window.__threatRed??[],gl:window.__threatFoeGL??[],effects:window.__threatFx??[],loss:window.__allyDamaged??[]};
  },
  field:()=>{
   const a=poiCompanionActor;if(!a)return null;
   const p=poiCompanionPosition(a),hero={x:poiWalkX,z:poiWalkZ,y:a.y};
   a.freeGoal=null;a.next=performance.now()+12000;
   const attempts=[[1,0],[-1,0],[0,1],[0,-1]];
   for(const [dx,dz] of attempts){
    const x=a.x+dx,z=a.z+dz;
    if(Math.hypot(hero.x-x,hero.z-z)<=1.05||!poiWalkCanStep(x,z)||poiMonsterAt(x,z,true)||
      !poiCompanionAttackClear({x,z},p,a.y))continue;
    const o={x,z,y:a.y,type:'monsterSkeleton',rot:0},s=poiCombatActorMake(o);
    s.hp=350;s.nextAttack=performance.now();poiMonsterStates.set(o,s);poiMonsterMeshDirty=true;
    window.__foe=o;return {x,z,dx,dz};
   }
   return null;
  },
  bossStage:()=>{
   const src=facilitySite.davidTemple.boss,a=poiCompanionActor;
   if(!a||!poiDavidActive||!workshopResumeRestorePosition({x:src.x,z:src.z-5,y:src.y,facing:2}))return null;
   const pos={x:src.x+2,z:src.z,y:src.y};
   if(!poiDavidIn(src,pos)||!poiWalkCanStep(pos.x,pos.z)||!poiDavidLine(src,pos,src))return null;
   a.x=a.fx=a.px=pos.x;a.z=a.fz=a.pz=pos.z;a.freeGoal=null;a.next=performance.now()+7000;
   return pos;
  },
  releaseOwn:()=>{
   const a=poiCompanionActor,b=poiDavidActive;
   if(!a||!b)return false;a.next=performance.now();return true;
  }
 },
`);
put(' requestAnimationFrame(render);',' if(!window.__threatManual)requestAnimationFrame(render);');
put('function poiWildRegionalFrame(now,rng){','function poiWildRegionalFrame(now,rng){return;');
put('function poiWildPick(rng){','function poiWildPick(rng){return null;');
put('function poiCompanionHurt(damage,now){','function poiCompanionHurt(damage,now){ (window.__allyDamaged??=[]).push({damage,now});');
put('draw(poiDavidCue.lane,vp)','draw(poiDavidCue.lane,vp);(window.__threatRed??=[]).push({ally,dx:q.dx,dz:q.dz,n:poiDavidCue.lane.count,at:now})');
put('if(poiDavidCue.fan){gl.blendColor(0,0,0,reduced?.23:.20+.06*Math.sin(now*.024));draw(poiDavidCue.fan,vp)}',
 'if(poiDavidCue.fan){gl.blendColor(0,0,0,reduced?.23:.20+.06*Math.sin(now*.024));draw(poiDavidCue.fan,vp);(window.__threatRed??=[]).push({ally,fan:true,n:poiDavidCue.fan.count,at:now})}');
put('gl.blendColor(0,0,0,alpha);draw(gpu,vp)}','gl.blendColor(0,0,0,alpha);draw(gpu,vp);(window.__threatFoeGL??=[]).push({alpha,n:gpu.count})}');
for(const [,js] of h.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(js);
if(process.env.ENEMY_ALLY_PARSE_ONLY){console.log('Enemy/ally fixture browser syntax valid');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((r,s)=>{s.setHeader('Content-Type','text/html; charset=utf-8');s.end(r.url==='/seed'?'<title>Seed</title>':h)});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const url='http://127.0.0.1:'+server.address().port;
let b,last,phase='';
try{
 b=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 async function load(x,z,mode='follow'){
  const c=await b.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:.7}),p=await c.newPage(),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  // A monotonic clock has to start before the first real game frame. If
  // installed after the cover, it rewinds performance.now while the
  // authored mob scheduler still keeps its pre-installation deadline.
  await p.clock.install({time:new Date('2026-04-01T10:00:00Z')});
  await p.goto(url+'/seed');
  await p.evaluate(({x,z,mode})=>{
   const slots=Array(27).fill(null);slots[0]={type:'equipWoodSword',count:1,durability:150};slots[1]={type:'orvasSoul',count:1,durability:1050};
   localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weaponDurabilityVersion:2,weapon:null,slots,potions:0,companionSoul:{version:1,active:'orvasSoul',mode}}));
   localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,position:{x,z,y:0,facing:2},
    townLayout:5,townMapHeight:182,templeDepth:1,view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:0,orbitPitch:.24,orbitDistance:6.7}}));
  },{x,z,mode});
  await p.goto(url+'/?resume=1&test=1',{waitUntil:'domcontentloaded'});await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:45000});
  await p.bringToFront();
  await p.clock.pauseAt(await p.evaluate(()=>Date.now()+175));await p.evaluate(()=>{window.__threatManual=true});
  const read=()=>p.evaluate(()=>window.__editorTest.threatAlly.see());
  const tick=async(ms=37)=>{await p.clock.fastForward(ms);await p.evaluate(()=>window.__editorTest.threatAlly.frame());return last=await read()};
  const until=async(fn,n=94)=>{for(let i=0;i<n;i++){const s=await tick();if(fn(s))return s}throw Error(JSON.stringify(last))};
  const api=m=>p.evaluate(m=>window.__editorTest.threatAlly[m](),m);
  return{c,p,errors,tick,until,api};
 }
 phase='ordinary enemy independently targets closer allied actor and lowers only its HP';
 let n=await load(102,93),s=await n.until(v=>v.a),before=s.hp;
 const pos=await n.api('field');assert(pos);
 s=await n.until(v=>v.q?.committed&&v.q?.pending&&v.gl.some(q=>q.alpha>0&&q.n>0));const attack=s.q;
 assert.equal(s.ahp,1050);assert.deepEqual([attack.x,attack.z],[s.a.x,s.a.z]);
 s=await n.until(v=>v.loss.length>0);
 assert.equal(s.hp,before);assert(s.ahp<1050);assert.deepEqual(s.loss.map(v=>v.damage),[9]);
 assert.equal(s.q.start,attack.start);assert.deepEqual([s.q.dx,s.q.dz],[attack.dx,attack.dz]);
 assert.deepEqual(n.errors,[]);await n.c.close();
 phase='awakening stays tied to actual approach; original Orvas chooses different heading and displays hostile red';
 n=await load(24,154,'fight');
 s=await n.until(v=>v.a&&v.wakeProbe.authored&&!v.wakeProbe.hidden);
 assert.deepEqual(s.hero,[24,154]);
 assert.deepEqual(s.wakeProbe.authored,{x:24,z:158,hp:1050});
 assert.equal(s.original,false,'authored statue is present but has not been woken by test setup');
 for(const goal of [155,156,157]){
  const i=s.directions.findIndex(v=>v[0]===0&&v[1]===1);assert(i>=0);
  await n.p.keyboard.press(['ArrowUp','ArrowDown','ArrowRight','ArrowLeft'][i]);s=await n.tick(225);
  assert.deepEqual(s.hero,[24,goal]);
  if(s.original)break;
 }
 // Keep rendering the real world through enough native mob scans to
 // cover a pending cold/hydration deadline and interpolate the last step.
 s=await n.until(v=>v.original,130);
 const bossTarget=await n.api('bossStage');assert(bossTarget);before=s.hp;
 s=await n.until(v=>v.awaken&&v.q?.committed&&v.cue.some(c=>!c.ally&&c.n>0),130);
 const original=s.q;
 assert(original.dx>.8&&Math.abs(original.dz)<.3&&s.cue.at(-1).dx>.8);
 s=await n.until(v=>v.loss.length>0,70);
 assert.equal(s.hp,before);assert(s.ahp<1050);
 assert.deepEqual([s.q.dx,s.q.dz],[original.dx,original.dz]);
 assert.equal(s.loss[0].damage,30);
 assert(await n.api('releaseOwn'));
 s=await n.until(v=>v.a?.att,100);
 const deadline=s.now+840;
 do{s=await n.tick()}while(s.now<deadline);
 assert(s.cue.some(c=>!c.ally));assert(!s.cue.some(c=>c.ally),'allied native attacks never draw red prediction');
 assert.deepEqual(n.errors,[]);
 await n.c.close();
 console.log('Real hostile melee and original Orvas commit toward ally, apply true ally-only loss where player is not in physical area, retain hostile red, no allied red.');
}catch(e){console.error(phase,last);throw e}
finally{await b?.close();await new Promise(ok=>server.close(ok));}
