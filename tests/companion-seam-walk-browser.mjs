import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
let h=readFileSync(process.argv[2]??'world-editor.html','utf8');
const put=(a,b)=>{assert.equal(h.split(a).length,2,a);h=h.replace(a,b)};
const api="if(facilityParams.get('test')==='1')window.__editorTest={";
put(api,api+`
 seamlessAlly:{
  frame:()=>render(),
  where:()=>{
   const a=poiCompanionActor,kit=poiHotbarRead(),id=a?.id;
   const pose=a?poiCompanionWorldPose(a,performance.now()):null,scene=facilitySite?.id;
   const s=typeof poiCompanionSeamWalk!=='undefined'?poiCompanionSeamWalk:null;
   const drawn=poiCompanionWorldActor===a&&!!a&&poiCompanionDrawPose;
   return {now:performance.now(),scene,hero:[poiWalkX,poiWalkZ,poiWalkLevel],worldHero:poiOverlandGlobal(scene,poiWalkX,poiWalkZ),
    next:poiWalkNextReady,active:kit.companionSoul?.active,mode:poiCompanionMode(kit),hp:poiCompanionSnapshot(performance.now()).hp,
    slots:poiInventorySlots(kit).filter(c=>c?.type===id).length, hud:$('poiCompanionHud')?.hidden??null,
    same:!window.__seamWitness||a===window.__seamWitness,owner:a?.site?.id,local:a?[a.x,a.z]:null,
    precise:a?poiOverlandGlobal(a.site.id,a.px??a.x,a.pz??a.z):null,
    draw:drawn?poiOverlandGlobal(scene,drawn.x-.5,drawn.z-.5):null,
    pose:pose?poiOverlandGlobal(scene,pose.x-.5,pose.z-.5):null,
    path:s?.path?.slice(s.index,s.index+7)??null,seam:!!s,allowed:poiWalkActive,visible:a&&poiCompanionWorldVisible(a),
    dirs:['n','s','e','w'].map(k=>poiCameraRelativeStep(k)),commits:poiSnowPassSwitches,
    err:gl.getError(),speed:a?poiCompanionSpeed(a):null};
  },
  seedActor:(x,z)=>{
   const a=poiCompanionActor;if(!a||!poiWalkCanStep(x,z))return false;
   a.px=a.x=a.fx=x;a.pz=a.z=a.fz=z;
   a.freeGoal=null;a.freeRoute=null;a.freeMoving=false;a.next=performance.now()+16000;
   window.__seamWitness=a;return true;
  }
 },
`);
put(' requestAnimationFrame(render);',' if(!window.__allySeamManual)requestAnimationFrame(render);');
put('function poiWildRegionalFrame(now,rng){','function poiWildRegionalFrame(now,rng){return;');
put('function poiWildPick(rng){','function poiWildPick(rng){return null;');
for(const[,js] of h.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(js);
if(process.env.COMPANION_SEAM_PARSE_ONLY){console.log('Native companion seam fixture syntax valid');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((r,s)=>{s.setHeader('Content-Type','text/html; charset=utf-8');s.end(r.url==='/seed'?'<title>Seed</title>':h)});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const url='http://127.0.0.1:'+server.address().port;
let browser,last,phase;
try{
 browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const keys=['ArrowUp','ArrowDown','ArrowRight','ArrowLeft'];
 const bx=+(process.env.ALLY_SEAM_FRONTAGE_X??(h.includes('function poiOverlandAdjacentEdge(')?65:60)),sx=bx-48;
 for(const [id,hp,rate] of [['orvasSoul',787,1/235],['slimeSoul',24,1/380]]){
  const context=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:.65});
  const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.clock.install({time:new Date('2026-04-01T10:00:00Z')});
  await p.goto(url+'/seed');await p.evaluate(({id,hp,bx})=>{
   const slots=Array(27).fill(null);slots[0]={type:'equipWoodSword',count:1,durability:150};slots[1]={type:id,count:1,durability:hp};
   localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weaponDurabilityVersion:2,weapon:null,slots,potions:0,
    companionSoul:{version:1,active:id,mode:'follow'}}));
   localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
    position:{x:bx,z:138,y:0,facing:2},townLayout:5,townMapHeight:182,templeDepth:1,
    view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:0,orbitPitch:.24,orbitDistance:6.7}}));
  },{id,hp,bx});
  await p.goto(url+'/?resume=1&test=1',{waitUntil:'domcontentloaded'});await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:45000});
  await p.bringToFront();await p.clock.pauseAt(await p.evaluate(()=>Date.now()+175));await p.evaluate(()=>{window.__allySeamManual=true;});
  const read=()=>p.evaluate(()=>window.__editorTest.seamlessAlly.where());
  const tick=async(ms=50)=>{await p.clock.fastForward(ms);await p.evaluate(()=>window.__editorTest.seamlessAlly.frame());return last=await read();};
  let s=await tick();if(!s.owner)s=await tick();
  const noGap=v=>assert(v.same&&v.hp===hp&&v.active===id&&v.slots===1&&v.mode==='follow'&&v.hud===false&&v.err===0,JSON.stringify(v));
  const step=async(dz,wantScene,wantZ)=>{
   let i=s.dirs.findIndex(d=>d[0]===0&&d[1]===dz);assert(i>=0);
   await p.keyboard.press(keys[i]);s=await tick(240);
   for(let j=0;j<10&&(s.scene!==wantScene||s.hero[1]!==wantZ);j++)s=await tick(65);
   assert(s.scene===wantScene&&s.hero[1]===wantZ,JSON.stringify(s));
  };
  for(const [origin,to,start,entry,direction,inside] of [
   ['base','snowpass',[bx,134],0,1,[1,2,3]],
   ['snowpass','base',[sx,4],138,-1,[137,136,135]]
  ]){
   phase=id+' '+origin+'→'+to;
   if(origin==='snowpass'){
    for(const z of [2,1,0])await step(-1,'snowpass',z);
   }
   assert(await p.evaluate(([x,z])=>window.__editorTest.seamlessAlly.seedActor(x,z),start));
   s=await tick();const before=s;
   assert.equal(s.owner,origin);assert(s.speed===rate);noGap(s);
   await step(direction,to,entry);
   // One real scene switch changes the hero, not the delayed ally.
   assert(s.seam&&s.owner===origin&&s.commits===before.commits+1,JSON.stringify(s));noGap(s);
   assert(Math.hypot(s.precise[0]-before.precise[0],s.precise[1]-before.precise[1])<.44,JSON.stringify(s));
   const menu=p.locator('#poiCompanionCommands');
   await p.locator('#poiHotbar [data-hotbar-slot="1"]').tap();
   assert(await menu.isVisible());
   assert.deepEqual(await menu.locator('button:visible').allTextContents(),['戦いを優先','追尾優先','魂に戻す','戻る']);
   await menu.locator('[data-companion-command="back"]').tap();
   s=await read();noGap(s);assert(s.seam&&s.owner===origin);

   for(const z of inside){await step(direction,to,z);noGap(s);}
   let old=s,n=0,observedOldMesh=false,liveDistances=[];
   while(s.seam&&n++<100){
    s=await tick(50);noGap(s);
    const d=Math.hypot(s.precise[0]-old.precise[0],s.precise[1]-old.precise[1]);
    assert(d<=rate*Math.min(64,s.now-old.now)+1e-5,JSON.stringify({s,old,d,rate}));
    if(d>.01)liveDistances.push(d);
    if(s.draw&&s.owner!==s.scene){
     observedOldMesh=true;
     assert(Math.hypot(s.draw[0]-s.precise[0],s.draw[1]-s.precise[1])<.27,'visible actor projects physical feet, not hero position');
    }
    old=s;
   }
   assert(!s.seam&&s.owner===to&&s.same&&liveDistances.length>=6,JSON.stringify({s,liveDistances}));
   assert(observedOldMesh,'real old-side body rendered across shared world once terrain submitted');
   console.log(phase,JSON.stringify({frames:n,rate,max:Math.max(...liveDistances),hp:s.hp,commit:s.commits}));
  }
  assert.deepEqual(errors,[]);await context.close();
 }
} catch(e){console.error(phase,last);throw e}
finally{await browser?.close();await new Promise(ok=>server.close(ok));}
