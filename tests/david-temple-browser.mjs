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
   // Only the independent attack context picks a specific pattern. Real
   // walking, choice/wake, delivery, HP and the renderer stay production.
   prepare:kind=>{
    const pair=[...poiMonsterStates].find(([id])=>id.type==='monsterStoneDavid');
    if(!pair)return false;
    const [o,s]=pair;
    if(!s.david?.awake)return false;
    s.x=s.fromX=o.x;s.z=s.fromZ=o.z;
    if(!workshopResumeRestorePosition({x:24,z:101,y:0,facing:2}))return false;
    s.david.attack=null;s.david.next=-Infinity;
    poiPlayerHP=POI_PLAYER_MAX_HP;
    if(!poiDavidBegin(o,s,performance.now()+100,kind))return false;
    // Lock out only automatic follow-up selection in the isolated
    // battery. Original timing, hit shape, health and cues are untouched.
    window.__davidFrames.onlySelected=true;
    return s.david.attack.start;
   },
   state:()=>{
    const [id,s]=[...poiMonsterStates].find(([o])=>o.type==='monsterStoneDavid')||[],f=window.__davidFrames;
    return {pos:[poiWalkX,poiWalkZ,poiWalkLevel],url:location.href,
     status:$('pineStartupCover').dataset.state,opens:f.coverShows,travel:poiDungeonEntranceSerial,step:poiWalkNextReady,
     now:performance.now(),hp:poiPlayerHP,death:poiPlayerDeath?.phase??null,returnFrames:f.returnFrames,returnAnchor:f.returnAnchor,scene:facilityViewLevel()<0?'cellar':'surface',
     draw:f.last,cue:f.cue,contacts:f.contacts,timing:f.timing,canceled:f.canceled,statue:id?{x:s.x,z:s.z,hp:s.hp,d:s.david??null,pose:poiDavidPose(s,performance.now())}:null};
   }
  },`);
fixture=fixture.replace('function poiDavidBeamSide(roll=Math.random())','function poiDavidBeamSide(roll=.8)');
fixture=insert(fixture,'   const {x:cx,y,z:cz,attack,heading,david}=poiMonsterPose(obj,s,now),part=mesh();', "\n   if(obj.type==='monsterStoneDavid'&&s.david?.returning){const f=window.__davidFrames;f.returnFrames.push([s.x,s.z,cx-.5,cz-.5]);}");
fixture=insert(fixture,'function poiDavidCease(o,s,b,now){', "\n if(s.david?.awake&&!s.david.returning)window.__davidFrames.returnAnchor=[s.x,s.z];");
fixture=insert(fixture,'function render(){','\n window.__davidFrames?.next();');
fixture=insert(fixture,' if(!poiDavidCue){','window.__davidFrames.cue.builds++;window.__davidFrames.cue.byStart[q.start]=(window.__davidFrames.cue.byStart[q.start]||0)+1;');
fixture=insert(fixture,' const priorHP=poiPlayerHP;',"\n if(obj.type==='monsterStoneDavid')window.__davidFrames.contacts.push({start:poiDavidActive?.s?.david?.attack?.start,raw,amount,now,hp:Math.max(0,priorHP-amount)});");
fixture=insert(fixture,'   const i=q.cursor++,late=now-q.hits[i];',"\n   { const impact=window.__davidFrames; (impact.timing[q.start]??=[]).push({i,late:now-q.hits[i],inside:poiDavidArea(q,p),clear:poiDavidLine({x:q.sx,z:q.sz},p,b)}); }");
fixture=insert(fixture,' if(q&&(poiDavidHidden()||q.interrupted||now-q.lastFrameAt>750)){',"\n  window.__davidFrames.canceled[q.start]={gap:now-q.lastFrameAt,hidden:poiDavidHidden(),interrupted:!!q.interrupted};");
fixture=insert(fixture,' if(q&&now>=q.until){d.attack=null;poiMonsterMeshDirty=true}',"\n if(window.__davidFrames.onlySelected)return false;");
fixture=insert(fixture,'draw(poiDavidCue.lane,vp)',';window.__davidFrames.cue.lane++;');
fixture=insert(fixture,'draw(poiDavidCue.beam,vp)',';window.__davidFrames.cue.beam++;');
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
 const summary=window.__davidFrames={coverShows:0,cue:{lane:0,beam:0,builds:0,byStart:{}},contacts:[],timing:{},canceled:{},returnFrames:[],returnAnchor:null,last:null,next(){
  if(frame>0)this.last={frame,draws,vertices};frame++;draws=0;vertices=0;
 }};
 for(const Proto of [globalThis.WebGLRenderingContext?.prototype,globalThis.WebGL2RenderingContext?.prototype].filter(Boolean)){
  const old=Proto.drawArrays;if(!old)continue;
  Proto.drawArrays=function(mode,start,count){draws++;vertices+=count;return old.apply(this,arguments)};
 }
 document.addEventListener('DOMContentLoaded',()=>{
  const c=document.getElementById('pineStartupCover');if(!c)return;
  new MutationObserver(()=>{if(!c.hidden&&c.dataset.state!=='ready')summary.coverShows++})
   .observe(c,{attributes:true,attributeFilter:['hidden','data-state']});
 });
};
const screenshots=process.env.FACILITY_SCREENSHOTS;
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
async function inside(browser){
 const session=await start(browser),p=session.p;
 for(const z of [92,93,94,95,96,97,98,99,100,101])await step(p,'ArrowDown',24,z);
 await wait(p,()=>window.__editorTest.davidQA.state().statue?.d?.awake);
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
  const [x,z]=v.returnFrames[i], [a,b]=v.returnFrames[i-1];
  assert(Math.abs(x-a)+Math.abs(z-b)<=1,label+' step-by-step return cells');
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
  for(const z of [92,93,94,95,96,97,98]){
   await step(p,'ArrowDown',24,z);s=await qa(p);
   assert.equal(s.travel,far.travel);assert.equal(s.opens,far.opens);assert.equal(s.url,far.url);assert.equal(s.status,'ready');assert.equal(s.scene,'surface');
  }
  await wait(p,()=>window.__editorTest.davidQA.state().statue?.d?.awake);
  s=await qa(p);assert.equal(s.statue.hp,1050,'tuned David is deliberately beyond ordinary early-game weapons');
  if(screenshots)await p.screenshot({path:screenshots+'/david-temple-wake.png'});
  checkpoint='approach produces real boss displacement before physical retreat';
  await wait(p,()=>{const s=window.__editorTest.davidQA.state().statue;return s?.d?.awake&&(s.x!==24||s.z!==104)});
  checkpoint='physical retreat cancels any chase or threat into exterior';
  for(const z of [97,96,95,94,93,92,91])await step(p,'ArrowUp',24,z);
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
  for(const kind of ['sweep','double','stomp','beam']){
   checkpoint='genuine '+kind+' live pose and contact';
   let passed=false;
   for(let attempt=0;attempt<4&&!passed;attempt++){
    const t=await battle.p.evaluate(kind=>window.__editorTest.davidQA.prepare(kind),kind);
    assert(t,kind+' test selects through the real boss commit entry');
    const pre=await qa(battle.p);
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
    if(kind==='beam')await wait(battle.p,n=>window.__editorTest.davidQA.state().cue.beam>n,pre.cue.beam);
    else assert.equal(hit.cue.beam,pre.cue.beam);
    console.log(kind,contacts.map(a=>a.raw),hit.hp);
    passed=true;
   }
   assert(passed,'No uninterrupted real native frame sample for '+kind);
  }
  if(screenshots)await battle.p.screenshot({path:screenshots+'/david-temple-arena.png'});
  assert.deepEqual(battle.errors,[]);
 }catch(e){console.error(checkpoint,JSON.stringify(await qa(battle.p).catch(()=>null)),battle.errors);throw e}
 finally{await battle.ctx.close()}
 console.log('PASS real same-scene temple walk, four authored boss hits, safe physical retreat and preserved cold resume');
}finally{await browser?.close();await new Promise(r=>server.close(r))}
