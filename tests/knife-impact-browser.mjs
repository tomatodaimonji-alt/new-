import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const old=process.argv[3]?readFileSync(process.argv[3],'utf8'):null;
const hook='function poiSound(kind,weapon=null,defeated=false){';
function observe(page){
 assert.equal(page.split(hook).length,2);
 return page.replace(hook,`window.__knifeAudio.warm=()=>poiAudioStart(true);
window.__knifeAudio.emit=(...args)=>poiSound(...args);
function poiSound(kind,weapon=null,defeated=false){
 const previous=window.__qaSoundRoute;
 window.__qaSoundRoute={kind,weapon,defeated};
 if(kind==='attack'||kind==='hit')window.__knifeAudio.routed.push(window.__qaSoundRoute);
 try{return __qaNativeSound(kind,weapon,defeated)}finally{window.__qaSoundRoute=previous}
}
function __qaNativeSound(kind,weapon=null,defeated=false){`);
}
const candidate=observe(html),baseline=old?observe(old):null;
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url.startsWith('/seed')?'<!doctype html><title>Isolated fixtures</title>':req.url.startsWith('/before')?baseline:candidate);
});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const origin='http://127.0.0.1:'+server.address().port;
const map={format:'forest-world-v1',version:1,width:30,height:30,size:30,
 world:[{x:2,y:0,z:2,type:'stonewall',rot:1},{x:15,y:0,z:12,type:'bed',rot:2}],
 models:[],prefabs:[],terrainHeights:[],checks:[]};
const guild={...map,world:[{x:7,y:0,z:6,type:'stonewall',rot:0}]};
const fixtures={
 'forest-world-editor-v1':JSON.stringify(map,null,2),
 'world-workshop-pois-v1':JSON.stringify([
  {id:'poi-guild-primary-v87',name:'ギルド',map:guild},
  {id:'poi-adventurers-guild-v102',name:'冒険者ギルド',map:guild}],null,2),
 'pine-guild-screenshot-before-v86':JSON.stringify(guild,null,2),
 'pine-adventurers-guild-poi-before-v102':JSON.stringify({keep:'fixture'}),
 'world-workshop-guild-duplicates-v105':JSON.stringify({version:1,records:[
  {id:'poi-old-archive',name:'冒険者ギルド',map:guild}]}),
 'world-workshop-adventure-v1':'{"version":1,"x":23,"z":24,"hp":84,"monsters":[]}',
 'world-workshop-audio-v2':'{"master":81,"bgm":62,"se":88,"enabled":true}'
};
const resumeKey='world-workshop-resume-v1';
const state=page=>page.evaluate(()=>window.__editorTest?.facility?.()??null);
async function unchanged(page){
 const before=await page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),Object.keys(fixtures));
 assert.deepEqual(before,fixtures,'route must not write existing editor, Guild/archives, adventure, or audio settings');
}
const open='#enterGameWorld';
async function launch(browser,id='base',start={x:19,z:45},{camera=false,yaw=.24,orbitYaw=0,pitch=.24,townLayout=5,facing=2,kit=null,clockStart=null,fixture='',dist=5.5,level=0,muted=false}={}){
 const ctx=await browser.newContext({viewport:{width:320,height:740},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 await ctx.addInitScript(()=>{
  const audio=window.__knifeAudio={routed:[],rendered:[],ctx:null,external:0};
  const p=AudioContext.prototype,make=p.createBufferSource,gain=p.createGain;
  p.createGain=function(...args){audio.ctx=this;return gain.apply(this,args)};
  const media=HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play=function(...args){audio.external++;return media.apply(this,args)};
  p.createBufferSource=function(){
   audio.ctx=this;
   const source=make.call(this),start=source.start;
   source.start=function(...args){
    const route=window.__qaSoundRoute;
    if(route&&(route.kind==='attack'||route.kind==='hit')&&this.buffer){
     const samples=this.buffer.getChannelData(0);
     let hash=1,peak=0,sum=0;
     for(let i=0;i<samples.length;i++){
      const n=samples[i];peak=Math.max(peak,Math.abs(n));sum+=n*n;
      hash=(Math.imul(31,hash)^Math.round(n*32768))>>>0;
     }
     audio.rendered.push({...route,ms:(args[0]-audio.ctx.currentTime)*1000,
      duration:this.buffer.duration,rate:this.buffer.sampleRate,peak,rms:Math.sqrt(sum/samples.length),hash});
    }
    return start.apply(this,args);
   };
   return source;
  };
 });
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
 await page.goto(origin+'/seed');
 await page.evaluate(({fixtures,resumeKey,id,start,camera,yaw,orbitYaw,pitch,townLayout,facing,kit,clockStart,dist,level,muted})=>{
  for(const [k,v] of Object.entries(fixtures))localStorage.setItem(k,v);
  if(clockStart!==null)localStorage.setItem('world-workshop-town-clock-v1',JSON.stringify({version:1,gameMs:clockStart*500}));
  if(muted)localStorage.setItem('world-workshop-audio-v2',JSON.stringify({master:81,bgm:62,se:0,enabled:true}));
  if(kit)localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify(kit));
  if(start)localStorage.setItem(resumeKey,JSON.stringify({version:1,route:'facility',id,play:true,position:{...start,y:level,facing},townLayout,
   view:{yaw,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:camera,orbitYaw,orbitPitch:pitch,orbitDistance:dist}}));
 },{fixtures,resumeKey,id,start,camera,yaw,orbitYaw,pitch,townLayout,facing,kit,clockStart,dist,level,muted});
 await page.goto(origin+'/'+fixture+(start?'?resume=1&test=1':'?facility='+id+'&test=1'));
 if(!start)await page.locator(open).tap();
 await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
 assert.equal((await state(page)).id,id);
 return {ctx,page,errors};
}
const knife='kitchenKnife',wood='equipWoodSword';
const stats=page=>page.evaluate(()=>window.__knifeAudio);
const stable=e=>e.map(({duration,rate,peak,rms,hash})=>({duration,rate,peak,rms,hash}));
const combatState=async page=>(await state(page)).combat;
function loadout(w){
 const slots=Array(27).fill(null);
 slots[0]={type:wood,count:1};slots[1]={type:knife,count:1,durability:20};
 return {version:1,weapon:w,potions:0,gold:12,slots};
}
async function exercise(browser,{weapon=knife,fixture='',muted=false,miss=false}={}){
 const pos=miss?{x:56,z:39}:{x:115,z:60};
 const {ctx,page,errors}=await launch(browser,'base',pos,{level:miss?0:-1,facing:miss?2:0,kit:loadout(weapon),fixture,muted});
 try{
  const mapBefore=await page.evaluate(()=>window.__editorTest.data());
  if(!miss)assert.ok((await combatState(page)).actors.some(a=>a.type==='monsterSlime'&&a.x===115&&a.z===59&&a.hp===35));
  // Start on a trusted non-combat gesture; autoplay can leave the initial
  // context suspended, especially in the outdoor no-target fixture.
  await page.evaluate(()=>document.addEventListener('pointerup',window.__knifeAudio.warm,{once:true,capture:true}));
  await page.locator('#view').tap({position:{x:160,y:170}});
  await page.waitForFunction(()=>window.__knifeAudio.ctx?.state==='running');
  await page.evaluate(()=>{window.__knifeAudio.routed=[];window.__knifeAudio.rendered=[]});
  await page.locator('#poiWalkAction').tap();
  await page.waitForFunction(()=>window.__knifeAudio.routed.some(r=>r.kind==='attack'));
  const a=await page.evaluate(()=>({route:window.__knifeAudio.routed,rendered:window.__knifeAudio.rendered}));
  let b=[];
  if(miss){
   assert.deepEqual(a.route,[{kind:'attack',weapon,defeated:false}],'empty attack does not route a hit');
  }else{
   const slime=(await combatState(page)).actors.find(o=>o.type==='monsterSlime'&&o.level===-1);
   assert(slime&&slime.hp<35&&slime.hp>0,'first real damage remains nonlethal');
   assert(a.route.some(r=>r.kind==='hit'&&r.weapon===weapon&&!r.defeated));
   if(!muted){
    const impact=a.rendered.find(r=>r.kind==='hit');
    assert(impact&&impact.peak>.03&&impact.rms>.003&&impact.ms>=70&&impact.ms<=135,
     'first impact genuinely schedules audible buffered contact around 108ms: '+JSON.stringify(a));
   }
   await page.waitForTimeout(410);
   await page.evaluate(()=>{window.__knifeAudio.routed=[];window.__knifeAudio.rendered=[]});
   await page.locator('#poiWalkAction').tap();
   await page.waitForFunction(()=>window.__knifeAudio.routed.some(r=>r.kind==='hit'&&r.defeated));
   b=await page.evaluate(()=>window.__knifeAudio.rendered.filter(r=>r.kind==='hit'&&r.defeated));
   assert.equal((await combatState(page)).actors.find(o=>o.type==='monsterSlime'&&o.level===-1).hp,0);
   assert.equal(b.length,muted?0:2,'defeat remains separate from actual impact');
  }
  if(muted)assert.deepEqual(a.rendered,[],'SE volume zero blocks audio starts but not combat');
  assert.equal(await page.evaluate(()=>window.__knifeAudio.external),0,'no HTML media playback bypasses effects routing');
  assert.deepEqual(await page.evaluate(()=>window.__editorTest.data()),mapBefore);
  if(!muted)await unchanged(page);
  assert.deepEqual(errors,[]);
  return {swing:stable(a.rendered.filter(r=>r.kind==='attack')),impact:stable(a.rendered.filter(r=>r.kind==='hit')),defeat:stable(b.slice(1))};
 }finally{await ctx.close();}
}
async function compareRoutes(browser,{fixture='',muted=false}={}){
 const {ctx,page,errors}=await launch(browser,'base',{x:56,z:39},{fixture,muted,kit:loadout(knife)});
 try{
  await page.evaluate(()=>document.addEventListener('pointerup',window.__knifeAudio.warm,{once:true,capture:true}));
  await page.locator('#view').tap({position:{x:160,y:170}});
  await page.waitForFunction(()=>window.__knifeAudio.ctx?.state==='running');
  const clips=await page.evaluate(({knife,wood})=>{
   const q=window.__knifeAudio;
   const grab=(kind,weapon,defeated=false)=>{
    q.rendered=[];q.emit(kind,weapon,defeated);return q.rendered.slice();
   };
   return {swing:grab('attack',knife),impact:grab('hit',knife),defeat:grab('hit',knife,true).slice(1),
    wood:grab('hit',wood),woodDefeat:grab('hit',wood,true).slice(1)};
  },{knife,wood});
  assert.deepEqual(errors,[]);
  if(muted)assert(Object.values(clips).every(a=>a.length===0),'SFX mute blocks all scheduled buffers');
  else assert(Object.values(clips).every(a=>a.length===1&&a[0].peak>.03),'separate real finalized WebAudio channels');
  return Object.fromEntries(Object.entries(clips).map(([name,events])=>[name,stable(events)]));
 }finally{await ctx.close()}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const hit=await exercise(browser),miss=await exercise(browser,{miss:true});
 assert.equal(hit.swing.length,1);assert.equal(hit.impact.length,1);
 assert.deepEqual(miss.swing,hit.swing,'miss uses exactly the same swing');
 const after=await compareRoutes(browser);
 assert.deepEqual(hit.impact,after.impact,'actual combat used the same knife impact');
 await compareRoutes(browser,{muted:true});
 if(baseline){
  const prior=await compareRoutes(browser,{fixture:'before'});
  assert.notDeepEqual(after.impact,prior.impact,'the one intended sound actually changed');
  for(const name of ['swing','defeat','wood','woodDefeat'])
   assert.deepEqual(after[name],prior[name],name+' PCM unchanged');
 }
 console.log('PASS actual kitchen knife AudioBuffer impact, unchanged wave routes, muted effects, and real damage/defeat');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
