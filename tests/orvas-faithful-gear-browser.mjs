import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
let h=readFileSync(process.argv[2]??'world-editor.html','utf8');
const install=(a,b)=>{assert.equal(h.split(a).length,2,a);h=h.replace(a,b)};
const mark="if(facilityParams.get('test')==='1')window.__editorTest={";


install(mark,`
 window.__orvas={
  frame:()=>render(),
  bossCues:()=>{
   const b=facilitySite.davidTemple.boss,p={x:b.x,z:b.z,y:b.y};
   for(const [kind,i,phase] of [['beam',0,'beamOnset'],['sweep',0,'impact'],['double',0,'impact'],['double',1,'impact']])
    poiDavidAttackFoley({kind,sx:b.x,sz:b.z,y:b.y},p,b,i,phase);
  },
  stage:index=>{
   if(!workshopResumeRestorePosition({x:24,z:108,y:0,facing:1}))return false;
   poiMonsterStates.clear();poiCombatLockReset();
   return poiEquipHotbarItem(index)?.ok;
  },
  addTargets:targets=>{
   const list=targets.map(([x,z,y])=>{
    const o={x,z,y,type:'monsterSlime',rot:0},s=poiCombatActorMake(o);s.hp=100;s.townOwned=true;
    poiMonsterStates.set(o,s);return s;
   });
   window.__orvas.targets=list;poiMonsterMeshDirty=true;
  },
  state:()=>{
   const k=poiHotbarRead(),slots=poiInventorySlots(k),weapon=poiEquippedWeapon(),a=poiPlayerWeaponPending;
   const beam=poiOrvasPlayerBeam;
   return {weapon,ready:poiAttackReady,clock:performance.now(),pending:!!a,cursor:a?.orvasCursor,
    used:slots.find(c=>c?.type===weapon)?.durability,hp:window.__orvas.targets?.map(s=>s.hp),
    beam:beam?{rays:beam.rays,draw:!!poiOrvasBeamGpu}:null,start:poiWalkActionStarted,
    audio:window.__orvasFoley??[],edge:window.__orvasEdges??[],thermal:window.__orvasThermal??[],
    name:POI_ORVAS_NAME,items:slots.slice(2,5).map(c=>c?.type)};
  }
 };`+mark);
install(' poiAudioTransient.add(source);source.start(when);source.stop(when+(cap??(buffer.duration+.012)));',`
  poiAudioTransient.add(source);source.start(when);source.stop(when+(cap??(buffer.duration+.012)));
  if(window.__orvasManual){
   const id=buffer===poiDavidAlienCache?'boss-alien-beam':[...poiRecordedFoleyCache].find(([id,b])=>buffer===b&&/^david(?:BladeSweep|Sword)/.test(id))?.[0];
   if(id)(window.__orvasFoley??=[]).push({id,running:source.context.state,loop:source.loop,when,len:buffer.length});
  }
`);
install('const b=poiOrvasTwinBladeBasis(arms,pose,i);poiOrvasSwordGeometry(local,b.grip,b.axis,b.blade)',`
  const b=poiOrvasTwinBladeBasis(arms,pose,i);
  if(window.__orvasManual&&pose?.orvasTwin)(window.__orvasEdges??=[]).push({i,p:pose.orvasTwin[i],tip:b.tip,grip:b.grip,axis:b.axis,blade:b.blade});
  poiOrvasSwordGeometry(local,b.grip,b.axis,b.blade)
`);
install('   const g=poiDavidThermalBeam(q,d,clear+front,0,true,1);',`
   const g=poiDavidThermalBeam(q,d,clear+front,0,true,1);
   if(window.__orvasManual)(window.__orvasThermal??=[]).push({width:POI_DAVID_BEAM_WIDTH,rng:clear,mask,n:g.p.length/3,core:g.coreCount});
`);
install(' requestAnimationFrame(render);',' if(!window.__orvasManual)requestAnimationFrame(render);');
for(const [,js] of h.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(js);
if(process.env.ORVAS_NATIVE_PARSE_ONLY){console.log('Orvas weapons actual browser fixture parses');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const srv=createServer((q,r)=>{r.setHeader('Content-Type','text/html; charset=utf-8');r.end(q.url==='/seed'?'<title>Seed</title>':h)});
await new Promise(r=>srv.listen(0,'127.0.0.1',r));
const root='http://127.0.0.1:'+srv.address().port;let browser;
try{
 browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});

 const ctx=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:.65});
 const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(18000);
 await p.goto(root+'/?facility=base&facility-play=1&test=1',{waitUntil:'domcontentloaded'});
 await p.locator('#pineStartupCover').waitFor({state:'hidden'});
 const read=()=>p.evaluate(()=>window.__orvas.state());
 const keys=['equipOrvasHead','equipOrvasGreatsword','equipOrvasTwinGreatswords'];
 assert(!(await read()).items.some(x=>keys.includes(x)));
 await p.locator('#poiLandscapeMenuToggle').click();await p.locator('[data-landscape-action="reset"]').click();
 await p.locator('#poiResetGameDialog').waitFor({state:'visible'});
 await Promise.all([p.waitForURL(/reset-camera=1/),p.locator('#poiResetGameConfirm').click()]);
 await p.locator('#pineStartupCover').waitFor({state:'hidden'});
 await p.clock.install({time:new Date('2026-04-01T10:00:00Z')});
 await p.clock.pauseAt(await p.evaluate(()=>Date.now()+175));
 await p.evaluate(()=>{window.__orvasManual=true});
 const frame=async(ms=35)=>{await p.clock.fastForward(ms);await p.evaluate(()=>window.__orvas.frame());};
 const until=async(check,limit=65)=>{let q=await read();for(let i=0;i<limit&&!check(q);i++){await frame();q=await read()}assert(check(q),JSON.stringify(q));return q};
 const start=async(i,targets)=>{
  await until(q=>q.clock>=q.ready&&!q.pending);
  assert(await p.evaluate(i=>window.__orvas.stage(i),i));
  const q=await read();assert.equal(q.weapon,keys[i-2]);assert(q.used>0);
  const b=await p.locator('#poiWalkAction').boundingBox();assert(b);
  await p.touchscreen.tap(b.x+b.width/2,b.y+b.height/2);
  const held=await until(v=>v.pending&&v.start>=q.clock);
  await p.evaluate(t=>window.__orvas.addTargets(t),targets);
  return {q,held};
 };
 assert.deepEqual((await read()).items,keys);
 assert.equal((await read()).name,'オルヴァス');
 let {q,held}=await start(2,[[32,108,0],[34,108,0]]);
 let landed=await until(v=>!v.pending&&v.beam?.draw);
 assert(landed.clock-held.start>=420);
 assert.deepEqual(landed.hp,[52,100]);assert.equal(landed.used,q.used-1);
 assert(landed.beam.rays.length===2&&landed.beam.rays[0].z!==landed.beam.rays[1].z);
 assert.equal(landed.thermal.at(-1).width,.56);assert(landed.thermal.at(-1).n>100&&landed.thermal.at(-1).mask===3);
 assert(Math.abs(Math.abs(landed.beam.rays[0].z-landed.beam.rays[1].z)-.302)<.002);
 assert.deepEqual(landed.audio.map(x=>x.id),['boss-alien-beam']);

 ({q,held}=await start(3,[[28,108,0],[26,111,0],[23,108,0]]));
 landed=await until(v=>!v.pending);
 assert(landed.clock-held.start>=560);
 assert.deepEqual(landed.hp,[54,54,100]);assert.equal(landed.used,q.used-1);
 ({q,held}=await start(4,[[27,108,0],[26,111,0],[23,108,0]]));
 const first=await until(v=>v.cursor===1);
 assert(first.clock-held.start>=720);assert.deepEqual(first.hp,[72,100,100]);
 landed=await until(v=>!v.pending);
 assert(landed.clock-held.start>=1040);assert.deepEqual(landed.hp,[37,100,100]);assert.equal(landed.used,q.used-1);
 for(const i of [0,1]){
  const edge=landed.edge.find(b=>b.i===i&&b.p>=1.479&&Math.abs(b.tip[1]-.028)<.004);
  assert(edge&&edge.blade[1]<-.9&&Math.abs(Math.hypot(...edge.tip.map((n,k)=>n-edge.grip[k]))-3.10)<.0001);
 }
 const expected=['boss-alien-beam','davidBladeSweep','davidSwordFirst','davidSwordSecond'];
 assert.deepEqual(landed.audio.map(x=>x.id),expected);assert(landed.audio.every(a=>a.running==='running'&&a.len>1000));
 await p.evaluate(()=>window.__orvas.bossCues());
 const all=(await read()).audio;assert.deepEqual(all.map(x=>x.id),[...expected,...expected]);
 assert.deepEqual(all.slice(4).map(x=>x.len),all.slice(0,4).map(x=>x.len));

 console.log('Physical reset, then all three actual right-button attacks, matched timing, scope and wear',JSON.stringify({first:first.hp,landed:landed.hp}));
 assert.deepEqual(errors,[]);
 await ctx.close();
}finally{await browser?.close();await new Promise(r=>srv.close(r))}
