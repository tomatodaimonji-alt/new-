import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const coverage=process.env.WORKSHOP_BROWSER_FOCUS??'both';
assert(['both','entrance','bgm'].includes(coverage));
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url.startsWith('/seed')?'<!doctype html><title>Isolated fixtures</title>':html);
});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const origin='http://127.0.0.1:'+server.address().port;
const out=process.env.FACILITY_SCREENSHOTS;
if(out)await mkdir(out,{recursive:true});

const map={format:'forest-world-v1',version:1,width:30,height:30,size:30,
 world:[{x:1,y:0,z:2,type:'stonewall',rot:0}],models:[],prefabs:[],terrainHeights:[],checks:[]};
const fixtures={
 'forest-world-editor-v1':JSON.stringify(map,null,2),
 'world-workshop-pois-v1':JSON.stringify([{id:'poi-guild-primary-v87',name:'ギルド',map}],null,2),
 'world-workshop-adventure-v1':'{"version":1,"x":23,"z":24,"monsters":[]}',
 'world-workshop-audio-v2':'{"master":82,"bgm":62,"se":88,"enabled":true}'
};
async function seed(page){
 await page.goto(origin+'/seed');
 await page.evaluate(data=>{for(const [k,v] of Object.entries(data))localStorage.setItem(k,v)},fixtures);
}
async function unchanged(page){
 const raw=await page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),Object.keys(fixtures));
 assert.deepEqual(raw,fixtures,'view/navigation and mixer lifecycle must not touch saved map or settings');
}
async function letPaint(page){await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}

const visible='.facilityEntranceGuide:not([hidden]):visible';
const mark=(page,id)=>page.locator(visible+'[data-entrance="'+id+'"]');
const guides=page=>page.locator(visible);
async function zeroGuides(page,message){await letPaint(page);assert.equal(await guides(page).count(),0,message);}
async function walkToLodging(page){
 const path=await page.evaluate(()=>{
  const {position}=window.__editorTest.facility(),key=(x,z)=>x+','+z;
  const target={x:19,z:10},q=[{...position,route:[]}],seen=new Set([key(position.x,position.z)]);
  for(let i=0;i<q.length;i++){
   const {x,z,route}=q[i];
   if(x===target.x&&z===target.z)return route;
   for(const [dx,dz,dir] of [[0,-1,'ArrowUp'],[1,0,'ArrowRight'],[-1,0,'ArrowLeft'],[0,1,'ArrowDown']]){
    const a=x+dx,b=z+dz,k=key(a,b);
    if(a<14||a>24||b<9||b>24||seen.has(k)||!window.__editorTest.canStep(a,b))continue;
    seen.add(k);q.push({x:a,z:b,route:[...route,{x:a,z:b,dir}]});
   }
  }
  return null;
 });
 assert.ok(path?.length>0,'interior target reachable by actual player collision checks');
 for(const {x,z,dir} of path){
  await page.keyboard.press(dir);
  await page.waitForFunction(([x,z])=>{const p=window.__editorTest.facility().position;return p.x===x&&p.z===z;},[x,z]);
  await page.waitForTimeout(192);
 }
}

async function entrances(browser){
 const context=await browser.newContext({viewport:{width:1200,height:800}});
 try{
  const page=await context.newPage(), errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.setDefaultTimeout(12000);
  await seed(page);
  await page.goto(origin+'/?facility=base&test=1');
  await page.waitForFunction(()=>window.__editorTest?.facility?.().id==='base');
  await zeroGuides(page,'oblique editor must remain quiet');
  await page.locator('#poiThirdView').click();
  await mark(page,'lodging').waitFor({state:'visible'});
  const expected={lodging:[19,12],kitchen:[12,17],workshop:[26,16],stable:[10,42]};
  for(const [id,coords] of Object.entries(expected)){
   const marker=mark(page,id);
   await marker.waitFor({state:'visible'});
   const data=await marker.evaluate(el=>{
    const r=el.getBoundingClientRect(), style=getComputedStyle(el);
    return {x:Number(el.dataset.x),z:Number(el.dataset.z),focus:el.tabIndex,
     width:r.width,height:r.height,clickThrough:style.pointerEvents==='none'||getComputedStyle(el.parentElement).pointerEvents==='none'};
   });
   assert.deepEqual([data.x,data.z],coords,id+' points to the outside doorstep rather than a roof/wall tile');
   assert.equal(data.focus,-1,id+' hint must not enter keyboard focus order');
   assert.equal(data.clickThrough,true,id+' hint must not block editor taps');
   assert.ok(data.width<=60&&data.height<=65,id+' hint is small');
   assert.equal(await page.evaluate(([x,z])=>window.__editorTest.canStep(x,z),coords),true,id+' approach remains walkable');
  }
  if(out)await page.screenshot({path:out+'/base-overhead-entrance-guides.png'});
  await page.locator('#hideUpper').check();
  await zeroGuides(page,'roof is off in the editor and door labels should not double it');
  await page.locator('#hideUpper').uncheck();
  await mark(page,'lodging').waitFor({state:'visible'});

  await page.locator('#enterGameWorld').click();
  await page.waitForFunction(()=>window.__editorTest?.facility?.().mode==='play');
  await zeroGuides(page,'ordinary oblique play must not show door markers');
  await page.locator('#poiThirdView').click();
  await zeroGuides(page,'third-person play must not show door markers');
  await page.locator('#poiThirdView').click();
  await mark(page,'lodging').waitFor({state:'visible'});
  await page.locator('#pineAIPlayView').click();
  await zeroGuides(page,'AI layout must not show decorative live markers');
  await page.locator('#pineAIPlanCapture').getByRole('button',{name:'通常画面へ戻る'}).click();
  await mark(page,'lodging').waitFor({state:'visible'});
  await walkToLodging(page);
  assert.equal(await page.evaluate(()=>window.__editorTest.facility().hiddenRoof),0,'roof actually removed by inside walk');
  await page.waitForFunction(()=>!document.querySelector('.facilityEntranceGuide[data-entrance="lodging"]:not([hidden])'));
  await unchanged(page);
  await page.goto(origin+'/?editor=1&test=1');
  await page.waitForFunction(()=>window.__editorTest?.state?.().glLink);
  await page.locator('#poiThirdView').click();
  await zeroGuides(page,'ordinary user editor must not infer authored entrance markers');
  await unchanged(page);
  assert.deepEqual(errors,[]);
 }finally{await context.close();}
}

async function mobileEntrance(browser){
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
 try{
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.setDefaultTimeout(12000);
  await seed(page);
  await page.goto(origin+'/?facility=base&test=1');
  await page.waitForFunction(()=>window.__editorTest?.facility?.().id==='base');
  await page.locator('#poiThirdView').tap();
  const marker=mark(page,'lodging');
  await marker.waitFor({state:'visible'});
  const [pin,canvas]=await Promise.all([marker.boundingBox(),page.locator('#view').boundingBox()]);
  assert(pin&&canvas&&pin.x>=canvas.x&&pin.y>=canvas.y&&pin.x+pin.width<=canvas.x+canvas.width&&pin.y+pin.height<=canvas.y+canvas.height,
   'mobile marker remains within the rendered canvas');
  if(out)await page.screenshot({path:out+'/mobile-base-overhead-entrances.png'});
  await page.locator('#poiThirdView').tap();
  await zeroGuides(page,'mobile camera toggle also hides entrance marks');
  await unchanged(page);
  assert.deepEqual(errors,[]);
 }finally{await context.close();}
}

function spyAudio(){
 const Native=window.AudioContext??window.webkitAudioContext;
 if(!Native)return;
 const contexts=[],events=[];
 function intercept(ctx,node,kind){
  const originalStart=node.start.bind(node),originalStop=node.stop.bind(node);
  node.start=function(when){
   events.push({event:'start',kind,type:node.type??null,loop:node.loop??false,
    frequency:node.frequency?.value??null,when:when??null});
   return originalStart(...arguments);
  };
  node.stop=function(when){
   events.push({event:'stop',kind,type:node.type??null,loop:node.loop??false,
    frequency:node.frequency?.value??null,when:when??null});
   return originalStop(...arguments);
  };
  return node;
 }
 class SpyContext extends Native{
  constructor(...args){super(...args);contexts.push(this);}
  createOscillator(){return intercept(this,super.createOscillator(),'osc');}
  createBufferSource(){return intercept(this,super.createBufferSource(),'buffer');}
 }
 window.AudioContext=SpyContext;
 window.__workshopAudioQA={contexts,events};
}
const sampleAudio=page=>page.evaluate(()=>{
 const {contexts,events}=window.__workshopAudioQA;
 return {states:contexts.map(c=>c.state),events:events.slice()};
});
const firstMusic=events=>events.find(e=>e.event==='start'&&e.kind==='osc'&&e.frequency>20&&e.when!==null);
async function startMusic(context,id){
 const page=await context.newPage(), errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.setDefaultTimeout(12000);
 await seed(page);
 await page.goto(origin+'/?facility='+id+'&test=1');
 await page.waitForFunction(()=>window.__editorTest?.facility?.().id);
 assert.deepEqual((await sampleAudio(page)).events,[],'editing must not start any music');
 await page.locator('#enterGameWorld').tap();
 await page.waitForFunction(()=>window.__workshopAudioQA?.contexts.some(c=>c.state==='running')&&
  window.__workshopAudioQA?.events.some(e=>e.event==='start'&&e.kind==='osc'&&e.frequency>20&&e.when!==null));
 return {page,errors};
}
async function music(browser){
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
 await context.addInitScript(spyAudio);
 try{
  const {page,errors}=await startMusic(context,'base');
  const start=await sampleAudio(page);
  const baseNote=firstMusic(start.events)?.frequency;
  assert.ok(Math.abs(baseNote-130.813)<.15,'base BGM first piano note should be C3, received '+baseNote);
  const step=await page.evaluate(()=>{
   const {position:{x,z}}=window.__editorTest.facility();
   for(const [dx,dz,key] of [[1,0,'ArrowRight'],[-1,0,'ArrowLeft'],[0,-1,'ArrowUp'],[0,1,'ArrowDown']])
    if(window.__editorTest.canStep(x+dx,z+dz))return key;
  });
  assert.ok(step,'a mobile player can move at spawn');
  await page.keyboard.press(step);
  await page.waitForFunction(n=>window.__workshopAudioQA.events.slice(n).some(e=>
   e.event==='start'&&e.kind==='buffer'&&!e.loop),start.events.length);
  const afterStep=await sampleAudio(page);
  assert(afterStep.events.slice(start.events.length).some(e=>e.event==='start'&&e.kind==='buffer'&&!e.loop),
   'first walk step still uses existing filtered noise SFX');
  await page.evaluate(()=>window.__workshopAudioForeground(false));
  await page.waitForFunction(()=>window.__workshopAudioQA.contexts.every(c=>c.state==='suspended'));
  const background=await sampleAudio(page);
  assert(background.events.slice(afterStep.events.length).some(e=>e.event==='stop'&&e.when===null),
   'background explicitly stops existing/scheduled sources');
  await page.keyboard.press(step);
  await page.waitForTimeout(220);
  const paused=await sampleAudio(page);
  assert.equal(paused.events.filter(e=>e.event==='start').length,background.events.filter(e=>e.event==='start').length,
   'no new music or SFX started in background');
  await page.evaluate(()=>window.__workshopAudioForeground(true));
  await page.waitForFunction(n=>window.__workshopAudioQA.contexts.some(c=>c.state==='running')&&
   window.__workshopAudioQA.events.slice(n).some(e=>e.event==='start'&&e.kind==='osc'&&e.frequency>20),paused.events.length);
  const wake=await sampleAudio(page);
  assert.equal(wake.events.slice(paused.events.length).filter(e=>e.event==='start'&&e.kind==='buffer'&&e.loop).length,2,
   'one wind/rustle pair after foreground, not overlapping loops');
  // Existing APKs can send real page visibility changes without the optional
  // native bridge. Exercise this separate HTML guard on actual Web Audio.
  await page.evaluate(()=>{
   Object.defineProperty(document,'hidden',{configurable:true,value:true});
   document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForFunction(()=>window.__workshopAudioQA.contexts.every(c=>c.state==='suspended'));
  await page.evaluate(()=>{
   delete document.hidden;
   document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForFunction(()=>window.__workshopAudioQA.contexts.every(c=>c.state==='running'));
  await unchanged(page);
  assert.deepEqual(errors,[]);
  await page.close();

  const normal=await startMusic(context,'lodging');
  const oldNote=firstMusic((await sampleAudio(normal.page)).events)?.frequency;
  assert.ok(Math.abs(oldNote-73.415)<.15,'unrelated POIs retain the original D2 felt-piano start, received '+oldNote);
  await unchanged(normal.page);
  assert.deepEqual(normal.errors,[]);
 }finally{await context.close();}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 if(coverage!=='bgm'){await entrances(browser);await mobileEntrance(browser);console.log('PASS entrance guides: actual top-down/roof/camera UI, passable doorstep, no input obstruction or save writes');}
 if(coverage!=='entrance'){await music(browser);console.log('PASS audio: real Web Audio base/non-base pitches, walking SFX, suspend/resume and exact saves');}
}finally{
 await browser?.close();
 await new Promise(resolve=>server.close(resolve));
}
