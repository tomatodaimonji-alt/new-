import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {Script} from 'node:vm';
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const ring=Number(html.match(/const ring=\{x:24,z:(\d+),radius:18\}/)?.[1]);
assert(Number.isFinite(ring)&&ring>=104);
let fixture=html;
function inject(a,b){assert.equal(fixture.split(a).length,2,a);fixture=fixture.replace(a,b);}
const qa="if(facilityParams.get('test')==='1')window.__editorTest={";
inject(qa,qa+`
 higherViewQA:{
  pause:()=>{window.__higherManual=true},
  frame:(skip=false)=>{window.__higherSkipRoof=skip;render();return window.__higherFrame;},
  state:()=>{
   const v=window.__higherView,wrap=$('viewWrap'),a=poiAimOrigin(performance.now());
   return {...v,pitch:poiCameraPitch,yaw:poiCameraYaw,pos:[poiWalkX,poiWalkZ,poiWalkLevel],facing:poiWalkFacing,aim:[a.x,a.z,a.y],
    backdrop:wrap.hasAttribute('data-poi-sky'),top:getComputedStyle(wrap).getPropertyValue('--poi-sky-top').trim(),
    minute:poiTownClockSnapshot().minute,gl:gl.getError(),
    indoor:poiWalkIndoor(),saved:JSON.parse(localStorage.getItem('world-workshop-resume-v1')||'null')?.view?.orbitPitch};
  },
 },
`);
inject(' requestAnimationFrame(render);',' if(!window.__higherManual)requestAnimationFrame(render);');
inject('function poiTownClockFrame(now){','function poiTownClockFrame(now){if(window.__higherManual)return;');
const lens='  const viewTarget=poiOrbitHigherLens(eye,lensTarget,poiCameraPitch,higher);';
inject(lens,lens+`
  if(window.__higherManual)window.__higherView={eye:eye.slice(),desired:desired.slice(),target:target.slice(),
   focus:viewTarget.slice(),arm,higher,p:Math.atan2(eye[1]-viewTarget[1],Math.hypot(eye[0]-viewTarget[0],eye[2]-viewTarget[2]))};
`);
inject('  else draw(facilityRoofMeshes[i],vp);',`
  else if(facilitySite.buildings[i]?.id==='davidTemple'&&window.__higherManual){
   if(!window.__higherSkipRoof){
    window.__higherRoof=(window.__higherRoof||0)+facilityRoofMeshes[i].count;
    draw(facilityRoofMeshes[i],vp);
   }
  }else draw(facilityRoofMeshes[i],vp);`);
inject(' poiScreenNoteCaptureFrame();',`
 if(window.__higherManual){
  const pix=[];
  for(const fy of [.12,.20,.30,.42,.54,.66])for(const fx of [.16,.29,.40,.5,.60,.71,.84]){
   const rgba=new Uint8Array(4);
   gl.readPixels(Math.floor(canvas.width*fx),Math.floor(canvas.height*(1-fy)),1,1,gl.RGBA,gl.UNSIGNED_BYTE,rgba);
   pix.push([...rgba]);
  }
  window.__higherFrame={pix,roof:window.__higherRoof||0};window.__higherRoof=0;
 }
 poiScreenNoteCaptureFrame();`);
for(const [,src] of fixture.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(src);
if(process.env.HIGHER_PARSE_ONLY){console.log('higher-view native exact source anchors and inline syntax');process.exit(0);}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const s=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>Seed</title>':fixture)});
await new Promise(r=>s.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+s.address().port,shots=process.env.FACILITY_SCREENSHOTS;
let browser;
try{
 if(shots)await mkdir(shots,{recursive:true});
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 for(const spec of [{x:66,z:4,name:'night-sky'},{x:18,z:ring+5,name:'opaque-orvas-ceiling'}]){
  const ctx=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:.72});
  const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(20000);
  try{
   await p.clock.install({time:new Date('2026-04-01T02:00:00Z')});
   await p.goto(url+'/seed');await p.evaluate(({x,z,ring})=>{
    localStorage.setItem('world-workshop-town-clock-v1',JSON.stringify({version:1,gameMs:60000}));
    localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
     position:{x,z,y:0,facing:2},townLayout:5,townMapHeight:ring+24,...(ring>104?{templeDepth:1}:{}),
     view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:0,orbitPitch:.35,orbitDistance:5.5}}));
   },{...spec,ring});
   await p.goto(url+'/?resume=1&test=1',{waitUntil:'domcontentloaded'});await p.locator('#pineStartupCover').waitFor({state:'hidden'});
   await p.waitForFunction(()=>window.__editorTest?.facility?.().active);
   assert.equal(await p.evaluate(()=>window.__editorTest.setTownTime(120)),true);
   await p.evaluate(()=>window.__editorTest.higherViewQA.pause());
   // Deep stock boot may occupy the software renderer for several wall
   // seconds after a round trip. Pause relative to the live page time,
   // after disabling automatic frames, with ample host headroom.
   for(const cushion of [12_000,32_000]){
    try{await p.clock.pauseAt((await p.evaluate(()=>Date.now()))+cushion);break;}
    catch(e){if(cushion===32_000||!String(e?.message).includes('Cannot fast-forward to the past'))throw e;}
   }
   const step=async(skip=false)=>{
    await p.clock.fastForward(53);
    return p.evaluate(skip=>({frame:window.__editorTest.higherViewQA.frame(skip),v:window.__editorTest.higherViewQA.state()}),skip);
   };
   const before=await step();
   assert.deepEqual(before.v.pos,[spec.x,spec.z,0]);assert(Math.abs(before.v.pitch-.35)<.002);
   const cdp=await ctx.newCDPSession(p);
   const start=await p.evaluate(()=>{
    for(const x of [659,681,699,634])for(const y of [246,233,219])
     if(document.elementFromPoint(x,y)?.id==='view')return [x,y];
    return null;
   });assert(start,'real right-thumb view surface');
   const touch=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});
   const [x,y]=start,point=(y,id)=>({x,y,id,radiusX:4,radiusY:4,force:.7});
   const drag=async(id,offsets)=>{
    await touch('touchStart',[point(y,id)]);
    for(const off of offsets)await touch('touchMove',[point(y-off,id)]);
    await touch('touchEnd',[]);
   };
   await drag(5,[22,45,70,102,124]);
   const mid=await step();
   assert(mid.v.pitch<-.30&&mid.v.p<-.26&&mid.v.higher);
   await drag(6,[22,47,77,112,127]);
   const full=await step();
   assert.equal(full.v.pitch,-1.02);assert(full.v.p<-.91,'real optical line is steeper than 52°: '+JSON.stringify(full.v));
   // The second drag rotates the optics only; collision still owns the same eye.
   assert(full.v.eye.every((v,i)=>Math.abs(v-mid.v.eye[i])<.00002),'no physical eye teleport on extra upward pan');
   for(const k of ['pos','facing','aim','yaw'])assert.deepEqual(full.v[k],before.v[k],k+' is unchanged by look-up');
   assert(full.v.gl===0&&full.v.higher);
   if(spec.name==='night-sky'){
    assert(full.v.backdrop&&full.v.minute===120&&full.v.top==='rgb(16 29 62)');
    assert(full.frame.pix.some(a=>a[3]===0),'visible open sky from true raised outdoor camera');
   }else{
    assert(full.v.indoor&&!full.v.backdrop,'Orvas has solid ceiling, not sky CSS');
    assert(full.frame.roof>1500);
    const noRoof=await step(true);
    assert.deepEqual(full.v.eye,noRoof.v.eye);assert.deepEqual(full.v.focus,noRoof.v.focus);
    const ceiling=full.frame.pix.filter((a,i)=>a[3]===255&&noRoof.frame.pix[i][3]<4).length;
    assert(ceiling>=13,'real opaque inner roof fills substantial raised viewport: '+ceiling);
    if(shots){await step();const pic=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true});await writeFile(shots+'/orvas-physical-ceiling.png',Buffer.from(pic.data,'base64'));}
    console.log('actual roof samples',ceiling,'/',full.frame.pix.length);
   }
   await cdp.detach();assert.deepEqual(errors,[]);
   console.log('PASS real right-thumb upward gesture',spec.name,JSON.stringify({ring,pitch:full.v.p,position:full.v.pos,eye:full.v.eye,focus:full.v.focus,night:full.v.top}));
  }finally{await ctx.close();}
 }
}finally{await browser?.close();await new Promise(r=>s.close(r));}
