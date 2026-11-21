import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const baseline=process.argv[3]&&readFileSync(process.argv[3],'utf8');
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
const pos=(page)=>page.evaluate(()=>window.__editorTest.facility().position);
const directions=[[-1,0,'ArrowLeft','w'],[1,0,'ArrowRight','e'],[0,-1,'ArrowUp','n'],[0,1,'ArrowDown','s']];
const getMap=page=>page.evaluate(()=>window.__editorTest.data());
const guildSign='guildFacadeSign';
async function setup(browser,id,start,{prefix='/',width=390,height=844,yaw=.24,zoom=1.05}={}){
 const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:width<500,hasTouch:width<500});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
 await page.goto(origin+'/seed');
 await page.evaluate(({fixtures,resumeKey,id,start,yaw,zoom})=>{
  for(const [k,v] of Object.entries(fixtures))localStorage.setItem(k,v);
  if(start)localStorage.setItem(resumeKey,JSON.stringify({version:1,route:'facility',id,play:true,position:{y:0,facing:0,...start},townLayout:3,
   view:{yaw,zoom,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:Math.PI,orbitPitch:.35,orbitDistance:10}}));
 },{fixtures,resumeKey,id,start,yaw,zoom});
 await page.goto(origin+prefix+(start?'?resume=1&test=1':'?facility='+id+'&test=1'));
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
 await page.screenshot({path:out+'/v140-'+label+'.png'});
}
async function signVisibility(page,visible){
 await page.waitForFunction(({id,visible})=>window.__editorTest.facility().signIds.includes(id)===visible,{id:guildSign,visible});
}
const inside=[27,42,2,16];
const find=(world,x,z,type,y=0)=>world.find(o=>o.x===x&&o.z===z&&o.y===y&&o.type===type);
async function floorContent(browser){
 const {ctx,page,errors}=await setup(browser,'base',{x:34,z:17});
 try{
  const initial=await state(page),owner=initial.buildings.findIndex(b=>b.id==='townGuild');
  assert.ok(owner>=0,'actual Game World guild');
  assert.deepEqual(initial.buildings[owner].entrance,{x:34,z:16});
  const original=await getMap(page),world=original.world;
  for(const [x,z,test] of [
   [31,4,/Door$/],[38,4,/Door$/],[29,5,/table/i],[41,3,/latrine|toilet/i],[41,5,/sink/i],
   [30,8,/quest/i],[28,10,/bench/i],[28,12,/bench/i],[39,10,/table/i],
   [38,10,/chair/i],[40,10,/chair/i],[41,12,/bench/i]
  ])assert.ok(world.some(o=>o.x===x&&o.z===z&&o.y===0&&test.test(o.type)),'inventoried layout item '+[x,z,test]);
  for(let x=32;x<=36;x++)assert.ok(world.some(o=>o.x===x&&o.z===6&&o.y===0&&/counter/i.test(o.type)),'continuous staffed reception counter '+x);
  for(const x of [33,35]){
   assert.ok(world.some(o=>o.x===x&&o.z===5&&o.y===0&&/^chair/i.test(o.type)),'two staffed chairs behind reception');
   assert.ok(find(world,x,6,'poiLedgerPapers'),'both desks are furnished');
  }
  assert.ok(find(world,28,14,'guildStairUp')&&find(world,39,13,'guildStairUp',1));
  await route(page,[34,16],0,[27,42,2,17],true);
  assert.equal((await state(page)).hiddenRoof,owner,'v139 door threshold cutaway preserved');
  await route(page,[34,7],0,inside);
  await page.keyboard.press('ArrowUp');
  assert.deepEqual(await pos(page),{x:34,z:7,level:0},'guest cannot walk through reception furniture');
  await capture(page,'guild-ground-reception');
  await route(page,[30,9],0,inside,true);
  await route(page,[39,11],0,inside);
  await capture(page,'guild-ground-public-tables');
  await route(page,[31,4],0,inside,true);
  await route(page,[30,4],0,inside);
  await route(page,[38,4],0,inside,true);
  await route(page,[40,4],0,inside);
  await route(page,[41,4],0,inside);
  await route(page,[40,5],0,inside);
  await route(page,[28,14],1,inside);
  assert.equal((await state(page)).sceneCutOwner,owner,'west staircase kept with correct second-floor cutaway');
  assert.equal(await page.evaluate(()=>window.__editorTest.canStep(34,8)),false,'upper atrium unchanged and cannot be entered on 2F');
  await route(page,[39,13],2,inside);
  await route(page,[34,10],2,inside,true);
  assert.equal((await state(page)).position.level,2,'master-office door remains reachable on 3F');
  assert.deepEqual(await getMap(page),original,'walk-through leaves authored tiles unchanged');
  if(baseline){
   const old=await setup(browser,'base',{x:34,z:17},{prefix:'/baseline'});
   try{
    const prev=await getMap(old.page);
    const unaffected=o=>o.y!==0||o.x<=27||o.x>=42||o.z<=2||o.z>=16;
    assert.deepEqual(original.world.filter(unaffected),prev.world.filter(unaffected),'all upper floors, shell, and unrelated world coordinates byte-identical in data');
    assert.deepEqual(original.terrainHeights,prev.terrainHeights);
    assert.deepEqual((await state(old.page)).buildings,initial.buildings,'no building/footprint change');
   }finally{await old.ctx.close();}
  }
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
async function landscapeProof(browser){
 if(!out)return;
 const {ctx,page}=await setup(browser,'base',{x:34,z:10},{width:1120,height:760,yaw:.10,zoom:.86});
 try{
  assert.equal((await state(page)).hiddenRoof,(await state(page)).buildings.findIndex(b=>b.id==='townGuild'));
  await capture(page,'guild-ground-landscape-cutaway');
 }finally{await ctx.close();}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await floorContent(browser);await landscapeProof(browser);
 console.log('PASS mobile Chromium: clear public reception/table/board aisles, accessible staff doors and unchanged upper floors, protected original saves');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
