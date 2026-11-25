import a from 'node:assert/strict';import {chromium} from 'playwright';
import {readFileSync,mkdirSync} from 'node:fs';import {createServer} from 'node:http';
let html=readFileSync('world-editor.html','utf8'),hook="if(facilityParams.get('test')==='1')window.__editorTest={";
a.equal(html.split(hook).length,2);
html=html.replace(hook,hook+`
 actorHorizonQA:()=>{
  const p=parameters(),f=poiFieldHazeFrame,measure=(a)=>{const q=poiOverlandGlobal(facilitySite.id,a.x,a.z);return Math.hypot(q[0]-f.world[0],q[1]-f.world[1])};
  const roster=poiTownNpcActors.filter(a=>!a.recessed&&!a.death&&a.y===poiWalkLevel);
  return {pos:[poiWalkX,poiWalkZ],has48:!!f,stream:poiOverlandDrawing,
   beyond:f?roster.filter(a=>measure(a)>50).length:0,
   beyondSubmitted:f?roster.filter(a=>measure(a)>50&&poiOverlandActorVisible(p.vp,a.x,a.z,a.y)).length:0,
   near:f?roster.filter(a=>measure(a)<15&&poiOverlandActorVisible(p.vp,a.x,a.z,a.y)).length:0,
   submitted:window.__residentsSubmitted??0,gl:gl.getError()};
 },
`);
const before=" const nearActors=actors.filter(a=>!a.recessed&&!a.death&&poiTownNpcMotionNear(a));";
a.equal(html.split(before).length,2);
html=html.replace(before," window.__residentsSubmitted=actors.filter(a=>!a.recessed&&!a.death&&a.y===poiWalkLevel).length;\n"+before);
const s=createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.end(req.url==='/seed'?'<title>Seed</title>':html)});
await new Promise(r=>s.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+s.address().port;let b;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 mkdirSync('actor-horizon-shots',{recursive:true});
 for(const [name,x,z,yaw] of [['sacred-forest',24,115,Math.PI],['rievel',41,43,Math.PI]]){
  const c=await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:.86,isMobile:true,hasTouch:true});
  const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(url+'/seed');await p.evaluate(({x,z,yaw})=>localStorage.setItem('world-workshop-resume-v1',JSON.stringify({
   version:1,route:'facility',id:'base',play:true,position:{x,z,y:0,facing:0},townLayout:5,townMapHeight:182,templeDepth:1,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:yaw,orbitPitch:.26,orbitDistance:5.3}
  })),{x,z,yaw});
  await p.goto(url+'/?resume=1&test=1',{waitUntil:'domcontentloaded'});
  await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:45000});
  await p.waitForFunction(()=>window.__editorTest.actorHorizonQA().beyond>8);
  const t=await p.evaluate(()=>window.__editorTest.actorHorizonQA());console.log(name,t,errors);
  a.deepEqual(t.pos,[x,z]);a.equal(t.has48,true);a.equal(t.beyondSubmitted,0);a.equal(t.gl,0);a.deepEqual(errors,[]);
  if(name==='sacred-forest')a.equal(t.stream,false);
  else a(t.near>0&&t.submitted>0);
  await p.screenshot({path:'actor-horizon-shots/'+name+'.png'});await c.close();
 }
}finally{await b?.close();await new Promise(r=>s.close(r))}
