import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {Script} from 'node:vm';
const source=readFileSync(process.argv[2]??'world-editor.html','utf8');
function patch(s,a,b){assert.equal(s.split(a).length,2,a);return s.replace(a,b)}
const api='  freeMovementPose:()=>({x:poiWalkViewX,z:poiWalkViewZ,level:poiWalkLevel}),';
let html=patch(source,api,api+`
  bareHandQA:{
   manual:()=>{window.__bareFramesManual=true},frame:()=>render(),
   seed:(distance,lateral=0)=>{
    poiMonsterStates.clear();poiMonsterActorActive.clear();poiCombatLockReset();
    const now=performance.now(),p=poiAimOrigin(now),xx=p.x+distance,zz=p.z+lateral,x=poiFreeCell(xx),z=poiFreeCell(zz);
    const o={x,z,y:p.y,type:'monsterSlime',rot:0},s=poiCombatActorMake(o),cells=new Set([x+','+z]);
    s.hp=35;s.townOwned=true;s.actorFree={fromX:xx,fromZ:zz,x:xx,z:zz,start:now-900,ms:380,cells,endCells:cells,heading:0};
    poiMonsterStates.set(o,s);poiMonsterMeshDirty=true;poiAimLockAt=0;
    window.__bare={trace:[],damage:[],events:[],state:s,target:[xx,zz],meshes:new WeakMap()};
   },
   read:()=>{
    const q=window.__bare;
    return {now:performance.now(),time:poiWalkActionStarted,ready:poiAttackReady,view:poiThirdPerson,
     holding:!!poiAnalogContact,walk:!!poiFreePose?.walking,position:[poiWalkViewX,poiWalkViewZ],
     hp:q?.state?.hp,trace:q?.trace,damage:q?.damage,events:q?.events,
     weapon:poiEquippedWeapon()};
   }
  },
`);
const schedule='function render(){\n if(window.pineStartup.failed)return;\n requestAnimationFrame(render);';
html=patch(html,schedule,schedule.replace('requestAnimationFrame(render);','if(!window.__bareFramesManual)requestAnimationFrame(render);'));
for(const key of ['function poiMobFrame(now){','function poiWildRegionalFrame(now,rng){'])html=patch(html,key,key+'return;');
html=patch(html,' const p=poiWildPick(rng);',' const p=null;');
const mesh=' if(fist)poiDrawBareFistRig(m,poiBareFistRig(fistPose,stride,pose?.fistReach),gear,rotate,x,y,z);';
html=patch(html,mesh,` if(fist){
  const rig=poiBareFistRig(fistPose,stride,pose?.fistReach),first=m.p.length;
  poiDrawBareFistRig(m,rig,gear,rotate,x,y,z);
  const q=window.__bare;
  if(q){
   const projected=m.p.slice(first);let forward=-Infinity,back=Infinity;
   const dir=rotate(0,1);
   for(let i=0;i<projected.length;i+=3){
    const f=(projected[i]-x)*dir[0]+(projected[i+2]-z)*dir[1];
    forward=Math.max(forward,f);back=Math.min(back,f);
   }
   q.meshes.set(m,{phase:fistPose?.phase??'rest',rig,vertices:projected.length/3,forward,back,
    started:poiWalkActionStarted,now:performance.now(),avatar:[x,z],held:!!poiAnalogContact});
  }
 }`);
const upload='function upload(m,reuse=null,usage=gl.STATIC_DRAW){';
const returned='return{buf:vbo,count:n}';
const i=html.indexOf(upload),j=html.indexOf(returned,i);
assert(i>=0&&j>i,'actual avatar mesh vertex array enters GL upload');
html=html.slice(0,j)+`const ready={buf:vbo,count:n},q=window.__bare,pose=q?.meshes.get(m);
 if(pose)q.meshes.set(ready,pose);
 return ready`+html.slice(j+returned.length);
const draw='function poiDrawWalkAvatar(vp,now=performance.now()){\n if(!poiWalkMesh)return;';
html=patch(html,draw,draw+`
 const q=window.__bare,g=q?.meshes.get(poiWalkMesh);
 if(g&&q.trace.length<130)q.trace.push({...g,drawnAt:now});
`);
const damage='function poiPlayerDamageTarget(monster,x,z,amount,weapon,now,silent=false,atContact=false,source=null){';
html=patch(html,damage,damage+`
 if(window.__bare&&monster?.[1]===window.__bare.state)
  window.__bare.damage.push({now,x,z,amount,weapon,pad:!!poiAnalogContact});
`);
if(process.env.UNARMED_MOTION_LAYOUT_ONLY==='1'){
 for(const [,,s] of [...html.matchAll(/<script(?:\s+([^>]*))?>([\s\S]*?)<\/script>/gi)].filter(([,a])=>!a||!/\b(?:src|type)\s*=/.test(a)))new Script(s);
 console.log('PASS native unarmed motion anchors and scripts');process.exit(0);
}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>Seed</title>':html)});
await new Promise((r,j)=>server.listen(0,'127.0.0.1',r).once('error',j));
const origin='http://127.0.0.1:'+server.address().port,read=p=>p.evaluate(()=>window.__editorTest?.bareHandQA.read());
let b,checkpoint='launch';
const watchdog=setTimeout(()=>{console.error('Unarmed motion native stalled',checkpoint);process.exit(1)},80000);
try{
 b=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const ctx=await b.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:.6});
 const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(11000);
 await p.clock.install({time:new Date('2026-11-24T12:00:00Z')});
 await p.goto(origin+'/seed');
 await p.evaluate(()=>{
  localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weapon:null,potions:0}));
  localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":575000}');
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:102,z:93,y:0,facing:1},townLayout:5,townMapHeight:128,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:Math.PI/2,orbitPitch:.35,orbitDistance:5.5}}));
 });
 await p.goto(origin+'/?resume=1&test=1');
 await p.locator('#pineStartupCover').waitFor({state:'hidden'});
 await p.waitForFunction(()=>window.__editorTest?.facility()?.active&&document.querySelector('#viewWrap')?.hasAttribute('data-analog-play'),null,{polling:30});
 const wall=await p.evaluate(()=>Date.now());await p.clock.pauseAt(wall+1500);
 await p.evaluate(()=>window.__editorTest.bareHandQA.manual());
 const pad=p.locator('#poiAnalogPad'),action=p.locator('#poiWalkAction');
 const cdp=await ctx.newCDPSession(p);
 const dispatch=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
 const point=(r,id)=>({x:Math.round(r.x+r.width*.5),y:Math.round(r.y+r.height*.5),id,radiusX:4,radiusY:4,force:.7});
 const tick=async ms=>{for(let l=ms;l>0;){const k=Math.min(l,16);await p.clock.fastForward(k);await p.evaluate(()=>window.__editorTest.bareHandQA.frame());l-=k}};
 function check(q,moving){
  assert.equal(q.hp,21);assert.equal(q.weapon,null);assert(q.view);
  assert.deepEqual(q.damage.map(d=>[d.now-q.time,d.amount,d.weapon,d.pad]),[[0,14,null,moving]],'the actual unarmed contact remains immediate and costs exactly 14 HP');
  assert.equal(q.ready-q.time,300);
  const hit=q.trace.find(x=>x.phase==='contact'&&x.started===q.time),after=q.trace.find(x=>x.phase==='withdraw'&&x.started===q.time);
  const rest=q.trace.find(x=>x.phase==='rest'&&x.drawnAt>=q.time+260);
  assert(hit&&after&&rest&&hit.vertices>220,'real uploaded shoulder, arms and hand meshes are drawn through recovery');
  assert(hit.forward>rest.forward+.30&&hit.rig.left.wrist[1]>rest.rig.left.wrist[1]+.16,
   'front knuckles project while other hand stays up');
  assert(hit.rig.right.shoulder[2]>rest.rig.right.shoulder[2]+.10&&hit.rig.right.elbow[2]>rest.rig.right.elbow[2]+.11);
  if(moving){
   assert(hit.held&&after.held);
   assert(after.avatar[0]>hit.avatar[0]+.08,'wrist follows translating third-person body while the same movement thumb is held');
   assert(q.events.some(e=>e.type==='pointerup'&&e.touch==='touch'&&!e.primary&&e.trusted));
  }
 }
 try{
  checkpoint='single stationary third person touch';
  await p.evaluate(()=>window.__editorTest.bareHandQA.seed(.84));
  const right=point(await action.boundingBox(),1);
  await dispatch('touchStart',[right]);await dispatch('touchEnd',[]);
  const initial=await read(p);assert.equal(initial.hp,21,'do not introduce an invisible damage delay');
  await tick(288);check(await read(p),false);
  await tick(36);
  checkpoint='genuine second touch attacks while left thumb continues free movement';
  const left=point(await pad.boundingBox(),7),second=point(await action.boundingBox(),8),drag={...left,y:left.y-34};
  await dispatch('touchStart',[left]);await dispatch('touchMove',[drag]);await tick(64);
  const moving=await read(p);assert(moving.holding&&moving.walk);
  // A real actor occupying x103 directly ahead blocks movement at the
  // x102.3 body boundary. Put it within punch reach beside the travel
  // corridor, so this run actually exercises moving *through* recovery.
  await p.evaluate(()=>window.__editorTest.bareHandQA.seed(.12,.80));
  await action.evaluate(el=>{
   for(const type of ['pointerdown','pointerup','pointercancel'])el.addEventListener(type,e=>{
    window.__bare.events.push({type:e.type,touch:e.pointerType,primary:e.isPrimary,trusted:e.isTrusted});
   },true);
  });
  await dispatch('touchStart',[drag,second]);
  try{await dispatch('touchEnd',[second])}catch{await dispatch('touchMove',[drag])}
  await tick(288);
  check(await read(p),true);
  await dispatch('touchEnd',[]);
  assert.deepEqual(errors,[]);
  console.log('PASS real stationary/moving third-person unarmed touch, actual 14HP, linked hand/torso GL and smooth recovery');
 }catch(e){const q=await read(p).catch(()=>null);console.error(checkpoint,JSON.stringify(q&&{...q,trace:q.trace?.slice(-8)}),errors);throw e}
 finally{await cdp.detach();await ctx.close()}
}finally{await b?.close();await new Promise(r=>server.close(r));clearTimeout(watchdog)}
