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
 await ctx.addInitScript(()=>{
  const p=WebGLRenderingContext.prototype,known=new WeakSet(),current=new WeakMap();
  const get=p.getUniformLocation,set=p.uniform3f,draw=p.drawArrays,upload=p.bufferData;
  window.__daylight={seen:[],large:0};
  p.getUniformLocation=function(program,name){const loc=get.call(this,program,name);if(loc&&name==='uTownDaylight')known.add(loc);return loc};
  p.uniform3f=function(loc,x,y,z){if(known.has(loc))current.set(this,[x,y,z]);return set.call(this,loc,x,y,z)};
  p.drawArrays=function(...args){
   if(this.canvas?.id==='view'&&args[2]>0&&current.has(this)){
    const samples=window.__daylight.seen,triplet=current.get(this);
    if(samples.at(-1)!==triplet)samples.push(triplet);
    if(samples.length>150)samples.shift();
   }
   return draw.apply(this,args);
  };
  p.bufferData=function(target,source,usage){
   if(this.canvas?.id==='view'&&(source?.byteLength??0)>300000)window.__daylight.large++;
   return upload.call(this,target,source,usage);
  };
 });
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
const runTime=(page,absoluteMinute)=>page.evaluate(m=>window.__editorTest.setTownTime(m),absoluteMinute);
const clock=page=>page.evaluate(()=>window.__editorTest.townClock());
const clockLabel='#poiClockDay';
const clear=page=>page.evaluate(()=>{window.__daylight.seen=[]});
const large=page=>page.evaluate(()=>window.__daylight.large);
const getMap=page=>page.evaluate(()=>window.__editorTest.data());
const frames=page=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const triplet=page=>page.evaluate(()=>window.__daylight.seen.find(a=>a.some(v=>Math.abs(v-1)>.025))??window.__daylight.seen.at(-1));
async function atTime(page,t){
 assert.equal(await runTime(page,t),true);
 await clear(page);await frames(page);
 return triplet(page);
}
async function scenario(browser){
 const {ctx,page,errors}=await launch(browser,'base',{x:56,z:39},{width:390,clockStart:1440+12*60});
 try{
  const map=await getMap(page),initial=(await state(page)).position;
  await page.locator(clockLabel).filter({hasText:'2日目'}).waitFor({state:'visible'});
  assert.equal((await clock(page)).day,2);
  assert.match(await page.locator('#poiClockValue').innerText(),/^12:\d\d$/);
  await page.reload();
  await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
  await page.locator(clockLabel).filter({hasText:'2日目'}).waitFor({state:'visible'});
  const noon=await atTime(page,1440+720);
  assert(noon&&noon.every(v=>v>=.88),'real draw uses bright midday light: '+noon);
  const beforeUploads=await large(page);
  if(out)await page.locator('#view').screenshot({path:out+'/v184-noon.png'});
  const dawn=await atTime(page,1440+390);
  assert(dawn&&dawn[0]>dawn[2]+.035,'dawn uses a warm draw tint: '+dawn);
  if(out)await page.locator('#view').screenshot({path:out+'/v184-dawn.png'});
  const night=await atTime(page,1440);
  assert(night&&night[0]<noon[0]-.22&&night[2]>night[0]+.10&&night[0]>.38,
   'actual nighttime draw is visibly darker and cooler but remains readable: '+night);
  if(out)await page.locator('#view').screenshot({path:out+'/v184-night.png'});
  assert.equal(await large(page),beforeUploads,'clock changes do not rebuild or reupload the surface mesh');
  assert.deepEqual((await state(page)).position,initial);
  assert(!await page.locator('#view').evaluate(el=>getComputedStyle(el).filter!=='none'),'color treatment is not a full canvas/browser filter');
  await runTime(page,2879);
  await page.locator(clockLabel).filter({hasText:'3日目'}).waitFor({state:'visible'});
  assert.equal((await clock(page)).day,3,'real running clock crosses midnight and increments day');
  assert.deepEqual(await getMap(page),map);
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close()}
}
async function cellarNeutral(browser){
 const {ctx,page,errors}=await launch(browser,'base',{x:28,z:32},{width:390,level:-1,clockStart:1440});
 try{
  assert.equal((await state(page)).position.level,-1);
  await atTime(page,1440);await frames(page);
  const seen=await page.evaluate(()=>window.__daylight.seen);
  assert(seen.length&&seen.every(v=>v.every(x=>Math.abs(x-1)<.02)),'underground draws keep original lighting');
  await page.locator('#poiWalkToggle').tap();
  await page.waitForFunction(()=>window.__editorTest.facility().mode==='editor');
  await page.locator('#poiClockHud').waitFor({state:'hidden'});
  await clear(page);await frames(page);
  const editor=await page.evaluate(()=>window.__daylight.seen);
  assert(editor.every(v=>v.every(x=>Math.abs(x-1)<.02)),'ordinary editor remains uncolored');
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close()}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await scenario(browser);await cellarNeutral(browser);
 console.log('PASS daylight scene uniforms, day count across midnight/reload, no large VBO churn, unaffected cellar and editor');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
