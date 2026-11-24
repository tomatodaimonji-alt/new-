import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const h=readFileSync(process.argv[2]??'world-editor.html','utf8');
const key='  freeMovementPose:()=>({x:poiWalkViewX,z:poiWalkViewZ,level:poiWalkLevel}),';
assert.equal(h.split(key).length,2,'native play instrumentation inserts into test API only');
let html=h.replace(key,key+`
  seamlessSnowQA:()=>{
   const pose={x:poiWalkViewX,z:poiWalkViewZ,y:poiWalkLevel},region=facilitySite?.id;
   const s=window.__snowSeamProbe,v=$('poiSnowTransitionVeil'),d=$('poiDungeonFade');
   return {pose,region,pointer:poiAnalogContact?.id??null,facing:poiWalkFacing,
    heading:poiCameraYaw,pitch:poiCameraPitch,camera:poiThirdPerson,lit:window.pineStartup?.ready,
    blocked:!!v&&!v.hidden,veil:!!v&&!v.hidden,
    dark:!!d?.style.opacity&&+d.style.opacity>.03,active:poiWalkActive,
    timestamp:performance.now(),uploads:s?.uploads.length,live:s?.live,contextLost:s?.lost};
  },
`);
if(process.env.SNOW_PATH_PROFILE==='1'){
 const a=html.indexOf('function poiTownFindPath('),b=html.indexOf('function poiTownNpcExistsBed(',a);
 let f=html.slice(a,b);assert(a>0&&b>a);
 const mark=(x,y)=>{assert.equal(f.split(x).length,2,x);f=f.replace(x,y)};
 mark('function poiTownFindPath(from,target,blocked){',`function poiTownFindPath(from,target,blocked){
  const q=window.__snowSeamProbe;
  const trace=q?.active&&['resadventurer','guestadventurer'].includes(from?.role?.id)&&q.paths.length<400?
   {at:performance.now(),role:from.role.id,from:[from.x,from.z,from.y],to:[target?.x,target?.z,target?.y],
    blocked:!!blocked,expanded:0,edges:0,edgeSampleMs:0,samples:0,rough:0,length:null}:null;
  if(trace)q.paths.push(trace);
  try{`);
 mark(' const p=queue[i],source=poiTownNpcKey(p.x,p.z,p.y);', ' const p=queue[i],source=poiTownNpcKey(p.x,p.z,p.y);if(trace)trace.expanded++;');
 mark('   const next=poiTownNpcNextTile(p,p.x+dx,p.z+dz,g);if(!next)continue;',`
   const record=trace&&++trace.edges%16===0;
   const t0=record?performance.now():0;
   const next=poiTownNpcNextTile(p,p.x+dx,p.z+dz,g);
   if(record){trace.edgeSampleMs+=performance.now()-t0;trace.samples++;
    if(p.y===0&&terrainLevel(p.x,p.z)!==terrainLevel(p.x+dx,p.z+dz))trace.rough++;
   }
   if(!next)continue;`);
 mark('    return path.reverse();','    if(trace)trace.length=path.length;return path.reverse();');
 mark(' return null;\n}',' return null;\n }finally{if(trace)trace.elapsed=performance.now()-trace.at}\n}');
 html=html.slice(0,a)+f+html.slice(b);
}
if(process.env.SNOW_REMOTE_SPLIT==='1'){
 const mark=(a,b)=>{assert.equal(html.split(a).length,2,a);html=html.replace(a,b)};
 const log=kind=>`if(window.__snowSeamProbe?.active){const q=window.__snowSeamProbe;q.remote.push({kind:'${kind}',frames:q.samples.length,region:facilitySite?.id,at:performance.now()})}`;
 mark(' entry.npc={a,clock,now,world};budget.plans--;',' entry.npc={a,clock,now,world};budget.plans--;'+log('queue'));
 mark(' poiTownNpcRoutine(p.a,p.clock,p.now,{plans:1});',' '+log('run')+'poiTownNpcRoutine(p.a,p.clock,p.now,{plans:1});');
}
if(process.env.SNOW_PHASE_REPORT){
 const from=html.indexOf('function render(){'),to=html.indexOf('let savedMapRestoreFailed',from);
 assert(from>0&&to>from);
 let frame=html.slice(from,to);
 const phase=(a,b)=>{assert.equal(frame.split(a).length,2,a);frame=frame.replace(a,b)};
 phase('function render(){','function render(){const snowT0=performance.now();');
 phase('poiTownClockFrame(now);poiWalkFrame(now);poiMessageUpdate(now);','poiTownClockFrame(now);const snowClock=performance.now();poiWalkFrame(now);const snowWalk=performance.now();poiMessageUpdate(now);');
 phase(' const p=parameters();poiSkyBackdrop(p);',' const snowT1=performance.now();const p=parameters();poiSkyBackdrop(p);');
 phase(' if(cursorDirty){',' const snowT2=performance.now();if(cursorDirty){');
 phase(' if(typeof poiHitstopMarkDrawn',` if(window.__snowSeamProbe?.active){
  const probe=window.__snowSeamProbe,a=probe.phases||(probe.phases=[]),t=performance.now();
  if(a.length<4500)a.push({t,region:facilitySite?.id,walk:snowT1-snowT0,clock:snowClock-snowT0,walkOnly:snowWalk-snowClock,npc:snowT1-snowWalk,build:snowT2-snowT1,paint:t-snowT2,total:t-snowT0});
 }
 if(typeof poiHitstopMarkDrawn`);
 html=html.slice(0,from)+frame+html.slice(to);
 const start=html.indexOf('function poiSnowPassApply('),end=html.indexOf('function poiSnowPassVeil(',start);
 let apply=html.slice(start,end);
 const stamps=[' if(!prepared)return false;',' facilitySite=incoming;',' const staticBase=',' facilitySurfaceEdited=',' facilityInitialMap=',' const spawn=',' if(!onBase&&!base.warm)poiEconomyStart();',' if(!cold){poiPlayerHP=',' mode=',' if(poiWalkActive){if(!poiOverlandKeepAnalog)',' poiSnowPassSwitches++;'];
 for(const [i,k] of stamps.entries()){
  assert(apply.includes(k),k);
  apply=apply.replace(k,i===0?' const snowTimes=[performance.now()];'+k:' snowTimes.push(performance.now());'+k);
 }
 apply=apply.replace(' return true;',` window.__snowSeamProbe?.switchPhases?.push({region:dest.region,elapsed:snowTimes.map((q,i)=>i?q-snowTimes[i-1]:0)});
 return true;`);
 html=html.slice(0,start)+apply+html.slice(end);
 if(process.env.SNOW_REMOTE_SPLIT!=='1'){
 const n0=html.indexOf('function poiTownResidentsFrame(now){'),n1=html.indexOf('function poiTownResidentsSnapshot(',n0);
 let npc=html.slice(n0,n1);
 npc=npc.replace(' poiTownNpcInit(clock);',' const before=performance.now();poiTownNpcInit(clock);const initialized=performance.now();')
  .replace(' const budget={plans:2};',' const synced=performance.now(),budget={plans:2},roles=[];')
  .replace("for(const a of poiTownNpcActors)if(a!==speaker&&poiTownNpcRecover(a,now)&&\n    (typeof poiTownStreetHolds!=='function'||!poiTownStreetHolds(a)))poiTownNpcRoutine(a,clock,now,budget);",`
  for(const a of poiTownNpcActors){
   const tick=performance.now();
   if(a!==speaker&&poiTownNpcRecover(a,now)&&(typeof poiTownStreetHolds!=='function'||!poiTownStreetHolds(a)))poiTownNpcRoutine(a,clock,now,budget);
   const cost=performance.now()-tick;
   if(cost>=1)roles.push({role:a.role.id,ms:cost});
  }
  const q=window.__snowSeamProbe;
  if(q?.active&&q.npc.length<400)q.npc.push({at:performance.now(),init:initialized-before,port:synced-initialized,routine:performance.now()-synced,roles});
  `);
 if(!npc.includes('const synced=')||!npc.includes('roles.push'))throw new Error('exact NPC cost anchors');
 html=html.slice(0,n0)+npc+html.slice(n1);
 }

}
if(process.env.SNOW_SEAM_SYNTAX_ONLY==='1'){
 for(const [,,body] of [...html.matchAll(/<script(?:\s+([^>]*))?>([\s\S]*?)<\/script>/gi)].filter(([,a])=>!a||!/\b(?:src|type)\s*=/.test(a)))new Script(body);
 console.log('PASS exact seamless snow browser fixture anchors and script parse');process.exit(0);
}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>seed</title>':html)});
await new Promise((r,j)=>server.listen(0,'127.0.0.1',r).once('error',j));
const origin='http://127.0.0.1:'+server.address().port, fixtureOnly=process.env.SNOW_SEAM_REPORT_ONLY==='1';
const position=s=>s.pose.z+(s.region==='snowpass'?128:0);
const initialKit=JSON.stringify({version:1,weapon:'equipWoodSword',potions:0,gold:9,
 groundGold:[{id:'pile-qa',x:12,z:2,y:0,amount:2}],drops:[{type:'healingHerb',x:12,z:2,y:0}]});
function startProbe(){
 const p=WebGLRenderingContext.prototype,s=window.__snowSeamProbe={
  frames:[],uploads:[],audio:[],longTasks:[],animation:[],npc:[],remote:[],paths:[],sceneCounts:[],masked:0,high:0,live:0,lost:0,veils:[],thumb:[],samples:[],active:false};
 const shapes=new WeakMap(),current=new WeakMap(),cap=4500;
 for(const [method,wrap] of Object.entries({
  bindBuffer(original,target,buffer){
   let binding=current.get(this);
   if(!binding){binding=new Map();current.set(this,binding)}
   binding.set(target,buffer);return original.call(this,target,buffer);
  },
  bufferData(original,target,value,...args){
   const buffer=current.get(this)?.get(target);
   if(buffer){const bytes=typeof value==='number'?value:value?.byteLength??0;
    const before=shapes.get(buffer)??0;shapes.set(buffer,bytes);s.live+=bytes-before;s.high=Math.max(s.high,s.live);
    if(s.active&&s.uploads.length<cap)s.uploads.push({at:performance.now(),bytes,target,live:s.live});}
   return original.call(this,target,value,...args);
  },
  deleteBuffer(original,buffer){
   if(buffer){s.live-=shapes.get(buffer)??0;shapes.delete(buffer)}
   return original.call(this,buffer);
  },
  drawArrays(original,mode,first,count){
   if(s.active&&this.canvas?.id==='view')s.masked+=count;
   return original.call(this,mode,first,count);
  },
  drawElements(original,mode,count,...args){
   if(s.active&&this.canvas?.id==='view')s.masked+=count;
   return original.call(this,mode,count,...args);
  },
  clear(original,flags){
   const t=performance.now(),r=original.call(this,flags);
   if(s.active&&this.canvas?.id==='view'&&(flags&this.COLOR_BUFFER_BIT)&&s.frames.length<cap){
    if(s.frames.length)s.sceneCounts.push(s.masked);
    s.masked=0;s.frames.push(t);
    const qa=window.__editorTest?.seamlessSnowQA?.();
    if(qa?.veil||qa?.dark)s.veils.push({at:t,region:qa.region});
    if(qa)s.samples.push({t,region:qa.region,x:qa.pose.x,z:qa.pose.z,heading:qa.heading,pitch:qa.pitch,
      pointer:qa.pointer,face:qa.facing,kit:qa.active});
   }
   return r;
  }
 })){const original=p[method];p[method]=function(...args){return wrap.call(this,original,...args)}}
 if(typeof PerformanceObserver!=='undefined'&&PerformanceObserver.supportedEntryTypes?.includes('longtask')){
  const observer=new PerformanceObserver(list=>{if(s.active)for(const e of list.getEntries())s.longTasks.push({at:e.startTime,duration:e.duration,name:e.name})});
  observer.observe({type:'longtask'});
 }
 if(typeof PerformanceObserver!=='undefined'&&PerformanceObserver.supportedEntryTypes?.includes('long-animation-frame')){
  const observer=new PerformanceObserver(list=>{if(s.active)for(const e of list.getEntries())s.animation.push({
   at:e.startTime,duration:e.duration,blocking:e.blockingDuration,render:e.renderStart,layout:e.styleAndLayoutStart,
   scripts:e.scripts.map(x=>({fn:x.sourceFunctionName,invoker:x.invoker,at:x.startTime,exec:x.executionStart,duration:x.duration,pause:x.pauseDuration,layout:x.forcedStyleAndLayoutDuration}))
  })});
  observer.observe({type:'long-animation-frame'});
 }
 const audioClass=globalThis.AudioContext||globalThis.webkitAudioContext;
 const decode=audioClass?.prototype?.decodeAudioData;
 if(decode)audioClass.prototype.decodeAudioData=function(bytes,done,fail){
  const row={at:performance.now(),bytes:bytes.byteLength};if(s.active)s.audio.push(row);
  const result=decode.call(this,bytes,value=>{row.end=performance.now();if(done)done(value)},fail);
  return result;
 };
 addEventListener('webglcontextlost',()=>s.lost++,true);
 for(const event of ['pointerdown','pointerup','pointercancel'])addEventListener(event,e=>{
  if(s.active&&e.pointerType==='touch'&&e.isTrusted)s.thumb.push({event,id:e.pointerId,time:performance.now()});
 },true);
}
function limits(summary){
 const maxGap=+(process.env.SNOW_MAX_FRAME_GAP_MS??150),maxUpload=+(process.env.SNOW_MAX_SEAM_UPLOAD_BYTES??6*1024*1024);
 const maxGPU=+(process.env.SNOW_MAX_LIVE_BUFFER_BYTES??48*1024*1024);
 return {
  rendered:summary.frames>=6,
  noBlankCanvas:summary.sceneCounts.length>0&&summary.sceneCounts.every(n=>n>500),
  sameThumb:summary.continued&&summary.thumb.filter(e=>e.event==='pointerdown').length===1&&
   !summary.thumb.some(e=>e.event==='pointercancel'||e.event==='pointerup')&&
   summary.continued.pointer===summary.thumb.find(e=>e.event==='pointerdown').id,
  noCurtain:summary.veils.length===0,
  noContextLoss:summary.lost===0,
  responsive:summary.gap.max<=320&&summary.gap.max<=Math.max(maxGap,summary.away.max+30),
  noSeamSpecificP99:summary.gap.p99<=Math.max(maxGap,summary.away.p99+30),
  smallUploads:summary.largestUpload<=maxUpload,
  boundedGpu:summary.peak<=maxGPU,
  noPhaseJump:!summary.end||Math.abs(summary.start.heading-summary.end.heading)<.001&&Math.abs(summary.start.pitch-summary.end.pitch)<.001,
 };
}
const quantile=(x,f)=>{if(!x.length)return 0;return x.toSorted((a,b)=>a-b)[Math.min(x.length-1,Math.floor(x.length*f))]};
const frameGaps=frames=>{
 const gaps=frames.slice(1).map((t,i)=>t-frames[i]);
 return {n:gaps.length,p50:quantile(gaps,.5),p95:quantile(gaps,.95),p99:quantile(gaps,.99),max:Math.max(0,...gaps)};
};
let browser,away;
const violations=[];
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
 args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 for(const profile of ['away','warm','cold']){
  const coldSnow=profile==='cold';
  const ctx=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:.65,isMobile:true,hasTouch:true,serviceWorkers:'block'});
  const page=await ctx.newPage(),errors=[],remote=[],req=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>req.push(r.url()));
  await ctx.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():(remote.push(r.request().url()),r.abort()));
  await page.addInitScript(startProbe);
  await page.goto(origin+'/seed');
  await page.evaluate(({coldSnow,initialKit,profile,muted})=>{
   if(muted)localStorage.setItem('world-workshop-audio-v2',JSON.stringify({master:0,bgm:0,se:0}));
   localStorage.setItem('world-workshop-hotbar-v1',initialKit);
   localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":330000}');
   localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
    ...(coldSnow?{region:'snowpass',regionHp:78}:{}),
    position:coldSnow?{x:12,z:3,y:0,facing:0}:profile==='away'?{x:54,z:112,y:0,facing:2}:{x:49,z:125,y:0,facing:2},townLayout:5,townMapHeight:128,
    view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:.37,orbitPitch:.24,orbitDistance:5.5}}));
  },{coldSnow,initialKit,profile,muted:process.env.SNOW_PROFILE_MUTED==='1'});
  await page.goto(origin+'/?resume=1&test=1'+(process.env.SNOW_SEAM_QUERY??''));
  await page.locator('#pineStartupCover').waitFor({state:'hidden',timeout:20000});
  const get=()=>page.evaluate(()=>window.__editorTest?.seamlessSnowQA());
  const originState=await get();
  assert(originState.active);
  assert.equal(originState.region,coldSnow?'snowpass':'base');
  if(profile==='away'){
   await page.evaluate(()=>{window.__snowSeamProbe.active=true});
   await page.waitForTimeout(1500);
   away=frameGaps(await page.evaluate(()=>window.__snowSeamProbe.frames));
   assert(away.n>=6,'real away baseline produces a sustained canvas frame sample');
   console.log('Away baseline, actual canvas frame gaps',JSON.stringify(away));
   await ctx.close();continue;
  }
  const pad=await page.locator('#poiAnalogPad').boundingBox();assert(pad);
  const cdp=await ctx.newCDPSession(page);
  try{
   const bind=id=>({x:Math.round(pad.x+pad.width/2),y:Math.round(pad.y+pad.height/2),id,radiusX:4,radiusY:4,force:.7});
   async function cross(sign,label,id){
    const from=await get(),input=bind(id),dst=sign>0?'snowpass':'base';
    const start=await page.evaluate(()=>{const s=window.__snowSeamProbe;s.active=true;s.frames=[];s.phases=[];s.switchPhases=[];s.audio=[];s.longTasks=[];s.animation=[];s.npc=[];s.remote=[];s.paths=[];s.veils=[];s.samples=[];s.uploads=[];s.thumb=[];s.sceneCounts=[];s.masked=0;s.high=s.live;
     return {at:performance.now(),live:s.live};});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[input]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...input,y:input.y+sign*36}]});
    // The input assertion is deliberately evaluated after crossing. No
    // re-press is allowed to rescue a cut, frozen, or cancelled thumb.
    const firstPointer=await get();
    let end,continued;
    try{
     end=await (await page.waitForFunction(dst=>{const s=window.__editorTest.seamlessSnowQA();return s.region===dst&&s},dst,{polling:25,timeout:8000})).jsonValue();
     continued=await (await page.waitForFunction(({dst,sign})=>{
      const s=window.__editorTest.seamlessSnowQA();
      return s.region===dst&&(sign>0?s.pose.z>.78:s.pose.z<126.22)&&s;
     },{dst,sign},{polling:25,timeout:1600})).jsonValue();
    }catch(e){if(!end)throw new Error(label+' failed to cross despite real drag '+JSON.stringify(await get()),{cause:e})}
    const q=await page.evaluate(()=>{const s=window.__snowSeamProbe;s.active=false;return s});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    const summary={label,from:from.region,to:end?.region,start:firstPointer,end,continued,
     elapsed:(continued??end).timestamp-start.at,frames:q.frames.length,sceneCounts:q.sceneCounts,veils:q.veils,lost:q.lost,
     liveAtStart:start.live,peak:q.high,settled:q.live,largestUpload:Math.max(0,...q.uploads.map(u=>u.bytes)),
     gap:frameGaps(q.frames),away,thumb:q.thumb};
    if(process.env.SNOW_REMOTE_SPLIT==='1'&&dst==='base'){
     const queued=q.remote.find(x=>x.kind==='queue'),run=q.remote.find(x=>x.kind==='run');
     assert(queued&&run&&run.region==='base'&&run.frames===queued.frames+1,'distant second hunt must run on exactly the next actual presented frame');
     summary.remotePath=q.remote;
    }
    const seam=q.samples.findIndex((sample,i)=>i>0&&sample.region!==q.samples[i-1].region);
    if(seam>0){
     const frame=q.samples[seam].t,previous=q.samples[seam-1].t,next=q.samples[seam+1]?.t;
     summary.boundary={at:frame,enterGap:frame-previous,followingGap:next==null?null:next-frame,
      overlappingMainTasks:q.longTasks.filter(t=>t.at<(next??frame)&&t.at+t.duration>previous)};
    }
    const gates=limits(summary);
    if(process.env.SNOW_PHASE_REPORT){
     const top=(q.phases||[]).toSorted((a,b)=>b.total-a.total).slice(0,5);
     const around=(q.phases||[]).filter((x,i,a)=>i&&x.region!==a[i-1].region).map((x,i)=>x);
     const slow=Object.assign([],q.frames.slice(1).map((t,i)=>({t,start:q.frames[i],gap:t-q.frames[i]}))).toSorted((a,b)=>b.gap-a.gap).slice(0,3);
     console.log('Seam CPU phases',JSON.stringify({label,top,around,slow,audio:q.audio,frameAttribution:(q.animation||[]).toSorted((a,b)=>b.duration-a.duration).slice(0,4),npc:(q.npc||[]).toSorted((a,b)=>b.init+b.port+b.routine-a.init-a.port-a.routine).slice(0,4),switches:q.switchPhases,paths:(q.paths||[]).toSorted((a,b)=>b.elapsed-a.elapsed).slice(0,8)}));
    }
    assert(sign*(position(end)-position(from))>.6,'global walking crosses the registered world edge');
    if(continued){
     assert.equal(continued.facing,sign>0?2:0,'holding the thumb does not reverse world orientation');
     assert(Math.abs(continued.pose.x-(sign>0?12:49))<.14,'crossing does not move sideways');
    }
    console.log('Snow seam timing / bytes / trusted touch',JSON.stringify({...summary,gates}));
    violations.push(...Object.entries(gates).filter(([,ok])=>!ok).map(([gate])=>label+':'+gate));
   }
   if(coldSnow)await cross(-1,'cold snow reload → base',74);
   else{
    await cross(1,'old base → snow',71);await cross(-1,'warm snow → base',72);
    await cross(1,'repeat base → snow',73);
   }
   const persisted=await page.evaluate(()=>({resume:JSON.parse(localStorage.getItem('world-workshop-resume-v1')),kit:localStorage.getItem('world-workshop-hotbar-v1')}));
   assert.equal(persisted.kit,initialKit,'actual sector crossings do not touch prior inventory and base-owned ground items');
   assert.equal(persisted.resume.region,coldSnow?undefined:'snowpass','last crossing writes only its registered location');
   assert.deepEqual(errors,[]);assert.deepEqual(remote,[],'no network requests to load or render a neighboring region');
   assert(req.every(x=>x.startsWith(origin)));
  }finally{await cdp.detach();await ctx.close()}
 }
 if(!fixtureOnly)assert.deepEqual(violations,[],'crossing visual, frame, input and memory gates');
}finally{await browser?.close();await new Promise(r=>server.close(r))}
