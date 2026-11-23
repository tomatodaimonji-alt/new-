import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const axe='equipNorthMinotaurAxe';
function inject(s,a,b){assert.equal(s.split(a).length,2,a);return s.replace(a,b)}
const api='  freeMovementPose:()=>({x:poiWalkViewX,z:poiWalkViewZ,level:poiWalkLevel}),';
let fixture=inject(html,api,api+`
  nativeNorthAxe:{
   prep:()=>{
    const [o,s]=[...poiMonsterStates].find(([o,s])=>o.type==='monsterNorthMinotaur'&&o.x===64&&o.z===13&&o.y===-1&&s.hp>0)||[];
    if(!o)throw Error('original boss, not a replacement, must be live');
    const now=performance.now();s.hp=28;s.northOpenUntil=now+8500;s.nextAttack=now+8500;poiMonsterMeshDirty=true;
    window.__qaQuietBull=false;
   },
   targets:()=>{
    poiEnemyCancelPlayer();poiMonsterStates.clear();poiMonsterActorActive.clear();poiCombatLockReset();
    const x=poiWalkX,z=poiWalkZ,y=poiWalkLevel,now=performance.now();
    window.__qaNorthAxeTargets=[[.8,0],[1.2,-1.5],[2.36,-.72],[1.7,1.4],[-.72,.59],[2.60,0]].map(([dx,dz])=>{
     const cx=x+dx,cz=z+dz,ix=poiFreeCell(cx),iz=poiFreeCell(cz);
     const o={x:ix,z:iz,y,type:'monsterSlime',rot:0},s=poiCombatActorMake(o),cells=new Set([ix+','+iz]);
     s.hp=90;s.townOwned=true;s.actorFree={fromX:cx,fromZ:cz,x:cx,z:cz,start:now-500,ms:380,cells,endCells:cells,heading:0};
     poiMonsterStates.set(o,s);return s;
    });
    world.push({x:x+1,z:z+1,y,type:'stonewall',rot:0});facilityInvalidateScenes();
    poiMonsterMeshDirty=true;window.__qaNorthAxeHit=[];window.__qaNorthAxeHeld=[];
   },
   read:()=>{
    const k=poiHotbarRead(),type='equipNorthMinotaurAxe';
    const s=[...poiMonsterStates].find(([o])=>o.type==='monsterNorthMinotaur'&&o.x===64&&o.z===13&&o.y===-1)?.[1];
    const items=poiInventorySlots(k).flatMap((c,i)=>c?.type===type?[{i,...c}]:[]);
    return {now:performance.now(),at:poiWalkActionStarted,ready:poiAttackReady,pending:!!poiPlayerWeaponPending,
     boss:s?.hp??null,position:{x:poiWalkX,z:poiWalkZ,y:poiWalkLevel},weapon:poiEquippedWeapon(),items,
     awarded:k.northMinotaurAxeAwarded===true,dead:k.dungeonPopulation?.dead?.['northFort.minotaur'],
     ground:(k.armedDrops??[]).filter(p=>p.type===type),rendered:window.__qaNorthAxeGround??[],
     hps:window.__qaNorthAxeTargets?.map(s=>s.hp),hits:window.__qaNorthAxeHit??[],held:window.__qaNorthAxeHeld??[]};
   }
  },`);
fixture=inject(fixture,' const p=poiWildPick(rng);',' const p=null;');
fixture=inject(fixture,'function poiWildRegionalFrame(now,rng){','function poiWildRegionalFrame(now,rng){return;');
const bossTick='function poiNorthMinotaurFrame(obj,s,now){';
fixture=inject(fixture,bossTick,bossTick+'if(window.__qaQuietBull)return false;');
const ground='     const item=mesh();deco(item,d.type,0,0,0,0);';
fixture=inject(fixture,ground,ground+`
     if(d.type==='equipNorthMinotaurAxe'&&item.p.length)(window.__qaNorthAxeGround??=[]).push({x:d.x,z:d.z,vertices:item.p.length/3});`);
const prop='  const prop=mesh();deco(prop,weapon,0,0,0,0);';
fixture=inject(fixture,prop,prop+`
  if(weapon==='equipNorthMinotaurAxe'&&pose&&window.__qaNorthAxeHeld)window.__qaNorthAxeHeld.push({phase:pose.axePhase,vertices:prop.p.length/3});`);
const damage='function poiPlayerDamageTarget(monster,x,z,amount,weapon,now,silent=false,atContact=false,source=null){';
fixture=inject(fixture,damage,damage+`
 if(weapon==='equipNorthMinotaurAxe'&&window.__qaNorthAxeHit)window.__qaNorthAxeHit.push({now,amount,x,z});`);
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<!doctype html><title>Native fort axe QA</title>':fixture)});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const origin='http://127.0.0.1:'+server.address().port;
let browser,checkpoint='launch';
const watchdog=setTimeout(()=>{console.error('Native fort axe stalled: '+checkpoint);process.exit(1)},68000);
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const ctx=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:.6,isMobile:true,hasTouch:true});
 const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(12000);
 const read=()=>p.evaluate(()=>window.__editorTest?.nativeNorthAxe?.read());
 const wait=(f,a=null,t=5000)=>p.waitForFunction(f,a,{polling:35,timeout:t});
 let cdp;
 try{
  await p.addInitScript(()=>{window.__qaQuietBull=true});
  await p.goto(origin+'/seed');
  await p.evaluate(()=>{
   const worn={head:null,torso:null,legs:null,feet:null};
   localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weapon:'equipWoodSword',potions:0,worn}));
   localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":330000}');
   localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
    position:{x:64,z:14,y:-1,facing:0},townLayout:5,townMapHeight:128,
    view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:-1,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
  });
  await p.goto(origin+'/?resume=1&test=1');
  const loaded=async()=>{
   await p.locator('#pineStartupCover').waitFor({state:'hidden'});
   await wait(()=>window.__editorTest?.facility()?.active&&document.querySelector('#viewWrap').hasAttribute('data-analog-play'));
  };
  await loaded();
  const action=p.locator('#poiWalkAction');
  const start=await read();assert(start.boss>0&&start.weapon==='equipWoodSword'&&!start.ground.length&&!start.items.length);
  checkpoint='real finishing hit';
  await p.evaluate(()=>window.__editorTest.nativeNorthAxe.prep());
  await action.tap();
  await wait(()=>{const s=window.__editorTest.nativeNorthAxe.read();return s.boss===0&&!s.pending});
  const defeated=await read();
  assert.equal(defeated.ground.length,1,'boss victory creates exactly one unique ground reward');
  assert.deepEqual(defeated.ground[0],{id:'north-minotaur-axe',type:axe,x:64,z:13,y:-1,durability:180});
  assert(defeated.awarded&&Number.isInteger(defeated.dead)&&!defeated.items.length,'first kill records claim and prevents spawning within the persistence window');
  await wait(()=>window.__editorTest.nativeNorthAxe.read().rendered.some(v=>v.vertices>30));
  checkpoint='reload before actual physical pickup';
  await p.reload();await loaded();
  const ground=await read();assert.equal(ground.boss,null);assert.deepEqual(ground.ground,defeated.ground);
  const pad=await p.locator('#poiAnalogPad').boundingBox();assert(pad);
  const thumb={id:1,x:Math.round(pad.x+pad.width/2),y:Math.round(pad.y+pad.height/2),radiusX:4,radiusY:4,force:.7};
  cdp=await ctx.newCDPSession(p);
  const touch=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
  await touch('touchStart',[thumb]);await touch('touchMove',[{...thumb,y:thumb.y-34}]);
  await wait(()=>window.__editorTest.nativeNorthAxe.read().items.length===1,null,3300);
  await touch('touchEnd',[]);
  const pickup=await read();
  assert.equal(pickup.items[0].durability,180);assert.equal(pickup.ground.length,0);
  assert.equal(pickup.weapon,'equipWoodSword','picking up does not auto-equip');
  await p.reload();await loaded();
  const carried=await read();assert.equal(carried.boss,null);assert.equal(carried.ground.length,0);
  assert.deepEqual(carried.items,pickup.items,'exact same single item persisted without a duplicate');
  const {i}=carried.items[0];assert(i<9);
  await p.locator('#poiHotbar [data-hotbar-slot="'+i+'"]').tap();
  await wait(()=>window.__editorTest.nativeNorthAxe.read().weapon==='equipNorthMinotaurAxe');
  checkpoint='real axe arc, wall and rear';
  await p.evaluate(()=>window.__editorTest.nativeNorthAxe.targets());
  const before=await read();
  await action.tap();
  await wait(at=>{const s=window.__editorTest.nativeNorthAxe.read();return s.at>at&&!s.pending},before.at,4500);
  const after=await read();
  assert.deepEqual(after.hps,[56,56,56,90,90,90],'one true sweep hits three clear front targets, not wall/rear/beyond range');
  assert.equal(after.hits.length,3);assert(after.hits.every(h=>h.amount===34&&h.now-after.at>=300));
  assert.equal(after.items[0].durability,179,'group sweep debits exactly one wear');
  assert.equal(after.items.length,1);assert.equal(after.ground.length,0);
  assert(Math.abs(after.ready-after.at-800)<.001);
  assert(after.held.some(v=>v.vertices>30),'real held axe model enters the player mesh');
  assert.deepEqual(errors,[]);
  console.log('PASS actual bull finishing strike, single persisted axe visually spawned/picked/equipped, true front arc and single wear');
 }catch(e){console.error(checkpoint,JSON.stringify(await read().catch(()=>null)),errors);throw e}
 finally{await cdp?.detach();await ctx.close()}
}finally{await browser?.close();await new Promise(r=>server.close(r));clearTimeout(watchdog)}
