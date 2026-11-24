import a from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
let h=readFileSync(process.argv[2]??'world-editor.html','utf8');
const anchor='  freeMovementPose:()=>({x:poiWalkViewX,z:poiWalkViewZ,level:poiWalkLevel}),';
a.equal(h.split(anchor).length,2);
h=h.replace(anchor,anchor+`
  sleeveQA:()=>({x:poiWalkX,z:poiWalkZ,y:poiWalkLevel,id:facilitySite?.id,
    minimap:poiMiniSnapshot(),dirs:['n','s','e','w'].map(k=>poiCameraRelativeStep(k)),
    gl:gl.getError(),switches:poiSnowPassSwitches,timeout:poiWalkNextReady,
    neighbor:poiOverlandRealNeighbor('snowpass',12,0)}),
`);
for(const [_,s] of h.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(s);
if(process.env.SNOW_PASS_SYNTAX_ONLY)process.exit(0);
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>seed</title>':h)});
await new Promise((r,no)=>server.listen(0,'127.0.0.1',r).once('error',no));const url='http://127.0.0.1:'+server.address().port;
let b;
try{
 b=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const ctx=await b.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:.65});
 const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 async function seed(x,z,region){
  await p.goto(url+'/seed');
  await p.evaluate(({x,z,region})=>{
   localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,position:{x,z,y:0,facing:2},
    ...(region?{region}:{}),townLayout:5,townMapHeight:182,templeDepth:1,
    view:{yaw:0,zoom:1,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.25,orbitDistance:6}}));
  },{x,z,region});
  await p.goto(url+'/?resume=1&test=1');
  await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:22000});
 }
 const get=()=>p.evaluate(()=>window.__editorTest?.sleeveQA());
 await seed(49,127);
 let s=await get();a.deepEqual([s.x,s.z,s.y,s.id],[49,127,0,'base']);
 const waypoints=[[49,130],[52,130],[52,132],[57,132],[57,135],[60,135],[60,138]];
 for(const [tx,tz] of waypoints)while(s.x!==tx||s.z!==tz){
  const want={x:s.x+Math.sign(tx-s.x),z:s.z+Math.sign(tz-s.z)};
  const index=s.dirs.findIndex(d=>d[0]===want.x-s.x&&d[1]===want.z-s.z);a(index>=0);
  const key=['ArrowUp','ArrowDown','ArrowRight','ArrowLeft'][index];
  let after;
  for(let i=0;i<5;i++){
   await p.keyboard.press(key);await p.waitForTimeout(230);after=await get();
   if(after.x===want.x&&after.z===want.z)break;
   a.deepEqual([after.x,after.z],[s.x,s.z],JSON.stringify({want,after}));
  }
  a.deepEqual([after.x,after.z,after.y,after.id,after.switches],[want.x,want.z,0,'base',0],JSON.stringify({want,after}));
  a.equal(after.gl,0);s=after;
 }
 await p.waitForFunction(()=>window.__editorTest?.sleeveQA().neighbor,null,{polling:30,timeout:8000});
 a.equal(s.minimap.local.scope,'base:0:surface');
 const raw=await p.evaluate(()=>JSON.parse(localStorage.getItem('world-workshop-resume-v1')));
 a.deepEqual([raw.position.x,raw.position.z,raw.townMapHeight],[60,138,182]);a.equal(raw.region,undefined);
 await p.reload();await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:22000});
 s=await get();a.deepEqual([s.x,s.z,s.id],[60,138,'base']);
 await seed(1,12,'snowpass');s=await get();a.deepEqual([s.x,s.z,s.y,s.id],[1,12,0,'snowpass'],'unmodified west shoulder is a legitimate old Snow checkpoint');
 a.deepEqual(errors,[]);
 console.log('PASS actual old outlet to entire east sleeve, no intervening map switch, genuine neighbor ready, resumed both new path and old snow shoulder');
}finally{await b?.close();await new Promise(r=>server.close(r))}
