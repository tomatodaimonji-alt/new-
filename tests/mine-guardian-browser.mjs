import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
// Observation only: tag the native damage call by actual attacker before/after.
const hitAnchor='function poiMobHitPlayer(obj,now){';
assert.equal(html.split(hitAnchor).length,2,'unique native attack damage dispatcher');
const observed=html.replace(hitAnchor,`function poiMobHitPlayer(obj,now){
 const before=poiPlayerHP;
 try{return __mineObservedHit(obj,now)}
 finally{(window.__mineHits??=[]).push({type:obj.type,now,before,after:poiPlayerHP})}
}
function __mineObservedHit(obj,now){`);
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url.startsWith('/seed')?'<!doctype html><title>Isolated fixtures</title>':observed);
});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const origin='http://127.0.0.1:'+server.address().port;
const map={format:'forest-world-v1',version:1,width:30,height:30,size:30,
 world:[{x:2,y:0,z:2,type:'stonewall',rot:1},{x:15,y:0,z:12,type:'bed',rot:2}],
 models:[],prefabs:[],terrainHeights:[],checks:[]};
const guild={...map,world:[{x:7,y:0,z:6,type:'stonewall',rot:0}]};
const fixtures={
 'forest-world-editor-v1':JSON.stringify(map,null,2),
 'world-workshop-pois-v1':JSON.stringify([
  {id:'poi-guild-primary-v87',name:'ギルド',map:guild},
  {id:'poi-adventurers-guild-v102',name:'冒険者ギルド',map:guild}],null,2),
 'pine-guild-screenshot-before-v86':JSON.stringify(guild,null,2),
 'pine-adventurers-guild-poi-before-v102':JSON.stringify({keep:'fixture'}),
 'world-workshop-guild-duplicates-v105':JSON.stringify({version:1,records:[
  {id:'poi-old-archive',name:'冒険者ギルド',map:guild}]}),
 'world-workshop-adventure-v1':'{"version":1,"x":23,"z":24,"hp":84,"monsters":[]}',
 'world-workshop-audio-v2':'{"master":81,"bgm":62,"se":88,"enabled":true}'
};
const resumeKey='world-workshop-resume-v1';
const state=page=>page.evaluate(()=>window.__editorTest?.facility?.()??null);
async function unchanged(page){
 const before=await page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),Object.keys(fixtures));
 assert.deepEqual(before,fixtures,'route must not write existing editor, Guild/archives, adventure, or audio settings');
}
const out=process.env.FACILITY_SCREENSHOTS;
if(out)await mkdir(out,{recursive:true});
const open='#enterGameWorld';
async function launch(browser,id='base',start={x:19,z:45},{camera=false,yaw=.24,orbitYaw=0,pitch=.24,townLayout=5,facing=2,kit=null,clockStart=null,fixture='',dist=5.5,level=0,width=390,height=740}={}){
 const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:.65,isMobile:true,hasTouch:true});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
 await page.goto(origin+'/seed');
 await page.evaluate(({fixtures,resumeKey,id,start,camera,yaw,orbitYaw,pitch,townLayout,facing,kit,clockStart,dist,level})=>{
  for(const [k,v] of Object.entries(fixtures))localStorage.setItem(k,v);
  if(clockStart!==null)localStorage.setItem('world-workshop-town-clock-v1',JSON.stringify({version:1,gameMs:clockStart*500}));
  if(kit)localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify(kit));
  if(start)localStorage.setItem(resumeKey,JSON.stringify({version:1,route:'facility',id,play:true,position:{...start,y:level,facing},townLayout,
   view:{yaw,zoom:1.05,panX:0,panZ:0,level,hideUpper:false,top:false,third:camera,orbitYaw,orbitPitch:pitch,orbitDistance:dist}}));
 },{fixtures,resumeKey,id,start,camera,yaw,orbitYaw,pitch,townLayout,facing,kit,clockStart,dist,level});
 await page.goto(origin+'/'+fixture+(start?'?resume=1&test=1':'?facility='+id+'&test=1'));
 if(!start)await page.locator(open).tap();
 await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
 assert.equal((await state(page)).id,id);
 return {ctx,page,errors};
}
const dirs={n:[0,-1],s:[0,1],e:[1,0],w:[-1,0]};
const arrow={n:'ArrowUp',s:'ArrowDown',e:'ArrowRight',w:'ArrowLeft'};
async function move(page,d,required=true,touch=false){
 const {x,z}=(await state(page)).position,[dx,dz]=dirs[d];
 if(touch)await page.locator('[data-poi-dir="'+d+'"]').tap();else await page.keyboard.press(arrow[d]);
 try{
  await page.waitForFunction(([x,z])=>{
   const p=window.__editorTest.facility().position;return p.x===x&&p.z===z;
  },[x+dx,z+dz],{timeout:required?2700:500});
 }catch(err){
  if(required)throw new Error(`Walk ${arrow[d]} from (${x},${z}) did not reach (${x+dx},${z+dz}). Actual: ${JSON.stringify((await state(page)).position)}. Actors: ${JSON.stringify((await state(page)).combat.actors.map(a=>[a.type,a.x,a.z,a.hp,a.level]))}`,{cause:err});
  return;
 }
 await page.waitForTimeout(186);
}




const guardian='monsterMineGuard';
const action='#poiWalkAction';
const readMap=page=>page.evaluate(()=>window.__editorTest.data());
const readKit=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('world-workshop-hotbar-v1')||'null'));
const bladeKit={version:1,weapon:'equipWoodSword',potions:3,gold:12,claimedCaches:['glade']};
const actor=(s,id=guardian)=>s?.combat.actors.find(a=>a.type===id);
const marks=s=>s.combat.threats.filter(t=>t.type===guardian);
const readHits=page=>page.evaluate(()=>window.__mineHits?.filter(r=>r.type==='monsterMineGuard')||[]);
const tile=t=>[t.x,t.z,t.y];
const key=t=>tile(t).join(',');
const loc=(s,name,stars)=>{assert.equal(s.miniMap.location,name);assert.equal(s.miniMap.stars,stars);};
async function exploration(browser){
 const {ctx,page,errors}=await launch(browser,'base',{x:116,z:66},{width:390,height:700,facing:0,kit:bladeKit});
 try{
  const map=await readMap(page),url=page.url();
  assert.deepEqual([(await state(page)).position.x,(await state(page)).position.z],[116,66]);
  assert.ok(map.world.some(o=>o.x===116&&o.z===62&&o.y===0&&o.type==='guildStairDown'));
  assert.ok(map.world.some(o=>o.x===116&&o.z===62&&o.y===-1&&o.type==='guildStairUp'));
  assert.ok(map.world.some(o=>o.x===115&&o.z===59&&o.y===-1&&o.type==='monsterSlime'),'real authored early-mine slime');
  assert.ok(map.world.some(o=>o.x===120&&o.z===55&&o.y===-1&&o.type===guardian),'real boss actor, not browser-injected');
  for(let z=65;z>=62;z--){
   await move(page,'n',true,z===64);
   const f=await state(page);
   assert.deepEqual(f.position,{x:116,z,level:z===62?-1:0});
   if(z===64){
    loc(f,'廃坑入口','★★☆☆☆');
    assert.equal(marks(f).length,0,'boss never telegraphs on ground floor');
    if(out)await page.screenshot({path:out+'/v165-mine-entrance.png'});
   }
  }
  loc(await state(page),'廃坑','★★★☆☆');
  assert.equal(page.url(),url,'stairs in seamless Game World, no navigation');
  assert.equal((await state(page)).id,'base');
  assert.deepEqual(await readMap(page),map);
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
async function waitMark(page,after=0){
 const mark=await page.waitForFunction(after=>{
  const f=window.__editorTest.facility(),ts=f.combat.threats.filter(t=>t.type==='monsterMineGuard'&&t.start>after);
  return ts.length>0&&ts;
 },after,{timeout:10000,polling:'raf'});
 return mark.jsonValue();
}
async function endMark(page,start){
 await page.waitForFunction(start=>!window.__editorTest.facility().combat.threats.some(t=>t.type==='monsterMineGuard'&&t.start===start),start);
}
function assertSweep(w){
 assert.ok(w.length>=3&&w.length<=6,'three-wide two-deep sweep, trimmed by actual walls: '+JSON.stringify(w));
 assert.ok(w.every(t=>t.y===-1&&t.start===w[0].start&&t.hit===t.start+1050&&
  t.x>=119&&t.x<=121&&t.z>=56&&t.z<=57),'one immutable forward hazard in authored room');
 assert.ok(w.some(t=>t.x===120&&t.z===56),'center standing tile included');
 assert.equal(new Set(w.map(key)).size,w.length);
}
async function finishGuard(page){
 await page.keyboard.press('ArrowUp'); // facing north into the actual blocking guard, not teleporting
 for(const hp of [112,84,56,28,0]){
  await page.locator(action).tap();
  await page.waitForFunction(hp=>window.__editorTest.facility().combat.actors.some(a=>a.type==='monsterMineGuard'&&a.hp===hp),hp,{timeout:6500});
  if(hp)await page.waitForTimeout(315);
 }
}
async function combat(browser){
 const {ctx,page,errors}=await launch(browser,'base',{x:120,z:56},{width:390,height:700,level:-1,facing:0,kit:bladeKit});
 try{
  const map=await readMap(page),url=page.url(),first=await state(page);
  assert.equal(actor(first).hp,140);
  assert.equal(actor(first).level,-1);
  assert.equal(first.inventory.weapon,'equipWoodSword');
  const warning=await waitMark(page);
  assertSweep(warning);
  const t0=warning[0].start;
  await endMark(page,t0);
  const hits=await readHits(page);
  assert.equal(hits.length,1);
  assert.equal(hits[0].before-hits[0].after,18,'standing takes exact intended guardian damage once');
  const second=await waitMark(page,t0);
  assertSweep(second);
  assert.ok(second[0].start-t0>=2440,'normal recovery/cooldown not bypassed');
  await move(page,'w',true,true);
  await move(page,'w');
  const escaped=await state(page);
  assert.deepEqual(escaped.position,{x:118,z:56,level:-1},'real D-pad sidestep leaves marked area');
  const held=marks(escaped);
  if(held.length)assert.deepEqual(held.map(key).sort(),second.map(key).sort(),'telegraph never retargets moving player');
  assert.ok(!second.some(t=>t.x===118&&t.z===56),'end cell was never in committed strike');
  await endMark(page,second[0].start);
  assert.equal((await readHits(page)).length,1,'sidestep avoids second hit');
  await move(page,'e',true,true);await move(page,'e');
  const third=await waitMark(page,second[0].start);
  assertSweep(third);
  await move(page,'e',true,true);await move(page,'e');
  assert.deepEqual((await state(page)).position,{x:122,z:56,level:-1},'real D-pad exits the attack on the east as well');
  assert.ok(!third.some(t=>t.x===122&&t.z===56));
  await endMark(page,third[0].start);
  assert.equal((await readHits(page)).length,1,'east escape also avoids damage');
  for(let x=121;x>=120;x--)await move(page,'w');
  // Capturing screenshots can block software WebGL. Do it outside the two
  // timed damage assertions above, while the next windup is still visible.
  if(out){await waitMark(page,third[0].start);await page.screenshot({path:out+'/v165-guardian-warning.png'})}
  await finishGuard(page);
  const after=await state(page);
  assert.equal(after.economy.gold,21,'first actual lethal wood sword hit adds exactly 9G');
  const raw=await readKit(page);
  assert.equal(raw.claimedCaches.filter(k=>k==='mine-guardian').length,1);
  assert.ok(raw.claimedCaches.includes('glade'));
  await page.locator('#poiMessageLog .poiMessageLine').filter({hasText:/初討伐報酬：9G/}).waitFor({state:'visible'});
  if(out)await page.screenshot({path:out+'/v165-guardian-victory.png'});
  await page.reload();
  await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
  assert.equal((await state(page)).economy.gold,21);
  assert.ok((await readKit(page)).claimedCaches.includes('mine-guardian'));
  assert.equal(actor(await state(page)).hp,140,'authored enemy may respawn, first reward does not');
  await finishGuard(page);
  assert.equal((await state(page)).economy.gold,21,'no second reward after loading same playthrough');
  assert.equal(page.url(),url);
  assert.deepEqual(await readMap(page),map);
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
async function movingGuardian(browser){
 const {ctx,page,errors}=await launch(browser,'base',{x:117,z:55},{width:390,height:700,level:-1,facing:1,kit:bladeKit});
 try{
  const authored=await readMap(page);
  const step=(await page.waitForFunction(()=>{
   const g=window.__editorTest.facility().combat.actors.find(a=>a.type==='monsterMineGuard');
   return g?.move&&g;
  },null,{timeout:10000,polling:'raf'})).jsonValue();
  const moved=await step;
  assert.deepEqual([moved.move.fromX,moved.move.fromZ,moved.x,moved.z],[120,55,119,55],'approaches by one tile from the authored spawn');
  assert.equal(moved.move.duration,850);
  const warned=await waitMark(page);
  assert.equal(warned[0].hit-warned[0].start,1050,'existing warning wait is unchanged');
  assert.ok(warned[0].start>=moved.move.start+moved.move.duration,'cannot warn until footfall');
  assert.ok(warned.some(t=>t.x===117&&t.z===55&&t.y===-1));
  assert.ok(warned.every(t=>t.x>=117&&t.x<=118),'attack comes from the moved position toward the player');
  await move(page,'n',true,true);await move(page,'n');
  await endMark(page,warned[0].start);
  assert.equal((await readHits(page)).length,0,'dodge works after the guardian walks');
  const resting=actor(await state(page));
  assert.deepEqual([resting.x,resting.z],[119,55],'telegraph and impact do not move the guardian');
  assert.ok(!resting.move);
  await move(page,'s');await move(page,'s');await move(page,'e',true,true);
  await page.keyboard.press('ArrowRight');
  for(const hp of [112,84,56,28,0]){
   await page.locator(action).tap();
   await page.waitForFunction(hp=>window.__editorTest.facility().combat.actors.some(a=>a.type==='monsterMineGuard'&&a.hp===hp),hp,{timeout:6500});
   if(hp)await page.waitForTimeout(315);
  }
  assert.equal((await state(page)).economy.gold,21,'authored one-time reward still earned after guardian walks');
  assert.ok((await readKit(page)).claimedCaches.includes('mine-guardian'));
  await page.locator('#poiMessageLog .poiMessageLine').filter({hasText:/ゴーレムを倒した/}).waitFor({state:'visible'});
  assert.deepEqual(await readMap(page),authored,'walking does not rewrite the authored map');
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await exploration(browser);await combat(browser);await movingGuardian(browser);
 console.log('PASS real mobile Chromium mine entrance, cellar, guardian marks/left and right dodge, approach/stop/hit, repeat kill without duplicate reward, save protection');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
