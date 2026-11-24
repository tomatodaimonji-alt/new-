import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {Script} from 'node:vm';
const source=readFileSync(process.argv[2]??'world-editor.html','utf8');
const add=(s,a,b)=>{assert.equal(s.split(a).length,2,a);return s.replace(a,b)};
const hook="if(facilityParams.get('test')==='1')window.__editorTest={";
let h=add(source,hook,hook+`
 thermalQA:{
  frame:()=>render(),arm:()=>poiWandArm(2),
  state:()=>({clock:performance.now(),x:poiWalkX,z:poiWalkZ,stage:poiPlayerWeaponVisual?.impact!==undefined?'impact':poiPlayerWeaponVisual?'flight':'none',
   charge:poiInventorySlots(poiHotbarRead())[2]?.charges??0,point:poiPlayerWeaponVisual?poiPlayerProjectileSample(poiPlayerWeaponVisual,performance.now()):null,
   vertices:poiWeaponFireBodyGpu?.count??0,halo:poiWeaponFireGlowGpu?.count??0,
   pixel:window.__thermalFrame??null,error:gl.getError(),depth:gl.getParameter(gl.DEPTH_WRITEMASK),blend:gl.isEnabled(gl.BLEND)}),
 },
`);
const renderOpen=`function render(){
 if(window.pineStartup.failed)return;
`;
h=add(h,renderOpen+' requestAnimationFrame(render);',renderOpen+' if(!window.__thermalManual)requestAnimationFrame(render);');
h=add(h,'function poiWildSpawnFrame(now,rng=Math.random){','function poiWildSpawnFrame(now,rng=Math.random){return;');
h=add(h,'  draw(poiWeaponFireBodyGpu,vp);poiDrawPlayerFireGlow(m.fireGlow,vp);',`
  const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,pre=new Uint8Array(w*h*4),post=new Uint8Array(w*h*4);
  gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pre);
  draw(poiWeaponFireBodyGpu,vp);poiDrawPlayerFireGlow(m.fireGlow,vp);
  gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,post);
  let count=0,warm=0,x0=w,y0=h,x1=0,y1=0,signature=2166136261;
  for(let i=0;i<pre.length;i+=4){
   const d=Math.abs(post[i]-pre[i])+Math.abs(post[i+1]-pre[i+1])+Math.abs(post[i+2]-pre[i+2]);
   if(d<22)continue;
   count++;if(post[i]>=post[i+1]+8&&post[i+1]>=post[i+2]+6)warm++;
   const x=(i/4)%w,y=Math.floor(i/4/w);x0=Math.min(x,x0);y0=Math.min(y,y0);x1=Math.max(x,x1);y1=Math.max(y,y1);
   signature=Math.imul(signature^i^post[i],16777619);
  }
  window.__thermalFrame={count,warm,signature,bounds:[x0,y0,x1,y1]};
`);
for(const [,s] of h.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(s);
if(process.env.THERMAL_SYNTAX_ONLY){console.log('thermal exact injected scripts parse');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>Thermal QA</title>':h)});
await new Promise((r,j)=>server.listen(0,'127.0.0.1',r).once('error',j));
const origin='http://127.0.0.1:'+server.address().port,screenshots=process.env.VFX_SCREENSHOTS;
let b;
try{
 if(screenshots)await mkdir(screenshots,{recursive:true});
 b=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const p=await(await b.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:.75})).newPage(),errors=[];
 p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(12000);
 await p.clock.install({time:new Date('2026-04-01T10:00:00Z')});await p.goto(origin+'/seed');
 await p.evaluate(()=>{
  const slots=Array(27).fill(null);slots[2]={type:'fireWand',count:1,charges:4};
  localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weapon:null,slots,gold:3,potions:0}));
  localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":360000}');
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,position:{x:102,z:93,y:0,facing:1},townLayout:5,townMapHeight:128,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 });
 await p.goto(origin+'/?resume=1&test=1');await p.locator('#pineStartupCover').waitFor({state:'hidden'});
 const qt=()=>p.evaluate(()=>window.__editorTest.thermalQA.state());
 await p.clock.pauseAt((await p.evaluate(()=>Date.now()))+1500);
 const armed=await p.evaluate(()=>{window.__thermalManual=true;return window.__editorTest.thermalQA.arm()});
 assert(armed.ok,JSON.stringify({armed,state:await qt()}));
 const c=await p.context().newCDPSession(p),r=await p.locator('#poiWalkAction').boundingBox(),pt={x:r.x+r.width/2,y:r.y+r.height/2,id:5};
 await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[pt]});await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 const traces=[];
 for(let i=0;i<35;i++){
  await p.clock.fastForward(24);await p.evaluate(()=>window.__editorTest.thermalQA.frame());
  const s=await qt();assert(s.depth&&!s.blend&&s.error===0);
  if(s.stage==='none'&&traces.length)break;
  if(!s.pixel||s.stage==='none')continue;
  traces.push(s);
  if(screenshots&&((i===2||i===9)||s.stage==='impact'&&!traces.slice(0,-1).some(t=>t.stage==='impact')))
   await p.screenshot({path:screenshots+'/fire-'+String(i).padStart(2,'0')+'-'+s.stage+'.png'});
 }
 const flight=traces.filter(t=>t.stage==='flight'&&t.pixel.warm>5),impact=traces.filter(t=>t.stage==='impact'&&t.pixel.warm>5);
 assert(flight.length>=2&&impact.length>0,JSON.stringify(traces.map(t=>[t.stage,t.pixel])));
 assert(new Set(flight.map(t=>t.pixel.signature)).size>=2);
 assert(traces.every(t=>t.charge===3&&t.vertices<=195&&t.halo<=48),'one stored charge and bounded real geometry');
 assert.deepEqual(errors,[]);console.log('real Wand touch and layered WebGL fire frames',flight.length,impact.length);
}finally{await b?.close();server.close()}
