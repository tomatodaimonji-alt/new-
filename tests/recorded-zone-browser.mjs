import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const expected={
  "town": {
    "bytes": 271615,
    "sha256": "382224a6779f0d96daea010e4abf65ff8d7cb728eade78b7d7f305938b7634c7",
    "frames": 1974857
  },
  "indoor": {
    "bytes": 355332,
    "sha256": "fc204ad9dbfa0ec7b0c5d38366b080331a7d1c848a42107fb6b2219f47ec6fe5",
    "frames": 2067692
  },
  "mine": {
    "bytes": 509119,
    "sha256": "607f69eda7f7fa97ec2ee439cf2b47dc8aaaded2a9d3008eede2133451c431f7",
    "frames": 2560000
  },
  "otherworld": {
    "bytes": 363263,
    "sha256": "b24a59ee62bb40d022523c309fd62c2e97e3d56b0619b8ac5c2ed4428773d92b",
    "frames": 2133333
  },
  "chapel": {
    "bytes": 387978,
    "sha256": "a8079241becfa1730101bf83b06c91bd414b90dc5cbeffe4f6f45c732eb43de8",
    "frames": 2229677
  },
  "northFort": {
    "bytes": 369260,
    "sha256": "885e1e434563685ccad6b1b51df17e25c11924eeb73c7f42a179761d15b96f73",
    "frames": 2194286
  },
  "battle": {
    "bytes": 265670,
    "sha256": "a4af17841e78ffe96930291adecccda26711382e628d9e0ad021689a34205c04",
    "frames": 2048000
  }
};
const protectedAudio={
 "davidStill": {
  "bytes": 255815,
  "sha256": "e3447805c97635182551f87a0db92f873d789665a5380170a6528c6b64020a23"
 },
 "davidAwake": {
  "bytes": 251916,
  "sha256": "1b3795204966408d4d1183319d1bc99eac5e6b58efc6f77a20cd888d76221341"
 },
 "outside": {
  "bytes": 354935,
  "sha256": "796fe237681344be18337a900db1ca441b5b46c1b43a8f7f9adfff95442d960e"
 },
 "snow": {
  "bytes": 145151,
  "sha256": "b91b59e1b95d9fba64e783a95aa3f87c63b7156a07474bf69e559dc1c3c78fca"
 },
 "snowWindAmbience": {
  "bytes": 14163,
  "sha256": "6f978828ae81b9caa603fd6af54103f4e249aa0e3b3ab43d3a49dd44f2be26cb"
 }
};
const sha=x=>createHash('sha256').update(x).digest('hex');
let html=readFileSync(process.argv[2]??'world-editor.html','utf8');
function span(a,b){const i=html.indexOf(a),j=b?html.indexOf(b,i+a.length):html.indexOf('\n',i);assert(i>=0&&j>i,a);return html.slice(i,j)}
function value(key,end){return vm.runInNewContext(span('const '+key+'=',end)+';('+key+')')}
const bytes=s=>Buffer.from(s,'base64');
const david=value('POI_DAVID_SCORE_OGG','const poiDavidScoreCache');
const protectedMap={...david,outside:value('POI_MYSTIC_FIELD_OGG'),snow:value('POI_SNOW_MUSIC_OGG'),
 snowWindAmbience:value('POI_SNOW_WIND_OGG')};
for(const [name,k] of Object.entries(protectedMap)){
 const x=bytes(k);assert.deepEqual({bytes:x.length,sha256:sha(x)},protectedAudio[name],name+' old recording unchanged')
}
assert.equal(sha(span('const POI_RECORDED_FOLEY=','function poiRecordedFoley(')),'0041d25f4f1f24c4751b8d4c8236c097edd9aed2ca096d4516f5f1e51e6b6ec5','all stored SFX unchanged');
assert.equal(sha(span('function poiCreekAudioSync(','// CC0 recorded Foley:')),'03e554bb596eceb452dc6eab09e38b2bf53cf7c8b2ace4919e61e81337bc39e7','creek ambience unchanged');
assert.equal(sha(span('function poiOrchestraScene(','function poiOrchestraScore(')),'9039eb7ad133509139ced330046205d1de4ec6da4612ddad34d61ee96a4e804a','original spatial and combat scene selection unchanged');
const newMap=value('POI_ZONE_RECORDINGS','// BEGIN RECORDED ZONE TRANSPORT');
assert.deepEqual(Object.keys(newMap).sort(),Object.keys(expected).sort());
// Independently pinned ffprobe packet duration and skip_manual PCM decode
// show a 128-frame initial priming block and a 1024-frame final packet for
// these exact immutable seven bytes. Some platform decoders honor EOS
// trim; current Chromium omits just the trim at the final packet.
const trailing={"town":887,"indoor":468,"mine":576,"otherworld":363,"chapel":275,"northFort":850,"battle":576};
const authoredRate=32000;
function readOgg(data){
 let at=0,eos=-1,rate=0,small=0,large=0,pages=0,serial=null;
 while(at<data.length){
  assert(at+27<=data.length&&data.toString('ascii',at,at+4)==='OggS'&&data[at+4]===0);
  const n=data[at+26],head=at+27+n;
  assert(head<=data.length);
  let end=head;for(let i=at+27;i<head;i++)end+=data[i];
  assert(end<=data.length);
  const flag=data[at+5],sequence=data.readUInt32LE(at+18),stream=data.readUInt32LE(at+14);
  assert.equal(sequence,pages++);
  if(serial===null){
   serial=stream;assert(flag&2);
   assert.equal(data.toString('ascii',head+1,head+7),'vorbis');
   rate=data.readUInt32LE(head+12);const w=data[head+28];
   small=2**(w&15);large=2**(w>>4);
  }else assert.equal(stream,serial);
  if(flag&4){assert.equal(end,data.length,'terminal EOS is the last page');eos=Number(data.readBigUInt64LE(at+6))}
  at=end;
 }
 return {eos,rate,small,large};
}
for(const [name,k] of Object.entries(newMap)){
 const x=bytes(k),e=expected[name];assert.equal(x.length,e.bytes);assert.equal(sha(x),e.sha256);
 assert.deepEqual(readOgg(x),{eos:e.frames,rate:authoredRate,small:256,large:2048},name+' authoritative Ogg EOS granule');
}
function nativeFrames(name,length,rate){
 assert(Number.isInteger(length)&&length>0&&Number.isInteger(rate)&&rate>0,name+' real AudioBuffer length/rate');
 const delta=length*authoredRate/rate-expected[name].frames;
 const limit=2*authoredRate/rate+1e-6;
 // Only actual EOS trimming or the independently measured last complete
 // packet are allowed, with fewer than two native-rate sample spans for
 // rounding. This is not a blanket multi-millisecond tolerance.
 assert(Math.min(Math.abs(delta),Math.abs(delta-trailing[name]))<=limit,
  name+' unexpected decoder frames '+JSON.stringify({length,rate,sourceFrameDelta:delta,allowedTrailing:trailing[name],limit}));
 return delta;
}
function nativeLoop(key,event){
 const {length,rate,duration,loopStart,loopEnd}=event;
 const delta=nativeFrames(key,length,rate);
 assert.equal(duration,length/rate,key+' real native buffer duration');
 assert.equal(loopStart,0);
 const exact=Math.min(duration,expected[key].frames/authoredRate);
 assert(Math.abs(loopEnd-exact)<1e-8,key+' loop must exclude codec padding: '+JSON.stringify({duration,loopEnd,exact,delta}));
 return {duration,rate,length,loopEnd,sourceFrameDelta:delta};
}
const put=(a,b)=>{assert.equal(html.split(a).length,2,a);html=html.replace(a,b)};
const api='  freeMovementPose:()=>({x:poiWalkViewX,z:poiWalkViewZ,level:poiWalkLevel}),';
put(api,api+`
 recorderQA:{
  read:()=>{
   const ctx=poiAudioContext;
   return {site:facilitySite?.id,active:poiOrchestraActive,wanted:ctx?poiOrchestraScene(ctx.currentTime):null,
    state:ctx?.state??null,time:ctx?.currentTime??0,timer:poiAudioInterval!==null,saved:localStorage.getItem('world-workshop-audio-v2'),
    decks:[...poiOrchestraDecks].map(([key,d])=>({key,retire:d.retire,envelope:d.envelope,bus:window.__audioZoneSpy.id(d.bus),output:window.__audioZoneSpy.id(d.output),
     wallGain:window.__audioZoneSpy.detail(d.output),valid:d.sources.size,loop:!!d.recordedLoop,voices:[...d.sources].map(s=>window.__audioZoneSpy.id(s.source))})),
    graph:window.__audioZoneSpy.read([poiAudioMaster,poiAudioMusic,poiAudioAmbience,poiAudioEffects])};
  },
  move:key=>{
   // Real map coordinates and production spatial selector; fixture position
   // injection uses no alternate music routing or synthetic AudioContext.
   const s=facilitySite;
   const market=s.southRoad.town.market.public,b=s.mine.bounds;
   const c={town:[45,41,0],southSettlement:[market.x,market.z,0],mine:[b.x1+2,b.z1+2,b.y],
    outside:[87,2,0]}[key];if(!c)throw Error(key);
   [poiWalkX,poiWalkZ,poiWalkLevel]=c;poiWalkFromX=poiWalkViewX=poiWalkX;poiWalkFromZ=poiWalkViewZ=poiWalkZ;
   poiWalkStarted=-10000;poiWalkNextReady=0;poiFreePose=null;
   poiWalkRoof();poiWalkStatus();poiWalkAvatar();return c;
  },
  mute:n=>poiAudioSetVolume('bgm',n),
  effect:()=>poiSound('player-hurt'),
  decodeAll:async()=>{
   const ctx=new OfflineAudioContext(2,1,32000),out={};
   // Independent real WebAudio decode of all seven at the authored sample
   // rate. No loop is scheduled off-map, and no music scene is fabricated.
   for(const [key,encoded] of Object.entries(POI_ZONE_RECORDINGS)){
    const e=poiRecordedZoneClip(ctx,key,encoded);
    for(let i=0;e.state==='pending'&&i<250;i++)await new Promise(r=>setTimeout(r,20));
    out[key]={state:e.state,frames:e.buffer?.length,rate:e.buffer?.sampleRate,channels:e.buffer?.numberOfChannels};
   }
   return out;
  }
 },
`);
put('function poiMobFrame(now){','function poiMobFrame(now){if(window.__audioZoneSpy)return;');
for(const [,js] of html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(js);
if(process.env.RECORDED_ZONE_SYNTAX_ONLY==='1'){console.log('PASS protected assets, seven exact encoded recordings, unchanged spatial selector/SFX and full injected script parse');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>recorded-zone seed</title>':html)});
await new Promise((ok,no)=>server.listen(0,'127.0.0.1',ok).once('error',no));const origin='http://127.0.0.1:'+server.address().port;
function nativeSpy(heldSizes){
 const streams=[],parents=new WeakMap(),gains=new WeakMap(),ids=new WeakMap(),pending=[],decoded=[];
 let seq=0,forcedHidden=false;const idsFor=n=>{if(!n)return null;if(!ids.has(n))ids.set(n,++seq);return ids.get(n)};
 const originalHidden=Object.getOwnPropertyDescriptor(Document.prototype,'hidden')?.get;
 Object.defineProperty(document,'hidden',{configurable:true,get:()=>forcedHidden||!!originalHidden?.call(document)});
 const audio=AudioContext.prototype,decode=audio.decodeAudioData;
 audio.decodeAudioData=function(data,success,failure){
  const size=data.byteLength,run=()=>decode.call(this,data,result=>{decoded.push(size);success?.(result)},failure);
  if(!heldSizes.includes(size))return run();
  let accept,reject;const promise=new Promise((r,j)=>{accept=r;reject=j});
  pending.push({size,release:()=>run().then(accept,reject)});return promise;
 };
 for(const method of ['createGain','createDelay','createBiquadFilter','createStereoPanner','createDynamicsCompressor','createOscillator','createBufferSource']){
  const factory=audio[method];if(!factory)continue;
  audio[method]=function(...args){
   const node=factory.apply(this,args),id=idsFor(node),connect=node.connect,disconnect=node.disconnect;
   node.connect=function(dest,...a){let set=parents.get(node);if(!set){set=new Set();parents.set(node,set)}set.add(dest);return connect.call(this,dest,...a)};
   node.disconnect=function(...a){if(!a.length)parents.delete(node);else if(a[0]&&typeof a[0]==='object')parents.get(node)?.delete(a[0]);return disconnect.apply(this,a)};
   if(node.gain){const history=[];gains.set(node,history);
    for(const k of ['setValueAtTime','linearRampToValueAtTime','setTargetAtTime','cancelScheduledValues']){
     const f=node.gain[k];node.gain[k]=function(...p){history.push([k,...p]);if(history.length>16)history.shift();return f.apply(this,p)};
    }
   }
   if(node.start){
    const start=node.start,stop=node.stop;let evt=null,periodic=false;
    if(node.setPeriodicWave){const wave=node.setPeriodicWave;node.setPeriodicWave=function(...a){periodic=true;return wave.apply(this,a)}}
    node.start=function(...a){
     const path=[],seen=new Set([node]),queue=[...(parents.get(node)??[])];
     for(let i=0;i<queue.length&&i<45;i++){
      const p=queue[i];if(seen.has(p))continue;seen.add(p);path.push(idsFor(p));
      queue.push(...(parents.get(p)??[]));
     }
     evt={id,method,path,periodic,loop:!!node.loop,when:a[0]??this.context.currentTime,length:node.buffer?.length??null,
      duration:node.buffer?.duration??null,rate:node.buffer?.sampleRate??null,loopStart:node.loopStart??null,loopEnd:node.loopEnd??null,stopped:null};
     const out=start.apply(this,a);streams.push(evt);return out;
    };
    node.stop=function(...a){const out=stop.apply(this,a);if(evt)evt.stopped=a[0]??this.context.currentTime;return out};
   }
   return node;
  };
 }
 const detail=n=>({id:idsFor(n),gain:n?.gain.value??null,ops:gains.get(n)??[]});
 window.__audioZoneSpy={id:idsFor,detail,read:buses=>({pending:pending.map(x=>x.size),decoded:[...decoded],
  buses:buses.map(detail),events:streams.slice(-600)}),
  release:size=>{const i=pending.findIndex(x=>x.size===size);if(i<0)return false;pending.splice(i,1)[0].release();return true},
  hide:b=>{forcedHidden=b;document.dispatchEvent(new Event('visibilitychange'))}
 };
}
const raw=JSON.stringify({master:83,bgm:71,se:37,enabled:true});
let b,p,point='boot';const errors=[],external=[];
const apiCall=(k,v)=>p.evaluate(([k,v])=>window.__editorTest.recorderQA[k](v),[k,v]);
const read=()=>apiCall('read');
const wait=(f,arg=null,time=18000)=>p.waitForFunction(f,arg,{timeout:time,polling:40});
const state=async(f,arg=null,time=18000)=>(await wait(f,arg,time)).jsonValue();
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const c=await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:.65,isMobile:true,hasTouch:true,serviceWorkers:'block'});
 await c.addInitScript(nativeSpy,[expected.town.bytes,expected.indoor.bytes]);
 await c.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():(external.push(r.request().url()),r.abort()));
 p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));
 await p.goto(origin+'/seed');
 await p.evaluate(raw=>{
  localStorage.setItem('world-workshop-audio-v2',raw);
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:45,z:41,y:0,facing:0},townLayout:5,townMapHeight:182,templeDepth:1}));
 },raw);
 await p.goto(origin+'/?resume=1&test=1',{waitUntil:'domcontentloaded'});
 await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:35000});
 point='actual trusted wake, pending town recording stays quiet';
 await p.locator('#poiWalkAction').tap();
 await wait(n=>{const s=window.__editorTest.recorderQA.read();return s.state==='running'&&s.active==='town'&&s.graph.pending.includes(n)},expected.town.bytes);
 await p.waitForTimeout(550);
 let s=await read();const [master,bgm,ambience,fx]=s.graph.buses.map(x=>x.id);
 const music=e=>e.path.includes(bgm),loop=e=>music(e)&&e.loop;
 assert.equal(s.saved,raw);assert.equal(s.graph.events.filter(music).length,0,'pending known recording neither synth nor placeholder');
 [.83,.58*.71,.39*.71,.90*.37].forEach((gain,i)=>{
  const last=s.graph.buses[i].ops.filter(x=>x[0]==='setTargetAtTime').at(-1);assert(last&&Math.abs(last[1]-gain)<1e-6);
 });
 const release=size=>p.evaluate(size=>window.__audioZoneSpy.release(size),size);
 const hide=value=>p.evaluate(value=>window.__audioZoneSpy.hide(value),value);
 assert(await release(expected.town.bytes));
 const active=key=>state(key=>{
  const s=window.__editorTest.recorderQA.read(),d=s.decks.find(x=>x.key===key);
  return s.active===key&&d?.loop&&s;
 },key);
 s=await active('town');assert.equal(s.decks.length,1);
 const towns=s.graph.events.filter(loop);assert.equal(towns.length,1);const town=towns[0];
 const townTiming=nativeLoop('town',town);
 assert(town.path.includes(master)&&!town.path.includes(ambience)&&!town.path.includes(fx));
 point='actual Selnea route retires town, followed by pending indoor recording';
 await apiCall('move','southSettlement');
 const retire=await state(()=>{
  const s=window.__editorTest.recorderQA.read();return s.wanted==='southSettlement'&&s.decks[0]?.key==='town'&&s.decks[0].retire!==null&&s;
 });
 assert.equal(retire.decks.length,1);
 assert.equal(retire.decks[0].envelope.to,0);
 assert(retire.decks[0].wallGain.ops.some(x=>x[0]==='linearRampToValueAtTime'&&x[1]===0&&Math.abs(x[2]-retire.decks[0].retire)<.002));
 await wait(n=>{const s=window.__editorTest.recorderQA.read();return s.active==='southSettlement'&&s.graph.pending.includes(n)},expected.indoor.bytes);
 s=await read();assert.equal(s.graph.events.filter(loop).length,1);
 assert(s.graph.events.find(e=>e.id===town.id).stopped>=retire.decks[0].retire-.002,'native town source stops only once faded to silence');
 assert(!s.graph.events.some(e=>music(e)&&!e.loop),'no synthetic notes during pending known region');
 point='release real late decode while hidden/muted, then move to actual mine';
 await apiCall('mute',0);await hide(true);
 await wait(()=>{const s=window.__editorTest.recorderQA.read();return s.state==='suspended'&&!s.timer});
 assert(await release(expected.indoor.bytes));
 await apiCall('move','mine');
 await p.waitForTimeout(220);
 s=await read();assert.equal(s.graph.events.filter(loop).length,1,'hidden late decode must not schedule stale Selnea transport');
 await hide(false);
 await wait(()=>{const s=window.__editorTest.recorderQA.read();return s.state==='running'&&s.active==='mine'});
 s=await read();assert.equal(s.graph.events.filter(loop).length,1,'muted destination must not schedule music');
 await apiCall('mute',71);s=await active('mine');
 const mine=s.graph.events.filter(loop).at(-1);assert.equal(s.graph.events.filter(loop).length,2);
 const mineTiming=nativeLoop('mine',mine);
 assert(mine.when>town.when&&mine.when>=s.graph.events.find(e=>e.id===town.id).stopped);
 point='return to physical Selnea and start its existing separate deck';
 await apiCall('move','southSettlement');
 // The runtime retains one recorded cue, so Mine legitimately evicted
 // the first chamber buffer. Release this distinct, test-deferred decode.
 await wait(n=>{const s=window.__editorTest.recorderQA.read();return s.active==='southSettlement'&&s.graph.pending.includes(n)},expected.indoor.bytes);
 assert(await release(expected.indoor.bytes));
 s=await active('southSettlement');
 const groups=s.graph.events.filter(loop),indoors=groups.at(-1);
 assert.equal(groups.length,3);const indoorTiming=nativeLoop('indoor',indoors);
 assert(indoors.when>=groups.find(e=>e.id===mine.id).stopped);
 assert.deepEqual(s.decks.map(d=>d.key),['southSettlement']);
 assert.equal(s.decks[0].envelope.from,0,'incoming native deck starts from zero');
 assert.equal(s.decks[0].envelope.to,1);
 assert(s.decks[0].wallGain.ops.some(x=>x[0]==='setValueAtTime'&&x[1]===0));
 assert(s.decks[0].wallGain.ops.some(x=>x[0]==='linearRampToValueAtTime'&&x[1]===1));
 assert(!s.graph.events.some(e=>e.periodic&&music(e)));
 point='original player-hurt recording uses only the established effects bus';
 const seen=s.graph.events.length;
 await apiCall('effect');
 s=await read();
 assert(s.graph.events.slice(seen).some(e=>e.method==='createBufferSource'&&!e.loop&&e.path.includes(fx)&&e.path.includes(master)&&!e.path.includes(bgm)));
 point='seven native gapless WebAudio decodes, off-map nonplaying';
 const clips=await apiCall('decodeAll');
 for(const key of Object.keys(expected)){
  const clip=clips[key];console.log('NATIVE RECORDED ZONE DECODE',key,JSON.stringify({...clip,sourceFrameDelta:clip.frames-expected[key].frames,knownPacketPadding:trailing[key]}));
  assert.equal(clip.state,'ready',key);assert.equal(clip.rate,authoredRate,key);assert.equal(clip.channels,2,key);
  nativeFrames(key,clip.frames,clip.rate);
 }
 assert.deepEqual(external,[],'offline release makes no external asset requests');assert.deepEqual(errors,[]);
 console.log('RECORDED ZONE (actual native AudioContext): town → pending Selnea → hidden/muted → mine → Selnea, actual source start/stop, existing SFX',JSON.stringify({routes:{town:townTiming,mine:mineTiming,indoor:indoorTiming},clips}));
}catch(e){console.error(point,p?JSON.stringify(await read().catch(()=>null)).slice(0,8000):null);throw e}
finally{await b?.close();await new Promise(ok=>server.close(ok));}
