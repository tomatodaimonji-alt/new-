import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const movementAnchor='function poiWalkStep(dx,dz){';
assert.equal(html.split(movementAnchor).length,2);
const observed=html.replace(movementAnchor,`function poiWalkStep(dx,dz){
 const before=[poiWalkX,poiWalkZ,poiWalkLevel];
 const result=__qaWalkStep(dx,dz);
 if(before.some((v,i)=>v!==[poiWalkX,poiWalkZ,poiWalkLevel][i]))
  (window.__qaMovement??=[]).push({x:poiWalkX,z:poiWalkZ,y:poiWalkLevel,t:performance.now()});
 return result;
}
function __qaWalkStep(dx,dz){`);
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
const openAt=async(page,x,z,fromX,fromZ)=>page.evaluate(([x,z,fx,fz])=>window.__editorTest.canStep(x,z,fx,fz),[x,z,fromX,fromZ]);
const morning=9*60;
const kit={version:1,weapon:null,potions:3,gold:12,claimedCaches:['glade']};
const at=(x,z,level)=>({x,z,level});
const dash=async page=>(await state(page)).dash;
const target=d=>'[data-poi-dir="'+d+'"]';
const traces=page=>page.evaluate(()=>window.__qaMovement||[]);
const clearTraces=page=>page.evaluate(()=>{window.__qaMovement=[]});
async function center(page,d){
 const r=await page.locator(target(d)).boundingBox();
 assert(r?.width&&r.height,'visible physical direction '+d);
 return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};
}
async function hold(ctx,page,d,ms){
 const point=await center(page,d),c=await ctx.newCDPSession(page);
 try{
  await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,id:1}]});
  await page.waitForTimeout(ms);
  await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 }finally{await c.detach()}
}
async function pair(ctx,page,first,second=first){
 const [a,b]=await Promise.all([center(page,first),center(page,second)]);
 const c=await ctx.newCDPSession(page);
 try{
  const d=(type,touchPoints)=>c.send('Input.dispatchTouchEvent',{type,touchPoints});
  await Promise.all([
   d('touchStart',[{...a,id:1}]),d('touchEnd',[]),d('touchStart',[{...b,id:2}]),d('touchEnd',[])
  ]);
 }finally{await c.detach()}
}
const intervals=t=>t.slice(1).map((v,i)=>Math.round(v.t-t[i].t));
async function dashRun(browser){
 const {ctx,page,errors}=await launch(browser,'base',{x:53,z:41},{width:390,clockStart:9*60,kit,facing:1});
 try{
  const original=await getMap(page);
  assert.equal((await dash(page)).active,false);
  assert.equal((await dash(page)).stamina,100);
  await clearTraces(page);await hold(ctx,page,'e',560);
  const walking=await traces(page);
  assert(walking.length>=2,'held input genuinely walks');
  assert.equal((await dash(page)).active,false,'autorepeat from one held press cannot impersonate double tap');
  assert.equal((await dash(page)).stamina,100);
  const walkMs=(await dash(page)).stepMs;
  await page.waitForTimeout(300);
  await pair(ctx,page,'w','e');
  assert.equal((await dash(page)).active,false,'opposite distinct taps must not enable dash');
  await page.waitForTimeout(300);
  await pair(ctx,page,'e');
  await page.waitForFunction(()=>window.__editorTest.facility().dash.active);
  const run=await dash(page);
  assert(run.dashMs<walkMs&&run.walkMs===walkMs,JSON.stringify(run));
  assert.equal(await page.locator('.poiPartyCard[data-party-slot="0"][data-dashing]').count(),1);
  await page.waitForTimeout(310);
  await clearTraces(page);await hold(ctx,page,'w',450);
  const running=await traces(page),spent=await dash(page);
  assert(running.length>=2,'dash genuinely traverses map cells');
  assert(spent.active,'ordinary hold does not toggle an existing dash');
  assert.equal(spent.stepMs,run.dashMs,'a committed tile uses dash cadence');
  assert.equal(run.stamina-spent.stamina,8*running.length,'stamina is spent only by actual moved tiles');
  assert.equal(Math.round(Number(await page.locator('#poiPlayerStamina').getAttribute('value'))),Math.round(spent.stamina));
  console.log('real moved walk/dash intervals',JSON.stringify({walk:intervals(walking),dash:intervals(running)}));
  // Actual rate-limit cadence is checked structurally rather than making a
  // hard upper bound on a software-rendered CI browser's scheduling jitter.
  assert(intervals(walking).every(t=>t>=walkMs-12)&&intervals(running).every(t=>t>=run.dashMs-12));
  await page.waitForTimeout(300);
  await pair(ctx,page,'w');
  await page.waitForFunction(()=>!window.__editorTest.facility().dash.active);
  const rest=(await dash(page)).stamina;
  await page.waitForFunction(s=>window.__editorTest.facility().dash.stamina>s+4,rest);
  await hold(ctx,page,'e',250);
  assert.equal((await dash(page)).stepMs,walkMs);
  assert.equal(await page.locator('.poiPartyCard[data-party-slot="0"][data-dashing]').count(),0);
  assert.deepEqual(await readStock(page),kit,'run mode never writes inventory/quest fields');
  assert.deepEqual(await getMap(page),original);
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close()}
}
function waitZone(page,zone){
 return page.waitForFunction(zone=>window.__editorTest.facility().musicZone===zone,zone);
}
async function mineArrival(browser){
 const {ctx,page,errors}=await launch(browser,'base',{x:116,z:63},{width:390,clockStart:9*60,kit,facing:0});
 try{
  const original=await getMap(page);
  assert(original.world.some(o=>o.x===116&&o.z===62&&o.y===0&&o.type==='guildStairDown'));
  await page.locator('#view').tap({position:{x:150,y:140}}); // trusted audio wake
  await waitZone(page,'outside');
  await move(page,'n',true,true);
  await page.waitForFunction(()=>window.__editorTest.facility().position.level===-1);
  assert.deepEqual((await state(page)).position,at(116,62,-1));
  await waitZone(page,'mine');
  assert.equal((await state(page)).dungeonEntranceSerial,1,'the actual mine stairs play one transition');
  const formed=original.world.filter(o=>o.y===-1&&o.type==='monsterSlime'&&o.x>=114&&o.x<=122&&o.z>=59&&o.z<=64);
  assert.equal(formed.length,2,'two true authored slimes deeper in the mine');
  assert.deepEqual(formed.map(({x,z})=>[x,z]).sort(),[[115,59],[120,62]]);
  await page.waitForTimeout(2500);
  let s=await state(page);
  assert.equal(s.combat.playerHP,100,'arriving player cannot be harmed by nearby encounters over multiple simulation ticks');
  assert.equal(s.combat.threats.length,0);
  assert.equal(s.combat.actors.filter(a=>a.type==='monsterSlime'&&a.level===-1&&a.hp>0).length,2);
  await move(page,'n',true,true);await move(page,'n',true,true);await move(page,'n',true,true);
  assert.deepEqual((await state(page)).position,at(116,59,-1));
  await page.waitForFunction(()=>window.__editorTest.facility().combat.threats.some(t=>t.type==='monsterSlime'&&t.y===-1));
  // Walk back to the original paired stair; activation must not take a quest.
  for(let i=0;i<3;i++)await move(page,'s',true,true);
  await page.waitForFunction(()=>window.__editorTest.facility().position.level===0);
  await waitZone(page,'outside');
  assert.equal((await state(page)).dungeonEntranceSerial,1,'mine exit does not replay the entrance effect');
  assert.equal((await readStock(page)).quests,undefined);
  assert.deepEqual(await getMap(page),original);
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close()}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await dashRun(browser);await mineArrival(browser);
 console.log('PASS native directional dash, stamina/walk recovery, safe actual Mine arrival, two live slimes and mine/BGM scope');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
