import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const expectLegacy=process.argv.includes('--expect-v259-regression');
function inject(s,a,b){assert.equal(s.split(a).length,2,a);return s.replace(a,b)}
const eye='  const arm=eye===desired?poiCameraDistance:Math.hypot(...eye.map((v,i)=>v-target[i]));';
const hook="  townResidents:()=>typeof poiTownResidentsSnapshot==='function'?poiTownResidentsSnapshot():null,";
const clock='function poiTownClockFrame(now){';
let fixture=inject(html,eye,eye+'\n  if(window.__qaNightSky)window.__qaNightSky.view={eye,target};');
fixture=inject(fixture,clock,clock+'if(window.__qaNightSky)return;');
fixture=inject(fixture,hook,hook+`
  nightSkyQA:()=>{const data=window.__qaNightSky,stage=canvas.getBoundingClientRect(),p=parameters(),v=data.view;
   if(!v)return null;
   const dx=v.target[0]-v.eye[0],dz=v.target[2]-v.eye[2],r=Math.hypot(dx,dz);
   const rays=[Math.PI/12,Math.PI*17.5/180].map(h=>{
    // Project a fixed compass/elevation ray rather than resampling a fixed
    // viewport row. A real colored horizon may differ from the zenith.
    const x=dx/r,z=dz/r,d=110,side=.28;
    // Offset horizontally at the same forward-depth plane. A central
    // ray otherwise intersects the avatar's head as the orbit looks up.
    const q=poiWorldToScreen(p.vp,v.eye[0]+(x+z*side)*d,v.eye[1]+Math.tan(h)*d,v.eye[2]+(z-x*side)*d);
    return q?{x:stage.x+q.x,y:stage.y+q.y}:null;
   });
   data.rays=rays;
   return {logical:poiCameraPitch,physical:Math.atan2(v.eye[1]-v.target[1],r),clock:poiTownClockSnapshot().minute,
    rays,alpha:data.alpha,ground:poiWalkLevel,x:poiWalkX,z:poiWalkZ,sky:$('viewWrap').hasAttribute('data-poi-sky'),
    stageBackground:getComputedStyle($('viewWrap')).backgroundImage,canvasAlpha:gl.getContextAttributes()?.alpha};
  },`);
const endDraw=' poiScreenNoteCaptureFrame();';
fixture=inject(fixture,endDraw,`
 if(window.__qaNightSky?.rays){
  const box=canvas.getBoundingClientRect();
  window.__qaNightSky.alpha=window.__qaNightSky.rays.map(ray=>{
   if(!ray)return null;
   const x=Math.round((ray.x-box.left)/box.width*canvas.width),y=Math.round((1-(ray.y-box.top)/box.height)*canvas.height);
   if(x<1||y<1||x>=canvas.width-1||y>=canvas.height-1)return null;
   const rgba=new Uint8Array(4);gl.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,rgba);return rgba[3];
  });
 }`+endDraw);
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<!doctype html><title>Night sky QA</title>':fixture)});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const origin='http://127.0.0.1:'+server.address().port;
const states=[];
let browser,context,page,checkpoint='launch';
const errors=[];
async function boot(position,pitch){
 await page.goto(origin+'/seed');
 await page.evaluate(({position,pitch})=>{
  localStorage.setItem('world-workshop-town-clock-v1',JSON.stringify({version:1,gameMs:120*500}));
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{...position,facing:2},townLayout:5,townMapHeight:128,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:position.y,hideUpper:false,top:false,third:true,
    orbitYaw:Math.PI,orbitPitch:pitch,orbitDistance:5.5}}));
 },{position,pitch});
 await page.goto(origin+'/?resume=1&test=1');
 await page.locator('#pineStartupCover').waitFor({state:'hidden'});
 await page.waitForFunction(()=>window.__editorTest?.facility()?.active&&window.__editorTest.nightSkyQA());
}
async function screenshotRays(label){
 const q=await page.evaluate(async()=>{
  window.__editorTest.nightSkyQA();
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  return window.__editorTest.nightSkyQA();
 });
 assert(q.rays.every(p=>p&&p.x>10&&p.y>10&&p.y<380),label+' sky-ray geometry stays inside drawn surface');
 assert(q.alpha?.length===2&&q.alpha.every(n=>Number.isFinite(n)&&n<5),
  label+' display probes must be unoccluded sky in the actual WebGL frame: '+JSON.stringify(q));
 const bytes=await page.screenshot({scale:'css'});
 const rgb=await page.evaluate(async({bytes,points})=>{
  const image=new Image();image.src='data:image/png;base64,'+bytes;await image.decode();
  const c=document.createElement('canvas');c.width=image.width;c.height=image.height;
  const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(image,0,0);
  return points.map(p=>{
   const a=g.getImageData(Math.round(p.x)-2,Math.round(p.y)-2,5,5).data;
   return [0,1,2].map(k=>Array.from({length:25},(_,i)=>a[i*4+k]).sort((a,b)=>a-b)[12]);
  });
 },{bytes:bytes.toString('base64'),points:q.rays});
 states.push({label,...q,rgb});return states.at(-1);
}
async function dragUp(){
 const cdp=await context.newCDPSession(page);
 try{
  const coords=await page.evaluate(()=>{
   const stage=document.querySelector('#view').getBoundingClientRect();
   for(const fx of [.70,.66,.75,.62])for(const fy of [.64,.55,.72]){
    const x=Math.round(stage.left+stage.width*fx),y=Math.round(stage.top+stage.height*fy);
    if(document.elementFromPoint(x,y)?.id==='view')return [x,y];
   }
   return null;
  });
  assert(coords,'actual right-thumb world surface is accessible');
  const [x,y]=coords,point=(x,y)=>({x,y,id:1,radiusX:4,radiusY:4,force:.7});
  const touch=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
  await touch('touchStart',[point(x,y)]);
  for(const step of [16,30,46,55])await touch('touchMove',[point(x,y-step)]);
  await touch('touchEnd',[]);
 }finally{await cdp.detach()}
}
const gap=(a,b)=>Math.max(...a.map((v,i)=>Math.abs(v-b[i])));
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 context=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:.75,isMobile:true,hasTouch:true});
 page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
 await page.addInitScript(()=>{window.__qaNightSky={};});
 checkpoint='fixed 02:00 outdoors, near-straight pitch';await boot({x:66,z:4,y:0},.185);
 const straight=await screenshotRays('straight');
 assert.equal(straight.clock,120);assert(Math.abs(straight.logical-.185)<.005);
 checkpoint='same night after native upward drag';await dragUp();
 await page.waitForFunction(()=>window.__editorTest.nightSkyQA().logical<-.095);
 const raised=await screenshotRays('up');
 assert.equal(raised.clock,straight.clock);
 assert(raised.physical<straight.physical-.2&&raised.x===straight.x&&raised.z===straight.z);
 assert(Math.abs(straight.rays[0].y-raised.rays[0].y)>50,'same sky ray moved to a different viewport row');
 const difference=straight.rgb.map((rgb,i)=>gap(rgb,raised.rgb[i]));
 if(expectLegacy){
  assert(Math.max(...difference)>35,'v259 reproduced a visibly different same-world-direction night color: '+difference);
 }else{
  assert(Math.max(...difference)<=13,'same world ray should retain its night shade across pitch: '+difference);
  checkpoint='actual daylight still changes sky color';assert.equal(await page.evaluate(()=>window.__editorTest.setTownTime(720)),true);
  const day=await screenshotRays('day');assert.equal(day.clock,720);
  assert(day.rgb.some((rgb,i)=>gap(rgb,raised.rgb[i])>=25),'clock can still legitimately change the sky palette');
  checkpoint='underground does not acquire sky';await boot({x:109,z:60,y:-1},.185);await dragUp();
  const below=await page.evaluate(()=>window.__editorTest.nightSkyQA());
  assert.equal(below.ground,-1);assert.equal(below.sky,false);assert(below.logical>=.115);
 }
 assert.deepEqual(errors,[]);
 console.log(expectLegacy?'PASS reproduces v259 viewport-linked fixed-night color shift':'PASS actual same-ray colors at fixed night, real time-color change, dark mine');
}catch(e){console.error(checkpoint,JSON.stringify(states),errors);throw e}
finally{await context?.close();await browser?.close();await new Promise(r=>server.close(r))}
