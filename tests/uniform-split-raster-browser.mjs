import a from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {mkdirSync,readFileSync} from 'node:fs';
import {Script} from 'node:vm';
let h=readFileSync(process.argv[2]??'world-editor.html','utf8');
const put=(s,t)=>{a.equal(h.split(s).length,2,s);h=h.replace(s,t)};
put("if(facilityParams.get('test')==='1')window.__editorTest={", `if(facilityParams.get('test')==='1')window.__editorTest={
 splitShot:(skip)=>new Promise(done=>{window.__skipRawGround=skip;window.__splitNext=done}),
 uniformShellQA:()=>({coarse:poiOutdoorProbe.drawn,id:facilitySite.id,position:[poiWalkX,poiWalkZ,poiWalkLevel],enabled:POI_UNIFORM_SHELL,active:!!poiOutdoorFrame,
  near:poiOverlandInspect().bytes,far:poiOutdoorFarBytes,builds:[...window.__physicalShellBuilds??[]],seen:!!poiDavidActive?.s?.david?.awake,
  inner:poiSacredInteriorPlayer(),last:window.__physicalShellDraws,frame:window.__physicalShellFrame??0,err:gl.getError()}),`);
put('function poiUniformShellMesh(m,site,o,h,low=false){', `function poiUniformShellMesh(m,site,o,h,low=false){
 (window.__physicalShellBuilds??=new Set()).add(o.type);`);
put('function poiUniformBuildDraw(x,z,phase,render){', `function poiUniformBuildDraw(x,z,phase,render){
 if(window.__physicalShellDraws&&POI_UNIFORM_OUTDOOR&&poiOutdoorFrame)window.__physicalShellDraws[phase]=(window.__physicalShellDraws[phase]??0)+1;`);
put(' requestAnimationFrame(render);',` requestAnimationFrame(render);
 window.__physicalShellDraws={};window.__physicalShellFrame=(window.__physicalShellFrame??0)+1;`);
put('function poiSplitGroundDraw(gpu,view){draw(gpu,view);return !!gpu.count}',
 'function poiSplitGroundDraw(gpu,view){if(window.__skipRawGround)return false;draw(gpu,view);return !!gpu.count}');
put(' poiScreenNoteCaptureFrame();',` poiScreenNoteCaptureFrame();
 if(window.__splitNext){
  const promise=window.__splitNext;window.__splitNext=null;
  const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,v=new Uint8Array(w*h*4);
  gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,v);promise({w,h,v:[...v]});
 }`);
for(const[,js]of h.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(js);
if(process.env.OUTDOOR_PARSE_ONLY)process.exit(0);
const {chromium}=createRequire(import.meta.url)('playwright');
const s=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>seed</title>':h)});
await new Promise(r=>s.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+s.address().port;
const rows=[['snow-west','snowpass',2,19,-Math.PI/2],['snow-far','snowpass',17,19,-Math.PI/2]];
let b;const enabled=process.env.UNIFORM_SHELL_MODE!=='control';
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 for(const [lane,id,x,z,yaw] of rows){
  const ctx=await b.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:.65});
  const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(url+'/seed');
  await p.evaluate(({id,x,z,yaw})=>{
   localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":390000}');
   localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
    ...(id==='snowpass'?{region:id,regionHp:100}:{}),position:{x,z,y:0,facing:2},townLayout:5,townMapHeight:182,templeDepth:1,
    view:{yaw:0,zoom:1,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:yaw,orbitPitch:.14,orbitDistance:5.6}}));
  },{id,x,z,yaw});
  await p.goto(url+'/?resume=1&test=1&uniform-outdoor=1'+(enabled?'&uniform-shell=1&uniform-split=1':''));
  await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:45000});
  const read=()=>p.evaluate(()=>window.__editorTest.uniformShellQA());
  await p.waitForFunction(()=>window.__editorTest?.uniformShellQA()?.frame>=22,null,{timeout:16000,polling:100});
  if(enabled&&id==='snowpass'){
   try{await p.waitForFunction(()=>{const x=window.__editorTest.uniformShellQA();return x.last?.['far-shell']>0},null,{timeout:16000,polling:100})}
   catch(e){console.error(lane,await read(),errors);throw e}
  }
  const q=await read();a.deepEqual(q.position,[x,z,0]);a.equal(q.id,id);a.equal(q.err,0);a.equal(q.enabled,enabled);
  a(q.near+q.far<=4*1024*1024&&!q.inner&&!q.seen,JSON.stringify(q));a.deepEqual(errors,[]);
  if(!enabled)a.equal(q.builds.length,0);
  if(enabled&&lane==='actual-porch')a(q.last?.['stock-roof']>0,'common class reads actual roof owner on north porch');
  const withGround=q.coarse.filter(r=>r.backing&&r.ground>0),walls=q.last?.['far-shell'];
  a(withGround.length>=19&&walls>0,JSON.stringify(q));
  const meas=await p.evaluate(async()=>{
   const qa=window.__editorTest;
   const read=skip=>Promise.race([qa.splitShot(skip),new Promise((_,rej)=>setTimeout(()=>rej(Error('capture frame timeout')),8000))]);
   const a=await read(false),b=await read(true);await read(false);
   let gained=0,opaqueLow=0,shade=0;
   for(let y=a.h*.27|0;y<a.h*.64;y++)for(let x=a.w*.16|0;x<a.w*.84;x++){
    const i=(y*a.w+x)*4;
    if(a.v[i+3]>235&&b.v[i+3]<180)gained++;
    if(a.v[i+3]>235&&b.v[i+3]>230&&Math.abs(a.v[i]-b.v[i])+Math.abs(a.v[i+1]-b.v[i+1])+Math.abs(a.v[i+2]-b.v[i+2])>30)shade++;
    if(a.v[i+3]>235)opaqueLow++;
   }
   return {gained,shade,opaqueLow};
  });
  a(meas.gained+meas.shade>80&&meas.opaqueLow>2400,JSON.stringify({lane,meas}));
  console.log(JSON.stringify({lane,near:q.near,far:q.far,walls,groundCount:withGround.length,groundSlots:withGround.map(r=>r.key),meas}));
  if(process.env.FACILITY_SCREENSHOTS){const d=process.env.FACILITY_SCREENSHOTS;mkdirSync(d,{recursive:true});await p.screenshot({path:d+'/'+lane+'.png'})}
  await ctx.close();
 }
}finally{await b?.close();await new Promise(r=>s.close(r))}
