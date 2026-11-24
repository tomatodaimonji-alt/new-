import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {Script} from 'node:vm';
let h=readFileSync(process.argv[2]||'world-editor.html','utf8');
const sub=(a,b)=>{assert.equal(h.split(a).length,2,a);h=h.replace(a,b)};
const exp="if(facilityParams.get('test')==='1')window.__editorTest={";
sub(exp,exp+`
 sceneryQA:{
  state:()=>{
   const p=parameters(),s=facilitySite,b=s?.davidTemple?.boss,a=poiCompanionActor;
   const actors=poiTownNpcActors.map(a=>({id:a.role.id,x:a.x,z:a.z,y:a.y}))
    .filter(a=>a.y===poiWalkLevel).map(a=>({...a,visible:poiOverlandActorVisible(p.vp,a.x,a.z,a.y),
      support:!!(poiOverlandGroundDrawn.get(s.id+':'+(a.x>>3)+','+(a.z>>3))?.[a.z&7]&(1<<(a.x&7))),
      legacy:Math.abs(a.x-poiWalkViewX)<=34&&Math.abs(a.z-poiWalkViewZ)<=34||
        poiOverlandBoxVisible(p.vp,[a.x-1.2,-1.4,a.z-1.2,a.x+2.2,4.3,a.z+2.2])}));
   return {x:poiWalkX,z:poiWalkZ,yaw:p?.eye,id:s?.id,stream:poiOverlandDrawing,inside:poiSacredInteriorPlayer(),peek:poiWalkActive&&!pineAIActive&&poiSacredTunnelPresentation(s,poiWalkViewX,poiWalkViewZ,poiWalkLevel),
    actualBoss:!!b&&poiSacredInteriorHostileVisible(b),bossDraws:window.__templeHostileDraws??0,
    ally:a?.id??null,allyMesh:poiCompanionWorldActor===a?(poiCompanionMesh?.count??0):0,actors,
    actualActors:window.__townRenderedIds??[],
    submits:[...poiOverlandGroundDrawn.keys()],allocated:poiOverlandInspect().bytes,
    interiorDraws:window.__templeFloorDraws??0,interiorMeshes:poiSacredInteriorVbo?.draws.length??0,
    warm:poiOverlandInspect().maxBakeMs};
  },
  pixelProbe:()=>{
   if(!poiOverlandDrawing||!poiOverlandDrawn.length)return null;
   const p=parameters(),active=facilitySite.id,w=gl.drawingBufferWidth,h=gl.drawingBufferHeight;
   const frames=[],now=performance.now(),drawn=poiOverlandDrawn;
   const oldClear=gl.getParameter(gl.COLOR_CLEAR_VALUE);
   const capture=(age,floorOnly)=>{
    gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    for(const o of drawn){
     const vp=poiOverlandNeighborVP(p.vp,active,o.id);
     const player=poiOverlandLocal(o.id,...poiOverlandGlobal(active,poiWalkViewX,poiWalkViewZ));
     if(floorOnly){draw(o.m,vp,0,o.m.propsFirst);continue}
     poiStreamPropDraw({...o.m,revealBorn:now-age},vp,player[0]+.5,player[1]+.5,now);
    }
    const buf=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,buf);return buf;
   };
   try{
    const floor=capture(0,true),start=capture(0,false),mid=capture(275,false),full=capture(550,false);
    let total=0,added=0,partial=0,clearLost=0;
    const e=(a,b,i)=>Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])+Math.abs(a[i+3]-b[i+3]);
    for(let i=0;i<full.length;i+=4){
     if(floor[i+3]===255&&start[i+3]!==255)clearLost++;
     if(e(start,full,i)>14){total++;if(e(start,mid,i)>14)partial++}
     if(e(floor,full,i)>14)added++;
    }
    return {total,partial,added,clearLost,w,h,error:gl.getError()};
   }finally{gl.clearColor(...oldClear)}
  }
 },`);
sub('if(art===\'monsterStoneDavid\')poiDavidGeometry(part,cx,y,cz,david);',
 "if(art==='monsterStoneDavid'){window.__templeHostileDraws=(window.__templeHostileDraws??0)+1;poiDavidGeometry(part,cx,y,cz,david);}");
sub(' if(inside||peek)for(const m of q.draws)if(poiOverlandBoxVisible(vp,m.bounds))draw(m,vp);',
 ' if(inside||peek)for(const m of q.draws)if(poiOverlandBoxVisible(vp,m.bounds)){window.__templeFloorDraws=(window.__templeFloorDraws??0)+1;draw(m,vp);}');
sub(' const nearActors=actors.filter(a=>!a.recessed', ' window.__townRenderedIds=actors.filter(a=>!a.recessed&&!a.death&&a.y===poiWalkLevel).map(a=>a.role.id);\n const nearActors=actors.filter(a=>!a.recessed');
for(const [,js] of h.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(js);
if(process.env.GRADUAL_SYNTAX_ONLY){console.log('exact anchors and inline syntax');process.exit(0)}
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>Scenery fixture</title>':h)});
await new Promise((r,j)=>server.listen(0,'127.0.0.1',r).once('error',j));
const base='http://127.0.0.1:'+server.address().port;
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
let b;
try{
 b=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 async function load(x,z,yaw){
  const c=await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:.6,isMobile:true,hasTouch:true});
  const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(base+'/seed');
  await p.evaluate(({x,z,yaw})=>{
   const slots=Array(27).fill(null);slots[0]={type:'equipWoodSword',count:1,durability:150};slots[1]={type:'orvasSoul',count:1,durability:550};
   localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weapon:null,potions:0,weaponDurabilityVersion:2,slots,
    companionSoul:{version:1,active:'orvasSoul',mode:'follow',pending:null}}));
   localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,position:{x,z,y:0,facing:0},
    townLayout:5,townMapHeight:182,templeDepth:1,view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,
     third:true,orbitYaw:yaw,orbitPitch:.13,orbitDistance:5.5}}));
  },{x,z,yaw});
  await p.goto(base+'/?resume=1&test=1',{waitUntil:'domcontentloaded'});
  await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:28000});
  const state=()=>p.evaluate(()=>window.__editorTest.sceneryQA.state());
  const until=async(pred,n=32)=>{let s;for(let i=0;i<n;i++){s=await state();if(pred(s))return s;await p.waitForTimeout(100)}throw Error(JSON.stringify({s,errors}));};
  return {c,p,state,until,errors};
 }
 {
  const {c,p,until,errors}=await load(60,133,Math.PI);
  const start=await until(s=>s.stream&&s.submits.length>=4&&s.allyMesh>400);
  assert(!start.inside&&!start.peek&&!start.actualBoss&&start.bossDraws===0&&start.interiorDraws===0);
  assert(start.actors.some(a=>a.legacy&&!a.support),JSON.stringify(start));
  assert(start.actors.filter(a=>!a.support).every(a=>!a.visible&&!start.actualActors.includes(a.id)),JSON.stringify(start));
  const got=await p.evaluate(()=>window.__editorTest.sceneryQA.pixelProbe());
  assert(got&&got.total>=12&&got.partial>=4&&got.partial<got.total&&got.added>=got.total&&got.clearLost===0&&got.error===0,JSON.stringify(got));
  assert(start.allocated<=4*1024*1024);
  assert.deepEqual(errors,[]);console.log('Real streamed floor kept opaque, progressively revealed static pixels and no unsupported actors',JSON.stringify({got,warm:start.warm,allocated:start.allocated,removed:start.actors.filter(a=>a.legacy&&!a.support).length}));
  await c.close();
 }
 {
  const {c,p,until,errors}=await load(24,127,0);
  // The physical central porch submits the dormant original and floor
  // before gameplay admission. Wait for actual visible meshes, not a timer.
  const outside=await until(s=>!s.stream&&s.allyMesh>400&&s.peek&&s.bossDraws>0&&s.interiorDraws>0);
  assert.equal(outside.z,127);assert(!outside.inside&&!outside.actualBoss,JSON.stringify(outside));
  await p.keyboard.press('ArrowUp');
  const inside=await until(s=>s.inside&&s.actualBoss&&s.interiorDraws>outside.interiorDraws);
  assert.equal(inside.z,128);
  assert(inside.bossDraws>0&&inside.interiorMeshes>=1&&inside.allyMesh>400,JSON.stringify(inside));
  assert.deepEqual(errors,[]);console.log('Genuine threshold walk reveals original interior and authored hostile, not allied visibility', JSON.stringify({outside:outside.z,inside:inside.z,meshes:inside.interiorMeshes}));
  await c.close();
 }
}finally{await b?.close();await new Promise(r=>server.close(r))}
