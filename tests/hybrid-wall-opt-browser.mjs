import a from 'node:assert/strict';import {createServer} from 'node:http';import {createRequire} from 'node:module';
import {readFileSync,mkdirSync} from 'node:fs';import {Script} from 'node:vm';
let h=readFileSync(process.argv[2]??'world-editor.html','utf8');
const put=(x,y)=>{a.equal(h.split(x).length,2,x);h=h.replace(x,y)};
put(' const eligible=outdoor&&!templeGround;', ' if(window.__hybridBackend===\'stock\'&&facilitySite?.id===\'base\')return null;\n const eligible=outdoor&&!templeGround;');
put(" const near=poiOverlandScope(site,poiWalkViewX,poiWalkViewZ),prewarm=poiOverlandScope(site,poiWalkViewX,poiWalkViewZ,8);",
 " const near=window.__hybridBackend==='stream'||poiOverlandScope(site,poiWalkViewX,poiWalkViewZ),prewarm=near||poiOverlandScope(site,poiWalkViewX,poiWalkViewZ,8);");
put('function poiHybridWallDraw(vp){','function poiHybridWallDraw(vp){\n if(window.__hybridSkip)return;');
put(" const ext=typeof gl.drawArraysInstanced==='function'?{"," if(window.__hybridNoAngle)return false;\n const ext=typeof gl.drawArraysInstanced==='function'?{");
put(' requestAnimationFrame(render);',` requestAnimationFrame(render);
 window.__gateStarted=poiWallNow();`);
put(' poiScreenNoteCaptureFrame();',` poiScreenNoteCaptureFrame();
 (window.__gateTimings??=[]).push([window.__gateStarted,poiWallNow()]);if(window.__gateTimings.length>180)window.__gateTimings.shift();
 if(window.__gateRequest){
  const done=window.__gateRequest;window.__gateRequest=null;const w=canvas.width,h=canvas.height,v=new Uint8Array(w*h*4);
  gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,v);done({w,h,v:[...v]});
 }`);
const api="if(facilityParams.get('test')==='1')window.__editorTest={";
put(api,api+`
 gateQA:()=>{
  const q=poiHybridGateFrame.find(v=>v.key==='base:84,67'),p=poiOutdoorFrame?.g;
  return {gate:!!q,weights:q&&poiHybridGateWeights(...p,84,67),city:facilitySite.id,pose:p,
   near:poiOverlandInspect().bytes,coarse:poiOutdoorFarBytes,gateBytes:poiHybridGateBytes,wall:poiHybridWallDebug,wallBytes:poiHybridWallBytes,
   stream:poiOverlandDrawing,frame:window.__gateTimings,raw:window.__gateRaw,err:gl.getError(),
   coarseGround:poiOutdoorProbe.drawn.filter(r=>r.ground>0).length,coarseProps:poiOutdoorProbe.drawn.filter(r=>r.props>0).length,groundBins:poiOverlandGroundDrawn.size,
   layers:q&&q.e.gpus.map(m=>m?.count??0),worldCount:sceneMesh?.count??0};
 },
 gateShot:(skip)=>new Promise(done=>{window.__hybridSkip=skip;window.__gateRequest=done}),
 `);
for(const [,js] of h.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(js);
if(process.env.OUTDOOR_PARSE_ONLY)process.exit(0);
const {chromium}=createRequire(import.meta.url)('playwright'),s=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>seed</title>':h)
});
await new Promise(r=>s.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+s.address().port;
const mode=process.env.HYBRID_BACKEND??'stock',backend=mode.startsWith('stream')?'stream':'stock',enabled=!mode.endsWith('control'),fallback=mode.endsWith('fallback'),optimized=mode.endsWith('opt')||fallback,tier=process.env.HYBRID_TIER??'near';
const coords={near:[102,67],middle:[108,85],far:[124,88]},[x,z]=coords[tier],yaw=Math.atan2(84-x,67-z),expected={near:0,middle:1,far:2}[tier];
let b;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const ctx=await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:.68,isMobile:true,hasTouch:true}),p=await ctx.newPage(),errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(({backend,fallback})=>{window.__hybridBackend=backend;window.__hybridNoAngle=fallback;
  function mark(t){(window.__gateRaw??=[]).push(t);if(window.__gateRaw.length>180)window.__gateRaw.shift();requestAnimationFrame(mark)}
  requestAnimationFrame(mark);
 },{backend,fallback});
 await p.goto(url+'/seed');
 await p.evaluate(({x,z,yaw})=>{
  localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":390000}');
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x,z,y:0,facing:2},townLayout:5,townMapHeight:182,templeDepth:1,
   view:{yaw:0,zoom:1,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:yaw,orbitPitch:.11,orbitDistance:5.6}}));
 },{x,z,yaw});
 await p.goto(url+'/?resume=1&test=1&uniform-outdoor=1&uniform-shell=1&uniform-split=1&hybrid-gate=1'+(enabled?'&hybrid-wall=1':'')+(optimized?'&hybrid-wall-opt=1':''));
 await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:45000});
 const read=()=>p.evaluate(()=>window.__editorTest.gateQA());
 try{await p.waitForFunction(({stream,x,z})=>{
  const q=window.__editorTest?.gateQA();return q?.stream===stream&&q.gate&&q.pose[0]===x&&q.pose[1]===z&&q.frame.length>=32;
 },{x,z,stream:backend==='stream'},{timeout:18000,polling:125})}
 catch(e){const q=await read();delete q.frame;delete q.raw;console.error('setup',q,errors);throw e}
 const q=await read();a(q.weights[expected]>.94,JSON.stringify(q.weights));if(optimized){a(q.layers.filter(Boolean).length===1&&q.layers[expected]>0,JSON.stringify(q.layers));}
 else a(q.layers[0]>q.layers[1]&&q.layers[1]>q.layers[2]);
 a(q.near+q.coarse+q.gateBytes+q.wallBytes<=4*1024*1024&&q.err===0,JSON.stringify(q));
 const stat=a=>{const t=[...a].sort((x,y)=>x-y);return {p95:t[Math.floor((t.length-1)*.95)],max:t.at(-1),n:t.length}};
 const raw=q.raw.slice(-20),stats={raw:stat(raw.slice(1).map((v,i)=>v-raw[i])),body:stat(q.frame.slice(-20).map(r=>r[1]-r[0]))};
 const raster=await p.evaluate(async()=>{
  const qa=window.__editorTest,read=skip=>Promise.race([qa.gateShot(skip),new Promise((_,rej)=>setTimeout(()=>rej(Error('capture stalled')),8000))]);
  const on=await read(false),off=await read(true);await read(false);
  let changed=0,minX=on.w,minY=on.h,maxX=-1,maxY=-1;
  for(let y=0;y<on.h;y++)for(let x=on.w*.25|0;x<on.w*.75;x++){
   const i=(y*on.w+x)*4;
   if(on.v[i+3]>220&&Math.abs(on.v[i]-off.v[i])+Math.abs(on.v[i+1]-off.v[i+1])+Math.abs(on.v[i+2]-off.v[i+2])>24){
    changed++;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y)
   }
  }
  return {changed,rect:[minX,minY,maxX,maxY],size:[on.w,on.h]};
 });
 delete q.frame;delete q.raw;console.log(JSON.stringify({mode,backend,tier,q,stats,raster}));
 if(enabled&&!fallback){
  a(q.wall.impl==='instanced'&&q.wall.calls>0&&q.wall.calls<=(optimized?3:12)&&q.wall.instances>3,JSON.stringify(q.wall));
  if(optimized){a(q.wallBytes<36000&&q.gateBytes<40000,JSON.stringify(q));}
  if(optimized&&backend==='stream'&&tier==='near')a(q.coarseGround>=12,JSON.stringify(q));
  a(raster.changed>(tier==='far'?50:200),JSON.stringify({mode,tier,raster}));
 }else{
  a(q.wall.impl==='stock'&&q.wallBytes===0&&raster.changed<40,JSON.stringify({mode,tier,q,raster}));
 }
 a.deepEqual(errors,[]);
 const d=process.env.FACILITY_SCREENSHOTS;if(d){mkdirSync(d,{recursive:true});await p.screenshot({path:d+'/'+mode+'-'+tier+'.png'})}
}finally{await b?.close();await new Promise(r=>s.close(r))}
