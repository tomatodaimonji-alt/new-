import a from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {mkdirSync,readFileSync} from 'node:fs';
import {Script} from 'node:vm';
let html=readFileSync(process.argv[2]||'world-editor.html','utf8');
const rep=(x,y)=>{a.equal(html.split(x).length,2,x);html=html.replace(x,y)};
const api="if(facilityParams.get('test')==='1')window.__editorTest={";
rep(api,api+`
 templeContactWall:()=>{
  const q=window.__templeContactFrame||[];
  const x=poiWalkViewX,z=poiWalkViewZ;
  return {x,z,tile:[poiWalkX,poiWalkZ],region:facilitySite?.id,
   tau:poiSacredTempleViewAmount(),portal:poiSacredTunnelPresentation(facilitySite,x,z,poiWalkLevel),
   walls:q,verts:q.reduce((n,o)=>n+o.verts,0),sameThumb:!!poiAnalogContact,
   hide:gl.getUniform(program,loc.sacredTempleHide),error:gl.getError()};
 },
`);
rep('function poiSacredContactWallDraw(vp){','function poiSacredContactWallDraw(vp){window.__templeContactFrame=[];');
rep('    gpu=upload(m);q.meshes.set(o,gpu);','    gpu=upload(m);q.meshes.set(o,gpu);');
rep('gl.uniform1f(loc.sacredTempleHide,1-amount);draw(gpu,vp);',
 'gl.uniform1f(loc.sacredTempleHide,1-amount);draw(gpu,vp);window.__templeContactFrame.push({x:o.x,z:o.z,type:o.type,amount,verts:gpu.count,solid:!poiWalkCanStep(o.x,o.z,poiWalkX,poiWalkZ)});');
for(const [,s] of html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(s);
if(process.env.TEMPLE_WALL_SYNTAX_ONLY)process.exit(0);
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>seed</title>':html)});
await new Promise((r,j)=>server.listen(0,'127.0.0.1',r).once('error',j));const origin='http://127.0.0.1:'+server.address().port;
let browser;
try{
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 for(const v of [{x:1,z:19,region:'snowpass',inside:false},{x:46,z:158,inside:true}]){
  const ctx=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:.75});
  try{
   const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
   await p.goto(origin+'/seed');
   await p.evaluate(({x,z,region})=>{
    localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":162500}');
    localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
     position:{x,z,y:0,facing:3},...(region?{region,regionHp:71}:{}),townLayout:5,townMapHeight:182,templeDepth:1,
     view:{yaw:0,zoom:1,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:-Math.PI/2,orbitPitch:.25,orbitDistance:6}}));
   },v);
   await p.goto(origin+'/?resume=1&test=1');
   await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:25000});
   const snap=()=>p.evaluate(()=>window.__editorTest.templeContactWall());let s=await snap();
   const image=async name=>{if(process.env.FACILITY_SCREENSHOTS){mkdirSync(process.env.FACILITY_SCREENSHOTS,{recursive:true});await p.screenshot({path:process.env.FACILITY_SCREENSHOTS+'/'+name+'.png'});}};
   a.deepEqual(s.tile,[v.x,v.z]);a.equal(s.error,0);a.equal(s.hide,0);
   if(!v.inside){a.equal(s.region,'snowpass');a.deepEqual(s.walls,[]);await image('snow-no-temple');continue}
   a.equal(s.tau,0);a.equal(s.portal,false);
   const cdp=await ctx.newCDPSession(p);const box=await p.locator('#poiAnalogPad').boundingBox();
   const pt={x:Math.round(box.x+box.width/2),y:Math.round(box.y+box.height/2),id:77};
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[pt]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...pt,y:pt.y-37}]});
   const pre=await (await p.waitForFunction(()=>{const s=window.__editorTest.templeContactWall();
    return s.x>43&&s.x<45.2&&s.sameThumb&&s.walls.some(w=>w.solid&&w.amount>.3)&&s},null,{polling:24,timeout:7000})).jsonValue();
   a(pre.x>43,'real stone visible while the character is still walking toward it');
   await p.waitForFunction(()=>window.__editorTest.templeContactWall().x<43,null,{polling:24,timeout:7000});
   await p.waitForTimeout(550);const blocked=await snap();
   a(blocked.x>41.5&&blocked.x<43&&blocked.sameThumb,'physics still blocks on actual stone, never enters arena');
   a(blocked.walls.some(w=>w.solid&&w.amount===1));a(blocked.verts>0&&blocked.verts<=3000);a(blocked.walls.length<=12);
   a.equal(blocked.tau,0);a.equal(blocked.portal,false);a.equal(blocked.hide,0);a.equal(blocked.error,0);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...pt,x:pt.x+38}]});
   const turn=await (await p.waitForFunction(z=>{const s=window.__editorTest.templeContactWall();return Math.abs(s.z-z)>1&&s},blocked.z,{polling:32,timeout:7000})).jsonValue();
   a(turn.sameThumb&&Math.abs(turn.x-blocked.x)<.22,'same touch can skirt the blocking wall sideways');
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await image('real-wall-skirt');
   a.deepEqual(errors,[]);console.log('Real exterior wall becomes readable before still-solid contact',JSON.stringify({pre,blocked,turn}));
  }finally{await ctx.close()}
 }
}finally{await browser?.close();await new Promise(r=>server.close(r))}
