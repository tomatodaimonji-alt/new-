import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const hook='  freeMovementPose:()=>({x:poiWalkViewX,z:poiWalkViewZ,level:poiWalkLevel}),';
function replaceOnce(text,from,to){assert.equal(text.split(from).length,2,'unique fixture anchor: '+from);return text.replace(from,to)}
let fixture=replaceOnce(html,hook,hook+`
  wandAimQA:{
   seed:({points,wall})=>{
    // Isolate authored actors and the autonomous spawners; keep real map ray/physics.
    poiMonsterStates.clear();
    if(window.__qaMeleeWall)world=world.filter(o=>o!==window.__qaMeleeWall);
    poiCombatLockReset();
    const x=poiWalkX,z=poiWalkZ,y=poiWalkLevel,now=performance.now();
    const add=([forward,side,floor=0])=>{
     const level=y+floor;
     const fx=x+forward,fz=z+side,ix=poiFreeCell(fx),iz=poiFreeCell(fz);
     const obj={x:ix,z:iz,y:level,rot:0,type:'monsterSlime'};
     const state=poiCombatActorMake(obj),cells=new Set([ix+','+iz]);
     state.hp=100;state.townOwned=true;
     state.actorFree={fromX:fx,fromZ:fz,x:fx,z:fz,start:now-400,ms:380,cells,endCells:cells,heading:0};
     poiMonsterStates.set(obj,state);
     return {obj,state};
    };
    window.__qaMeleeTargets=points.map(add);
    window.__qaMeleeWall=wall?{x:x+wall[0],y,z:z+wall[1],rot:0,type:'wall'}:null;
    if(window.__qaMeleeWall)world.push(window.__qaMeleeWall);
    poiMonsterMeshDirty=true;poiAimLockAt=0;
   },
   coverLock:()=>{
    const x=poiWalkX+1,z=poiWalkZ,y=poiWalkLevel;
    const wall={x,y,z,rot:0,type:'wall'};window.__qaMeleeWall=wall;world.push(wall);
   },
   status:()=>{
    const m=document.querySelector('#poiAimLockMarker');
    const slot=poiInventorySlots(poiHotbarRead())[1];
    return {armed:poiArmedWandIndex(),equipped:poiEquippedWeapon(),charges:slot?.charges,lockVisible:poiCombatLockProbe,
     hps:window.__qaMeleeTargets?.map(({state})=>state.hp),
     marker:{visible:!!m&&!m.hidden&&getComputedStyle(m).display!=='none',aim:m?.getAttribute('data-aim'),color:m?getComputedStyle(m).color:null,point:m?.style.transform},
     now:performance.now(),at:poiWalkActionStarted,ready:poiAttackReady,release:window.__qaBowReleased??null};
   }
  },`);
fixture=replaceOnce(fixture,' const p=poiWildPick(rng);',' const p=null;');
fixture=replaceOnce(fixture,'function poiWildRegionalFrame(now,rng){','function poiWildRegionalFrame(now,rng){return;');
fixture=replaceOnce(fixture,'function poiPlayerWeaponFlightBegin(shot,now){',
 'function poiPlayerWeaponFlightBegin(shot,now){if(shot.type==="equipWoodBow")window.__qaBowReleased=now;');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url==='/seed'?'<!doctype html><title>Wand aim QA</title>':fixture);
});
await new Promise((r,j)=>server.listen(0,'127.0.0.1',r).once('error',j));
let browser;
let checkpoint='launch browser';
const watchdog=setTimeout(()=>{
 console.error('Wand/Bow browser stalled at: '+checkpoint);
 process.exit(1);
},65000);
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const base='http://127.0.0.1:'+server.address().port;
 const ctx=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.setDefaultTimeout(14000);
 checkpoint='seed and launch app';
 await page.goto(base+'/seed');
 await page.evaluate(()=>{
  const slots=Array(27).fill(null);
  slots[0]={type:'equipWoodSword',count:1};
  slots[1]={type:'fireWand',count:1,charges:5};
  slots[2]={type:'equipWoodBow',count:1};
  localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weaponDurabilityVersion:2,weapon:'equipWoodSword',potions:0,slots}));
  localStorage.setItem('world-workshop-town-clock-v1',JSON.stringify({version:1,gameMs:575000}));
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:102,z:93,y:0,facing:1},townLayout:5,townMapHeight:128,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 });
 await page.goto(base+'/?resume=1&test=1');
 await page.waitForFunction(()=>window.__editorTest?.facility()?.active&&window.pineStartup&&!pineStartup.loading);
 await page.waitForFunction(()=>document.querySelector('#viewWrap').hasAttribute('data-analog-play'));
 await page.locator('#pineStartupCover').waitFor({state:'hidden'});
 const read=()=>page.evaluate(()=>window.__editorTest.wandAimQA.status());
 const seed=points=>page.evaluate(points=>window.__editorTest.wandAimQA.seed({points}),points);
 const slot=i=>page.locator('#poiHotbar [data-hotbar-slot="'+i+'"]');
 const active=i=>page.waitForFunction(i=>window.__editorTest.wandAimQA.status().armed===i,i);
 await seed([[.8,0]]);
 await page.waitForFunction(()=>window.__editorTest.wandAimQA.status().marker.visible);
 const normal=await read();assert.notEqual(normal.marker.aim,'wand');
 checkpoint='select wand with live torso lock';
 await slot(1).tap();await active(1);
 // Wait for the renderer to apply the new mode, with bounded real timers.
 await page.waitForFunction(()=>{const m=window.__editorTest.wandAimQA.status().marker;return m.visible&&m.aim==='wand'},null,{polling:35,timeout:4000});
 const armed=await read();
 assert.equal(armed.marker.aim,'wand','tapping the actual fire-wand shortcut changes the visible cursor to wand aim');
 assert(armed.marker.visible);
 assert.notEqual(armed.marker.color,normal.marker.color,'wand mode is visually distinct on the live cursor, not just metadata');
 const markerXY=point=>[...point.matchAll(/(-?[0-9]+)px/g)].map(m=>Number(m[1]));
 const [nx,ny]=markerXY(normal.marker.point),[ax,ay]=markerXY(armed.marker.point);
 assert(Math.hypot(nx-ax,ny-ay)<=4,'center remains on the same torso, allowing its idle bob');
 assert.equal(armed.charges,5);assert.deepEqual(armed.hps,[100]);
 await slot(1).tap();await active(null);
 await page.waitForFunction(()=>{const m=window.__editorTest.wandAimQA.status().marker;return m.visible&&m.aim!=='wand'});
 await slot(1).tap();await active(1);
 checkpoint='occluded wand lock';
 await page.evaluate(()=>window.__editorTest.wandAimQA.coverLock());
 await page.waitForFunction(before=>{
  const s=window.__editorTest.wandAimQA.status(),m=s.marker;
  return s.lockVisible===false&&m.visible&&m.aim==='wand'&&m.point!==before;
 },armed.marker.point);
 assert.equal((await read()).armed,1,'occlusion uses the wand free-aim fallback without disarming');
 await slot(1).tap();await active(null);
 checkpoint='empty aimed cue and equip bow';
 await seed([]);
 await page.waitForFunction(()=>!window.__editorTest.wandAimQA.status().marker.visible);
 await slot(1).tap();await active(1);
 await page.waitForFunction(()=>{const m=window.__editorTest.wandAimQA.status().marker;return m.visible&&m.aim==='wand'});
 assert.equal((await read()).charges,5);
 await slot(2).tap();await active(null);
 await page.waitForFunction(()=>{const s=window.__editorTest.wandAimQA.status();return s.equipped==='equipWoodBow'&&!s.marker.visible&&s.marker.aim!=='wand'});
 checkpoint='bow release on real browser clock';
 const before=await read();
 await page.locator('#poiWalkAction').tap();
 await page.waitForFunction(before=>window.__editorTest.wandAimQA.status().at>before,before.at,{polling:25,timeout:3500});
 const wind=await read();
 assert(Math.abs(wind.ready-wind.at-1030)<.001,'shorter wind-up does not reduce the existing cooldown');
 await page.waitForFunction(()=>window.__editorTest.wandAimQA.status().release!==null,null,{polling:25,timeout:3500});
 const fired=await read(),elapsed=fired.release-wind.at;
 // The real RAF can paint a little late when the runner is loaded. The
 // lower bound proves no early release, the upper bound separates the old
 // 650ms wind-up with headroom; the VM covers the exact 324/325 boundary.
 assert(elapsed>=325&&elapsed<600,'real release expected after the 325ms wind-up but before old 650ms, got '+elapsed.toFixed(1)+'ms');
 assert.deepEqual(errors,[]);
 console.log('PASS real touch fire-wand shortcut changes live cursor with and without enemy, clears safely, and real bow release halves while cooldown stays unchanged');
}finally{await browser?.close();await new Promise(r=>server.close(r));clearTimeout(watchdog)}
