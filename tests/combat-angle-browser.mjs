import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const raw=readFileSync(process.argv[2]??'world-editor.html','utf8');
const anchor='  freeMovementPose:()=>({x:poiWalkViewX,z:poiWalkViewZ,level:poiWalkLevel}),';
assert.equal(raw.split(anchor).length,2);
const npcAction='function poiTownDialogueAction(now){';
assert.equal(raw.split(npcAction).length,2);
const fixture=raw.replace(npcAction,npcAction+`
 if(window.__qaNpcInteracting){window.__qaNpcConfirmed=true;return true}
`).replace(anchor,anchor+`
  combatQA:{
   status:()=>({arm:poiArmedWandIndex(),lock:poiAimLocked?.id===window.__qaEnemy,
    hp:window.__qaEnemyState?.hp,active:poiPlayerWeaponPending?.type,
    marker:!$('poiAimLockMarker')?.hidden,angle:poiAimAttack?.heading,
    projectile:poiPlayerWeaponVisual?.type,charge:poiInventorySlots(poiHotbarRead())[2]?.charges,npcConfirmed:!!window.__qaNpcConfirmed}),
   npcGate:on=>{window.__qaNpcInteracting=on},
   seed:(mode)=>{
    if(!window.__qaCombatLaneReady){poiMonsterStates.clear();poiCombatLockReset();window.__qaCombatLaneReady=true}
    if(window.__qaEnemy)poiMonsterStates.delete(window.__qaEnemy);
    poiAimLockAt=0;
    const now=performance.now(),x=poiWalkX,z=poiWalkZ,y=poiWalkLevel;
    if(window.__qaWall){world=world.filter(v=>v!==window.__qaWall);window.__qaWall=null}
    if(!window.__qaHeading)window.__qaHeading=[[2,1],[-2,1],[2,-1],[-2,-1]].find(([dx,dz])=>
     poiAimWallLimit({x,z},poiAimUnit(dx,dz),Math.hypot(dx,dz),poiAimWall({y}))>=Math.hypot(dx,dz));
    if(!window.__qaHeading)return null;
    const [hx,hz]=window.__qaHeading,offset=mode==='melee'?[Math.sign(hx)*.76,Math.sign(hz)*.43]:[hx,hz];
    if(mode==='wall'){window.__qaWall={x:x+Math.sign(hx),z,y,type:'wall',rot:0};world.push(window.__qaWall)}
    const px=x+offset[0],pz=z+offset[1],cx=poiFreeCell(px),cz=poiFreeCell(pz);
    const o={x:cx,z:cz,y,type:'monsterSlime',rot:0},cells=new Set([cx+','+cz]);
    const v={x:cx,z:cz,fromX:cx,fromZ:cz,hp:100,townOwned:true,moveStarted:-1000,nextAttack:Infinity,facing:0,
     actorFree:{fromX:px,fromZ:pz,x:px,z:pz,start:now-400,ms:380,cells,endCells:cells,heading:0}};
    poiMonsterStates.set(o,v);poiMonsterMeshDirty=true;window.__qaEnemy=o;window.__qaEnemyState=v;return Math.atan2(-offset[0],offset[1]);
   }
  },`).replace(' const p=poiWildPick(rng);',' const p=null;');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','no-store');
 res.end(req.url==='/seed'?'<!doctype html><title>Fixture</title>':fixture);
});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const origin='http://127.0.0.1:'+server.address().port;
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:740,height:390},isMobile:true,hasTouch:true});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/seed');
 await page.evaluate(()=>{
  const slots=Array(27).fill(null);slots[0]={type:'equipWoodSword',count:1};slots[2]={type:'fireWand',count:1,charges:2};
  localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weapon:'equipWoodSword',potions:0,slots}));
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:102,z:93,y:0,facing:2},townLayout:5,townMapHeight:128,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 });
 await page.goto(origin+'/?resume=1&test=1');
 await page.waitForFunction(()=>window.__editorTest?.facility?.()?.active&&window.pineStartup&&!pineStartup.loading);
 const status=()=>page.evaluate(()=>window.__editorTest.combatQA.status());
 const tap=async selector=>{const control=page.locator(selector);await control.waitFor({state:'visible'});const b=await control.boundingBox();
  assert(b,selector+' has a physical touch target');await page.touchscreen.tap(b.x+b.width/2,b.y+b.height/2);};
 const seed=mode=>page.evaluate(mode=>window.__editorTest.combatQA.seed(mode),mode);
 const rangedAngle=await seed('far');assert(Number.isFinite(rangedAngle),'real world angled lane');
 assert.equal((await status()).charge,2);
 await page.waitForFunction(()=>window.__editorTest.combatQA.status().lock);
 assert.equal((await status()).hp,100,'wide encounter lock does not attack or change charge');
 const meleeAngle=await seed('melee');
 await page.waitForFunction(()=>window.__editorTest.combatQA.status().lock);
 assert.equal((await status()).hp,100,'lock never attacks on its own');
 await tap('#poiWalkAction');
 await page.waitForFunction(()=>window.__editorTest.combatQA.status().hp<100);
 assert(Math.abs((await status()).angle-meleeAngle)<.01);
 const before=await page.evaluate(()=>localStorage.getItem('world-workshop-hotbar-v1'));
 await tap('#poiBagToggle');
 await tap('#poiHotbar [data-hotbar-slot="2"]');
 const armButton=page.locator('#poiItemDetail [data-item-detail-action="use"]');
 await armButton.waitFor({state:'visible'});
 assert.equal(await armButton.textContent(),'構える');
 await tap('#poiItemDetail [data-item-detail-action="use"]');
 await page.waitForFunction(()=>window.__editorTest.combatQA.status().arm===2);
 assert.equal((await status()).charge,2);
 assert.equal(await page.evaluate(()=>localStorage.getItem('world-workshop-hotbar-v1')),before,'arming writes nothing');
 await seed('wall');
 await page.waitForTimeout(160);
 assert.equal((await status()).lock,false,'wall breaks valid wand lock');
 await seed('far');
 await page.waitForFunction(()=>window.__editorTest.combatQA.status().lock);
 assert.equal((await status()).hp,100);
 await page.waitForTimeout(320);
 await page.evaluate(()=>window.__editorTest.combatQA.npcGate(true));
 await tap('#poiWalkAction');
 assert.equal((await status()).npcConfirmed,true,'existing dialogue handling has priority over armed ranged attack');
 assert.equal((await status()).charge,2);
 await page.evaluate(()=>window.__editorTest.combatQA.npcGate(false));
 await tap('#poiWalkAction');
 const shot=await status();assert.equal(shot.charge,1);assert.equal(shot.projectile,'fireWand');
 assert(Math.abs(shot.angle-rangedAngle)<.01);
 await page.waitForFunction(()=>window.__editorTest.combatQA.status().hp===66);
 assert.equal((await status()).charge,1);
 assert.deepEqual(errors,[]);
 console.log('PASS 360° melee, encounter lock, clear line of sight, transient wand arm and charged angular cast');
}finally{await browser?.close();await new Promise(r=>server.close(r))}
