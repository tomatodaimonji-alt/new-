import a from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {Script} from 'node:vm';
const files=process.argv.slice(2), hash=s=>createHash('sha1').update('blob '+Buffer.byteLength(s)+'\0').update(s).digest('hex');
const pages=files.map(x=>readFileSync(x,'utf8'));
a.deepEqual(pages.map(hash),['8eb39528fc547b877ca72de0f18cc19cbd4cfb23','7079d83a6fc913870d3679834921d9c3349196f9']);
function probe(h){
 const put=(x,y)=>{a.equal(h.split(x).length,2,x);h=h.replace(x,y)};
 put(' poiTownClockFrame(now);poiWalkFrame(now);',' if(!poiTownClockSetTest(720))poiTownClockFrame(now);poiWalkFrame(now);');
 const before=' const bytes=m.p.length*12,held=[...poiOverlandMeshes.values()].reduce((n,m)=>n+m.bytes,0);\n if(!bytes||held+bytes>POI_OVERLAND_GPU_LIMIT)return false;';
 put(before,before.replace(' if(!bytes',` const row=(window.__qaNearEvents??=[]);
 if(row.length<180)row.push({key:q.key,bytes,held,accepted:bytes>0&&held+bytes<=POI_OVERLAND_GPU_LIMIT});
 if(!bytes`));
 put(' poiOverlandBakeFrame(list,areas,boot);',`
 {const t=performance.now();poiOverlandBakeFrame(list,areas,boot);
  if(window.__qaNearSample){
   const q=window.__qaNearSample;
   if(q.ms.length<72){q.ms.push(performance.now()-t);q.stamps.push(t)}
  }
 }`);
 put(" if(typeof poiOutdoorLate==='function')poiOutdoorLate(p.vp,stream);",`
 if(typeof poiOutdoorLate==='function')poiOutdoorLate(p.vp,stream);
 if(stream&&window.__qaNearRaster&&window.__qaNearSample?.ms.length>=72){
  const done=window.__qaNearRaster;window.__qaNearRaster=null;
  const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,pixels=new Uint8Array(w*h*4);
  gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
  done({w,h,pixels:Array.from(pixels)});
 }`);
 const anchor="if(facilityParams.get('test')==='1')window.__editorTest={";
 put(anchor,anchor+`
 nearQA:()=>({
   pos:[poiWalkX,poiWalkZ,poiWalkLevel],stream:poiOverlandDrawing,
   events:window.__qaNearEvents??[],time:window.__qaNearSample,
   drawn:poiOverlandDrawn.map(o=>o.key),resident:[...poiOverlandMeshes].map(([k,m])=>[k,[m.bytes,m.count,m.propsFirst,m.bounds,[...m.groundRows]]]),
   support:[...poiOverlandGroundDrawn].map(([k,rows])=>[k,[...rows]]),
   bytes:poiOverlandInspect().bytes,other:poiOutdoorFarBytes+poiAddGroundBytes,err:gl.getError()}),
 nearStart:()=>{window.__qaNearSample={ms:[],stamps:[]}},
 nearRaster:()=>new Promise(r=>{window.__qaNearRaster=r}),
 `);
 for(const[,js]of h.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(js);
 return h;
}
const html=pages.map(probe);
if(process.env.ATLAS_PARSE_ONLY)process.exit(0);
const {chromium}=createRequire(import.meta.url)('playwright');
const server=createServer((q,r)=>{r.setHeader('Content-Type','text/html; charset=utf-8');r.end(html[Number(q.url.startsWith('/next'))]&&q.url!='/seed'?html[Number(q.url.startsWith('/next'))]:'<title>seed</title>')});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const peak=a=>{const q=[...a].sort((a,b)=>a-b);return {max:q.at(-1),p95:q[Math.floor(.95*(q.length-1))],total:a.reduce((a,b)=>a+b,0)}};
const att=events=>{
 const tally={};for(const e of events)if(!e.accepted&&e.bytes){const k=e.key+'/'+e.bytes;(tally[k]??=[]).push(e.held);}
 return tally;
};
let b;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const out=[];
 for(const route of ['old','next']){
  const ctx=await b.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:.65});
  const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  try{
   await p.goto(origin+'/seed');
   await p.evaluate(()=>{
    localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":390000}');
    localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,position:{x:88,z:120,y:0,facing:2},
     townLayout:5,townMapHeight:182,templeDepth:1,view:{yaw:0,zoom:1,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:2.28,orbitPitch:.14,orbitDistance:5.6}}));
   });
   await p.goto(origin+'/'+route+'?resume=1&test=1');
   await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:36000});
   const read=()=>p.evaluate(()=>__editorTest.nearQA());
   const start=await read();a.deepEqual(start.pos,[88,120,0]);a(start.stream,JSON.stringify(start));
   await p.evaluate(()=>__editorTest.nearStart());
   await p.waitForFunction(()=>__editorTest.nearQA().time.ms.length>=72,null,{timeout:35000,polling:200});
   const raster=await p.evaluate(()=>Promise.race([__editorTest.nearRaster(),new Promise((_,r)=>setTimeout(()=>r(Error('near readback timeout')),8000))]));
   const q=await read();
   a.deepEqual(q.pos,[88,120,0]);a.deepEqual(errors,[]);a(q.stream&&q.err===0&&q.bytes+q.other<=4*1024*1024,JSON.stringify(q));
   out.push({q,raster});
  }finally{await ctx.close()}
 }
 const [{q:old,raster:r},{q:next,raster:s}]=out;
 a.deepEqual([r.w,r.h],[s.w,s.h]);let lost=0,added=0,changed=0,opaque=0;
 for(let i=0;i<r.pixels.length;i+=4){
  const o=r.pixels[i+3]>230,n=s.pixels[i+3]>230;
  if(o){opaque++;if(!n)lost++;else if(r.pixels.slice(i,i+3).some((v,j)=>v!==s.pixels[i+j]))changed++;}
  if(!o&&n)added++;
 }
 const stat=q=>({keys:q.resident.map(e=>e[0]),drawn:q.drawn,bytes:q.bytes,other:q.other,
  rejected:att(q.events),uploads:q.events.filter(e=>e.accepted),
  bakeMs:peak(q.time.ms),frameGapMs:peak(q.time.stamps.slice(1).map((t,i)=>t-q.time.stamps[i]))});
 const result={old:stat(old),next:stat(next),raster:{lost,added,changed,opaque}};
 console.log(JSON.stringify(result));
 if(process.env.NEAR_ART)writeFileSync(process.env.NEAR_ART,JSON.stringify(result,null,2));
 const newer=new Map(next.resident),support=new Map(next.support);
 for(const [k,data]of old.resident)a.deepEqual(newer.get(k),data,k);
 for(const [k,data]of old.support)a.deepEqual(support.get(k),data,k);
 a(opaque>500&&lost===0&&changed===0,'existing raster changed (hold for investigation)');
 const repeated=Object.entries(result.old.rejected).filter(([,attempts])=>attempts.length>=4);
 a(repeated.length>0,'HOLD/no same immutable oversized work repeated naturally at this pose');
 a(repeated.some(([k,attempts])=>(result.next.rejected[k]?.length??0)<=Math.ceil(attempts.length/4)),
  'HOLD/no meaningful waste reduction in the same oversized key');
}finally{await b?.close();await new Promise(r=>server.close(r))}
