import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {Script} from 'node:vm';
const html=readFileSync(process.argv[2]??'world-editor.html','utf8'),baseline=process.argv.includes('--baseline');
let h=html;
function inject(a,b){assert.equal(h.split(a).length,2,a);h=h.replace(a,b);}
const qa="if(facilityParams.get('test')==='1')window.__editorTest={";
inject(qa,qa+`
 houseCamQA:{
  pause:()=>{window.__houseManual=true},draw:()=>render(),
  data:()=>{
   const f=window.__houseFrame,level=poiWalkLevel;
   const owner=facilityHiddenRoof(),door=poiWalkDoorOpen;
   return {...f,t:performance.now(),z:poiWalkZ,x:poiWalkX,level,from:[poiWalkFromX,poiWalkFromZ],
    ready:poiWalkNextReady,house:owner===null?null:facilitySite.buildings[owner].id,
    roof:owner===null?null:facilityVisibleRoofs().includes(owner),door:door?[door.x,door.z]:null,
    photoGeometry:world.some(o=>o.x===76&&o.z===60&&o.y===0&&o.type==='oldTownFlowerBox')&&
     world.some(o=>o.x===75&&o.z===60&&o.y===0&&isFloor(o.type)),
    screen:location.href,covered:!$('pineStartupCover').hidden,tower:facilitySite.buildings.find(b=>b.id==='watchtower')?.entrance};
  },
  key:(dx,dz)=>['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].find(k=>{
   const v=poiCameraRelativeStep({ArrowUp:'n',ArrowDown:'s',ArrowLeft:'w',ArrowRight:'e'}[k]);return v[0]===dx&&v[1]===dz;
  }),
 },
`);
inject(' requestAnimationFrame(render);',' if(!window.__houseManual)requestAnimationFrame(render);');
const anchor=h.match(/  const arm=eye===desired\?(?:radius|poiCameraDistance):Math\.hypot\(\.\.\.eye\.map\(\(v,i\)=>v-target\[i\]\)\);/)?.[0];
assert(anchor,'perspective arm');
inject(anchor,anchor+`
  if(window.__houseManual){
   const ray=eye.map((v,i)=>v-target[i]),len=Math.hypot(...ray),v=len?ray.map(x=>x/len):[0,0,0];
   let unsafe=false;
   for(const {s,x,y,z} of poiWallCameraCandidates(target,eye)){
    const o=[target[0]-x,target[1]-y,target[2]-z],near=poiWallCameraSlab(s,o,v,len);
    if(Number.isFinite(near)){
     const hit=s.tris?poiWallCameraTriangles(s.tris,o,v,len):near;
     if(hit>.001&&hit<len-.018)unsafe=true;
    }
   }
   const pitch=Math.atan2(ray[1],Math.hypot(ray[0],ray[2]));
   window.__houseFrame={eye,target,desired,arm,pitch,requested:poiCameraPitch,yaw:poiCameraYaw,unsafe};
  }
`);
for(const [,body] of h.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(body);
if(process.env.HOUSE_CAMERA_PARSE_ONLY){console.log('actual verified game source anchors and script syntax');process.exit(0);}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>Ordinary homes camera</title>':h)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
const max=(xs,f)=>Math.max(...xs.map(f));
const angle=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
let browser;
const shots=process.env.FACILITY_SCREENSHOTS;
try{
 if(shots)await mkdir(shots,{recursive:true});
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 for(const sc of [
  {name:'pictured one-tile lane by flower box',start:[75,57],yaw:1.08,pitch:.35,route:[[75,58],[75,59],[75,60],[75,61],[75,62],[75,61],[75,60]]},
  {name:'cottage authentic front threshold, chosen low view',start:[72,65],yaw:0,pitch:-.11,route:[[72,64],[72,63],[72,62],[72,61],[72,62],[72,63],[72,64],[72,65]]}
 ]){
  const ctx=await browser.newContext({viewport:{width:900,height:420},isMobile:true,hasTouch:true,deviceScaleFactor:.72});
  const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(17000);
  try{
   await p.clock.install({time:new Date('2026-04-01T12:57:00Z')});
   await p.goto(url+'/seed');await p.evaluate(({start:[x,z],yaw,pitch})=>{
    localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":388500}');
    localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
     position:{x,z,y:0,facing:2},townLayout:5,townMapHeight:128,
     view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:yaw,orbitPitch:pitch,orbitDistance:5.5}}));
   },sc);
   await p.goto(url+'/?resume=1&test=1',{waitUntil:'domcontentloaded'});await p.locator('#pineStartupCover').waitFor({state:'hidden'});
   await p.waitForFunction(()=>window.__editorTest?.facility?.().active);
   await p.evaluate(()=>window.__editorTest.houseCamQA.pause());
   await p.clock.pauseAt((await p.evaluate(()=>Date.now()))+3000);
   const data=()=>p.evaluate(()=>window.__editorTest.houseCamQA.data());
   const frame=async(ms=43)=>{
    await p.clock.fastForward(ms);await p.evaluate(()=>window.__editorTest.houseCamQA.draw());return data();
   };
   let a=await frame(220);const frames=[a];assert.deepEqual([a.x,a.z],sc.start);assert(a.photoGeometry);
   for(const [x,z] of sc.route){
    const move=[x-a.x,z-a.z],k=await p.evaluate(([dx,dz])=>window.__editorTest.houseCamQA.key(dx,dz),move);
    assert(k,JSON.stringify(move));await p.keyboard.press(k);
    for(let i=0;i<6;i++){a=await frame();frames.push(a)}
    assert.deepEqual([a.x,a.z,a.level],[x,z,0],sc.name+' trusted step '+JSON.stringify(a));
    if(shots&&z===60&&x===75&&sc.route.indexOf(sc.route.find(e=>e[1]===60))!==-1&&frames.length<28){
     try{await p.screenshot({path:shots+'/'+(baseline?'before':'after')+'-pictured-x75-z60.png',timeout:6000});}catch(e){if(e.name!=='TimeoutError')throw e}
    }
   }
   const tilt=max(frames,f=>f.pitch),error=max(frames,f=>Math.abs(f.pitch-sc.pitch));
   const gap=max(frames.slice(1),(f)=>{const i=frames.indexOf(f),prior=frames[i-1];return Math.abs(f.arm-prior.arm);});
   console.log(sc.name,JSON.stringify({tilt,error,gap,minArm:Math.min(...frames.map(f=>f.arm)),arc:frames.filter((_,i)=>i%6===0).map(f=>[f.x,f.z,f.arm,f.pitch,f.house,f.roof,f.unsafe])}));
   if(sc.name.startsWith('pictured')){
    assert(frames.every(f=>f.house===null),'same alley never switches to an indoor roof cutaway');
    if(baseline)assert(tilt>1.11,'prior short collision arm reproduced the owner’s near-overhead photo');
   } else {
    assert(frames.some(f=>f.door?.[0]===72&&f.door[1]===63&&f.house==='cottage'&&!f.roof),'actual door tile uses real appropriate roof cutaway');
    assert(frames.at(-1).house===null&&frames[0].house===null);
   }
   if(!baseline){
    assert(error<.025,sc.name+' user pitch persists through contact');
    assert(frames.every(f=>!f.unsafe&&!f.covered&&f.screen===frames[0].screen),'actual collision remains blocked, no scene/cover transition');
    assert(frames.every(f=>Math.abs(angle(f.yaw,sc.yaw))<.001),'no state rotation');
    const retraction=Math.min(...frames.map(f=>f.arm));
    assert(retraction<2.0,'real opposing masonry still shortens the arm instead of clipping through');
    assert(gap<1.20,'no material jumps in the real short-arm distance');
   }
   if(!baseline&&sc.name.startsWith('pictured')){
    const cdp=await ctx.newCDPSession(p),point=x=>({x,y:167,id:7,radiusX:3,radiusY:3,force:.7});
    const name=await p.evaluate(()=>document.elementFromPoint(645,167)?.id);assert.equal(name,'view');
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(645)]});
    for(const x of [667,690,714])await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point(x)]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    const turned=await frame(230);assert(Math.abs(angle(turned.yaw,sc.yaw))>.25,'actual manual camera still rotates');
    await cdp.detach();
   }
   assert.deepEqual(errors,[]);
  }finally{await ctx.close();}
 }
 console.log(baseline?'PASS reproduced exact pitched narrow alley and authentic cottage opening':'PASS native stable ordinary camera with true masonry occlusion and trusted movement/camera control');
}finally{await browser?.close();await new Promise(r=>server.close(r))}
