import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE??'playwright');
assert.ok(process.argv[3],'Usage: tree-appearance-browser.mjs candidate.html exact-v120.html');
const html=readFileSync(process.argv[2]??'world-editor.html');
const baseline=readFileSync(process.argv[3]);
assert.ok(!html.equals(baseline),'compare actual candidate with exact v120 baseline');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url.startsWith('/seed')?'<!doctype html><title>Isolated fixtures</title>':req.url.startsWith('/baseline')?baseline:html);
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
const landmarks=[
 {name:'creek-landscape',start:[70,38,1],view:'walk',orbitYaw:Math.PI/2,trees:[[76,37,'treePine'],[78,37,'treeBirch'],[79,39,'treeOak']]},
 {name:'cedar-trunk-and-canopy',start:[73,36,0],view:'walk',orbitYaw:Math.PI,trees:[[73,34,'treeCedar']]},
 {name:'mixed-grove-overview',start:[76,42,0],view:'oblique',trees:[[76,37,'treePine'],[78,37,'treeBirch'],[79,39,'treeOak'],[74,45,'treeWillow']]}
];
const settle=page=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(r)))));
async function scene(browser,prefix,landmark,build){
 const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
 try{
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
  await page.goto(origin+'/seed');
  await page.evaluate(({fixtures,resumeKey,start:[x,z,facing],orbitYaw})=>{
   for(const [k,v] of Object.entries(fixtures))localStorage.setItem(k,v);
   localStorage.setItem(resumeKey,JSON.stringify({version:1,route:'facility',id:'base',play:true,position:{x,z,y:0,facing},view:{yaw:.30,zoom:1.14,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw,orbitPitch:.35,orbitDistance:5.5}}));
  },{fixtures,resumeKey,start:landmark.start,orbitYaw:landmark.orbitYaw??0});
  await page.goto(origin+prefix+'?resume=1&test=1');
  await page.waitForFunction(()=>window.__editorTest?.facility?.().active===true);
  assert.equal((await state(page)).id,'base');
  assert.deepEqual((await state(page)).position,{x:landmark.start[0],z:landmark.start[1],level:0});
  if(landmark.view==='walk'){
   await page.locator('#poiThirdView').tap();
   assert.match(await page.locator('#poiThirdView').textContent(),/三人称/);
  }
  await settle(page);
  const geometry=await page.evaluate(()=>{
   const api=window.__editorTest,data=api.data();
   const treeRows=data.world.filter(o=>/^tree[A-Z]/.test(o.type));
   const relevant=new Set(treeRows.flatMap(o=>[[o.x,o.z],[o.x+1,o.z],[o.x-1,o.z],[o.x,o.z+1],[o.x,o.z-1]]
    .map(([x,z])=>x+','+z)));
   const collision=[...relevant].map(k=>{const [x,z]=k.split(',').map(Number);return [k,api.canStep(x,z)];});
   return {data,treeRows,collision};
  });
  for(const [x,z,type] of landmark.trees){
   assert.ok(geometry.treeRows.some(o=>o.x===x&&o.z===z&&o.y===0&&o.type===type),'authored landmark '+[x,z,type]);
   assert.equal(geometry.collision.find(c=>c[0]===x+','+z)?.[1],false,'live collision still treats existing trunk as solid');
  }
  const canvas=page.locator('#view');
  const png=await canvas.screenshot({animations:'disabled'});
  await settle(page);
  const stable=await canvas.screenshot({animations:'disabled'});
  if(out)await writeFile(out+'/'+build+'-'+landmark.name+'.png',png);
  await unchanged(page);
  assert.deepEqual(errors,[]);
  return {png,stable,geometry};
 }finally{await ctx.close();}
}
async function compare(page,a,b){
 return page.evaluate(async ({a,b})=>{
  async function read(data){
   const im=new Image();im.src='data:image/png;base64,'+data;await im.decode();
   const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;
   const ctx=c.getContext('2d');ctx.drawImage(im,0,0);
   return {pixels:ctx.getImageData(0,0,c.width,c.height).data,w:c.width,h:c.height};
  }
  const [left,right]=await Promise.all([read(a),read(b)]);
  if(left.w!==right.w||left.h!==right.h)throw new Error('Not paired screens');
  let changed=0;
  for(let i=0;i<left.pixels.length;i+=4)
   if(Math.max(Math.abs(left.pixels[i]-right.pixels[i]),Math.abs(left.pixels[i+1]-right.pixels[i+1]),Math.abs(left.pixels[i+2]-right.pixels[i+2]))>=12)changed++;
  return {fraction:changed/(left.w*left.h),width:left.w,height:left.h};
 },{a:a.toString('base64'),b:b.toString('base64')});
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const pixels=await browser.newPage();await pixels.goto(origin+'/seed');
 for(const landmark of landmarks){
  const before=await scene(browser,'/baseline',landmark,'v120-before');
  const after=await scene(browser,'/',landmark,'v121-after');
  assert.deepEqual(after.geometry.data,before.geometry.data,'all editor world data, tree identities and coordinates unchanged');
  assert.deepEqual(after.geometry.collision,before.geometry.collision,'all trunk/neighbor collision probes match exact baseline');
  const [delta,oldNoise,newNoise]=await Promise.all([
   compare(pixels,before.png,after.png),compare(pixels,before.png,before.stable),compare(pixels,after.png,after.stable)]);
  console.log(landmark.name,JSON.stringify({delta,oldNoise,newNoise}));
  assert.ok(delta.fraction>Math.max(.001,3*oldNoise.fraction,3*newNoise.fraction),
   'actual rendered change should exceed frame noise at '+landmark.name);
 }
 console.log('PASS paired real Chromium mobile tree appearance, fixed world/geometry placements and collision, and exact protected saves');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
