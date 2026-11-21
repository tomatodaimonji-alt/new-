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
async function launch(browser,id='base',start={x:19,z:45},{camera=false,yaw=.24,orbitYaw=0,pitch=.24,townLayout=4,facing=2}={}){
 const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 await ctx.addInitScript(()=>{
  let seed=88;
  Math.random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};
 });
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
 await page.goto(origin+'/seed');
 await page.evaluate(({fixtures,resumeKey,id,start,camera,yaw,orbitYaw,pitch,townLayout,facing})=>{
  for(const [k,v] of Object.entries(fixtures))localStorage.setItem(k,v);
  if(start)localStorage.setItem(resumeKey,JSON.stringify({version:1,route:'facility',id,play:true,position:{...start,y:0,facing},townLayout,
   view:{yaw,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:camera,orbitYaw,orbitPitch:pitch,orbitDistance:5.5}}));
 },{fixtures,resumeKey,id,start,camera,yaw,orbitYaw,pitch,townLayout,facing});
 await page.goto(origin+'/'+(start?'?resume=1&test=1':'?facility='+id+'&test=1'));
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
const gates=[
 {name:'north',x:24,z:12,rot:2,outward:'n',distance:5,orbit:0},
 {name:'west',x:13,z:39,rot:1,outward:'w',distance:5,orbit:Math.PI/2},
 {name:'south',x:31,z:59,rot:0,outward:'s',distance:3,orbit:Math.PI},
 {name:'east',x:74,z:57,rot:3,outward:'e',distance:2,orbit:1.5*Math.PI}
];
const inverse={n:'s',s:'n',e:'w',w:'e'};
const at=(x,z)=>({x,z,level:0});
const offset=(g,n)=>{const [dx,dz]=dirs[g.outward];return {x:g.x+dx*n,z:g.z+dz*n};};
async function gatePath(browser,g){
 const start=offset(g,-1);
 const {ctx,page,errors}=await launch(browser,'base',start);
 try{
  const map=await page.evaluate(()=>window.__editorTest.data());
  assert.deepEqual([map.width,map.height],[108,68]);
  const old=await state(page);
  assert.deepEqual(old.position,at(start.x,start.z));
  assert.ok(map.world.some(o=>o.x===g.x&&o.z===g.z&&o.y===0&&o.type==='poiFortGate'&&o.rot===g.rot),g.name+' is an actual rendered gate, not a gap in the wall');
  const alongX=g.rot%2===0,[dx,dz]=dirs[g.outward];
  const walkable=async(x,z)=>page.evaluate(([x,z,fx,fz])=>window.__editorTest.canStep(x,z,fx,fz),[x,z,x+dx,z+dz]);
  for(const shift of [-2,-1,0,1,2]){
   const x=g.x+(alongX?shift:0),z=g.z+(alongX?0:shift);
   assert.equal(await walkable(x,z),Math.abs(shift)<=1,g.name+' retains its exact three-cell gap with solid flanks '+shift);
  }
  if(g.name==='north'||g.name==='west'){
   assert.equal(old.miniMap.location,'拠点','inside the new gate is town');
   assert.equal(old.wildSpawn.nextIn,0,'town before gate is safe');
  }
  await move(page,g.outward,true,true);
  assert.deepEqual((await state(page)).position,at(g.x,g.z),'touch crosses actual '+g.name+' gate');
  for(let i=0;i<g.distance;i++)await move(page,g.outward);
  const outside=offset(g,g.distance),outdoor=await state(page);
  assert.deepEqual(outdoor.position,at(outside.x,outside.z));
  assert.equal(outdoor.miniMap.location,'外',g.name+' road enters a real outside region');
  assert.ok(outdoor.wildSpawn.nextIn>0,g.name+' outside has an active real encounter timer');
  if(g.name==='north'||g.name==='west'){
   const rows=map.world.filter(o=>o.y===0&&Math.abs(o.x-outside.x)<=4&&Math.abs(o.z-outside.z)<=4);
   assert.ok(rows.some(o=>/^grass|^flower|^moss$/.test(o.type)),g.name+' gate opens to authored meadow vegetation');
  }
  await capture(page,g.name+'-outside-road');
  for(let i=0;i<g.distance+1;i++)await move(page,inverse[g.outward],true,i===g.distance);
  assert.deepEqual((await state(page)).position,at(start.x,start.z),g.name+' is traversable in both directions');
  assert.deepEqual(await page.evaluate(()=>window.__editorTest.data()),map,'no map changes from movement');
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
async function preserveWorld(browser){
 const {ctx,page,errors}=await launch(browser,'base',{x:19,z:45},{townLayout:3});
 try{
  const old=await state(page);
  assert.deepEqual(old.position,at(31,57),'v141 resume translates both axes by +12 once');
  await page.waitForFunction(k=>JSON.parse(localStorage.getItem(k))?.townLayout===4,resumeKey);
  await page.reload();
  await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
  assert.deepEqual((await state(page)).position,at(31,57),'v142 resume preserves already migrated checkpoint');
  const map=await page.evaluate(()=>window.__editorTest.data());
  const actual=(x,z,t)=>map.world.some(o=>o.x===x&&o.z===z&&o.y===0&&o.type===t);
  assert.ok(actual(46,28,'stonewallDoor'),'town guild remains identical at translated location');
  for(const [x,z] of [[67,43],[67,44],[79,43],[79,44],[80,50],[81,50]]){
   assert.ok(actual(x,z,'bridgeStoneEnd')&&actual(x,z,'river'),'translated canal/creek bridge preserved '+[x,z]);
  }
  assert.equal(await page.evaluate(()=>window.__editorTest.canStep(74,43)),false,'old culvert stays nonpedestrian after world shift');
  assert.equal(await page.evaluate(()=>window.__editorTest.canStep(30,12,30,13)),true,'inn rear lane remains walkable from the inside');
  assert.equal(await page.evaluate(()=>window.__editorTest.canStep(30,11,30,12)),false,'solid north edge does not create a second opening');
  assert.equal(await page.evaluate(()=>window.__editorTest.canStep(30,12,30,11)),false,'solid north edge also blocks entry from the outside');
  const before=await state(page);
  const guild=before.buildings.find(b=>b.id==='townGuild');
  assert.deepEqual(guild.entrance,{x:46,z:28});
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
async function capture(page,name){
 if(out)await page.screenshot({path:out+'/v142-'+name+'.png'});
}
async function pictures(browser){
 if(!out)return;
 for(const g of gates){
  const p=offset(g,2);
  const {ctx,page}=await launch(browser,'base',p,{camera:true,orbitYaw:g.orbit,pitch:.29});
  try{
   assert.deepEqual((await state(page)).position,at(p.x,p.z));
   await capture(page,g.name+'-gate-exterior');
  }finally{await ctx.close();}
 }
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
 args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 for(const gate of gates)await gatePath(browser,gate);
 await preserveWorld(browser);
 const shop=await launch(browser,'base',{x:59,z:25},{facing:1});
 try{
  await shop.page.locator('#poiWalkAction').tap();
  await shop.page.waitForFunction(()=>document.getElementById('poiShopDialog').open);
  assert.deepEqual(shop.errors,[]);
 }finally{await shop.ctx.close();}
 await pictures(browser);
 console.log('PASS mobile Chromium: four authored gates traversed both ways, new north/west grassland, original canal/creek and Guild shifted safely, exact saves');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
