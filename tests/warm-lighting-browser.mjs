import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync} from 'node:fs';
import {Script} from 'node:vm';

const after=readFileSync(process.argv[2]??'world-editor.html','utf8');
const before=process.argv[3]?readFileSync(process.argv[3],'utf8'):null;
function inject(s,a,b){assert.equal(s.split(a).length,2,a);return s.replace(a,b)}
function instrument(html){
 const key='  freeMovementPose:()=>({x:poiWalkViewX,z:poiWalkViewZ,level:poiWalkLevel}),';
 let f=inject(html,key,key+`
  warmQA:{
   pause:()=>{window.__warmManual=true},
   time:()=>poiTownClockSnapshot().minute,
   draw:(capture)=>{window.__warmRead=capture;window.__warmDraws=0;const start=performance.now();render();gl.finish();const elapsed=performance.now()-start;return {elapsed,draws:window.__warmDraws,frame:window.__warmFrame,clock:poiTownClockSnapshot().minute}},
   nearby:()=>world.filter(o=>o.y===poiWalkLevel&&o.type==='poiStreetLamp'&&Math.hypot(o.x-poiWalkX,o.z-poiWalkZ)<8).map(o=>[o.x,o.z])
  },`);
 f=inject(f,' requestAnimationFrame(render);',' if(!window.__warmManual)requestAnimationFrame(render);');
 f=inject(f,'function poiTownClockFrame(now){','function poiTownClockFrame(now){if(window.__warmManual)return;');
 f=inject(f,'function poiMobFrame(now){','function poiMobFrame(now){if(window.__warmManual)return;');
 f=inject(f,'gl.drawArrays(gl.TRIANGLES,first,count)}','gl.drawArrays(gl.TRIANGLES,first,count);if(window.__warmManual)window.__warmDraws++}');
 f=inject(f,' const p=parameters();poiSkyBackdrop(p);',' const p=parameters();poiSkyBackdrop(p);if(window.__warmManual)window.__warmPendingVP=p.vp;');
 f=inject(f,' poiScreenNoteCaptureFrame();',`
 if(window.__warmRead){
  const data=new Uint8Array(canvas.width*canvas.height*4);
  gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,data);
  const vp=window.__warmPendingVP,point=(x,y,z)=>[0,1,3].map(j=>x*vp[j]+y*vp[j+4]+z*vp[j+8]+vp[j+12]);
  const byWorld=(x,y,z)=>{
   const [a,b,w]=point(x,y,z);return [(a/w*.5+.5)*canvas.width,(b/w*.5+.5)*canvas.height,w];
  };
  const pockets=world.filter(o=>o.y===poiWalkLevel&&o.type==='poiStreetLamp'&&Math.hypot(o.x-poiWalkX,o.z-poiWalkZ)<8).map(o=>{
   const x=o.x+.5,z=o.z+.5,y=terrainY(o.x,o.z);
   return {x,z,core:byWorld(x,y+1.73,z),floor:byWorld(x+.57,y+.03,z+.50)};
  });
  window.__warmFrame={data:Array.from(data),w:canvas.width,h:canvas.height,gl:gl.getError(),pockets,location:[poiWalkX,poiWalkZ,poiWalkLevel],townOffset:facilitySite?.townOffset};window.__warmRead=false;
 }
 poiScreenNoteCaptureFrame();`);
 for(const [,script] of f.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(script);
 return f;
}
const html=[before&&instrument(before),instrument(after)];if(process.env.PARSE_ONLY){console.log('PASS native exact anchors and inline JS syntax');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url.startsWith('/base')&&html[0]?html[0]:req.url.startsWith('/new')?html[1]:'<title>Fixture seed</title>')});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
let b;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const take=async(name,minute)=>{
  const ctx=await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  const p=await ctx.newPage(),errors=[];
  p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(24000);await p.goto(url+'/seed');
  await p.evaluate(({minute})=>{
   localStorage.setItem('world-workshop-town-clock-v1',JSON.stringify({version:1,gameMs:(8*1440+minute)*500}));
   localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
    position:{x:41,z:42,y:0,facing:0},townLayout:5,townMapHeight:128,view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,
     orbitYaw:0,orbitPitch:.72,orbitDistance:7.3}}));
  },{minute});
  await p.goto(url+'/'+name+'?resume=1&test=1',{waitUntil:'domcontentloaded'});
  await p.locator('#pineStartupCover').waitFor({state:'hidden'});
  await p.waitForFunction(()=>window.__editorTest?.facility()?.active);
  assert.equal(await p.evaluate(minute=>{window.__editorTest.warmQA.pause();window.__editorTest.setTownTime(8*1440+minute);return window.__editorTest.warmQA.time()},minute),minute);
  const held=await p.evaluate(()=>window.__editorTest.warmQA.draw(true));
  assert.equal(held.frame.gl,0);assert(held.frame.pockets.length>=3,JSON.stringify({pockets:held.frame.pockets,location:held.frame.location,townOffset:held.frame.townOffset}));
  const out=process.env.FACILITY_SCREENSHOTS||'screenshots';mkdirSync(out,{recursive:true});
  await p.screenshot({path:out+'/warm-plaza-'+name+'-'+minute+'.png',scale:'css'});
  const costs=await p.evaluate(()=>Array.from({length:8},()=>{const s=window.__editorTest.warmQA.draw(false);return [s.elapsed,s.draws]}));
  assert.deepEqual(errors,[]);await ctx.close();return {...held.frame,costs};
 };
 const dark=await take('new',280);
 const baseline=before?await take('base',280):null;
 const day=await take('new',720);
 function point(f,p,r){
  const hits=[];const [x,y,w]=p;if(w<=0||x<r||x>f.w-r||y<r||y>f.h-r)return hits;
  for(let yy=Math.round(y-r);yy<y+r;yy++)for(let xx=Math.round(x-r);xx<x+r;xx++){
   const a=(yy*f.w+xx)*4;
   if(f.data[a+3]>=250)hits.push(f.data.slice(a,a+3));
  }
  return hits;
 }
 const peak=(f,kind)=>f.pockets.flatMap(p=>point(f,p[kind],kind==='core'?6:8));
 const cores=peak(dark,'core'),paving=peak(dark,'floor');
 const amber=px=>px[0]>120&&px[0]>px[2]+56&&px[1]>px[2]+16;
 assert(cores.filter(amber).length>=5,'luminous warm sources in real framebuffer');
 assert(paving.length>80,'visible nearby ground in real framebuffer');
 if(baseline){
  assert(cores.filter(amber).length>peak(baseline,'core').filter(amber).length+4,'source brightness gains');
  const pairs=[];for(let i=0;i<dark.data.length;i+=4){
   if(dark.data[i+3]>=250&&baseline.data[i+3]>=250)pairs.push([dark.data[i]-baseline.data[i],dark.data[i+1]-baseline.data[i+1],dark.data[i+2]-baseline.data[i+2]]);
  }
  assert(pairs.filter(([r,g,b])=>r>13&&g>5&&r>b+10).length>250,'actual localized warm ground or wall spill');
  assert.equal(dark.costs.at(-1)[1],baseline.costs.at(-1)[1],'no additional render draw submissions');
 }
 assert(day.costs.at(-1)[1]>0);
 console.log('PASS matched plaza 04:40 framebuffer + daylight, local warm spill and bounded draw submissions', {dark:dark.costs,before:baseline?.costs,day:day.costs,cores:cores.filter(amber).length});
}finally{await b?.close();await new Promise(r=>server.close(r))}
