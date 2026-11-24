import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import vm from 'node:vm';

const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const slice=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i+1);assert(i>=0&&j>i,a);return html.slice(i,j)};
const base=JSON.parse(JSON.stringify(vm.runInNewContext(slice('const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+";buildFacilitySite('base')")));
const temple=base.davidTemple;
assert(temple,'genuine authored temple metadata required');
assert.deepEqual([base.map.width,base.map.height],[128,128]);
assert(base.map.world.some(o=>o.type==='monsterStoneDavid'&&o.x===24&&o.z===104&&o.y===0));
assert.equal(base.map.world.filter(o=>o.type==='monsterStoneDavid').length,1);
// Exercise the actual import validator as facilityLoadMap does, including
// exported floor offsets and all palette entries present before catalog build.
const validation=vm.runInNewContext(
 slice('let MAP_W=16,MAP_H=16','const palette=[').split('\n')[0]+
 slice('const palette=[','const catalog=new Map')+
 slice('function validModel(','function loadData(')+
 slice('function facilityExportMap(','function facilityDownload(')+
 ';({validate:pineValidateWorldData,exportMap:facilityExportMap,palette})');
const ids=new Set(validation.palette.map(p=>p.id));
for(const id of ['monsterStoneDavid','poiDavidGatePier','poiDavidTempleColumn','poiDavidWaystone'])assert(ids.has(id),'live initial catalog: '+id);
assert.equal(validation.validate(validation.exportMap(base.map)).newW,128);

const anchor='  freeMovementPose:()=>({x:poiWalkViewX,z:poiWalkViewZ,level:poiWalkLevel}),';
const insert=(s,k,v)=>{assert.equal(s.split(k).length,2,k);return s.replace(k,k+v)};
let fixture=insert(html,anchor,`
  davidQA:{
   retreatStep:()=>{
    const start=[poiWalkX,poiWalkZ],goal=[24,101];
    if(start[0]===goal[0]&&start[1]===goal[1])return {done:true};
    const q=[[...start,null]],seen=new Set([start.join(',')]);
    for(let i=0;i<q.length;i++){
     const [x,z,first]=q[i];
     for(const [dx,dz,key] of [[0,-1,'ArrowUp'],[1,0,'ArrowRight'],[0,1,'ArrowDown'],[-1,0,'ArrowLeft']]){
      const xx=x+dx,zz=z+dz,id=xx+','+zz;
      if(xx<14||xx>27||zz<101||zz>107||seen.has(id)||!poiWalkCanStep(xx,zz,x,z))continue;
      const route=first??{x:xx,z:zz,key};if(xx===goal[0]&&zz===goal[1])return route;
      seen.add(id);q.push([xx,zz,route]);
     }
    }
    return null;
   },
   aimTest:(roll,target)=>{
    const f=window.__davidFrames;
    f.roll=roll;f.aimTarget=target;f.beamClock={now:performance.now()};
   },
   releaseBeamClock:()=>{window.__davidFrames.beamClock=null},
   sound:()=>({running:poiAudioContext?.state==='running',events:window.__davidFrames.audio,stops:window.__davidFrames.audioStops}),
   pokeSound:(mode)=>{
    const {o,s}=poiDavidActive??{};
    if(!o)return;
    const b=poiDavidMatch(o),q={kind:'stomp',start:1,sx:s.x,sz:s.z};
    const p=poiAimOrigin(performance.now()),old=poiAudioLevels.se;
    if(mode==='mute')poiAudioLevels.se=0;
    if(mode==='outside')p.z=b.room.minZ-2;
    try{poiDavidAttackFoley(q,p,b,0,'impact')}finally{poiAudioLevels.se=old}
   },
   // Only the independent attack context picks a specific pattern. Real
   // walking, choice/wake, delivery, HP and the renderer stay production.
   prepare:kind=>{
    const pair=[...poiMonsterStates].find(([id])=>id.type==='monsterStoneDavid');
    if(!pair)return false;
    const [o,s]=pair;
    if(!s.david?.awake)return false;
    s.x=s.fromX=o.x;s.z=s.fromZ=o.z;
    // Sight the real beam from the open chamber, not below the dogleg
    // roof lip. A shallow side orbit can see up the descending flame.
    if(!workshopResumeRestorePosition({x:24,z:kind==='beam'?102:101,y:0,facing:2}))return false;
    if(kind==='beam'){poiThirdPerson=true;poiCameraYaw=.94;poiCameraPitch=.13;poiCameraDistance=4.7;}
    s.david.attack=null;s.david.next=-Infinity;
    poiPlayerHP=POI_PLAYER_MAX_HP;
    if(!poiDavidBegin(o,s,performance.now()+100,kind))return false;
    // Lock out only automatic follow-up selection in the isolated
    // battery. Original timing, hit shape, health and cues are untouched.
    window.__davidFrames.onlySelected=true;
    if(!window.__davidFrames.beamClock)window.__davidFrames.fatalClock={now:s.david.attack.start-100};
    if(window.__davidFrames.beamClock)window.__davidFrames.beamClock.first=s.david.attack.hits[0];
    return s.david.attack.start;
   },
   state:()=>{
    const [id,s]=[...poiMonsterStates].find(([o])=>o.type==='monsterStoneDavid')||[],f=window.__davidFrames;
    return {pos:[poiWalkX,poiWalkZ,poiWalkLevel],url:location.href,
     status:$('pineStartupCover').dataset.state,opens:f.coverShows,travel:poiDungeonEntranceSerial,step:poiWalkNextReady,
     now:performance.now(),hp:poiPlayerHP,death:poiPlayerDeath?.phase??null,returnFrames:f.returnFrames,returnAnchor:f.returnAnchor,scene:facilityViewLevel()<0?'cellar':'surface',
     draw:f.last,cue:f.cue,thermal:f.thermal??{},contacts:f.contacts,timing:f.timing,canceled:f.canceled,fan:f.fan,live:f.live,rays:f.rays,beamDraws:f.beamDraws,statue:id?{x:s.x,z:s.z,hp:s.hp,d:s.david??null,pose:poiDavidPose(s,performance.now())}:null};
   }
  },`);
fixture=fixture.replace('function poiDavidBeamSide(roll=Math.random())','function poiDavidBeamSide(roll=window.__davidFrames.roll??.8)');
fixture=insert(fixture,' source.connect(gain).connect(poiAudioEffects);',"\n const sample=[...poiRecordedFoleyCache].find(([k,b])=>b===buffer&&k.startsWith('david'));if(sample||buffer===poiDavidAlienCache){source.__davidSample={name:sample?.[0]??'davidAlienBeam',duration:buffer.duration,gain:gain.gain.value,linked:poiAudioEffects.context===ctx};}");
fixture=insert(fixture,'q.sweep={side,tell:now,start:null,end:null,angle:0,hit:false};',"\n     if(window.__davidFrames.aimTarget)workshopResumeRestorePosition({x:24+window.__davidFrames.aimTarget*2,z:102,y:0,facing:2});");
fixture=fixture.replace('draw(poiDavidCue.fan,vp)','{const f=window.__davidFrames,c=f.glCounters();draw(poiDavidCue.fan,vp);f.fan++;f.beamSubmission(q.start,"fan",now,c);}');
fixture=fixture.replace('if(poiDavidCue.beamVisible)poiDavidDrawThermalBeam(poiDavidCue.beam,vp,reduced?emission.alpha*.76:emission.alpha);',
 'if(poiDavidCue.beamVisible){window.__davidFrames.emission={now,turning:emission.turning,fraction:emission.fraction};poiDavidDrawThermalBeam(poiDavidCue.beam,vp,reduced?emission.alpha*.76:emission.alpha);}');
fixture=insert(fixture,'function poiDavidDrawThermalBeam(g,vp,alpha){',`
 const probe=window.__davidFrames,before=probe.glCounters(),e=probe.emission,kind=e.turning?'live':'straight';
 const buffer=probe.bufferIds.get(g.buf)||probe.nextBuffer++;
 probe.bufferIds.set(g.buf,buffer);
 const sample=probe.thermal??={},key=poiDavidCue.q.start+':'+kind;
 let pre,w,h;
 if(e.fraction>=.8&&(sample[key]?.length??0)<3){
  w=gl.drawingBufferWidth;h=gl.drawingBufferHeight;pre=new Uint8Array(w*h*4);
  gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pre);
 }
`);
fixture=insert(fixture,'draw(g,vp,0,g.coreCount);',`
 if(e.turning)probe.live++;
 else probe.cue.beam++;
 probe.beamSubmission(poiDavidCue.q.start,kind,e.now,before,{buffer,fraction:e.fraction});
 if(pre){
  const after=new Uint8Array(pre.length);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,after);
  let count=0,warm=0,x0=w,y0=h,x1=0,y1=0,key0=2166136261;
  for(let i=0;i<after.length;i+=4){
   if(Math.abs(pre[i]-after[i])+Math.abs(pre[i+1]-after[i+1])+Math.abs(pre[i+2]-after[i+2])<20)continue;
   count++;if(after[i]>=after[i+1]+8&&after[i+1]>=after[i+2]+5)warm++;
   const x=(i/4)%w,y=Math.floor(i/4/w);x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
   key0=Math.imul(key0^i^after[i],16777619);
  }
  (sample[key]??=[]).push({count,warm,key:key0,bounds:[x0,y0,x1,y1],n:g.count,core:g.coreCount});
 }
`);
fixture=insert(fixture,'m=poiDavidSweepBeamMesh(q,b,now);', "\n   if(emission.turning&&m.p.length){const ray=poiDavidBeamRay(q,q.sweep.angle);window.__davidFrames.rays.push({start:q.start,side:q.sweep.side,angle:q.sweep.angle,x:ray.x,z:ray.z,vertices:m.p.length/3});}");
fixture=insert(fixture,'   const {x:cx,y,z:cz,attack,heading,david}=poiMonsterPose(obj,s,now),part=mesh();', "\n   if(obj.type==='monsterStoneDavid'&&s.david?.returning){const f=window.__davidFrames;f.returnFrames.push([s.x,s.z,cx-.5,cz-.5]);}");
fixture=insert(fixture,'function poiDavidReturnFrame(o,s,b,now){',
 "\n window.__davidFrames.returnClock??={now};");
fixture=insert(fixture,'function poiDavidArrive(s,now){',
 "\n window.__davidFrames.returnClock=null;");
fixture=insert(fixture,'function poiDavidCease(o,s,b,now){', "\n if(s.david?.awake&&!s.david.returning)window.__davidFrames.returnAnchor=[s.x,s.z];");
fixture=insert(fixture,'function render(){','\n window.__davidFrames?.next();');
// Bound the shared update/renderer clock only for directional beam and walk-home samples:
// a software-WebGL host can skip the entire (110,450) ms telegraph even
// without meeting the game's separate 750 ms anti-replay cancellation. The
// same production function still generates, uploads and submits every mesh.
const renderStart=fixture.indexOf('function render(){');
assert(renderStart>=0);
const renderClock=' const now=performance.now();', clockAt=fixture.indexOf(renderClock,renderStart);
assert(clockAt>renderStart&&clockAt-renderStart<400);
fixture=fixture.slice(0,clockAt)+" const now=window.__davidFrames.renderTime(performance.now());"+fixture.slice(clockAt+renderClock.length);

fixture=insert(fixture,' if(!poiDavidCue){','window.__davidFrames.cue.builds++;window.__davidFrames.cue.byStart[q.start]=(window.__davidFrames.cue.byStart[q.start]||0)+1;');
fixture=insert(fixture,' const priorHP=poiPlayerHP;',"\n if(obj.type==='monsterStoneDavid')window.__davidFrames.contacts.push({start:poiDavidActive?.s?.david?.attack?.start,raw,amount,now,hp:Math.max(0,priorHP-amount)});");
fixture=insert(fixture,'   const i=q.cursor++,late=now-q.hits[i];',"\n   { const impact=window.__davidFrames; (impact.timing[q.start]??=[]).push({i,late:now-q.hits[i],inside:poiDavidArea(q,p),clear:poiDavidLine({x:q.sx,z:q.sz},p,b)}); }");
fixture=insert(fixture,' if(q&&(poiDavidHidden()||q.interrupted||now-q.lastFrameAt>750)){',"\n  window.__davidFrames.canceled[q.start]={gap:now-q.lastFrameAt,hidden:poiDavidHidden(),interrupted:!!q.interrupted};");
fixture=insert(fixture,' if(q&&now>=q.until){d.attack=null;poiMonsterMeshDirty=true}',"\n if(window.__davidFrames.onlySelected)return false;");
fixture=insert(fixture,'draw(poiDavidCue.lane,vp)',';window.__davidFrames.cue.lane++;');
fixture=insert(fixture,'function poiWildRegionalFrame(now,rng){','return;');
fixture=insert(fixture,'function poiWildPick(rng){','return null;');
for(const [,js] of fixture.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(js);
if(process.env.DAVID_LAYOUT_ONLY==='1'){
 console.log('PASS David’s unique authored statue and actual source fixture anchors/JS');
 process.exit(0);
}

const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(req.url==='/seed'?'<!doctype html><title>David disposable save</title>':fixture)});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const url='http://127.0.0.1:'+server.address().port;
const install=()=>{
 let frame=0,draws=0,vertices=0;
 const summary=window.__davidFrames={coverShows:0,cue:{lane:0,beam:0,builds:0,byStart:{}},contacts:[],timing:{},canceled:{},audio:[],audioStops:[],fan:0,live:0,rays:[],beamDraws:{},beamClock:null,returnClock:null,fatalClock:null,bufferIds:new WeakMap(),nextBuffer:1,
  renderTime(real){
   const c=this.returnClock||this.beamClock||this.fatalClock;if(!c)return real;
   const lead=c.first-c.now,cap=this.returnClock?86:this.fatalClock&&!this.beamClock?245:lead>0&&lead<=225?47:120;
   c.now=Math.max(c.now,Math.min(real,c.now+cap));return c.now;
  },
  glCounters(){return [draws,vertices]},
  beamSubmission(start,kind,now,[priorDraws,priorVertices],extra={}){
   (this.beamDraws[start]??=[]).push({kind,now,draws:draws-priorDraws,vertices:vertices-priorVertices,...extra});
  },returnFrames:[],returnAnchor:null,last:null,next(){
  if(frame>0)this.last={frame,draws,vertices};frame++;draws=0;vertices=0;
 }};
 for(const Proto of [globalThis.WebGLRenderingContext?.prototype,globalThis.WebGL2RenderingContext?.prototype].filter(Boolean)){
  const old=Proto.drawArrays;if(!old)continue;
  Proto.drawArrays=function(mode,start,count){draws++;vertices+=count;return old.apply(this,arguments)};
 }
 const nativeStart=AudioBufferSourceNode.prototype.start;
 AudioBufferSourceNode.prototype.start=function(...args){
  const result=nativeStart.apply(this,args);if(this.__davidSample)summary.audio.push({...this.__davidSample,state:this.context.state,when:args[0],loop:this.loop});return result;
 };
 const nativeStop=AudioBufferSourceNode.prototype.stop;
 AudioBufferSourceNode.prototype.stop=function(when){
  const result=nativeStop.call(this,when);const now=this.context.currentTime;
  if(this.__davidSample&&Number.isFinite(when)&&when-now<.067)summary.audioStops.push({name:this.__davidSample.name,time:when,now});
  return result;
 };
 document.addEventListener('DOMContentLoaded',()=>{
  const c=document.getElementById('pineStartupCover');if(!c)return;
  new MutationObserver(()=>{if(!c.hidden&&c.dataset.state!=='ready')summary.coverShows++})
   .observe(c,{attributes:true,attributeFilter:['hidden','data-state']});
 });
};
const screenshots=process.env.FACILITY_SCREENSHOTS;
async function shot(p,name){
 if(!screenshots)return;
 try{await p.screenshot({path:screenshots+'/'+name,timeout:6500})}
 catch(e){if(e.name!=='TimeoutError')throw e;console.log('Optional screenshot timed out:',name)}
}
const save={version:1,route:'facility',id:'base',play:true,position:{x:24,z:91,y:0,facing:2},townLayout:5,townMapHeight:128,
 view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.35,orbitDistance:5.5}};
const economy={version:1,weapon:'equipWoodSword',potions:0,gold:37,claimedCaches:['glade']};
const editor={format:'forest-world-v1',version:1,width:30,height:30,size:30,world:[{x:2,y:0,z:2,type:'stonewall',rot:1}],models:[],prefabs:[],terrainHeights:[],checks:[]};
const qa=p=>p.evaluate(()=>window.__editorTest.davidQA.state());
const wait=(p,fn,arg=null,timeout=9000)=>p.waitForFunction(fn,arg,{polling:35,timeout});
async function start(browser){
 const ctx=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:.7,isMobile:true,hasTouch:true});
 await ctx.addInitScript(install);const p=await ctx.newPage(),errors=[];
 p.on('pageerror',e=>errors.push(e.stack||e.message));
 p.on('console',m=>{if(m.type()==='error')m.args().at(-1)?.evaluate(e=>e?.stack||e?.message||String(e)).then(x=>errors.push(m.text()+' '+x),()=>errors.push(m.text()))});
 p.setDefaultTimeout(15000);
 try{
  await p.goto(url+'/seed');
  await p.evaluate(({save,economy,editor})=>{
   localStorage.setItem('world-workshop-resume-v1',JSON.stringify(save));
   localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify(economy));
   localStorage.setItem('forest-world-editor-v1',JSON.stringify(editor));
  },{save,economy,editor});
  await p.goto(url+'/?resume=1&test=1',{waitUntil:'domcontentloaded',timeout:25000});
  await wait(p,()=>{const el=document.getElementById('pineStartupCover');return !!el&&(el.hidden||el.dataset.state==='failed')},null,21000);
  if(!(await p.locator('#pineStartupCover').evaluate(el=>el.hidden)))throw Error('actual startup failed: '+JSON.stringify(errors));
  await wait(p,()=>window.__editorTest?.davidQA&&window.__editorTest.facility().active);
  return{p,ctx,errors};
 }catch(e){
  console.error('david early boot',await p.locator('#pineStartupCover').evaluate(el=>({state:el.dataset.state,hidden:el.hidden,text:el.textContent})).catch(()=>null),errors);
  await ctx.close();throw e
 }
}
const TEMPLE_IN=[[24,91],[24,92],[24,93],[24,94],[24,95],[25,95],[25,96],[25,97],[24,97],[23,97],[23,98],[23,99],[24,99],[24,100],[24,101],[24,102]],TEMPLE_NEAR=[[23,102],[22,102],[21,102],[20,102],[19,102],[18,102],[17,102]];
async function routeWalk(p,points,after=()=>{}){
 for(const [x,z] of points){
  const {pos:[cx,cz]}=await qa(p);
  if(x===cx&&z===cz)continue;
  assert(Math.abs(x-cx)+Math.abs(z-cz)===1,JSON.stringify({from:[cx,cz],to:[x,z]}));
  await step(p,x>cx?'ArrowRight':x<cx?'ArrowLeft':z>cz?'ArrowDown':'ArrowUp',x,z);await after();
 }
}
async function escapeChamber(p){
 // The old row can contain the real boss and cannot be walked through.
 // Choose the next cardinal step from the live collision geometry.
 for(let i=0;i<28;i++){
  const n=await p.evaluate(()=>window.__editorTest.davidQA.retreatStep());
  if(n?.done)return;
  if(!n){await p.waitForTimeout(180);continue}
  await p.keyboard.press(n.key);
  try{await wait(p,([x,z])=>{const q=window.__editorTest.davidQA.state();return q.pos[0]===x&&q.pos[1]===z&&q.now>=q.step},[n.x,n.z],1200);}
  catch(e){if(e.name!=='TimeoutError')throw e;} // actor can cross after planning: replan, never teleport
 }
 assert.fail('could not physically reach the escape lip: '+JSON.stringify(await qa(p)));
}
async function inside(browser){
 const session=await start(browser),p=session.p;
 await routeWalk(p,TEMPLE_IN.slice(1));
 await wait(p,()=>window.__editorTest.davidQA.state().statue?.d?.wakeDone);
 return session;
}
async function step(p,key,x,z){
 await p.keyboard.press(key);
 await wait(p,([x,z])=>{
  const v=window.__editorTest.davidQA.state();
  return v.pos[0]===x&&v.pos[1]===z&&v.pos[2]===0&&v.now>=v.step;
 },[x,z]);
}
function assertNativeReturn(v,label){
 assert(v.returnAnchor&&(v.returnAnchor[0]!==24||v.returnAnchor[1]!==104),label+' starts genuinely displaced');
 assert(v.returnFrames.length>=2,label+' emits distinct renderer poses during return');
 const legal=frame=>frame[0]>=13&&frame[0]<=35&&frame[1]>=93&&frame[1]<=115;
 assert(v.returnFrames.every(legal),label+' remains inside arena cells');
 for(let i=1;i<v.returnFrames.length;i++){
  const [x,z,rx,rz]=v.returnFrames[i], [a,b,ax,az]=v.returnFrames[i-1];
  // The actual free ratchet can cross both rounded-cell boundaries in
  // a diagonal frame; it cannot jump a cell or a full physical tile.
  assert(Math.max(Math.abs(x-a),Math.abs(z-b))<=1&&Math.hypot(rx-ax,rz-az)<=1.05,
   label+' continuous return cells: '+JSON.stringify([v.returnFrames[i-1],v.returnFrames[i]]));
 }
 assert(v.returnFrames.some(([, ,x,z])=>Math.abs(x-Math.round(x))+Math.abs(z-Math.round(z))>.01),label+' real visual interpolation between cells');
}
let browser,checkpoint='boot';
try{
 if(screenshots)await mkdir(screenshots,{recursive:true});
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const {p,ctx,errors}=await start(browser);
 try{
  let s;
  checkpoint='real old v270 save outside doorway';
  const far=await qa(p);assert.deepEqual(far.pos,[24,91,0]);
  assert.equal(far.status,'ready');
  await wait(p,t=>window.__editorTest.davidQA.state().now>=t+1150,far.now);
  const rested=await qa(p);assert(!rested.statue?.d?.awake);assert(!rested.statue?.d?.attack);
  assert.deepEqual(rested.cue,{lane:0,beam:0,builds:0,byStart:{}},'dormant room uploads no attack mesh');
  if(far.statue&&rested.statue)assert.deepEqual([rested.statue.x,rested.statue.z,rested.statue.hp,rested.statue.pose],[far.statue.x,far.statue.z,far.statue.hp,far.statue.pose],'distant boss/pose does not move or advance combat');
  checkpoint='physical crossing and awakening without any warp/cover';
  await routeWalk(p,TEMPLE_IN.slice(1),async()=>{
   s=await qa(p);
   assert.equal(s.travel,far.travel);assert.equal(s.opens,far.opens);assert.equal(s.url,far.url);assert.equal(s.status,'ready');assert.equal(s.scene,'surface');
  });
  await wait(p,()=>window.__editorTest.davidQA.state().statue?.d?.awake);
  s=await qa(p);assert.equal(s.statue.hp,1050,'tuned David is deliberately beyond ordinary early-game weapons');
  if(screenshots)await shot(p,"david-temple-wake.png");
  checkpoint='approach produces real boss displacement before physical retreat';
  await p.evaluate(()=>{window.__davidFrames.fatalClock={now:performance.now()}});
  await routeWalk(p,TEMPLE_NEAR);
  await wait(p,()=>{const s=window.__editorTest.davidQA.state().statue;return s?.d?.awake&&(s.x!==24||s.z!==104)},null,25000);
  checkpoint='physical retreat cancels any chase or threat into exterior';
  await escapeChamber(p);
  await routeWalk(p,TEMPLE_IN.slice(0,-1).reverse());
  const back=await qa(p);
  await wait(p,t=>window.__editorTest.davidQA.state().now>=t+1550,back.now);
  s=await qa(p);assert.deepEqual(s.pos,[24,91,0]);assert(!s.statue?.d?.attack);
  assert(!s.statue?.d?.awake||s.statue.d.returning,'crossing exterior cancels any future strike immediately');
  await wait(p,()=>{const s=window.__editorTest.davidQA.state().statue;return !s?.d?.awake&&(!s||s.x===24&&s.z===104)});
  s=await qa(p);
  assert.equal(s.hp,back.hp);assert.equal(s.travel,far.travel);assert.equal(s.opens,far.opens);
  assertNativeReturn(s,'physical exit');
  const pack=()=>p.evaluate(()=>JSON.parse(localStorage.getItem('world-workshop-hotbar-v1')));
  assert.equal((await pack()).gold,37);
  checkpoint='cold genuine outside resume retains prior v270 save and same room';
  await p.reload({waitUntil:'domcontentloaded',timeout:25000});await p.locator('#pineStartupCover').waitFor({state:'hidden'});
  await wait(p,()=>window.__editorTest?.davidQA&&window.__editorTest.facility().active);
  s=await qa(p);assert.deepEqual(s.pos,[24,91,0]);assert.equal((await pack()).gold,37);
  assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('forest-world-editor-v1')).world[0].type),'stonewall');
  assert.deepEqual(errors,[]);
 }catch(e){console.error(checkpoint,await qa(p).catch(()=>null),errors);throw e}
 finally{await ctx.close()}
 const battle=await inside(browser);
 try{
  await battle.p.touchscreen.tap(690,200);
  await wait(battle.p,()=>window.__editorTest.davidQA.sound().running);
  for(const kind of ['sweep','double','stomp','beam']){
   checkpoint='genuine '+kind+' live pose and contact';
   let passed=false;
   for(let attempt=0;attempt<4&&!passed;attempt++){
    const t=await battle.p.evaluate(kind=>window.__editorTest.davidQA.prepare(kind),kind);
    assert(t,kind+' test selects through the real boss commit entry');
    const pre=await qa(battle.p);
    const audioStart=(await battle.p.evaluate(()=>window.__editorTest.davidQA.sound())).events.length;
    assert.equal(pre.statue.d.attack.kind,kind);
    assert.equal(pre.statue.d.attack.start,t);
    assert.equal(pre.statue.pose.kind,kind);assert.equal(pre.statue.pose.phase,"windup");
    assert.equal(pre.statue.d.attack.hits.length,kind==='double'?2:1);
    assert.equal(pre.hp,100,'no anticipation damage on selected '+kind);
    const raw={sweep:[30],double:[28,35],stomp:[39],beam:[47]}[kind];
    await wait(battle.p,({start,hits})=>{
     const v=window.__editorTest.davidQA.state();
     return v.canceled[start]||v.contacts.filter(a=>a.start===start).length>=hits;
    },{start:t,hits:raw.length});
    const hit=await qa(battle.p),contacts=hit.contacts.filter(a=>a.start===t);
    if(contacts.length<raw.length&&hit.canceled[t]){
     const reason=hit.canceled[t];
     assert(reason.gap>750&&!reason.hidden&&!reason.interrupted,'only measured foreground CI render starvation warrants retry');
     console.log('Retry',kind,'after measured frame discontinuity',reason.gap,'ms');
     continue;
    }
    assert.deepEqual(contacts.map(a=>a.raw),raw,kind+' commits each authored damage exactly once');
    assert(hit.hp<100&&hit.hp>0,kind+' one window is threatening but survivable');
    if(kind==='double')assert(contacts[1].now-contacts[0].now>=319.999,'live double hits never bunch under frame lag');
    assert.equal(hit.hp,100-contacts.reduce((n,a)=>n+a.amount,0),'real starter armor remains in the damage path');
    assert.equal(hit.cue.byStart[t],1,'cue mesh is cached for the exact committed '+kind);
    assert(hit.cue.lane>pre.cue.lane&&hit.draw.draws>0,'actual WebGL floor cue drawn');
    if(kind==='beam'){
     await wait(battle.p,n=>window.__editorTest.davidQA.state().cue.beam>n,pre.cue.beam);
     const pixels=(await qa(battle.p)).thermal[t+':straight'];
     assert(pixels?.some(s=>s.count>15&&s.warm>5&&s.n>s.core&&s.core>30),JSON.stringify(pixels));
    }
    else assert.equal(hit.cue.beam,pre.cue.beam);
    const names={sweep:['davidBladeSweep'],double:['davidSwordFirst','davidSwordSecond'],stomp:['davidHeavyStomp'],beam:['davidAlienBeam']}[kind];
    await wait(battle.p,n=>window.__editorTest.davidQA.sound().events.length>=n,audioStart+names.length);
    const audio=(await battle.p.evaluate(()=>window.__editorTest.davidQA.sound())).events.slice(audioStart);
    assert.deepEqual(audio.map(a=>a.name),names);
    assert(audio.every(a=>a.linked&&a.state==='running'&&a.duration>.2&&a.gain>0));
    if(kind==='double')assert(audio[1].when-audio[0].when>.29);
    if(kind==='beam'){
     await wait(battle.p,()=>!window.__editorTest.davidQA.state().statue?.d?.attack);
     assert.equal((await battle.p.evaluate(()=>window.__editorTest.davidQA.sound())).events.length,audioStart+names.length);
    }
    console.log(kind,contacts.map(a=>a.raw),hit.hp,audio.map(a=>a.name));
    passed=true;
   }
   assert(passed,'No uninterrupted real native frame sample for '+kind);
  }
  for(const [roll,side,target,shouldHit] of [[.15,-1,-1,true],[.35,1,-1,false]]){
   checkpoint='measured native extended beam '+side;
   let complete=false;
   for(let attempt=0;attempt<4&&!complete;attempt++){
    const initial=await battle.p.evaluate(({roll,target})=>{
     const q=window.__editorTest.davidQA;q.aimTest(roll,target);
     return {start:q.prepare('beam'),audio:q.sound().events.length,state:q.state()};
    },{roll,target});
    assert(initial.start);
    await wait(battle.p,t=>{const q=window.__editorTest.davidQA.state();return q.canceled[t]||!q.statue?.d?.attack},initial.start);
    const r=await qa(battle.p);
    if(r.canceled[initial.start]){
     const reason=r.canceled[initial.start];
     assert(reason.gap>750&&!reason.hidden&&!reason.interrupted);
     continue;
    }
    const rays=r.rays.filter(a=>a.start===initial.start);
    const drawSamples=r.beamDraws[initial.start]??[];
    const fan=drawSamples.filter(d=>d.kind==='fan'),red=drawSamples.filter(d=>d.kind==='live');
    assert(fan.length>0&&red.length>0&&fan[0].now<red[0].now,
     'same committed attack submits native ground wedge before red-eye beam: '+JSON.stringify(drawSamples));
    assert(drawSamples.every(d=>d.draws>0&&d.vertices>0),'actual WebGL draw calls');
    const pixels=r.thermal[initial.start+':live'];
    assert(pixels?.some(s=>s.count>15&&s.warm>5&&s.n>s.core&&s.core>30),JSON.stringify(pixels));
    assert(new Set(pixels.filter(s=>s.count>5).map(s=>s.key)).size>=2,'moving beam changes actual displayed pixels');

    assert(rays.some(a=>a.side===side&&Math.sign(a.x)===side&&Math.abs(a.angle)>.20&&a.vertices>=12),JSON.stringify(rays));
    const contacts=r.contacts.filter(c=>c.start===initial.start);
    assert.deepEqual(contacts.map(c=>c.raw),shouldHit?[47,36]:[47],'only live sweeping ray can apply the extra contact once');
    const audio=(await battle.p.evaluate(()=>window.__editorTest.davidQA.sound())).events.slice(initial.audio);
    assert.deepEqual(audio.map(a=>a.name),['davidAlienBeam']);
    assert(audio[0].loop&&audio[0].linked&&audio[0].state==='running','one real looping source on normal SE bus');
    const hold=drawSamples.filter(d=>d.kind==='straight');
    const partial=hold.filter(d=>d.fraction>0&&d.fraction<.99);
    assert(partial.length>=2&&partial[0].fraction<partial.at(-1).fraction,'visible eye-to-wall progression in native draws');
    const fanTimes=new Set(fan.map(d=>d.now));
    assert(hold.some(d=>d.fraction===1&&fanTimes.has(d.now)),'the held ray and fan warning draw in the same native frame');
    assert.equal(new Set([...hold,...red].map(d=>d.buffer)).size,1,'one actual WebGL buffer holds through growth / warning / sweep');
    complete=true;
   }
   assert(complete,'no real native frame sequence for extended beam '+side);
   await battle.p.evaluate(()=>window.__editorTest.davidQA.releaseBeamClock());
  }
  const before=(await battle.p.evaluate(()=>window.__editorTest.davidQA.sound())).events.length;
  await battle.p.evaluate(()=>{window.__editorTest.davidQA.pokeSound('mute');window.__editorTest.davidQA.pokeSound('outside')});
  assert.equal((await battle.p.evaluate(()=>window.__editorTest.davidQA.sound())).events.length,before);
  if(screenshots)await battle.p.screenshot({path:screenshots+'/david-temple-arena.png'});
  assert.deepEqual(battle.errors,[]);
 }catch(e){console.error(checkpoint,JSON.stringify(await qa(battle.p).catch(()=>null)),battle.errors);throw e}
 finally{await battle.ctx.close()}
 const fatal=await start(browser),fp=fatal.p;
 try{
  checkpoint='true vulnerable David encounter, death and sound-canceled walking return';
  // On this new context a random canvas-area tap is not an audio action.
  // A native foreground key event enters the same next dry tile and runs
  // the production footstep SE while Chromium has a trusted user gesture.
  await fp.bringToFront();
  await wait(fp,()=>!document.hidden&&document.hasFocus(),null,9000);
  const route=TEMPLE_IN.slice(1);
  const running=()=>window.__editorTest.davidQA.sound().running;
  await routeWalk(fp,[route.shift()]);
  try{await wait(fp,running,null,2400)}catch(e){
   if(e.name!=='TimeoutError')throw e;
   // Touch the actual primary action, not guessed pixels. If audio hasn't
   // resumed yet, the second normal outside footstep gets a fresh gesture.
   await fp.locator('#poiWalkAction').tap({timeout:5000});
   await routeWalk(fp,[route.shift()]);
   await wait(fp,running,null,9000);
  }
  // A 1,008ms software WebGL stall correctly aborts an active leap,
  // leaving this independently seeded player alive. Bound just the shared
  // encounter render clock to native playable increments. No attack,
  // damage, route, frames, death or audio source is injected.
  await fp.evaluate(()=>{window.__davidFrames.fatalClock={now:performance.now()}});
  await routeWalk(fp,route);
  await wait(fp,()=>window.__editorTest.davidQA.state().statue?.d?.awake,null,22000);
  await routeWalk(fp,TEMPLE_NEAR);
  await wait(fp,()=>{const s=window.__editorTest.davidQA.state().statue;return s?.d?.awake&&(s.x!==24||s.z!==104)},null,25000);
  await wait(fp,()=>window.__editorTest.davidQA.state().contacts.some(h=>h.hp===0),null,60000);
  await wait(fp,()=>{const s=window.__editorTest.davidQA.state().statue;return !s?.d?.awake&&s?.x===24&&s?.z===104},null,12000);
  const summary=await qa(fp),audio=await fp.evaluate(()=>window.__editorTest.davidQA.sound());
  assertNativeReturn(summary,'real fatal contact');
  assert(audio.stops.length>0,'David-owned playback faded and scheduled stop after lethal contact');
  assert(audio.stops.every(x=>x.name.startsWith('david')&&x.time-x.now>=0));
  assert.deepEqual(fatal.errors,[]);
 }catch(e){console.error(checkpoint,JSON.stringify(await qa(fp).catch(()=>null)),fatal.errors);throw e}
 finally{await fatal.ctx.close()}
 console.log('PASS real same-scene temple walk, four authored boss hits, safe physical retreat and preserved cold resume');
}finally{await browser?.close();await new Promise(r=>server.close(r))}
