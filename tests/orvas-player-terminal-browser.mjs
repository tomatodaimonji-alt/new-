import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
let h=readFileSync(process.argv[2]??'world-editor.html','utf8');
const install=(a,b)=>{assert.equal(h.split(a).length,2,a);h=h.replace(a,b)};
const matchedPower=h.includes('const POI_ORVAS_JUDGMENT_POWER=46;');
const mark="if(facilityParams.get('test')==='1')window.__editorTest={";


install(mark,`
 window.__orvas={
  frame:()=>render(),
  straightAxes:()=>{
   const a=poiOrvasPlayerBeam,verts=window.__orvasBeamVertices;
   if(!a||!verts||!poiOrvasBeamGpu)return null;
   const d=a.d;
   return a.rays.map(r=>{
    const rows=new Map(),end=r.visualEnd??r.visualLimit,final=r.visualHeight??r.h;
    for(let i=0;i<verts.length;i+=3){
     const x=verts[i]-r.x-.5,z=verts[i+2]-r.z-.5;
     const drift=x*d.z-z*d.x;if(Math.abs(drift)>.125)continue;
     const at=x*d.x+z*d.z,k=at.toFixed(5),pair=rows.get(k)??[at,Infinity,-Infinity];
     pair[1]=Math.min(pair[1],verts[i+1]);pair[2]=Math.max(pair[2],verts[i+1]);rows.set(k,pair);
    }
    const values=[...rows.values()];
    return {n:values.length,first:Math.min(...values.map(r=>r[0])),last:Math.max(...values.map(r=>r[0])),
     drop:r.h-final,end,error:Math.max(...values.map(([at,lo,hi])=>Math.abs((lo+hi)*.5-(r.h+(final-r.h)*at/end))))};
   });
  },
  verifyStripes:()=>{
   const a=poiOrvasPlayerBeam,rs=a?.rays;if(!rs?.length)return null;
   const d=a.d,g=poiOrvasBeamGpu,x=(rs[0].x+rs[1].x)*.5+.5,z=(rs[0].z+rs[1].z)*.5+.5;
   return (function(s,g,origin,dir,mid,span){
 if(!g?.buf)return null;
 const prev=gl.getParameter(gl.FRAMEBUFFER_BINDING),view=gl.getParameter(gl.VIEWPORT),depth=gl.isEnabled(gl.DEPTH_TEST);
 const f=gl.createFramebuffer(),tex=gl.createTexture(),n=64;
 gl.bindTexture(gl.TEXTURE_2D,tex);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,n,n,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
 gl.bindFramebuffer(gl.FRAMEBUFFER,f);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);
 try{
  gl.viewport(0,0,n,n);gl.disable(gl.DEPTH_TEST);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
  const dx=dir.x,dz=dir.z,x=origin.x,z=origin.z,sideSpan=.42;
  const vp=new Float32Array([dx/span,dz/sideSpan,0,0,0,0,0,0,dz/span,-dx/sideSpan,0,0,
   -(dx*x+dz*z+mid)/span,-(dz*x-dx*z)/sideSpan,0,1]);
  draw(g,vp,0,g.coreCount??g.count);
  const data=new Uint8Array(n*n*4);gl.readPixels(0,0,n,n,gl.RGBA,gl.UNSIGNED_BYTE,data);
  let left=0,right=0,center=0,maxL=0,maxR=0;
  for(let j=0;j<n;j++)for(let i=10;i<54;i++){
   const k=(j*n+i)*4;if(!data[k+3]||data[k]<30)continue;
   const y=(j/n*2-1)*sideSpan;
   if(y<-.055){left++;maxL=Math.max(maxL,data[k]);}
   if(y>.055){right++;maxR=Math.max(maxR,data[k]);}
   if(Math.abs(y)<.039)center++;
  }
  return {left,right,center,maxL,maxR,error:gl.getError()};
 }finally{
  gl.bindFramebuffer(gl.FRAMEBUFFER,prev);gl.viewport(...view);
  if(depth)gl.enable(gl.DEPTH_TEST);
  gl.deleteTexture(tex);gl.deleteFramebuffer(f);
 }
})(null,g,{x,z},d,.93,.53);
  },
  stage:(index,mode)=>{
   window.__orvasEmptyMaterial=mode==='grass'||mode==='soil';
   const b=facilitySite.davidTemple.boss;
   if(mode==='grass'||mode==='soil'){
    const kind=t=>mode==='grass'?/^(grass|moss|roadGrass)/i.test(t):/^(earth|sand|soil|roadDirt|roadGravel)/i.test(t);
    let found=false;
    for(const o of world){
     if(o.y!==0||o.z<82||o.x<42||!isFloor(o.type)||!kind(o.type))continue;
     const x=o.x-3,z=o.z,q={kind:'sweep',sx:x,sz:z,dx:1,dz:0,y:0};
     const e=poiOrvasTraceEvent(q,'sweep',0);e.radius=5;
     const floor=poiOrvasTraceGround(q,e,null);
     if(!floor(x+2.85,z)||floor.material(x+2.85,z)!==mode)continue;
     if(workshopResumeRestorePosition({x,z,y:0,facing:1})){found=true;break}
    }
    if(!found)return false;
   }else if(!workshopResumeRestorePosition({x:b.x+(mode==='wall'?-12:0),z:b.z+(mode==='wall'?3:4),y:b.y,facing:mode==='wall'?3:1}))return false;
   poiMonsterStates.clear();poiCombatLockReset();
   return poiEquipHotbarItem(index)?.ok;
  },
  addTargets:targets=>{
   const list=targets.map(([x,z,y])=>{
    const b=facilitySite.davidTemple.boss;
    const o={x:x+b.x-24,z:z+b.z-104,y,type:'monsterSlime',rot:0},s=poiCombatActorMake(o);s.hp=100;s.townOwned=true;
    poiMonsterStates.set(o,s);return s;
   });
   window.__orvas.targets=list;poiMonsterMeshDirty=true;
  },
  state:()=>{
   const k=poiHotbarRead(),slots=poiInventorySlots(k),weapon=poiEquippedWeapon(),a=poiPlayerWeaponPending;
   const beam=poiOrvasPlayerBeam;
   return {weapon,ready:poiAttackReady,clock:performance.now(),pending:!!a,cursor:a?.orvasCursor,
    used:slots.find(c=>c?.type===weapon)?.durability,hp:window.__orvas.targets?.map(s=>s.hp),
    beam:beam?{rays:beam.rays,draw:!!poiOrvasBeamGpu}:null,start:poiWalkActionStarted,
    marks:poiOrvasGroundTraces.filter(e=>e.player).map(e=>({kind:e.kind,start:e.start,x:e.x,z:e.z,tiles:e.cells.size,surfaces:[...e.cells].map(k=>k.split(':')[0]),points:e.parts.reduce((n,m)=>n+m.p.length/3,0),grass:e.parts.some(m=>m.c.some((c,i)=>i%3===0&&c===.18&&m.c[i+1]===.16)),soil:e.parts.some(m=>m.c.some((c,i)=>i%3===0&&c===.20&&m.c[i+1]===.112))})),
    draws:window.__orvasPlayerTraceDraws??[],
    surfaceTargets:window.__orvasEmptyMaterial?poiAimTargetList(poiAimOrigin(performance.now()),6,performance.now()).map(t=>[t.id.type,t.x,t.z,t.state.hp]):null,
    surfaceHits:window.__orvasSurfaceHits??[],
    name:POI_ORVAS_NAME,items:slots.slice(2,5).map(c=>c?.type)};
  }
 };`+mark);
install('if(m.p.length)poiOrvasBeamGpu=upload(m);','if(m.p.length){window.__orvasBeamVertices=m.p.slice();poiOrvasBeamGpu=upload(m)}');
install(' requestAnimationFrame(render);',' if(!window.__orvasManual)requestAnimationFrame(render);');
// Only isolate the empty-material samples from autonomous spawns. Real
// input, target selection, hit resolution, and weapon wear remain intact.
install('function poiWildSpawnFrame(now,rng=Math.random){','function poiWildSpawnFrame(now,rng=Math.random){if(window.__orvasEmptyMaterial)return;');
install('function poiTownNpcPickTarget(a,now){','function poiTownNpcPickTarget(a,now){if(window.__orvasEmptyMaterial)return null;');
const damage='function poiPlayerDamageTarget(monster,x,z,amount,weapon,now,silent=false,atContact=false,source=null){';
install(damage,damage+'if(window.__orvasEmptyMaterial)(window.__orvasSurfaceHits??=[]).push({x,z,amount,weapon});');

install('  draw(poiOrvasGroundGpu,vp,start,count);',`
  draw(poiOrvasGroundGpu,vp,start,count);
  if(e.player){const a=window.__orvasPlayerTraceDraws??=[];if(!a.some(d=>d.kind===e.kind&&d.start===e.start))a.push({kind:e.kind,start:e.start,count})}
`);
for(const [,js] of h.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(js);
if(process.env.ORVAS_NATIVE_PARSE_ONLY){console.log('Orvas weapons actual browser fixture parses');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const srv=createServer((q,r)=>{r.setHeader('Content-Type','text/html; charset=utf-8');r.end(q.url==='/seed'?'<title>Seed</title>':h)});
await new Promise(r=>srv.listen(0,'127.0.0.1',r));
const root='http://127.0.0.1:'+srv.address().port;let browser;
try{
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});

 const ctx=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:.65});
 const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(18000);
 await p.goto(root+'/?facility=base&facility-play=1&test=1',{waitUntil:'domcontentloaded'});
 await p.locator('#pineStartupCover').waitFor({state:'hidden'});
 const read=()=>p.evaluate(()=>window.__orvas.state());
 const keys=['equipOrvasHead','equipOrvasGreatsword','equipOrvasTwinGreatswords'];
 assert(!(await read()).items.some(x=>keys.includes(x)));
 await p.locator('#poiLandscapeMenuToggle').click();await p.locator('[data-landscape-action="reset"]').click();
 await p.locator('#poiResetGameDialog').waitFor({state:'visible'});
 await Promise.all([p.waitForURL(/reset-camera=1/),p.locator('#poiResetGameConfirm').click()]);
 await p.locator('#pineStartupCover').waitFor({state:'hidden'});
 await p.clock.install({time:new Date('2026-04-01T10:00:00Z')});
 await p.clock.pauseAt(await p.evaluate(()=>Date.now()+175));
 await p.evaluate(()=>{window.__orvasManual=true});
 const frame=async(ms=35)=>{await p.clock.fastForward(ms);await p.evaluate(()=>window.__orvas.frame());};
 const until=async(check,limit=65)=>{let q=await read();for(let i=0;i<limit&&!check(q);i++){await frame();q=await read()}assert(check(q),JSON.stringify(q));return q};
 const start=async(i,targets,mode)=>{
  await until(q=>q.clock>=q.ready&&!q.pending);
  assert(await p.evaluate(i=>window.__orvas.stage(i[0],i[1]),[i,mode]));
  const q=await read();assert.equal(q.weapon,keys[i-2]);assert(q.used>0);
  const b=await p.locator('#poiWalkAction').boundingBox();assert(b);
  await p.touchscreen.tap(b.x+b.width/2,b.y+b.height/2);
  const held=await until(v=>v.pending&&v.start>=q.clock);
  await p.evaluate(t=>window.__orvas.addTargets(t),targets);
  assert(!held.marks.some(e=>e.start>=held.start),'unreleased weapon does not paint its warning');
  return {q,held};
 };
 assert.deepEqual((await read()).items,keys);
 assert.equal((await read()).name,'オルヴァス');
 let {q,held}=await start(2,[[32,108,0],[34,108,0]]);
 let landed=await until(v=>!v.pending&&v.beam?.draw);
 assert(landed.clock-held.start>=420);
 assert.deepEqual(landed.hp,[52,100]);assert.equal(landed.used,q.used-1);
 const paint=(s,kind,at)=>s.marks.filter(e=>e.kind===kind&&e.start>=at&&s.draws.some(d=>d.start===e.start&&d.count>0));
 const behind=paint(landed,'beam',held.start);
 assert.equal(behind.length,1,'real terrain beyond first target receives one two-tip mark event');
 assert(landed.beam.rays.every(r=>r.groundDrop&&r.groundDrop.at>r.end+2&&r.groundDrop.at<r.visualLimit),
  JSON.stringify(landed.beam.rays));
 const checkAxes=async(minDrop)=>{
  const axes=await p.evaluate(()=>window.__orvas.straightAxes());
  assert(axes?.length===2&&axes.every(a=>a.n>=3&&a.drop>minDrop&&Math.abs(a.first)<.0001&&Math.abs(a.last-a.end)<.0001&&a.error<.0001),JSON.stringify(axes));
  return axes;
 };
 const enemyAxes=await checkAxes(.25);
 const firstStrike=landed.hp.slice();await frame(150);assert.deepEqual((await read()).hp,firstStrike,'no follow-up HP loss from visual continuation');
 ({q,held}=await start(2,[],'wall'));
 landed=await until(v=>!v.pending&&v.beam?.draw);
 const markWall=paint(landed,'beam',held.start),wallDrops=landed.beam.rays.filter(r=>r.groundDrop);
 assert.equal(markWall.length,1,'the actual struck surface receives one paired mark event');
 const wallHits=landed.beam.rays.filter(r=>r.wallImpact>0);
 assert(wallHits.length===1&&wallDrops.length===1,'the exact corner independently lands one eye on wall and the other on floor '+JSON.stringify(landed.beam.rays));
 assert(wallHits.every(r=>r.visualEnd<r.wallImpact&&!r.groundDrop)&&wallDrops.every(r=>r.groundDrop.h<r.h&&r.groundDrop.at<r.visualLimit&&!r.wallImpact));
 assert(markWall[0].surfaces.includes('wall')&&markWall[0].surfaces.includes('floor'));
 const stripes=await p.evaluate(()=>window.__orvas.verifyStripes());
 assert(stripes&&stripes.left>35&&stripes.right>35&&stripes.center===0&&stripes.error===0,JSON.stringify(stripes));
 const cornerAxes=await checkAxes(.045);
 console.log('Actual portable split GPU stripe and straight uploaded axes',JSON.stringify({stripes,enemyAxes,cornerAxes}));
 ({q,held}=await start(2,[]));
 landed=await until(v=>!v.pending&&v.beam?.draw);
 const marks=paint(landed,'beam',held.start),drops=landed.beam.rays.filter(r=>r.groundDrop);
 assert.equal(marks.length,1);assert(marks[0].tiles>=1&&marks[0].tiles<=2);
 assert(drops.length===2&&drops.every(r=>r.groundEligible&&r.groundDrop.at<=r.end&&r.groundDrop.at>r.end-1.25));
 for(const r of drops)assert(r.h>r.groundDrop.h+.1&&r.visualEnd===r.groundDrop.at&&r.visualHeight===r.groundDrop.h);
 assert(landed.beam.rays.length===2&&landed.beam.rays[0].z!==landed.beam.rays[1].z);
 ({q,held}=await start(3,[[28,108,0],[26,111,0],[23,108,0]]));
 landed=await until(v=>!v.pending);
 assert(landed.clock-held.start>=560);
 assert.deepEqual(landed.hp,[54,54,100]);assert.equal(landed.used,q.used-1);
 assert.equal(paint(landed,'sweep',held.start).length,1,'single sideways sweep leaves its own shallow marks');
 ({q,held}=await start(4,[[27,108,0],[26,111,0],[23,108,0]]));
 const first=await until(v=>v.cursor===1);
 assert(first.clock-held.start>=720);assert.deepEqual(first.hp,[matchedPower?54:72,100,100]);
 assert.equal(paint(first,'double',held.start).length,1);
 landed=await until(v=>!v.pending);
 assert(landed.clock-held.start>=1040);assert.deepEqual(landed.hp,[matchedPower?8:37,100,100]);assert.equal(landed.used,q.used-1);
 const twin=paint(landed,'double',held.start);
 assert.equal(twin.length,2);assert(twin[1].start-twin[0].start>=280);
 assert(Math.hypot(twin[0].x-twin[1].x,twin[0].z-twin[1].z)>.13);
 for(const material of ['grass','soil']){
  ({q,held}=await start(3,[],material));
  const local=await until(v=>!v.pending&&paint(v,'sweep',held.start).length===1);
  assert.deepEqual(q.surfaceTargets,[]);assert.deepEqual(local.surfaceTargets,[]);assert.deepEqual(local.surfaceHits,[]);
  const scar=paint(local,'sweep',held.start)[0];assert(scar[material],JSON.stringify(scar));
  assert.equal(local.used,q.used,'empty cosmetic ground cut does not wear the weapon');
 }
 console.log('Player traces',JSON.stringify({marks,twin}));
 console.log('Physical reset, then all three actual right-button attacks, matched timing, scope and wear',JSON.stringify({first:first.hp,landed:landed.hp}));
 assert.deepEqual(errors,[]);
 await ctx.close();
}finally{await browser?.close();await new Promise(r=>srv.close(r))}
