import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {mkdirSync,readFileSync} from 'node:fs';
import {Script} from 'node:vm';
let h=readFileSync(process.argv[2]??'world-editor.html','utf8');
const inject=(a,b)=>{assert.equal(h.split(a).length,2,a);h=h.replace(a,b);};
const api="if(facilityParams.get('test')==='1')window.__editorTest={";
inject(api,api+`
 soulFloorQA:{
  frame:()=>render(),
  at:()=>{
   const kit=poiHotbarRead(),fx=[...poiSoulFloorMotion.values()].map(r=>({type:r.item.type,stage:poiSoulFloorFrame(r,performance.now()).phase,end:r.end,
    source:r.e?[r.e.x,r.e.z]:null,parts:r.e?.parts?.length??0,tip:poiSoulFloorFrame(r,performance.now()).tilt??null}));
   return {x:poiWalkX,z:poiWalkZ,y:poiWalkLevel,dirs:['n','s','e','w'].map(k=>poiCameraRelativeStep(k)),
    edge:['n','s','e','w'].map(k=>{const [dx,dz]=poiCameraRelativeStep(k);return poiWalkCanStep(poiWalkX+dx,poiWalkZ+dz,poiWalkX,poiWalkZ);}),
    souls:kit.soulDrops??[],slots:poiInventorySlots(kit),active:kit.companionSoul?.active??null,pending:kit.companionSoul?.pending??null,gold:kit.gold,
    saved:JSON.parse(localStorage.getItem(POI_HOTBAR_KEY)||'{}'),fx,
    now:performance.now(),button:$('poiWalkAction')._shopPrompt,damage:window.__trueSoulDeath??[],
    drops:kit.drops??[],staticMesh:poiSoulFloorStatic?.count??0,movingMesh:poiSoulFloorMovingCount?poiSoulFloorMoving?.count??0:0,
    pickUps:window.__soulPickUps??[],monster:window.__soulFoe?[window.__soulFoe[1].x,window.__soulFoe[1].z,window.__soulFoe[1].hp]:null};
  },
  spawn:()=>{
   const [dx,dz]=[[0,-1],[1,0],[0,1],[-1,0]][poiWalkFacing],x=poiWalkX+dx,z=poiWalkZ+dz,y=poiWalkLevel;
   if(!poiWalkCanStep(x,z,poiWalkX,poiWalkZ)||poiMonsterAt(x,z,true)||!poiCompanionAttackClear({x:poiWalkX,z:poiWalkZ},{x,z},y))return false;
   const o={type:'monsterSlime',x,z,y,rot:0},s=poiCombatActorMake(o);
   s.hp=1;s.nextAttack=performance.now()+60000;poiMonsterStates.set(o,s);poiMonsterMeshDirty=true;window.__soulFoe=[o,s];return true;
  },
 },
`);
inject(' requestAnimationFrame(render);',' if(!window.__soulFloorManual)requestAnimationFrame(render);');
inject('function poiWildRegionalFrame(now,rng){','function poiWildRegionalFrame(now,rng){return;');
inject('function poiWildPick(rng){','function poiWildPick(rng){return null;');
inject('poiCompanionMonsterDefeated(obj,state,now,debris);','poiCompanionMonsterDefeated(obj,state,now,debris,()=>0);');
const hit=' const before=state.hp;\n state.hp=Math.max(0,state.hp-amount);';
inject(hit,hit+"\n if(window.__soulFoe?.[0]===obj&&before>0&&state.hp===0)(window.__trueSoulDeath??=[]).push({source:source?.companion??null,amount});");
const sound="function poiSoulFloorCollect(item){";
inject("poiSoulFloorMotion.delete(item.type);poiEconomyRefresh();",
"poiSoulFloorMotion.delete(item.type);poiEconomyRefresh();(window.__soulPickUps??=[]).push(item.type);");
for(const [,body] of h.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(body);
if(process.env.SOUL_FLOOR_PARSE_ONLY){console.log('Parsed native drop + death test');process.exit(0);}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf8');res.end(req.url==='/seed'?'<title>seed</title>':h)});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const url='http://127.0.0.1:'+server.address().port;
const letters=['ArrowUp','ArrowDown','ArrowRight','ArrowLeft'];let browser,phase='boot',last;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const ctx=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:.75});
 const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.clock.install({time:new Date('2026-04-01T10:00:00Z')});
 await p.goto(url+'/seed');await p.evaluate(()=>{
  const slots=Array(27).fill(null);slots[0]={type:'equipWoodSword',count:1,durability:150};slots[2]={type:'orvasSoul',count:1,durability:317};
  localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,gold:12,weaponDurabilityVersion:2,weapon:'equipWoodSword',potions:0,slots}));
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,position:{x:102,z:93,y:0,facing:2},
   townLayout:5,townMapHeight:182,templeDepth:1,view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:0,orbitPitch:.25,orbitDistance:5.6}}));
 });
 async function load(){
  await p.goto(url+'/?resume=1&test=1',{waitUntil:'domcontentloaded'});
  await p.locator('#pineStartupCover').waitFor({state:'hidden'});await p.waitForFunction(()=>window.__editorTest?.facility()?.active);
  await p.evaluate(()=>window.__soulFloorManual=true);
  for(const pad of [12_000,30_000]){try{await p.clock.pauseAt((await p.evaluate(()=>Date.now()))+pad);break;}catch(e){if(pad===30_000||!String(e).includes('Cannot fast-forward to the past'))throw e;}}
 }
 const read=async()=>last=await p.evaluate(()=>window.__editorTest.soulFloorQA.at());
 const tick=async(ms=75)=>{await p.clock.fastForward(ms);await p.evaluate(()=>window.__editorTest.soulFloorQA.frame());return read()};
 const until=async(f,n=85)=>{let s=await read();for(let i=0;i<n&&!f(s);i++)s=await tick();assert(f(s),JSON.stringify(s));return s;};
 const take=()=>p.locator('#poiWalkAction').tap();
 const move=async(x,z)=>{
  const s=await read(),i=s.dirs.findIndex(([dx,dz])=>dx===x-s.x&&dz===z-s.z);
  assert(i>=0&&s.edge[i],JSON.stringify({x,z,s}));await p.keyboard.press(letters[i]);
  return until(q=>q.x===x&&q.z===z,10);
 };
 async function go(item){
  for(let i=0;i<4;i++){
   const s=await read();if(s.x===item.x&&s.z===item.z)return s;
   const d=s.dirs.findIndex(([x,z],i)=>s.edge[i]&&Math.abs(item.x-s.x-x)+Math.abs(item.z-s.z-z)<Math.abs(item.x-s.x)+Math.abs(item.z-s.z));
   assert(d>=0,JSON.stringify({item,s}));await move(s.x+s.dirs[d][0],s.z+s.dirs[d][1]);await tick(150);
  }
  assert.fail('did not reach actual floor soul');
 }
 await load();assert.equal((await tick()).slots[2]?.durability,317);
 phase='trusted inventory swipe produces real rolling model, without changing gold';
 const slot=n=>p.locator('#poiHotbar [data-hotbar-slot="'+n+'"]');
 async function swipe(n){
  const bound=await slot(n).boundingBox();assert(bound);
  const cdp=await ctx.newCDPSession(p),start={x:bound.x+bound.width/2,y:bound.y+bound.height/2,id:1};
  const touch=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
  await touch('touchStart',[start]);
  for(let i=1;i<=3;i++)await touch('touchMove',[{...start,x:start.x+i*2,y:start.y-i*37}]);
  await touch('touchEnd',[]);await cdp.detach();
 }
 await swipe(2);
 const dropped=await until(s=>s.souls.some(d=>d.type==='orvasSoul')&&s.fx.some(q=>q.stage==='roll')&&s.movingMesh>0);
 const slime=dropped.souls.find(d=>d.type==='orvasSoul');assert.equal(slime.durability,317);assert.equal(dropped.slots[2],null);assert.equal(dropped.gold,12);
 assert.deepEqual(dropped.saved.soulDrops,[slime]);assert.deepEqual(dropped.pickUps,[]);
 phase='cold reload keeps floor HP and visually settles; directly crossing is not pickup';
 await p.clock.resume();await load();const stayed=await until(s=>s.staticMesh>0);
 assert.deepEqual(stayed.souls,[slime]);assert(!stayed.slots.some(c=>c?.type==='orvasSoul'));
 const stepped=await go(slime);assert(stepped.souls.some(d=>d.type==='orvasSoul'));assert.deepEqual(stepped.pickUps,[]);
 assert.equal((await until(s=>s.button==='soul-pickup')).button,'soul-pickup');
 if(process.env.FACILITY_SCREENSHOTS){mkdirSync(process.env.FACILITY_SCREENSHOTS,{recursive:true});await p.screenshot({path:process.env.FACILITY_SCREENSHOTS+'/orvas-317-manual-soul.png'});}
 phase='real action pickup preserves exact HP and does not activate';
 await take();const picked=await until(s=>s.pickUps.length===1);
 assert.deepEqual(picked.souls,[]);assert.equal(picked.slots.find(c=>c?.type==='orvasSoul')?.durability,317);assert.equal(picked.active,null);
 phase='active ally cannot be duplicated by a native drop swipe';
 const activeIndex=picked.slots.findIndex(c=>c?.type==='orvasSoul');assert(activeIndex>=0&&activeIndex<9);
 await slot(activeIndex).tap();await p.locator('#poiCompanionCommands [data-companion-command="summon"]').tap();
 await until(v=>v.active==='orvasSoul');
 await swipe(activeIndex);
 const blocked=await tick(760);assert.equal(blocked.active,'orvasSoul');assert.deepEqual(blocked.souls,[]);
 assert.equal(blocked.slots[activeIndex].durability,317);
 await slot(activeIndex).tap();await p.locator('#poiCompanionCommands [data-companion-command="dismiss"]').tap();
 await until(v=>v.active===null);
 phase='real finishing blow emits fracture, reverse gather, miniature form and local tumble without receiving item';
 let spawned=await p.evaluate(()=>window.__editorTest.soulFloorQA.spawn());if(!spawned){
  const s=await read(),i=s.edge.findIndex(Boolean);assert(i>=0);await move(s.x+s.dirs[i][0],s.z+s.dirs[i][1]);await tick(240);
  spawned=await p.evaluate(()=>window.__editorTest.soulFloorQA.spawn());
 }assert(spawned);
 await take();
 const stages=new Map();
 for(let i=0;i<60;i++){
  const s=await tick(65),f=s.fx.find(r=>r.type==='slimeSoul');
  if(f&&!stages.has(f.stage))stages.set(f.stage,{parts:f.parts,vertices:s.movingMesh,tip:f.tip});
  assert(!s.slots.some(c=>c?.type==='slimeSoul'));assert.equal(s.pending,null);assert.equal(s.active,null);
  assert.deepEqual(s.pickUps,['orvasSoul']);
  if(!f&&s.souls.some(d=>d.type==='slimeSoul')&&s.staticMesh>0)break;
 }
 assert.deepEqual([...stages.keys()],['fracture','gather','form','roll']);assert(last.damage.some(d=>d.source===null&&d.amount>0));
 for(const f of stages.values())assert(f.parts>0&&f.vertices>0,JSON.stringify([...stages]));
 const skeleton=last.souls.find(d=>d.type==='slimeSoul');assert(skeleton?.durability>0);
 assert.deepEqual(last.saved.soulDrops,[skeleton]);assert.equal(last.gold,12);assert.deepEqual(last.drops,[]);
 assert.deepEqual(errors,[]);console.log('PASS native player hit / fracture / gather / miniature / local floor roll and deliberate durable collection',JSON.stringify({stages:[...stages],slime,skeleton}));
}catch(e){console.error(phase,JSON.stringify(last));throw e}
finally{await browser?.close();await new Promise(ok=>server.close(ok))}
