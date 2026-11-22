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
  (window.__qaMovement??=[]).push({x:poiWalkX,z:poiWalkZ,y:poiWalkLevel,t:performance.now(),lock:poiWalkNextReady-poiWalkStarted});
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
const control=d=>'[data-poi-dir="'+d+'"]';
const lastStep=page=>page.evaluate(()=>window.__qaMovement.at(-1));
const waitAt=(page,p)=>page.waitForFunction(p=>{
 const s=window.__editorTest.facility().position;
 return s.x===p.x&&s.z===p.z&&s.level===p.level;
},p);
async function single(page,d,p){
 await page.locator(control(d)).tap();
 await waitAt(page,p);
 await page.waitForTimeout(300); // Wait past the slower committed shallow step.
 return lastStep(page);
}
async function quickPair(ctx,page,d){
 const r=await page.locator(control(d)).boundingBox();
 assert(r?.width&&r.height);
 const a={x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};
 const c=await ctx.newCDPSession(page);
 try{
  const send=(type,touchPoints)=>c.send('Input.dispatchTouchEvent',{type,touchPoints});
  await Promise.all([send('touchStart',[{...a,id:1}]),send('touchEnd',[]),send('touchStart',[{...a,id:2}]),send('touchEnd',[])]);
 }finally{await c.detach()}
}
async function chapel(browser){
 const {ctx,page,errors}=await launch(browser,'base',{x:123,z:82},{width:390,clockStart:9*60,kit,facing:1});
 try{
  const original=await getMap(page);
  assert.deepEqual(await readStock(page),kit,'no quest or key');
  if(out)await page.screenshot({path:out+'/v193-chapel-shore.png'});
  await single(page,'e',at(124,82,0));
  await single(page,'n',at(78,88,-1));
  let s=await state(page);
  assert.equal(s.miniMap.location,'水没した礼拝堂');
  assert.equal(s.miniMap.stars,'★★★☆☆');
  assert.equal(s.sceneLayer,'cellar');
  assert.equal(s.combat.threats.length,0,'chapel entrance is safely outside combat');
  assert.equal(s.dungeonEntranceSerial,1);
  await page.waitForFunction(()=>window.__editorTest.facility().musicZone==='chapel');
  const dry=await single(page,'n',at(78,87,-1));
  assert(Math.abs(dry.lock-175)<2,'original dry walking cadence');
  for(let x=79;x<=81;x++)await single(page,'e',at(x,87,-1));
  const edge=await single(page,'n',at(81,86,-1));
  assert(Math.abs(edge.lock-dry.lock)<2,'long dry side lane preserves normal cadence');
  await single(page,'s',at(81,87,-1));
  for(let x=80;x>=78;x--)await single(page,'w',at(x,87,-1));
  const near=await single(page,'n',at(78,86,-1));
  assert(near.lock>dry.lock+60,'actual shallow move imposes slower cooldown: '+JSON.stringify(near));
  if(out)await page.screenshot({path:out+'/v193-chapel-shallows.png'});
  const wetBlocked=await page.evaluate(()=>window.__editorTest.canStep(77,86,78,86));
  assert.equal(wetBlocked,false,'deep water off the wading lane remains impassable');
  await quickPair(ctx,page,'n');
  await page.waitForFunction(()=>window.__editorTest.facility().position.z<86);
  s=await state(page);
  assert.deepEqual(s.walk,{stepMs:265,walkMs:175});
  const before=s.position.z;
  await page.waitForTimeout(340);
  const slower=await single(page,'n',at(78,before-1,-1));
  assert(Math.abs(slower.lock-near.lock)<2,'quick repeated taps preserve shallow pace');
  assert.equal((await state(page)).walk.stepMs,265);
  for(let z=before;z<=88;z++)await single(page,'s',at(78,z,-1));
  await single(page,'s',at(124,82,0));
  assert.notEqual((await state(page)).miniMap.location,'水没した礼拝堂');
  assert.equal((await state(page)).dungeonEntranceSerial,1);
  await page.waitForFunction(()=>window.__editorTest.facility().musicZone==='outside');
  assert.equal((await readStock(page)).quests,undefined);
  assert.deepEqual(await readStock(page),kit);
  assert.deepEqual(await getMap(page),original);
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close()}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await chapel(browser);
 console.log('PASS no-quest chapel native stairs, dry and shallow steps, fixed shallow cadence, return and protected saves');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
