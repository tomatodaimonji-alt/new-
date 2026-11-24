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
  frame:()=>render(),
  inspect:()=>{
   const f=facilitySite.sacredForest,at=poiAimOrigin(performance.now());
   const map=poiLocalFrame,canvas=$('poiMiniMap'),minictx=canvas.getContext('2d');
   const pixel=(x,z)=>{
    if(!map||x<map.crop.x1||x>map.crop.x2||z<map.crop.z1||z>map.crop.z2)return null;
    const px=Math.floor((canvas.width-canvas.height)/2+(x-map.crop.x1+.5)*canvas.height/41),pz=Math.floor((z-map.crop.z1+.5)*canvas.height/41);
    return [...minictx.getImageData(px,pz,1,1).data];
   };
   const mini=map?{concealed:map.concealed,temple:[pixel(22,158),pixel(28,158),pixel(24,164)],
    gate:pixel(24,128),gateFlank:pixel(25,128),gateCell:map.cells[(128-map.crop.z1)*41+24-map.crop.x1],localTrail:pixel(poiWalkX,poiWalkZ-1),builds:poiMiniBuilds,
    saved:JSON.parse(localStorage.getItem(POI_HOTBAR_KEY)||'{}').sacredTempleSeen===true}:null;
   return {x:poiWalkX,z:poiWalkZ,y:poiWalkLevel,name:poiRegionAt(facilitySite,poiWalkX,poiWalkZ,false,poiWalkLevel).name,
    path:f.route,reveal:f.reveal,tree:f.trees[10],fog:[...gl.getUniform(program,loc.sacredFog)],raster:window.__sacredRaster||null,
    scene:poiSacredForestStatus(),stream:typeof poiOverlandInspect==='function'?{active:poiOverlandInspect().drawing,effective:poiOverlandInspect().effective}:null,err:gl.getError(),directions:['n','s','e','w'].map(k=>poiCameraRelativeStep(k)),
    mini,nearTemple:poiDavidTempleContains(facilitySite,at.x,at.z,at.y)};
  }
 },
`);
const raf=' requestAnimationFrame(render);';
replace(raf,' if(!window.__sacredManual)requestAnimationFrame(render);');
const apply=" if(typeof poiSacredApplyFog==='function')poiSacredApplyFog(now,daylight);";
replace(apply,apply+`
 if(window.__sacredCompareDry){gl.uniform3f(loc.sacredFog,0,0,0);gl.clearColor(0,0,0,0)}
`);
const legacyEnd=" if(typeof poiSacredDrawScene==='function')poiSacredDrawScene(p.vp);";
const streamedEnd=" if(!stream&&typeof poiSacredDrawScene==='function')poiSacredDrawScene(p.vp);";
const end=html.includes(streamedEnd)?streamedEnd:legacyEnd;
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
for(const [,s] of html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(s);
if(process.env.SACRED_DISCOVERY_SYNTAX_ONLY)process.exit(0);
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
 async function seed(x,z,legacy=false){
  await p.goto(base+'/seed',{waitUntil:'domcontentloaded',timeout:45000});
  await p.evaluate(({x,z,legacy})=>{
   if(!localStorage.getItem('world-workshop-hotbar-v1'))localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weapon:'equipWoodSword',potions:0,gold:23}));
   localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":360000}');
   localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,position:{x,z,y:0,facing:2},
    townLayout:5,townMapHeight:legacy?128:182,...(legacy?{}:{templeDepth:1}),view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:-.15,orbitPitch:.13,orbitDistance:6}}));
  },{x,z,legacy});
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
 phase='old western save, explore entire continuous world on real gameplay key input';
 await seed(12,49);let s=await tick(38);assert.deepEqual([s.x,s.z,s.y],[12,49,0]);assert(!s.nearTemple,'town-edge meadow does not advertise the temple');
 assert(s.mini?.concealed&&!s.mini.saved);
 const black=[0,0,0,255];
 assert(s.mini.temple.every(c=>c===null),'distant temple is outside the local map');
 const stableTrail=s.mini.localTrail;assert.notDeepEqual(stableTrail,black);
 const route=s.path.slice(1);let raster,compare,peak=0,builds=0,renderedStream=0,first=null;
 for(const q of route){
  await step(q);s=last;peak=Math.max(peak,s.fog[2]);builds=Math.max(builds,s.scene.vertices);renderedStream=Math.max(renderedStream,s.stream?.effective??0);
  if(q.x===24&&q.z===115){
   phase='actual WebGL fog leaves near shaded terrain while replacing distant geometry';
   await p.evaluate(()=>{window.__sacredCapture=true});s=await tick(38);raster=s.raster;first=s;
   if(process.env.FACILITY_SCREENSHOTS){mkdirSync(process.env.FACILITY_SCREENSHOTS,{recursive:true});await p.screenshot({path:process.env.FACILITY_SCREENSHOTS+'/sacred-forest-mist.png'});}
   await p.evaluate(()=>{window.__sacredCompareDry=true;window.__sacredCapture=true});compare=(await tick(16)).raster;
   await p.evaluate(()=>{window.__sacredCompareDry=false});
   phase='woodland bend and clearing';
  }
 }
 assert(peak>.73&&(builds>1000&&builds<=146*180||renderedStream>0));
 assert.equal(s.err,0);assert(s.fog[2]<.04,'weather lifts only at the reveal and entry');
 assert(first&&first.fog[2]>.73&&(raster.haze-compare.haze)>raster.total*.02&&raster.textured>raster.total*.03,JSON.stringify({raster,compare}));
 assert.deepEqual([s.x,s.z],[24,125]);
 assert(s.mini.concealed&&!s.mini.saved,'seeing the clearing does not far-reveal the map ring');
 if(process.env.FACILITY_SCREENSHOTS)await p.screenshot({path:process.env.FACILITY_SCREENSHOTS+'/sacred-forest-reveal.png'});
 phase='continue through same historic gate into the actual temple';
 for(const z of [126,127])await step({x:24,z});
 assert(last.mini.concealed&&!last.mini.saved);assert.equal(last.mini.gateCell,0);assert.deepEqual(last.mini.gateFlank,black);
 const beforeBuild=last.mini.builds;
 await step({x:24,z:128});
 assert(!last.mini.concealed&&last.mini.saved);
 assert(last.mini.temple.every(c=>c===null),'discovery still does not reveal outside local radius');
 assert(last.mini.gateCell>0,'real terrain is drawn below the marker only after reaching the gate');
 assert.notDeepEqual(last.mini.gate,black,'actual map draws the reached gate after discovery');
 assert.equal(last.mini.builds,beforeBuild+1,'same surface cache is rebuilt exactly once at discovery');
 await step({x:24,z:129});
 assert.equal(last.mini.builds,beforeBuild+1);
 assert.equal(last.fog[2],0);assert.equal(last.name,'オルヴァスの大神殿');
 phase='cold reload away from the gate preserves discovery while keeping unrelated pouch data';
 await p.clock.resume();await seed(12,49);s=await tick(38);
 assert(s.mini.saved&&!s.mini.concealed&&s.mini.temple.every(c=>c===null));
 assert.deepEqual(s.mini.localTrail,stableTrail);
 assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('world-workshop-hotbar-v1')).gold),23);
 phase='cold old exact saved arena returns with no fog';
 await p.clock.resume();await seed(24,100,true);s=await tick(38);
 assert.deepEqual([s.x,s.z,s.y],[24,125,0]);assert.equal(s.fog[2],0);
 assert.deepEqual(errors,[]);
 console.log('Native wooded route, baked mesh, real fog raster and old temple gate/reload passed',JSON.stringify({peak,builds,raster}));
}catch(e){console.error(phase,last&&{x:last.x,z:last.z,y:last.y,name:last.name,fog:last.fog,raster:last.raster,scene:last.scene,directions:last.directions});throw e}
finally{await b?.close();await new Promise(ok=>server.close(ok))}
