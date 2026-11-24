import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {Script} from 'node:vm';
let h=readFileSync(process.argv[2]??'world-editor.html','utf8');
function inject(a,b){assert.equal(h.split(a).length,2,a);h=h.replace(a,b)}
const qa="if(facilityParams.get('test')==='1')window.__editorTest={";
inject(qa,qa+`
  templeSealQA:{
   frame:()=>render(),
   eye:()=>{
    const pitch=poiCameraPitch,radius=poiCameraDistance;
    try{poiCameraPitch=1.15;poiCameraDistance=12;parameters();return window.__seal.eye;}
    finally{poiCameraPitch=pitch;poiCameraDistance=radius;}
   },
   state:()=>{
    const s=facilitySite,d=s.davidTemple,roof=s.buildings.findIndex(b=>b.id==='davidTemple'),p=poiAimOrigin(performance.now());
    return {pos:[poiWalkX,poiWalkZ,poiWalkLevel],room:facilityHiddenRoof(),visible:facilityVisibleRoofs(),roof,
     covers:window.__seal.draws,corners:window.__seal.vertices,
     indoors:poiWalkIndoor(),tunnel:poiDavidTempleTunnelAt(s,p.x,p.z,p.y),
     light:poiTownSceneLight(),retreat:d.retreat,ready:$('pineStartupCover').hidden,sky:poiSkyCanLookUp(),
     arena:poiDavidIn(d.boss,p),los:poiDavidLine(d.boss,p,d.boss),distance:Math.hypot(p.x-d.boss.x,p.z-d.boss.z),
     contacted:!!poiDavidActive?.s?.david?.awake,
     key:poiDungeonEntranceSerial,error:gl.getError(),screen:location.href};
   },
  },
`);
inject(' requestAnimationFrame(render);',' if(!window.__seal.manual)requestAnimationFrame(render);');
const camera="  const eye=typeof facilitySharedWallCameraEye==='function'?facilitySharedWallCameraEye(target,desired):desired;";
inject(camera,camera+'\n  window.__seal.eye={eye,desired,target};');
inject('  else draw(facilityRoofMeshes[i],vp);',
 '  else {if(facilitySite.buildings[i]?.id==="davidTemple"){window.__seal.draws++;window.__seal.vertices=facilityRoofMeshes[i].count}draw(facilityRoofMeshes[i],vp)}');
for(const [,js] of h.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(js);
if(process.env.DAVID_SACRED_SYNTAX_ONLY){console.log('permanent dome native fixture exact anchors and inline syntax');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const s=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>Sacred Temple QA</title>':h)});
await new Promise((r,j)=>s.listen(0,'127.0.0.1',r).once('error',j));
const url='http://127.0.0.1:'+s.address().port,screenshots=process.env.FACILITY_SCREENSHOTS;
let b;
try{
 if(screenshots)await mkdir(screenshots,{recursive:true});
 b=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const ctx=await b.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:.7});
 await ctx.addInitScript(()=>{window.__seal={manual:false,draws:0,vertices:0}});
 const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(26000);
 await p.clock.install({time:new Date('2026-04-01T10:00:00Z')});
 const resume=async(x,z,legacy=false)=>{
  await p.goto(url+'/seed',{waitUntil:'domcontentloaded'});
  await p.evaluate(({x,z,legacy})=>{
   localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":360000}');
   localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,position:{x,z,y:0,facing:2},
    townLayout:5,townMapHeight:legacy?128:182,...(legacy?{}:{templeDepth:1}),view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:0,orbitPitch:.12,orbitDistance:6.5}}));
  },{x,z,legacy});
  await p.goto(url+'/?resume=1&test=1',{waitUntil:'domcontentloaded'});
  await p.locator('#pineStartupCover').waitFor({state:'hidden'});
  await p.evaluate(()=>window.__seal.manual=true);
  await p.clock.pauseAt((await p.evaluate(()=>Date.now()))+3000);
 };
 const read=()=>p.evaluate(()=>window.__editorTest.templeSealQA.state());
 const frame=async(ms=220)=>{await p.clock.fastForward(ms);await p.evaluate(()=>window.__editorTest.templeSealQA.frame());return read()};
 const step=async(key,x,z)=>{await p.keyboard.press(key);const q=await frame();assert.deepEqual(q.pos,[x,z,0],JSON.stringify(q));return q};
 const roof=(q,prev)=>{assert(q.visible.includes(q.roof),JSON.stringify(q));assert(q.covers>prev.covers&&q.corners>1500);assert(q.error===0)};
 await resume(24,125);const before=await frame();assert(!before.indoors&&before.sky&&!before.contacted);
 if(screenshots)await p.screenshot({path:screenshots+'/temple-01-opaque-entry.png'});
 for(const z of [126,127,128,129])await step('ArrowUp',24,z);
 const vestibule=await step('ArrowUp',24,130);roof(vestibule,before);
 assert(vestibule.indoors&&vestibule.tunnel&&!vestibule.sky&&!vestibule.contacted);
 assert.deepEqual(vestibule.light,[.76,.65,.54]);
 const lowEye=await p.evaluate(()=>window.__editorTest.templeSealQA.eye());
 assert(lowEye.eye[1]>1.1&&lowEye.eye[1]<3.19&&lowEye.desired[1]>3.19,JSON.stringify(lowEye));
 if(screenshots)await p.screenshot({path:screenshots+'/temple-02-warm-narrow-turn.png'});
 await step('ArrowLeft',25,130);await step('ArrowLeft',25,130); // second tap meets real side wall
 await step('ArrowRight',24,130);
 for(let z=131;z<142;z++){const q=await step('ArrowUp',24,z);assert(q.indoors&&q.tunnel&&!q.arena&&!q.contacted,JSON.stringify(q))}
 const mouth=await step('ArrowUp',24,142);
 assert(mouth.arena&&mouth.los&&mouth.distance===16&&!mouth.contacted);
 for(let z=143;z<155;z++)await step('ArrowUp',24,z);
 const lip=await step('ArrowUp',24,155);
 assert(lip.arena&&lip.los&&lip.distance===3&&!lip.contacted,JSON.stringify(lip));
 let arena=await step('ArrowUp',24,156);
 for(let i=0;i<10&&!arena.contacted;i++)arena=await frame(80);
 roof(arena,vestibule);assert(arena.indoors&&!arena.tunnel&&!arena.sky&&arena.contacted&&arena.arena&&arena.los&&arena.distance===2,JSON.stringify(arena));
 assert.deepEqual(arena.light,[.77,.70,.62]);
 const highEye=await p.evaluate(()=>window.__editorTest.templeSealQA.eye());
 assert(highEye.eye[1]>1.1&&highEye.eye[1]<7.62&&highEye.desired[1]>7.62,JSON.stringify(highEye));
 assert.equal(arena.key,before.key);assert.equal(arena.screen,before.screen);assert(arena.ready);
 if(screenshots)await p.screenshot({path:screenshots+'/temple-03-close-david-reveal.png'});
 await p.clock.resume();await resume(24,96,true);const migrated=await frame();
 assert.deepEqual(migrated.pos,[24,125,0],'old temple save migrates to the safe new forecourt');
 assert(!migrated.indoors&&!migrated.tunnel&&!migrated.contacted&&migrated.visible.includes(migrated.roof));
 assert.deepEqual(errors,[]);
 console.log('Native closed temple: live opaque roof draws outside and inside, genuine covered straight passage, no wake before approaching the far center, same scene, old save locally recovered.');
}finally{await b?.close();await new Promise(r=>s.close(r))}
