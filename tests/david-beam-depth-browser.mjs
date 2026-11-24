import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
function inject(s,a,b){assert.equal(s.split(a).length,2,a);return s.replace(a,b)}
const key='  freeMovementPose:()=>({x:poiWalkViewX,z:poiWalkViewZ,level:poiWalkLevel}),';
let fixture=inject(html,key,key+`
  beamDepthQA:()=>{
   window.__beamDepthManual=true;
   const [o,s]=[...poiMonsterStates].find(([m])=>m.type==='monsterStoneDavid')??[];
   let begin=performance.now()+600;
   if(!s?.david?.awake)poiDavidMobFrame(o,s,begin-500);
   if(!s?.david?.awake)return {reason:'authored statue did not wake'};
   if(typeof poiDavidAwakeningTick==='function'&&!s.david.wakeDone){
    const b=poiDavidMatch(o),wake=s.david.wakeAt;
    for(const stage of [POI_DAVID_AWAKENING.first,POI_DAVID_AWAKENING.second,POI_DAVID_AWAKENING.ready]){
     poiDavidAwakeningTick(o,s,b,wake+stage);
    }
    begin=wake+POI_DAVID_AWAKENING.ready+20;
   }
   s.david.attack=null;s.david.next=-Infinity;
   if(!poiDavidBegin(o,s,begin,'beam'))return {reason:'real beam could not start'};
   const q=s.david.attack,w=236,h=116;
   const now=q.hits[0]+90;
   // Actual encounter updates once, so the original contact/emission
   // path, cached geometry and statue pose are the ones being tested.
   q.lastFrameAt=now-16;
   poiDavidCombatFrame(now);
   if(q.cursor!==1)return {reason:'actual beam did not reach scheduled contact',cursor:q.cursor};
   const px=s.x+.5,pz=s.z+.5,y=terrainY(s.x,s.z)+o.y*1.4,at=[px,y+4.57,pz];
   const view=side=>mult(ortho(-.30,.30,-.18,.18,.08,15),look([px,y+4.57,pz+side*4],at));
   const grab=(side,order)=>{
    const vp=view(side),pixels=new Uint8Array(w*h*4);
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);poiMonsterMeshDirty=true;
    const light=poiDrawDavidCue(now,vp);
    if(!light)return null;
    if(order==='before')poiDrawDavidBeam(now,vp,light);
    poiMonsterRender(now,vp);
    if(order==='after')poiDrawDavidBeam(now,vp,light);
    gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return pixels;
   };
   const delta=(a,b)=>{
    let changed=0,red=0;
    for(let i=0;i<a.length;i+=4){
     const shift=Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]);
     if(shift>18)changed++;if(a[i]>b[i]+12)red++;
    }
    return {changed,red};
   };
   gl.viewport(0,0,w,h);gl.disable(gl.BLEND);gl.enable(gl.DEPTH_TEST);gl.depthMask(true);
   gl.useProgram(program);gl.uniform3f(loc.daylight,.64,.60,.65);
   const front=grab(-1,'none'),back=grab(1,'none');
   if(!front||!back)return {reason:'no real thermal packet'};
   const early=delta(grab(-1,'before'),front),late=delta(grab(-1,'after'),front),hidden=delta(grab(1,'after'),back);
   const mask=gl.getParameter(gl.DEPTH_WRITEMASK),depth=gl.isEnabled(gl.DEPTH_TEST),blend=gl.isEnabled(gl.BLEND);
   gl.viewport(0,0,canvas.width,canvas.height);
   return {early,late,hidden,mask,depth,blend,gl:gl.getError()};
  },`);
fixture=inject(fixture,' requestAnimationFrame(render);',' if(!window.__beamDepthManual)requestAnimationFrame(render);');
fixture=inject(fixture,'function poiWildRegionalFrame(now,rng){','function poiWildRegionalFrame(now,rng){return;');
fixture=inject(fixture,'function poiWildPick(rng){','function poiWildPick(rng){return null;');
fixture=inject(fixture,'function poiDavidMobFrame(o,s,now){','function poiDavidMobFrame(o,s,now){if(!window.__beamDepthManual)return false;');
for(const [,js] of fixture.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(js);
if(process.env.DAVID_LAYOUT_ONLY==='1'){console.log('PASS exact beam depth native anchors and inline syntax');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<!doctype html><title>David beam depth QA</title>':fixture)});
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
 await p.waitForFunction(()=>window.__editorTest?.beamDepthQA&&window.__editorTest.facility().active,null,{timeout:12000});
 const out=await p.evaluate(()=>window.__editorTest.beamDepthQA());console.log(JSON.stringify(out));
 assert.equal(out.gl,0);
 assert.equal(out.mask,true);assert.equal(out.depth,true);assert.equal(out.blend,false);
 assert(out.late.changed>80&&out.late.changed>out.early.changed+65,JSON.stringify(out));
 assert(out.hidden.changed<out.late.changed*.13,JSON.stringify(out));
 assert.deepEqual(errors,[]);
 console.log('PASS true depth-tested beam shows in front and stays behind opaque David from the reverse angle');
}finally{await browser?.close();await new Promise(r=>server.close(r))}
