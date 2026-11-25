import a from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {Script} from 'node:vm';
const compact=process.env.SEAM_COMPACT==='1';
const nav='/?resume=1&test=1';
let h=readFileSync(process.argv[2]??'world-editor.html','utf8');
a.equal(createHash('sha1').update('blob '+Buffer.byteLength(h)+'\0').update(h).digest('hex'),compact?'38de35ac932dedf396508bced8297e6b73faa090':'8eb39528fc547b877ca72de0f18cc19cbd4cfb23');
const query=h.slice(h.indexOf('function workshopResumePermitted('),h.indexOf('function workshopResumeRead('));
const vm=new Script(query+`workshopResumePermitted(new URLSearchParams(${JSON.stringify(nav.slice(nav.indexOf('?')+1))}));`);
a(vm.runInNewContext({URLSearchParams}),'canonical resume QA query must use unchanged allowlist');
a(!new Script(query+"workshopResumePermitted(new URLSearchParams('resume=1&test=1&seam-roles=1'));").runInNewContext({URLSearchParams}));
const put=(x,y)=>{a.equal(h.split(x).length,2,x);h=h.replace(x,y)};
put(' poiTownClockFrame(now);poiWalkFrame(now);',
    ' if(!poiTownClockSetTest(39))poiTownClockFrame(now);poiWalkFrame(now);');
put('function poiOutdoorMesh(q){','function poiOutdoorMesh(q){const proof={water:[],trees:[]};');
put('  quad(m,[x,y,z],[x,y,z+1],[x1,y,z+1],[x1,y,z],c);\n }\n // Top and side',
    "  if(/^(?:sea|water|lake|river)$/.test(kind))proof.water.push({x,x1,z,y,kind});\n  quad(m,[x,y,z],[x,y,z+1],[x1,y,z+1],[x1,y,z],c);\n }\n // Top and side");
put('  if(/^tree/.test(o.type))poiOutdoorCrown(m,a,o,h);',`  if(/^tree/.test(o.type)){
   const n=m.p.length;poiOutdoorCrown(m,a,o,h);
   if(m.p.length>n){let top=h;for(let i=n+1;i<m.p.length;i+=3)top=Math.max(top,m.p[i]);
    proof.trees.push({x:o.x+.5,z:o.z+.5,y:h,top,type:o.type});}
  }`);
put(' return {m,ground,canopy,bounds:[x0,y0,z0,x1,y1,z1]};',' return {m,ground,canopy,bounds:[x0,y0,z0,x1,y1,z1],proof};');
put('const q=order[i],{m,ground,canopy,bounds}=poiOutdoorMesh(q)', 'const q=order[i],{m,ground,canopy,bounds,proof}=poiOutdoorMesh(q)');
put('{gpu,ground,canopy,bounds,bytes,source:q.a.world}', '{gpu,ground,canopy,bounds,bytes,source:q.a.world,proof}');
put('  if(!groundBuilt||propEnd>e.ground)poiOutdoorProbe.drawn.push({key:q.key,ground:groundBuilt?0:e.ground,props:propEnd-e.ground});', `
  if(!groundBuilt||propEnd>e.ground){
   poiOutdoorProbe.drawn.push({key:q.key,ground:groundBuilt?0:e.ground,props:propEnd-e.ground});
   const v=cam(q),project=([x,y,z])=>{
    const w=v[3]*x+v[7]*y+v[11]*z+v[15];
    const u=(v[0]*x+v[4]*y+v[8]*z+v[12])/w,k=(v[1]*x+v[5]*y+v[9]*z+v[13])/w;
    return w>0&&Math.abs(u)<=1&&Math.abs(k)<=1?[u,k]:null;
   };
   const role=(x,y,z)=>{
    const [wx,wz]=poiOverlandGlobal(q.a.id,x,z);
    return {world:[wx,wz],screen:project([x,y,z]),d:Math.hypot(wx-g[0]-.5,wz-g[1]-.5)};
   };
   (window.__qaRoles??=[]).push({key:q.key,realm:q.a.id,
    water:groundBuilt?[]:e.proof.water.map(o=>({...o,...role((o.x+o.x1)/2,o.y,o.z+.5)})),
    trees:propEnd<=e.ground?[]:e.proof.trees.map(o=>({...o,...role(o.x,o.top*.79+o.y*.21,o.z)}))});
  }`);
put(" if(typeof poiOutdoorLate==='function')poiOutdoorLate(p.vp,stream);",`
 window.__qaRoles=[];window.__qaFrame=(window.__qaFrame??0)+1;
 if(typeof poiOutdoorLate==='function')poiOutdoorLate(p.vp,stream);
 if(window.__qaCrossed&&poiOutdoorFrame){
  window.__qaCrossed=false;window.__qaFirst.push(window.__editorTest.eastQ());
 }
 if(stream&&window.__qaRead){
  const done=window.__qaRead;window.__qaRead=null;
  const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,px=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,px);
  const q=window.__editorTest.eastQ();
  const witness=q.roles.flatMap(r=>r.realm==='base'?r.water.filter(o=>o.screen).map(o=>o.screen):[]);
  let waterSamples=0;for(const [u,v] of witness){const i=(Math.floor((v+1)*h/2)*w+Math.floor((u+1)*w/2))*4;if(px[i+3]>230&&px[i+2]>px[i]+14&&px[i+2]>px[i+1]+12)waterSamples++}
  done({w,h,waterProjected:witness.length,waterSamples,guard:window.__qaGuard});
 }`);
put(' poiSnowPassSwitches++;',` poiSnowPassSwitches++;
 if(!cold){window.__qaFirst??=[];window.__qaCrossed=true;}
`);
const anchor="if(facilityParams.get('test')==='1')window.__editorTest={";
put(anchor,anchor+`
 eastQ:()=>{
  const tags=window.__qaSeamIds??=new WeakMap(),handles=[];const error=gl.getError();if(error)(window.__qaGLErrors??=[]).push(error);
  for(const [key,e]of poiOutdoorCaches)if(e.gpu?.buf){
   const b=e.gpu.buf;if(!tags.has(b))tags.set(b,window.__qaSeamSerial=(window.__qaSeamSerial??0)+1);
   handles.push([key,tags.get(b),e.bytes]);
  }
  return {realm:facilitySite.id,land:[poiWalkX,poiWalkZ],foot:poiOutdoorFrame?.g,stream:poiOverlandDrawing,
   yaw:poiCameraYaw,pitch:poiCameraPitch,dist:poiCameraDistance,view:[poiWalkViewX,poiWalkViewZ],
   selected:typeof poiSeamRolePlan!=='undefined'&&!!poiSeamRolePlan,roles:window.__qaRoles??[],handles,compactHandles:typeof poiSeamRoles==='undefined'?[]:[...poiSeamRoles].map(([k,e])=>{const b=e.gpu.buf;if(!tags.has(b))tags.set(b,window.__qaSeamSerial=(window.__qaSeamSerial??0)+1);return [k,tags.get(b)]}),packed:typeof poiSeamRoleBytes==='undefined'?0:poiSeamRoleBytes,frame:window.__qaFrame??0,ms:performance.now(),near:poiOverlandInspect().bytes,legacy:poiOutdoorFarBytes,added:poiAddGroundBytes,
   detailed:[...poiOverlandGroundDrawn.keys()],ready:performance.now()>=poiWalkNextReady,err:window.__qaGLErrors?.[0]??0};
 },
 eastKey:dx=>['e','w','n','s'].find(k=>{
  const p=poiCameraRelativeStep(k);return p[0]===dx&&p[1]===0;
 }),
 eastFirst:()=>window.__qaFirst??[],
 eastRead:()=>new Promise(r=>{window.__qaRead=r}),
`);
if(compact){
 put('const {m,ground,bounds}=poiSeamRoleMesh(pending),data=', 'const {m,ground,bounds,proof}=poiSeamRoleMesh(pending),data=');
 put('{gpu,bytes,bounds,ground,source:pending.a.world}', '{gpu,bytes,bounds,ground,source:pending.a.world,proof}');
 put('   poiSeamCompactDraw(e.gpu,v,cropped?e.ground:0,count);', `
   poiSeamCompactDraw(e.gpu,v,cropped?e.ground:0,count);
   const pl=(xx,y,zz)=>{
    const w=v[3]*xx+v[7]*y+v[11]*zz+v[15],u=(v[0]*xx+v[4]*y+v[8]*zz+v[12])/w,k=(v[1]*xx+v[5]*y+v[9]*zz+v[13])/w;
    const [wx,wz]=poiOverlandGlobal(q.a.id,xx,zz),d=Math.hypot(wx-g[0]-.5,wz-g[1]-.5);
    return {world:[wx,wz],d,screen:w>0&&Math.abs(u)<=1&&Math.abs(k)<=1?[u,k]:null};
   };
   (window.__qaRoles??=[]).push({role:'compact',key,realm:q.a.id,
    water:cropped?[]:e.proof.water.map(o=>({...o,...pl((o.x+o.x1)/2,o.y,o.z+.5)})),
    trees:e.proof.trees.map(o=>({...o,...pl(o.x,o.top*.79+o.y*.21,o.z)}))});
 `);
 put(' if(seam)poiSeamRoleRender(vp,seam,id,g,held);', `
 if(seam){
  const take=()=>{
   const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,p=new Uint8Array(w*h*4);
   gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,p);return p;
  };
  const attrs=()=>[gl.getParameter(gl.ARRAY_BUFFER_BINDING),...[loc.p,loc.n,loc.c].flatMap(at=>
   [gl.VERTEX_ATTRIB_ARRAY_ENABLED,gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING,gl.VERTEX_ATTRIB_ARRAY_TYPE,gl.VERTEX_ATTRIB_ARRAY_NORMALIZED,
    gl.VERTEX_ATTRIB_ARRAY_STRIDE,gl.VERTEX_ATTRIB_ARRAY_SIZE].map(k=>gl.getVertexAttrib(at,k))
     .concat(gl.getVertexAttribOffset(at,gl.VERTEX_ATTRIB_ARRAY_POINTER)))];
  const check=!!window.__qaRead,oldAttrs=check?attrs():null,p=check?take():null;
  const residents=check?[...poiOverlandMeshes,...poiOutdoorCaches,...poiAddGroundCache]:null;
  const support=check?[...poiOverlandGroundDrawn]:null;
  poiSeamRoleRender(vp,seam,id,g,held);
  if(check){
   const after=attrs(),px=take();let lost=0,changed=0,gained=0;
   for(let i=0;i<px.length;i+=4){
    if(p[i+3]>230&&px[i+3]<231)lost++;
    if(p[i+3]>230&&[0,1,2,3].some(j=>p[i+j]!==px[i+j]))changed++;
    if(p[i+3]<180&&px[i+3]>230)gained++;
   }
   window.__qaGuard={lost,changed,gained,state:oldAttrs.length===after.length&&oldAttrs.every((v,i)=>v===after[i]),
    owners:residents.length===poiOverlandMeshes.size+poiOutdoorCaches.size+poiAddGroundCache.size&&residents.every(([k,e])=>[poiOverlandMeshes,poiOutdoorCaches,poiAddGroundCache].some(m=>m.get(k)===e)),
    support:support.length===poiOverlandGroundDrawn.size&&support.every(([k,r])=>poiOverlandGroundDrawn.get(k)===r)};
  }
 }`);
}

for(const[,s]of h.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(s);
if(process.env.ATLAS_PARSE_ONLY)process.exit(0);
const {chromium}=createRequire(import.meta.url)('playwright');
const server=createServer((q,r)=>{r.setHeader('Content-Type','text/html; charset=utf-8');r.end(q.url==='/seed'?'<title>seed</title>':h)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
let b;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const ctx=await b.newContext({viewport:{width:1128,height:506},isMobile:true,hasTouch:true,deviceScaleFactor:.65});
 const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(origin+'/seed');
 await p.evaluate(()=>{
  localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":19500}');
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,region:'snowpass',regionHp:100,position:{x:23,z:10,y:0,facing:1},
   townLayout:5,townMapHeight:182,templeDepth:1,
   view:{yaw:0,zoom:1,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:Math.PI-.15,orbitPitch:.52,orbitDistance:11}}));
 });
 await p.goto(origin+nav);
 await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:36000});
 const boot=await p.evaluate(()=>({installed:typeof window.__editorTest?.eastQ==='function',marker:window.__eastSeamPrivateQA,url:location.search}));
 a.equal(boot.marker,undefined);a(boot.installed,JSON.stringify({boot,errors}));
 const read=()=>p.evaluate(()=>__editorTest.eastQ()), result={};
 const runtime=await read();a.equal(runtime.selected,compact,'actual compact mode differs at startup');

 const summary=q=>({realm:q.realm,land:q.land,foot:q.foot,view:q.view,yaw:q.yaw,pitch:q.pitch,dist:q.dist,
  frame:q.frame,ms:q.ms,packed:q.packed,compactHandles:q.compactHandles,detailed:q.detailed,handles:q.handles,near:q.near,legacy:q.legacy,added:q.added,
  baseProjected:q.roles.filter(r=>r.realm==='base').map(r=>({key:r.key,role:r.role??'original',water:r.water.filter(o=>o.screen),trees:r.trees.filter(o=>o.screen)}))});
 const cap=q=>a(q.err===0&&q.stream&&q.legacy+q.added+q.packed+q.near<=4*1024*1024&&q.legacy+q.added+q.packed<=768*1024,JSON.stringify(summary(q)));
 const snap=async name=>{
  // Natural stabilization, not waiting on an expected role to appear.
  const start=await read();const reach=name==='snow-before'?128:90;
  await p.waitForFunction(({frame,reach})=>__editorTest.eastQ().frame>=frame+reach,{frame:start.frame,reach},{timeout:45000,polling:100});
  const q=await read();cap(q);
  const raster=await p.evaluate(()=>Promise.race([__editorTest.eastRead(),new Promise((_,r)=>setTimeout(()=>r(Error('capture timed out')),8000))]));
  result[name]={...summary(q),raster,warmFrames:q.frame-start.frame,warmMs:q.ms-start.ms};
  if(process.env.SEAM_ART){mkdirSync(process.env.SEAM_ART,{recursive:true});await p.screenshot({path:process.env.SEAM_ART+'/'+name+'.png'});}
  return q;
 };
 const step=async(dx,id,x,z)=>{
  await p.waitForFunction(()=>__editorTest.eastQ().ready,null,{timeout:10000});
  const k=await p.evaluate(dx=>__editorTest.eastKey(dx),dx);
  a(k,'canonical east/west input unavailable at saved bearing');
  await p.keyboard.press({e:'ArrowRight',w:'ArrowLeft',n:'ArrowUp',s:'ArrowDown'}[k]);
  await p.waitForFunction(([id,x,z])=>{
   const q=__editorTest.eastQ();return q.realm===id&&q.land[0]===x&&q.land[1]===z&&q.foot;
  },[id,x,z],{timeout:12000});
 };
 const snow=await snap('snow-before');a.deepEqual(snow.land,[23,10]);a.equal(snow.realm,'snowpass');
 await step(1,'base',72,149);
 const base=await snap('base-settled');
 await step(-1,'snowpass',23,10);
 const back=await snap('snow-return-settled');
 const first=await p.evaluate(()=>__editorTest.eastFirst());
 a.equal(first.length,2);first.forEach(cap);result.first=first.map(summary);
 const camera=q=>[q.yaw,q.pitch,q.dist];
 a.deepEqual(camera(base),camera(snow));a.deepEqual(camera(back),camera(snow));first.forEach(q=>a.deepEqual(camera(q),camera(snow)));
 console.log(JSON.stringify(result));
 if(process.env.SEAM_ART)writeFileSync(process.env.SEAM_ART+'/evidence.json',JSON.stringify(result,null,2));
 a.deepEqual(errors,[]);
}finally{await b?.close();await new Promise(r=>server.close(r))}
