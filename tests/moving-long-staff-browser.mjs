import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const insert=(s,key,extra)=>{assert.equal(s.split(key).length,2,key);return s.replace(key,key+extra)};
const api='  freeMovementPose:()=>({x:poiWalkViewX,z:poiWalkViewZ,level:poiWalkLevel}),';
let fixture=insert(html,api,`
  movingStaffQA:{
   manual:()=>{window.__staffManualFrames=true},frame:()=>render(),
   seed:(distance,keepEvents=false)=>{
    poiMonsterStates.clear();poiCombatLockReset();
    const p=poiAimOrigin(performance.now()),fx=p.x+distance,fz=p.z,x=poiFreeCell(fx),z=poiFreeCell(fz);
    const o={x,z,y:p.y,rot:0,type:'monsterSlime'},s=poiCombatActorMake(o),c=new Set([x+','+z]);
    s.hp=80;s.townOwned=true;
    s.actorFree={fromX:fx,fromZ:fz,x:fx,z:fz,start:performance.now()-400,ms:380,cells:c,endCells:c,heading:0};
    poiMonsterStates.set(o,s);poiMonsterMeshDirty=true;
    window.__staffQA={frames:[],hits:[],bow:[],flights:[],arrows:[],events:keepEvents?window.__staffQA?.events??[]:[],s,target:[fx,fz],begin:[]};poiAimLockAt=0;
   },
   read:()=>{
    const q=window.__staffQA,p=poiFreePose;
    return {equipped:poiEquippedWeapon(),at:poiWalkActionStarted,ready:poiAttackReady,now:performance.now(),pending:!!poiPlayerWeaponPending,
     pad:!!poiAnalogContact,position:[poiWalkViewX,poiWalkViewZ],walking:!!p?.walking,distance:p?.distance??0,face:poiWalkFacing,
     hp:q?.s?.hp,target:q?.target,begin:q?.begin,idleRigid:window.__staffIdleRigid,frames:q?.frames,hits:q?.hits,bow:q?.bow,flights:q?.flights,arrows:q?.arrows,events:q?.events};
   }
  },`);
assert.equal(fixture.split(' const p=poiWildPick(rng);').length,2);fixture=fixture.replace(' const p=poiWildPick(rng);',' const p=null;');
fixture=insert(fixture,'function poiWildRegionalFrame(now,rng){','return;');
fixture=insert(fixture,'function poiMobFrame(now){','return;');
const propEnd="   m.n.push(dx/n,ny/n,dz/n);m.c.push(prop.c[i],prop.c[i+1],prop.c[i+2]);\n  }";
fixture=insert(fixture,propEnd,`
  if(weapon==='equipLongStaff'&&worldSpear){
   let peak=0,tail=0,edge=0;
   for(let i=3;i<prop.p.length;i+=3){
    if(prop.p[i+1]>prop.p[peak+1])peak=i;
    if(prop.p[i+1]<prop.p[tail+1])tail=i;
    if(prop.p[i]>prop.p[edge])edge=i;
   }
   const start=m.p.length-prop.p.length,tip=start+peak,free=poiFreePose;
   const size=(u,v)=>Math.hypot(...[0,1,2].map(d=>m.p[start+u+d]-m.p[start+v+d]));
   const rigidLengths=[size(peak,tail),size(peak,edge),size(tail,edge)];
   if(!pose?.staffStrike)window.__staffIdleRigid=rigidLengths;
   if(window.__staffQA&&pose?.staffStrike)window.__staffQA.frames.push({clock:performance.now(),started:poiWalkActionStarted,
    moving:!!free?.walking,pad:!!poiAnalogContact,phase:pose.staffPhase,arc:pose.meleeReach?.arc,
    tip:[m.p[tip]-x,m.p[tip+1]-y,m.p[tip+2]-z],origin:[x,z],stride,vertices:prop.p.length/3,rigidLengths});
  }`);
fixture=insert(fixture,'function poiPlayerStartProfile(type,now){',`
 if(type==='equipLongStaff'&&window.__staffQA){
  const o=poiAimOrigin(now);window.__staffQA.begin.push({clock:now,origin:[o.x,o.z]});
 }`);
fixture=insert(fixture,'function poiPlayerDamageTarget(monster,x,z,amount,weapon,now,silent=false,atContact=false,source=null){',`
 if(window.__staffQA&&(weapon==='equipLongStaff'||weapon==='equipWoodBow')){const o=poiAimOrigin(now);window.__staffQA.hits.push({amount,now,at:poiWalkActionStarted,pad:!!poiAnalogContact,origin:[o.x,o.z]});}`);
fixture=insert(fixture,' const f=p.front,draw=p.draw,skin=[.77,.59,.43],highlight=[.84,.65,.48],wood=[.47,.29,.15],limb=[.69,.46,.22];',`
 if(window.__staffQA)window.__staffQA.bow.push({draw:pose.bowDraw,released:pose.bowReleased,front:P(f),origin:[x,z],
  pad:!!poiAnalogContact,walking:!!poiFreePose?.walking,at:poiWalkActionStarted,clock:performance.now()});`);
fixture=insert(fixture,'function poiAimFlightBegin(shot,now){',`
 if(window.__staffQA&&shot.type==='equipWoodBow'){
  const live=poiAimOrigin(now);
  window.__staffQA.flights.push({aim:[shot.aim.x,shot.aim.z],live:[live.x,live.z],at:poiWalkActionStarted,now,pad:!!poiAnalogContact,dir:[shot.dx,shot.dz]});
 }`);
const arrow='  if(fade>0)poiWeaponArrowGeometry(m,p.x,p.y,p.z,p.dx,p.dz,.55+.45*fade);';
fixture=insert(fixture,arrow,`
  if(fade>0&&window.__staffQA)window.__staffQA.arrows.push({xyz:[p.x,p.y,p.z],vertices:m.p.length/3,clock:now});`);
const raf=' requestAnimationFrame(render);';
assert.equal(fixture.split(raf).length,2);
fixture=fixture.replace(raf,' if(!window.__staffManualFrames)requestAnimationFrame(render);');
for(const [,s] of fixture.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(s);
if(process.env.STAFF_MOVING_SYNTAX_ONLY){console.log('instrumented exact game scripts parse');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<!doctype html><title>Staff touch QA</title>':fixture)});
await new Promise((r,j)=>server.listen(0,'127.0.0.1',r).once('error',j));
const origin='http://127.0.0.1:'+server.address().port;
const move=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
let browser,context,page,checkpoint='launch';const errors=[];
const read=()=>page.evaluate(()=>window.__editorTest?.movingStaffQA?.read());
const wait=(f,a=null,t=6500)=>page.waitForFunction(f,a,{polling:30,timeout:t});
const t=(x,y,id)=>({x:Math.round(x),y:Math.round(y),id,radiusX:6,radiusY:6,force:.72});
const center=(r,id)=>t(r.x+r.width*.5,r.y+r.height*.5,id);
const seed=(d)=>page.evaluate(d=>window.__editorTest.movingStaffQA.seed(d),d);
function verify(seq,moving){
 const hit=seq.hits.find(h=>h.at===seq.at);
 assert(hit&&hit.amount===20&&hit.now-seq.at>=209,'one actual 20 HP contact at original 210ms key or next frame');
 assert.equal(seq.hp,60);assert.equal(seq.hits.length,1);
 const fs=seq.frames.filter(f=>f.started===seq.at&&f.vertices>20);
 const early=fs.filter(f=>['raise','hold'].includes(f.phase)).sort((a,b)=>b.tip[1]-a.tip[1])[0];
 const contact=fs.find(f=>f.phase==='down'&&f.arc==='staff-down'&&f.clock>=hit.now-2&&f.clock-hit.now<125);
 assert(early&&contact, 'true overhead and downward live held geometry: '+JSON.stringify(fs));
 const idle=seq.idleRigid;
 assert(idle&&idle[0]>1.9,'substantial held branch is already long at idle');
 assert(fs.length>=3&&fs.every(f=>f.rigidLengths.every((v,i)=>Math.abs(v-idle[i])<1e-6)),
  'same two-thumb live prop does not stretch at any wind, contact or recovery frame');
 assert(early.tip[1]>1.65&&contact.tip[1]<1.25&&early.tip[1]-contact.tip[1]>.45,'tip actually falls from overhead');
 if(moving){
  assert(hit.pad&&early.pad&&contact.pad,'movement finger remains native-held at windup AND actual contact');
  const begin=seq.begin.find(v=>v.clock===seq.at);
  assert(begin&&move(begin.origin,seq.target)>2.10,'target was demonstrably outside the staff hitbox on the actual action press');
  assert(move(hit.origin,seq.target)<2,'target entered hitbox through genuine moving input before the contact frame');
  const first=fs.find(frame=>frame.pad&&frame.moving&&frame.phase==='raise');
  assert(first&&move(first.origin,contact.origin)>.23,'avatar position advances from the first emitted windup frame through contact');
  assert(move(early.origin,contact.origin)>.08,'avatar keeps translating during and after the raised pose');
  assert(fs.some(f=>f.pad&&f.moving&&Math.abs(f.stride)>.01),'legs retain actual gait and staff keeps moving at the same time');
 }
}
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 context=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:.60,isMobile:true,hasTouch:true});
 page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);
 await page.clock.install({time:new Date('2026-11-24T12:00:00Z')});
 await page.goto(origin+'/seed');
 await page.evaluate(()=>{
  const slots=Array(27).fill(null);slots[0]={type:'equipLongStaff',count:1,durability:65};slots[1]={type:'equipWoodSword',count:1};slots[2]={type:'equipWoodBow',count:1,durability:80};
  localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weaponDurabilityVersion:2,weapon:'equipLongStaff',potions:0,slots}));
  localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":575000}');
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:102,z:93,y:0,facing:1},townLayout:5,townMapHeight:128,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 });
 await page.goto(origin+'/?resume=1&test=1');
 await page.locator('#pineStartupCover').waitFor({state:'hidden'});
 await wait(()=>window.__editorTest?.facility()?.active&&document.querySelector('#viewWrap').hasAttribute('data-analog-play'));
 const pad=page.locator('#poiAnalogPad'),action=page.locator('#poiWalkAction'),cdp=await context.newCDPSession(page);
 const send=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
 // Real boot first, then advance the production frame and its actual GL
 // uploads at reproducible intervals, independent of SwiftShader wall time.
 const wall=await page.evaluate(()=>Date.now());
 await page.clock.pauseAt(wall+1500);
 await page.evaluate(()=>window.__editorTest.movingStaffQA.manual());
 const tick=async (ms)=>{
  for(let left=ms;left>0;){
   const dt=Math.min(24,left);
   await page.clock.fastForward(dt);
   await page.evaluate(()=>window.__editorTest.movingStaffQA.frame());
   left-=dt;
  }
 };
 const tap=async locator=>{
  const point=center(await locator.boundingBox(),1);
  await send('touchStart',[point]);await send('touchEnd',[]);
 };
 const settle=async()=>{
  const q=await read(),more=Math.ceil(q.ready-q.now)+2;
  if(more>0){await page.clock.fastForward(more);await page.evaluate(()=>window.__editorTest.movingStaffQA.frame())}
  assert(!(await read()).pending);
 };
 const finished=async at=>{
  await tick(264);const q=await read();
  assert(q.at>at&&!q.pending&&q.now-q.at>=240,'real attack completed in stepped production frames');
  return q;
 };
 checkpoint='standing attack retains previous physical damage and overhead motion';
 await seed(1.7);const idle=await read();assert.equal(idle.equipped,'equipLongStaff');
 await tap(action);verify(await finished(idle.at),false);await settle();
 checkpoint='left moves and right stays genuinely secondary';
 const left=center(await pad.boundingBox(),1),right=center(await action.boundingBox(),2),drag=t(left.x+33,left.y,1);
 await send('touchStart',[left]);await send('touchMove',[drag]);
 await tick(72);const staffWalk=await read();assert(staffWalk.pad&&staffWalk.walking&&staffWalk.position[0]>idle.position[0]+.10&&staffWalk.face===1);
 await page.evaluate(()=>{window.__staffQA.events=[];window.__staffSeedOnSecond=2.16;});
 await action.evaluate(el=>{
  for(const name of ['pointerdown','pointerup','pointercancel']){
   el.addEventListener(name,e=>{
    if(e.type==='pointerup'&&e.pointerType==='touch'&&!e.isPrimary&&e.isTrusted&&window.__staffSeedOnSecond){
     // A known live target is placed outside the original reach at the real
     // right release, and must be entered by real walking before contact.
     window.__editorTest.movingStaffQA.seed(window.__staffSeedOnSecond,true);
     window.__staffSeedOnSecond=0;
    }
    window.__staffQA?.events.push({type:e.type,touch:e.pointerType,primary:e.isPrimary,trusted:e.isTrusted});
   },true);
  }
 });
 const before=await read();
 await send('touchStart',[drag,right]);
 assert((await read()).events.some(e=>e.type==='pointerdown'&&e.touch==='touch'&&!e.primary&&e.trusted));
 checkpoint='right releases without stopping retained left input; hit and geometry execute';
 // Chromium's WebTouch handler releases only the supplied id on a
 // non-empty touchEnd. Empty touchEnd releases all and cannot test this.
 // SyntheticPointerActions-enabled browser builds instead derive releases
 // from omission in a MOVE; only try this if the primary route rejects.
 try{await send('touchEnd',[right]);}
 catch{await send('touchMove',[drag]);}
 {const q=await read();assert(q.pad&&q.events.some(e=>e.type==='pointerup'&&e.touch==='touch'&&!e.primary&&e.trusted));}
 const moving=await finished(before.at);verify(moving,true);
 assert(moving.position[0]>before.position[0]+.25,'player keeps walking after tap');
 await send('touchEnd',[]);
 assert(!(await read()).pad);
 checkpoint='moving bow starts and releases from live avatar, with real arrow mesh';
 await tap(page.locator('#poiHotbar [data-hotbar-slot="2"]'));
 await settle();
 const bowIdle=await read();assert.equal(bowIdle.equipped,'equipWoodBow');
 const left2=center(await pad.boundingBox(),11),right2=center(await action.boundingBox(),12),drag2=t(left2.x+32,left2.y,11);
 await send('touchStart',[left2]);await send('touchMove',[drag2]);
 await tick(72);const bowWalk=await read();assert(bowWalk.pad&&bowWalk.walking&&bowWalk.position[0]>bowIdle.position[0]+.10);
 await page.evaluate(()=>{window.__staffQA.events=[];window.__staffSeedOnSecond=4.7;});
 const bowStart=(await read()).at;
 await send('touchStart',[drag2,right2]);
 assert((await read()).events.some(e=>e.type==='pointerdown'&&e.touch==='touch'&&!e.primary&&e.trusted));
 try{await send('touchEnd',[right2]);}
 catch{await send('touchMove',[drag2]);}
 {const q=await read();assert(q.pad&&q.events.some(e=>e.type==='pointerup'&&e.touch==='touch'&&!e.primary&&e.trusted));}
 await tick(624);
 {const q=await read();assert(q.at>bowStart&&q.flights.some(f=>f.at===q.at)&&q.hits.length&&q.arrows.length,'real arrow reproduced after two-finger release');}
 const bow=await read(),launch=bow.flights.find(f=>f.at===bow.at);
 const drawn=bow.bow.filter(f=>f.at===bow.at&&!f.released&&f.pad&&f.walking);
 const released=bow.bow.find(f=>f.at===bow.at&&f.released&&f.pad&&Math.abs(f.clock-launch.now)<130);
 assert(launch.pad&&drawn.length&&released,'actual moving bow draw and released hand frames while left control stays held');
 assert(launch.now-launch.at>=324&&launch.now-launch.at<540,'release keeps 325 ms timing within one rendered contact');
 assert(move(launch.aim,launch.live)<.002,'projectile starts from live launch pose, not initial draw position');
 assert(move(drawn[0].origin,released.origin)>.40,'bow hands translate during held draw');
 assert(bow.arrows.some(a=>a.vertices>10&&move([a.xyz[0],a.xyz[2]],[released.front[0],released.front[2]])<1.0),
  'rendered arrow originates near the released hands rather than the windup tile');
 assert.deepEqual(bow.hits.map(e=>e.amount),[22]);assert.equal(bow.hp,58);
 await send('touchEnd',[]);
 assert(!(await read()).pad);
 assert.deepEqual(errors,[]);
 console.log('PASS trusted two-thumb continuous walking staff overhead/contact and moving bow draw/release/hit; unchanged standing attack');
}catch(e){const info=page?await read().catch(()=>null):null;console.error(checkpoint,JSON.stringify(info),errors);throw e}
finally{await context?.close();await browser?.close();await new Promise(r=>server.close(r))}
