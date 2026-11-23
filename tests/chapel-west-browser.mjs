import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {mkdir} from 'node:fs/promises';
import vm from 'node:vm';

const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const begin=html.indexOf('const FACILITY_SITES=Object.freeze('),end=html.indexOf('function workshopResumeDecode(',begin);
assert(begin>=0&&end>begin);
const site=vm.runInNewContext(html.slice(begin,end)+";buildFacilitySite('base')");
const chapel=site.chapel;
assert(chapel.bounds.x1<=64,'v204 adds the Western Chapel to the actual B1 realm');
const landing=[78,88],entrance=[124,82],south=[74,87],north=[74,80],choir=[75,80],reward=[65,88],slime=[64,81];
const key=(x,z)=>x+','+z;
const terrain=new Map();
for(const o of site.map.world)if(o.y===-1){
 const k=key(o.x,o.z);if(!terrain.has(k))terrain.set(k,[]);terrain.get(k).push(o);
}
const cells=(x,z)=>terrain.get(key(x,z))??[];
const dry=(x,z)=>{
 const c=cells(x,z);
 return c.some(o=>/^(?:stone|moss|road\w+)$/.test(o.type))&&c.every(o=>
  /^(?:stone|moss|road\w+|ruinDoorBroken|benchWood|monster\w+|bushFern|guildStairUp|flowerField|tallGrass)$/.test(o.type));
};
const directions=[[1,0,'ArrowRight'],[-1,0,'ArrowLeft'],[0,1,'ArrowDown'],[0,-1,'ArrowUp']];
function path(a,b,permits){
 const todo=[[a,[]]],seen=new Set([key(...a)]);
 for(let i=0;i<todo.length;i++){
  const [[x,z],path]=todo[i];
  if(x===b[0]&&z===b[1])return path;
  for(const [dx,dz,d] of directions){
   const tx=x+dx,tz=z+dz,k=key(tx,tz);
   if(seen.has(k)||!permits(tx,tz))continue;
   todo.push([[tx,tz],[...path,{x:tx,z:tz,d}]]);seen.add(k);
  }
 }
 throw new Error('No authored dry path from '+a+' to '+b);
}
const leftDry=(x,z)=>x<=74&&z>=79&&z<=89&&dry(x,z);
const incoming=path(landing,south,(x,z)=>x>=74&&z>=87&&dry(x,z));
const discovery=path(south,reward,leftDry);
const farSeam=path(reward,north,leftDry);
const oldSide=path(north,choir,(x,z)=>z===80&&x>=74&&x<=75&&dry(x,z));
const retreat=path(north,south,leftDry);
assert(incoming.length+discovery.length+farSeam.length>=18);
assert(cells(...slime).some(o=>o.type==='monsterSlime'),'real western threat in authored map');
assert.equal(cells(78,77).some(o=>o.type==='ironGate'),true);
assert.throws(()=>path(landing,[78,76],(x,z)=>dry(x,z)||cells(x,z).some(o=>o.type==='water')&&x===78&&z>=81&&z<=86),/No authored dry path/);
if(process.env.CHAPEL_WEST_LAYOUT_ONLY==='1'){
 console.log('PASS v204 two dry seams, native layout path and old gated vault not bypassed');
 process.exit(0);
}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const actorInit='if(poiIsMonster(o.type)&&';
assert.equal(html.split(actorInit).length,2);
// Leave the old chapel's actors and all map geometry/physics intact. Only
// the added slime is isolated for the deterministic loop/pickup fixture.
const quiet=html.replace(actorInit,actorInit+"!(o.type==='monsterSlime'&&o.x===64&&o.z===81&&o.y===-1)&&");
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url.startsWith('/seed')?'<!doctype html><title>Isolated fixtures</title>':req.url.startsWith('/quiet')?quiet:html);
});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const origin='http://127.0.0.1:'+server.address().port;
const kitKey='world-workshop-hotbar-v1',resumeKey='world-workshop-resume-v1';
const fixtures={
 [kitKey]:'{"version":1,"weapon":"equipWoodSword","potions":0,"gold":12,"claimedCaches":["glade"]}',
 'forest-world-editor-v1':'{"format":"forest-world-v1","version":1,"width":30,"height":30,"size":30,"world":[{"x":2,"y":0,"z":2,"type":"stonewall","rot":1}],"models":[],"prefabs":[],"terrainHeights":[],"checks":[]}',
 'world-workshop-audio-v2':'{"master":70,"bgm":40,"se":50,"enabled":true}'
};
const out=process.env.FACILITY_SCREENSHOTS;if(out)await mkdir(out,{recursive:true});
const api=page=>page.evaluate(()=>window.__editorTest.facility());
const map=page=>page.evaluate(()=>window.__editorTest.data());
const stock=page=>page.evaluate(key=>localStorage.getItem(key),kitKey);
const pos=(x,z,level=-1)=>({x,z,level});
const active=page=>page.waitForFunction(()=>window.__editorTest?.facility?.().active);
async function launch(browser,start,quiet=false){
 const ctx=await browser.newContext({viewport:{width:390,height:740},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
 await page.goto(origin+'/seed');
 await page.evaluate(({fixtures,resumeKey,start})=>{
  for(const [k,v] of Object.entries(fixtures))localStorage.setItem(k,v);
  localStorage.setItem('world-workshop-town-clock-v1',JSON.stringify({version:1,gameMs:10*60*500}));
  localStorage.setItem(resumeKey,JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:start.x,z:start.z,y:start.level,facing:0},townLayout:5,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:start.level,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 },{fixtures,resumeKey,start});
 await page.goto(origin+(quiet?'/quiet':'/')+'?resume=1&test=1');
 await active(page);
 assert.deepEqual((await api(page)).position,start);
 return {ctx,page,errors};
}
async function waitPosition(page,x,z,level=-1){
 await page.waitForFunction(([x,z,level])=>{
  const p=window.__editorTest.facility().position;return p.x===x&&p.z===z&&p.level===level;
 },[x,z,level],{timeout:5000});
}
async function walk(page,steps){
 for(const {x,z,d} of steps){
  await page.keyboard.press(d);
  try{await waitPosition(page,x,z)}
  catch(e){throw new Error('Real walk to '+[x,z]+' stopped at '+JSON.stringify((await api(page)).position),{cause:e})}
  await page.waitForTimeout(211);
 }
}
async function realm(page){
 await page.waitForFunction(()=>window.__editorTest.facility().musicZone==='chapel',null,{timeout:9000});
 const s=await api(page);
 assert.equal(s.miniMap.location,'水没した礼拝堂');
 assert.equal(s.miniMap.stars,'★★★☆☆');
 assert.equal(s.sceneLayer,'cellar');
 const shown=s.combat.actors.filter(a=>a.visible&&a.hp>0).map(a=>a.type);
 assert(!shown.includes('monsterMineGuard')&&!shown.includes('monsterDragon'),'no floating actors from mine or Star Corridor');
}
const canCount=i=>[...i.hotbar,...i.bag].reduce((n,c)=>n+(c?.type==='cannedFood'?c.count:0),0);
async function loop(browser){
 const {ctx,page,errors}=await launch(browser,pos(...entrance,0),true);
 try{
  const world=await map(page),url=page.url();
  await page.locator('[data-poi-dir="n"]').tap();
  await waitPosition(page,...landing);await realm(page);
  assert.equal((await api(page)).combat.threats.length,0,'old landing remains safe');
  assert.equal(await stock(page),fixtures[kitKey]);
  await page.waitForTimeout(211);
  await walk(page,incoming);await walk(page,discovery);
  await realm(page);
  const persisted=await stock(page);
  assert.equal(canCount((await api(page)).inventory),1,'normal dry path finds one can');
  assert.equal(JSON.parse(persisted).chapelWestSupplyFound,true);
  await page.reload();await active(page);
  assert.deepEqual((await api(page)).position,pos(...reward));
  assert.equal(await stock(page),persisted);
  await page.locator('#poiWalkAction').tap(); // ordinary gesture resumes the audio scheduler
  await walk(page,farSeam.slice(0,1));
  await walk(page,path([farSeam[0].x,farSeam[0].z],reward,leftDry));
  assert.equal(canCount((await api(page)).inventory),1,'reentering exact reward tile after reload never replenishes it');
  await walk(page,farSeam);
  await realm(page);
  // Cross the new northern door into the old choir whenever an original
  // patrolling opponent isn't occupying the tile; never disable legacy foes.
  const clear=await page.evaluate(()=>window.__editorTest.canStep(75,80,74,80));
  if(clear){await walk(page,oldSide);await walk(page,[{x:74,z:80,d:'ArrowLeft'}])}
  else assert((await api(page)).combat.actors.some(a=>a.hp>0&&a.level===-1&&a.x===75&&a.z===80),'only live existing actor may transiently block old choir tile');
  assert.equal(await page.evaluate(()=>window.__editorTest.canStep(78,77,78,78)),false);
  await walk(page,retreat);await walk(page,path(south,landing,(x,z)=>x>=74&&z>=87&&dry(x,z)));
  await page.keyboard.press('ArrowDown');await waitPosition(page,...entrance,0);
  assert.equal((await api(page)).sceneLayer,'surface');
  assert.notEqual((await api(page)).miniMap.location,'水没した礼拝堂');
  assert.equal(canCount((await api(page)).inventory),1,'no second reward from a native return loop');
  const k=JSON.parse(await stock(page));
  assert.equal(k.chapelWestSupplyFound,true);assert.equal(k.chapelCleared,undefined);assert.equal(k.chapelChest,undefined);assert.equal(k.quests,undefined);
  assert.equal(page.url(),url);assert.deepEqual(await map(page),world);
  for(const [k,v] of Object.entries(fixtures))if(k!==kitKey)assert.equal(await page.evaluate(key=>localStorage.getItem(key),k),v);
  assert.deepEqual(errors,[]);
 }finally{await ctx.close()}
}
async function threat(browser){
 const {ctx,page,errors}=await launch(browser,pos(72,80),false);
 try{
  const s=await api(page);
  assert(s.combat.actors.some(a=>a.type==='monsterSlime'&&a.level===-1&&a.visible&&a.hp>0&&a.x<=68),'real western slime visible in unmodified production');
  assert(s.combat.actors.some(a=>a.type==='monsterSkeleton'&&a.level===-1&&a.visible&&a.hp>0&&a.x>=75),'old warden remains in same chapel');
  await page.locator('#poiWalkAction').tap();await realm(page);
  if(out)await page.screenshot({path:out+'/v204-chapel-west-open.png'});
  assert.deepEqual(errors,[]);
 }finally{await ctx.close()}
}
let browser;
try{
 browser=await chromium.launch({headless:true,
  ...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 if(process.env.CHAPEL_WEST_CASE!=='threat')await loop(browser);
 if(process.env.CHAPEL_WEST_CASE!=='loop')await threat(browser);
 console.log('PASS native portrait Chapel dry loop, existing stairs, scoped threats and durable discovery');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
