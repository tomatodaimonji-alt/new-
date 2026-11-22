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
async function unchanged(page){
 const before=await page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),Object.keys(fixtures));
 assert.deepEqual(before,fixtures,'route must not write existing editor, Guild/archives, adventure, or audio settings');
}
const out=process.env.FACILITY_SCREENSHOTS;
if(out)await mkdir(out,{recursive:true});
const cover='#pineStartupCover', status='#pineStartupMessage';
const mapBytes=page=>page.evaluate(key=>localStorage.getItem(key),resumeKey);
const saved=JSON.stringify({version:1,route:'facility',id:'base',play:true,townLayout:5,
 position:{x:56,z:39,y:0,facing:0},
 view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.35,orbitDistance:6}});
async function setupStartup(browser,{hold=false,unavailable=false}={}){
 const ctx=await browser.newContext({viewport:{width:390,height:740},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 await ctx.addInitScript(({hold,unavailable})=>{
  if(location.pathname==='/seed')return;
  if(hold&&!sessionStorage.getItem('qa-first-frame-released')){
   const native=requestAnimationFrame.bind(window);
   const queued=new Map();let seq=0;
   const cancel=cancelAnimationFrame.bind(window);
   window.requestAnimationFrame=cb=>{const id=--seq;queued.set(id,cb);return id};
   window.cancelAnimationFrame=id=>id<0?queued.delete(id):cancel(id);
   window.__releaseFrame=()=>{
    window.requestAnimationFrame=native;
    window.cancelAnimationFrame=cancel;
    sessionStorage.setItem('qa-first-frame-released','1');
    for(const cb of queued.values())native(cb);
    queued.clear();
   };
  }
  if(unavailable&&!sessionStorage.getItem('qa-webgl-fixed')&&!new URL(location.href).searchParams.has('startup-editor')){
   const get=HTMLCanvasElement.prototype.getContext;
   HTMLCanvasElement.prototype.getContext=function(kind,...args){
    if(/webgl/i.test(kind))return null;
    return get.call(this,kind,...args);
   };
  }
  // Independent evidence of an actual main canvas draw, not a timer/boolean.
  const draw=WebGLRenderingContext.prototype.drawArrays;
  WebGLRenderingContext.prototype.drawArrays=function(...args){
   const result=draw.apply(this,args);
   if(this.canvas?.id==='view'&&(args[2]||0)>0)window.__startupDrawWitness=(window.__startupDrawWitness||0)+1;
   return result;
  };
 },{hold,unavailable});
 const page=await ctx.newPage(), errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/seed');
 await page.evaluate(({fixtures,resumeKey,saved})=>{
  for(const [k,v] of Object.entries(fixtures))localStorage.setItem(k,v);
  localStorage.setItem(resumeKey,saved);
 },{fixtures,resumeKey,saved});
 await page.goto(origin+'/?resume=1&test=1',{waitUntil:'domcontentloaded'});
 return {ctx,page,errors};
}
async function ready(page){
 await page.locator(cover+'[data-state="ready"]').waitFor({state:'attached' });
 await page.locator(cover).waitFor({state:'hidden'});
 assert.ok(await page.evaluate(()=>window.__startupDrawWitness>0),'loader clears only after actual main WebGL canvas draw');
}
async function loading(browser){
 const {ctx,page,errors}=await setupStartup(browser,{hold:true});
 try{
  assert.ok(await page.locator(cover+'[data-state="loading"]').isVisible());
  assert.match(await page.locator(status).innerText(),/読み込み中/);
  assert.equal(await page.evaluate(()=>window.__startupDrawWitness||0),0);
  assert.equal(await mapBytes(page),saved);
  if(out)await page.screenshot({path:out+'/v171-loader.png',timeout:2500}).catch(()=>{});
  await page.evaluate(()=>window.__releaseFrame());
  await ready(page);
  assert.equal(await page.evaluate(()=>window.__editorTest?.facility?.().active),true,'normal saved world still resumes');
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
async function recovery(browser,action){
 const {ctx,page,errors}=await setupStartup(browser,{unavailable:true});
 try{
  await page.locator(cover+'[data-state="failed"]').waitFor({state:'visible'});
  assert.match(await page.locator(status).innerText(),/WebGL|3D|読み込/);
  assert.ok(await page.locator('#pineStartupRetry').isVisible());
  assert.ok(await page.locator('#pineStartupEditor').isVisible());
  assert.equal(await page.evaluate(()=>window.__startupDrawWitness||0),0);
  await unchanged(page);assert.equal(await mapBytes(page),saved);
  if(action==='retry'){
   await page.evaluate(()=>sessionStorage.setItem('qa-webgl-fixed','1'));
   await page.locator('#pineStartupRetry').tap();
   await ready(page);
   assert.equal(await page.evaluate(()=>window.__editorTest?.facility?.().active),true,'retry restarts original route');
  }else{
   await page.locator('#pineStartupEditor').tap();
   await page.waitForURL(u=>u.searchParams.get('startup-editor')==='1');
   await ready(page);
   assert.equal(await page.evaluate(()=>window.__editorTest?.state?.().walking),false,'recovery starts the ordinary editor');
   assert.equal(await mapBytes(page),saved,'recovery does not overwrite the blocked game resume record');
  }
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await loading(browser);await recovery(browser,'retry');await recovery(browser,'editor');
 console.log('PASS first actual drawing, startup status transition and WebGL failure recovery without protected save changes');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
