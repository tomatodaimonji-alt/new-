import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const portLabel=html.includes("const name='セルネア',bounds=")?'セルネア':'潮待ちの港';
const api="  townResidents:()=>typeof poiTownResidentsSnapshot==='function'?poiTownResidentsSnapshot():null,";
assert.equal(html.split(api).length,2);
let fixture=html.replace(api,api+`
  forestRoadQA:()=>({road:facilitySite?.southForest?.route,rest:facilitySite?.southForest?.rest,
   local:facilityForestSceneStatus(),portLocal:facilityLocalSceneStatus(),
   stream:typeof poiOverlandInspect==='function'?poiOverlandInspect():null,
   forestTriangles:typeof window.__realForestChunks==='undefined'?null:window.__realForestChunks,
   x:poiWalkX,z:poiWalkZ,y:poiWalkLevel,area:poiRegionAt(facilitySite,poiWalkX,poiWalkZ,false,poiWalkLevel).name,
   music:poiAudioMusicZone(),ready:performance.now()>=poiWalkNextReady}),
`);
// Route validation does not depend on unseeded wildlife collision timing.
for(const [a,b] of [
 [' const p=poiWildPick(rng);',' const p=null;'],
 ['function poiWildRegionalFrame(now,rng){','function poiWildRegionalFrame(now,rng){return;']
]){assert.equal(fixture.split(a).length,2);fixture=fixture.replace(a,b)}
if(fixture.includes('function* poiOverlandChunkRows(')){
 const a='  else if(!local||!pineDrawBaseTree(m,o)&&!pineDrawEastNature(m,o))deco(m,t,o.x+.5,y,o.z+.5,o.rot||0);';
 assert.equal(fixture.split(a).length,2,'observe the real object mesh build inside the existing chunk generator');
 const start=fixture.indexOf('function* poiOverlandChunkRows('),end=fixture.indexOf('function poiOverlandUpload(',start);
 let body=fixture.slice(start,end);
 const anchor='  const t=o.type,y=o.y*1.4+height(o.x,o.z)*TERRAIN_STEP;';
 assert.equal(body.split(anchor).length,2);assert.equal(body.split(a).length,2);
 body=body.replace(anchor,anchor+` 
  const testForest=local&&region.id==='base'&&poiSouthForestMember(o)&&/^(?:tree|rockMossy|fallenLog|ruinStonePost)/.test(o.type),startVertices=m.p.length/3;
 `).replace(a,a+`
  if(testForest&&m.p.length/3>startVertices){
   const stats=window.__realForestChunks||(window.__realForestChunks={});
   const old=stats[q.key]||(stats[q.key]={props:{},vertices:0});
   const id=o.x+','+o.z+','+o.type;
   const newVertices=m.p.length/3-startVertices;
   if(!old.props[id]){old.props[id]=newVertices;old.vertices+=newVertices;}
  }
 `);
 fixture=fixture.slice(0,start)+body+fixture.slice(end);
}
if(process.env.FOREST_PARSE_ONLY){for(const [,body] of fixture.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(body);console.log('exact scripts parse');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<!doctype html><title>Port forest QA</title>':fixture)});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const base='http://127.0.0.1:'+server.address().port;
let browser,context,p,checkpoint='launch';
const at=q=>[q.x,q.z,q.y];
const read=()=>p.evaluate(()=>window.__editorTest.forestRoadQA());
async function forestDrawn(){
 await p.waitForFunction(()=>{
  const q=window.__editorTest.forestRoadQA();
  if(!q.stream?.engaged)return q.local.active&&q.local.vertices>0&&q.local.draws>0;
  const draws=q.stream.last.filter(({key})=>q.forestTriangles?.[key]?.vertices>0);
  return q.stream.drawing&&draws.length>0&&draws.reduce((n,{key})=>n+Object.keys(q.forestTriangles[key].props).length,0)>=3;
 });
 const q=await read();
 if(q.stream?.engaged){
  assert(q.stream.drawing&&q.stream.last.length<=18&&q.stream.bytes<=4*1024*1024);
  assert(!q.local.active&&q.stream.oldVariants===0,'no redundant legacy atlas/forest VBO while actual forest chunks draw');
  console.log('Actual drawn authored forest props/chunks',JSON.stringify({position:at(q),bytes:q.stream.bytes,
   drawnForest:q.stream.last.filter(({key})=>q.forestTriangles?.[key]?.vertices>0)
    .map(({key})=>({key,count:Object.keys(q.forestTriangles[key].props).length,vertices:q.forestTriangles[key].vertices}))}));
 }else{
  assert(q.local.active&&q.local.vertices>0&&q.local.draws>0);
  assert(q.local.builds<=2,'one bounded forest mesh per proximity entry, no repeated rebuild while walking');
 }
}
async function start(x,z){
 await p.goto(base+'/seed');
 await p.evaluate(([x,z])=>{
  localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":360000}');
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x,z,y:0,facing:0},townLayout:5,townMapHeight:128,
   view:{yaw:0,zoom:1.28,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 },[x,z]);
 await p.goto(base+'/?resume=1&test=1');
 await p.locator('#pineStartupCover').waitFor({state:'hidden'});
 await p.waitForFunction(()=>window.__editorTest?.facility()?.active);
 assert.deepEqual(at(await read()),[x,z,0]);
}
async function traverse(route){
 for(const [i,target] of route.entries()){
  if(i===0)continue;
  const from=route[i-1],dx=target.x-from.x,dz=target.z-from.z;
  const direction=dx===1?'e':dx===-1?'w':dz===1?'s':'n';
  checkpoint='physical '+direction+' to '+at(target);
  await p.waitForFunction(()=>window.__editorTest.forestRoadQA().ready,null,{polling:25});
  await p.locator('[data-poi-dir="'+direction+'"]').tap();
  await p.waitForFunction(expected=>{
   const q=window.__editorTest.forestRoadQA();return q.x===expected.x&&q.z===expected.z&&q.y===expected.y;
  },target,{polling:25,timeout:3000});
 }
}
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 context=await browser.newContext({viewport:{width:430,height:820},deviceScaleFactor:.75,isMobile:true,hasTouch:true});
 p=await context.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(11000);
 await start(55,42);
 assert.equal((await read()).local.active,false,'forest geometry not loaded in the host town');
 await start(84,115);
 const before=await read(),url=p.url();
 assert.equal(before.area,portLabel);assert.equal(before.music,'town');
 assert(before.road?.length>=42);
 await traverse(before.road);
 const rest=await read();
 assert.deepEqual(at(rest),[54,119,0]);assert.equal(rest.area,'潮風の森');assert.equal(rest.music,'outside');
 await forestDrawn();
 await p.reload();await p.locator('#pineStartupCover').waitFor({state:'hidden'});
 assert.deepEqual(at(await read()),[54,119,0],'cold reload preserves actual point on new same-coordinate woodland road');
 await forestDrawn();
 await traverse([...before.road].reverse());
 const returned=await read();
 assert.deepEqual(at(returned),[84,115,0]);assert.equal(returned.area,portLabel);assert.equal(p.url(),url);
 assert.deepEqual(errors,[]);
 console.log('PASS native phone touch walks all cells port→woodland→port; regional mesh, music, and reload retained');
}catch(e){console.error(checkpoint,JSON.stringify(await read().catch(()=>null)));throw e}
finally{await context?.close();await browser?.close();await new Promise(r=>server.close(r))}
