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

  inspect:()=>{
   const f=facilitySite.sacredForest,at=poiAimOrigin(performance.now());
   return {x:poiWalkX,z:poiWalkZ,y:poiWalkLevel,name:poiRegionAt(facilitySite,poiWalkX,poiWalkZ,false,poiWalkLevel).name,
    path:f.route,mapH:MAP_H,roofDraws:window.__depthRoofDraws??0,isConcealed:poiMiniSnapshot()?.concealed,reveal:f.reveal,tree:f.trees[10],fog:[...gl.getUniform(program,loc.sacredFog)],raster:window.__sacredRaster||null,
    scene:poiSacredForestStatus(),err:gl.getError(),directions:['n','s','e','w'].map(k=>poiCameraRelativeStep(k)),
    nearTemple:poiDavidTempleContains(facilitySite,at.x,at.z,at.y)};
  }
 },
`);
const raf=' requestAnimationFrame(render);';
replace(raf,' if(!window.__sacredManual)requestAnimationFrame(render);');
const apply=" if(typeof poiSacredApplyFog==='function')poiSacredApplyFog(now,daylight);";
replace(apply,apply+`
 if(window.__sacredCompareDry){gl.uniform3f(loc.sacredFog,0,0,0);gl.clearColor(0,0,0,0)}
`);
const end=" if(typeof poiSacredDrawScene==='function')poiSacredDrawScene(p.vp);";
replace(end,end+`
 if(window.__sacredCapture){
  window.__sacredCapture=false;
  const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,pixels=new Uint8Array(w*h*4);
  gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
  const color=gl.getUniform(program,loc.sacredColor);let haze=0,textured=0;
  for(let i=0;i<pixels.length;i+=4){
   if(pixels[i+3]<252)continue;
   const d=Math.max(...[0,1,2].map(j=>Math.abs(pixels[i+j]-color[j]*255)));
   if(d<2.5)haze++;else if(d>14)textured++;
  }
  window.__sacredRaster={haze,textured,total:w*h};
 }
`);
replace(' for(const i of facilityVisibleRoofs()){',` for(const i of facilityVisibleRoofs()){
  if(facilitySite.buildings[i]?.id==='davidTemple')window.__depthRoofDraws=(window.__depthRoofDraws??0)+facilityRoofMeshes[i].count;
 `);
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
  await p.keyboard.press(['ArrowUp','ArrowDown','ArrowRight','ArrowLeft'][i]);
  const n=await tick();assert.deepEqual([n.x,n.z,n.y],[q.x,q.z,0],'actual collision and west trail');
 }
 const screenshot=async name=>{if(process.env.FACILITY_SCREENSHOTS){mkdirSync(process.env.FACILITY_SCREENSHOTS,{recursive:true});await p.screenshot({path:process.env.FACILITY_SCREENSHOTS+'/'+name+'.png'});}};
 phase='two stock town gates reveal open sky, not the far roof';
 await seed(23,49);let s=await tick(40);assert.equal(s.mapH,182);assert.equal(s.z,49);assert.equal(s.roofDraws,0);assert.equal(s.fog[2],0);
 await screenshot('open-west-town-gate');
 const gate=async(x,z,yaw)=>{
  assert(await p.evaluate(([x,z,yaw])=>window.__editorTest.sacredQA.gate(x,z,yaw),[x,z,yaw]));
  return tick(32);
 };
 s=await gate(41,69,-.55);assert.deepEqual([s.x,s.z],[41,69]);assert.equal(s.roofDraws,0);assert.equal(s.fog[2],0);
 await screenshot('open-south-town-gate');
 phase='walk the whole contiguous path into the grove and 54 cells beyond the old temple';
 s=await gate(23,49,0);for(let x=22;x>=12;x--)await step({x,z:49});s=last;
 const route=s.path.slice(1);let peak=0,maxTrees=0,forests=[],raw,clear;
 for(const q of route){
  await step(q);s=last;peak=Math.max(peak,s.fog[2]);maxTrees=Math.max(maxTrees,s.scene.vertices);
  if(q.x===15&&q.z===67){assert.equal(s.fog[2],0);assert.equal(s.roofDraws,0)}
  if(q.x===13&&[75,96].includes(q.z)||q.x===18&&q.z===109)forests.push(s.fog[2]);
  if(q.x===18&&q.z===109){
   phase='actual WebGL keeps near woods but blends the long sightline';
   await p.evaluate(()=>{window.__sacredCapture=true});raw=(await tick(36)).raster;
   await p.evaluate(()=>{window.__sacredCompareDry=true;window.__sacredCapture=true});clear=(await tick(16)).raster;
   await p.evaluate(()=>{window.__sacredCompareDry=false});
   if(process.env.FACILITY_SCREENSHOTS){mkdirSync(process.env.FACILITY_SCREENSHOTS,{recursive:true});await p.screenshot({path:process.env.FACILITY_SCREENSHOTS+'/depth-fog.png'});}
  }
 }
 assert.deepEqual([s.x,s.z,s.y],[24,125,0]);assert.equal(s.err,0);
 assert(peak>.85&&maxTrees>1800&&maxTrees<=96*180&&forests.length===3&&forests.every((v,i)=>!i||v>forests[i-1]),JSON.stringify({peak,maxTrees,forests}));
 assert(raw&&clear&&(raw.haze-clear.haze)>raw.total*.03&&raw.textured>raw.total*.04,JSON.stringify({raw,clear}));
 assert(s.fog[2]<.035&&s.roofDraws>0,'healthy close reveal of actual dome');
 if(process.env.FACILITY_SCREENSHOTS)await p.screenshot({path:process.env.FACILITY_SCREENSHOTS+'/depth-reveal.png'});
 phase='actual north forecourt and straight covered same-world crossing';
 for(let z=126;z<=132;z++)await step({x:24,z});
 assert.equal(last.fog[2],0);assert.equal(last.name,'白環の大神殿');
 phase='old temple check-in migrates safe, new deep check-in resumes exactly';
 await p.clock.resume();await seed(24,104);s=await tick(38);
 assert.deepEqual([s.x,s.z,s.y],[24,125,0]);
 await p.clock.resume();await seed(24,134,182,1);s=await tick(38);
 assert.deepEqual([s.x,s.z,s.y],[24,134,0]);assert.equal(s.fog[2],0);
 assert.deepEqual(errors,[]);
 console.log('PASS real approach, hidden actual roof from both town gates, progressive WebGL fog, continuous deep entry and both saved positions',JSON.stringify({peak,maxTrees,forests,raw,clear}));
}catch(e){console.error(phase,last&&{x:last.x,z:last.z,y:last.y,name:last.name,fog:last.fog,raster:last.raster,scene:last.scene,directions:last.directions});throw e}
finally{await b?.close();await new Promise(ok=>server.close(ok))}
