import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';

const source=readFileSync(process.argv[2]??'world-editor.html','utf8');
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
function inject(s,a,b){assert.equal(s.split(a).length,2,a);return s.replace(a,b)}
let fixture=inject(source,' const p=poiWildPick(rng);',' const p=null;');
fixture=inject(fixture,'function poiWildRegionalFrame(now,rng){','function poiWildRegionalFrame(now,rng){return;');
const enemyEntry='function poiEnemyBeginPlayer(obj,s,now){';
fixture=inject(fixture,enemyEntry,enemyEntry+'if(obj.type!==window.__equippedEnemy)return false;');
const armEntry='function poiArmSkeleton(';
fixture=inject(fixture,armEntry,`function poiArmSkeleton(...args){
 const [part,id,x,y,z]=args,first=part.p.length;
 try{return __realArmSkeleton(...args)}
 finally{
  if(id===window.__equippedEnemy){
   let min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity],sum=[0,0,0];
   for(let i=first;i<part.p.length;i+=3){
    const v=[part.p[i]-x,part.p[i+1]-y,part.p[i+2]-z];
    for(let axis=0;axis<3;axis++){min[axis]=Math.min(min[axis],v[axis]);max[axis]=Math.max(max[axis],v[axis]);sum[axis]+=v[axis]}
   }
   (window.__weaponMesh??=new WeakMap()).set(part,{vertices:(part.p.length-first)/3,min,max,sum,rig:part.enemyGripPose??args[5]??null});
  }
 }
}
function __realArmSkeleton(`);
const heldEntry='function poiEnemyHeldMesh(';
if(fixture.includes(heldEntry))fixture=inject(fixture,heldEntry,`function poiEnemyHeldMesh(...args){
 const [part,prop,rig,x,y,z]=args,first=part.p.length,base=[x,y,z];
 const result=__realEnemyHeldMesh(...args);
 if(rig?.weapon){
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let i=first;i<first+prop.p.length;i+=3)for(let a=0;a<3;a++){
   const v=part.p[i+a]-base[a];min[a]=Math.min(min[a],v);max[a]=Math.max(max[a],v);
  }
  (window.__animatedWeaponMesh??=new WeakMap()).set(part,{vertices:prop.p.length/3,min,max,rig});
 }
 return result;
}
function __realEnemyHeldMesh(`);
const drawBranch='   const facing=attack?.facing??(s.facing||0);';
fixture=inject(fixture,drawBranch,`   if(obj.type===window.__equippedEnemy){
    const a=s.playerAttack, weapon=window.__animatedWeaponMesh?.get(part)??window.__weaponMesh?.get(part), samples=window.__equippedSamples??=[];
    if(samples.length<300)samples.push({now,phase:attack?.phase??null,variant:attack?.variant??null,
     start:a?.start??null,hit:a?.hit??null,visualHitAt:a?.visualHitAt??null,pending:!!a?.pending,weapon:weapon??null,
     hp:poiPlayerHP,bodyVertices:part.p.length/3,x:s.x,z:s.z,bodyPitch:attack?.pitch??null});
   }
`+drawBranch);
fixture=inject(fixture,'function poiMobHitPlayer(obj,now',`function poiMobHitPlayer(...args){
 const [obj,now]=args,before=poiPlayerHP;
 try{return __realMobHitPlayer(...args)}
 finally{
  if(obj.type===window.__equippedEnemy)(window.__equippedContacts??=[]).push({now,before,after:poiPlayerHP});
 }
}
function __realMobHitPlayer(obj,now`);
const srv=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url==='/seed'?'<title>Seed</title>':fixture)});
await new Promise((r,j)=>srv.listen(0,'127.0.0.1',r).once('error',j));
const origin='http://127.0.0.1:'+srv.address().port;
const profiles=[
 {type:'monsterSkelKnight',x:106,z:79,e:[106,78],weapon:'equipIronSword',windup:700,variant:['shield-cleave','shield-bash']},
 {type:'monsterSkelLongStaff',x:120,z:81,e:[120,82],weapon:'equipLongStaff',windup:660,variant:'staff-overhead'},
 {type:'monsterSkeleton',x:104,z:82,e:[104,81],variant:'bone-swipe'},
 {type:'monsterNorthMinotaur',x:64,z:14,e:[64,13],variant:['north-axe','north-horn']},
];
const trace=p=>p.evaluate(()=>({samples:window.__equippedSamples??[],contacts:window.__equippedContacts??[],
 position:window.__editorTest?.facility()?.position}));
const spread=(a,b)=>Math.max(...a.flatMap((v,i)=>v.map((x,j)=>Math.abs(x-b[i][j]))));
async function run(browser,{type,x,z,e,windup,variant,weapon}){
 const ctx=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:.65});
 const p=await ctx.newPage(),errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.addInitScript(type=>{window.__equippedEnemy=type},type);
  await p.goto(origin+'/seed');
  await p.evaluate(({x,z})=>{
   localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weapon:'equipWoodSword',potions:0}));
   localStorage.setItem('world-workshop-town-clock-v1',JSON.stringify({version:1,gameMs:11*60*500}));
   localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
    position:{x,z,y:-1,facing:0},townLayout:5,townMapHeight:128,view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:-1,
     hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
  },{x,z});
  await p.goto(origin+'/?resume=1&test=1');
  await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:18000});
  await p.waitForFunction(()=>{
   const c=window.__equippedContacts?.find(c=>c.after<c.before);
   const samples=window.__equippedSamples;
   return c&&samples?.some(s=>!s.pending&&s.visualHitAt===c.now&&['impact','recover'].includes(s.phase))&&
    samples.some(s=>s.now>=c.now&&!s.phase&&!s.pending);
  },null,{polling:40,timeout:12000});
  const {samples,contacts,position}=await trace(p);
  assert.deepEqual(position,{x,z,level:-1});
  const contact=contacts.find(c=>c.after<c.before);
  const impact=samples.find(s=>!s.pending&&s.visualHitAt===contact.now&&s.phase==='impact')
   ??samples.find(s=>!s.pending&&s.visualHitAt===contact.now&&s.phase==='recover');
  const same=samples.filter(s=>s.start===impact.start);
  const warn=same.find(s=>s.pending&&s.phase==='windup');
  assert(warn,'the same actual damage cycle displayed a rendered pending windup');
  const idle=samples.find(s=>s.now>=contact.now&&!s.phase&&!s.pending);
  assert(impact&&idle&&impact.bodyVertices>0&&idle.bodyVertices>0,'live contact produces a mesh impact followed by real idle refresh');
  assert.deepEqual([warn.x,warn.z],e);
  assert.deepEqual([impact.x,impact.z],e,'weapon animation never changes the occupied tile');
  // A late rendered frame can let the first attack expire without contact.
  // Analyze the first real damage cycle, which may use the genuine alternate.
  if(variant)assert([variant].flat().includes(warn.variant),'real committed variant for '+type+': '+warn.variant);
  if(windup){
   assert.equal(warn.hit-warn.start,windup,'weapon animation does not delay actual damage');
   assert(warn.weapon?.vertices>0&&impact.weapon?.vertices===warn.weapon.vertices&&idle.weapon?.vertices>0,'visible weapon persists through draw, strike, and idle');
   assert.equal(warn.weapon?.rig?.weapon,weapon,'published WebGL mesh applies the equipped held weapon when drawing back');
   assert.equal(impact.weapon?.rig?.weapon,weapon,'same weapon is actively posed at real damage contact');
   const raised=same.filter(s=>s.pending&&s.weapon?.rig&&s.now<warn.hit-80);
   const bounds=s=>[s.weapon.min,s.weapon.max];
   assert(raised.some(s=>spread(bounds(s),bounds(impact))>.16),'actual held weapon vertices move from preparation to true contact');
   assert.equal(idle.weapon.rig,null,'returns to the ordinary held prop after recovery');
   if(type==='monsterSkelLongStaff')assert(raised.some(s=>s.weapon.max[1]>impact.weapon.max[1]+.20),'staff raises visibly then drops into the established hit');
  }else{
   for(const stage of [warn,impact,idle])assert(stage.weapon===null||stage.weapon.vertices===0&&stage.weapon.rig===null,
    'the ordinary skeleton or bespoke bull emits neither a generic held rig nor any hooked prop vertices');
  }
  assert.deepEqual(errors,[]);
  console.log('PASS',type,warn.variant??'bespoke',contact.before-contact.after);
 }catch(e){
  const observation=await trace(p).catch(()=>null);
  console.error(type,errors,JSON.stringify(observation&&{...observation,samples:observation.samples.slice(-18)}));throw e;
 }finally{await ctx.close()}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 for(const profile of profiles.filter(x=>!process.env.ENEMY_MOTION_CASE||process.env.ENEMY_MOTION_CASE===x.type))await run(browser,profile);
}finally{await browser?.close();await new Promise(r=>srv.close(r))}
