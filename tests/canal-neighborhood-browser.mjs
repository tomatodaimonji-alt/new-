import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html');
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
async function setup(browser,id,start,{townLayout=3,yaw=.24,orbitYaw=Math.PI,third=false}={}){
 const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
 await page.goto(origin+'/seed');
 await page.evaluate(({fixtures,resumeKey,id,start,townLayout,yaw,orbitYaw,third})=>{
  for(const [k,v] of Object.entries(fixtures))localStorage.setItem(k,v);
  if(start)localStorage.setItem(resumeKey,JSON.stringify({version:1,route:'facility',id,play:true,position:{y:0,facing:0,...start},townLayout,
   view:{yaw,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third,orbitYaw,orbitPitch:.35,orbitDistance:10}}));
 },{fixtures,resumeKey,id,start,townLayout,yaw,orbitYaw,third});
 await page.goto(origin+'/'+(start?'?resume=1&test=1':'?facility='+id+'&test=1'));
 if(!start)await page.locator('#enterGameWorld').tap();
 await page.waitForFunction(()=>window.__editorTest?.facility?.().mode==='play');
 assert.equal((await state(page)).id,id);
 return {ctx,page,errors};
}
async function route(page,goal,nextFloor,limits,mobileLast=false){
 const start=await pos(page),[gx,gz]=goal;
 const path=await page.evaluate(({goal:[gx,gz],start,limits:[x0,x1,z0,z1]})=>{
  const api=window.__editorTest;
  const stairs=new Set(api.data().world.filter(o=>o.y===start.level&&/^guildStair(?:Up|Down)$/.test(o.type)).map(o=>o.x+','+o.z));
  const dirs=[[-1,0,'ArrowLeft','w'],[1,0,'ArrowRight','e'],[0,-1,'ArrowUp','n'],[0,1,'ArrowDown','s']];
  const key=(x,z)=>x+','+z,first=key(start.x,start.z),last=key(gx,gz);
  const q=[[start.x,start.z]],seen=new Map([[first,null]]);
  for(let i=0;i<q.length&&!seen.has(last);i++){
   const [x,z]=q[i];
   for(const [dx,dz,arrow,tap] of dirs){
    const a=x+dx,b=z+dz,k=key(a,b);
    if(a<x0||a>x1||b<z0||b>z1||seen.has(k)||(stairs.has(k)&&k!==last)||!api.canStep(a,b,x,z))continue;
    seen.set(k,{from:key(x,z),x:a,z:b,arrow,tap});q.push([a,b]);
   }
  }
  if(!seen.has(last))return null;
  const steps=[];for(let k=last;k!==first;k=seen.get(k).from)steps.push(seen.get(k));return steps.reverse();
 },{start,goal,limits});
 assert.ok(path,'no actual collision-valid route from '+JSON.stringify(start)+' to '+goal);
 for(const [i,{arrow,tap,x,z}] of path.entries()){
  const isLast=i===path.length-1;
  if(mobileLast&&isLast)await page.locator('[data-poi-dir="'+tap+'"]').tap();else await page.keyboard.press(arrow);
  const level=isLast?nextFloor:start.level;
  await page.waitForFunction(({x,z,level})=>{const p=window.__editorTest.facility().position;return p.x===x&&p.z===z&&p.level===level;},{x,z,level},{timeout:3000})
   .catch(async e=>{throw new Error('Missed step '+[x,z,level]+' from '+JSON.stringify(await pos(page)),{cause:e});});
  await page.waitForTimeout(185);
 }
}
const paint=page=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
async function capture(page,label){
 if(!out)return;
 await paint(page);
 await page.screenshot({path:out+'/v138-'+label+'.png'});
}
const at=(world,x,z,y=0)=>world.filter(o=>o.x===x&&o.z===z&&o.y===y);
const loc=(x,z)=>({x,z,level:0});
async function blocked(page,arrow,x,z,reason){
 await page.keyboard.press(arrow);
 await page.waitForTimeout(190);
 assert.deepEqual(await pos(page),loc(x,z),reason);
}
async function verifyHome(page,map,[id,outer,door,inner],area){
 const info=await state(page),owner=info.buildings.findIndex(b=>b.id===id);
 assert.ok(owner>=0,'real house '+id);
 assert.deepEqual(info.buildings[owner].entrance,{x:door[0],z:door[1]});
 assert.ok(at(map.world,...door).some(o=>/Door$/.test(o.type)),'authored doorway for '+id);
 await route(page,outer,0,area);
 await route(page,door,0,area,true);
 await route(page,inner,0,area);
 const walked=await state(page);
 assert.equal(walked.hiddenRoof,owner,'walked into actual roof cutaway of '+id);
 assert.ok(!walked.visibleRoofs.includes(owner),'roof hidden only for occupied '+id);
 await route(page,door,0,area);
 await route(page,outer,0,area);
}
async function neighborhood(browser){
 const {ctx,page,errors}=await setup(browser,'base',{x:55,z:30},{yaw:.28,orbitYaw:Math.PI/2});
 try{
  const map=await getMap(page),url=page.url();
  assert.deepEqual([map.width,map.height],[96,56],'district uses existing world footprint');
  const compounds=(await state(page)).buildings;
  for(const [id,box] of [['cottage',[46,52,35,41]],['rowhouse',[52,58,23,29]],['gardener',[54,60,34,40]]]){
   const b=compounds.find(x=>x.id===id);
   assert.ok(b,id+' placed');
   assert.deepEqual([b.x1,b.x2,b.z1,b.z2],box,'actual moved or protected house bounds '+id);
  }
  for(const x of [55,67])for(const z of [31,32]){
   assert.ok(at(map.world,x,z).some(o=>/^bridge(?:Stone|Wood)(?:End)?$/.test(o.type)&&o.rot%2===0),'real north/south footbridge span '+[x,z]);
   assert.ok(at(map.world,x,z).some(o=>o.type==='river'),'there is visible water underneath the bridge '+[x,z]);
  }
  for(const [x,z] of [[56,31],[56,32],[61,31],[63,32]])
   assert.ok(at(map.world,x,z).some(o=>o.type==='river'),'new connected canal water '+[x,z]);
  for(const [z,side] of [[30,0],[33,2]])assert.ok(map.world.filter(o=>o.x>=52&&o.x<=68&&o.z===z&&o.y===0&&o.type==='poiCanalQuay'&&o.rot===side).length>=3,'real constructed stone waterfront edging on both banks');
  const area=[43,61,22,47];
  await capture(page,'canal-neighborhood');
  await verifyHome(page,map,['rowhouse',[56,30],[56,29],[56,28]],area);
  await route(page,[55,30],0,area);
  await route(page,[55,31],0,[55,55,30,33],true);
  await blocked(page,'ArrowRight',55,31,'deep canal blocks stepping sideways off the old-footbridge-style deck');
  await capture(page,'on-footbridge-oblique');
  await route(page,[55,33],0,[55,55,30,33],true);
  await verifyHome(page,map,['gardener',[53,36],[54,36],[55,36]],area);
  await verifyHome(page,map,['cottage',[50,42],[50,41],[50,40]],area);
  await route(page,[55,33],0,area);
  await route(page,[55,30],0,[55,55,30,33],true);
  assert.equal(page.url(),url,'both halves of the canal district stay within game world');
  for(const z of [31,32])assert.equal(await page.evaluate(z=>window.__editorTest.canStep(62,z),z),false,'fort culvert does not create a pedestrian shortcut');
  assert.deepEqual(await getMap(page),map,'walking and roof cutaways never mutate map data');
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
async function oldTrails(browser){
 // Start on the existing north woodland path. New canal must neither strand
 // the old return trail, nor harm the separate main creek crossing south of it.
 const north=await setup(browser,'base',{x:67,z:30});
 try{
  const {page}=north;
  await route(page,[67,33],0,[67,67,30,33],true);
  await route(page,[67,38],0,[65,67,33,38]);
  await route(page,[69,38],0,[67,70,38,38],true);
  await blocked(page,'ArrowDown',69,38,'original creek beside the existing stone bridge remains solid');
  await route(page,[70,38],0,[67,70,38,38]);
  await unchanged(page);assert.deepEqual(north.errors,[]);
 }finally{await north.ctx.close();}
 const east=await setup(browser,'base',{x:61,z:45});
 try{
  await route(east.page,[63,45],0,[60,64,44,46],true);
  assert.deepEqual(await pos(east.page),loc(63,45),'v137 main east gate still has its real opening');
  await unchanged(east.page);assert.deepEqual(east.errors,[]);
 }finally{await east.ctx.close();}
}
async function previewAndResume(browser){
 const fixture=await setup(browser,'base',{x:38,z:39},{townLayout:2});
 try{
  assert.deepEqual(await pos(fixture.page),loc(50,40),'old v137 cottage bookmark lands in the relocated home');
  await fixture.page.waitForFunction(k=>JSON.parse(localStorage.getItem(k))?.townLayout===3,resumeKey);
  await fixture.page.reload();
  await fixture.page.waitForFunction(()=>window.__editorTest?.facility?.().active);
  assert.deepEqual(await pos(fixture.page),loc(50,40),'cottage bookmark translates only once');
  await unchanged(fixture.page);assert.deepEqual(fixture.errors,[]);
 }finally{await fixture.ctx.close();}
 if(out){
  // Fixed camera pose, separate preview fixture: no camera interaction during traversal.
  const bridge=await setup(browser,'base',{x:55,z:31},{orbitYaw:Math.PI/2,third:true});
  try{
   assert.deepEqual(await pos(bridge.page),loc(55,31));
   assert.match(await bridge.page.locator('#poiThirdView').textContent(),/三人称/);
   await capture(bridge.page,'view-along-canal-from-footbridge');
  }finally{await bridge.ctx.close();}
 }
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await neighborhood(browser);await oldTrails(browser);await previewAndResume(browser);
 console.log('PASS mobile Chromium: real canal homes and crossings, blocked water/culvert, old gate/creek/woods, exact protected saves');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
