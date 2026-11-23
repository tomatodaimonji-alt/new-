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
   read:()=>{
    const k=poiHotbarRead(),type='equipNorthMinotaurAxe';
    const s=[...poiMonsterStates].find(([o])=>o.type==='monsterNorthMinotaur'&&o.x===64&&o.z===13&&o.y===-1)?.[1];
    const items=poiInventorySlots(k).flatMap((c,i)=>c?.type===type?[{i,...c}]:[]);
    const enemies=[...poiMonsterStates].filter(([o])=>Number.isInteger(o.northReturnSlot)).map(([o,s])=>({
     slot:o.northReturnSlot,type:o.type,x:o.x,z:o.z,y:o.y,hp:s.hp
    })).sort((a,b)=>a.slot-b.slot);
    return {enemies,mask:k.northFortReturn,actorX:poiWalkViewX,actorZ:poiWalkViewZ,stepReady:poiWalkNextReady,now:performance.now(),at:poiWalkActionStarted,ready:poiAttackReady,pending:!!poiPlayerWeaponPending,
     boss:s?.hp??null,position:{x:poiWalkX,z:poiWalkZ,y:poiWalkLevel},weapon:poiEquippedWeapon(),items,
     awarded:k.northMinotaurAxeAwarded===true,dead:k.dungeonPopulation?.dead?.['northFort.minotaur'],
     ground:(k.armedDrops??[]).filter(p=>p.type===type),rendered:window.__qaNorthAxeGround??[],
     hits:window.__qaNorthAxeHit??[],staticMap:world.filter(o=>o.y===-1&&o.x>=57&&o.x<=67&&o.z>=14&&o.z<=25).map(o=>[o.x,o.z,o.type])};
   }
  },`);
fixture=inject(fixture,' const p=poiWildPick(rng);',' const p=null;');
fixture=inject(fixture,'function poiWildRegionalFrame(now,rng){','function poiWildRegionalFrame(now,rng){return;');
const bossTick='function poiNorthMinotaurFrame(obj,s,now){';
fixture=inject(fixture,bossTick,bossTick+'if(window.__qaQuietBull)return false;');
const ground='     const item=mesh();deco(item,d.type,0,0,0,0);';
fixture=inject(fixture,ground,ground+`
     if(d.type==='equipNorthMinotaurAxe'&&item.p.length)(window.__qaNorthAxeGround??=[]).push({x:d.x,z:d.z,vertices:item.p.length/3});`);
const damage='function poiPlayerDamageTarget(monster,x,z,amount,weapon,now,silent=false,atContact=false,source=null){';
fixture=inject(fixture,damage,damage+`
 if(weapon==='equipNorthMinotaurAxe'&&Number.isInteger(monster?.[0]?.northReturnSlot))
  (window.__qaNorthAxeHit??=[]).push({slot:monster[0].northReturnSlot,now,amount});`);
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
  const map=defeated.staticMap;
  assert.equal(defeated.mask,undefined,'kill/visible drop does not unlock the return encounter');
  assert.deepEqual(defeated.enemies,[]);
  const step=async(key)=>{
   await wait(()=>{const s=window.__editorTest.nativeNorthAxe.read();return s.now>=s.stepReady});
   await p.keyboard.press(key);
  };
  async function walk(key,z){
   await step(key);
   await wait(z=>window.__editorTest.nativeNorthAxe.read().position.z===z,z,3200);
  }
  checkpoint='neck before any pickup is genuine and empty';
  for(let z=15;z<=20;z++)await walk('ArrowDown',z);
  assert.deepEqual((await read()).enemies,[]);assert.equal((await read()).mask,undefined);
  for(let z=19;z>=14;z--)await walk('ArrowUp',z);
  checkpoint='real thumb picks up reward first';
  const pad=await p.locator('#poiAnalogPad').boundingBox(),button=await action.boundingBox();assert(pad&&button);
  const thumb={id:1,x:Math.round(pad.x+pad.width/2),y:Math.round(pad.y+pad.height/2),radiusX:4,radiusY:4,force:.7};
  cdp=await ctx.newCDPSession(p);
  const touch=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
  const move=y=>touch('touchMove',[{...thumb,y:thumb.y+y}]);
  await touch('touchStart',[thumb]);await move(-33);
  await wait(()=>window.__editorTest.nativeNorthAxe.read().items.length===1,null,3300);
  await touch('touchEnd',[]);
  const owned=await read();assert.equal(owned.mask,0);assert(!owned.ground.length&&owned.items.length===1);
  assert.equal(owned.weapon,'equipWoodSword','axe is not force-equipped');
  assert.deepEqual(owned.enemies,[],'pickup alone does not put foes next to the player');
  const slot=owned.items[0].i;assert(slot<9);
  await p.locator('#poiHotbar [data-hotbar-slot="'+slot+'"]').tap();
  await wait(()=>window.__editorTest.nativeNorthAxe.read().weapon==='equipNorthMinotaurAxe');
  while((await read()).position.z<17)await walk('ArrowDown',(await read()).position.z+1);
  const walkX=async(key,x)=>{
   await step(key);await wait(x=>window.__editorTest.nativeNorthAxe.read().position.x===x,x,2900);
  };
  checkpoint='return activates the optional west alcove';
  await wait(()=>window.__editorTest.nativeNorthAxe.read().enemies.length===3,null,3400);
  const seen=await read();assert.deepEqual(seen.enemies.map(({slot,type,x,z,y})=>[slot,type,x,z,y]),[
   [0,'monsterGoblin',57,16,-1],[1,'monsterGoblin',59,16,-1],[2,'monsterGoblin',61,16,-1]
  ]);
  assert.deepEqual(seen.staticMap,map,'only runtime foes, no rooms or objects written onto the map');
  assert.deepEqual(seen.enemies.map(a=>a.hp),[55,55,55]);
  for(let x=63;x>=59;x--)await walkX('ArrowLeft',x);
  await wait(()=>window.__editorTest.nativeNorthAxe.read().actorX<=59.18,null,1500);
  checkpoint='real reward axe sweeps spread foes';
  // At x59,z17 the center goblin is the nearest lock and the two
  // diagonals are both in the genuine north-facing axe arc.
  await p.touchscreen.tap(button.x+button.width/2,button.y+button.height/2);
  await wait(prior=>{const s=window.__editorTest.nativeNorthAxe.read();return s.at>prior&&!s.pending},owned.at,4600);
  const struck=await read(),unique=[...new Set(struck.hits.map(v=>v.slot))].sort();
  assert.deepEqual(unique,[0,1,2],'actual equipped reward axe makes one sweep contact with all three distinct spawned lanes');
  assert.equal(struck.hits.length,3);assert(struck.hits.every(h=>h.amount===34));
  assert.equal(struck.items[0].durability,owned.items[0].durability-1);
  assert.deepEqual(struck.enemies.map(a=>a.hp),[21,21,21],'all three native bodies took real damage and remain alive so exit proves optionality');
  checkpoint='escape via clear central route with encounter opponents alive';
  await walk('ArrowDown',18);await walk('ArrowDown',19);
  for(let x=60;x<=64;x++)await walkX('ArrowRight',x);
  for(let z=20;z<=24;z++)await walk('ArrowDown',z);
  await step('ArrowDown');
  await wait(()=>window.__editorTest.nativeNorthAxe.read().position.y===0,null,3800);
  const up=await read();assert.equal(up.mask,7,'normal exit retires optional remainder without requiring a kill');
  assert.equal(up.items.length,1);assert(!up.ground.length);
  await p.reload();await loaded();
  const restored=await read();assert.equal(restored.position.y,0);assert.equal(restored.mask,7);assert.deepEqual(restored.enemies,[]);
  assert.deepEqual(errors,[]);
  console.log('PASS real optional North Fort encounter only after genuine axe pickup, spread contacts, and normal exit with foes still alive');
 }catch(e){console.error(checkpoint,JSON.stringify(await read().catch(()=>null)),errors);throw e}
 finally{await cdp?.detach();await ctx.close()}
}finally{await browser?.close();await new Promise(r=>server.close(r));clearTimeout(watchdog)}
