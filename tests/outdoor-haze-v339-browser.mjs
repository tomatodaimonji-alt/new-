import a from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {Script} from 'node:vm';
let h=readFileSync(process.argv[2]??'world-editor.html','utf8');
a.equal(createHash('sha1').update('blob '+Buffer.byteLength(h)+'\0').update(h).digest('hex'),'8ef216d30bf6a0710ca0f5cdc8345ba85c150631');
a(!/__hazeEastActorFixture|__hazeAudit|outdoor-haze=/.test(h),'released HTML has no test opt-in');
const put=(x,y)=>{a.equal(h.split(x).length,2,x);h=h.replace(x,y)};
const resume=h.slice(h.indexOf('function workshopResumePermitted('),h.indexOf('function workshopResumeRead('));
a(new Script(resume+"workshopResumePermitted(new URLSearchParams('resume=1&test=1'));").runInNewContext({URLSearchParams}));
// Negative uniform values are harness-only and mark fragments AFTER every
// production discard. Encode exact owning world tile and quantized height;
put(' gl.uniform3f(loc.fieldHaze,x+.5,z+.5,.38);',`
  if(window.__hazeAudit)window.__hazeAudit.uniforms.push([id,x+.5,z+.5,.38]);
  else window.__hazeNaturalWrites=(window.__hazeNaturalWrites??0)+1;
  gl.uniform3f(loc.fieldHaze,x+.5,z+.5,window.__hazeAudit?.mode==='tag'?(id==='snowpass'?-2:-1):window.__hazeAudit?.mode==='anti'?(id==='snowpass'?-4:-3):window.__hazeAudit?.mode==='off'?0:.38);
`);
put(' gl_FragColor=vec4(color,1.0);\n}`;', ` if(uFieldHaze.z<0.0){
  vec2 cell=floor(vLootXZ)+vec2(1.0);
  bool anti=uFieldHaze.z < -2.5;
  if((anti?uFieldHaze.z+2.0:uFieldHaze.z)<-1.5)cell+=vec2(48.0,139.0);
  float heightCode=clamp(floor(vWorldHeight*24.0+64.5),0.0,254.0);
  vec3 code=vec3(cell,heightCode)/255.0;
  gl_FragColor=vec4(anti?1.0-code:code,1.0);
 }else gl_FragColor=vec4(color,1.0);
 }\`;`);
put('   poiSeamCompactDraw(e.gpu,v,cropped?e.ground:0,count);',`
   poiSeamCompactDraw(e.gpu,v,cropped?e.ground:0,count);
   (window.__hazeCompact??=[]).push([key,cropped?e.ground:0,count]);
`);

// Private East art fixture only: don't enter the ambient random-spawn scheduler.
 // Existing registered actors and full combat ticks stay intact.
put(' poiWildSpawnFrame(now);poiMobFrame(now);poiMineUnlockFrame(now);',
 " if(!(facilityParams.get('test')==='1'&&window.__hazeEastActorFixture===true))poiWildSpawnFrame(now);poiMobFrame(now);poiMineUnlockFrame(now);");
put(' poiTownClockFrame(now);poiWalkFrame(now);',
 ' if(!window.__hazeEastActorFixture||!poiTownClockSetTest(39))poiTownClockFrame(now);poiWalkFrame(now);');
put(' poiSnowPassSwitches++;',` poiSnowPassSwitches++;
 if(!cold&&window.__hazeEastActorFixture)window.__hazeCrossed=true;
`);
put(' poiFieldHazePrepare(now);',` poiFieldHazePrepare(now);
 window.__hazeFrame=(window.__hazeFrame??0)+1;window.__hazeCompact=[];
`);
put(' poiDrawEditorGhostRoof(p.vp);',`
 if(window.__hazeCrossed&&poiOutdoorFrame){
  window.__hazeCrossed=false;
  (window.__hazeFirst??=[]).push(window.__editorTest.hazeFrame());
 }

 // Only while the host awaits stock quiescence. Actual render-frame work
 // remains untouched; observe the renderer's byte ledger consecutively.
 if(window.__hazeQuiet){
  const w=window.__hazeQuiet,t=window.__editorTest.hazeFrame();
  const key=JSON.stringify([t.id,t.cell,t.bytes,t.stream,t.forest.vertices,t.forest.builds]);
  w.seen++;w.run=key===w.key?w.run+1:1;w.key=key;w.last=t.frame;
 }
 if(window.__hazeAudit?.done){
  const probe=window.__hazeAudit;
  // At this boundary the exact original outdoor depth is complete; no
  // signs, actors, arrows or later VFX alter the readback.
  const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,rgba=new Uint8Array(4*w*h);
  gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,rgba);
  const result={w,h,rgba:[...rgba],vp:[...p.vp],uniforms:probe.uniforms,
   footprint:poiFieldHazeFrame?.world??null,color:poiFieldHazeFrame?.color??null,mode:probe.mode,
   phase:gl.getUniform(program,loc.fieldHaze)[2],near:[...poiOverlandGroundDrawn.keys()],ids:poiOutdoorProbe.drawn.map(o=>o.key),
   compact:window.__hazeCompact,detail:poiOverlandDrawn.map(o=>[o.key,o.m.count]),
   legacy:poiOutdoorProbe.drawn.map(o=>[o.key,o.ground,o.props]),forest:facilityForestSceneStatus(),
   bytes:[poiOverlandInspect().bytes,poiOutdoorFarBytes,poiAddGroundBytes,poiSeamRoleBytes],err:gl.getError()};
  window.__hazeAudit=null;probe.done(result);
 }
 poiDrawEditorGhostRoof(p.vp);`);
const key="if(facilityParams.get('test')==='1')window.__editorTest={";
put(key,key+`
 hazeState:(dx,dz)=>({id:facilitySite.id,cell:[poiWalkX,poiWalkZ,poiWalkLevel],foot:poiFieldHazeFrame?.world??null,camera:[poiCameraYaw,poiCameraPitch,poiCameraDistance],
  stream:poiOverlandDrawing,ready:performance.now()>=poiWalkNextReady,frame:window.__hazeFrame,
  combat:{hp:poiPlayerHP,death:poiPlayerDeathSnapshot(),registered:poiMonsterStates.size,
   ambientActors:poiWildActors.size,scheduling:!(facilityParams.get('test')==='1'&&window.__hazeEastActorFixture===true)},
  naturalWrites:window.__hazeNaturalWrites??0,forest:facilityForestSceneStatus(),focus:document.activeElement?.tagName,
  guards:{indoor:poiWalkIndoor(),visibility:!!facilityVisibilityOwner(),sacred:poiSacredFogOn||poiSacredEdgeOn,
   menu:!poiLandscapeMenu.hidden,detail:poiItemDetailIsOpen(),modal:poiLocalModalOpen(),dialogue:poiNpcMenuActive(),pending:poiSnowPassPending},
  canStep:poiWalkCanStep(poiWalkX+dx,poiWalkZ+dz,poiWalkX,poiWalkZ),
  dir:['e','w','n','s'].find(k=>{const d=poiCameraRelativeStep(k);return d[0]===dx&&d[1]===dz;})}),
 hazeFrame:()=>({id:facilitySite.id,cell:[poiWalkX,poiWalkZ,poiWalkLevel],foot:poiOutdoorFrame?.g,
  camera:[poiCameraYaw,poiCameraPitch,poiCameraDistance],frame:window.__hazeFrame,stream:poiOverlandDrawing,forest:facilityForestSceneStatus(),
  combat:{hp:poiPlayerHP,death:poiPlayerDeathSnapshot(),registered:poiMonsterStates.size,
   ambientActors:poiWildActors.size,scheduling:!(facilityParams.get('test')==='1'&&window.__hazeEastActorFixture===true)},
  bytes:[poiOverlandInspect().bytes,poiOutdoorFarBytes,poiAddGroundBytes,poiSeamRoleBytes],
  near:[...poiOverlandGroundDrawn.keys()],detail:poiOverlandDrawn.map(o=>[o.key,o.m.count]),
  legacy:poiOutdoorProbe.drawn.map(o=>[o.key,o.ground,o.props]),compact:window.__hazeCompact}),
 hazeFirst:()=>window.__hazeFirst??[],
 hazeSource:()=>{
  const here=facilitySite.id, authored=here==='base'?facilitySite.southForest:facilitySite;
  const regions=here==='base'?[['base',world],['snowpass',poiOverlandSnow?.map.world??[]]]:[['snowpass',world],['base',poiSnowPassBase.world]];
  return {ground:regions.flatMap(([id,rows])=>rows.filter(o=>o.y===0&&isFloor(o.type)).map(o=>[...poiOverlandGlobal(id,o.x,o.z),o.type])),
   route:(here==='base'?authored.route:authored.snowRoute).map(o=>poiOverlandGlobal(here,o.x,o.z)),
   trees:regions.flatMap(([id,rows])=>rows.filter(o=>o.y===0&&/^tree/.test(o.type)).map(o=>[...poiOverlandGlobal(id,o.x,o.z),o.type]))};
 },
 hazeSnapshot:mode=>new Promise(done=>{window.__hazeAudit={mode,done,uniforms:[],compact:[]}}),
`);
// Frozen exact routes from the earlier completed v334 East/v337 Coastal native jobs.
const routes=[
 {name:'east',id:'snowpass',x:23,z:10,facing:1,gameMs:19500,yaw:Math.PI-.15,pitch:.52,dist:11,
  steps:[{dx:1,dz:0,key:'ArrowRight',dir:'e',id:'base',x:72,z:149},{dx:-1,dz:0,key:'ArrowLeft',dir:'w',id:'snowpass',x:23,z:10}]},
 {name:'forest-stock',id:'base',x:93,z:114,facing:3,gameMs:360000,yaw:-Math.PI/2-.12,pitch:.25,dist:7,
  steps:[{dx:-1,dz:0,key:'ArrowUp',dir:'n',id:'base',x:92,z:114}]},
];
for(const [,s]of h.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(s);
if(process.env.ATLAS_PARSE_ONLY){console.log(JSON.stringify({canonical:'/?resume=1&test=1',routes}));process.exit(0);}
const {chromium}=createRequire(import.meta.url)('playwright');
const server=createServer((q,r)=>{r.setHeader('Content-Type','text/html; charset=utf-8');r.end(q.url==='/seed'?'<title>seed</title>':h)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const alphaFor=d=>{const t=Math.max(0,Math.min(1,(d-18)/14));return .38*t*t*(3-2*t);};
const med=x=>x.sort((a,b)=>a-b)[Math.floor(x.length/2)]??null;
const gb=(value)=>Math.floor(value/8);
const mask=(before,after,tag,anti,src)=>{
 const route=new Set(src.route.map(x=>x.join(','))), ground=new Map(src.ground.map(([x,z,t])=>[x+','+z,t]));
 const bands=[[4,12],[21,24],[26,29],[33,47]].map(([lo,hi])=>({lo,hi,veil:[],tiles:new Map()}));
 const treePixels=new Map(),roadPixels=new Map(),farTrees=new Map(),water=new Map();
 const treeCells=new Map(src.trees.map(o=>[o[0]+','+o[1],o]));
 const waterType=/^(?:sea|water|lake|river)$/;
 const blue=(p,i)=>p[i+2]>p[i]+14&&p[i+2]>p[i+1]+12;
 let visibleTag=0;
 let alphaChanges=0,changed=0;
 for(let i=0;i<before.rgba.length;i+=4){
  const b=before.rgba,u=after.rgba,v=tag.rgba;
  if(b[i+3]!==u[i+3])alphaChanges++;
  if(b[i+3]>230&&[0,1,2].some(k=>b[i+k]!==u[i+k]))changed++;
  if(v[i+3]!==255||b[i+3]!==255||u[i+3]!==255||anti.rgba[i+3]!==255)continue;
  if(![0,1,2].every(k=>v[i+k]+anti.rgba[i+k]===255)||[0,1,2].every(k=>v[i+k]===anti.rgba[i+k]))continue;
  const x=v[i]-1,z=v[i+1]-1,height=(v[i+2]-64)/24,key=x+','+z,d=Math.hypot(x-after.footprint[0],z-after.footprint[1]);
  if(x<0||x>183||z<0||z>183)continue;
  visibleTag++;
  if(height>.95&&height<5&&d>9&&d<47){
   const tree=treeCells.get(key);
   if(tree){const srcKey=tree.join(',');treePixels.set(srcKey,(treePixels.get(srcKey)??0)+1);
    if(d>=33&&Math.hypot(tree[0]-after.footprint[0],tree[1]-after.footprint[1])>=33&&ground.has(tree[0]+','+tree[1]))
     farTrees.set(srcKey,(farTrees.get(srcKey)??0)+1);}

  }
  if(Math.abs(height)>.52||!ground.has(key))continue;
  if(waterType.test(ground.get(key))){
   const w=water.get(key)??[0,0,0];w[0]+=1;w[1]+=+blue(b,i);w[2]+=+blue(u,i);water.set(key,w);
  }
  if(route.has(key)&&d>8)roadPixels.set(key,(roadPixels.get(key)??0)+1);
  // Tile radius tolerance ±.708; skip ambiguous boundary fragments. The
  // encoded tile itself must be foreground and actually authored land.
  const band=bands.find(q=>d>=q.lo+.71&&d<=q.hi-.71);
  if(!band)continue;
  const observed=[];
  for(let k=0;k<3;k++){
   const c=after.color[k]*255,base=b[i+k];
   if(Math.abs(c-base)>=36)observed.push((u[i+k]-base)/(c-base));
  }
  if(observed.length){
   band.tiles.set(key,(band.tiles.get(key)??0)+1);
   band.veil.push(...observed.map(a=>({a,d,error:Math.abs(a-alphaFor(d))})));
  }
 }
 return {alphaChanges,changed,visibleTag,water:[...water.entries()].filter(([_,[,bb,ab]])=>bb>=5&&ab>=5),bands:bands.map(q=>({lo:q.lo,hi:q.hi,tileCount:q.tiles.size,
  n:q.veil.length,observed:med(q.veil.map(w=>w.a)),residual:med(q.veil.map(w=>w.error)),witnesses:[...q.tiles.entries()].slice(0,16)})),
  farTrees:[...farTrees.entries()].filter(e=>e[1]>=5),roadPixels:[...roadPixels.entries()].filter(e=>e[1]>=5),treePixels:[...treePixels.entries()].filter(e=>e[1]>=5)};
};
const artifact=process.env.HAZE_ART,evidence={};
const write=()=>{if(artifact){mkdirSync(artifact,{recursive:true});writeFileSync(artifact+'/evidence.json',JSON.stringify(evidence,null,2));}};
const sum=b=>b.reduce((a,b)=>a+b,0);
const capped=b=>sum(b)<=4*1024*1024&&sum(b.slice(1))<=768*1024;
let b;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const failures=[];
 for(const route of routes){
  const {name,steps}=route,east=name==='east',log=evidence[name]={route};
  const stage=(k,v)=>{log[k]=v;write();};
  log.actorScope=east?'No new ambient wild scheduler only. Registered actors and normal mob combat retained.':'Unmodified actor scheduling.';
  console.log('Previously proven route: '+JSON.stringify(route));write();
  const ctx=await b.newContext({viewport:{width:1128,height:506},isMobile:true,hasTouch:true,deviceScaleFactor:.65});
  const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  try{
   if(east)await p.addInitScript(()=>{window.__hazeEastActorFixture=true});
   await p.goto(origin+'/seed');
   await p.evaluate(({id,x,z,facing,yaw,pitch,dist,gameMs})=>{
    localStorage.setItem('world-workshop-town-clock-v1',JSON.stringify({version:1,gameMs}));
    localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
     ...(id==='snowpass'?{region:id,regionHp:100}:{}),position:{x,z,y:0,facing},townLayout:5,townMapHeight:182,templeDepth:1,
     view:{yaw:0,zoom:1,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:yaw,orbitPitch:pitch,orbitDistance:dist}}));
   },route);
   await p.goto(origin+'/?resume=1&test=1');
   await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:36000});
   const state=(dx=0,dz=0)=>p.evaluate(({dx,dz})=>__editorTest.hazeState(dx,dz),{dx,dz});
   const snap=mode=>p.evaluate(mode=>Promise.race([__editorTest.hazeSnapshot(mode),new Promise((_,r)=>setTimeout(()=>r(Error('haze readback timeout')),8000))]),mode);
   const frames=async count=>{
    const first=(await state()).frame;
    await p.waitForFunction(({first,count})=>__editorTest.hazeState(0,0).frame>=first+count,{first,count},{timeout:45000,polling:100});
   };
   const quietStock=async()=>{
    await p.evaluate(()=>{window.__hazeQuiet={seen:0,run:0,key:null,last:null}});
    try{
     // Polling doesn't sample or force a render. The counter only advances
     // inside the original post-scene boundary, eight identical frames.
     await p.waitForFunction(()=>window.__hazeQuiet?.run>=8,null,{timeout:25000,polling:100});
     stage('preactivation-stock-quiet',await p.evaluate(()=>window.__hazeQuiet));
    }finally{
     const sampled=await p.evaluate(()=>{const w=window.__hazeQuiet;window.__hazeQuiet=null;return w;});
     if(!log['preactivation-stock-quiet'])stage('preactivation-stock-quiet',sampled);
    }
   };
   const still=async label=>{
    const source=await p.evaluate(()=>__editorTest.hazeSource()),before=await snap('off'),after=await snap('on'),tag=await snap('tag'),anti=await snap('anti');
    const pairs=[after,tag,anti].map(f=>({mode:f.mode,changes:['vp','footprint','near','ids','compact','bytes','detail','legacy']
      .filter(k=>JSON.stringify(f[k])!==JSON.stringify(before[k])),sameForestMesh:f.forest.vertices===before.forest.vertices&&f.forest.builds===before.forest.builds,
      active:f.uniforms.length>0,restore:f.phase,err:f.err}));
    const raster=after.footprint?mask(before,after,tag,anti,source):null;
    const view={state:await state(),pairs,raster,bytes:after.bytes,support:after.near,counts:[after.detail,after.legacy,after.compact]};
    stage(label,view);
    if(artifact)await p.screenshot({path:artifact+'/'+name+'-'+label+'.png'});
    a(capped(after.bytes));
    a(pairs.every(q=>!q.changes.length&&q.sameForestMesh&&q.restore===0&&!q.err),name+': changed or invalid scene '+JSON.stringify(pairs));
    if(east)a(view.state.naturalWrites>0,'normal play set the release haze before capture');
    if(east)a(pairs.every(q=>q.active)&&raster?.visibleTag>50&&raster.alphaChanges===0,'East HOLD: no unchanged opaque haze witness');
    return view;
   };
   const initial=await state(steps[0].dx,steps[0].dz);stage('startup',initial);
   a.deepEqual(initial.cell,[route.x,route.z,0]);a.equal(initial.id,route.id);
   if(east)a(initial.combat.hp===100&&!initial.combat.death&&!initial.combat.scheduling);
   if(!east)a(!initial.stream&&initial.canStep&&!initial.forest.active);
   await frames(east?128:5);
   if(!east)await quietStock();
   const captures=[await still('before')];
   for(let i=0;i<steps.length;i++){
    const next=steps[i];
    await p.waitForFunction(()=>__editorTest.hazeState(0,0).ready,null,{timeout:10000});
    const intent=await state(next.dx,next.dz);stage('intent-'+i,{...intent,input:next.key});
    a.equal(intent.dir,next.dir);a.deepEqual(intent.camera,initial.camera);
    if(east)a(intent.combat.hp>0&&!intent.combat.death&&!intent.combat.scheduling);
    await p.keyboard.press(next.key);
    await p.waitForFunction(({id,x,z})=>{
     const s=__editorTest.hazeState(0,0);return s.id===id&&s.cell[0]===x&&s.cell[1]===z;
    },next,{timeout:east?12000:10000});
    stage('arrival-'+i,await state());
    if(east){
     // Landing state can precede rendering. Wait for immutable latch slot,
     // not a warm frame or a live snapshot. Wrong first scene fails closed.
     try{
      await p.waitForFunction(({i,id,x,z})=>{
       const q=__editorTest.hazeFirst()[i];
       return q?.id===id&&q.cell[0]===x&&q.cell[1]===z;
      },{i,...next},{timeout:12000,polling:100});
     }finally{
      const early=(await p.evaluate(()=>__editorTest.hazeFirst()))[i];
      stage('first-render-'+i,early??null);
     }
     const early=log['first-render-'+i];
     a(early?.combat.hp>0&&!early.combat.death&&!early.combat.scheduling);
     a(early?.stream&&early.foot&&early.near.length&&capped(early.bytes),'East HOLD: first rendered support missing');
     a.deepEqual(early.camera,initial.camera);
     await frames(90);
    }else{
     const at=await p.evaluate(()=>performance.now());
     await p.waitForFunction(at=>performance.now()-at>850,at,{timeout:15000,polling:100});
    }
    const q=await still('settled-'+i);captures.push(q);
    a.deepEqual(q.state.camera,initial.camera);a.equal(q.state.stream,east);
   }
   if(east){
    a.deepEqual(captures.map(o=>o.state.foot),[[71,149],[72,149],[71,149]]);
    a.deepEqual(captures.map(o=>o.state.foot.map(gb)),[[8,18],[9,18],[8,18]]);
    for(const {raster:q,support,state} of captures){
     a(state.combat.hp>0&&!state.combat.death&&!state.combat.scheduling);
     a(support.length&&q.changed>100&&q.water.length>=3,'East HOLD: water not identified/blue foreground');
     a(q.bands[0].tileCount>=2&&Math.abs(q.bands[0].observed)<.02,'East HOLD: near not clear');
     for(const r of q.bands.slice(1,3))a(r.tileCount>=2&&r.n>=24&&r.observed>.03&&r.residual<.048,'East HOLD: real transitional ground incomplete');
     a(q.bands[1].observed<q.bands[2].observed-.04);
     const far=q.bands[3];
     a(far.tileCount>=2&&far.n>=24&&Math.abs(far.observed-.38)<.05&&q.farTrees.length,'East HOLD: real 32–48 terrain/tree witnesses incomplete');
    }
    const water=new Set(captures[0].raster.water.map(o=>o[0]));
    a(captures.slice(1).every(q=>q.raster.water.filter(o=>water.has(o[0])).length>=3),'East HOLD: can’t confirm same authored blue water');
    for(const band of [1,2])a(Math.abs(captures[0].raster.bands[band].observed-captures[1].raster.bands[band].observed)<.12,'East HOLD: neighboring-foot matched radius unstable');
    stage('outcome','east-passed');
   }else{
    a(captures[1].state.forest.active&&captures[1].state.forest.builds>captures[0].state.forest.builds);
    a(captures[1].state.naturalWrites>0,'Forest stock play set release haze without marker');
    const q=captures[1].raster;
    stage('outcome',q?.bands[3].tileCount>=2&&q?.farTrees.length?'forest-far-witness-recorded':'forest-native-route-complete; far inconclusive');
   }
   a.deepEqual(errors,[]);
  }catch(err){
   const last=await p.evaluate(()=>window.__editorTest?.hazeState(0,0)).catch(()=>null);
   stage('failure',{message:err.message,stack:err.stack,last,errors});failures.push(name+': '+err.message);
  }finally{await ctx.close()}
 }
 console.log(JSON.stringify(evidence));write();a.deepEqual(failures,[],'individual evidence persisted before failure');
}finally{await b?.close();await new Promise(r=>server.close(r))}
