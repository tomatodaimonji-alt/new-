import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {Script} from 'node:vm';
let fixture=readFileSync(process.argv[2]??'world-editor.html','utf8');
function inject(a,b){assert.equal(fixture.split(a).length,2,a);fixture=fixture.replace(a,b)}
const qa="if(facilityParams.get('test')==='1')window.__editorTest={";
inject(qa,`
  window.__rooflessQA={
   frame:()=>render(),
   yaw:yaw=>{poiCameraYaw=yaw;poiWalkCamera();},
   state:()=>{
    const d=facilitySite.davidTemple,roofOwner=facilitySite.buildings.findIndex(b=>b.id==='davidTemple'),q=parameters();
    return {active:poiWalkActive,startup:window.pineStartup?.ready===true,x:poiWalkX,z:poiWalkZ,y:poiWalkLevel,room:facilityHiddenRoof(),visible:facilityVisibleRoofs(),third:poiThirdPerson,
     sky:poiSkyCanLookUp(),cssSky:$('viewWrap').hasAttribute('data-poi-sky'),horizon:q.skyHorizon,
     count:facilityRoofMeshes[roofOwner]?.count??0,roofOwner,entry:d.entrance,retreat:d.retreat,
     flap:world.some(o=>o.y>0&&d.ring&&Math.hypot(o.x-d.ring.x,o.z-d.ring.z)<16),
     raster:window.__templeSkyPixels??null,error:gl.getError()};
   },
   stepVector:key=>poiCameraRelativeStep(key),
   view:(pitch,distance)=>{poiCameraPitch=poiOrbitPitchClamp(pitch);poiCameraDistance=distance;poiWalkCamera();}
  };
`+qa);
// Presentation-only A/B: the second navigation omits only this authored
// planting, through the normal static map builder and native world renderer.
const planted="  prop(x,z,type,rot);\n  if(isTree||type==='bush')plantedTrees.push(props.at(-1));";
inject(planted,"  if(!location.search.includes('bare=1')){"+planted+"}"); 
const frame=' requestAnimationFrame(render);';
inject(frame,' if(!window.__rooflessManual)requestAnimationFrame(render);');
const draw=' facilityDrawRoofs(p.vp);poiDrawGameRoofs(p.vp);';
inject(draw,draw+`
 if(window.__captureFoliage){
  window.__captureFoliage=false;
  const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,x=Math.floor(w*.06),y=Math.floor(h*.18),bw=Math.floor(w*.88),bh=Math.floor(h*.74);
  const pix=new Uint8Array(bw*bh*4);gl.readPixels(x,y,bw,bh,gl.RGBA,gl.UNSIGNED_BYTE,pix);
  window.__foliageRaster=Array.from(pix);
 }
 if(window.__captureTempleSky){
  window.__captureTempleSky=false;
  const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,x=Math.floor(w*.30),width=Math.max(1,Math.floor(w*.40));
  const pix=new Uint8Array(width*4*Math.max(1,Math.floor(h*.13)));
  gl.readPixels(x,Math.floor(h*.85),width,pix.length/(width*4),gl.RGBA,gl.UNSIGNED_BYTE,pix);
  let sky=0;for(let i=3;i<pix.length;i+=4)if(pix[i]<16)sky++;
  window.__templeSkyPixels={total:pix.length/4,sky};
 }
`);
for(const [,js] of fixture.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(js);
if(process.env.DAVID_DOME_SYNTAX_ONLY||process.env.DAVID_ROOFLESS_SYNTAX_ONLY){console.log('instrumented roofless fixture scripts parse');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>Roofless QA</title>':fixture)});
await new Promise((ok,no)=>server.listen(0,'127.0.0.1',ok).once('error',no));
const base='http://127.0.0.1:'+server.address().port;let browser,phase='launch',last;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const p=await(await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:.75})).newPage(),errors=[];
 p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(30000);
 await p.clock.install({time:new Date('2026-04-01T10:00:00Z')});
 async function seed(x,z,pitch=-.12,distance=5.5,bare=false){
  await p.goto(base+'/seed',{waitUntil:'domcontentloaded',timeout:45000});
  await p.evaluate(({x,z,pitch,distance})=>{
   localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":360000}');
   localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,position:{x,z,y:0,facing:2},
    townLayout:5,townMapHeight:128,view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:-.15,orbitPitch:pitch,orbitDistance:distance}}));
  },{x,z,pitch,distance});
  await p.goto(base+'/?resume=1&test=1'+(bare?'&bare=1':''),{waitUntil:'domcontentloaded',timeout:45000});
  await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:35000});
  await p.waitForFunction(()=>window.__rooflessQA?.state?.().active===true&&window.__rooflessQA.state().startup===true,null,{polling:50,timeout:30000});
  await p.clock.pauseAt((await p.evaluate(()=>Date.now()))+1500);
  await p.evaluate(()=>{window.__rooflessManual=true});
 }
 const inspect=async()=>last=await p.evaluate(()=>window.__rooflessQA.state());
 async function advance(ms){await p.clock.fastForward(ms);await p.evaluate(()=>window.__rooflessQA.frame());return inspect()}
 function openAir(s){
  assert.equal(s.room,null);assert.equal(s.count,0);assert.equal(s.flap,false);
  assert(!s.visible.includes(s.roofOwner));assert.equal(s.sky,true);assert.equal(s.cssSky,true);assert(Number.isFinite(s.horizon));assert.equal(s.error,0);
 }
 async function walk(x,z,key){
  await p.keyboard.press(key);const s=await advance(225);
  assert.deepEqual([s.x,s.z,s.y],[x,z,0],key+' landed on the actual prescribed old path');
 }
 phase='historic outdoor save and walk through actual matching aperture';
 await seed(29,88,.12,7);
 let s=await advance(38);assert.deepEqual([s.x,s.z,s.y],[29,88,0]);openAir(s);
 assert.deepEqual(s.entry,{x:24,z:94,y:0});assert.deepEqual(s.retreat,{x:24,z:91,y:0});
 assert.deepEqual(await p.evaluate(()=>['n','e'].map(k=>window.__rooflessQA.stepVector(k))),[[0,1],[-1,0]]);
 for(const z of [89,90,91])await walk(29,z,'ArrowUp');
 await walk(29,91,'ArrowUp'); // Real right-hand wing blocks the old off-axis hole.
 for(const x of [28,27,26,25,24])await walk(x,91,'ArrowRight');
 for(const z of [92,93,94,95,96])await walk(24,z,'ArrowUp');
 s=await inspect();openAir(s);
 phase='real rotated WebGL renders with and without outdoor plants';
 async function capture(){
  const poses=[];
  for(const yaw of [-1.36,-.78,-.36,.40,.86,1.38]){
   await p.evaluate(yaw=>{window.__rooflessQA.yaw(yaw);window.__captureFoliage=true},yaw);
   const t=await advance(24);assert.deepEqual([t.x,t.z,t.y],[29,88,0]);
   poses.push(await p.evaluate(()=>window.__foliageRaster));
  }
  return poses;
 }
 await p.clock.resume();await seed(29,88,.10,8);
 const green=await capture();
 if(process.env.FACILITY_SCREENSHOTS){await mkdir(process.env.FACILITY_SCREENSHOTS,{recursive:true});await p.screenshot({path:process.env.FACILITY_SCREENSHOTS+'/david-natural-entrance.png'});}
 await p.clock.resume();await seed(29,88,.10,8,true);
 const bare=await capture();
 const counts=green.map((pixels,frame)=>{
  const before=bare[frame];assert(pixels.length>1000&&pixels.length===before.length);
  let plantPixels=0;
  for(let k=0;k<pixels.length;k+=4){
   const [r,g,b,a]=pixels.slice(k,k+4);
   if(a>200&&g>r*1.20&&g>b*1.13&&
      Math.abs(r-before[k])+Math.abs(g-before[k+1])+Math.abs(b-before[k+2])>29)plantPixels++;
  }
  return plantPixels;
 });
 assert(counts.filter(n=>n>=45).length>=2,'rotating camera reveals added real foliage pixels in separate roomy views: '+counts);
 console.log('Actual foliage pixel differences at rotated approach:',counts);
 assert.deepEqual(errors,[]);
 console.log('Native roofless planted ring: old trail, blocked wing, centered gate, and added foliage visible in actual rotated WebGL frames.');
}catch(e){console.error('Roofless QA failed at',phase,last);throw e}
finally{await browser?.close();await new Promise(ok=>server.close(ok))}
