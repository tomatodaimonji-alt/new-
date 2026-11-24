import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {Script} from 'node:vm';
let html=readFileSync(process.argv[2]??'world-editor.html','utf8');
function put(a,b){assert.equal(html.split(a).length,2,a);html=html.replace(a,b)}
const api="if(facilityParams.get('test')==='1')window.__editorTest={";
put(api,api+`
 orvasEdgeQA:{
  status:()=>({active:poiWalkActive,x:poiWalkX,z:poiWalkZ,level:poiWalkLevel,
   authored:facilitySite?.davidTemple?.boss?.z,
   boss:[...poiMonsterStates].some(([o])=>o.type==='monsterStoneDavid'),
   companion:poiCompanionActor?.id??null,slot:poiInventorySlots(poiHotbarRead())[1]?.type??null,
   companionState:poiHotbarRead().companionSoul??null,hasKit:poiHotbarHasKit()}),
  draw:phase=>{
   const found=[...poiMonsterStates].find(([o])=>o.type==='monsterStoneDavid');
   if(!found||!poiCompanionActor)return null;
   const now=performance.now(),d=poiMonsterPose(...found,now),a=poiCompanionWorldPose(poiCompanionActor,now);
   if(!d.david||!a.orvas)return null;
   // Sample real visible meshes at controlled poses without changing AI,
   // clock, world, save, or actual pose positions and headings.
   const pose=phase==='walk'?{phase:'ready',kind:null,walkAmount:1,walkDistance:0}:
    phase==='sweep'?{phase:'impact',kind:'sweep',progress:0,contact:1}:phase==='wake'?
    {phase:'wake',wakeAge:500,kind:null}:{phase:'ready',kind:null,walkAmount:0};
   const models=[['boss',mesh()],['ally',mesh()]];
   window.__orvasIdleEdges=[];
   poiDavidGeometry(models[0][1],d.x,d.y,d.z,{...d.david,...pose});
   poiCompanionOrvasMesh(models[1][1],{...a,rig:{...a.rig,...pose}});
   const sizes=models.map(([label,m])=>{
    const gpu=upload(m);
    if(!gpu?.count)throw Error('missing '+label);
    draw(gpu,parameters().vp);
    gl.deleteBuffer(gpu.buf);
    return gpu.count;
   });
   return {edges:window.__orvasIdleEdges,sizes};
  }
 },`);
put('  const base=ring(.26,.25,.078),taper=ring(2.68,.16,.068);',
 '  const base=ring(.26,.25,.078),taper=ring(2.68,.16,.068);if(window.__orvasIdleEdges?.length<4)window.__orvasIdleEdges.push({edge:taper[2][1]-taper[0][1],face:taper[1][1]-taper[3][1],tip:tip[1]-g[1]});');
for(const [,s] of html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(s);
if(process.env.ORVAS_IDLE_SYNTAX_ONLY){console.log('exact inline browser fixture parses');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const srv=createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.end(req.url==='/seed'?'<title>Seed</title>':html)});
await new Promise((ok,no)=>srv.listen(0,'127.0.0.1',ok).once('error',no));
const base='http://127.0.0.1:'+srv.address().port;let b;
try{
 b=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const p=await b.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:.75}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 await p.goto(base+'/seed');
 await p.evaluate(()=>{
  const slots=Array(27).fill(null);slots[0]={type:'equipWoodSword',count:1,durability:150};slots[1]={type:'orvasSoul',count:1,durability:1050};
  localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weapon:null,weaponDurabilityVersion:2,potions:0,slots,companionSoul:{version:1,active:'orvasSoul',pending:null}}));
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,position:{x:24,z:160,y:0,facing:0},townLayout:5,
   townMapHeight:182,templeDepth:1,view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 });
 await p.goto(base+'/?resume=1&test=1',{waitUntil:'domcontentloaded',timeout:45000});
 await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:35000});
 let status;
 for(let i=0;i<15;i++){
  status=await p.evaluate(()=>window.__editorTest.orvasEdgeQA.status());
  if(status.boss&&status.companion==='orvasSoul')break;
  await p.waitForTimeout(150);
 }
 assert(status?.boss&&status?.companion==='orvasSoul',JSON.stringify({status,errors}));
 const roll=await p.evaluate(()=>{
  const qa=window.__editorTest.orvasEdgeQA;
  return Object.fromEntries(['idle','walk','sweep','wake'].map(phase=>[phase,qa.draw(phase)]));
 });
 for(const phase of ['idle','walk']){
  assert.equal(roll[phase]?.edges.length,4,JSON.stringify(roll));
  assert(roll[phase].sizes.every(n=>n>400));
  for(const blade of roll[phase].edges)assert(blade.edge>.245&&Math.abs(blade.face)<.01&&blade.tip<-1.8,JSON.stringify(roll));
 }
 assert(roll.sweep?.edges.some(b=>Math.abs(b.edge)<.10)&&roll.wake?.edges.every(b=>Math.abs(b.edge)<.10),JSON.stringify(roll));
 assert.deepEqual(errors,[]);
 console.log('Boss and summoned ally both emit the walking bevel direction at idle; attack and extraction keep their slices.',roll);
}finally{await b?.close();await new Promise(ok=>srv.close(ok))}
