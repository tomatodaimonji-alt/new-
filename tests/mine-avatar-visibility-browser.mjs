import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const anchor='function draw(mesh,vp){';
assert.equal(html.split(anchor).length,2);
// Observe the actual shared draw entry, never substitute the depth/shader logic.
const observed=html.replace(anchor,`function draw(mesh,vp){
 if(mesh&&mesh.count&&mesh===poiWalkMesh){
  const calls=window.__avatarGlDraws??=[];
  if(calls.length>=60)calls.shift();
  calls.push({depth:gl.getParameter(gl.DEPTH_FUNC),write:gl.getParameter(gl.DEPTH_WRITEMASK),
   test:gl.isEnabled(gl.DEPTH_TEST),shader:gl.getUniform(program,loc.occlusionInfo)?.[3],
   vertices:mesh.count,ai:pineAIActive,x:poiWalkX,z:poiWalkZ,y:poiWalkLevel});
 }
 return __observedDraw(mesh,vp)
}
function __observedDraw(mesh,vp){`);
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url==='/seed'?'<!doctype html><title>Local fixtures</title>':observed);
});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const origin='http://127.0.0.1:'+server.address().port;
const map={format:'forest-world-v1',version:1,width:30,height:30,size:30,world:[{x:2,y:0,z:2,type:'stonewall',rot:1}],models:[],prefabs:[],terrainHeights:[],checks:[]};
const editorMap=JSON.stringify(map,null,2);
const baselineBody=page=>page.evaluate(()=>window.__editorTest.data());
const state=page=>page.evaluate(()=>window.__editorTest.facility());
const LESS=513,GREATER=516;
async function nextDraws(page){
 await page.evaluate(()=>{window.__avatarGlDraws=[]});
 await page.waitForFunction(()=>window.__avatarGlDraws?.length>=4);
 return page.evaluate(()=>window.__avatarGlDraws);
}
function checkPasses(calls,{withFallback=true}={}){
 const helper=calls.findIndex(c=>c.depth===GREATER);
 if(withFallback){
  assert.ok(helper>=0&&helper<calls.length-1,'avatar has a dedicated greater-depth pass followed by regular draw');
  assert.deepEqual([calls[helper].test,calls[helper].write,calls[helper].shader],[true,false,-2]);
  assert.equal(calls[helper].vertices,calls[helper+1].vertices,'only the avatar mesh is redrawn');
 }else assert.equal(helper,-1,'no visibility fallback in this mode');
 assert(calls.some(c=>c.depth===LESS&&c.test&&c.write&&c.shader===0),'ordinary draw uses restored ordinary depth/write/shader');
 if(withFallback)assert.deepEqual([calls[helper+1].depth,calls[helper+1].write,calls[helper+1].shader],[LESS,true,0]);
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const ctx=await browser.newContext({viewport:{width:390,height:740},deviceScaleFactor:.75,isMobile:true,hasTouch:true});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
 await page.goto(origin+'/seed');
 await page.evaluate(editorMap=>{
  localStorage.setItem('forest-world-editor-v1',editorMap);
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:119,z:58,y:-1,facing:1},townLayout:5,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:-1,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 },editorMap);
 await page.goto(origin+'/?resume=1&test=1');
 await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
 const original=await baselineBody(page);
 assert.deepEqual((await state(page)).position,{x:119,z:58,level:-1});
 await page.waitForFunction(()=>window.__editorTest.facility().occlusion?.wall?.owner==='abandoned-mine');
 const cut=(await state(page)).occlusion;
 assert.equal(cut.kind,'overhead-wall');
 assert(cut.wall.cells.length>0&&cut.spans.length>0,'only matching scene ranges are marked');
 assert(cut.wall.cells.every(({x,z,y,type})=>y===-1&&Math.abs(x-119)+Math.abs(z-58)<=8&&
  /^(moss|stone)wall$/.test(type)&&original.world.some(o=>o.x===x&&o.z===z&&o.y===y&&o.type===type)),
  'the fade belongs to actual B1 mine walls near the avatar, not surface or neighboring scenery');
 assert(cut.wall.cells.some(c=>c.z===59&&Math.abs(c.x-119)<=1),'south blocking wall is one of the faded cells');
 checkPasses(await nextDraws(page));
 const out=process.env.FACILITY_SCREENSHOTS;
 if(out){await mkdir(out,{recursive:true});await page.screenshot({path:out+'/v168-mine-avatar.png'})}
 // Cycle to third person, then true overhead: the depth pass also handles
 // direct roof occlusion, but the angled wall selector must stop.
 await page.locator('#poiThirdView').tap();checkPasses(await nextDraws(page));
 await page.locator('#poiThirdView').tap();checkPasses(await nextDraws(page));
 assert.notEqual((await state(page)).occlusion?.wall?.owner,'abandoned-mine');
 await page.locator('#poiThirdView').tap();
 checkPasses(await nextDraws(page));
 await page.locator('#pineAIPlayView').tap();
 // Some render paths still emit an ordinary world-avatar draw behind the AI
 // UI. In either case, no reveal draw is allowed while in the plan view.
 await page.waitForFunction(()=>document.body.querySelector('#pineAIPlanTitle')?.offsetParent);
 await page.evaluate(()=>{window.__avatarGlDraws=[]});
 await page.waitForTimeout(250);
 assert(!(await page.evaluate(()=>window.__avatarGlDraws)).some(c=>c.ai&&c.depth===GREATER));
 await page.locator('#pineAIPlanCapture button').tap();
 await page.locator('#poiWalkToggle').tap();
 await page.waitForFunction(()=>window.__editorTest.facility().active===false);
 await page.evaluate(()=>{window.__avatarGlDraws=[]});
 await page.waitForTimeout(250);
 assert.deepEqual(await page.evaluate(()=>window.__avatarGlDraws),[],'editor does not draw or reveal the play avatar');
 assert.deepEqual(await baselineBody(page),original,'visual-only change does not mutate the authored map');
 assert.equal(await page.evaluate(()=>localStorage.getItem('forest-world-editor-v1')),editorMap);
 assert.deepEqual(errors,[]);
 console.log('PASS mobile Chromium authored B1 wall fade and avatar-only Greater-depth pass, ordinary draw restoration, overhead wall-selector and AI reveal exclusions, and editor-save protection');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
