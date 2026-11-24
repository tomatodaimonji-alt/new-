import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const baseline=process.argv.includes('--expect-before-fix');
function inject(s,a,b){assert.equal(s.split(a).length,2,a);return s.replace(a,b)}
const finish="  if(status!=='loading'||!initialized||!firstFrame)return;";
let fixture=inject(html,finish,finish+`
  if(window.__qaHoldCover){window.__qaReadyToReveal=true;window.__qaReleaseCover=()=>{window.__qaHoldCover=false;finish()};return}
`);
const api="  townResidents:()=>typeof poiTownResidentsSnapshot==='function'?poiTownResidentsSnapshot():null,";
fixture=inject(fixture,api,api+`
  startupAudioQA:()=>({ctx:poiAudioContext?.state,time:poiAudioContext?.currentTime,zone:poiAudioMusicZone(),
   state:document.getElementById('pineStartupCover').dataset.state,cover:!document.getElementById('pineStartupCover').hidden,
   deck:poiOrchestraSnapshot(),levels:{...poiAudioLevels},probe:window.__qaAudio.summary(poiAudioMusic,poiAudioEffects)}),
`);
fixture=inject(fixture,' const p=poiWildPick(rng);',' const p=null;');
fixture=inject(fixture,'function poiWildRegionalFrame(now,rng){','function poiWildRegionalFrame(now,rng){return;');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<!doctype html><title>Startup BGM QA</title>':fixture)});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const address='http://127.0.0.1:'+server.address().port;
let browser,checkpoint='boot';
const wait=(p,f,arg=null,t=10000)=>p.waitForFunction(f,arg,{polling:40,timeout:t});
const snapshot=p=>p.evaluate(()=>window.__editorTest?.startupAudioQA());
const saved={master:78,bgm:64,se:72};
async function boot(pin,zone){
 const ctx=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:.75});
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
 await ctx.addInitScript(()=>{
  window.__qaHoldCover=true;
  const links=new WeakMap(),events=new WeakMap(),trace=[];
  const visible=()=>!document.getElementById('pineStartupCover')?.hidden;
  const link=AudioNode.prototype.connect;
  AudioNode.prototype.connect=function(to,...rest){
   if(!links.has(this))links.set(this,new Set());
   links.get(this).add(to);return link.call(this,to,...rest);
  };
  for(const name of ['setValueAtTime','setTargetAtTime','linearRampToValueAtTime','exponentialRampToValueAtTime','cancelScheduledValues','cancelAndHoldAtTime']){
   const old=AudioParam.prototype[name];if(typeof old!=='function')continue;
   AudioParam.prototype[name]=function(...args){
    const result=old.apply(this,args);
    const previous=events.get(this)||[];previous.push({name,args,cover:visible()});events.set(this,previous.slice(-24));
    return result;
   }
  }
  for(const proto of [AudioBufferSourceNode.prototype,OscillatorNode.prototype]){
   const start=proto.start,stop=proto.stop;
   proto.start=function(...a){
    const result=start.apply(this,a);
    const e={source:this,at:this.context.currentTime,scheduled:a[0],cover:visible(),
     loop:this.loop===true,duration:this.buffer?.duration??null,ended:false,stop:null};
    this.addEventListener('ended',()=>{e.ended=true});trace.push(e);
    return result;
   };
   proto.stop=function(...a){
    const result=stop.apply(this,a),e=trace.find(x=>x.source===this);
    if(e)e.stop=a[0]??this.context.currentTime;return result;
   };
  }
  function routes(node,depth=8,seen=new Set()){
   if(depth<=0||seen.has(node))return [node];
   seen.add(node);
   return [node,...[...(links.get(node)||[])].flatMap(n=>routes(n,depth-1,seen))];
  }
  window.__qaAudio={summary:(music,effects)=>({
   gain:music?.gain?.value,automations:events.get(music?.gain)||[],
   effectsGain:effects?.gain?.value,effectsAutomation:events.get(effects?.gain)||[],
   events:trace.map(({source,...e})=>({
    ...e,bus:routes(source).includes(music)?'bgm':routes(source).includes(effects)?'se':'other',
    gains:routes(source).filter(n=>n&&n.gain&&n!==music&&n!==effects).map(n=>events.get(n.gain)||[])
   }))
  })};
 });
 await page.goto(address+'/seed');
 await page.evaluate(({pin:[x,z],saved})=>{
  localStorage.setItem('world-workshop-audio-v2',JSON.stringify({...saved,enabled:true}));
  localStorage.setItem('world-workshop-hotbar-v1','{"version":1,"weapon":"equipWoodSword","potions":0}');
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x,z,y:0,facing:0},townLayout:5,townMapHeight:128,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 },{pin,saved});
 await page.goto(address+'/?resume=1&test=1');
 return {page,ctx,errors,pin,zone};
}
const getMusic=q=>q.probe.events.filter(e=>e.bus==='bgm');
async function held(p,zone){
 await wait(p,()=>window.__qaReadyToReveal&&window.__editorTest?.startupAudioQA().zone);
 const before=await snapshot(p);assert(before.cover&&before.state==='loading');assert.equal(before.zone,zone);
 await p.waitForTimeout(850); // >4 real scheduler ticks if old startup schedules music before reveal.
 const q=await snapshot(p);
 if(baseline){
  assert(getMusic(q).some(e=>e.cover),'old startup scheduled real BGM behind a still-visible loading cover');
 }else{
  assert.equal(getMusic(q).length,0,'no BGM source may be scheduled during active startup cover');
  assert.equal(q.deck.active,null,'no scene score clock is left running behind cover');
 }
}
async function ready(p,zone){
 await p.evaluate(()=>window.__qaReleaseCover());
 await p.locator('#pineStartupCover').waitFor({state:'hidden'});
 await wait(p,zone=>{
  const q=window.__editorTest.startupAudioQA();
  return q.ctx==='running'&&q.deck.active===zone&&q.probe.events.some(e=>e.bus==='bgm'&&!e.cover);
 },zone);
 const q=await snapshot(p);assert.equal(q.state,'ready');assert.deepEqual(q.levels,saved);
 assert(getMusic(q).every(e=>!e.cover),'every native BGM source starts after the real ready transition');
 const target=.58*saved.bgm/100;
 assert(q.probe.automations.some(e=>e.name==='setTargetAtTime'&&Math.abs(e.args[0]-target)<.015),
  'saved BGM mixer gain is maintained while deck ramps');
 assert(getMusic(q).some(e=>e.gains.some(records=>records.some(r=>!r.cover&&r.name==='setTargetAtTime'&&r.args[0]>0&&r.args[2]>=.25&&r.args[2]<=.4))),
  'actual WebAudio graph has a gentle first scene ramp after reveal');
 assert(q.probe.effectsAutomation.some(e=>Math.abs(e.args[0]-.90*saved.se/100)<.015&&Math.abs(e.args[2]-.02)<.003),
  'existing fast effect gain is unchanged');
 if(zone==='outside'){
  assert.equal(getMusic(q).filter(a=>a.loop&&a.duration>5&&!a.ended&&a.stop===null).length,1,'one native outdoor recording');
 }
}
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--autoplay-policy=no-user-gesture-required','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 for(const [zone,point] of [['town',[55,42]],['outside',[102,93]]]){
  checkpoint=zone+' first startup cover';
  const {page:p,ctx,errors,pin}=await boot(point,zone);
  try{
   await held(p,zone);
   if(baseline)continue;
   await ready(p,zone);
   checkpoint=zone+' unchanged real footsteps and Activity restart';
   const [x,z]=pin,first=await snapshot(p);
   await p.keyboard.press('ArrowUp');
   await wait(p,([x,z])=>{const q=window.__editorTest.facility().position;return q.x===x&&q.z===z-1},[x,z]);
   await wait(p,n=>window.__editorTest.startupAudioQA().probe.events.filter(e=>e.bus==='se').length>n,
    first.probe.events.filter(e=>e.bus==='se').length);
   await p.evaluate(()=>window.__workshopAudioForeground(false));
   await wait(p,()=>window.__editorTest.startupAudioQA().ctx==='suspended');
   await p.evaluate(()=>{window.__workshopAudioForeground(true);window.__workshopAudioForeground(true)});
   await wait(p,zone=>{const q=window.__editorTest.startupAudioQA();return q.ctx==='running'&&q.deck.active===zone},zone);
   if(zone==='outside'){
    await wait(p,()=>window.__editorTest.startupAudioQA().probe.events.filter(e=>e.bus==='bgm'&&e.loop&&e.duration>5&&e.stop===null&&!e.ended).length===1);
   }
   checkpoint=zone+' real cold reload cover';
   await p.reload();await held(p,zone);await ready(p,zone);
   assert.deepEqual(errors,[]);
  }catch(e){console.error(checkpoint,JSON.stringify(await snapshot(p).catch(()=>null)),errors);throw e}
  finally{await ctx.close()}
 }
 console.log(baseline?'PASS reproduces premature real BGM at old startup':'PASS native first/reload cover stays silent; real gentle BGM, no repeated loops and original SE');
}finally{await browser?.close();await new Promise(r=>server.close(r))}
