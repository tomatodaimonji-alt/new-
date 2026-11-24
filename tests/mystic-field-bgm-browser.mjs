import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';

const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
assert.match(html,/const POI_MYSTIC_FIELD_OGG='[A-Za-z0-9+/=]{500,}'/,'exact build embeds local score');
function inject(s,a,b){assert.equal(s.split(a).length,2,a);return s.replace(a,b)}
const hook="  townResidents:()=>typeof poiTownResidentsSnapshot==='function'?poiTownResidentsSnapshot():null,";
let fixture=inject(html,hook,hook+`
  fieldAudioQA:{
   place:(x,z,y)=>workshopResumeRestorePosition({x,z,y,facing:0}),
   combat:()=>{
    // One real enemy wind-up exercises the production battle scene decision.
    const obj={type:'monsterSlime',x:poiWalkX,z:poiWalkZ-1,y:poiWalkLevel,rot:0};
    const s=poiCombatActorMake(obj);s.wildSpawn=true;poiMonsterStates.set(obj,s);window.__fieldQAEnemy={obj,s};
    return poiEnemyBeginPlayer(obj,s,performance.now());
   },
   finishCombat:()=>{
    const e=window.__fieldQAEnemy;if(e){poiEnemyPending.delete(e.s);poiMonsterStates.delete(e.obj);}
   },
   snapshot:()=>({scene:poiOrchestraScene(poiAudioContext?.currentTime??0),zone:poiAudioMusicZone(),ctx:poiAudioContext?.state,
    audioTime:poiAudioContext?.currentTime,hp:poiPlayerHP,enemyHp:window.__fieldQAEnemy?.s.hp,
    levels:{...poiAudioLevels},deck:poiOrchestraSnapshot(),probe:window.__fieldQA?.summary(poiAudioMusic)}),
  },`);
const voice='function poiOrchestraVoice(deck,e,when){';
fixture=inject(fixture,voice,voice+`
 const entry=[...poiOrchestraDecks].find(([,candidate])=>candidate===deck);
 if(entry)window.__fieldQA?.voice(entry[0]);
`);
fixture=inject(fixture,' const p=poiWildPick(rng);',' const p=null;');
fixture=inject(fixture,'function poiWildRegionalFrame(now,rng){','function poiWildRegionalFrame(now,rng){return;');

const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<!doctype html><title>Field BGM QA</title>':fixture)});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const origin='http://127.0.0.1:'+server.address().port;
let browser,checkpoint='startup';
async function launch(rejectDecode){
 const context=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:.75,isMobile:true,hasTouch:true});
 const page=await context.newPage(),errors=[],offOrigin=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(origin+'/'))offOrigin.push(r.url())});
 await context.addInitScript(({rejectDecode})=>{
  const trace={decoded:[],decodeAttempts:0,loop:[],voice:{},waiting:false};
  let deliver=null;
  const destinations=new WeakMap(),byParam=new WeakMap(),targets=new WeakMap();
  const connect=AudioNode.prototype.connect;
  AudioNode.prototype.connect=function(node,...tail){
   if(!destinations.has(this))destinations.set(this,[]);
   destinations.get(this).push(node);
   return connect.call(this,node,...tail);
  };
  const gain=BaseAudioContext.prototype.createGain;
  BaseAudioContext.prototype.createGain=function(...a){
   const node=gain.apply(this,a);byParam.set(node.gain,node);return node;
  };
  const target=AudioParam.prototype.setTargetAtTime;
  AudioParam.prototype.setTargetAtTime=function(level,now,decay){
   const node=byParam.get(this);if(node){
    const log=targets.get(node)||[];log.push({level,now,decay});targets.set(node,log.slice(-12));
   }
   return target.call(this,level,now,decay);
  };
  const decode=BaseAudioContext.prototype.decodeAudioData;
  BaseAudioContext.prototype.decodeAudioData=function(data,good,bad){
   trace.decodeAttempts++;
   if(rejectDecode){const failure=new DOMException('Injected unsupported encoded score','EncodingError');bad?.(failure);return Promise.reject(failure)}
   return decode.call(this,data).then(b=>{
    trace.decoded.push(b);trace.waiting=true;
    return new Promise(resolve=>{deliver=()=>{trace.waiting=false;good?.(b);resolve(b)}});
   },error=>{bad?.(error);throw error});
  };
  const start=AudioBufferSourceNode.prototype.start,stop=AudioBufferSourceNode.prototype.stop;
  AudioBufferSourceNode.prototype.start=function(...a){
   const result=start.apply(this,a);
   if(this.loop&&this.buffer?.duration>5){
    const s={node:this,start:a,at:this.context.currentTime,duration:this.buffer.duration,rate:this.buffer.sampleRate,
     channels:this.buffer.numberOfChannels,decoded:trace.decoded.includes(this.buffer),loopStart:this.loopStart,loopEnd:this.loopEnd,stop:null,ended:false};
    this.addEventListener('ended',()=>{s.ended=true});trace.loop.push(s);
   }
   return result;
  };
  AudioBufferSourceNode.prototype.stop=function(...a){
   const result=stop.apply(this,a);
   const s=trace.loop.find(s=>s.node===this);if(s)s.stop=a[0]??this.context.currentTime;
   return result;
  };
  window.__fieldQA={release(){const f=deliver;deliver=null;f?.();return !!f},voice(scene){trace.voice[scene]=(trace.voice[scene]||0)+1},summary:music=>{
   const stages=(n,max=4)=>{if(!n||max<1)return [];return [{v:n.gain?.value,targets:targets.get(n)||[]}].concat(stages(destinations.get(n)?.[0],max-1))};
   return {decodeAttempts:trace.decodeAttempts,decoded:trace.decoded.map(b=>b.duration),musicTargets:targets.get(music)||[],
    synth:{...trace.voice},waiting:trace.waiting,loop:trace.loop.map(({node,...s})=>({...s,stages:stages(destinations.get(node)?.[0])}))};
  }};
 },{rejectDecode});
 try{
  await page.goto(origin+'/seed');
  await page.evaluate(()=>{
   localStorage.setItem('world-workshop-audio-v2','{"master":78,"bgm":64,"se":72,"enabled":true}');
   localStorage.setItem('world-workshop-hotbar-v1','{"version":1,"weapon":"equipWoodSword","potions":0}');
   localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
    position:{x:102,z:93,y:0,facing:0},townLayout:5,townMapHeight:128,
    view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
  });
  await page.goto(origin+'/?resume=1&test=1');
  await page.locator('#pineStartupCover').waitFor({state:'hidden'});
  await page.waitForFunction(()=>window.__editorTest?.facility()?.active);
  await page.locator('#poiWalkAction').tap();
  await page.waitForFunction(()=>window.__editorTest.fieldAudioQA.snapshot().ctx==='running',null,{polling:35,timeout:8000});
  return {page,context,errors,offOrigin};
 }catch(e){await context.close();throw e}
}
const snapshot=page=>page.evaluate(()=>window.__editorTest.fieldAudioQA.snapshot());
const wait=(page,f,a=null,t=9000)=>page.waitForFunction(f,a,{polling:45,timeout:t});
const get=async p=>(await snapshot(p)).probe;
const fieldCount=async p=>(await get(p)).loop.length;
async function instrumental(p,scene){
 await wait(p,scene=>{
  const {deck,probe}=window.__editorTest.fieldAudioQA.snapshot();
  return deck.active===scene&&deck.voices>0&&probe.synth[scene]>0&&probe.loop.every(a=>a.ended);
 },scene);
}
async function position(p,pin){assert.equal(await p.evaluate(pin=>window.__editorTest.fieldAudioQA.place(...pin),pin),true,'actual resume landing is safe: '+pin)}
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 checkpoint='authentic outdoors decode';const a=await launch(false),p=a.page;
 try{
  await wait(p,()=>{const s=window.__editorTest.fieldAudioQA.snapshot();return s.probe.waiting&&s.deck.active==='outside'});
  const pending=(await snapshot(p)).audioTime;
  await wait(p,v=>window.__editorTest.fieldAudioQA.snapshot().audioTime>=v+1.2,pending);
  let s=await snapshot(p);
  assert.equal(s.probe.loop.length,0,'no recorded source before actual decode delivery');
  assert.equal(s.probe.synth.outside??0,0,'pending decode never schedules old outdoor instruments');
  assert.equal(await p.evaluate(()=>window.__fieldQA.release()),true);
  await wait(p,()=>window.__editorTest.fieldAudioQA.snapshot().probe.loop.length===1);
  s=await snapshot(p);const track=s.probe.loop[0];
  assert.equal(s.scene,'outside');assert(track.decoded&&track.duration>5&&track.rate>=22050&&track.channels>=1);
  assert(track.loopStart>=0&&(!track.loopEnd||track.loopEnd>track.loopStart&&track.loopEnd<=track.duration+.001));
  assert.equal(track.ended,false);
  checkpoint='real outdoor enemy and player hits keep the exact same source';
  const hp=s.hp;
  assert.equal(await p.evaluate(()=>window.__editorTest.fieldAudioQA.combat()),true);
  await wait(p,hp=>window.__editorTest.fieldAudioQA.snapshot().hp<hp,hp);
  const enemyHp=(await snapshot(p)).enemyHp;
  await p.locator('#poiWalkAction').tap();
  await wait(p,hp=>window.__editorTest.fieldAudioQA.snapshot().enemyHp<hp,enemyHp);
  s=await snapshot(p);
  assert.equal(s.scene,'outside');assert.equal(s.deck.active,'outside');
  assert.equal(s.probe.synth.battle??0,0,'outdoor incoming and outgoing real damage never schedules score tempo change');
  assert.equal(s.probe.synth.outside??0,0,'field remains solely mystical recording');
  assert.equal(s.probe.loop.length,1);assert.equal(s.probe.loop[0].at,track.at);assert.equal(s.probe.loop[0].stop,null);
  await p.evaluate(()=>window.__editorTest.fieldAudioQA.finishCombat());
  const n=await fieldCount(p);
  for(const [scene,pin] of [['town',[55,42,0]],['town',[56,30,0]],['mine',[116,61,-1]],['southSettlement',[105,111,0]]]){
   checkpoint=scene+' stays on existing instruments';
   await position(p,pin);await instrumental(p,scene);assert.equal(await fieldCount(p),n);
   assert.equal((await get(p)).synth.battle??0,0,'no hostile outdoor hold leaks into the next region');
  }
  assert((await get(p)).loop[0].stages.some(g=>g.targets.some(t=>t.level===0&&t.decay>=.05)),'real gain fades on geographical exit');
  checkpoint='actual North Fort attack retains existing battle instruments';
  await position(p,[64,17,-1]);await instrumental(p,'battle');assert.equal(await fieldCount(p),n);
  checkpoint='native mute, background, and foreground controls';
  await position(p,[102,93,0]);await wait(p,()=>window.__editorTest.fieldAudioQA.snapshot().probe.loop.some(a=>!a.ended));
  const saved=s.levels;
  await p.locator('#poiVolumeBgm').evaluate(e=>{e.value='0';e.dispatchEvent(new Event('input',{bubbles:true}))});
  await wait(p,()=>{const q=window.__editorTest.fieldAudioQA.snapshot();
   return q.levels.bgm===0&&q.probe.musicTargets.at(-1)?.level===0});
  assert.equal((await snapshot(p)).levels.master,saved.master);assert.equal((await snapshot(p)).levels.se,saved.se);
  await p.locator('#poiVolumeBgm').evaluate((e,v)=>{e.value=String(v);e.dispatchEvent(new Event('input',{bubbles:true}))},saved.bgm);
  await p.evaluate(()=>window.__workshopAudioForeground(false));
  await wait(p,()=>{const q=window.__editorTest.fieldAudioQA.snapshot();return q.ctx==='suspended'&&q.probe.loop.every(t=>t.stop!==null)});
  await p.evaluate(()=>window.__workshopAudioForeground(true));
  await wait(p,()=>{const q=window.__editorTest.fieldAudioQA.snapshot();return q.ctx==='running'&&q.probe.loop.filter(t=>!t.ended&&t.stop===null).length===1});
  assert.equal((await get(p)).decodeAttempts,1,'own decoded score is reused across stops within the existing context');
  assert.deepEqual(a.offOrigin,[]);assert.deepEqual(a.errors,[]);
 }catch(e){console.error(checkpoint,JSON.stringify(await snapshot(p).catch(()=>null)),a.errors);throw e}
 finally{await a.context.close()}
 checkpoint='unsupported embedded decode stays quiet without old field or battle score';
 const b=await launch(true);
 try{
  await wait(b.page,()=>{const s=window.__editorTest.fieldAudioQA.snapshot();return s.probe.decodeAttempts>0&&s.deck.active==='outside'});
  const now=(await snapshot(b.page)).audioTime;
  await wait(b.page,t=>window.__editorTest.fieldAudioQA.snapshot().audioTime>=t+1.2,now);
  const rejected=await snapshot(b.page);
  assert.equal(rejected.probe.synth.outside??0,0);assert.equal(rejected.probe.synth.battle??0,0);
  assert.equal(await fieldCount(b.page),0);
  assert.deepEqual(b.offOrigin,[]);assert.deepEqual(b.errors,[]);
 }catch(e){console.error(checkpoint,JSON.stringify(await snapshot(b.page).catch(()=>null)),b.errors);throw e}
 finally{await b.context.close()}
 console.log('PASS native field-only loop through real hits, silent undecoded outdoors, unchanged indoor/dungeon battle, mixer and Activity lifecycle');
}finally{await browser?.close();await new Promise(r=>server.close(r))}
