import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url.startsWith('/seed')?'<!doctype html><title>Isolated fixtures</title>':html);
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
async function launch(browser,id='base',start={x:19,z:45},{camera=false,yaw=.24,orbitYaw=0,pitch=.24,townLayout=5,facing=2,kit=null,clockStart=null,fixture='',dist=5.5,level=0,width=390}={}){
 const ctx=await browser.newContext({viewport:{width,height:740},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
 await page.goto(origin+'/seed');
 await page.evaluate(({fixtures,resumeKey,id,start,camera,yaw,orbitYaw,pitch,townLayout,facing,kit,clockStart,dist,level})=>{
  for(const [k,v] of Object.entries(fixtures))localStorage.setItem(k,v);
  if(clockStart!==null)localStorage.setItem('world-workshop-town-clock-v1',JSON.stringify({version:1,gameMs:clockStart*500}));
  if(kit)localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify(kit));
  if(start)localStorage.setItem(resumeKey,JSON.stringify({version:1,route:'facility',id,play:true,position:{...start,y:level,facing},townLayout,
   view:{yaw,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:camera,orbitYaw,orbitPitch:pitch,orbitDistance:dist}}));
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
  if(required)throw new Error(`Walk ${arrow[d]} from (${x},${z}) did not reach (${x+dx},${z+dz}). Actual: ${JSON.stringify((await state(page)).position)}`,{cause:err});
  return;
 }
 await page.waitForTimeout(186);
}
const getMap=page=>page.evaluate(()=>window.__editorTest.data());
const worldKit='world-workshop-hotbar-v1';
const readStock=page=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),worldKit);
const openAt=async(page,x,z)=>page.evaluate(([x,z])=>window.__editorTest.canStep(x,z),[x,z]);
const morning=9*60;
const kit={version:1,weapon:'equipWoodSword',potions:3,gold:12,claimedCaches:['glade']};
const guard=s=>s.combat.actors.find(a=>a.type==='monsterMineGuard');
const coord=(x,z,level=-1)=>({x,z,level});
const actionButton='#poiWalkAction',progress='#poiMineUnlockProgress',chestPanel='#poiChestPanel';
const chestCell=i=>chestPanel+' [data-chest-slot="'+i+'"]';
const check=async page=>{await page.waitForFunction(()=>window.__editorTest?.facility?.().active)};
async function relocate(page,x,z,facing=0){
 await page.evaluate(({resumeKey,x,z,facing})=>{
  const raw=JSON.parse(localStorage.getItem(resumeKey));
  raw.position={x,z,y:-1,facing};raw.view={...raw.view,level:-1,top:false,third:false};
  localStorage.setItem(resumeKey,JSON.stringify(raw));
 },{resumeKey,x,z,facing});
 await page.reload();await check(page);
 assert.deepEqual((await state(page)).position,coord(x,z));
}
async function finishGolem(page){
 const initial=guard(await state(page));
 assert.deepEqual([initial.x,initial.z],[120,55]);
 assert(initial.hp>0&&initial.level===-1);
 let hp=initial.hp;
 while(hp>0){
  hp=Math.max(0,hp-28);
  await page.locator(actionButton).tap();
  await page.waitForFunction(hp=>window.__editorTest.facility().combat.actors.some(a=>a.type==='monsterMineGuard'&&a.hp===hp),hp,{timeout:6500});
  if(hp)await page.waitForTimeout(365);
 }
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('world-workshop-hotbar-v1'))?.mineGateCleared===true);
}
async function dragFromChest(ctx,page,i,bagIndex){
 const box=async sel=>{
  const r=await page.locator(sel).boundingBox();assert(r&&r.width&&r.height,'real touch target '+sel);
  return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};
 };
 const a=await box(chestCell(i)),b=await box('#poiBagGrid [data-bag-slot="'+bagIndex+'"]');
 const c=await ctx.newCDPSession(page);
 try{
  await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...a,id:1}]});
  for(let n=1;n<=7;n++)await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{
   id:1,x:Math.round(a.x+(b.x-a.x)*n/7),y:Math.round(a.y+(b.y-a.y)*n/7)
  }]});
  await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 }finally{await c.detach()}
}
async function startUnlock(page){
 await page.waitForFunction(()=>/宝箱|開ける|開錠|解錠/.test(
  [document.querySelector('#poiWalkAction').getAttribute('aria-label'),document.querySelector('#poiWalkAction').textContent].join(' ')));
 await page.locator(actionButton).tap();
 await page.locator(progress).waitFor({state:'visible'});
 const meter=page.locator(progress);
 assert.equal(await meter.innerText(),'','no visible unlock caption');
 assert((await meter.boundingBox()).width<=62,'compact projected gauge, not the old screen panel');
 assert(await meter.locator('progress').getAttribute('aria-label'));
}
async function throughGate(ctx,page){
 const original=await getMap(page);
 assert(original.world.some(o=>o.type==='ironGate'&&o.x===121&&o.z===47&&o.y===-1));
 assert(original.world.some(o=>o.type==='rewardChest'&&o.x===121&&o.z===43&&o.y===-1));
 assert.deepEqual((await state(page)).position,coord(121,48));
 assert.equal(await openAt(page,121,47),false,'iron gate is physically blocked before defeating the Golem');
 await page.locator('[data-poi-dir="n"]').tap();
 await page.waitForTimeout(225);
 assert.deepEqual((await state(page)).position,coord(121,48));
 assert.deepEqual(await readStock(page),kit,'locked gate does not modify player state or require quest');
 await relocate(page,120,56);
 const before=await readStock(page);
 assert(!before.quests);
 await finishGolem(page);
 const cleared=await readStock(page);
 assert.equal(cleared.mineGateCleared,true);assert(!cleared.quests);
 assert.equal(cleared.claimedCaches.filter(x=>x==='mine-guardian').length,1,'legacy first-kill reward remains once');
 await relocate(page,121,48);
 assert.equal(await openAt(page,121,47),true,'gate is traversable after persisted Golem defeat and reload');
 for(let z=47;z>=44;z--){
  await move(page,'n',true,true);
  assert.deepEqual((await state(page)).position,coord(121,z));
 }
 assert.equal((await readStock(page)).mineTreasureChest,undefined);
 await startUnlock(page);
 assert.equal(await page.locator(chestPanel).isVisible(),false,'opening is timed, not instant');
 await page.waitForTimeout(550);
 await move(page,'s',true,true);
 await page.locator(progress).waitFor({state:'hidden'});
 await page.waitForTimeout(2650);
 assert.equal((await readStock(page)).mineTreasureChest,undefined,'moving cancels the attempt without rolling contents');
 assert.equal(await page.locator(chestPanel).isVisible(),false);
 await move(page,'n',true,true);
 await page.evaluate(()=>{
  window.__qaUnlockMs=null;
  document.querySelector('#poiWalkAction').addEventListener('click',()=>{
   const start=performance.now(),box=document.querySelector('#poiChestPanel');
   const obs=new MutationObserver(()=>{
    if(!box.hidden){window.__qaUnlockMs=performance.now()-start;obs.disconnect()}
   });obs.observe(box,{attributes:true,attributeFilter:['hidden']});
  },{once:true,capture:true});
 });
 await startUnlock(page);
 await page.locator(chestPanel).waitFor({state:'visible',timeout:9000});
 await page.waitForFunction(()=>Number.isFinite(window.__qaUnlockMs));
 const ms=await page.evaluate(()=>window.__qaUnlockMs);
 assert(ms>=2800&&ms<6500,'timed open is about three real seconds: '+ms);
 await page.locator(progress).waitFor({state:'hidden'});
 const opened=await readStock(page);
 assert.equal(opened.mineTreasureChest.version,1);
 assert.equal(opened.mineTreasureChest.slots.length,18);
 const first=opened.mineTreasureChest.slots.findIndex(Boolean);
 assert(first>=0,'authored treasure chest contains loot');
 const loot=opened.mineTreasureChest.slots[first];
 await dragFromChest(ctx,page,first,0);
 await page.waitForFunction(i=>JSON.parse(localStorage.getItem('world-workshop-hotbar-v1')).mineTreasureChest.slots[i]===null,first);
 assert.deepEqual((await state(page)).inventory.bag[0],loot,'transfers actual one persisted chest stack into player inventory');
 const stored=await readStock(page);
 await page.locator('#poiChestClose').tap();
 await page.reload();await check(page);
 assert.deepEqual(await readStock(page),stored);
 await page.locator(actionButton).tap();
 await page.locator(chestPanel).waitFor({state:'visible'});
 assert.equal(await page.locator(progress).isVisible(),false,'opened chest does not require another timed roll');
 assert.deepEqual(await readStock(page),stored,'reopening and reload never refill taken chest loot');
 assert.deepEqual(await getMap(page),original);
 if(out)await page.screenshot({path:out+'/v190-open-vault.png'});
}
const canCount=s=>[...s.inventory.hotbar,...s.inventory.bag].reduce((n,c)=>n+(c?.type==='cannedFood'?c.count:0),0);
async function sideLoot(browser){
 const {ctx,page,errors}=await launch(browser,'base',{x:110,z:55},{level:-1,width:390,clockStart:morning,kit,facing:3});
 try{
  const original=await getMap(page),raw=await readStock(page);
  assert.deepEqual((await state(page)).position,coord(110,55));
  assert.equal(canCount(await state(page)),0);
  assert.equal(await openAt(page,109,55),true,'hidden side loot sits on a physically accessible B1 floor');
  const before=raw.mineFindClaims??[];
  await move(page,'w',true,true);
  await page.waitForFunction(()=>[...window.__editorTest.facility().inventory.hotbar,...window.__editorTest.facility().inventory.bag].some(c=>c?.type==='cannedFood'));
  const claimed=await readStock(page);
  assert.equal(claimed.mineFindClaims.length,before.length+1,'single side find is claimed durably');
  assert.equal(canCount(await state(page)),1);
  assert(!claimed.quests&&!claimed.mineGateCleared,'side loot requires neither quest nor Golem kill');
  await page.reload();await check(page);
  assert.deepEqual((await state(page)).position,coord(109,55));
  await move(page,'e',true,true);await move(page,'w',true,true);
  // v194 adds a real warrior to this storeroom. It may wear armor while
  // the historical fixed can and every unrelated save field stay unchanged.
  const cacheState=({wornDurability,...remaining})=>remaining;
  assert.deepEqual(cacheState(await readStock(page)),cacheState(claimed),'same floor cache never respawns after reload');
  assert.equal(canCount(await state(page)),1);
  assert.deepEqual(await getMap(page),original);
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close()}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await sideLoot(browser);
 const {ctx,page,errors}=await launch(browser,'base',{x:121,z:48},{level:-1,width:390,clockStart:morning,kit,facing:0});
 try{await throughGate(ctx,page);await unchanged(page);assert.deepEqual(errors,[])}finally{await ctx.close()}
 console.log('PASS real B1 loot and Golem gate without quest, cancellable three-second vault unlock, actual touch transfer and no duplicates after reload');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
