import a from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync} from 'node:fs';
import {Script} from 'node:vm';
let h=readFileSync(process.argv[2]??'world-editor.html','utf8');
const rep=(s,t)=>{a.equal(h.split(s).length,2,s);h=h.replace(s,t)};
const api="if(facilityParams.get('test')==='1')window.__editorTest={";
rep(api,api+`
  portableTest:{
   frame:()=>render(),
   equip:()=>{poiMonsterStates.clear();poiCombatLockReset();return poiEquippedWeapon()==='equipOrvasHead'},
   cam:(mode,angle=0)=>{
    const d=poiOrvasPlayerBeam?.d;
    if(!d)return;
    poiThirdPerson=mode==='orbit';cameraTopDown=false;
    poiCameraYaw=Math.atan2(-d.x,-d.z)+angle;
    poiCameraPitch=.10;poiCameraDistance=4.3;
   },
   shot:()=>({start:poiWalkActionStarted,loaded:!!poiOrvasPlayerBeam,t:performance.now(),wear:poiInventorySlots(poiHotbarRead())[2]?.durability,
    sockets:poiWalkMesh?.orvasEyeSockets,gpu:poiOrvasBeamGpu?.count,canvas:[canvas.width,canvas.height],
    end:poiOrvasPlayerBeam?.rays.map(r=>[r.x,r.z,r.visualEnd]),draw:window.__portableBeamDraw,error:gl.getError()})
  },
`);
rep(' requestAnimationFrame(render);',' if(!window.__portableManual)requestAnimationFrame(render);');
rep('  if(clear>.015)poiOrvasDualTube(m,p[0],p[2],d,0,clear,p[1],p[1]+dy*clear,0,false,false,true);',`
  if(clear>.015){
   const first=m.p.length;
   poiOrvasDualTube(m,p[0],p[2],d,0,clear,p[1],p[1]+dy*clear,0,false,false,true);
   const vertices=[];
   for(let k=first;k<m.p.length;k+=3){
    const q=m.p.slice(k,k+3);
    if(Math.abs((q[0]-p[0])*d.x+(q[2]-p[2])*d.z)<1e-6&&!vertices.some(v=>v.every((x,j)=>x===q[j])))vertices.push(q);
   }
   m.eyeRings??=[];m.eyeRings.push(vertices);
  }`);
rep('  if(m.p.length)poiOrvasBeamGpu=upload(m,poiOrvasBeamGpu?.buf??null,gl.DYNAMIC_DRAW);',`
  if(m.p.length){poiOrvasBeamGpu=upload(m,poiOrvasBeamGpu?.buf??null,gl.DYNAMIC_DRAW);poiOrvasBeamGpu.eyeRings=m.eyeRings;}`);
rep(' try{draw(poiOrvasBeamGpu,vp)}',`
 try{
  draw(poiOrvasBeamGpu,vp);
  window.__portableBeamDraw={rings:poiOrvasBeamGpu.eyeRings,vp:Array.from(vp),
    depth:gl.isEnabled(gl.DEPTH_TEST),fn:gl.getParameter(gl.DEPTH_FUNC),less:gl.LESS};
 }`);
for(const [,s] of h.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(s);
if(process.env.PORTABLE_EYE_PARSE_ONLY)process.exit();
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>seed</title>':h)});
await new Promise((r,j)=>server.listen(0,'127.0.0.1',r).once('error',j));
const origin='http://127.0.0.1:'+server.address().port;
let b;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const p=await b.newPage({viewport:{width:1100,height:500},isMobile:true,hasTouch:true,deviceScaleFactor:1});
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.clock.install({time:new Date('2026-04-01T10:00:00Z')});
 await p.goto(origin+'/seed');
 await p.evaluate(()=>{
  const slots=Array(27).fill(null);slots[0]={type:'equipWoodSword',count:1,durability:30};slots[2]={type:'equipOrvasHead',count:1,durability:50};
  localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weapon:'equipOrvasHead',weaponDurabilityVersion:2,slots,potions:0}));
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,position:{x:111,z:60,y:0,facing:1},
   townLayout:5,townMapHeight:182,templeDepth:1,view:{yaw:0,zoom:1,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:0,orbitPitch:.2,orbitDistance:6.7}}));
 });
 await p.goto(origin+'/?resume=1&test=1');await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:30000});
 await p.clock.pauseAt(await p.evaluate(()=>Date.now()+3300));
 await p.evaluate(()=>window.__portableManual=true);
 a(await p.evaluate(()=>window.__editorTest.portableTest.equip()));
 const frame=async(ms=0)=>{if(ms)await p.clock.fastForward(ms);await p.evaluate(()=>window.__editorTest.portableTest.frame())};
 const read=()=>p.evaluate(()=>window.__editorTest.portableTest.shot());
 await frame();const initial=await read();
 const q=await p.locator('#poiWalkAction').boundingBox();a(q);await p.touchscreen.tap(q.x+q.width/2,q.y+q.height/2);
 let firing=await read();a(firing.start>initial.start);
 await frame(437);firing=await read();a(firing.loaded&&firing.wear===initial.wear-1,JSON.stringify(firing));
 const sample=async(name,mode,angle)=>{
  await p.evaluate(([m,u])=>window.__editorTest.portableTest.cam(m,u),[mode,angle]);await frame();
  const q=await read(),d=q.draw;
  a(q.gpu>30&&q.error===0&&d.depth&&d.fn===d.less,JSON.stringify(q));
  a.equal(d.rings.length,2);
  const project=p=>{const m=d.vp,w=p[0]*m[3]+p[1]*m[7]+p[2]*m[11]+m[15];return [(p[0]*m[0]+p[1]*m[4]+p[2]*m[8]+m[12])/w,(p[0]*m[1]+p[1]*m[5]+p[2]*m[9]+m[13])/w]};
  for(const [i,r] of d.rings.entries()){
   a.equal(r.length,6);
   const center=[0,1,2].map(k=>r.reduce((n,p)=>n+p[k]/r.length,0));
   a(Math.hypot(...center.map((v,k)=>v-q.sockets[i][k]))<1e-8);
   const p=project(q.sockets[i]),u=project(center);
   a(p.every(v=>Math.abs(v)<1)&&Math.hypot(u[0]-p[0],u[1]-p[1])<1e-8,JSON.stringify(p));
  }
  if(process.env.FACILITY_SCREENSHOTS){mkdirSync(process.env.FACILITY_SCREENSHOTS,{recursive:true});await p.screenshot({path:process.env.FACILITY_SCREENSHOTS+'/'+name+'.png'})}
  console.log(name,JSON.stringify({sockets:q.sockets,points:q.gpu,eyeScreen:q.sockets.map(project),end:q.end}));
  return q;
 };
 const front=await sample('front-third','orbit',.05);
 await frame(295);
 const angled=await sample('angle-third-lowering','orbit',.8);
 a(Math.abs(front.sockets[0][1]-angled.sockets[0][1])>.025,'socket really moved with the lowering hand');
 a.deepEqual(front.end,angled.end,'committed physical marks do not follow the hand');
 await sample('real-oblique-mode','oblique',0);
 a.deepEqual(errors,[]);
}finally{await b?.close();await new Promise(r=>server.close(r))}
