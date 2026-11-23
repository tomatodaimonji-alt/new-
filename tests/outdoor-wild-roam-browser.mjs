import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const src=readFileSync(process.argv[2]??'world-editor.html','utf8');
const hook='  freeMovementPose:()=>({x:poiWalkViewX,z:poiWalkViewZ,level:poiWalkLevel}),';
const fire='if(typeof poiWildRegionalFrame===\'function\')poiWildRegionalFrame(now,rng);';
assert.equal(src.split(hook).length,2);assert.equal(src.split(fire).length,2);
const born=' poiRegionalWildRuntime.set(obj,state);poiMonsterStates.set(obj,state);poiMonsterMeshDirty=true;';
assert.equal(src.split(born).length,2);
const html=src.replace(born,born+"\n window.__regionalWildBorn={x:state.x,z:state.z};").replace(fire,"if(typeof poiWildRegionalFrame==='function')poiWildRegionalFrame(now,()=>window.__wildQaSeed);")
 .replace(hook,hook+`
  regionalWildRuntimeQA:()=>({outside:poiWildPlayerOutside(),floor:poiWalkLevel,position:[poiWalkX,poiWalkZ],
   live:poiWalkActive,site:facilitySite?.id,next:poiRegionalWildNext,now:performance.now()}),
  regionalWildQA:()=>{
   const rows=[];
   for(const [o,v] of poiMonsterStates)if(o.y===0){
    const pose=poiMonsterPose(o,v,performance.now(),true);
    rows.push({type:o.type,home:{x:o.x,z:o.z},x:pose.x-.5,z:pose.z-.5,bearing:v.roamBearing,random:!!v.regionalWild,born:v.regionalWild?window.__regionalWildBorn:null,
     loot:poiArmedLootOptions(o,()=>.99).map(v=>v[1])});
   }
   return rows;
  },`);
const server=createServer((q,r)=>{r.setHeader('Content-Type','text/html; charset=utf-8');r.end(q.url==='/seed'?'<!doctype html>':html)});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const url='http://127.0.0.1:'+server.address().port;
const errors=[];
async function run(browser,seed){
 const ctx=await browser.newContext({viewport:{width:740,height:390},isMobile:true,hasTouch:true});
 try{
  // Resume explicitly rejects unknown query keys. Keep the test-only RNG
  // seed out of URL routing while supplying it before the fixture script.
  await ctx.addInitScript(n=>{window.__wildQaSeed=n},seed);
  const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));
  await p.goto(url+'/seed');
  await p.evaluate(()=>{
   localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":330000}');
   localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
    position:{x:105,z:74,y:0,facing:2},townLayout:5,townMapHeight:128,
    view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
  });
  await p.goto(url+'/?resume=1&test=1');
  await p.waitForFunction(()=>window.__editorTest?.facility?.()?.active,null,{timeout:15000})
   .catch(async cause=>{
    const startup=await p.evaluate(()=>({title:document.title,url:location.href,seed:window.__wildQaSeed,
     api:Object.keys(window.__editorTest??{}),status:window.pineStartup?.failed??null,
     body:document.body?.textContent?.trim().slice(0,220),saved:localStorage.getItem('world-workshop-resume-v1')}));
    throw new Error('Regional fixture startup: '+JSON.stringify({startup,errors}),{cause});
   });
  await p.waitForFunction(()=>window.__editorTest?.regionalWildQA?.().some(a=>a.type==='monsterSkelArcher'),null,{timeout:12000})
   .catch(async cause=>{throw new Error('Regional spawn missing: '+JSON.stringify({errors,seed,probe:await p.evaluate(()=>window.__editorTest?.regionalWildRuntimeQA?.())}),{cause})});
  const rows=await p.evaluate(()=>window.__editorTest.regionalWildQA());
  const archer=rows.find(a=>a.type==='monsterSkelArcher');
  assert(archer.random&&archer.loot.includes('equipWoodBow'));
  assert.deepEqual(archer.home,{x:105,z:86});
  assert(Math.hypot(archer.born.x-105,archer.born.z-86)>=1.5&&Math.hypot(archer.born.x-105,archer.born.z-86)<=5);
  assert(rows.some(a=>a.type==='monsterSkelWarrior'&&a.x===102&&a.z===13&&!a.random));
  assert(rows.some(a=>a.type==='monsterPondSkater'&&a.x===117&&a.z===28&&!a.random));
  assert(!rows.some(a=>a.type==='monsterSkelMage'||a.type==='monsterSkelLongStaff'),'no other armed region spawned');
  // Start twelve tiles from the home so even the closest legal birth
  // (within five tiles of home) necessarily starts beyond chase range.
  const probe=await p.evaluate(()=>window.__editorTest.regionalWildRuntimeQA());
  assert.deepEqual(probe.position,[105,74],JSON.stringify(probe));
  assert(probe.outside&&Math.hypot(archer.born.x-105,archer.born.z-74)>=7,JSON.stringify({probe,archer}));
  const trail=await p.evaluate(()=>new Promise(resolve=>{
   const rows=[],start=performance.now();
   function frame(t){const a=window.__editorTest.regionalWildQA().find(a=>a.type==='monsterSkelArcher');if(a)rows.push(a);
    if(t-start<1700)requestAnimationFrame(frame);else resolve(rows)}
   requestAnimationFrame(frame);
  }));
  assert(trail.some(a=>Number.isFinite(a.bearing)),'real region tick enters roaming');
  assert(trail.length>3&&trail.some(a=>Math.hypot(a.x-trail[0].x,a.z-trail[0].z)>.45),'real region actor keeps moving');
  return archer;
 }finally{await ctx.close()}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const a=await run(browser,0),b=await run(browser,.999999);
 assert(Math.hypot(a.born.x-b.born.x,a.born.z-b.born.z)>1,'two RNG draws produce genuinely different runtime locations');
 assert.deepEqual(errors,[]);
 console.log('PASS regional random outdoor birth/run and authored loot/guardian identity');
}finally{await browser?.close();await new Promise(r=>server.close(r))}
