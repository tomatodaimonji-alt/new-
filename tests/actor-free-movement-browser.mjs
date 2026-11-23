import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const anchor='  freeMovementPose:()=>({x:poiWalkViewX,z:poiWalkViewZ,level:poiWalkLevel}),';
const routine='function poiTownNpcRoutine(a,clock,now,budget){';
assert.equal(html.split(anchor).length,2);assert.equal(html.split(routine).length,2);
// Pin only the chosen test actor's destination; real graph, NPC renderer,
// scheduling clock, and hostile chase execute unchanged.
const fixture=html.replace(routine,routine+`
 if(window.__actorRouteQA?.actor===a){
  poiTownNpcMove(a,window.__actorRouteQA.target,'travel',now,budget);return;
 }`).replace(anchor,anchor+`
  seedNpcRouteQA:()=>{
   const actor=poiTownNpcActors.find(a=>a.role.id==='westpeddler'),g=poiTownNpcGraph();
   if(!actor)return null;
   for(let r=2;r<=9;r++)for(let ox=-r;ox<=r;ox++)for(const oz of [-r,r]){
    const p={x:poiWalkX+ox,z:poiWalkZ+oz,y:0};
    if(!poiTownNpcStance(p,g))continue;
    for(const [dx,dz] of [[3,2],[2,3],[-3,2],[3,-2],[-3,-2],[-2,3]]){
     const target={x:p.x+dx,z:p.z+dz,y:0,facing:1},trail=poiTownFindPath(p,target);
     if(!trail||trail.length<5)continue;
     const seeded={...actor,...p};
     if(poiTownNpcActorPinned(seeded,p,g,target))continue;
     const tryIt=poiActorPickSegment(p,trail,t=>poiTownNpcActorPinned(seeded,t,g,target),
      (x,z,fx,fz)=>poiTownNpcActorLegal(actor,g,target,x,z,fx,fz));
     if(tryIt.used<3||Math.abs(tryIt.target.x-p.x)===Math.abs(tryIt.target.z-p.z))continue;
     actor.x=p.x;actor.z=p.z;actor.y=0;actor.fromX=p.x;actor.fromZ=p.z;actor.fromY=0;actor.recessed=false;
     actor.path=null;actor.goalKey=null;actor.actorLeg=null;actor.nextPlan=0;actor.moveAt=-10000;
     window.__actorRouteQA={actor,target};
     return {p,target,goal:tryIt.target};
    }
   }
   return null;
  },
  seedWildChaseQA:()=>{
   if(!poiWildPlayerOutside())return null;
   for(const [dx,dz] of [[3,2],[-3,2],[3,-2],[-3,-2],[2,3],[-2,3],[2,-3],[-2,-3]]){
    const x=poiWalkX+dx,z=poiWalkZ+dz;
    if(!poiWildExterior(x,z)||!poiWalkCanStep(x,z))continue;
    const obj={x,z,y:0,type:'monsterSlime',rot:0};
    const state={x,z,fromX:x,fromZ:z,moveStarted:-10000,facing:0,hp:POI_MONSTER_STATS.monsterSlime.hp,nextAttack:performance.now()+1500,wildSpawn:true};
    if(!poiMonsterChaseFree(obj,{...state},performance.now(),null,null))continue;
    poiWildActors.add(obj);poiMonsterStates.set(obj,state);poiMonsterMeshDirty=true;
    return {x,z};
   }
   return null;
  },`).replace(' const p=poiWildPick(rng);',' const p=null;');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','no-store');
 res.end(req.url==='/seed'?'<!doctype html><title>Fixture</title>':fixture);
});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const origin='http://127.0.0.1:'+server.address().port,resume='world-workshop-resume-v1',kit='world-workshop-hotbar-v1';
const inventory='{"version":1,"weapon":"equipWoodSword","potions":2,"gold":18,"claimedCaches":["glade"]}';
async function launch(browser,p){
 const context=await browser.newContext({viewport:{width:740,height:390},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
 await page.goto(origin+'/seed');
 await page.evaluate(({p,resume,kit,inventory})=>{
  localStorage.setItem(kit,inventory);
  localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":330000}');
  localStorage.setItem(resume,JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{...p,y:0,facing:2},townLayout:5,townMapHeight:128,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 },{p,resume,kit,inventory});
 await page.goto(origin+'/?resume=1&test=1');
 await page.waitForFunction(()=>window.__editorTest?.facility?.()?.active&&window.pineStartup&&!pineStartup.loading);
 return {page,context,errors};
}
const samples=(page,kind)=>page.evaluate(kind=>new Promise(resolve=>{
 const started=performance.now(),rows=[];
 function frame(t){
  const api=window.__editorTest;
  if(kind==='town'){
   const a=api.townResidents().actors.find(a=>a.id==='westpeddler');
   if(a?.visual)rows.push({cell:{x:a.x,z:a.z},x:a.visual.x,z:a.visual.z,angle:a.visual.heading});
  }else{
   const a=api.activeMonsterWorldPoses().find(v=>v.type==='monsterSlime'&&v.wild);
   if(a)rows.push({cell:{x:a.x,z:a.z},x:a.pose.x-.5,z:a.pose.z-.5,angle:a.pose.heading});
  }
  if(t-started<2100)requestAnimationFrame(frame);else resolve(rows);
 }
 requestAnimationFrame(frame);
}),kind);
function assertAngled(rows,tag){
 const changes=rows.slice(1).map((r,i)=>({dx:r.x-rows[i].x,dz:r.z-rows[i].z,angle:r.angle})).filter(r=>
  Number.isFinite(r.angle)&&Math.abs(r.dx)>.003&&Math.abs(r.dz)>.003&&Math.abs(Math.abs(r.dx)-Math.abs(r.dz))>.003);
 assert(rows.slice(1).some((r,i)=>Number.isFinite(r.angle)&&r.cell.x===rows[i].cell.x&&r.cell.z===rows[i].cell.z&&
  Math.abs(r.x-rows[i].x)>.002&&Math.abs(r.z-rows[i].z)>.002),
  tag+' rendered fractional position should change even while canonical cells do not');
 assert(changes.length>=2,tag+' must advance both real coordinates at a non-cardinal, non-diagonal angle: '+JSON.stringify(rows.slice(0,25)));
 assert(rows.every(r=>Number.isInteger(r.cell.x)&&Number.isInteger(r.cell.z)),'authoritative occupancy stays integer');
}
async function npc(browser){
 const {page,context,errors}=await launch(browser,{x:44,z:43});
 try{
  await page.waitForFunction(()=>window.__editorTest.townResidents().actors.some(a=>a.id==='westpeddler'));
  const route=await page.evaluate(()=>window.__editorTest.seedNpcRouteQA());
  assert(route,'live authored graph contains a suitable street waypoint');
  assertAngled(await samples(page,'town'),'real 西の行商人');
  await page.waitForFunction(target=>window.__editorTest.townResidents().actors.some(a=>
   a.id==='westpeddler'&&a.x===target.x&&a.z===target.z&&a.facing===1),route.target);
  assert.equal(await page.evaluate(k=>localStorage.getItem(k),kit),inventory);
  assert.deepEqual(errors,[]);
 }finally{await context.close()}
}
async function mob(browser){
 const {page,context,errors}=await launch(browser,{x:102,z:93});
 try{
  const p=await page.evaluate(()=>window.__editorTest.seedWildChaseQA());
  assert(p,'actual exterior contains an eligible wild slime chase route');
  assertAngled(await samples(page,'wild'),'real 野生スライム');
  assert.equal(await page.evaluate(k=>localStorage.getItem(k),kit),inventory);
  assert.deepEqual(errors,[]);
 }finally{await context.close()}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await npc(browser);await mob(browser);
 console.log('PASS real resident and wild slime use actual oblique trajectories and canonical tile state');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
