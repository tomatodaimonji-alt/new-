import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync} from 'node:fs';
import {Script} from 'node:vm';
let html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const put=(a,b)=>{assert.equal(html.split(a).length,2,a);html=html.replace(a,b)};
const ap="if(facilityParams.get('test')==='1')window.__editorTest={";
put(ap,ap+`
 orvasTracesQA:{
  hold:()=>{window.__orvasManual=true},
  frame:()=>render(),
  verifyStripes:()=>{
   const q=poiDavidActive?.s?.david?.attack,g=poiDavidCue?.beam;
   if(!q||!g)return null;const d=q.sweep&&q.sweep.start!==null?poiDavidBeamRay(q,q.sweep.angle):{x:q.dx,z:q.dz};
   return (function(s,g,origin,dir,mid,span){
 if(!g?.buf)return null;
 const prev=gl.getParameter(gl.FRAMEBUFFER_BINDING),view=gl.getParameter(gl.VIEWPORT),depth=gl.isEnabled(gl.DEPTH_TEST);
 const f=gl.createFramebuffer(),tex=gl.createTexture(),n=64;
 gl.bindTexture(gl.TEXTURE_2D,tex);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,n,n,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
 gl.bindFramebuffer(gl.FRAMEBUFFER,f);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);
 try{
  gl.viewport(0,0,n,n);gl.disable(gl.DEPTH_TEST);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
  const dx=dir.x,dz=dir.z,x=origin.x,z=origin.z,sideSpan=.42;
  const vp=new Float32Array([dx/span,dz/sideSpan,0,0,0,0,0,0,dz/span,-dx/sideSpan,0,0,
   -(dx*x+dz*z+mid)/span,-(dz*x-dx*z)/sideSpan,0,1]);
  draw(g,vp,0,g.coreCount??g.count);
  const data=new Uint8Array(n*n*4);gl.readPixels(0,0,n,n,gl.RGBA,gl.UNSIGNED_BYTE,data);
  let left=0,right=0,center=0,maxL=0,maxR=0;
  for(let j=0;j<n;j++)for(let i=10;i<54;i++){
   const k=(j*n+i)*4;if(!data[k+3]||data[k]<30)continue;
   const y=(j/n*2-1)*sideSpan;
   if(y<-.055){left++;maxL=Math.max(maxL,data[k]);}
   if(y>.055){right++;maxR=Math.max(maxR,data[k]);}
   if(Math.abs(y)<.039)center++;
  }
  return {left,right,center,maxL,maxR,error:gl.getError()};
 }finally{
  gl.bindFramebuffer(gl.FRAMEBUFFER,prev);gl.viewport(...view);
  if(depth)gl.enable(gl.DEPTH_TEST);
  gl.deleteTexture(tex);gl.deleteFramebuffer(f);
 }
})(null,g,{x:q.sx+.5,z:q.sz+.5},d,1.05,.53);
  },
  seed:()=>{
   const b=facilitySite?.davidTemple?.boss;if(!b)return false;
   return workshopResumeRestorePosition({x:b.x,z:b.z-2,y:b.y,facing:2});
  },
  dodge:()=>{
   const b=facilitySite.davidTemple.boss;
   return workshopResumeRestorePosition({x:b.x+2,z:b.z-2,y:b.y,facing:2});
  },
  select:(cycle,roll)=>{
   const d=poiDavidActive?.s?.david;
   if(!d||d.attack)return false;d.cycle=cycle;window.__orvasBeamRoll=roll;return true
  },
  get:()=>{
   const b=facilitySite?.davidTemple?.boss,d=poiDavidActive?.s?.david,q=d?.attack;
   return {start:poiOrvasGroundTraces.map(e=>({kind:e.kind,start:e.start,x:e.x,z:e.z,cells:[...e.cells],ribbon:e.sweepMesh?.p.length/3||0,genuineSweepAngle:e.sweepAngle,points:e.parts.reduce((n,m)=>n+m.p.length/3,0)})),
    drawn:window.__orvasDraws??[],uploads:window.__orvasUploads??[],gl:gl.getError(),
    now:performance.now(),nextMob:poiNextMobTick,hp:poiPlayerHP,boss:b?
    {x:b.x,z:b.z,y:b.y}:null,player:[poiWalkX,poiWalkZ,poiWalkLevel],awake:d?.awake,ready:d?.wakeDone,
    q:q&&{kind:q.kind,cursor:q.cursor,executed:q.executed,last:q.lastContactAt,
     angle:q.sweep?.angle,done:q.sweep?.done,sx:q.sx,sz:q.sz,dx:q.dx,dz:q.dz,reach:q.kind==='beam'&&poiDavidBeamReach(q,b,{x:q.dx,z:q.dz})},
    stomp:poiDavidFissure&&{radius:poiDavidFissure.radius,when:poiDavidFissure.start,leap:poiDavidFissure.leap},
    live:!!poiOrvasGroundGpu};
  }
 },`);
put(' requestAnimationFrame(render);',' if(!window.__orvasManual)requestAnimationFrame(render);');
put('function poiDavidMobFrame(o,s,now){','function poiDavidMobFrame(o,s,now){if(!window.__orvasManual)return false;');
put('function poiWildRegionalFrame(now,rng){','function poiWildRegionalFrame(now,rng){return;');
put('function poiWildPick(rng){','function poiWildPick(rng){return null;');
put('function poiDavidBeamSide(roll=Math.random()){','function poiDavidBeamSide(roll=window.__orvasBeamRoll??Math.random()){');
put('  draw(poiOrvasGroundGpu,vp,start,count);',`
  draw(poiOrvasGroundGpu,vp,start,count);
  const log=window.__orvasDraws??=[];if(log.length<90)log.push({kind:e.kind,start:e.start,now,count,alpha});
`);
put('  poiOrvasGroundGpu=upload(m,poiOrvasGroundGpu?.buf??null,gl.DYNAMIC_DRAW);poiOrvasGroundDirty=false;',`
  const old=poiOrvasGroundGpu?.buf;
  poiOrvasGroundGpu=upload(m,old??null,gl.DYNAMIC_DRAW);poiOrvasGroundDirty=false;
  (window.__orvasUploads??=[]).push({at:now,count:poiOrvasGroundGpu.count,reuse:old===poiOrvasGroundGpu.buf});
`);
for(const [,source] of html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(source);
if(process.env.PARSE_ONLY){console.log('Exact native trace fixture parses');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>Trace seed</title>':html)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
let b,errorContext;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const out=process.env.FACILITY_SCREENSHOTS;if(out)mkdirSync(out,{recursive:true});
 for(const [label,cycle,roll] of [['double',1,1],['beam',3,1],['alternate',3,.42],['stomp',2,1]]){
  console.log('Begin',label);
  const context=await b.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:.70});
  const p=await context.newPage(),errors=[];p.on('pageerror',x=>errors.push(x.message));
  await p.clock.install({time:new Date('2026-11-24T12:00:00Z')});
  await p.goto(url+'/seed');
  await p.evaluate(()=>{
   localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
    position:{x:41,z:42,y:0,facing:0},townLayout:5,townMapHeight:128,
    view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,
     orbitYaw:Math.PI,orbitPitch:.62,orbitDistance:5.5}}));
  });
  await p.goto(url+'/?resume=1&test=1',{waitUntil:'domcontentloaded',timeout:45000});
  await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:35000});
  await p.waitForFunction(()=>window.__editorTest?.facility()?.active);
  await p.evaluate(()=>window.__editorTest.orvasTracesQA.hold());
  const read=()=>p.evaluate(()=>window.__editorTest.orvasTracesQA.get());
  const turn=async(ms=62)=>{await p.clock.fastForward(ms);await p.evaluate(()=>window.__editorTest.orvasTracesQA.frame());return read()};
  const until=async(pred,frames,why)=>{
   let s=await read();for(let i=0;i<frames&&!pred(s);i++)s=await turn();
   errorContext={label,why,s,errors};assert(pred(s),JSON.stringify(errorContext));return s;
  };
  assert(await p.evaluate(()=>window.__editorTest.orvasTracesQA.seed()));
  const initial=await read();assert.deepEqual(initial.player,[initial.boss.x,initial.boss.z-2,initial.boss.y]);
  await p.bringToFront();await p.clock.pauseAt((await p.evaluate(()=>Date.now()))+12000);
  const aligned=await read();if(aligned.nextMob>aligned.now)await p.clock.fastForward(Math.ceil(aligned.nextMob-aligned.now)+20);
  await until(s=>s.awake,55,'natural exact wake range');
  assert(await p.evaluate(([c,r])=>window.__editorTest.orvasTracesQA.select(c,r),[cycle,roll]));
  const kind=label==='alternate'?'beam':label;
  const pre=await until(s=>s.q?.kind===kind&&s.q.cursor===0,115,'normal real cast');
  assert.equal(pre.start.length,0,'no decal on warning');
  assert.equal(pre.drawn.length,0);assert.equal(pre.hp,100);
  if(label!=='stomp')assert(await p.evaluate(()=>window.__editorTest.orvasTracesQA.dodge()));
  const first=await until(s=>s.q?.cursor===1&&(label==='stomp'?s.stomp: s.start.length>0&&s.drawn.length>0),45,'first executed contact and real GPU');
  assert.equal(first.gl,0);
  if(label==='double'){
   const second=await until(s=>s.start.length===2&&s.drawn.some(d=>d.start===s.start[1].start),25,'second overhead contact');
   assert(second.start.every(x=>x.kind==='double'&&x.points>=18));
   assert(second.start[1].start-second.start[0].start>=280);
   assert(Math.hypot(second.start[1].x-second.start[0].x,second.start[1].z-second.start[0].z)>1.3);
   assert.equal(second.hp,100,'actual blade contact traces do not require hitting player');
   assert(second.uploads.slice(1).some(u=>u.reuse));
  }else if(label==='alternate'){
   const later=await until(s=>s.q?.done&&s.start[0]?.ribbon>100,45,'rotating beam submits contiguous optical strip');
   assert.equal(later.start.length,1);assert.deepEqual(later.start[0].cells,first.start[0].cells);
   assert(Math.abs(later.start[0].genuineSweepAngle-later.q.angle)<1e-5);
   assert(later.start[0].ribbon<=5250&&later.drawn.some(d=>d.count>later.start[0].ribbon));
   assert(later.uploads.every((u,i)=>i===0||u.reuse));
   console.log('Actual swept strip submission',JSON.stringify({tipAngle:later.q.angle,ribbon:later.start[0].ribbon,gl:later.gl}));
  }else if(label==='beam'){
   const stripes=await p.evaluate(()=>window.__editorTest.orvasTracesQA.verifyStripes());
   assert(stripes&&stripes.left>35&&stripes.right>35&&stripes.center===0&&stripes.error===0,JSON.stringify(stripes));
   console.log('Actual statue split GPU stripe',JSON.stringify(stripes));
   assert.equal(first.start[0].kind,'beam');assert(first.start[0].cells.length>=1&&first.start[0].cells.length<=2);
   for(const key of first.start[0].cells){
    const [kind,xyz]=key.split(':'),[x,z]=xyz.split(',').map(Number).map(a=>a/4);
    const dx=x-first.q.sx-(kind==='wall'?.5:0),dz=z-first.q.sz-(kind==='wall'?.5:0);
    assert(dx*first.q.dx+dz*first.q.dz>=first.q.reach-1.25&&Math.hypot(dx,dz)<=first.q.reach+.5,
     JSON.stringify({key,q:first.q}));
   }
   if(out)await p.screenshot({path:out+'/orvas-trace-beam-active.png'});
   const after=await until(s=>!s.live&&s.now>first.now+1700,40,'GPU retires automatically');
   assert.equal(after.start.length,0);
  }else{
   assert.equal(first.stomp.radius,6);assert.equal(first.stomp.leap,false);
   assert.equal(first.start.length,0,'usual quake still uses existing fissure');
  }
  if(out)await p.screenshot({path:out+'/orvas-trace-'+label+'.png'});
  assert.deepEqual(errors,[]);await context.close();
 }
 console.log('PASS actual straight and swept beam/dual contact tracers, bounded upload, expiry and original planted stomp');
}catch(e){console.error(JSON.stringify(errorContext));throw e}
finally{await b?.close();await new Promise(r=>server.close(r))}
