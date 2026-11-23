import {stableRegionalCombat} from './outdoor-regional-combat-fixture.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import vm from 'node:vm';

const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const begin=html.indexOf('const FACILITY_SITES=Object.freeze('),end=html.indexOf('function workshopResumeDecode(',begin);
assert(begin>=0&&end>begin);
const site=JSON.parse(JSON.stringify(vm.runInNewContext(html.slice(begin,end)+";buildFacilitySite('base')")));
const staff='equipLongStaff',archer='monsterSkelArcher',knight='monsterSkelKnight';
assert(html.includes('staffThrust'),'v201 Long Staff pose must have an authored thrust');
assert(site.map.world.some(o=>o.type===archer&&o.x===105&&o.z===86&&o.y===0),'real archer fixture');
assert(site.map.world.some(o=>o.type===knight&&o.x===106&&o.z===78&&o.y===-1),'real knight fixture');
if(process.env.STAFF_MOTION_LAYOUT_ONLY==='1'){
 console.log('PASS v201 staff thrust and actual authored enemy fixtures');
 process.exit(0);
}
const meshLine=" if(typeof poiCombatLockRenderedHeading!=='undefined')poiCombatLockRenderedHeading=poiCombatLockHeading;";
const meshCalls=/poiWalkMesh=upload\(poiBuildPlayerMesh\(weapon,pose,gear,stride,\[2,3,0,1\]\[poiWalkFacing\],x,y,z,(aim\.heading|poiCombatLockHeading|free\.angle|null),true\)\);/g;
assert.deepEqual([...html.matchAll(meshCalls)].map(m=>m[1]),['aim.heading','poiCombatLockHeading','free.angle','null'],
 'all four production player-mesh branches use the same instrumented upload');
const wildPick=' const p=poiWildPick(rng);',enemyEntry='function poiEnemyBeginPlayer(obj,s,now){',probeAnchor='  playerWeapon:()=>';
for(const anchor of [meshLine,wildPick,enemyEntry,probeAnchor])assert.equal(html.split(anchor).length,2,anchor);
// Observe the exact vertex batch fed to WebGL and keep unrelated ambient RNG
// out of this disposable fixture. Native player/enemy behavior is unchanged.
const observedHtml=stableRegionalCombat(html,'monsterSkelArcher').replace(wildPick,' const p=null;')
 .replace(enemyEntry,enemyEntry+"\n if(window.__isolatedKnight&&obj.type!=='monsterSkelKnight')return false;")
 .replace(probeAnchor,`  staffContactProbe:()=>{
   const weapon='equipLongStaff',profile=poiPlayerWeaponProfile(weapon);
   const facing=poiWalkFacing,[dx,dz]=[[0,-1],[1,0],[0,1],[-1,0]][facing];
   const mesh=poiBuildPlayerMesh(weapon,poiPlayerProfilePose(weapon,profile.hit),null,0,[2,3,0,1][facing]);
   let tip={x:0,z:0},max=0;
   for(let i=0;i<mesh.p.length;i+=3){
    const x=mesh.p[i],z=mesh.p[i+2],d=x*dx+z*dz;
    if(d>max){max=d;tip={x,z}}
   }
   return {max,tip,facing};
  },
  enemyMotionCycle:type=>[...poiMonsterStates].find(([o])=>o.type===type)?.[1]?.playerAttack?.start??null,
${probeAnchor}`)
 .replace(meshCalls,'poiWalkMesh=renderedStaffMesh($1);')
 .replace(meshLine,`${meshLine}
 const renderedStaffMesh=heading=>{
 const renderedPlayerProbe=poiBuildPlayerMesh(weapon,pose,gear,stride,[2,3,0,1][poiWalkFacing],x,y,z,heading,true);
 if(weapon==='equipLongStaff'&&pose?.staffThrust){
  const [dx,dz]=[[0,-1],[1,0],[0,1],[-1,0]][poiWalkFacing];
  let max=-Infinity,tip=null;
  for(let i=0;i<renderedPlayerProbe.p.length;i+=3){
   const xx=renderedPlayerProbe.p[i]-x,zz=renderedPlayerProbe.p[i+2]-z;
   const d=xx*dx+zz*dz;
   if(d>max){max=d;tip={x:xx,y:renderedPlayerProbe.p[i+1]-y,z:zz}}
  }
  (window.__realStaffTips||=[]).push({ms,facing:poiWalkFacing,max,tip});
 }
 return upload(renderedPlayerProbe);
 };`);
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url.startsWith('/seed')?'<!doctype html><title>Isolated fixtures</title>':observedHtml);
});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const origin='http://127.0.0.1:'+server.address().port;
const kitKey='world-workshop-hotbar-v1',resumeKey='world-workshop-resume-v1';
const editorKey='forest-world-editor-v1',personalEditor=JSON.stringify({format:'forest-world-v1',version:1,width:30,height:30,size:30,world:[{x:2,y:0,z:2,type:'stonewall',rot:1}],models:[],prefabs:[],terrainHeights:[],checks:[]});
const out=process.env.FACILITY_SCREENSHOTS;
if(out)await mkdir(out,{recursive:true});

const state=page=>page.evaluate(()=>window.__editorTest?.facility?.()??null);
const map=page=>page.evaluate(()=>window.__editorTest.data());
const stock=page=>page.evaluate(k=>localStorage.getItem(k),kitKey);
const pos=(x,z,y)=>({x,z,level:y});
async function launch(browser,start,facing,holding){
 const ctx=await browser.newContext({viewport:{width:390,height:740},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 await ctx.addInitScript(one=>{window.__isolatedKnight=one},!holding);
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
 await page.goto(origin+'/seed');
 const slots=Array(27).fill(null);
 slots[0]={type:'equipWoodSword',count:1};
 if(holding)slots[1]={type:staff,count:1,durability:48};
 const kit={version:1,weapon:null,potions:0,gold:12,claimedCaches:['glade'],slots};
 await page.evaluate(({start,facing,kit,kitKey,resumeKey,editorKey,personalEditor})=>{
  localStorage.setItem(kitKey,JSON.stringify(kit));
  localStorage.setItem(editorKey,personalEditor);
  localStorage.setItem('world-workshop-town-clock-v1',JSON.stringify({version:1,gameMs:10*60*500}));
  localStorage.setItem(resumeKey,JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:start.x,z:start.z,y:start.level,facing},townLayout:5,
   view:{yaw:.24,zoom:1.05,panX:0,panZ:0,level:start.level,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 },{start,facing,kit,kitKey,resumeKey,editorKey,personalEditor});
 await page.goto(origin+'/?resume=1&test=1');
 await page.waitForFunction(()=>window.__editorTest?.facility?.().active,null,{timeout:18000}).catch(async cause=>{
  const startup=await page.evaluate(()=>({title:document.title,isolated:window.__isolatedKnight,position:window.__editorTest?.facility?.()?.position,body:document.body.textContent.slice(0,160)}));
  throw new Error('Native staff/enemy fixture startup: '+JSON.stringify({holding,errors,startup}),{cause});
 });
 assert.deepEqual((await state(page)).position,start);
 return {ctx,page,errors};
}
async function nativeStaff(browser){
 const {ctx,page,errors}=await launch(browser,pos(102,88,0),1,true);
 try{
  await page.waitForFunction(type=>window.__editorTest.facility().combat.actors.some(t=>t.type===type&&t.level===0),archer);
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(()=>window.__editorTest.facility().position.x===103);
  await page.waitForTimeout(190);
  const before=await state(page),world=await map(page),target=before.combat.actors.find(o=>o.type===archer&&o.level===0);
  assert.deepEqual([target.x,target.z],[105,88],'regional archer birth is two tiles ahead');
  assert.equal(before.inventory.weapon,null);
  await page.locator('#poiHotbar [data-hotbar-slot="1"]').tap();
  assert.equal((await state(page)).inventory.weapon,staff);
  await page.locator('#poiWalkAction').tap();
  await page.waitForFunction(({archer,hp})=>window.__editorTest.facility().combat.actors.find(a=>a.type===archer&&a.level===0)?.hp===hp,
   {archer,hp:target.hp-20});
  // Some software-rendered frames skip over the narrow maximum extension.
  // The hit above is live; independently sample the exact production mesh
  // at the real contact time rather than demanding a particular FPS.
  const hit=await page.evaluate(()=>window.__editorTest.staffContactProbe());
  assert.equal(hit.facing,1,'equipped staff aims east with the player');
  assert(hit.tip.x>=1.5&&Math.abs(hit.tip.z)<.6,'real uploaded avatar vertices reach into the second cell along the attack ray');
  const after=await state(page);
  assert.deepEqual(after.position,before.position);
  assert.equal(after.inventory.hotbar[1].durability,47,'only one real hit spends one condition point');
  assert.deepEqual(await map(page),world);
  assert.equal(await page.evaluate(k=>localStorage.getItem(k),editorKey),personalEditor);
  if(out)await page.screenshot({path:out+'/v201-staff-native-hit.png'});
  assert.deepEqual(errors,[]);
 }finally{await ctx.close()}
}
async function enemyMotion(browser){
 const {ctx,page,errors}=await launch(browser,pos(106,79,-1),0,false);
 try{
  // Isolate the live authored knight from its neighbors in this fixture so
  // no unrelated strike or respawn obscures the two exact hit deltas.
  const world=await map(page),from=await state(page);
  assert(from.combat.actors.some(a=>a.type===knight&&a.visible&&a.x===106&&a.z===78));
  await page.evaluate(knight=>{
   const samples=window.__actualKnightMotion=[];
   const probe=()=>{
    const {combat,position}=window.__editorTest.facility();
    const actor=combat.actors.find(a=>a.type===knight);
    if(actor?.attack){
     const warning=combat.threats.find(t=>t.type===knight&&t.x===position.x&&t.z===position.z);
     samples.push({pose:actor.attack,warning,cycle:window.__editorTest.enemyMotionCycle(knight),hp:combat.playerHP,x:actor.x,z:actor.z});
    }
    window.__knightProbeFrame=requestAnimationFrame(probe);
   };
   probe();
  },knight);
  await page.waitForFunction(()=>{
   const a=window.__actualKnightMotion;
   return ['shield-cleave','shield-bash'].every(v=>a.some(w=>
    w.pose.variant===v&&w.warning&&a.some(s=>s.cycle===w.cycle&&(s.pose.phase==='impact'||s.pose.phase==='recover'))));
  },null,{timeout:15000});
  const traces=await page.evaluate(()=>{
   cancelAnimationFrame(window.__knightProbeFrame);
   return window.__actualKnightMotion;
  });
  const variants=['shield-cleave','shield-bash'];
  const motions=variants.map(v=>{
   const samples=traces.filter(s=>s.pose.variant===v);
   const forewarn=samples.find(w=>w.warning&&samples.some(s=>s.cycle===w.cycle&&(s.pose.phase==='impact'||s.pose.phase==='recover')));
   assert.deepEqual([forewarn.warning.x,forewarn.warning.z,forewarn.warning.y],[106,79,-1],'variant warns original adjacent tile');
   assert.equal(forewarn.warning.hit-forewarn.warning.start,700,'pose does not change the prior knight warning window');
   const attack=samples.find(s=>s.cycle===forewarn.cycle&&s.pose.phase==='impact')??samples.find(s=>s.cycle===forewarn.cycle&&s.pose.phase==='recover');
   assert.equal(forewarn.hp-attack.hp,16-2,'native contact does the established knight damage less 2 defense from starting cloth shorts');
   assert.deepEqual([attack.x,attack.z],[106,78],'animation does not move logically occupied enemy tile');
   return attack.pose;
  });
  assert(motions[0].twist>0&&motions[1].twist<0,'cleave and shield-bash bend to opposite sides at actual contact');
  assert.deepEqual((await state(page)).position,from.position);
  assert.deepEqual(await map(page),world);
  assert.deepEqual(errors,[]);
 }finally{await ctx.close()}
}
let browser;
try{
 browser=await chromium.launch({headless:true,
  ...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 if(process.env.STAFF_MOTION_CASE!=='enemy')await nativeStaff(browser);
 if(process.env.STAFF_MOTION_CASE!=='staff')await enemyMotion(browser);
 console.log('PASS native portrait Long Staff reaches its actual second tile and two original knight attacks use distinct motion');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
