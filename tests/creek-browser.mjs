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
const out=process.env.FACILITY_SCREENSHOTS;
if(out)await mkdir(out,{recursive:true});

const map={format:'forest-world-v1',version:1,width:30,height:30,size:30,world:[{x:1,y:0,z:2,type:'stonewall',rot:0}],
 models:[],prefabs:[],terrainHeights:[],checks:[]};
const fixtures={
 'forest-world-editor-v1':JSON.stringify(map,null,2),
 'world-workshop-pois-v1':JSON.stringify([{id:'poi-guild-primary-v87',name:'ギルド',map}],null,2),
 'world-workshop-adventure-v1':'{"version":1,"x":23,"z":24,"monsters":[]}',
 'world-workshop-audio-v2':'{"master":81,"bgm":62,"se":88,"enabled":true}'
};
const resume='world-workshop-resume-v1';
function captureAudioContext(){
 const Native=window.AudioContext??window.webkitAudioContext;
 if(!Native)return;
 const contexts=[],loops={starts:0,stops:0};
 class Observed extends Native{
  constructor(...args){super(...args);contexts.push(this);}
  createBufferSource(){
   const o=super.createBufferSource(),start=o.start.bind(o),stop=o.stop.bind(o);
   o.start=function(){if(o.loop)loops.starts++;return start(...arguments);};
   o.stop=function(){if(o.loop)loops.stops++;return stop(...arguments);};
   return o;
  }
 }
 window.AudioContext=Observed;
 window.__creekAudioContexts=contexts;
 window.__creekAudioLoops=loops;
}
async function seedPlay(page,x,z){
 await page.goto(origin+'/seed');
 await page.evaluate(({fixtures,resume,x,z})=>{
  for(const [k,v] of Object.entries(fixtures))localStorage.setItem(k,v);
  localStorage.setItem(resume,JSON.stringify({version:1,route:'facility',id:'base',play:true,position:{x,z,y:0,facing:0}}));
 },{fixtures,resume,x,z});
 await page.goto(origin+'/?resume=1&test=1');
 await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
 const initial=await state(page);
 assert.equal(initial.id,'base');
 assert.deepEqual(initial.position,{x,z,level:0});
 // A genuine activation works with regular Chromium as well as WebView's
 // more permissive auto-play; don't artificially move or enable mixer state.
 await page.locator('#poiWalkAction').tap();
 await page.waitForFunction(()=>window.__creekAudioContexts?.some(c=>c.state==='running'));
}
const state=page=>page.evaluate(()=>window.__editorTest.facility());
const canStep=(page,[x,z])=>page.evaluate(([x,z])=>window.__editorTest.canStep(x,z),[x,z]);
const audio=async page=>(await state(page)).creekAudio;
async function saves(page){
 const saved=await page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),Object.keys(fixtures));
 assert.deepEqual(saved,fixtures,'facility exploration and audio preserve original world, POIs, adventure and mixer bytes');
}
const movementCooldown=191;
async function press(page,key,x,z){
 await page.keyboard.press(key);
 await page.waitForFunction(([x,z])=>{const p=window.__editorTest.facility().position;return p.x===x&&p.z===z&&p.level===0;},[x,z]);
 await page.waitForTimeout(movementCooldown);
}
async function blocked(page,key,x,z,message='deep water should not be playable ground'){
 await page.keyboard.press(key);
 await page.waitForTimeout(movementCooldown);
 assert.deepEqual((await state(page)).position,{x,z,level:0},message);
}
async function paint(page){await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}

let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
 await context.addInitScript(captureAudioContext);
 const page=await context.newPage(),errors=[];
 page.setDefaultTimeout(12000);
 page.on('pageerror',e=>errors.push(e.message));

 await seedPlay(page,19,21);
 assert.deepEqual(await audio(page),{active:false,level:0},'the base score stays independent of distant water');
 assert.equal(await page.evaluate(()=>window.__creekAudioLoops.starts),2,'far from creek only existing wind/rustle run');
 await saves(page);

 await seedPlay(page,67,38);
 await page.waitForFunction(()=>{const a=window.__editorTest.facility().creekAudio;return a?.active&&a.level>0;});
 const near=await audio(page);
 assert.ok(near.level<=.18+1e-4,'localized creek is subtle, not a competing soundtrack');
 assert.equal(await page.evaluate(()=>window.__creekAudioLoops.starts),3,'near the creek exactly one actual water loop is added');
 const around=await page.evaluate(()=>window.__editorTest.data().world.filter(o=>o.y===0&&o.z===38&&o.x>=68&&o.x<=69));
 for(const [x,rot] of [[68,3],[69,1]])assert.ok(around.some(o=>o.x===x&&o.type==='bridgeStoneEnd'&&o.rot===rot),'correctly aligned stone bridge end '+x);
 assert.equal(await canStep(page,[67,37]),true,'dry approach still walkable');
 assert.equal(await canStep(page,[68,38]),true,'west bridge tile');
 assert.equal(await canStep(page,[69,38]),true,'east bridge tile');
 assert.equal(await canStep(page,[69,39]),false,'open creek beside deck');
 await press(page,'ArrowUp',67,37);
 await blocked(page,'ArrowRight',67,37);
 await press(page,'ArrowDown',67,38);
 await press(page,'ArrowRight',68,38);
 await press(page,'ArrowRight',69,38);
 await blocked(page,'ArrowDown',69,38);
 if(out){
  await page.locator('#poiThirdView').tap();
  await paint(page);
  await page.screenshot({path:out+'/creek-east-bridge-low-angle.png'});
  await page.locator('#poiThirdView').tap();
  await paint(page);
  await page.screenshot({path:out+'/creek-east-bridge-overhead.png'});
  await page.locator('#poiThirdView').tap();
 }
 await press(page,'ArrowRight',70,38);
 await press(page,'ArrowDown',70,39);
 await press(page,'ArrowRight',71,39);
 await press(page,'ArrowDown',71,40);
 await press(page,'ArrowLeft',70,40);
 await press(page,'ArrowLeft',69,40);
 assert.equal(await canStep(page,[68,40]),false,'wash apron is playable but the neighboring water is not');
 const wash=await page.evaluate(()=>{
  const {world,terrainHeights}=window.__editorTest.data();
  return {surface:world.find(o=>o.x===69&&o.z===40&&o.y===0)?.type,
   stairs:world.some(o=>o.x>=69&&o.x<=71&&o.z>=39&&o.z<=40&&o.y===0&&o.type==='terrainStairs'),
   levels:terrainHeights.filter(o=>o.x>=69&&o.x<=71&&o.z>=39&&o.z<=40)};
 });
 assert.deepEqual(wash,{surface:'roadCutStoneFull',stairs:false,levels:[]},'flat stone wash apron without outdoor stairs');
 if(out){await paint(page);await page.screenshot({path:out+'/creek-stone-wash-apron.png'});}
 await press(page,'ArrowRight',70,40);
 await press(page,'ArrowUp',70,39);
 await press(page,'ArrowUp',70,38);
 await press(page,'ArrowLeft',69,38);
 await press(page,'ArrowLeft',68,38);
 await press(page,'ArrowLeft',67,38);

 await page.evaluate(()=>window.__workshopAudioForeground(false));
 await page.waitForFunction(()=>window.__creekAudioContexts.every(c=>c.state==='suspended'));
 assert.deepEqual(await audio(page),{active:false,level:0},'background must stop and release local source');
 assert.equal(await page.evaluate(()=>window.__creekAudioLoops.stops),3,'background stops existing wind and the local water loop');
 await page.evaluate(()=>window.__workshopAudioForeground(true));
 await page.waitForFunction(()=>window.__creekAudioContexts.some(c=>c.state==='running')&&
  window.__editorTest.facility().creekAudio.active);
 assert.ok((await audio(page)).level>0,'water restarts on a foreground player still beside it');
 assert.equal(await page.evaluate(()=>window.__creekAudioLoops.starts),6,'foreground recreates precisely one water loop');
 await page.evaluate(()=>{
  Object.defineProperty(document,'hidden',{configurable:true,value:true});
  document.dispatchEvent(new Event('visibilitychange'));
 });
 await page.waitForFunction(()=>window.__creekAudioContexts.every(c=>c.state==='suspended'));
 assert.deepEqual(await audio(page),{active:false,level:0},'the page visibility path works on HTML-only APK updates');
 await page.evaluate(()=>{
  delete document.hidden;
  document.dispatchEvent(new Event('visibilitychange'));
 });
 await page.waitForFunction(()=>window.__editorTest.facility().creekAudio.active);
 for(let x=66;x>=61;x--)await press(page,'ArrowLeft',x,38);
 assert.equal((await audio(page)).level,0,'walking out of the area fades water to zero');
 await page.waitForFunction(()=>!window.__editorTest.facility().creekAudio.active);
 assert.deepEqual(await audio(page),{active:false,level:0},'silent creek releases its source in the same session');
 await saves(page);
 assert.deepEqual(errors,[]);
 console.log('PASS: genuine dry/east-west crossing, deep-water collision, flat wash access, near/far and background ambience, save bytes untouched');
 await context.close();
}finally{
 await browser?.close();
 await new Promise(resolve=>server.close(resolve));
}
