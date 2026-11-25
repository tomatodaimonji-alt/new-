import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
const before=readFileSync(process.argv[2]??'world-editor.html','utf8');
const anchor="if(facilityParams.get('test')==='1')window.__editorTest={";
assert.equal(before.split(anchor).length,2);
const html=before.replace(anchor,anchor+`
 gatewayProbe:(phase)=>{
  const selected=poiTownNpcActors.filter(a=>a.role.role==='gateway-visitor');
  if(!phase)return selected.map(a=>[a.role.id,a.x,a.z,a.recessed]);
  const minute=phase==='return'?1230:phase==='night'?155:700;
  const time0=performance.now();
  const crossed=new Set(), visited=new Set();let stamp=0;
  const locations=new Map(selected.map(a=>[a.role.id,[]]));
  for(let tick=0;tick<800;tick++){
   const now=time0+stamp;
   for(const a of selected)if(a.actorLeg)poiTownNpcActorRun(a,now,poiTownNpcGraph());
   if(tick%8===0){
    const budget={plans:2};
    for(const a of selected)poiTownGatewayRoutine(a,{minute,absoluteMinute:minute},now,budget);
   }
   for(const a of selected){
    const r=a.role;
    if(!a.recessed){
     const p=poiTownNpcVisualPosition(a,now,true);
     const path=locations.get(r.id);if(path.length===0||Math.hypot(path.at(-1)[0]-p.x,path.at(-1)[1]-p.z)>.03)path.push([p.x,p.z]);
     if(a.gatewayStep===2)crossed.add(r.id);
     if(a.activity==='visit')visited.add(r.id);
    }
   }
   stamp+=48;
  }
  return {crossed:[...crossed],visited:[...visited],paths:[...locations],state:selected.map(a=>({id:a.role.id,x:a.x,z:a.z,recessed:a.recessed}))};
 },
`);
const {chromium}=createRequire(import.meta.url)('playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>Seed</title>':html)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let b;
try{
 b=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_BIN||undefined,args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const ctx=await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:.65,isMobile:true,hasTouch:true,serviceWorkers:'block'});
 const p=await ctx.newPage(),errors=[],origin='http://127.0.0.1:'+server.address().port;
 await ctx.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
 p.on('pageerror',e=>errors.push(e.message));
 await p.goto(origin+'/seed');
 await p.evaluate(()=>{
  localStorage.setItem('world-workshop-hotbar-v1','{"version":1,"weapon":null,"potions":2}');
  localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":77500}');
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:63,z:39,y:0,facing:2},townLayout:5,townMapHeight:182,templeDepth:1,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:.37,orbitPitch:.24,orbitDistance:5.5}}));
 });
 await p.goto(origin+'/?resume=1&test=1');
 await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:30000});
 await p.waitForFunction(()=>window.__editorTest?.gatewayProbe()?.length===2,null,{timeout:12000});
 const probe=phase=>p.evaluate(n=>window.__editorTest.gatewayProbe(n),phase);
 const start=await probe();assert(start.every(a=>a[3]),'properly offsite at night');
 const inTown=await probe('open');assert.equal(inTown.crossed.length,2,JSON.stringify(inTown.state));assert.equal(inTown.visited.length,2,JSON.stringify(inTown.state));
 for(const [id,path] of inTown.paths){
  assert(path.length>65,id);
  const [x,z]=id==='westbasketweaver'?[23,49]:[34,22];
  assert(path.some(([px,pz])=>Math.hypot(px-x,pz-z)<1),id+' crosses its actual arch');
 }
 const leave=await probe('return');assert(leave.state.every(a=>a.recessed),JSON.stringify(leave.state));
 assert(leave.paths.every(([,path])=>path.length>65));
 assert.deepEqual(errors,[]);
 console.log('PASS: exact WebGL game boots and both named visitors physically take different real arches before heading offsite');
}finally{await b?.close();await new Promise(r=>server.close(r))}
