import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
let h=readFileSync(process.argv[2]??'world-editor.html','utf8');
function inject(a,b){assert.equal(h.split(a).length,2,a);h=h.replace(a,b)}
const testAPI="if(facilityParams.get('test')==='1')window.__editorTest={";
inject(testAPI,testAPI+`
 companionCombatQA:{
  frame:()=>render(),
  move:(from,to)=>poiInventoryMove({zone:'bag',index:from},{zone:'bag',index:to}),
  bound:index=>({
   drop:poiInventoryDrop({zone:'bag',index}),
   actions:poiItemDetailActions('bag',poiInventoryCell(poiHotbarRead(),{zone:'bag',index}),true),
   traded:POI_NPC_TRADE_CONSUMABLES.includes('slimeSoul')
  }),
  add:(type,x,z,hp,label)=>{
   if(!poiWalkCanStep(x,z)||poiMonsterAt(x,z,true)||(poiWalkX===x&&poiWalkZ===z))return false;
   const o={type,x,z,y:poiWalkLevel,rot:0},s=poiCombatActorMake(o);
   // Select a legitimate live opponent and initial health; neither battle
   // resolver, companion HP nor player contact is fabricated.
   s.hp=hp;s.nextAttack=performance.now()+60000;poiMonsterStates.set(o,s);
   (window.__companionFoes??={})[label]={o,s};poiMonsterMeshDirty=true;return true;
  },
  retire:label=>{
   const a=window.__companionFoes?.[label];if(!a)return;
   poiMonsterStates.delete(a.o);poiEnemyPending.delete(a.s);poiMonsterMeshDirty=true;
  },
  hostile:()=>{
   const a=poiCompanionActor;if(!a||poiWalkX!==a.x||poiWalkZ!==a.z)return null;
   for(const [dx,dz] of [[-1,0],[0,1],[1,0],[0,-1]]){
    const x=a.x+dx,z=a.z+dz;
    if(!poiWalkCanStep(x,z,a.x,a.z)||!poiCompanionAttackClear({x,z},a,a.y))continue;
    if(!poiWalkCanStep(a.x-dx,a.z-dz,a.x,a.z))continue;
    const o={type:'monsterSkeleton',x,z,y:a.y,rot:0},s=poiCombatActorMake(o);
    poiMonsterStates.set(o,s);poiMonsterMeshDirty=true;
    if(poiEnemyBeginPlayer(o,s,performance.now())){
     (window.__companionFoes??={}).hostile={o,s};
     const q=s.playerAttack;return {from:[x,z],to:[q.x,q.z],dx,dz,hit:q.hit,pending:q.pending};
    }
    poiMonsterStates.delete(o);
   }
   return null;
  },
  inspect:()=>{
   const kit=poiHotbarRead(),slots=poiInventorySlots(kit),a=poiCompanionActor,s=poiCompanionSnapshot(performance.now());
   return {...s,index:slots.findIndex(c=>c?.type==='slimeSoul'),slots:slots.filter(c=>c?.type==='slimeSoul').length,
    player:[poiWalkX,poiWalkZ],facing:poiWalkFacing,playerHP:poiPlayerHP,clock:performance.now(),pickup:window.__companionPickup??0,
    started:poiWalkActionStarted,ready:poiAttackReady,weaponPending:!!poiPlayerWeaponPending,
    action:$('poiWalkAction')?.textContent,bag:$('poiBagPanel')?.hidden,
    damage:window.__companionDamage??[],training:window.__companionFoes?.training?.s.hp??null,
    trainingPosition:window.__companionFoes?.training?{x:window.__companionFoes.training.s.x,z:window.__companionFoes.training.s.z}:null,
    rendered:a?!!poiCompanionMesh:false,worn:poiArmorWorn(kit),wornHealth:kit.wornDurability,
    carriedCoat:slots.find(c=>c?.type==='starterTunic'),toolshop:kit.toolshopSupply?.stock,
    breaks:poiMonsterBreakSnapshot(performance.now()),shatterPose:window.__companionShatterPose??null,shatterMesh:window.__companionShatterMesh??null,
    saved:JSON.parse(localStorage.getItem(POI_HOTBAR_KEY)||'null')};
  }
 },
`);
const raf=' requestAnimationFrame(render);';
inject(raf,' if(!window.__companionManualFrames)requestAnimationFrame(render);');
const roll='function poiCompanionMonsterDefeated(o,s,now,debris,rng=Math.random){';
inject(roll,roll+"\n rng=()=>.01; // deterministic acceptance of an actual first kill in this test");
const wild='function poiWildSpawnFrame(now,rng=Math.random){';
inject(wild,wild+'return;');
const sound='function poiSound(kind,weapon=null,defeated=false,atContact=false,targetType=null){';
inject(sound,sound+"\n if(kind==='item-pickup'&&weapon==='slimeSoul')window.__companionPickup=(window.__companionPickup||0)+1;");
const hurt='function poiCompanionHurt(damage,now){';
inject(hurt,hurt+"\n if(poiCompanionActor)window.__companionShatterPose=poiCompanionWorldPose(poiCompanionActor,now);");
const debrisStart='function poiMonsterAppendDebris(m,e,t,fade=1){';
inject(debrisStart,debrisStart+'\n const shatterBefore=m.p.length;');
const debrisEnd='\n}\nfunction poiMonsterDrawBreaks(';
inject(debrisEnd,'\n if(e.type==="monsterSlime"&&!e.actor&&!e.soulFx&&m.p.length>shatterBefore)window.__companionShatterMesh={x:e.x,z:e.z,vertices:(m.p.length-shatterBefore)/3};'+debrisEnd);
const damage='function poiPlayerDamageTarget(monster,x,z,amount,weapon,now,silent=false,atContact=false,source=null){';
inject(damage,damage+"\n if(source?.companion)(window.__companionDamage??=[]).push({kind:monster[0].type,amount,before:monster[1].hp});");
for(const [,script] of h.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(script);
if(process.env.COMPANION_QA_SYNTAX_ONLY){console.log('full instrumented native scripts parse');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>Companion game QA</title>':h)});
await new Promise((ok,no)=>server.listen(0,'127.0.0.1',ok).once('error',no));
const origin='http://127.0.0.1:'+server.address().port;
let browser,last,phase='launch';
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:.75});
 const page=await context.newPage(),errors=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install({time:new Date('2026-04-01T10:00:00Z')});
 await page.goto(origin+'/seed');
 await page.evaluate(()=>{
  const slots=Array(27).fill(null);slots[0]={type:'equipWoodSword',count:1,durability:90};
  slots[2]={type:'equipIronSword',count:1,durability:88};
  slots[10]={type:'starterTunic',count:1,durability:41};
  const worn={torso:'armorMerchantCoat',head:'starterCap',legs:'starterTrousers',feet:'starterBoots'};
  const wornDurability={torso:43},toolshopSupply={version:1,stock:5,delivered:0,cargo:0};
  localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weaponDurabilityVersion:2,weapon:'equipWoodSword',
   slots,gold:3,potions:0,worn,wornDurability,toolshopSupply}));
  localStorage.setItem('world-workshop-town-clock-v1',JSON.stringify({version:1,gameMs:1000*500}));
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,position:{x:102,z:93,y:0,facing:1},townLayout:5,townMapHeight:128,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 });
 const open=async()=>{
  await page.goto(origin+'/?resume=1&test=1',{waitUntil:'domcontentloaded',timeout:45000});
  await page.locator('#pineStartupCover').waitFor({state:'hidden',timeout:35000});
  await page.waitForFunction(()=>window.__editorTest?.facility()?.active,{},{polling:50,timeout:30000});
 };
 await open();
 const cdp=await context.newCDPSession(page);
 const tap=async sel=>{
  const b=await page.locator(sel).boundingBox();assert(b,'visible tap target '+sel);
  const pt={x:b.x+b.width/2,y:b.y+b.height/2,id:1};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[pt]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 };
 const see=async()=>last=await page.evaluate(()=>window.__editorTest.companionCombatQA.inspect());
 const frame=()=>page.evaluate(()=>window.__editorTest.companionCombatQA.frame());
 async function advance(ms){await page.clock.fastForward(ms);await frame();return see()}
 async function until(fn,ms=4200){
  for(let i=0;i<ms/38;i++){const v=await advance(38);if(fn(v))return v}
  throw Error('condition not reached: '+JSON.stringify(last));
 }
 const key=(dx,dz)=>dx>0?'ArrowRight':dx<0?'ArrowLeft':dz>0?'ArrowDown':'ArrowUp';
 await page.clock.pauseAt((await page.evaluate(()=>Date.now()))+1500);
 await page.evaluate(()=>{window.__companionManualFrames=true});
 phase='real defeat, leave original tile while orb is flying';
 assert(await page.evaluate(()=>window.__editorTest.companionCombatQA.add('monsterSlime',103,93,1,'victim')));
 await tap('#poiWalkAction');
 await until(a=>!!a.flight&&a.slots===0);
 await page.keyboard.press('ArrowUp');
 await until(a=>a.player[1]===92&&a.slots===0);
 let q=await until(a=>a.slots===1);
 assert.equal(q.pending,null);assert.equal(q.pickup,1);assert.equal(q.hp,36);
 const unchanged=(s)=>{
  assert.equal(s.worn.torso,'armorMerchantCoat');assert.equal(s.wornHealth.torso,43);
  assert.deepEqual(s.carriedCoat,{type:'starterTunic',count:1,durability:41});assert.equal(s.toolshop,5);
  assert.deepEqual(s.saved.slots[2],{type:'equipIronSword',count:1,durability:88});
 };
 unchanged(q);
 const bind=await page.evaluate(()=>window.__editorTest.companionCombatQA.bound(0));
 assert.deepEqual(bind,{drop:{ok:false,reason:'bound'},actions:['use','back'],traded:false});
 assert(await page.evaluate(()=>window.__editorTest.companionCombatQA.move(0,1).ok));
 q=await see();assert.equal(q.index,10);assert.equal(q.hp,36);assert.equal(q.saved.slots[9].type,'starterTunic');unchanged(q);
 assert(await page.evaluate(()=>window.__editorTest.companionCombatQA.move(1,0).ok));
 assert.equal((await advance(680)).pickup,1);
 phase='summon through the real item detail panel';
 const cell= '#poiBagGrid [data-bag-slot="0"]',action='#poiItemDetail [data-item-detail-action="use"]';
 const closeBag=async()=>{
  await page.keyboard.press('Escape');
  assert(await page.locator('#poiBagPanel').evaluate(el=>el.hidden),'real Escape closed the pouch');
 };
 await tap('#poiBagToggle');
 async function detail(){
  await tap(cell);await advance(360);
  assert(await page.locator('#poiItemDetail').evaluate(el=>el.open));
 }
 async function use(label){
  await detail();assert.match(await page.locator(action).innerText(),label);await tap(action);await advance(38);
 }
 await use(/仲間を呼ぶ/);
 assert(await page.locator('#poiBagPanel').evaluate(el=>!el.hidden));
 await closeBag();q=await until(a=>!!a.actor&&a.rendered);
 assert.equal(q.hp,36);assert.equal(q.saved.companionSoul.active,'slimeSoul');
 phase='player strike followed by real friendly HP damage';
 // Return to the already-proven legal east melee lane rather than
 // assuming that the adjacent north cell also has a clear combat ray.
 await page.keyboard.press('ArrowDown');q=await until(a=>a.player[0]===102&&a.player[1]===93);
 await advance(220);q=await see();
 assert(await page.evaluate(()=>window.__editorTest.companionCombatQA.add('monsterSlime',103,93,35,'training')));
 const oldSwing=q.started;
 await tap('#poiWalkAction');q=await see();
 assert(q.started>oldSwing&&q.weaponPending,'new genuine action began: '+JSON.stringify(q));
 await until(a=>a.training<35,1400);
 q=await until(a=>a.damage.length>=1,3600);
 assert.equal(q.damage[0].amount,6);
 assert(q.damage[0].before<35);assert(q.training<q.damage[0].before,'actual hostile HP changed');
 await page.evaluate(()=>window.__editorTest.companionCombatQA.retire('training'));await advance(840);
 phase='hostile real announced strike, player dodges while ally remains in covered tile';
 async function hostileContact(){
  let a=await until(a=>a.actor?.pose.t===1);
  const ally=[a.actor.x,a.actor.z],dx=ally[0]-a.player[0],dz=ally[1]-a.player[1];
  assert(Math.abs(dx)+Math.abs(dz)<=2,'ally follows within close walking range: '+JSON.stringify(a));
  if(dx){await page.keyboard.press(key(Math.sign(dx),0));await advance(210)}
  if(dz){await page.keyboard.press(key(0,Math.sign(dz)));await advance(210)}
  a=await see();assert.deepEqual(a.player,ally);
  const shot=await page.evaluate(()=>window.__editorTest.companionCombatQA.hostile());
  assert(shot?.pending&&shot.hit>a.clock);assert.deepEqual(shot.to,ally);
  await page.keyboard.press(key(-shot.dx,-shot.dz));
  const hp=a.playerHP,allyHP=a.hp;
  a=await until(s=>s.hp!==allyHP,1800);
  assert.equal(a.playerHP,hp,'dodge preserves the original player damage rule');
  await page.evaluate(()=>window.__editorTest.companionCombatQA.retire('hostile'));await advance(190);
  return a;
 }
 q=await hostileContact();assert(q.hp>0&&q.hp<36);assert.equal(q.breaks.length,0,'nonlethal damage has no debris');
 phase='dismiss, inspect durability, return using the actual pouch';
 await tap('#poiBagToggle');await detail();
 assert.match(await page.locator('#poiItemDetailDescription').innerText(),new RegExp(q.hp+' / 36'));
 assert.equal(await page.locator(cell+' .poiDurabilityMeter').getAttribute('data-durability-percent'),String(Math.ceil(q.hp/36*100)));
 unchanged(q);
 assert.match(await page.locator(action).innerText(),/仲間に指示/);
 await tap(action);let state=await advance(48);assert(state.actor,'opening command menu does not change the real ally');
 assert(await page.locator('#poiCompanionCommands').evaluate(el=>el.open));
 await tap('#poiCompanionCommands [data-companion-command="dismiss"]');
 state=await advance(48);assert.equal(state.actor,null);assert.equal(state.hp,q.hp);assert.equal(state.breaks.length,0,'dismiss has no debris');
 await use(/仲間を呼ぶ/);await closeBag();state=await until(a=>!!a.actor);assert.equal(state.hp,q.hp);
 assert.equal(state.pickup,1);
 phase='real reload restores exact remaining durability and chosen summon';
 const durable=state.hp;
 await page.clock.resume();await open();
 await page.clock.pauseAt((await page.evaluate(()=>Date.now()))+1500);
 await page.evaluate(()=>{window.__companionManualFrames=true});
 state=await until(a=>!!a.actor&&a.rendered);
 assert.equal(state.hp,durable);assert.equal(state.pickup,0,'reloading does not replay pickup');
 unchanged(state);
 phase='real normal enemy hits consume final HP and remove just the one token';
 for(let i=0;i<6&&state.slots;i++)state=await hostileContact();
 assert.equal(state.slots,0);assert.equal(state.actor,null);assert.equal(state.active,null);assert.equal(state.pickup,0);
 assert(state.saved.slots.some(c=>c?.type==='equipWoodSword'));
 assert(!state.saved.slots.some(c=>c?.type==='slimeSoul'));
 assert.equal(state.breaks.length,1,'true lethal contact adds one ordinary fragment event');
 const shatter=state.breaks[0],pose=state.shatterPose;
 assert.equal(shatter.type,'monsterSlime');assert.equal(shatter.actor,undefined);
 assert.equal(shatter.phase,'flight');assert(shatter.parts.length>2);
 assert(Math.hypot(shatter.x-pose.x,shatter.z-pose.z)<.00001,'same fractional world origin as last rendered body');
 const mesh=await until(s=>s.shatterMesh&&Math.hypot(s.shatterMesh.x-pose.x,s.shatterMesh.z-pose.z)<.00001,500);
 assert(mesh.shatterMesh.vertices>12,'the normal fragment renderer actually submits mesh vertices at that origin');
 unchanged(state);
 phase='cold reload after real companion death';
 await page.clock.resume();await open();state=await see();
 assert.equal(state.slots,0);assert.equal(state.actor,null);assert.equal(state.active,null);assert.equal(state.breaks.length,0);unchanged(state);
 phase='trim only the known malformed soul during ordinary cold bag decode';
 await page.evaluate(()=>{
  const k=JSON.parse(localStorage.getItem('world-workshop-hotbar-v1'));
  k.slots[9]={type:'slimeSoul',count:1,durability:999};
  k.companionSoul={version:1,pending:null,active:'slimeSoul'};
  localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify(k));
 });
 await open();state=await see();
 assert.equal(state.slots,0);assert.equal(state.actor,null);assert.equal(state.active,null);unchanged(state);
 assert.deepEqual(errors,[]);
 console.log('Native melee & pouch: player defeat → one audible acquisition while moving → real allied attack → durable HP, reload and genuine hostile lethal loss');
}catch(e){console.error('failed at',phase,'\n last:',last);throw e}
finally{await browser?.close();await new Promise(r=>server.close(r))}

