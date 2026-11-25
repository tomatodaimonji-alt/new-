import a from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {Script} from 'node:vm';
let h=readFileSync(process.argv[2]??'world-editor.html','utf8');
a.equal(createHash('sha1').update('blob '+Buffer.byteLength(h)+'\0').update(h).digest('hex'),'78fed308a8815309d7edd9881c4da207c7abd05f');
const put=(x,y)=>{a.equal(h.split(x).length,2,x);h=h.replace(x,y)};
put('  draw(e.gpu,vp);\n }\n // Deliberately never publish',
 '  draw(e.gpu,vp);(window.__qaAddDrawn??=[]).push(k);\n }\n // Deliberately never publish');
put(" if(stream)poiAddGroundFrame(vp,stream,id,g,areas,held);", `
 if(stream){
  const safe=[...poiOverlandMeshes,...poiOutdoorCaches],support=JSON.stringify([...poiOverlandGroundDrawn]);
  const sample=()=>{const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,p=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,p);return {w,h,p}};
  const shot=window.__qaAddShot,before=shot?sample():null,now=performance.now();
  window.__qaAddDrawn=[];poiAddGroundFrame(vp,stream,id,g,areas,held);
  if(!shot)(window.__qaAddMs??=[]).push(performance.now()-now);
  window.__qaLegacyUnchanged=safe.length===poiOverlandMeshes.size+poiOutdoorCaches.size&&
   safe.every(([k,o])=>poiOverlandMeshes.get(k)===o||poiOutdoorCaches.get(k)===o)&&support===JSON.stringify([...poiOverlandGroundDrawn]);
  if(shot){
   window.__qaAddShot=null;const after=sample();let gained=0,changedOriginal=0,minX=after.w,minY=after.h,maxX=-1,maxY=-1;
   for(let y=0;y<after.h;y++)for(let x=0;x<after.w;x++){
    const i=(y*after.w+x)*4,b=before.p,p=after.p;
    if(b[i+3]<180&&p[i+3]>230){gained++;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y)}
    if(b[i+3]>230&&(b[i]!==p[i]||b[i+1]!==p[i+1]||b[i+2]!==p[i+2]||b[i+3]!==p[i+3]))changedOriginal++;
   }
   shot({gained,changedOriginal,crop:[minX,minY,maxX,maxY],size:[after.w,after.h]});
  }
 }`);
const anchor="if(facilityParams.get('test')==='1')window.__editorTest={";
put(anchor,anchor+`
 addQ:()=>({position:[poiWalkX,poiWalkZ,poiWalkLevel],id:facilitySite.id,inside:poiSacredInteriorPlayer(),stream:poiOverlandDrawing,
  near:poiOverlandInspect().bytes,far:poiOutdoorFarBytes,added:poiAddGroundBytes,drawn:window.__qaAddDrawn??[],
  legacy:poiOutdoorProbe.drawn,originalStillSame:window.__qaLegacyUnchanged,ms:window.__qaAddMs??[],err:gl.getError()}),
 addShot:()=>new Promise(r=>{window.__qaAddShot=r}),
`);
for(const[,js]of h.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(js);
if(process.env.ATLAS_PARSE_ONLY)process.exit(0);
const {chromium}=createRequire(import.meta.url)('playwright');
const server=createServer((q,r)=>{r.setHeader('Content-Type','text/html; charset=utf-8');r.end(q.url==='/seed'?'<title>seed</title>':h)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
let b,total=0;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 for(const [lane,id,x,z,yaw,stream]of [['port','base',84,120,-Math.PI/2,true],['forest','base',54,119,Math.PI,true],['snow','snowpass',2,19,-Math.PI/2,true],['temple-inner','base',24,129,0,false]]){
  const ctx=await b.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:.65});
  const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  const read=()=>p.evaluate(()=>window.__editorTest?.addQ?.());
  try{
   await p.goto(origin+'/seed');
   await p.evaluate(({id,x,z,yaw})=>{
    localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":390000}');
    localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
     ...(id==='snowpass'?{region:id,regionHp:100}:{}),position:{x,z,y:0,facing:2},townLayout:5,townMapHeight:182,templeDepth:1,
     view:{yaw:0,zoom:1,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:yaw,orbitPitch:.14,orbitDistance:5.6}}));
   },{id,x,z,yaw});
   await p.goto(origin+'/?resume=1&test=1');
   await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:36000});
   const first=await read();a.deepEqual(first.position,[x,z,0]);a(first.id===id&&first.stream===stream,JSON.stringify(first));
   let raster=null;
   if(stream){
    await p.waitForFunction(()=>window.__editorTest.addQ().ms.length>=18,null,{timeout:17000,polling:150});
    raster=await p.evaluate(()=>Promise.race([window.__editorTest.addShot(),new Promise((_,r)=>setTimeout(()=>r(Error('additive readback timed out')),8000))]));
    a.equal(raster.changedOriginal,0,JSON.stringify({lane,raster}));
    total+=raster.gained;
   }
   const q=await read(),ms=q.ms.slice(-18).sort((a,b)=>a-b);
   a(q.err===0&&q.added<=192*1024&&q.added+q.far<=768*1024&&q.added+q.far+q.near<=4*1024*1024,JSON.stringify(q));
   if(stream)a(q.originalStillSame&&q.drawn.every(k=>k.startsWith(id+':')));else a(q.inside&&!q.added&&!q.drawn.length);
   console.log('additive exact lane',lane,JSON.stringify({raster,...q,ms:{n:ms.length,p95:ms[Math.floor((ms.length-1)*.95)],max:ms.at(-1)}}));
   a.deepEqual(errors,[]);
   if(process.env.ATLAS_ART){mkdirSync(process.env.ATLAS_ART,{recursive:true});writeFileSync(process.env.ATLAS_ART+'/'+lane+'.json',JSON.stringify({q,raster}));}
  }catch(e){console.error('first stop',lane,errors,await read());throw e}finally{await ctx.close()}
 }
 a(total>=64,'real existing streamed backdrops gained fewer than 64 opaque ground pixels under spare-only budget');
}finally{await b?.close();await new Promise(r=>server.close(r))}
