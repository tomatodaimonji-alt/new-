const a=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs'),{createServer}=require('node:http');
const mark="if(facilityParams.get('test')==='1')window.__editorTest={";
let html=fs.readFileSync('world-editor.html','utf8');
a.equal(html.split(mark).length,2);
html=html.replace(mark,mark+`
 qa389:{
  ready:()=>facilitySite?.id==='frontier'&&poiWalkActive,
  camera:(target,desired)=>{
   poiHomeCameraArmState=null;
   const b=frontierHomeInteriorAt(facilitySite,target[0],target[2]);
   return {home:b?.id,desired,eye:facilitySharedWallCameraEye(target,desired),rows:frontierHomeCameraRows(facilitySite,target,desired).length};
  },
  furniture:()=>{
   const b=facilitySite.buildings.find(b=>b.id==='frontierHouse'),p=frontierBedPose({x:44,z:22,y:0,facing:2});
   const f=b.furniture.find(([x,z,k])=>k==='cot'),[x,z]=frontierFurniturePosition(b,f[0],f[1],f[2],f[4]);
   return {head:z+frontierFurnitureFootprint('cot')[1],wall:b.z1+.35,sleepAt:p.z+.5,bedAt:z,
    blocked:!frontierHouseSafePoint(x-.5,z-.5),door:frontierHouseSafePoint(b.door.x,b.door.z)};
  },
  benches:()=>world.filter(o=>o.type==='benchWood').map(o=>{
   const mesh3=mesh();deco(mesh3,o.type,0,0,0,o.rot);
   const arr=mesh3.p.filter((_,i)=>i%3===0);
   return {x:o.x,z:o.z,rot:o.rot,width:Math.max(...arr)-Math.min(...arr)};
  }),
  route:(x,z,tx,tz)=>{
   poiTownNpcActors.forEach(n=>n.recessed=true);poiMonsterStates.clear();
   if(!workshopResumeRestorePosition({x:tx,z:tz,y:0,facing:2}))throw Error('bad route goal');
   const follower={id:'human:frontierren',x,z,y:0,px:x,pz:z,freeFollows:true};
   const player={x:tx,z:tz,y:0},now=performance.now()+200,stop=1.55;
   const scope=poiCompanionNavScope(follower,player);
   if(!scope)throw Error('missing route scope');
   poiCompanionSharedNavReady=0;
   const direct=poiCompanionNavGroundClear(follower,{x,z},player);
   const first=poiCompanionNavLeg(follower,player,{x,z},now,stop,scope,true);
   const path=follower.localDetour?.path.map(p=>({...p}))||[];
   follower.freeAt=now-16;
   for(let j=0;j<170;j++)poiCompanionAdvance(follower,player,now+j*32,stop);
   return {direct,first,path,end:poiCompanionPosition(follower)};
  },
  speed:()=>{
   const speed=dist=>frontierFollowSpeed({id:'human:frontiersera',x:poiWalkX+dist,z:poiWalkZ,freeFollows:true});
   return {far:speed(8),near:speed(1.8),mid:speed(3.8),player:1/poiChapelStepMs(poiWalkX,poiWalkZ)};
  }
 },
`);
const server=createServer((_,r)=>{r.setHeader('Content-Type','text/html;charset=utf-8');r.end(html)});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let b;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true});const errors=[];
 p.setDefaultTimeout(12000);p.on('pageerror',e=>{errors.push(e.message);console.log(e.stack)});
 await p.goto('http://127.0.0.1:'+server.address().port+'/?test=1',{waitUntil:'domcontentloaded'});
 await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:35000});
 await p.waitForFunction(()=>window.__editorTest?.qa389.ready());
 const run=(name,...args)=>p.evaluate(([name,args])=>window.__editorTest.qa389[name](...args),[name,args]);
 const inside=await run('camera',[43.57,1.1,24.1],[43,2.2,27.5]);
 a.equal(inside.home,'frontierHouse');a.deepEqual(inside.eye,inside.desired);
 const outside=await run('camera',[42,1.1,24],[47,2.6,24]);
 a(!outside.home&&outside.rows>0&&outside.eye[0]>42.2&&outside.eye[0]<43);
 a(Math.abs((outside.eye[1]-1.1)/(outside.eye[0]-42)-.3)<1e-5);
 const doorway=await run('camera',[46.5,1.1,26.95],[46.5,2.3,30.2]);
 a.equal(doorway.home,'frontierHouse');a.deepEqual(doorway.eye,doorway.desired);
 const f=await run('furniture');
 a(f.head-f.wall<.005&&f.head-f.wall>=0&&f.bedAt===f.sleepAt&&f.blocked&&f.door,JSON.stringify(f));
 a.deepEqual((await run('benches')).map(b=>[b.x,b.z,b.rot,Math.round(b.width*100)]),[[46,32,2,134],[44,27,0,134]]);
 const s=await run('speed');a(s.far===s.player&&s.near<s.mid&&s.mid<s.far);
 const q=await run('route',35,23,38,25);
 console.log('Route around shop:',JSON.stringify(q));
 a(!q.direct&&q.path.some(p=>p.x===38&&p.z===26)&&q.end.x>36.55&&q.end.z>=24.6);
 a.deepEqual(errors,[]);
 console.log('PASS wall-side camera, attached furniture and bed pose, plaza bench mesh and orientation, ally speeds and shop-door detour');
}finally{await b?.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
