import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
function inject(s,a,b){assert.equal(s.split(a).length,2,a);return s.replace(a,b)}
const key='  freeMovementPose:()=>({x:poiWalkViewX,z:poiWalkViewZ,level:poiWalkLevel}),';
let fixture=inject(html,key,key+`
  eyeQA:()=>{
   window.__eyeManual=true;
   const [o,s]=[...poiMonsterStates].find(([m])=>m.type==='monsterStoneDavid')??[];
   const begin=performance.now()+600;
   if(!s?.david?.awake)poiDavidMobFrame(o,s,begin-500);
   if(!s?.david?.awake)return {reason:'authored statue did not wake'};
   s.david.attack=null;s.david.next=-Infinity;
   if(!poiDavidBegin(o,s,begin,'beam'))return {reason:'real beam could not start'};
   const q=s.david.attack,w=236,h=116;
   // Native frame cutout with actual shared world monster upload and
   // daylight shader at fixed twilight and viewpoint. Never paint an
   // artificial swatch or replace the existing statue geometry.
   const px=s.x+.5,pz=s.z+.5,y=terrainY(s.x,s.z)+o.y*1.4,
     eye=[px,y+4.73,pz-3],lookAt=[px,y+4.73,pz],
     vp=mult(ortho(-.53,.53,-.26,.26,.08,15),look(eye,lookAt));
   const pixels=new Uint8Array(w*h*4),out=[];
   gl.viewport(0,0,w,h);gl.disable(gl.BLEND);gl.enable(gl.DEPTH_TEST);gl.depthMask(true);
   gl.useProgram(program);gl.uniform3f(loc.daylight,.49,.43,.50);
   for(const frac of [.03,.27,.51,.72,.96]){
    const now=q.start+frac*(q.hits[0]-q.start),pose=poiDavidPose(s,now);
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    poiMonsterMeshDirty=true;
    poiMonsterRender(now,vp);
    gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    const peak=[];let bright=0,red=0;
    for(let i=0;i<pixels.length;i+=4){
     const r=pixels[i],g=pixels[i+1],b=pixels[i+2];
     if(pixels[i+3]>0&&r>g*1.64&&r>b*1.68){peak.push(r);red+=r;if(r>=190)bright++}
    }
    out.push({phase:pose.phase,frac,red,bright,peak:Math.max(0,...peak),cursor:q.cursor,remaining:q.hits[0]-now,mesh:poiMonsterMesh.count});
   }
   gl.viewport(0,0,canvas.width,canvas.height);
   return {frames:out,gl:gl.getError()};
  },`);
fixture=inject(fixture,' requestAnimationFrame(render);',' if(!window.__eyeManual)requestAnimationFrame(render);');
fixture=inject(fixture,'function poiWildRegionalFrame(now,rng){','function poiWildRegionalFrame(now,rng){return;');
fixture=inject(fixture,'function poiWildPick(rng){','function poiWildPick(rng){return null;');
fixture=inject(fixture,'function poiDavidMobFrame(o,s,now){','function poiDavidMobFrame(o,s,now){if(!window.__eyeManual)return false;');
for(const [,js] of fixture.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(js);
if(process.env.DAVID_LAYOUT_ONLY==='1'){console.log('PASS exact eye native anchors and inline syntax');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<!doctype html><title>David eye QA</title>':fixture)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
let browser;const errors=[];
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const p=await browser.newPage({viewport:{width:844,height:390},deviceScaleFactor:.7,isMobile:true,hasTouch:true});
 p.on('pageerror',e=>errors.push(e.message));
 await p.goto(url+'/seed');
 await p.evaluate(()=>{
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:24,z:101,y:0,facing:2},townLayout:5,townMapHeight:128,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.35,orbitDistance:5.5}}));
  localStorage.setItem('world-workshop-hotbar-v1','{"version":1,"weapon":"equipWoodSword","potions":0,"gold":0}');
 });
 await p.goto(url+'/?resume=1&test=1',{waitUntil:'domcontentloaded',timeout:25000});
 await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:23000});
 await p.waitForFunction(()=>window.__editorTest?.eyeQA&&window.__editorTest.facility().active,null,{timeout:12000});
 const out=await p.evaluate(()=>window.__editorTest.eyeQA());console.log(JSON.stringify(out));
 assert.equal(out.gl,0);
 assert.equal(out.frames?.length,5);
 assert(out.frames.every(r=>r.phase==='windup'&&r.cursor===0&&r.remaining>0&&r.mesh>2200));
 const peak=out.frames.map(r=>r.peak);
 assert(peak.every((v,i)=>i===0||v>peak[i-1])&&peak.at(-1)>peak[0]+90,JSON.stringify(peak));
 assert(out.frames.at(-1).bright>=24&&out.frames[0].bright===0);
 assert.deepEqual(errors,[]);
 console.log('PASS true WebGL twilight eye pixels brighten before first beam contact');
}finally{await browser?.close();await new Promise(r=>server.close(r))}
