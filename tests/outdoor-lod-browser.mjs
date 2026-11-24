import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {mkdirSync,readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const source=readFileSync(process.argv[2]??'world-editor.html','utf8');
const a="if(facilityParams.get('test')==='1')window.__editorTest={";
let html=source.replace(a,a+`
 outdoorQA:{
  at:(x,z,yaw,minute)=>{
   const ok=workshopResumeRestorePosition({x,z,y:0,facing:2});
   poiCameraYaw=yaw;poiCameraPitch=.13;poiCameraDistance=6;poiTownClockGameMs=minute*POI_TOWN_MINUTE_MS;
   return ok;
  },
  paint:()=>render(),
  live:()=>({x:poiWalkX,z:poiWalkZ,held:!!poiAnalogContact,farSnow:poiOutdoorProbe.drawn.some(q=>q.key.startsWith('snowpass:'))}),
  frame:()=>{
   const start=window.performance.now();render();const renderMs=window.performance.now()-start;
   const p=parameters(),w=canvas.width,h=canvas.height,data=new Uint8Array(w*h*4);
   gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,data);
   let snow=0,green=0,opaque=0;
   for(let y=h*.40|0;y<h*.63;y++)for(let x=w*.35|0;x<w*.65;x++){
    const i=(y*w+x)*4,r=data[i],g=data[i+1],b=data[i+2];
    if(data[i+3]<230)continue;opaque++;
    if(r>135&&g>147&&b>155&&b>=r&&g>r)snow++;
    if(g>r*1.12&&g>b*1.07)green++;
   }
   const ref=poiOverlandInspect(),lo=typeof poiOutdoorProbe==='undefined'?null:poiOutdoorProbe;
   return {x:poiWalkX,z:poiWalkZ,site:facilitySite.id,pose:[poiWalkViewX,poiWalkViewZ],w,h,snow,green,opaque,
    held:!!poiAnalogContact,renderMs,enabled:!!poiOutdoorFrame,query:POI_OUTDOOR_LOD,low:lo?.drawn??[],farBytes:poiOutdoorFarBytes,
    resident:poiOutdoorCaches.size,maxBakeMs:lo?.maxBakeMs,nearBytes:ref.bytes,err:gl.getError()};
  }
 },`);
const r=' requestAnimationFrame(render);';
assert.equal(html.split(r).length,2);html=html.replace(r,' if(!window.__outdoorManual)requestAnimationFrame(t=>{window.__outdoorFrames?.push(t);render();});');
for(const [,js] of html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(js);
if(process.env.OUTDOOR_PARSE_ONLY)process.exit(0);
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>seed</title>':html)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
let browser,phase='startup',last;
try{
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const c=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:.75,isMobile:true,hasTouch:true});
 const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 p.on('console',m=>{if(m.type()==='error')console.log('PAGE',m.text().slice(0,350));});
 const enabled=process.env.OUTDOOR_STOCK!=='1';
 await p.goto(url+'/seed');
 await p.evaluate(()=>{
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:84,z:115,y:0,facing:2},townLayout:5,townMapHeight:182,templeDepth:1,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:-.78,orbitPitch:.13,orbitDistance:6}}));
 });
 await p.goto(url+'/?resume=1&test=1'+(enabled?'':'&outdoor-lod=0'),{waitUntil:'domcontentloaded'});
 await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:40000});
 await p.waitForFunction(()=>window.__editorTest?.outdoorQA&&window.__editorTest?.facility()?.active,null,{timeout:12000,polling:35})
  .catch(async e=>{console.error('BOOT',await p.evaluate(()=>({url:location.href,keys:Object.keys(window.__editorTest??{}),startup:window.pineStartup?.failed,query:location.search})),errors);throw e});

 await p.evaluate(()=>{window.__outdoorManual=true});
 const shot=async key=>{if(!process.env.FACILITY_SCREENSHOTS)return;
  mkdirSync(process.env.FACILITY_SCREENSHOTS,{recursive:true});
  await p.screenshot({path:process.env.FACILITY_SCREENSHOTS+'/'+key+'.png'});
 };
 const sample=()=>p.evaluate(()=>window.__editorTest.outdoorQA.frame());
 const set=(...a)=>p.evaluate(a=>window.__editorTest.outdoorQA.at(...a),a);
 const out=[];
 for(const [key,x,z,yaw,min,needSnow] of [['base-gate',41,43,0,690,false],['south-road-gate',105,98,-2.547,690,false],['port',84,115,-.785,690,true],['rest',54,119,.29,690,true],['dusk',54,119,.29,51,true],['reverse',54,119,-1.4,690,false],['near',60,133,0,690,true]]){
  phase=key;assert(await set(x,z,yaw,min));
  await p.evaluate(count=>{for(let i=0;i<count;i++)window.__editorTest.outdoorQA.paint()},enabled?100:5);
  last=await sample();
  assert.deepEqual([last.x,last.z],[x,z]);assert.equal(last.err,0);
  assert.equal(last.enabled,enabled);assert(last.farBytes+last.nearBytes<=4*2**20);
  const real=last.low.filter(s=>s.key.startsWith('snowpass:'));
  if(enabled&&needSnow&&key!=='near')assert(real.length&&real.some(s=>s.ground>0||s.props>0),JSON.stringify(last));
  if(enabled)assert(last.low.every(s=>!s.key.startsWith('base:')),JSON.stringify(last));
  if(!enabled)assert.equal(last.resident,0);
  out.push({...last,low:last.low.length,real:real.length});
  await shot(key);
 }
 phase='trusted snow approach (49,119 → ≥122), no jump in geography while turning';
 const origin=[49,119,Math.atan2(11,20),690];assert(await set(...origin));
 await p.evaluate(()=>{for(let i=0;i<54;i++)window.__editorTest.outdoorQA.paint()});
 let start=await sample();assert.deepEqual([start.x,start.z],[49,119]);
 assert.equal(new URL(p.url()).searchParams.has('outdoor-lod'),!enabled);
 const cdp=await c.newCDPSession(p),box=await p.locator('#poiAnalogPad').boundingBox();assert(box);
 const x=box.x+box.width*.45,y=box.y+box.height*.5,id=71;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id}]});
 const dx=38*Math.sin(origin[2]),up=38*Math.cos(origin[2]);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx,y:y-up,id}]});
 const motion=[];
 await p.evaluate(()=>{window.__outdoorFrames=[];window.__outdoorManual=false;window.__editorTest.outdoorQA.paint()});
 for(let i=0;i<34;i++){await p.waitForTimeout(26);last=await p.evaluate(()=>window.__editorTest.outdoorQA.live());
  motion.push(last);
  if(last.z>=122)break;
 }
 assert(last.held&&last.z>=122&&Math.abs(last.x-49)<=1,JSON.stringify({last,motion}));
 if(enabled)assert(motion.some(m=>m.z<122&&m.farSnow),JSON.stringify(motion));
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 const heldFrames=await p.evaluate(()=>window.__outdoorFrames.splice(0));
 await p.waitForTimeout(900);
 const frames=await p.evaluate(()=>{window.__outdoorManual=true;return window.__outdoorFrames.splice(0);});
 function cadence(a){
  const g=a.slice(1).map((t,i)=>t-a[i]).sort((a,b)=>a-b);
  return {frames:a.length,p50:g[Math.floor(g.length*.5)],p95:g[Math.min(g.length-1,Math.floor(g.length*.95))],max:g.at(-1)};
 }
 const heldStats=cadence(heldFrames),lateStats=cadence(frames);
 assert(frames.length>=10&&heldFrames.length>=10,JSON.stringify({heldStats,lateStats}));
 await shot('walk-north');
 console.log('OUTDOOR ACTUAL TOUCH',JSON.stringify({enabled,motion,heldStats,lateStats}));
 phase='trusted two-way Snow seam from last physical approach tile';
 assert(await set(60,137,0,690));
 for(const [sign,target] of [[-1,'snowpass'],[1,'base']]){
  const nextid=id+sign;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:nextid}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+sign*38,id:nextid}]});
  for(let i=0;i<52;i++){await p.waitForTimeout(32);last=await sample();if(last.site===target)break;}
  assert.equal(last.site,target,JSON.stringify(last));assert(last.held&&last.err===0&&last.nearBytes+last.farBytes<=4*2**20,JSON.stringify(last));
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await shot('seam-'+target);
  console.log('OUTDOOR VERIFIED SEAM',JSON.stringify(last));
 }
 phase='cold on real Snow, west canopy bearing';
 await p.goto(url+'/seed');await p.evaluate(()=>{
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:12,z:10,y:0,facing:2},region:'snowpass',regionHp:71,townLayout:5,townMapHeight:182,templeDepth:1,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:-2.41,orbitPitch:.13,orbitDistance:6}}));
 });
 await p.goto(url+'/?resume=1&test=1'+(enabled?'':'&outdoor-lod=0'),{waitUntil:'domcontentloaded'});
 await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:40000});
 await p.waitForFunction(()=>window.__editorTest?.outdoorQA&&window.__editorTest?.facility()?.active,null,{timeout:12000,polling:35})
  .catch(async e=>{console.error('BOOT',await p.evaluate(()=>({url:location.href,keys:Object.keys(window.__editorTest??{}),startup:window.pineStartup?.failed,query:location.search})),errors);throw e});

 await p.evaluate(count=>{window.__outdoorManual=true;for(let i=0;i<count;i++)window.__editorTest.outdoorQA.paint()},enabled?100:5);
 last=await sample();assert.equal(last.site,'snowpass');assert.equal(last.enabled,enabled);assert.equal(last.err,0);
 if(enabled)assert(last.low.some(s=>s.key.startsWith('base:')&&s.props>0),JSON.stringify(last));
 assert(last.farBytes+last.nearBytes<=4*2**20);out.push({...last,low:last.low.length});await shot('snow');
 assert.deepEqual(errors,[]);
 console.log('AUTHENTIC LOD WEBGL',JSON.stringify({enabled,out}));
}catch(e){console.error(phase,JSON.stringify(last));throw e}
finally{await browser?.close();await new Promise(r=>server.close(r))}
