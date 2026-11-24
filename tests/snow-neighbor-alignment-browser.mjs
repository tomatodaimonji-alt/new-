import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const source=readFileSync(process.argv[2]??'world-editor.html','utf8');
const anchor='  poiStreamPropDraw(o.m,matrices.get(o.id),player[0]+.5,player[1]+.5,now);';
assert.equal(source.split(anchor).length,2,'test must observe the actual nearby-chunk draw, not distant sky');
const html=source.replace(anchor,`  const transform=matrices.get(o.id),q=window.__actualNeighborQA;
  let before,x0,y0,w,h,actual,expected;
  if(q&&!q.done&&q.tests.length<120&&o.id!==facilitySite.id&&
     o.key===(o.id==='snowpass'?'snowpass:1,0':'base:7,17')){
   const snow=o.id==='snowpass',active=facilitySite.id;
   // Check the actual same world point through two independent matrices.
   // These positions are authored route cells on either side of the global
   // seam, not the decorative ridge and not opaque HTML or the minimap.
   const point=snow?[12.5,.04,1.5]:[60.5,.04,137.5],off=snow?[48,139]:[-48,-139];
   const clip=(m,x,y,z)=>{const w=m[3]*x+m[7]*y+m[11]*z+m[15];
    return [(m[0]*x+m[4]*y+m[8]*z+m[12])/w,(m[1]*x+m[5]*y+m[9]*z+m[13])/w,w]};
   actual=clip(transform,...point);expected=clip(vp,point[0]+off[0],point[1],point[2]+off[1]);
   const bw=gl.drawingBufferWidth,bh=gl.drawingBufferHeight,cx=(actual[0]*.5+.5)*bw,cy=(actual[1]*.5+.5)*bh;
   if(actual[2]>0&&cx>=12&&cx<bw-12&&cy>=12&&cy<bh-12){
    x0=Math.round(cx)-12;y0=Math.round(cy)-12;w=24;h=24;
    before=new Uint8Array(w*h*4);gl.readPixels(x0,y0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,before);
   }
  }
  poiStreamPropDraw(o.m,transform,player[0]+.5,player[1]+.5,now);
  if(before){
   const after=new Uint8Array(before.length);gl.readPixels(x0,y0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,after);
   let changed=0;
   for(let i=0;i<after.length;i+=4)
    if(Math.abs(after[i]-before[i])+Math.abs(after[i+1]-before[i+1])+Math.abs(after[i+2]-before[i+2])+Math.abs(after[i+3]-before[i+3])>=18)changed++;
   q.tests.push({id:o.id,key:o.key,actual,expected,changed,count:o.m.count,x:poiWalkX,z:poiWalkZ});
   if(changed>15)q.done=true;
  }`);
if(process.env.SNOW_NEIGHBOR_SYNTAX_ONLY==='1'){
 for(const [,,body] of [...html.matchAll(/<script(?:\s+([^>]*))?>([\s\S]*?)<\/script>/gi)].filter(([,a])=>!a||!/\b(?:src|type)\s*=/.test(a)))new Script(body);
 console.log('PASS exact actual snow-neighbor probe anchors and script parse');process.exit(0);
}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>seed</title>':html)});
await new Promise((r,j)=>server.listen(0,'127.0.0.1',r).once('error',j));
const url='http://127.0.0.1:'+server.address().port;
let b;
try{
 b=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
 args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 for(const snow of [false,true]){
  const ctx=await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:.65,isMobile:true,hasTouch:true});
  const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  try{
   await p.goto(url+'/seed');
   await p.evaluate(snow=>{
    localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
     ...(snow?{region:'snowpass',regionHp:80}:{}),position:snow?{x:12,z:4,y:0,facing:0}:{x:60,z:133,y:0,facing:2},
     townLayout:5,townMapHeight:182,templeDepth:1,view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,
     top:false,third:true,orbitYaw:snow?Math.PI:0,orbitPitch:.25,orbitDistance:5.5}}));
   },snow);
   await p.goto(url+'/?resume=1&test=1');
   await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:18000});
   await p.evaluate(()=>{window.__actualNeighborQA={done:false,tests:[]}});
   try{
    await p.waitForFunction(()=>window.__actualNeighborQA.done,null,{polling:35,timeout:8000});
   }catch(e){throw Error('Actual neighbor terrain pixels did not arrive from '+(snow?'snow':'base')+': '+JSON.stringify(await p.evaluate(()=>(
    {trace:window.__actualNeighborQA.tests.slice(-12),state:window.__editorTest?.overlandStream?.()}))),{cause:e})}
   const q=await p.evaluate(()=>({trace:window.__actualNeighborQA.tests,state:window.__editorTest.overlandStream()}));
   const proof=q.trace.find(x=>x.changed>15);
   assert.equal(proof.id,snow?'base':'snowpass');assert.equal(proof.z,snow?4:133);assert(proof.count>72);
   assert(proof.actual.every((v,i)=>Math.abs(v-proof.expected[i])<.001),'actual draw VP registers neighbor on the exact world-space seam');
   assert.deepEqual(errors,[]);console.log('PASS independently rendered near aligned scenery before crossing',JSON.stringify(proof));
  }finally{await ctx.close()}
 }
}finally{await b?.close();await new Promise(r=>server.close(r))}
