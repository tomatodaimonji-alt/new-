import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
function replaceOnce(s,from,to){assert.equal(s.split(from).length,2,from);return s.replace(from,to)}
const hook='  freeMovementPose:()=>({x:poiWalkViewX,z:poiWalkViewZ,level:poiWalkLevel}),';
let fixture=replaceOnce(html,hook,hook+`
  combatLockQA:{
   isolate:()=>{
    const authored=[...poiMonsterStates].filter(([o,s])=>s.hp>0&&o.y===poiWalkLevel&&Math.hypot(s.x-poiWalkX,s.z-poiWalkZ)<=8)
     .map(([o])=>({type:o.type,x:o.x,z:o.z,y:o.y}));
    poiMonsterStates.clear();poiCombatLockReset();poiMonsterMeshDirty=true;
    return authored;
   },
   seed:(name,dx,dz,dy=0)=>{
    const w=window.__qaCombatTargets??={};
    if(w[name])poiMonsterStates.delete(w[name].obj);
    const p=poiAimOrigin(performance.now()),x=p.x+dx,z=p.z+dz,y=p.y+dy;
    const ix=poiFreeCell(x),iz=poiFreeCell(z);
    const obj={x:ix,z:iz,y,type:'monsterSlime',rot:0};
    const state=poiCombatActorMake(obj),cells=new Set([ix+','+iz]),now=performance.now();
    state.hp=100;state.townOwned=true;
    state.actorFree={fromX:x,fromZ:z,x,z,start:now-400,ms:380,cells,endCells:cells,heading:0};
    poiMonsterStates.set(obj,state);w[name]={obj,state,x,z};poiMonsterMeshDirty=true;
   },
   move:(name,dx,dz)=>{
    const p=poiAimOrigin(performance.now()),t=window.__qaCombatTargets[name],s=t.state,x=p.x+dx,z=p.z+dz;
    s.x=poiFreeCell(x);s.z=poiFreeCell(z);t.x=x;t.z=z;
    Object.assign(s.actorFree,{x,z,fromX:x,fromZ:z,cells:new Set([s.x+','+s.z]),endCells:new Set([s.x+','+s.z])});
    poiMonsterMeshDirty=true;
   },
   wall:(enable)=>{
    if(window.__qaCombatWall){world=world.filter(o=>o!==window.__qaCombatWall);window.__qaCombatWall=null}
    if(!enable)return;
    const p=poiAimOrigin(performance.now()),t=window.__qaCombatTargets.a;
    const wall={x:poiFreeCell((p.x+t.x)*.5),z:poiFreeCell((p.z+t.z)*.5),y:p.y,rot:0,type:'wall'};
    world=[...world,wall];window.__qaCombatWall=wall;
    dirty=true;
   },
   status:()=>{
    const targets=window.__qaCombatTargets||{},marker=$('poiAimLockMarker'),p=poiAimOrigin(performance.now());
    const l=typeof poiCombatLock==='undefined'?poiAimLocked:poiCombatLock;
    const id=l?.id??l?.obj??l?.target?.id??l?.target?.obj??l;
    const name=Object.keys(targets).find(k=>targets[k].obj===id||targets[k].state===l?.state);
    const css=marker?getComputedStyle(marker):null,stroke=marker?getComputedStyle(marker,'::before'):null;
    const a=targets.a,ax=a?a.x-p.x:0,az=a?a.z-p.z:0,dist=Math.hypot(ax,az),dir=poiAimUnit(ax,az);
    return {name,chosen:id?.type?{type:id.type,x:id.x,z:id.z,y:id.y}:null,p,
      aRay:dir?{clear:poiAimWallLimit(p,dir,dist,poiAimWall(p)),dist}:null,heading:window.__qaCombatHeading,marker:!!marker&&!marker.hidden&&css.display!=='none',
      projection:window.__qaCombatProjection,enemyBase:targets[name]?poiMonsterPose(targets[name].obj,targets[name].state,performance.now()).y:null,camera:{yaw,orbit:poiCameraYaw},
      border:stroke?.borderTopWidth,color:css?.color,markerPointer:css?.pointerEvents,
      at:poiWalkActionStarted,now:performance.now(),ready:poiAttackReady,pending:!!poiPlayerWeaponPending,
      hp:Object.fromEntries(Object.entries(targets).map(([k,t])=>[k,t.state.hp]))};
   }
  },`);
fixture=replaceOnce(fixture,'function poiAimRenderMarker(now,vp,layer){',`function poiAimRenderMarker(now,vp,layer){
 window.__qaCombatProjection=null;
 window.__qaCombatProjecting=true;
 try{return __qaRealMarker(now,vp,layer)}finally{window.__qaCombatProjecting=false}
}
function __qaRealMarker(now,vp,layer){`);
fixture=replaceOnce(fixture,'function poiWorldToScreen(vp,x,y,z){',
 'function poiWorldToScreen(vp,x,y,z){if(window.__qaCombatProjecting)window.__qaCombatProjection={x,y,z};');
fixture=replaceOnce(fixture,'function poiBuildPlayerMesh(weapon,pose,gear,stride=0,r=0,x=0,y=0,z=0,heading=null){',
 'function poiBuildPlayerMesh(weapon,pose,gear,stride=0,r=0,x=0,y=0,z=0,heading=null){window.__qaCombatHeading=heading??r*Math.PI/2;');
fixture=replaceOnce(fixture,' const p=poiWildPick(rng);',' const p=null;');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url==='/seed'?'<!doctype html><title>Combat lock QA</title>':fixture);
});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const ctx=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);
 const base='http://127.0.0.1:'+server.address().port;
 await page.goto(base+'/seed');
 await page.evaluate(()=>{
  localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weapon:'equipWoodSword',potions:0}));
  localStorage.setItem('world-workshop-town-clock-v1',JSON.stringify({version:1,gameMs:575000}));
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:102,z:93,y:0,facing:1},townLayout:5,townMapHeight:128,
   view:{yaw:0,zoom:.65,panX:0,panZ:0,level:0,hideUpper:false,top:true,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 });
 await page.goto(base+'/?resume=1&test=1');
 await page.waitForFunction(()=>window.__editorTest?.facility()?.active&&window.pineStartup&&!pineStartup.loading);
 await page.waitForFunction(()=>document.querySelector('#viewWrap').hasAttribute('data-analog-play'));
 const status=()=>page.evaluate(()=>window.__editorTest.combatLockQA.status());
 const op=(method,...args)=>page.evaluate(({method,args})=>window.__editorTest.combatLockQA[method](...args),{method,args});
 const lock=async(name,marker)=>{
  try{await page.waitForFunction(({name,marker})=>{const s=window.__editorTest.combatLockQA.status();return s.name===name&&(marker===undefined||s.marker===marker)},{name,marker})}
  catch(cause){throw Error('lock '+name+'/'+marker+' not observed: '+JSON.stringify(await status()),{cause})}
 };
 // Authored archer (105,86) is 7.62 tiles away and may acquire first. A lock
 // is sticky by design; isolate only the test targets before testing capture.
 await op('isolate');
 await op('seed','outside',0,-8.1);
 await op('seed','upper',0,1,1);
 await page.evaluate(()=>{const q=window.__editorTest.combatLockQA;q.seed('a',0,7.85);q.wall(true)});
 // Allow the acquisition probe to run while that target is initially hidden.
 await page.waitForTimeout(180);
 assert.notEqual((await status()).name,'a','does not first acquire an enemy through a solid wall');
 await op('wall',false);
 const restoredRay=(await status()).aRay;
 assert(restoredRay?.clear>=restoredRay?.dist-1e-6,'the restored authored +Z lane is actually clear: '+JSON.stringify(await status()));
 await lock('a');
 assert.equal((await status()).hp.a,100,'acquiring never attacks');
 await op('move','a',0,3.5);
 await lock('a',true);
 const start=await status();
 assert(start.projection.y-start.enemyBase>.15&&start.projection.y-start.enemyBase<.83,'projects above feet but below the slime head');
 assert.equal(start.markerPointer,'none','reticle never intercepts a thumb');
 assert(parseFloat(start.border)>0&&parseFloat(start.border)<=2,'reticle uses a thin stroke');
 const rgb=start.color.match(/\d+/g)?.map(Number);
 assert(rgb&&Math.max(...rgb.slice(0,3))>=230&&Math.max(...rgb.slice(0,3))-Math.min(...rgb.slice(0,3))>=45,'bright saturated reticle');
 const pad=await page.locator('#poiAnalogPad').boundingBox();
 assert(pad);
 const cdp=await ctx.newCDPSession(page),t=(x,y)=>({x:Math.round(x),y:Math.round(y),id:1,radiusX:4,radiusY:4,force:.7});
 const hold=t(pad.x+pad.width*.53,pad.y+pad.height*.5);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[hold]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[t(hold.x-46,hold.y)]});
 await page.waitForFunction(x=>window.__editorTest.combatLockQA.status().p.x<x-.25,start.p.x);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 const strafe=await status(),wanted=Math.atan2(-(start.p.x-strafe.p.x),start.p.z+3.5-strafe.p.z);
 assert(Math.abs(strafe.p.z-start.p.z)<.12,'the real thumb steers west independent of locked facing');
 assert(Math.abs(Math.atan2(Math.sin(strafe.heading-wanted),Math.cos(strafe.heading-wanted)))<.14,'uploaded avatar geometry still faces south toward held enemy');
 assert.deepEqual(strafe.camera,start.camera,'lock and movement do not turn the camera');
 await op('seed','b',1.5,0);
 await lock('a',true);
 await op('wall',true);
 await lock('a',false);
 await op('wall',false);
 await lock('a',true);
 // The same reachable-in-lock-range enemy cannot be hit by a short sword.
 const at=(await status()).at;
 await page.locator('#poiWalkAction').tap();
 await page.waitForFunction(at=>{const s=window.__editorTest.combatLockQA.status();return s.at>at&&!s.pending},at);
 assert.equal((await status()).hp.a,100,'lock never extends manual sword reach');
 await op('move','a',0,8.12);
 await lock('b');
 assert.deepEqual(errors,[]);
 console.log('PASS real mobile strafing without camera turn, torso reticle, sticky LOS and 8-tile release, no extended sword damage');
}finally{await browser?.close();await new Promise(r=>server.close(r))}
