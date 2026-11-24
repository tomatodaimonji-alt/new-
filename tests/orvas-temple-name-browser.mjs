import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {mkdirSync,readFileSync} from 'node:fs';
import {Script} from 'node:vm';
let html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const replace=(a,b)=>{assert.equal(html.split(a).length,2,a);html=html.replace(a,b)};
const testApi="if(facilityParams.get('test')==='1')window.__editorTest={";
replace(testApi,testApi+`
 sacredQA:{
  frame:()=>{window.__depthRoofDraws=0;render()},
  gate:(x,z,yaw)=>{const ok=workshopResumeRestorePosition({x,z,y:0,facing:2});poiCameraYaw=yaw;poiCameraPitch=-.11;poiCameraDistance=6;return ok},

  admission:(x,z)=>({passable:poiWalkCanStep(x,z,poiWalkX,poiWalkZ),next:poiWalkNextReady,now:performance.now(),hp:poiPlayerHP}),
  inspect:()=>{
   const f=facilitySite.sacredForest,at=poiAimOrigin(performance.now());
   return {x:poiWalkX,z:poiWalkZ,y:poiWalkLevel,name:poiRegionAt(facilitySite,poiWalkX,poiWalkZ,false,poiWalkLevel).name,locationName:$('poiLocationName').textContent,locationTitle:$('poiLocationName').title,stars:$('poiLocationStars').textContent,starLabel:$('poiLocationStars').getAttribute('aria-label'),
    path:f.route,mapH:MAP_H,roofDraws:window.__depthRoofDraws??0,isConcealed:poiLocalFrame?.concealed,seen:poiHotbarRead().sacredTempleSeen===true,reveal:f.reveal,tree:f.trees[10],fog:[...gl.getUniform(program,loc.sacredFog)],raster:window.__sacredRaster||null,
    scene:poiSacredForestStatus(),err:gl.getError(),directions:['n','s','e','w'].map(k=>poiCameraRelativeStep(k)),
    nearTemple:poiDavidTempleContains(facilitySite,at.x,at.z,at.y)};
  }
 },
`);
const raf=' requestAnimationFrame(render);';
replace(raf,' if(!window.__sacredManual)requestAnimationFrame(render);');
for(const [,s] of html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(s);
if(process.env.SACRED_FOREST_SYNTAX_ONLY)process.exit(0);
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>Sacred forest QA</title>':html)});
await new Promise((ok,no)=>server.listen(0,'127.0.0.1',ok).once('error',no));
const base='http://127.0.0.1:'+server.address().port;
let b,last=null,phase='startup';
try{
 b=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const ctx=await b.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:.75});
 const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.clock.install({time:new Date('2026-04-01T10:00:00Z')});
 async function seed(x,z,mapHeight=128,templeDepth){
  await p.goto(base+'/seed',{waitUntil:'domcontentloaded',timeout:45000});
  await p.evaluate(({x,z,mapHeight,templeDepth})=>{
   localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":360000}');
   localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,position:{x,z,y:0,facing:2},
    townLayout:5,townMapHeight:mapHeight,templeDepth,view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:-.15,orbitPitch:.13,orbitDistance:6}}));
  },{x,z,mapHeight,templeDepth});
  await p.goto(base+'/?resume=1&test=1',{waitUntil:'domcontentloaded',timeout:45000});
  await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:35000});
  await p.waitForFunction(()=>window.__editorTest?.facility()?.active,null,{polling:50,timeout:30000});
  await p.clock.pauseAt((await p.evaluate(()=>Date.now()))+1500);
  await p.evaluate(()=>{window.__sacredManual=true});
 }
 const inspect=async()=>last=await p.evaluate(()=>window.__editorTest.sacredQA.inspect());
 const tick=async(ms=225)=>{await p.clock.fastForward(ms);await p.evaluate(()=>window.__editorTest.sacredQA.frame());return inspect()};
 async function step(q){
  const s=last,dx=q.x-s.x,dz=q.z-s.z,i=s.directions.findIndex(d=>d[0]===dx&&d[1]===dz);
  assert(i>=0,'a genuine cardinal keyboard step '+JSON.stringify({dx,dz,state:s}));
  const key=['ArrowUp','ArrowDown','ArrowRight','ArrowLeft'][i],attempts=[];
  for(let k=0;k<5;k++){
   const admission=await p.evaluate(({x,z})=>window.__editorTest.sacredQA.admission(x,z),q);
   await p.keyboard.press(key);
   const n=await tick(k?350:225);
   if(n.x===q.x&&n.z===q.z&&n.y===0)return;
   attempts.push({admission,pos:[n.x,n.z,n.y]});
   assert.deepEqual([n.x,n.z,n.y],[s.x,s.z,0],'never leaves the route to skip a blocked step');
  }
  assert.fail('actual collision and west trail '+JSON.stringify({q,attempts}));
 }
 const screenshot=async name=>{if(process.env.FACILITY_SCREENSHOTS){mkdirSync(process.env.FACILITY_SCREENSHOTS,{recursive:true});await p.screenshot({path:process.env.FACILITY_SCREENSHOTS+'/'+name+'.png'});}};
 phase='real temple threshold and ten live minimap stars';
 await seed(24,127,182,1);
 let s=await tick(40);assert.deepEqual([s.x,s.z,s.y],[24,127,0]);assert(s.isConcealed);
 assert.notEqual(s.locationName,'オルヴァスの大神殿');
 for(let z=128;z<=132;z++)await step({x:24,z});
 s=last;assert.equal(s.isConcealed,false);assert(s.seen);
 assert.equal(s.name,'オルヴァスの大神殿');
 assert.equal(s.locationName,s.name);assert.equal(s.locationTitle,s.name);
 assert.equal(s.stars,'★'.repeat(10));assert.equal(s.starLabel,'危険度 10／10');
 assert.equal(s.mapH,182);assert.equal(s.err,0);
 await screenshot('orvas-great-temple-name');
 assert.deepEqual(errors,[]);console.log('PASS real threshold and minimap name, title, ten stars and ARIA',JSON.stringify({at:[s.x,s.z,s.y],name:s.name,stars:s.stars,aria:s.starLabel}));
 await ctx.close();
}catch(e){console.error(phase,last);throw e}
finally{await b?.close();await new Promise(r=>server.close(r))}
