import a from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const input=readFileSync(process.argv[2]??'world-editor.html','utf8');
const hook='  freeMovementPose:()=>({x:poiWalkViewX,z:poiWalkViewZ,level:poiWalkLevel}),';
const routine='function poiTownNpcRoutine(a,clock,now,budget){';
a.equal(input.split(hook).length,2);a.equal(input.split(routine).length,2);
const html=input.replace(routine,routine+'\n if(window.__npcTalkQA===a)return;').replace(hook,hook+`
  npcTalkQA:{
   lives:()=>({selected:poiTownDialogueTarget(performance.now())?.role.id??null,opened:poiTownDialogue?.actor.role.id??null}),
   setup:()=>{
    const actor=poiTownNpcActors.find(a=>a.role.id==='westpeddler');if(!actor)return null;
    let cfg=null;
    for(const [dx,dz] of [[1,1],[-1,1],[1,-1],[-1,-1]]){
     const x=poiWalkX+dx,z=poiWalkZ+dz,ox=poiWalkX+.12*dx,oz=poiWalkZ+.1*dz;
     const yaw=Math.atan2(-.79*dx,.61*dz),o={x:ox,z:oz,y:0,dir:poiAimUnit(.79*dx,.61*dz)},n={...actor,x,z,y:0,fromX:x,fromZ:z,fromY:0,
      recessed:false,death:null,target:null,hitAt:null,hurtAt:null,gestureAt:null,activity:'idle',actorLeg:null,moveAt:-10000};
     if(!poiTownNpcStance(n,poiTownNpcGraph()))continue;
     const before={...actor};Object.assign(actor,n);
     if(poiTownDialogueLiveTarget(o,performance.now(),a=>a===actor,null)!==actor){Object.assign(actor,before);continue}
     cfg={wall:{x:poiWalkX+dx,z:poiWalkZ,y:0,type:'wall',rot:0},o,yaw};break;
    }
    if(!cfg)return null;
    for(const a of poiTownNpcActors)if(a!==actor)a.recessed=true;
    window.__npcTalkQA=actor;window.__npcTalkWall=cfg.wall;
    world.push(cfg.wall);
    poiFreePose={x:cfg.o.x,z:cfg.o.z,level:0,angle:cfg.yaw,walking:false,changed:true,distance:0};
    return actor.role.id;
   },
   unblock:()=>{world=world.filter(o=>o!==window.__npcTalkWall)},
  },`);
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<!doctype html>':html)});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const url='http://127.0.0.1:'+server.address().port;
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:740,height:390},isMobile:true,hasTouch:true});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url+'/seed');
 await page.evaluate(()=>{
  localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":330000}');
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:44,z:43,y:0,facing:2},townLayout:5,townMapHeight:128,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 });
 await page.goto(url+'/?resume=1&test=1');
 await page.waitForFunction(()=>window.__editorTest?.townResidents()?.actors?.length&&window.pineStartup&&!pineStartup.loading);
 const actor=await page.evaluate(()=>window.__editorTest.npcTalkQA.setup());
 a.equal(actor,'westpeddler','use a real resident and a legal off-axis street');
 a.equal(await page.evaluate(()=>window.__editorTest.npcTalkQA.lives().selected),null,'actual wall interrupts diagonal greeting');
 await page.evaluate(()=>window.__editorTest.npcTalkQA.unblock());
 const button=page.locator('#poiWalkAction');
 await page.waitForFunction(()=>document.getElementById('poiWalkAction').textContent==='話す');
 a.equal(await page.evaluate(()=>window.__editorTest.npcTalkQA.lives().opened),null,'show prompt without starting conversation');
 await button.tap();
 await page.waitForFunction(id=>window.__editorTest.npcTalkQA.lives().opened===id,actor);
 a.deepEqual(errors,[]);
 console.log('PASS mobile live oblique NPC prompt, wall block and explicit talk');
}finally{await browser?.close();await new Promise(r=>server.close(r))}
