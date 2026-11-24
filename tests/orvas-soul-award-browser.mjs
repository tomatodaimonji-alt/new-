import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
let h=readFileSync(process.argv[2]??'world-editor.html','utf8');
const inject=(a,b)=>{assert.equal(h.split(a).length,2,a);h=h.replace(a,b)};
const api="if(facilityParams.get('test')==='1')window.__editorTest={";
inject(api,api+`
 orvasAwardQA:{
  frame:()=>render(),
  pin:()=>{
   const b=poiDavidActive;
   if(!b?.s.david?.wakeDone||poiDungeonSpawnId(b.o)!=='davidTemple.david')return false;
   // Only begin a real finishing blow at low health and hold the next
   // enemy attack timer. Neither hit, item, code path nor death is forced.
   b.s.hp=1;b.s.david.attack=null;b.s.david.next=performance.now()+14000;return true;
  },
  inspect:()=>{
   const k=poiHotbarRead(),saved=JSON.parse(localStorage.getItem(POI_HOTBAR_KEY)||'{}'),
    ground=(k.armedDrops||[]).filter(d=>d.id.startsWith('orvas-'));
   const b=poiDavidActive,a=poiCompanionActor;
   const authored=[...poiMonsterStates].find(([o])=>o.type==='monsterStoneDavid'),site=authored?poiDavidMatch(authored[0]):null;
   const at=poiAimOrigin(performance.now());
   return {x:poiWalkX,z:poiWalkZ,y:poiWalkLevel,dir:['n','s','e','w'].map(k=>poiCameraRelativeStep(k)),
    awake:!!b?.s?.david?.wakeDone,bossHp:b?.s.hp??null,
    bossProbe:authored?{x:authored[1].x,z:authored[1].z,hp:authored[1].hp,arena:poiDavidIn(site,at),
     threat:poiEnemyThreatEnabled(),los:site?poiDavidLine(authored[1],at,site):null,next:poiNextMobTick}:null,active:k.companionSoul?.active??null,pending:k.companionSoul?.pending??null,
    actor:a?{id:a.id,x:a.x,z:a.z}:null,slots:poiInventorySlots(k),saved,ground,
    draw:window.__orvasGroundVerts??[],hits:window.__orvasFinishLog??[],clock:performance.now(),
    swing:poiWalkActionStarted,hp:poiPlayerHP,atomic:window.__orvasWrites??[]};
  }
 },
`);
inject(' requestAnimationFrame(render);',' if(!window.__orvasAwardManual)requestAnimationFrame(render);');
const hit=' const before=state.hp;\n state.hp=Math.max(0,state.hp-amount);';
inject(hit,hit+`
 if(obj.type==='monsterStoneDavid'&&before>0&&state.hp===0)(window.__orvasFinishLog??=[]).push({companion:!!source?.companion,amount});
`);
const crystal='function poiDrawOrvasSoulDrop(m,x,y,z){';
inject(crystal,crystal+'\n const prior=m.p.length;');
const end='  tri(m,rim[i],rim[n],bottom,i%2?[.26,.59,.72]:[.19,.39,.52]);\n }\n}';
inject(end,end.slice(0,-1)+" window.__orvasGroundVerts=[x,z,m.p.length-prior];\n}");
for(const [,js] of h.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(js);
if(process.env.ORVAS_AWARD_SYNTAX_ONLY){console.log('Native reward atom and ground mesh injection parse');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>Reward QA</title>':h)});
await new Promise((ok,no)=>server.listen(0,'127.0.0.1',ok).once('error',no));const url='http://127.0.0.1:'+server.address().port;
let browser,phase='start',last;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 async function begin(mode,z){
  const display={viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:.75};
  let c=await browser.newContext(display),p=await c.newPage();
  const errors=[],bootErrors=[];
  const track=page=>{
   page.on('pageerror',e=>{errors.push(e.message);bootErrors.push(String(e.stack||e));});
   page.on('console',m=>{if(m.type()==='error')bootErrors.push(m.text());});
  };track(p);
  await p.addInitScript(()=>{
   const put=Storage.prototype.setItem;
   Storage.prototype.setItem=function(key,value){
    const out=put.call(this,key,value);
    if(key==='world-workshop-hotbar-v1'){
     const k=JSON.parse(value);
     if(k.orvasRewards&8)(window.__orvasWrites??=[]).push({flag:k.orvasRewards,dead:typeof k.dungeonPopulation?.dead?.['davidTemple.david']==='number',
      soul:(k.armedDrops||[]).filter(d=>d.id==='orvas-soul').length});
    }
    return out;
   };
  });
  await p.clock.install({time:new Date('2026-04-01T10:00:00Z')});
  await p.goto(url+'/seed');
  await p.evaluate(({mode,z})=>{
   const slots=Array(27).fill(null);slots[0]={type:'equipWoodSword',count:1,durability:150};
   if(mode==='ally')slots[1]={type:'slimeSoul',count:1,durability:29};
   else for(let i=1;i<18;i++)slots[i]={type:'cannedFood',count:1};
   localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weaponDurabilityVersion:2,weapon:mode==='ally'?null:'equipWoodSword',potions:0,slots,
    companionSoul:{version:1,active:mode==='ally'?'slimeSoul':null,pending:mode==='ally'?null:'slimeSoul'}}));
   localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,position:{x:24,z,y:0,facing:0},
    townLayout:5,townMapHeight:128,view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:Math.PI,orbitPitch:.19,orbitDistance:5.7}}));
  },{mode,z});
  async function open(realBoot=false){
   await p.goto(url+'/?resume=1&test=1',{waitUntil:'domcontentloaded',timeout:45000});
   try{
    await p.waitForFunction(()=>window.pineStartup?.ready||window.pineStartup?.failed,null,{polling:120,timeout:36000});
    assert(await p.evaluate(()=>window.pineStartup.ready),JSON.stringify(bootErrors));
    await p.waitForFunction(()=>window.__editorTest?.facility()?.active,null,{polling:50,timeout:30000});
   }catch(e){
    const stage=await p.evaluate(()=>({ready:window.pineStartup?.ready,loading:window.pineStartup?.loading,failed:window.pineStartup?.failed,
     stage:document.querySelector('#pineStartupCover')?.textContent?.trim().slice(-180)})).catch(()=>null);
    throw Error(JSON.stringify({phase,stage,bootErrors,detail:String(e)}));
   }
   if(realBoot)await p.clock.install({time:new Date('2026-04-01T10:00:00Z')});
   await p.clock.pauseAt((await p.evaluate(()=>Date.now()))+1500);
   await p.evaluate(()=>{window.__orvasAwardManual=true});
  }
  await open();
  const see=async()=>last=await p.evaluate(()=>window.__editorTest.orvasAwardQA.inspect());
  const tick=async(ms=36)=>{await p.clock.fastForward(ms);await p.evaluate(()=>window.__editorTest.orvasAwardQA.frame());return see()};
  const until=async(fn,n=180)=>{for(let i=0;i<n;i++){const s=await tick();if(fn(s))return s;}throw Error(JSON.stringify(last));};
  const step=async(x,z)=>{
   const s=last,i=s.dir.findIndex(d=>d[0]===x-s.x&&d[1]===z-s.z);assert(i>=0);
   await p.keyboard.press(['ArrowUp','ArrowDown','ArrowRight','ArrowLeft'][i]);const n=await tick(230);
   assert.deepEqual([n.x,n.z,n.y],[x,z,0]);return n;
  };
  async function cold(){
   // Transfer the real browser's unchanged persisted origin to a genuinely
   // fresh browser context. The old WebGL and paused page are gone before
   // any new app startup. The first restored frame runs on real clocks.
   const storageState=await c.storageState();
   await c.close();c=await browser.newContext({...display,storageState});
   p=await c.newPage();track(p);await open(true);return p;
  }
  return {get c(){return c},get p(){return p},open,cold,see,tick,until,step,errors};
 }
 function checkGrant(s,source){
  assert.equal(s.hits.length,1);assert.equal(s.hits[0].companion,source);
  assert.deepEqual(s.ground.map(d=>d.id).sort(),['orvas-greatsword','orvas-head','orvas-soul','orvas-twin-greatswords']);
  assert.deepEqual(s.ground.find(d=>d.id==='orvas-soul'),{id:'orvas-soul',type:'orvasSoul',x:24,z:105,y:0,durability:1050});
  assert.equal(s.saved.orvasRewards,15);assert.equal(typeof s.saved.dungeonPopulation.dead['davidTemple.david'],'number');
  assert.deepEqual(s.atomic[0],{flag:15,dead:true,soul:1});
  assert(s.atomic.every(w=>w.soul<=1));
 }
 const scenario=process.env.ORVAS_AWARD_CASE;let q,p,s;
 if(scenario!=='pending'){
 phase='real canonical awakening and actual slime-companion final blow';
 q=await begin('ally',101);p=q.p;await q.tick();await q.step(24,102);
 s=await q.until(v=>v.awake&&v.actor?.id==='slimeSoul');const walkSwing=s.swing;
 assert(await p.evaluate(()=>window.__editorTest.orvasAwardQA.pin()));
 s=await q.until(v=>v.ground.some(d=>d.id==='orvas-soul')&&v.draw.length);
 checkGrant(s,true);assert.equal(s.swing,walkSwing);assert.deepEqual(s.draw.slice(0,2),[24.5,105.5]);assert(s.draw[2]>72);
 phase='cold reload preserves floor reward, then actually walk over it';
 p=await q.cold();s=await q.until(v=>v.ground.some(d=>d.id==='orvas-soul'));
 assert.equal(s.ground.length,4);assert(s.slots.every(c=>c?.type!=='orvasSoul'));
 for(const [x,z] of [[25,102],[26,102],[26,103],[26,104],[26,105],[25,105],[24,105]])s=await q.step(x,z);
 assert.equal(s.slots.filter(c=>c?.type==='orvasSoul').length,1);
 assert.equal(s.slots.find(c=>c?.type==='orvasSoul').durability,1050);
 assert.equal(s.ground.length,3);assert(s.ground.every(d=>d.type!=='orvasSoul'));
 s=await q.step(24,106);s=await q.step(24,105);
 assert.equal(s.slots.filter(c=>c?.type==='orvasSoul').length,1);assert.equal(s.saved.orvasRewards,15);
 p=await q.cold();s=await q.until(v=>v.slots.some(c=>c?.type==='orvasSoul'));
 assert.equal(s.ground.length,3);assert.equal(s.saved.orvasRewards,15);
 assert(s.slots.some(c=>c?.type==='slimeSoul'&&c.durability===29));
 phase='real confirmed reset retains only the three weapon starters, never the soul';
 await p.locator('#poiLandscapeMenuToggle').tap();
 await p.locator('[data-landscape-action="reset"]').tap();
 await p.locator('#poiResetGameDialog').waitFor({state:'visible'});
 await p.clock.resume();
 await Promise.all([p.waitForURL(/reset-camera=1/),p.locator('#poiResetGameConfirm').tap()]);
 await p.locator('#pineStartupCover').waitFor({state:'hidden'});s=await q.see();
 assert.deepEqual(s.slots.slice(2,5).map(o=>o?.type),['equipOrvasHead','equipOrvasGreatsword','equipOrvasTwinGreatswords']);
 assert(s.slots.every(c=>c?.type!=='orvasSoul'));assert(!s.ground.some(d=>d.type==='orvasSoul'));
 assert.deepEqual(q.errors,[]);await q.c.close();
 }
 if(scenario!=='pickup'){
 phase='real sword finish while normal slime claim remains pending and bag is full';
 q=await begin('pending',101);p=q.p;await q.tick();await q.step(24,102);
 s=await q.until(v=>v.awake&&v.pending==='slimeSoul');
 assert(await p.evaluate(()=>window.__editorTest.orvasAwardQA.pin()));
 s=await q.step(24,103);
 await p.locator('#poiWalkAction').tap();
 s=await q.until(v=>v.ground.some(d=>d.id==='orvas-soul'));
 checkGrant(s,false);assert.equal(s.pending,'slimeSoul');
 assert(s.slots.every(c=>c?.type!=='orvasSoul'||!c));
 assert.deepEqual(q.errors,[]);
 }
 console.log('Canonical Orvas actual companion and player finishes, verified atomic visible floor reward, real walk pickup/reload and reset exclusion');
}catch(e){console.error(phase,last&&{...last,slots:last.slots.filter(Boolean),saved:last.saved?.orvasRewards});throw e}
finally{await browser?.close();await new Promise(ok=>server.close(ok))}
