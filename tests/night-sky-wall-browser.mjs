import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const html=readFileSync(process.argv[2]??'world-editor.html','utf8'),legacy=process.argv.includes('--expect-v287-white');
function inject(s,a,b){assert.equal(s.split(a).length,2,a);return s.replace(a,b)}
const key='  freeMovementPose:()=>({x:poiWalkViewX,z:poiWalkViewZ,level:poiWalkLevel}),';
let fixture=inject(html,key,key+`
  wallSkyQA:{
   stop:()=>{window.__wallSkyManual=true},
   pose:(x,z,y,yaw,pitch)=>{
    const ok=workshopResumeRestorePosition({x,z,y,facing:2});
    poiCameraYaw=yaw;poiCameraPitch=pitch;poiCameraDistance=5.5;
    return ok;
   },
   render:()=>{render();return window.__wallSkyFrame}
  },`);
fixture=inject(fixture,' requestAnimationFrame(render);',' if(!window.__wallSkyManual)requestAnimationFrame(render);');
fixture=inject(fixture,'function poiTownClockFrame(now){','function poiTownClockFrame(now){if(window.__wallSkyManual)return;');
const eyeAnchor=fixture.match(/  const arm=eye===desired\?(?:radius|poiCameraDistance):Math\.hypot\(\.\.\.eye\.map\(\(v,i\)=>v-target\[i\]\)\);/)?.[0];
assert(eyeAnchor,'actual perspective arm');
fixture=inject(fixture,eyeAnchor,`
${eyeAnchor}
  if(window.__wallSkyManual)window.__wallSkyWitness={clipped:eye!==desired,arm};`);
fixture=inject(fixture,' poiScreenNoteCaptureFrame();',`
 if(window.__wallSkyManual){
  const rect=canvas.getBoundingClientRect(),data=new Uint8Array(4),pts=[];let clearAlpha=0,canvasHits=0;
  for(const fy of [.021,.04,.075,.11,.15,.20,.245])for(const fx of [.30,.37,.44,.50,.56,.63,.70,.76]){
   const x=rect.x+rect.width*fx,y=rect.y+rect.height*fy;
   if(document.elementFromPoint(x,y)===canvas)canvasHits++;
   gl.readPixels(Math.round(canvas.width*fx),Math.round(canvas.height*(1-fy)),1,1,gl.RGBA,gl.UNSIGNED_BYTE,data);
   if(data[3]===0){clearAlpha++;if(document.elementFromPoint(x,y)===canvas)pts.push({x,y})}
  }
  const stage=$('viewWrap');
  window.__wallSkyFrame={...window.__wallSkyWitness,state:[poiWalkX,poiWalkZ,poiWalkLevel],yaw:poiCameraYaw,
   pitch:poiCameraPitch,clock:poiTownClockSnapshot().minute,sky:stage.hasAttribute('data-poi-sky'),
   raw:getComputedStyle(stage).backgroundImage,clearAlpha,canvasHits,pts,gl:gl.getError()};
 }
 poiScreenNoteCaptureFrame();`);
for(const [,source] of fixture.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(source);
if(process.env.PARSE_ONLY){console.log('PASS real night-sky native fixture compiles');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>Night Wall QA</title>':fixture)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
let browser,context,page,checkpoint='boot';
const errors=[],states=[];
try{
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 context=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:.75,isMobile:true,hasTouch:true});
 page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
 await page.goto(url+'/seed');
 await page.evaluate(()=>{localStorage.setItem('world-workshop-town-clock-v1',JSON.stringify({version:1,gameMs:120*500}));
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:24,z:118,y:0,facing:2},townLayout:5,townMapHeight:128,view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,
    orbitYaw:0,orbitPitch:.10,orbitDistance:5.5}}));
 });
 await page.goto(url+'/?resume=1&test=1',{waitUntil:'domcontentloaded'});
 await page.locator('#pineStartupCover').waitFor({state:'hidden'});
 await page.waitForFunction(()=>window.__editorTest?.facility()?.active);
 await page.evaluate(()=>window.__editorTest.wallSkyQA.stop());
 assert.equal(await page.evaluate(()=>window.__editorTest.setTownTime(120)),true);
 const cdp=await context.newCDPSession(page);
 const set=(...v)=>page.evaluate(v=>window.__editorTest.wallSkyQA.pose(...v),v);
 const render=()=>page.evaluate(()=>window.__editorTest.wallSkyQA.render());
 const grab=async label=>{
  const f=await render();if(f.pts.length<3){states.push({label,skippedOpaque:true,...f});return null;}
  const bytes=await page.screenshot({scale:'css'});
  f.rgb=await page.evaluate(async({bytes,pts})=>{
   const image=new Image();image.src='data:image/png;base64,'+bytes;await image.decode();
   const c=document.createElement('canvas');c.width=image.width;c.height=image.height;
   const g=c.getContext('2d');g.drawImage(image,0,0);
   return pts.map(p=>Array.from(g.getImageData(Math.round(p.x),Math.round(p.y),1,1).data).slice(0,3));
  },{bytes:bytes.toString('base64'),pts:f.pts});states.push({label,...f,pts:f.pts.length});
  return f;
 };
 const rotate=async direction=>{
  const x=direction<0?640:371,y=147,c=(a,b)=>({x:a,y:b,id:7,radiusX:4,radiusY:4,force:.7});
  const el=await page.evaluate(([x,y])=>document.elementFromPoint(x,y)?.id,[x,y]);assert.equal(el,'view');
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[c(x,y)]});
  for(const t of [36,90,148,196]){
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[c(x+t*direction,y)]});
  }
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 };
 const dayGreen=c=>c[1]>c[2]+3&&c[1]>110;
 const nightBlue=c=>c[2]>c[1]+10&&Math.max(...c)<150;
 const sealed=html.includes('function poiDavidTempleEnclosedAt(');
 let clippedForDay=null;
 for(const [label,x,z,dir] of (sealed?[['south ring exterior',24,123,-1],['entrance wing exterior',29,91,1]]:[['south ring',24,118,-1],['entrance wing',29,95,1]])){
  checkpoint=label;
  assert(await set(x,z,0,Math.PI/2,-.145));
  let clear=null,close=null;
  for(let i=0;i<8;i++){
   if(i)await rotate(dir);
   const f=await grab(label+' angle '+i);
   if(f?.clipped&&i>0)close=f;
   else if(f&&!f.clipped)clear=f;
   if(close&&clear)break;
  }
  assert(close&&clear,'must find visible sky at real clear and clipped orientations');
  assert(clear.sky&&clear.rgb.filter(nightBlue).length>=3);
  assert(close.arm<clear.arm-.5&&close.clock===120&&close.gl===0);
  if(legacy){assert.equal(close.sky,false);assert(close.rgb.filter(dayGreen).length>=3,'actual pale light fallback pixels: '+JSON.stringify(close.rgb));}
  else {assert.equal(close.sky,true);assert(close.rgb.filter(nightBlue).length>=3);assert.equal(close.rgb.filter(dayGreen).length,0);}
  clippedForDay={x,z,yaw:close.yaw,pitch:close.pitch};
 }
 if(!legacy){
  checkpoint='real daylight remains different in a clipped view';
  assert(await set(clippedForDay.x,clippedForDay.z,0,clippedForDay.yaw,clippedForDay.pitch));
  assert.equal(await page.evaluate(()=>window.__editorTest.setTownTime(720)),true);
  const day=await grab('day clipped');
  assert(day.clipped&&day.sky&&day.clock===720&&day.rgb.some(c=>c[2]>150));
  if(sealed){
   checkpoint='actual sacred roof stays opaque at the same sky clock';
   assert(await set(24,100,0,0,-.145));const roof=await render();
   assert.equal(roof.state[2],0);assert.equal(roof.sky,false);
  }
  checkpoint='actual mine floor still has no sky';
  assert(await set(109,60,-1,0,.16));const mine=await render();assert.equal(mine.state[2],-1);assert.equal(mine.sky,false);
 }
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify(states));
 console.log(legacy?'PASS reproducible pale editor background at fixed 02:00 (v287)':'PASS outdoor clipped camera retains actual night palette across rotations');
}catch(e){console.error(checkpoint,JSON.stringify(states),errors);throw e}
finally{await context?.close();await browser?.close();await new Promise(r=>server.close(r))}
