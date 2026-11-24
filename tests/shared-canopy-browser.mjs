import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {mkdirSync,readFileSync} from 'node:fs';
import {Script} from 'node:vm';
let html=readFileSync(process.argv[2]??'world-editor.html','utf8');
function put(a,b){assert.equal(html.split(a).length,2,a);html=html.replace(a,b)}
const api="if(facilityParams.get('test')==='1')window.__editorTest={";
put(api,api+`
 canopyQA:{
  set:(x,z,yaw)=>{const ok=workshopResumeRestorePosition({x,z,y:0,facing:2});poiCameraYaw=yaw;poiCameraPitch=.13;poiCameraDistance=6;return ok},
  paint:()=>render(),
  scene:(suppress=false)=>{
   window.__canopyEvents=[];window.__canopyScope=null;window.__canopySkip=suppress;
   render();
   const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,rgba=new Uint8Array(w*h*4);
   gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,rgba);
   const actors=[poiWalkX,poiWalkZ,poiWalkLevel],bounds=poiSharedCanopyBand();
   return {events:window.__canopyEvents,site:facilitySite.id,actors,bounds,stream:poiOverlandDrawing,
    awake:!!poiDavidActive?.s?.david?.awake,bytes:[...poiOverlandMeshes.values()].reduce((a,m)=>a+m.bytes,0)+poiOutdoorFarBytes,
    rgba:[...rgba],err:gl.getError()};
  }
 },`);
put('function poiSharedCanopyDraw(x,z,draw){',`function poiSharedCanopyDraw(x,z,draw){
 if(window.__canopySkip){draw();return}
 window.__canopyEvents?.push({x,z,scope:window.__canopyScope});
`);
put('  poiSharedCanopyDraw(x,z,()=>draw(m,vp,canopy,m.count-canopy));',
 "  window.__canopyScope=canopy===0?'stock':'stream';poiSharedCanopyDraw(x,z,()=>draw(m,vp,canopy,m.count-canopy));window.__canopyScope=null;");
put('    if(split>e.ground)poiSharedCanopyDraw(x+.5,z+.5,()=>draw(e.gpu,cam(q),e.ground,split-e.ground));',
 "    if(split>e.ground){window.__canopyScope='far-'+q.a.id;poiSharedCanopyDraw(x+.5,z+.5,()=>draw(e.gpu,cam(q),e.ground,split-e.ground));window.__canopyScope=null}");
put(' requestAnimationFrame(render);',' if(!window.__canopyManual)requestAnimationFrame(render);');
for(const [,js] of html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(js);
if(process.env.SHARED_CANOPY_PARSE_ONLY)process.exit(0);
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const srv=createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.end(req.url==='/seed'?'<title>Seed</title>':html)});
await new Promise((ok,no)=>srv.listen(0,'127.0.0.1',ok).once('error',no));
const base='http://127.0.0.1:'+srv.address().port;
let b;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const results=[];
 for(const [site,x,z,yaws] of [['base',38,117,[-.75,.1,1.25,-2.05]],['snowpass',12,10,[-2.41,.15,1.3]]]){
  const p=await b.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:.6}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.goto(base+'/seed');
  await p.evaluate(({site,x,z})=>{
   localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":345000}');
   localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
    ...(site==='snowpass'?{region:site,regionHp:71}:{}),position:{x,z,y:0,facing:2},townLayout:5,townMapHeight:182,templeDepth:1,
    view:{yaw:0,zoom:1,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:0,orbitPitch:.13,orbitDistance:6}}));
  },{site,x,z});
  await p.goto(base+'/?resume=1&test=1&outdoor-lod=1&canopy-weight=1');
  await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:35000});
  await p.waitForFunction(()=>window.__editorTest?.canopyQA&&window.__editorTest.facility()?.active,null,{timeout:10000,polling:50});
  await p.evaluate(()=>{window.__canopyManual=true;for(let i=0;i<45;i++)window.__editorTest.canopyQA.paint()});
  const scores=[];
  for(const yaw of yaws){
   const r=await p.evaluate(({x,z,yaw})=>{
    const q=window.__editorTest.canopyQA; if(!q.set(x,z,yaw))throw Error('Invalid real checkpoint '+x+','+z);
    const base=q.scene(true),on=q.scene(false);
    let changed=0,opaqueLost=0;
    for(let i=0;i<on.rgba.length;i+=4){
     if(base.rgba[i+3]>=230&&on.rgba[i+3]<230)opaqueLost++;
     if(Math.abs(on.rgba[i]-base.rgba[i])+Math.abs(on.rgba[i+1]-base.rgba[i+1])+Math.abs(on.rgba[i+2]-base.rgba[i+2])>=6)changed++;
    }
    delete on.rgba;return {...on,changed,opaqueLost};
   },{x,z,yaw});
   assert.equal(r.site,site);assert.deepEqual(r.actors,[x,z,0]);assert.deepEqual(r.bounds,[24,42]);assert.equal(r.err,0);
   assert(r.bytes<=4*2**20&&!r.awake&&r.opaqueLost===0,JSON.stringify(r));
   const scoped=r.events.filter(e=>e.scope===(site==='base'?'stock':'stream'));
   assert(scoped.some(v=>Math.abs(v.x-(x+.5))<.55&&Math.abs(v.z-(z+.5))<.55),JSON.stringify(r));
   scores.push({yaw,changed:r.changed,labels:[...new Set(r.events.map(e=>e.scope))]});
   if(process.env.FACILITY_SCREENSHOTS&&r.changed>=1){
    const f=process.env.FACILITY_SCREENSHOTS;
    mkdirSync(f,{recursive:true});
    await p.evaluate(()=>window.__editorTest.canopyQA.scene(true));
    await p.screenshot({path:f+'/'+site+'-'+yaw+'-control.png'});
    await p.evaluate(()=>window.__editorTest.canopyQA.scene(false));
    await p.screenshot({path:f+'/'+site+'-'+yaw+'-weighted.png'});
   }
  }
  results.push({site,scores});assert.deepEqual(errors,[]);await p.close();
 }
 assert(results.some(r=>r.scores.some(s=>s.changed>10)),JSON.stringify(results));
 console.log('Real canopy draw paths with the same [24,42] physical ground policy, paired raster does not lose terrain',JSON.stringify(results));
}finally{await b?.close();await new Promise(ok=>srv.close(ok));}
