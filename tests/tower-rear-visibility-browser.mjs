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
const pos=(page)=>page.evaluate(()=>window.__editorTest.facility().position);
const directions=[[-1,0,'ArrowLeft','w'],[1,0,'ArrowRight','e'],[0,-1,'ArrowUp','n'],[0,1,'ArrowDown','s']];
const getMap=page=>page.evaluate(()=>window.__editorTest.data());
async function setup(browser,id,start,{townLayout=5,yaw=0,orbitYaw=Math.PI,third=false,top=false,pitch=.52,prefix='/'}={}){
 const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 await ctx.addInitScript(()=>{
  const counts={uploads:0,largeUploads:0,draws:0};
  const proto=WebGLRenderingContext.prototype;
  const data=proto.bufferData,draw=proto.drawArrays;
  const get=proto.getUniformLocation,set=proto.uniformMatrix4fv,known=new WeakSet();
  proto.getUniformLocation=function(p,s){const a=get.call(this,p,s);if(a&&s==='uMVP')known.add(a);return a;};
  proto.uniformMatrix4fv=function(l,t,m){if(l&&known.has(l))window.__obliqueVP=Array.from(m);return set.call(this,l,t,m);};
  proto.bufferData=function(target,source,usage){
   counts.uploads++;
   if((typeof source==='number'?source:source?.byteLength)>300000)counts.largeUploads++;
   return data.call(this,target,source,usage);
  };
  proto.drawArrays=function(...a){counts.draws++;return draw.apply(this,a);};
  window.__occlusionCounts=counts;
 });
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
 await page.goto(origin+'/seed');
 await page.evaluate(({fixtures,resumeKey,id,start,townLayout,yaw,orbitYaw,third,top,pitch})=>{
  for(const [k,v] of Object.entries(fixtures))localStorage.setItem(k,v);
  if(start)localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weapon:null,potions:3,gold:12,drops:[{type:'healingHerb',x:107,z:59,y:0}]}));
  if(start)localStorage.setItem(resumeKey,JSON.stringify({version:1,route:'facility',id,play:true,position:{y:0,facing:0,...start},townLayout,
   view:{yaw,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top,third,orbitYaw,orbitPitch:pitch,orbitDistance:5.5}}));
 },{fixtures,resumeKey,id,start,townLayout,yaw,orbitYaw,third,top,pitch});
 await page.goto(origin+prefix+(start?'?resume=1&test=1':'?facility='+id+'&test=1'));
 if(!start)await page.locator('#enterGameWorld').tap();
 await page.waitForFunction(()=>window.__editorTest?.facility?.().mode==='play');
 assert.equal((await state(page)).id,id);
 return {ctx,page,errors};
}
const planFrame=page=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
async function rear(browser,yaw,required=false){
 const {ctx,page,errors}=await setup(browser,'base',{x:107,z:55},{yaw});
 try{
  const map=await getMap(page);
  assert.deepEqual(await pos(page),{x:107,z:55,level:0});
  assert.match(await page.locator('#poiThirdView').textContent(),/俯瞰/);
  assert.equal((await state(page)).hiddenRoof,null,'player stands outside rather than in the tower');
  await planFrame(page);
  if(required)await page.waitForFunction(()=>window.__editorTest.facility().occlusion?.wall?.rear===true);
  const active=(await state(page)).occlusion;
  // Straight down the center of a rendered opening may legitimately miss.
  if(!required&&active?.wall?.rear!==true){assert.deepEqual(await getMap(page),map);await unchanged(page);assert.deepEqual(errors,[]);return}
  assert.equal(active.wall.owner,'watchtower');
  assert.equal(active.kind,'overhead-wall');
  assert.ok(active.spans.length&&active.wall.cells.length>=1&&active.wall.cells.length<5);
  assert(active.wall.cells.every(({x,z,y,type})=>z===56&&y>=0&&y<=1&&Math.abs(x-107)<=2&&
   map.world.some(o=>o.x===x&&o.z===z&&o.y===y&&o.type===type)),'actual nearby rear-wall materials only, no front ring');
  const before=await page.evaluate(()=>({m:window.__obliqueVP,large:window.__occlusionCounts.largeUploads}));
  await page.evaluate(()=>window.__editorTest.setOverheadWallFade(false));await planFrame(page);
  assert.notEqual((await state(page)).occlusion?.wall?.rear,true);
  if(out)await page.locator('#view').screenshot({path:out+'/v171-rear-without-local-fade-'+yaw+'.png'});
  await page.evaluate(()=>window.__editorTest.setOverheadWallFade(true));
  await page.waitForFunction(()=>window.__editorTest.facility().occlusion?.wall?.rear===true);
  if(out)await page.locator('#view').screenshot({path:out+'/v171-rear-with-local-fade-'+yaw+'.png'});
  const after=await page.evaluate(()=>({m:window.__obliqueVP,large:window.__occlusionCounts.largeUploads}));
  assert.deepEqual(after,before,'angle, camera and large scene buffers unchanged by the wall fade');
  await page.locator('#poiThirdView').tap();
  await planFrame(page);assert.notEqual((await state(page)).occlusion?.wall?.rear,true);
  await page.locator('#poiThirdView').tap();
  await planFrame(page);assert.notEqual((await state(page)).occlusion?.wall?.rear,true);
  assert.deepEqual(await getMap(page),map);
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
async function interior(browser){
 const {ctx,page,errors}=await setup(browser,'base',{x:108,z:58},{yaw:0});
 try{
  await page.waitForFunction(()=>window.__editorTest.facility().occlusion?.wall?.owner==='watchtower');
  const d=(await state(page)).occlusion.wall;
  assert.notEqual(d.rear,true);
  assert(d.cells.filter(c=>c.z===60).length>=4&&d.cells.every(c=>c.z===60),'retain existing inside-facing front-only strip');
  assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await rear(browser,.15,true);await rear(browser,0);await rear(browser,-.18);await interior(browser);
 console.log('PASS real outside watchtower rear walls, interior front wall, unchanged camera, no mesh reupload, and save protection');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
