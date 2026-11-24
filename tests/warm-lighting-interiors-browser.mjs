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
   pose:(x,z,yaw,pitch,distance)=>{
    const ok=workshopResumeRestorePosition({x,z,y:0,facing:2});
    poiCameraYaw=yaw;poiCameraPitch=pitch;poiCameraDistance=distance;return ok;
   }
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
  window.__warmFrame={data:Array.from(data),w:canvas.width,h:canvas.height,gl:gl.getError(),vp:Array.from(window.__warmPendingVP),location:[poiWalkX,poiWalkZ,poiWalkLevel],guild:!!facilitySite.guildRemodel,tunnel:poiDavidTempleTunnelAt(facilitySite,poiWalkX,poiWalkZ,poiWalkLevel)};window.__warmRead=false;
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
    position:{x:56,z:33,y:0,facing:0},townLayout:5,townMapHeight:128,view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,
     orbitYaw:0,orbitPitch:.72,orbitDistance:7.3}}));
  },{minute});
  await p.goto(url+'/'+name+'?resume=1&test=1',{waitUntil:'domcontentloaded'});
  await p.locator('#pineStartupCover').waitFor({state:'hidden'});
  await p.waitForFunction(()=>window.__editorTest?.facility()?.active);
  assert.equal(await p.evaluate(minute=>{window.__editorTest.warmQA.pause();window.__editorTest.setTownTime(8*1440+minute);return window.__editorTest.warmQA.time()},minute),minute);
  const out=process.env.FACILITY_SCREENSHOTS||'screenshots';mkdirSync(out,{recursive:true});
  const scenes=[
   ['Guild',56,33,Math.PI,.27,4.0],
   ['GuildOpposite',56,33,Math.PI*.5,.34,4.0],
   ['TunnelWest',24,97,-Math.PI*.5,.20,4.0],
   ['TunnelEast',25,97,Math.PI*.5,.20,4.0],
   ['TunnelNorth',23,99,Math.PI,.20,4.0]
  ],captures=[];
  for(const [label,x,z,yaw,pitch,distance] of scenes){
   assert(await p.evaluate(args=>window.__editorTest.warmQA.pose(...args),[x,z,yaw,pitch,distance]),label);
   await p.evaluate(()=>window.__editorTest.warmQA.draw(false));
   const held=await p.evaluate(()=>window.__editorTest.warmQA.draw(true));
   assert.equal(held.frame.gl,0);assert.deepEqual(held.frame.location,[x,z,0]);assert(held.frame.guild);
   if(label.startsWith('Tunnel'))assert(held.frame.tunnel);
   await p.screenshot({path:out+'/warm-indoor-'+label+'-'+name+'.png',scale:'css'});
   const costs=await p.evaluate(()=>Array.from({length:6},()=>{const s=window.__editorTest.warmQA.draw(false);return [s.elapsed,s.draws]}));
   captures.push({label,...held.frame,costs});
  }
  assert.deepEqual(errors,[]);await ctx.close();return captures;
 };
 assert(before,'same-build before file required');
 const candidate=await take('new',280),baseline=await take('base',280),stats=[];
 for(const [i,f] of candidate.entries()) {
  const old=baseline[i],data=f.data,prior=old.data;
  assert.equal(f.label,old.label);assert(f.vp.every((n,j)=>Math.abs(n-old.vp[j])<.00001),'same camera');
  let opaque=0,warm=0,white=0,oldWhite=0,deepCool=0,delta=0;
  for(let k=0;k<data.length;k+=4)if(data[k+3]>=250&&prior[k+3]>=250){
   opaque++;const r=data[k]-prior[k],g=data[k+1]-prior[k+1],b=data[k+2]-prior[k+2];
   if(r>11&&g>4&&r>b+9){warm++;delta+=r;}
   if(Math.min(data[k],data[k+1],data[k+2])>=250)white++;
   if(Math.min(prior[k],prior[k+1],prior[k+2])>=250)oldWhite++;
   if(Math.max(Math.abs(r),Math.abs(g),Math.abs(b))<=3)deepCool++;
  }
  assert(opaque>12000,'not a blank or sky comparison');
  assert(white<=oldWhite+opaque*.0015,'no widespread HDR-white clipping');
  assert(deepCool>=opaque*.2,'retain neighboring unlit material contrast');
  assert.equal(f.costs.at(-1)[1],old.costs.at(-1)[1],'same number of actual draw submissions');
  stats.push({label:f.label,opaque,warm,white,oldWhite,deepCool,meanRedGain:delta/Math.max(1,warm),draws:f.costs.at(-1)[1]});
 }
 console.log(JSON.stringify(stats));
 for(const zone of ['Guild','Tunnel'])assert(stats.some(s=>s.label.startsWith(zone)&&s.warm>100),zone+' lacks visible localized lamp bounce');
 console.log('PASS matched real interior framebuffer: Guild lanterns and sacred tunnel candles, darkness remains and no extra draw calls');
}finally{await b?.close();await new Promise(r=>server.close(r))}
