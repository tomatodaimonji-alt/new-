import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
function observe(source,anchor,replacement){
 assert.equal(source.split(anchor).length,2,'one actual engine hook: '+anchor);
 return source.replace(anchor,replacement);
}
let observed=observe(html,'function upload(m,reuse=null,usage=gl.STATIC_DRAW){',`function upload(m,reuse=null,usage=gl.STATIC_DRAW){
 const r=__profileUpload(m,reuse,usage),s=window.__facilityPerf;
 if(s?.building)s.uploads.push({vertices:r.count,bytes:r.count*36});
 return r;
}
function __profileUpload(m,reuse=null,usage=gl.STATIC_DRAW){`);
observed=observe(observed,'function makeScene(){',`function makeScene(){
 const s=window.__facilityPerf??={builds:[],uploads:[],building:false};
 const start=performance.now(),first=s.uploads.length;s.building=true;
 try{return __profileMakeScene()}
 finally{s.building=false;s.builds.push({floor:poiWalkLevel,walk:!!poiWalkActive,
  millis:performance.now()-start,uploads:s.uploads.slice(first)})}
}
function __profileMakeScene(){`);
observed=observe(observed,'function facilityRenderScene(){',`function facilityRenderScene(){
 const r=__profileRenderScene(),s=window.__facilityPerf;
 if(s){
  const ids=s.ids??=new WeakMap();
  function id(mesh){if(!mesh?.buf)return null;if(!ids.has(mesh.buf))ids.set(mesh.buf,s.nextId=(s.nextId||0)+1); return ids.get(mesh.buf)}
  s.current={x:poiWalkX,z:poiWalkZ,floor:poiWalkLevel,
    ground:id(r.mesh.ground),groundVertices:r.mesh.ground?.count??0,scene:id(r.mesh),sceneVertices:r.mesh.count,
    hidden:r.mesh.hiddenSpans?.reduce((total,[from,to])=>total+to-from,0)??0};
 }
 return r;
}
function __profileRenderScene(){`);
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url.startsWith('/seed')?'<!doctype html><title>Isolated fixtures</title>':observed);
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
const pos=(page)=>page.evaluate(()=>window.__editorTest.facility().position);
const directions=[[-1,0,'ArrowLeft','w'],[1,0,'ArrowRight','e'],[0,-1,'ArrowUp','n'],[0,1,'ArrowDown','s']];
const getMap=page=>page.evaluate(()=>window.__editorTest.data());
async function setup(browser,id,start,{legacy=false}={}){
 const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
 await page.goto(origin+'/seed');
 await page.evaluate(({fixtures,resumeKey,id,start,legacy})=>{
  for(const [k,v] of Object.entries(fixtures))localStorage.setItem(k,v);
  if(start)localStorage.setItem(resumeKey,JSON.stringify({version:1,route:'facility',id,play:true,position:{y:0,facing:0,...start},...(legacy?{}:{townLayout:5}),
   view:{yaw:.24,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:Math.PI,orbitPitch:.35,orbitDistance:10}}));
 },{fixtures,resumeKey,id,start,legacy});
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
async function sample(page){
 const {x,z,level}=await pos(page);
 await page.waitForFunction(({x,z,level})=>{
  const s=window.__facilityPerf?.current;
  return s?.x===x&&s?.z===z&&s?.floor===level;
 },{x,z,level});
 return page.evaluate(()=>({current:window.__facilityPerf.current,
  builds:window.__facilityPerf.builds.filter(r=>r.walk), uploads:window.__facilityPerf.uploads}));
}
const bounds=b=>[b.x1,b.x2,b.z1,b.z2];
const roofShown=(s,owner)=>s.visibleRoofs.includes(owner);
const owned=(b,o)=>o.x>=b.x1&&o.x<=b.x2&&o.z>=b.z1&&o.z<=b.z2;
async function tour(browser,id,start){
 const {ctx,page,errors}=await setup(browser,'base',start);
 try{
  const map=await getMap(page),outside=await state(page),url=page.url();
  const owner=outside.buildings.findIndex(b=>b.id===id),b=outside.buildings[owner];
  assert.ok(b&&b.entrance,'real authored '+id);
  assert.equal(outside.hiddenRoof,null);
  assert.ok(roofShown(outside,owner),'outside roof is present');
  if(id==='townGuild')assert.ok(outside.signIds.includes('guildFacadeSign'),'outside sign is present');
  const initial=await sample(page),g=initial.current;
  assert.ok(g.ground&&g.groundVertices>10000,'authored surface uses a separate shared grade VBO');
  assert.equal(initial.uploads.filter(x=>x.vertices===g.groundVertices).length,1,'grade uploaded once on entry');
  await route(page,[b.entrance.x,b.entrance.z],0,[b.x1-2,b.x2+2,b.z1-2,b.z2+2],true);
  const inside=await state(page),door=await sample(page);
  assert.equal(inside.hiddenRoof,owner,'roof cut starts on actual doorway');
  assert.equal(inside.sceneCutOwner,owner);
  assert.ok(!roofShown(inside,owner)&&inside.visibleRoofs.length>0,'only matching roof is hidden');
  assert.equal(g.hidden,0,'outside object mesh has no extra cut');
  if(id==='townGuild'){
   assert.ok(door.current.hidden>0,'inside hides actual upper storey ranges');
   assert.equal(door.current.scene,g.scene,'roof-cut variant shares the full uploaded object mesh');
   assert.equal(door.builds.length,initial.builds.length,'Guild doorway causes no full CPU scene rebuild');
   assert.equal(door.uploads.length,initial.uploads.length,'Guild doorway causes no full grade or object upload');
  }else{
   assert.notEqual(door.current.scene,g.scene,'inn uses an exact preexisting cut to preserve adjacent baked lighting');
   assert.equal(door.builds.length,initial.builds.length+1,'inn cut builds once');
  }
  assert.equal(door.current.ground,g.ground,'door variant shares uploaded grade');
  if(id==='townGuild')assert.ok(!inside.signIds.includes('guildFacadeSign'),'Guild sign is hidden in cutaway');
  const count=id==='townGuild'?2:1;
  let previousHidden=door.current.hidden;
  for(let floor=0;floor<count;floor++){
   const up=map.world.find(o=>o.y===floor&&o.type==='guildStairUp'&&owned(b,o)&&
    map.world.some(q=>q.y===floor+1&&q.x===o.x&&q.z===o.z&&q.type==='guildStairDown'));
   assert.ok(up,'actual paired stair on floor '+floor);
   await route(page,[up.x,up.z],floor+1,bounds(b),true);
   const next=await sample(page),s=await state(page);
   assert.equal(s.position.level,floor+1);
   assert.equal(s.sceneCutOwner,id==='townGuild'&&floor+1<count?owner:null,'building-specific cutaway rules remain unchanged');
   assert.equal(roofShown(s,owner),s.hiddenRoof!==owner,'roof follows the same physical upstairs threshold');
   assert.equal(next.current.ground,g.ground,'upper floor keeps identical uploaded grade');
   assert.equal(next.current.scene,g.scene,'upper floor keeps identical full uploaded object mesh');
   assert(next.current.hidden<=previousHidden,'upper floor reveals formerly hidden upper pieces');
   previousHidden=next.current.hidden;
   assert.equal(next.builds.length,door.builds.length,'stairs incur no full CPU scene rebuild');
   assert.equal(next.uploads.length,door.uploads.length,'stairs incur no grade or full object upload');
   if(id==='townGuild')assert.ok(!s.signIds.includes('guildFacadeSign'));
  }
  const done=await sample(page);
  assert.equal(done.uploads.filter(x=>x.vertices===g.groundVertices).length,1,'no repeat ground uploads on any doorway/stair');
  assert.equal(done.uploads.filter(x=>x.vertices===g.sceneVertices).length,1,'one full-object VBO for the route');
  console.log(id+' grade vertices '+g.groundVertices+'; walking scene builds '+done.builds.length+
   '; scene upload KiB '+Math.round(done.uploads.reduce((sum,u)=>sum+u.bytes,0)/1024));
  assert.deepEqual(await getMap(page),map);
  assert.equal(page.url(),url,'transitions stay in the same Game World');
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await tour(browser,'townGuild',{x:56,z:39});
 await tour(browser,'lodging',{x:41,z:34});
 console.log('PASS mobile Chromium Guild and inn real door/stair transitions reuse ground VBO, preserve roof cutaways, map and editor data');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
