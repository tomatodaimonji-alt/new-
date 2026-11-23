import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
function inject(s,a,b){assert.equal(s.split(a).length,2,a);return s.replace(a,b)}
const api='  freeMovementPose:()=>({x:poiWalkViewX,z:poiWalkViewZ,level:poiWalkLevel}),';
let fixture=inject(html,api,api+`
  crowdQA:{
   seed:narrow=>{
    poiEnemyCancelPlayer();poiMonsterStates.clear();poiMonsterActorActive.clear();poiCombatLockReset();
    const x=poiWalkX,z=poiWalkZ,y=poiWalkLevel,now=performance.now();
    const walls=[];if(narrow)for(const wx of [x-1,x+1])for(let wz=z-4;wz<=z+1;wz++){
     const wall={x:wx,z:wz,y,type:'stonewall',rot:0};world.push(wall);walls.push(wall);
    }
    if(walls.length)facilityInvalidateScenes();
    const push=narrow?-1:1,types=['monsterSlime','monsterGoblin','monsterSkeleton','monsterSlime','monsterGoblin'];
    const actors=types.map((type,i)=>{
     const o={x,z:z+push*(i+2),y,type,rot:0};const s=poiCombatActorMake(o);
     poiMonsterStates.set(o,s);return {o,s,id:i};
    });
    // A larger fixture HP pool lets real, unchanged enemy attacks run
    // for the whole crowd sample without a defeat relocating the player.
    poiPlayerHP=350;
    window.__qaCrowd={walls,actors,origin:{x,z},start:now,frames:[],attacks:[],last:-Infinity};
    poiNextMobTick=now;poiMonsterMeshDirty=true;
   },
   read:()=>{const v=window.__qaCrowd;return v?{start:v.start,origin:v.origin,walls:v.walls,attacks:v.attacks,frames:v.frames}:null}
  },`);
fixture=inject(fixture,' const p=poiWildPick(rng);',' const p=null;');
fixture=inject(fixture,'function poiWildRegionalFrame(now,rng){','function poiWildRegionalFrame(now,rng){return;');
const attack='function poiEnemyBeginPlayer(obj,s,now){';
fixture=inject(fixture,attack,`function poiEnemyBeginPlayer(obj,s,now){
 const result=__qaCrowdBeginPlayer(obj,s,now),c=window.__qaCrowd;
 if(result&&c){
  const source=c.actors.find(a=>a.o===obj);
  if(source&&s.playerAttack?.pending)c.attacks.push({id:source.id,kind:obj.type,at:now-c.start,hit:s.playerAttack.hit-c.start});
 }
 return result;
}
function __qaCrowdBeginPlayer(obj,s,now){`);
const draw='  poiMonsterRender(now,p.vp);';
fixture=inject(fixture,draw,draw+`
  const crowd=window.__qaCrowd;
  if(crowd&&now-crowd.last>=45&&crowd.frames.length<210){
   crowd.last=now;
   crowd.frames.push({at:now-crowd.start,hp:poiPlayerHP,x:poiWalkViewX,z:poiWalkViewZ,actors:crowd.actors.map(({o,s,id})=>{
    const v=poiMonsterPose(o,s,now,true);
    return {id,type:o.type,x:v.x-.5,z:v.z-.5,cx:s.x,cz:s.z,casting:!!s.playerAttack?.pending,
     leg:s.actorFree?{x:s.actorFree.x,z:s.actorFree.z,fromX:s.actorFree.fromX,fromZ:s.actorFree.fromZ}:null};
   })});
  }
`);
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<!doctype html><title>Crowd AI QA</title>':fixture)});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const base='http://127.0.0.1:'+server.address().port;
let browser,stage='launch';
const watchdog=setTimeout(()=>{console.error('Crowd browser stalled at '+stage);process.exit(1)},65000);
const round=v=>Math.floor(v+.5);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const sector=(a,o)=>(Math.round(Math.atan2(a.x-o.x,a.z-o.z)/(Math.PI/4))+8)%8;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 for(const narrow of [false,true]){
  stage=narrow?'narrow corridor':'open chamber';
  const ctx=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:.65,isMobile:true,hasTouch:true});
  const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(11500);
  const q=()=>p.evaluate(()=>window.__editorTest?.crowdQA.read());
  try{
   await p.goto(base+'/seed');
   await p.evaluate(narrow=>{
    const [x,z]=narrow?[64,23]:[62,13];
    localStorage.setItem('world-workshop-hotbar-v1','{"version":1,"weapon":"equipWoodSword","potions":3}');
    localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":345000}');
    localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
     position:{x,z,y:-1,facing:0},townLayout:5,townMapHeight:128,
     view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:-1,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
   },narrow);
   await p.goto(base+'/?resume=1&test=1');
   await p.locator('#pineStartupCover').waitFor({state:'hidden'});
   await p.waitForFunction(()=>window.__editorTest?.facility()?.active&&document.querySelector('#viewWrap').hasAttribute('data-analog-play'),null,{polling:35,timeout:7000});
   await p.evaluate(narrow=>window.__editorTest.crowdQA.seed(narrow),narrow);
   await p.waitForFunction(ms=>window.__editorTest.crowdQA.read()?.frames.at(-1)?.at>=ms,narrow?4100:6400,{polling:70,timeout:11000});
   const {origin,walls,frames,attacks}=await q();
   assert(frames.length>=12,'capture repeated actual rendered movement, not just a final arrangement');
   let nearestPair=Infinity,nearestPlayer=Infinity;
   for(const frame of frames){
    assert(Math.abs(frame.x-origin.x)<.001&&Math.abs(frame.z-origin.z)<.001&&frame.hp>0,'player remains present and not warped');
    for(const [i,a] of frame.actors.entries()){
     nearestPlayer=Math.min(nearestPlayer,distance(a,origin));
     assert(round(a.x)!==origin.x||round(a.z)!==origin.z,'unrelated monsters cannot enter the player square');
     for(const b of frame.actors.slice(i+1))nearestPair=Math.min(nearestPair,distance(a,b));
     for(const wall of walls)assert(round(a.x)!==wall.x||round(a.z)!==wall.z,'continuous monster body never passes into the real wall tile');
    }
   }
   assert(nearestPlayer>=.42&&nearestPair>=.23,'no full body or player overlap: '+[nearestPlayer,nearestPair]);
   const last=frames.at(-1).actors;
   assert(last.some((a,i)=>distance(a,origin)<distance(frames[0].actors[i],origin)-.4),'normal chase really advances');
   if(!narrow){
    const best=Math.max(...frames.map(f=>new Set(f.actors.filter(a=>distance(a,origin)<=1.85).map(a=>sector(a,origin))).size));
    assert(best>=3,'five initially single-file foes fan out into at least three distinct nearby sides: '+JSON.stringify({best,last}));
    assert(frames.some(f=>f.actors.slice(1).some(a=>Math.abs(a.x-origin.x)>.35)),'followers are not locked to the leader’s original line');
    assert(new Set(attacks.map(a=>a.id)).size>=3&&attacks.every(a=>a.hit>a.at),'at least three distinct ordinary enemies begin real existing windups: '+JSON.stringify(attacks));
   }else{
    const closest=Math.min(...last.map(a=>distance(a,origin)));
    assert(closest<=1.55,'a legal corridor approach still works without forcing impossible flanks');
    const pad=await p.locator('#poiAnalogPad').boundingBox();assert(pad);
    const cdp=await ctx.newCDPSession(p),left={x:Math.round(pad.x+pad.width/2),y:Math.round(pad.y+pad.height/2),id:1,force:.7,radiusX:4,radiusY:4};
    const dispatch=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
    try{
     await dispatch('touchStart',[left]);await dispatch('touchMove',[{...left,y:left.y+32}]);
     await p.waitForFunction(initial=>window.__editorTest.freeMovementPose().z>initial+.37,origin.z,{polling:30,timeout:2600});
     await dispatch('touchEnd',[]);
     const step=await p.evaluate(()=>window.__editorTest.freeMovementPose());
     assert.equal(step.level,-1);assert(Math.abs(step.x-origin.x)<.04,'player still controls the open side of the corridor');
    }finally{await cdp.detach()}
   }
   assert.deepEqual(errors,[]);
   console.log('PASS five normal enemies '+stage+' '+JSON.stringify({nearestPair,nearestPlayer,count:frames.length,last}));
  }catch(e){
   const sample=await q().catch(()=>null);
   console.error(stage,JSON.stringify({first:sample?.frames?.[0],last:sample?.frames?.at(-1),errors}));throw e;
  }finally{await ctx.close()}
 }
}finally{await browser?.close();await new Promise(r=>server.close(r));clearTimeout(watchdog)}
