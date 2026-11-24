import assert from 'node:assert/strict';import {createServer} from 'node:http';import {createRequire} from 'node:module';import {mkdirSync,readFileSync} from 'node:fs';import {Script} from 'node:vm';
let h=readFileSync(process.argv[2]??'world-editor.html','utf8');
function inject(a,b){assert.equal(h.split(a).length,2,a);h=h.replace(a,b)}
const api="if(facilityParams.get('test')==='1')window.__editorTest={";
inject(api,api+`
 giantBarQA:{
  ready:()=>!!poiCompanionActor&&poiCompanionActor.id==='orvasSoul',
  settle:()=>{
   // Camera composition and safe positions only; all body meshes, HUD
   // progress elements and perspective matrices are from the actual game.
   const ax=poiWalkX-1,az=poiWalkZ+6,o=poiCompanionActor;
   o.x=ax;o.z=az;
   o.fromX=ax;o.fromZ=az;
   o.px=ax;o.pz=az;
   o.orvasHeading=Math.PI;
   const before=window.giantActors??=[];
   if(!before.length)for(const [type,x,z] of [['monsterSlime',poiWalkX+2,poiWalkZ+6],['monsterNorthMinotaur',poiWalkX+4,poiWalkZ+8]]){
    const e={type,x,z,y:poiWalkLevel,rot:0},a=poiCombatActorMake(e);
    a.nextAttack=performance.now()+50000;poiMonsterStates.set(e,a);before.push(e);
   }
   window.giantActors=before;poiMonsterMeshDirty=true;poiCompanionMeshKey=null;
  },
  sample:pitch=>{
   poiCameraYaw=0;poiCameraPitch=pitch;poiCameraDistance=11;render();
   const vp=parameters().vp,pose=poiCompanionDrawPose;
   if(!pose)return null;
   const face=mesh(),points=(...v)=>{for(const p of v)if(Array.isArray(p)&&p.length===3)face.p.push(...p)};
   const rig=poiDavidRig(pose.rig);poiDavidFaceMesh((a,b,c)=>points(a,b,c),(a,b,c,d)=>points(a,b,c,d),pose.rig,rig);
   const c=Math.cos(pose.heading),s=Math.sin(pose.heading),box=canvas.getBoundingClientRect();
   let head=Infinity;
   for(let i=0;i<face.p.length;i+=3){
    const [x,y,z]=face.p.slice(i,i+3),q=poiWorldToScreen(vp,pose.x+x*c-z*s,pose.y+poiDavidLeapBodyY(y,rig.leapCrouch),pose.z+x*s+z*c);
    if(q)head=Math.min(head,q.y);
   }
   const ally=document.querySelector('progress.poiCompanionHealth'),r=ally?.getBoundingClientRect();
   const others=(window.giantActors??[]).map(e=>{
    const bar=poiEnemyBars.get(e)?.el,st=poiMonsterStates.get(e),p=poiMonsterPose(e,st,performance.now());
    const prior=poiEnemyHealthAnchor(vp,p,poiEnemyHealthEnvelope(e.type));
    return {type:e.type,actual:bar?.getBoundingClientRect().bottom-box.top,prior:prior?.y-POI_ENEMY_BAR_GAP,max:bar?.max,hp:bar?.value};
   });
   return {head,gap:head-(r?.bottom-box.top),visible:ally&&!ally.hidden,allyHP:ally?.value,allyMax:ally?.max,x:pose.x,z:pose.z,others,gl:gl.getError()};
  }
 },
`);
inject(' requestAnimationFrame(render);',' if(!window.__giantManual)requestAnimationFrame(render);');
for(const [,js] of h.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(js);
if(process.env.GIANT_HP_PARSE_ONLY)process.exit(0);
const {chromium}=createRequire(import.meta.url)('playwright');
const server=createServer((q,r)=>{r.setHeader('Content-Type','text/html; charset=utf-8');r.end(q.url==='/seed'?'<title>seed</title>':h)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
let b,checks=[];
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const c=await b.newContext({viewport:{width:1050,height:480},isMobile:true,hasTouch:true,deviceScaleFactor:.85});
 const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(url+'/seed');
 await p.evaluate(()=>{
  const slots=Array(27).fill(null);slots[0]={type:'equipWoodSword',count:1,durability:70};slots[5]={type:'orvasSoul',count:1,durability:820};
  localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weaponDurabilityVersion:2,weapon:'equipWoodSword',slots,potions:0,gold:17,companionSoul:{version:1,active:'orvasSoul',pending:null,mode:'follow'}}));
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,position:{x:49,z:119,y:0,facing:2},
   townLayout:5,townMapHeight:182,templeDepth:1,view:{yaw:0,zoom:1,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:0,orbitPitch:.3,orbitDistance:11}}));
 });
 await p.goto(url+'/?resume=1&test=1',{waitUntil:'domcontentloaded'});await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:45000});
 await p.waitForFunction(()=>window.__editorTest?.facility?.()?.active,null,{timeout:16000});
 try{await p.waitForFunction(()=>window.__editorTest?.giantBarQA?.ready(),null,{timeout:10000});}
 catch(e){console.log('GIANT BOOT DIAGNOSTIC',JSON.stringify(errors),await p.evaluate(()=>({start:window.pineStartup?.ready,test:Object.keys(window.__editorTest??{}),slot:localStorage.getItem('world-workshop-hotbar-v1')})));throw e}
 await p.evaluate(()=>{window.__giantManual=true;window.__editorTest.giantBarQA.settle()});
 for(const pitch of [-.12,.39]){
  const q=await p.evaluate(pitch=>window.__editorTest.giantBarQA.sample(pitch),pitch);checks.push(q);
  assert(q?.visible&&q.allyHP===820&&q.allyMax===1050&&q.gl===0,JSON.stringify(q));assert(q.gap>=1&&q.gap<17,JSON.stringify(q));
  const slime=q.others.find(o=>o.type==='monsterSlime'),mino=q.others.find(o=>o.type==='monsterNorthMinotaur');
  assert(slime.max>0&&Math.abs(slime.actual-slime.prior)<1,JSON.stringify(q));
  assert(mino.max>slime.max&&mino.actual>mino.prior,JSON.stringify(q));
  if(process.env.FACILITY_SCREENSHOTS){
   mkdirSync(process.env.FACILITY_SCREENSHOTS,{recursive:true});
   await p.screenshot({path:process.env.FACILITY_SCREENSHOTS+'/giant-'+pitch+'.png'});
  }
 }
 assert.deepEqual(errors,[]);console.log('ACTUAL giant crown–bar CSS pixel gap and small parity',JSON.stringify(checks));
}catch(e){console.error(JSON.stringify(checks));throw e}finally{await b?.close();await new Promise(r=>server.close(r))}
