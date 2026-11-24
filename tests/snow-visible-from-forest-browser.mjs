import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const source=readFileSync(process.argv[2]??'world-editor.html','utf8');
const anchor=' facilityDrawSnowHorizon(p);';
assert.equal(source.split(anchor).length,2,'exact production sky/ridge draw hook; cannot pass on unrelated clouds or CSS');
const html=source.replace(anchor,` {
  const probe=window.__captureSnowPixels,ready=probe&&!probe.result&&window.pineStartup.ready&&facilitySite?.id==='base';
  let old,n,w,h;
  if(ready){
   w=gl.drawingBufferWidth;h=gl.drawingBufferHeight;n=w*h*4;
   old=new Uint8Array(n);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,old);
  }
  facilityDrawSnowHorizon(p);
  if(old){
   const fresh=new Uint8Array(n);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,fresh);
   let visible=0,snow=0,x0=w,y0=h,x1=-1,y1=-1;const bins=new Set();
   for(let i=0;i<n;i+=4){
    if(Math.abs(fresh[i]-old[i])+Math.abs(fresh[i+1]-old[i+1])+Math.abs(fresh[i+2]-old[i+2])+Math.abs(fresh[i+3]-old[i+3])<20)continue;
    visible++;const x=(i/4)%w,y=Math.floor(i/(4*w));
    x0=Math.min(x,x0);x1=Math.max(x,x1);y0=Math.min(y,y0);y1=Math.max(y,y1);
    const [r,g,b,a]=fresh.slice(i,i+4);
    if(a>70&&(r+g+b)/3>120&&b>=r+9&&b>=g){snow++;bins.add(Math.floor(x/8));}
   }
   probe.result={visible,snow,bins:bins.size,width:w,height:h,bounds:[x0,y0,x1,y1],
    status:facilitySnowHorizonStatus(),location:[poiWalkX,poiWalkZ,poiWalkLevel],heading:poiCameraYaw,
    pitch:poiCameraPitch,webgl:!gl.isContextLost(),error:gl.getError()};
  }
 }`);
if(process.env.SNOW_PIXEL_SYNTAX_ONLY==='1'){
 for(const [,,body] of [...html.matchAll(/<script(?:\s+([^>]*))?>([\s\S]*?)<\/script>/gi)].filter(([,a])=>!a||!/\b(?:src|type)\s*=/.test(a)))new Script(body);
 console.log('PASS exact distant snow framebuffer fixture anchors and script parse');process.exit(0);
}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>seed</title>':html)});
await new Promise((r,j)=>server.listen(0,'127.0.0.1',r).once('error',j));
const origin='http://127.0.0.1:'+server.address().port;
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
 args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 for(const [label,z,heading,expect] of [['forest looking to pass',112,.13,true],['same forest facing away',112,Math.PI+.13,false],
  ['seam must show actual neighbor, not the distant silhouette',137,0,false]]){
  const ctx=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:.65,isMobile:true,hasTouch:true,serviceWorkers:'block'});
  const p=await ctx.newPage(),errors=[],requests=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>requests.push(r.url()));
  try{
   await ctx.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
   await p.goto(origin+'/seed');
   await p.evaluate(({z,heading})=>{
    localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":360000}');
    localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
     position:{x:z===112?54:60,z,y:0,facing:2},townLayout:5,townMapHeight:182,templeDepth:1,
     view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:heading,orbitPitch:.12,orbitDistance:5.5}}));
   },{z,heading});
   await p.goto(origin+'/?resume=1&test=1');
   await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:18000});
   await p.evaluate(()=>{window.__captureSnowPixels={result:null}});
   const result=await (await p.waitForFunction(()=>window.__captureSnowPixels.result,null,{polling:30,timeout:7000})).jsonValue();
   assert.deepEqual(result.location,[z===112?54:60,z,0]);
   assert(Math.abs(result.heading-heading)<.02&&Math.abs(result.pitch-.12)<.02,'resume holds the actual fixture camera');
   assert(result.webgl&&result.error===0);
   if(expect){
    assert(result.status.visible&&result.status.vertices>60,'actual procedural ridge was rendered');
    assert(result.visible>result.width*result.height*.003&&result.snow>=80&&result.bins>=5,
     'snow cap shades a substantial spread of native pixels, not one vertex or CSS cloud: '+JSON.stringify(result));
   }else{
    assert.equal(result.visible,0,'distant stand-in should be absent: '+label);
    assert.equal(result.status.visible,false);
   }
   assert.deepEqual(errors,[]);assert(requests.every(url=>url.startsWith(origin)));
   console.log('Visible native snow framebuffer',label,JSON.stringify(result));
  }finally{await ctx.close()}
 }
}finally{await browser?.close();await new Promise(r=>server.close(r))}
