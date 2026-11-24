import a from 'node:assert/strict';import {createServer} from 'node:http';import {createRequire} from 'node:module';
import {readFileSync,mkdirSync} from 'node:fs';import {Script} from 'node:vm';
let h=readFileSync(process.argv[2]??'world-editor.html','utf8');
const extra=readFileSync(new URL('./exterior-wall-transport.browser.js',import.meta.url),'utf8');
const patch=(x,y)=>{a.equal(h.split(x).length,2,x);h=h.replace(x,y)};
const x=' if(isWallId(o.type)||/^poiDavidWall/.test(o.type))pineBakeWallWarmth(m,start,o,pineShadows,pineWarmLamps);';
patch(x,x+'\n  poiTestTransportRemember(m,start,o);');
patch('function render(){',extra+'\nfunction render(){');
patch("if(facilityParams.get('test')==='1')window.__editorTest={",`if(facilityParams.get('test')==='1')window.__editorTest={\n
 transportSetup:()=>{
  window.__transportPause=true;
  return poiTestTransportGroup();
 },
 transportDraw:poiTestTransportDraw,
 `);
patch(' requestAnimationFrame(render);',' if(!window.__transportPause)requestAnimationFrame(render);');
for(const [,js] of h.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(js);
if(process.env.OUTDOOR_PARSE_ONLY)process.exit(0);
const {chromium}=createRequire(import.meta.url)('playwright'),server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>seed</title>':h);
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const url='http://127.0.0.1:'+server.address().port;
let b;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 for(const [lane,x,z,yaw] of [['stock-center',41,43,0],['south-gate-approach',41,55,0]]){
  const ctx=await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:.72,isMobile:true,hasTouch:true}),p=await ctx.newPage(),errors=[];
  p.on('pageerror',e=>errors.push(e.message));await p.goto(url+'/seed');
  await p.evaluate(({x,z,yaw})=>localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x,z,y:0,facing:2},townLayout:5,townMapHeight:182,templeDepth:1,
   view:{yaw:0,zoom:1,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:yaw,orbitPitch:.22,orbitDistance:5.6}})),{x,z,yaw});
  await p.goto(url+'/?resume=1&test=1');await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:45000});
  await p.waitForFunction(()=>!!window.__editorTest?.transportSetup,null,{timeout:15000});
  const shot=async name=>{const d=process.env.FACILITY_SCREENSHOTS;if(d){mkdirSync(d,{recursive:true});await p.screenshot({path:d+'/'+lane+'-'+name+'.png'})}};
  await shot('complete-stock');const group=await p.evaluate(()=>window.__editorTest.transportSetup());
  a(group.n>=3,JSON.stringify({lane,group,errors}));
  const out=[];let ref;
  for(const [mode,force] of [['raw',false],['indexed',false],['instance',false],['instance',true]]){
   const q=await p.evaluate(([m,f])=>window.__editorTest.transportDraw(m,f),[mode,force]);
   a.equal(q.err,0);a.equal(q.draws,1);a(q.visible>150,JSON.stringify({lane,mode,visible:q.visible}));
   if(!ref)ref=q.image;
   const diff=q.image.filter((x,i)=>Math.abs(x-ref[i])>6).length;
   a(diff<Math.max(60,q.visible*.035),JSON.stringify({lane,mode,diff,visible:q.visible}));
   out.push({mode:q.mode,native:q.native,bytes:q.bytes,draws:q.draws,diff,visible:q.visible});
   await shot(q.mode);
  }
  a(out[1].bytes<out[0].bytes&&out[3].bytes===out[1].bytes);
  if(out[2].native)a(out[2].mode==='instance'&&out[2].bytes<out[1].bytes,JSON.stringify(out));
  a.deepEqual(errors,[]);console.log(JSON.stringify({lane,group,out}));await ctx.close();
 }
}finally{await b?.close();await new Promise(ok=>server.close(ok))}
