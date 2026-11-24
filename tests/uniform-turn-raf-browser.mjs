import a from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync} from 'node:fs';
import {Script} from 'node:vm';
let h=readFileSync(process.argv[2]??'world-editor.html','utf8');
const put=(s,t)=>{a.equal(h.split(s).length,2,s);h=h.replace(s,t)};
put("if(facilityParams.get('test')==='1')window.__editorTest={",`if(facilityParams.get('test')==='1')window.__editorTest={
 turnQA:()=>({id:facilitySite.id,x:poiWalkX,z:poiWalkZ,y:poiWalkLevel,yaw:poiCameraYaw,angle:poiCameraPitch,visible:document.visibilityState,
  focus:document.hasFocus(),frozen:poiGameFrozen(),world:poiOverlandInspect(),far:poiOutdoorFarBytes,
  coarse:poiOutdoorProbe.drawn.map(x=>x.key),pos:poiOverlandGlobal(facilitySite.id,poiWalkViewX,poiWalkViewZ),
  touched:touchPositions.size,raw:window.__turnRaw?.slice(-400),frame:window.__turnFrame?.slice(-400),
  inner:poiSacredInteriorPlayer(),boss:!!poiDavidActive?.s?.david?.awake,err:gl.getError()}),`);
put(' requestAnimationFrame(render);',` requestAnimationFrame(render);
 window.__turnStart=poiWallNow();`);
put(' poiScreenNoteCaptureFrame();',` poiScreenNoteCaptureFrame();
 (window.__turnFrame??=[]).push([window.__turnStart,poiWallNow(),poiCameraYaw]);
 if(window.__turnFrame.length>400)window.__turnFrame.shift();`);
for(const [,js] of h.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(js);
if(process.env.OUTDOOR_PARSE_ONLY)process.exit(0);
const {chromium}=createRequire(import.meta.url)('playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>seed</title>':h)});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const url='http://127.0.0.1:'+server.address().port;
const enabled=process.env.UNIFORM_RAF_MODE==='prototype',dist=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
const quant=(samples)=>{const s=samples.filter(Number.isFinite).sort((a,b)=>a-b);return {n:s.length,p95:s[Math.floor((s.length-1)*.95)],p99:s[Math.floor((s.length-1)*.99)],max:s.at(-1)}};
const metrics=(s,from,to)=>{const raw=s.raw.filter(a=>a>=from&&a<=to),f=s.frame.filter(a=>a[0]>=from&&a[0]<=to);return {
 raw:quant(raw.slice(1).map((n,i)=>n-raw[i])),frames:quant(f.slice(1).map((n,i)=>n[0]-f[i][0])),body:quant(f.map(n=>n[1]-n[0]))}};
const pack=s=>({id:s.id,x:s.x,z:s.z,y:s.y,pose:s.pos,yaw:s.yaw,near:s.world.bytes,far:s.far,drawn:s.world.last?.map(q=>q.key),coarse:s.coarse});
let b;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 for(const [lane,id,x,z,yaw] of [['snow-west','snowpass',2,19,-Math.PI/2],['porch','base',24,125,0]]){
  const c=await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:.65,isMobile:true,hasTouch:true}),p=await c.newPage(),errors=[];
  p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(20000);
  await p.addInitScript(()=>{function mark(t){(window.__turnRaw??=[]).push(t);if(window.__turnRaw.length>400)window.__turnRaw.shift();requestAnimationFrame(mark)}requestAnimationFrame(mark)});
  await p.goto(url+'/seed');
  await p.evaluate(({id,x,z,yaw})=>{
   localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
    ...(id==='snowpass'?{region:id,regionHp:100}:{}),position:{x,z,y:0,facing:2},townLayout:5,townMapHeight:182,templeDepth:1,
    view:{yaw:0,zoom:1,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:yaw,orbitPitch:.14,orbitDistance:5.6}}));
  },{id,x,z,yaw});
  await p.goto(url+'/?resume=1&test=1'+(enabled?'&uniform-outdoor=1&uniform-shell=1':''));await p.bringToFront();
  await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:45000});
  await p.waitForFunction(()=>window.__editorTest?.turnQA()?.frame?.length>=26,null,{timeout:15000,polling:90});
  const cdp=await c.newCDPSession(p),read=()=>p.evaluate(()=>window.__editorTest.turnQA());
  const before=await read(),marks=[],x0=421,x1=814,dy=184;
  const targets=await p.evaluate(([x0,x1,y])=>[document.elementFromPoint(x0,y)?.tagName,document.elementFromPoint(x1,y)?.tagName],[x0,x1,dy]);
  a.deepEqual(targets,['CANVAS','CANVAS'],JSON.stringify({lane,targets}));
  for(let j=0;j<6;j++){
   const start=await read(),sx=j%2?x1:x0,ex=j%2?x0:x1,first=start.raw.at(-1);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:sx,y:dy,id:7}]});
   try{for(let i=1;i<=8;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:sx+(ex-sx)*i/8,y:dy,id:7}]});await p.waitForTimeout(25)}}
   finally{await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})}
   const turned=await read();a(dist(start.yaw,turned.yaw)>3.05,JSON.stringify({lane,start:start.yaw,end:turned.yaw}));
   await p.waitForFunction(([t,y])=>window.__editorTest.turnQA().frame.filter(f=>f[0]>t&&Math.abs(Math.sin((f[2]-y)/2))<.01).length>=3,
    [start.frame.at(-1)[0],turned.yaw],{timeout:5000,polling:85});
   const q=await read();
   a.deepEqual([q.id,q.x,q.z,q.y],[id,x,z,0]);a.deepEqual(q.pos,before.pos);
   a(q.world.bytes+q.far<=4*1024*1024&&!q.inner&&!q.boss&&!q.frozen&&q.err===0&&q.visible==='visible'&&q.focus,JSON.stringify(pack(q)));
   marks.push({turn:j,yaw:q.yaw,ms:metrics(q,first,q.raw.at(-1)),scene:pack(q)});
  }
  a.deepEqual(errors,[]);
  console.log(JSON.stringify({lane,enabled,before:pack(before),marks}));
  if(process.env.FACILITY_SCREENSHOTS){mkdirSync(process.env.FACILITY_SCREENSHOTS,{recursive:true});await p.screenshot({path:process.env.FACILITY_SCREENSHOTS+'/'+lane+'.png'})}
  await c.close();
 }
}finally{await b?.close();await new Promise(r=>server.close(r))}
