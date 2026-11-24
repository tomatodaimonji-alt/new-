import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
let fixture=readFileSync(process.argv[2]??'world-editor.html','utf8');
function inject(a,b){assert.equal(fixture.split(a).length,2,a);fixture=fixture.replace(a,b)}
const qa="if(facilityParams.get('test')==='1')window.__editorTest={";
inject(qa,qa+`
  rooflessQA:{
   frame:()=>render(),
   state:()=>{
    const d=facilitySite.davidTemple,roofOwner=facilitySite.buildings.findIndex(b=>b.id==='davidTemple'),q=parameters();
    return {x:poiWalkX,z:poiWalkZ,y:poiWalkLevel,room:facilityHiddenRoof(),visible:facilityVisibleRoofs(),third:poiThirdPerson,
     sky:poiSkyCanLookUp(),cssSky:$('viewWrap').hasAttribute('data-poi-sky'),horizon:q.skyHorizon,
     count:facilityRoofMeshes[roofOwner]?.count??0,roofOwner,entry:d.entrance,retreat:d.retreat,
     flap:world.some(o=>o.y>0&&d.ring&&Math.hypot(o.x-d.ring.x,o.z-d.ring.z)<16),
     raster:window.__templeSkyPixels??null,error:gl.getError()};
   },
   stepVector:key=>poiCameraRelativeStep(key),
   view:(pitch,distance)=>{poiCameraPitch=poiOrbitPitchClamp(pitch);poiCameraDistance=distance;poiWalkCamera();}
  },
`);
const frame=' requestAnimationFrame(render);';
inject(frame,' if(!window.__rooflessManual)requestAnimationFrame(render);');
const draw=' facilityDrawRoofs(p.vp);poiDrawGameRoofs(p.vp);';
inject(draw,draw+`
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
 async function seed(x,z,pitch=-.12,distance=5.5){
  await p.goto(base+'/seed',{waitUntil:'domcontentloaded',timeout:45000});
  await p.evaluate(({x,z,pitch,distance})=>{
   localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":360000}');
   localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,position:{x,z,y:0,facing:2},
    townLayout:5,townMapHeight:128,view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:-.15,orbitPitch:pitch,orbitDistance:distance}}));
  },{x,z,pitch,distance});
  await p.goto(base+'/?resume=1&test=1',{waitUntil:'domcontentloaded',timeout:45000});
  await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:35000});
  await p.waitForFunction(()=>window.__editorTest?.facility()?.active,null,{polling:50,timeout:30000});
  await p.clock.pauseAt((await p.evaluate(()=>Date.now()))+1500);
  await p.evaluate(()=>{window.__rooflessManual=true});
 }
 const inspect=async()=>last=await p.evaluate(()=>window.__editorTest.rooflessQA.state());
 async function advance(ms){await p.clock.fastForward(ms);await p.evaluate(()=>window.__editorTest.rooflessQA.frame());return inspect()}
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
 assert.deepEqual(await p.evaluate(()=>['n','e'].map(k=>window.__editorTest.rooflessQA.stepVector(k))),[[0,1],[-1,0]]);
 for(const z of [89,90,91])await walk(29,z,'ArrowUp');
 await walk(29,91,'ArrowUp'); // Real right-hand wing blocks the old off-axis hole.
 for(const x of [28,27,26,25,24])await walk(x,91,'ArrowRight');
 for(const z of [92,93,94,95,96])await walk(24,z,'ArrowUp');
 s=await inspect();openAir(s);
 phase='same stored in-arena position loads exactly and shows real sky pixels at low angle';
 await p.clock.resume();await seed(24,100,-.13,5.5);
 await p.evaluate(()=>{window.__editorTest.rooflessQA.view(-.14,5.5);window.__captureTempleSky=true});
 s=await advance(38);assert.deepEqual([s.x,s.z,s.y],[24,100,0]);openAir(s);
 assert(s.raster&&s.raster.sky>s.raster.total*.09,JSON.stringify(s.raster));
 assert.deepEqual(errors,[]);
 console.log('Native roofless ring: old trail, blocked shoulder, centered real gate crossing, exact old interior save, actual canvas leaves open sky.');
}catch(e){console.error('Roofless QA failed at',phase,last);throw e}
finally{await browser?.close();await new Promise(ok=>server.close(ok))}
