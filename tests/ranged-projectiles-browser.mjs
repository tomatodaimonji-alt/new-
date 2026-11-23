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
const bow='equipWoodBow',wand='fireWand';
const cases=[
 {name:'bow-south-hit',type:bow,x:105,z:83,y:0,facing:2,toX:105,toZ:88,range:5,damage:22,target:'monsterSkelArcher'},
 {name:'bow-west-miss',type:bow,x:110,z:70,y:0,facing:3,toX:105,toZ:70,range:5,damage:0},
 {name:'flame-east-hit',type:wand,x:97,z:88,y:0,facing:1,toX:105,toZ:88,range:8,damage:34,target:'monsterSkelArcher'}
];
assert.match(html,/fireWand:\{range:8,/, 'v200 flame range is eight actual cells, not v199 range five');
for(const c of cases){
 const tiles=site.map.world.filter(t=>t.x===c.toX&&t.z===c.toZ&&t.y===c.y);
 if(c.target)assert(site.armedEncounters.some(t=>t.type===c.target&&t.y===c.y&&Math.hypot(t.x-c.toX,t.z-c.toZ)===2),c.name+' fixture birth is local but distinct from authored loot anchor');
 assert(!tiles.some(t=>/wall|tree|gate/i.test(t.type)),c.name+' unobstructed authored endpoint');
}
if(process.env.RANGED_LAYOUT_ONLY==='1'){
 console.log('PASS v200 authored ranged fixtures and eight-cell native flame weapon profile');
 process.exit(0);
}

// Expose the production mesh sampler on this disposable HTTP fixture only.
const hook='  playerWeapon:()=>';
assert(html.includes(hook)&&html.includes('function poiPlayerProjectileSample('),'integrated renderer must expose a common actual projectile sampler');
const observedHtml=stableRegionalCombat(html,'monsterSkelArcher')
 .replace("function poiEnemyBeginPlayer(obj,s,now){","function poiEnemyBeginPlayer(obj,s,now){\n if(s.regionalWild&&obj.type==='monsterSkelArcher')return false;")
 .replace(hook,`  rangedProjection:()=>poiPlayerWeaponVisual?poiPlayerProjectileSample(poiPlayerWeaponVisual,performance.now()):null,
${hook}`);
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
async function launch(browser,c){
 const ctx=await browser.newContext({viewport:{width:390,height:740},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
 await page.goto(origin+'/seed');
 const slots=Array(27).fill(null);
 slots[0]={type:'equipWoodSword',count:1};
 slots[1]=c.type===bow?{type:bow,count:1,durability:24}:{type:wand,count:1,charges:5};
 const kit={version:1,weapon:null,potions:0,gold:12,claimedCaches:['glade'],slots};
 await page.evaluate(({c,kit,kitKey,resumeKey,editorKey,personalEditor})=>{
  localStorage.setItem(kitKey,JSON.stringify(kit));
  localStorage.setItem(editorKey,personalEditor);
  localStorage.setItem('world-workshop-town-clock-v1',JSON.stringify({version:1,gameMs:10*60*500}));
  localStorage.setItem(resumeKey,JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:c.x,z:c.z,y:c.y,facing:c.facing},townLayout:5,
   view:{yaw:.24,zoom:1.05,panX:0,panZ:0,level:c.y,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 },{c,kit,kitKey,resumeKey,editorKey,personalEditor});
 await page.goto(origin+'/?resume=1&test=1');
 await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
 assert.deepEqual((await state(page)).position,{x:c.x,z:c.z,level:c.y});
 assert.equal(JSON.parse(await stock(page)).weapon,null);
 return {ctx,page,errors};
}

const bar='#poiHotbar [data-hotbar-slot="1"]';
async function trail(browser,c){
 const {ctx,page,errors}=await launch(browser,c);
 try{
  const original=await map(page),url=page.url();
  if(c.target)await page.waitForFunction(type=>window.__editorTest.facility().combat.actors.some(t=>t.type===type&&t.level===0),c.target);
  const target=(await state(page)).combat.actors.find(t=>t.type===c.target&&t.level===c.y);
  if(c.target){
   assert(target?.hp>c.damage);
   assert.deepEqual([target.x,target.z],[c.toX,c.toZ],c.name+' launches from outside the authored enemy leash');
  }
  if(c.type===bow){
   await page.locator(bar).tap();
   assert.equal((await state(page)).inventory.weapon,bow);
  }
  const initial=await state(page);
  assert.equal(initial.inventory.hotbar[1].type,c.type);
  // Record the actual render-time projectile object in the page rather than
  // attempting a remote screenshot precisely during the short flight.
  await page.evaluate(()=>{
   const samples=window.__rangedSamples=[];
   const probe=()=>{
    const {pending,visual}=window.__editorTest.playerWeapon();
    if(pending||visual)samples.push({now:performance.now(),pending,visual,point:window.__editorTest.rangedProjection()});
    window.__rangedFrame=requestAnimationFrame(probe);
   };
   probe();
  });
  if(c.type===wand){
   await page.locator(bar).tap();
   const armed=await state(page);
   assert.equal(armed.inventory.hotbar[1].charges,initial.inventory.hotbar[1].charges,'arming does not spend a charge');
   assert.equal(await page.evaluate(()=>window.__editorTest.playerWeapon().pending),null,'arming launches no projectile');
  }
  await page.locator('#poiWalkAction').tap();
  await page.waitForFunction(({c,hp})=>{
   const s=window.__editorTest,view=s.playerWeapon();
   const seen=window.__rangedSamples.some(v=>v.visual?.type===c.type);
   const enemy=c.target&&s.facility().combat.actors.find(t=>t.type===c.target&&t.level===c.y);
   return seen&&!view.pending&&(!c.target||enemy?.hp===hp-c.damage);
  },{c,hp:target?.hp??0},{timeout:9000}).catch(async error=>{
  const failure=await page.evaluate(({type})=>({
   state:window.__editorTest.facility().combat.actors.filter(t=>t.type===type),
   weapon:window.__editorTest.playerWeapon(),input:window.__rangedSamples.slice(0,2),last:window.__rangedSamples.slice(-2)
  }),{type:c.target});
  throw new Error(c.name+': '+JSON.stringify(failure),{cause:error});
 });
  const frames=await page.evaluate(()=>{
   cancelAnimationFrame(window.__rangedFrame);
   return window.__rangedSamples;
  });
  const visible=frames.filter(f=>f.visual?.type===c.type).map(f=>f.visual);
  assert(visible.length>0,c.name+' genuine visible projectile state exists');
  const flight=frames.filter(f=>f.pending?.type===c.type&&f.pending.phase==='flight');
  assert(flight.length>0,c.name+' root action visibly traverses cells before contact/end');
  const first=visible[0];
  if(c.type===bow){
   const windup=frames.find(f=>f.pending?.type===bow&&f.pending.phase!=='flight');
   assert(windup&&first.started-windup.pending.started>=325,'arrow follows the half-length drawing animation, not immediate input');
  }
  assert.equal(first.travel,c.range*(c.type===bow?65:55),'visual stays in sync with native per-cell combat timing');
  assert.deepEqual([first.x,first.z,first.y,first.facing],[c.x,c.z,c.y,c.facing],c.name+' launches toward the actual attack facing');
  const ranged=visible.find(v=>Math.hypot(v.toX-c.toX,v.toZ-c.toZ)<1e-6);
  assert(ranged,c.name+' unblocked launch trace retains the true cardinal range');
  assert.equal(Math.hypot(ranged.toX-ranged.x,ranged.toZ-ranged.z),c.range);
  const impact=visible.find(v=>v.impact!==undefined);
  if(impact){
   const bodyEntry=Math.hypot(impact.toX-impact.x,impact.toZ-impact.z);
   if(c.target)assert(bodyEntry<=c.range+1e-6&&bodyEntry>=c.range-.35,c.name+' hit visually stops at swept body entry');
   else assert(Math.abs(bodyEntry-c.range)<1e-6,c.name+' miss reaches maximum actual range');
  }
  assert(flight.every(f=>(f.pending.cellMs??f.pending.profile?.cellMs)===(c.type===bow?65:55)));
  const points=frames.filter(f=>f.visual?.type===c.type&&f.point!==null).map(f=>f.point);
  assert(points.length>=2,c.name+' actual render-path samples were observed during flight');
  const dx=Math.sign(c.toX-c.x),dz=Math.sign(c.toZ-c.z);
  const projected=points.map(p=>{
   assert.deepEqual([p.dx,p.dz],[dx,dz],c.name+' geometry orientation tracks real cardinal fire direction');
   assert(Number.isFinite(p.y));
   if(p.progress!==undefined)assert(p.progress>=0&&p.progress<=1);
   assert(Math.abs(dx?p.z-(c.z+.5):p.x-(c.x+.5))<(c.type===bow ? .13 : .03),c.name+' rendered head stays within its bow-grip offset from the gameplay ray');
   return (p.x-c.x-.5)*dx+(p.z-c.z-.5)*dz;
  });
  assert(Math.max(...projected)-Math.min(...projected)>.9,c.name+' visibly advances more than a tile along its ray');
  assert(projected.every(n=>n>=-1e-6&&n<=c.range+1e-6),c.name+' rendered head never outruns the actual endpoint');
  const after=await state(page);
  assert.deepEqual(after.position,initial.position,'attack never moves or teleports the player');
  assert.equal(after.inventory.hotbar[1].type,c.type);
  if(c.type===bow)assert.equal(after.inventory.hotbar[1].durability,c.target?23:24,'wood bow wears once on hit, not on a miss');
  else{
   assert.equal(after.inventory.weapon,null,'wand arming does not overwrite the saved equipped-weapon field');
   assert.equal(after.inventory.hotbar[1].charges,4,'one successful attack consumes exactly one charge');
  }
  const final=await stock(page);
  assert.equal(JSON.parse(final).gold,12);
  assert.equal(JSON.parse(final).quests,undefined);
  assert.equal(page.url(),url);
  assert.deepEqual(await map(page),original);
  assert.equal(await page.evaluate(k=>localStorage.getItem(k),editorKey),personalEditor);
  if(out)await page.screenshot({path:out+'/v200-'+c.name+'.png'});
  await page.reload();await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
  assert.equal(await stock(page),final,'ammo/charge/durability persist after native action');
  assert.deepEqual(errors,[]);
 }finally{await ctx.close()}
}

let browser;
try{
 browser=await chromium.launch({headless:true,
  ...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 for(const c of cases.filter(c=>!process.env.RANGED_CASE||process.env.RANGED_CASE===c.name))await trail(browser,c);
 console.log('PASS native portrait five-cell directional arrow hit/miss, eight-cell flame hit, and single saved charge');
}finally{await browser?.close();await new Promise(r=>server.close(r));}

