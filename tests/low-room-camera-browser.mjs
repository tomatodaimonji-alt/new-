import a from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {mkdirSync,readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const baseline=process.env.LOW_ROOM_BASELINE==='1';
let h=readFileSync(process.argv[2]??'world-editor.html','utf8');
const add=(u,v)=>{a.equal(h.split(u).length,2,u);h=h.replace(u,v)};
const hook="if(facilityParams.get('test')==='1')window.__editorTest={";
add(hook,hook+`
 lowRoomTest:{
  frame:()=>render(),
  set:(kind,sample=0)=>{
   const b=facilitySite.buildings.find(b=>b.id===kind),boss=facilitySite.davidTemple?.boss,d=b?.entrance??(kind==='davidTemple'&&boss?{x:boss.x,z:boss.z-4}:null);
   if(!b||!d)return false;
   const step=rot2(0,1,b.turn||0);
   const coord=kind==='toolshop'?[b.x1+4,b.z1+6]:kind==='davidTemple'?
    [facilitySite.davidTemple.boss.x,facilitySite.davidTemple.boss.z+4]:
    [d.x+step[0]*(1+sample),d.z+step[1]*(1+sample)];
   const [x,z]=coord;
   if(!workshopResumeRestorePosition({x,z,y:0,facing:2}))return false;
   poiThirdPerson=true;cameraTopDown=false;
   poiCameraYaw=kind==='toolshop'?Math.PI/2:Math.atan2(-step[0],-step[1]);poiCameraPitch=.34;poiCameraDistance=5.5;
   window.__lowRoomBuilding=b;
   if(kind==='davidTemple'){poiMonsterStates.clear();poiMonsterMeshDirty=true;}
   return {id:b.id,door:d,step,coord,bounds:[b.x1,b.x2,b.z1,b.z2],
    counter:world.find(o=>o.x===b.x1+5&&o.z===b.z1+6&&o.y===0&&o.type==='counterLuxury')};
  },
  state:()=>{
   const p=window.__lowRoomLastP,b=window.__lowRoomBuilding,y=poiCreekPlayerHeight(performance.now())+poiWalkLevel*1.4,
    x=poiWalkViewX+.5,z=poiWalkViewZ+.5,eye=p.eye,arm=Math.hypot(eye[0]-x,eye[1]-y-1.05,eye[2]-z);
   const foot=poiWorldToScreen(p.vp,x,y+.11,z),head=poiWorldToScreen(p.vp,x,y+1.26,z);
   const realRoom=typeof poiLowRoomCameraFrame!=='undefined'&&poiLowRoomCameraFrame;
   const walls=poiOcclusionFrame.spans??[],draws=window.__lowRoomFadeDraws??[];
   const overlay=!!poiOcclusionFrame.localRoomForeground;
   return {step:[poiWalkX,poiWalkZ],look:[poiWalkViewX,poiWalkViewZ],yaw:poiCameraYaw,requestedPitch:poiCameraPitch,eye,arm,
    actualPitch:Math.atan2(eye[1]-y-1.05,Math.hypot(eye[0]-x,eye[2]-z)),
    portrait:foot&&head?Math.hypot(head.x-foot.x,head.y-foot.y)/canvas.clientHeight:null,
    room:realRoom?.room?.b?.id??null,
    overlay,cellOwner:facilityFloorOwner(poiWalkX,poiWalkZ,poiWalkLevel,true),draws,walls,
    roof:facilityVisibleRoofs().includes(facilitySite.buildings.indexOf(b)),roofDraw:window.__lowRoomRoofDraws?.some(r=>r[0]===facilitySite.buildings.indexOf(b)&&r[1]>0)??false,
    rearOnly:walls.every(([start,end])=>sceneMesh.wallFade?.some(w=>w.owner===b.id&&start<=w.start&&end>=w.end)),
    sacred:poiDavidTempleEnclosedAt(facilitySite,poiWalkViewX,poiWalkViewZ,poiWalkLevel),error:gl.getError()};
  }
 },
`);
add(' requestAnimationFrame(render);',' if(!window.__lowRoomManual)requestAnimationFrame(render);');
add(' const p=parameters();poiSkyBackdrop(p);',' const p=parameters();window.__lowRoomLastP=p;window.__lowRoomFadeDraws=[];window.__lowRoomRoofDraws=[];poiSkyBackdrop(p);');
if(!baseline)add('if(local)for(const [start,end] of spans)submit(start,end);',`
  if(local)for(const [start,end] of spans){
   const before=gl.getParameter(gl.DEPTH_WRITEMASK),blend=gl.isEnabled(gl.BLEND);
   window.__lowRoomFadeDraws?.push([start,end,before,blend]);
   submit(start,end);
  }`);
add('   else draw(facilityRoofMeshes[i],vp);','   else {window.__lowRoomRoofDraws?.push([i,facilityRoofMeshes[i].count]);draw(facilityRoofMeshes[i],vp)}');
for(const [,s] of h.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(s);
if(process.env.LOW_ROOM_PARSE_ONLY)process.exit(0);
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
 await p.goto(origin+'/?facility=base&facility-play=1&test=1');await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:30000});
 await p.clock.pauseAt(await p.evaluate(()=>Date.now()+3300));
 await p.evaluate(()=>window.__lowRoomManual=true);
 const frame=async(ms=0)=>{if(ms)await p.clock.fastForward(ms);await p.evaluate(()=>window.__editorTest.lowRoomTest.frame())};
 const read=()=>p.evaluate(()=>window.__editorTest.lowRoomTest.state());
 const stage=async(id,sample)=>p.evaluate(([id,s])=>window.__editorTest.lowRoomTest.set(id,s),[id,sample]);
 const capture=async(name)=>{
  if(process.env.FACILITY_SCREENSHOTS){mkdirSync(process.env.FACILITY_SCREENSHOTS,{recursive:true});
   await p.screenshot({path:process.env.FACILITY_SCREENSHOTS+'/'+(baseline?'baseline-':'candidate-')+name+'.png'})}
 };
 const toolshop=await stage('toolshop');a(toolshop?.counter,'live authored shop checkout furnishing');
 await frame(160);const counter=await read();await capture('toolshop-counter');
 const home=await stage('cottage');a(home);await frame(160);
 const trace=[await read()];
 const sample=async()=>{for(const t of [22,35,45,70]){await frame(t);trace.push(await read())}};
 for(let i=0;i<5;i++){await p.keyboard.press('ArrowUp');await sample()}
 a(trace.some(q=>q.cellOwner!==null),'actual keys enter cottage');await capture('cottage-inside');
 const entering=trace.length;
 for(let i=0;i<6;i++){await p.keyboard.press('ArrowDown');await sample()}
 a(trace.slice(entering).some(q=>q.cellOwner===null&&q.step[1]>home.door.z),'actual keys exit to walkway');
 await capture('cottage-exterior');
 const temple=await stage('davidTemple');a(temple);await frame(160);
 const sacred=await read();a(sacred.sacred&&sacred.room===null&&sacred.walls.length===0,'high Orvas room has no ordinary slice');
 const people=[counter,...trace,sacred];
 a(people.every(q=>q.error===0));
 if(!baseline){
  a.equal(counter.room,'toolshop');a(counter.overlay&&counter.draws.length>0,JSON.stringify(counter));a(counter.roof&&counter.roofDraw,'shop roof remains authored and submitted opaque');
  a(counter.portrait!==null&&counter.portrait<.80,JSON.stringify(counter));
  a(trace.some(q=>q.room==='cottage'&&q.roof),'cottage roof is not removed at actual entry');
  a(trace.filter(q=>q.room===null).every(q=>q.walls.length===0),'no new street cutaways');
  a(trace.filter(q=>q.room).every(q=>q.yaw===trace[0].yaw&&q.eye[1]<2.8&&q.rearOnly&&JSON.stringify(q.draws.map(v=>v.slice(0,2)))===JSON.stringify(q.walls)&&q.draws.every(v=>v[2]===false&&v[3]===true)),
   'stable yaw and only the admitted local foreground ranges actually submitted');
 }
 console.log(JSON.stringify({baseline,counter,home,trace,sacred}));
 a.deepEqual(errors,[]);
}finally{await b?.close();await new Promise(r=>server.close(r))}
