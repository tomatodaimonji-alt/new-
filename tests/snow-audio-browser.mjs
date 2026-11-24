import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Script} from 'node:vm';
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const names=['POI_MYSTIC_FIELD_OGG','POI_SNOW_MUSIC_OGG','POI_SNOW_WIND_OGG'];
const hashes=names.map(name=>{
 const x=html.match(new RegExp("const "+name+"='([^']+)'"));
 assert(x,name);return createHash('sha256').update(Buffer.from(x[1],'base64')).digest('hex');
});
assert.equal(hashes[0],'796fe237681344be18337a900db1ca441b5b46c1b43a8f7f9adfff95442d960e','original exact outdoor Ogg unchanged');
assert.equal(new Set(hashes).size,3,'three independent recordings');
const hook='if(facilityParams.get(\'test\')===\'1\')window.__editorTest={';
assert.equal(html.split(hook).length,2);
const fixture=html.replace(hook,hook+`
  snowAudioQA:()=>({region:facilitySite?.id,active:poiOrchestraActive,started:window.pineStartup.ready,
   levels:{...poiAudioLevels},audioTime:poiAudioContext?.currentTime??0,
   native:window.__snowPlayback.capture(poiAudioMusic,poiAudioEffects)}),
`);
for(const [,body] of fixture.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(body);
if(process.env.SNOW_AUDIO_SYNTAX_ONLY){console.log('exact injected scripts parse');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url==='/seed'?'<!doctype html><title>Audio QA</title>':fixture)});
await new Promise((r,j)=>server.listen(0,'127.0.0.1',r).once('error',j));
const origin='http://127.0.0.1:'+server.address().port;
let browser,where='boot';
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:.75});
 const page=await context.newPage(),offsite=[],errors=[];
 page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(origin+'/'))offsite.push(r.url());});
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(28000);
 await context.addInitScript(()=>{
  const nodes=new WeakMap(),params=new WeakMap(),targets=new WeakMap(),decoded=new WeakMap(),sounds=[];
  const connect=AudioNode.prototype.connect;
  AudioNode.prototype.connect=function(dest,...rest){if(dest instanceof AudioNode)nodes.set(this,[...(nodes.get(this)||[]),dest]);return connect.call(this,dest,...rest)};
  const makeGain=BaseAudioContext.prototype.createGain;
  BaseAudioContext.prototype.createGain=function(...args){const n=makeGain.apply(this,args);params.set(n.gain,n);return n};
  const linear=AudioParam.prototype.linearRampToValueAtTime;
  AudioParam.prototype.linearRampToValueAtTime=function(level,at){
   const n=params.get(this);if(n)targets.set(n,[...(targets.get(n)||[]),{level,at,linear:true}]);
   return linear.apply(this,arguments);
  };
  const target=AudioParam.prototype.setTargetAtTime;
  AudioParam.prototype.setTargetAtTime=function(level,at,decay){
   const n=params.get(this);if(n)targets.set(n,[...(targets.get(n)||[]),{level,at,decay}]);
   return target.call(this,level,at,decay);
  };
  const decode=BaseAudioContext.prototype.decodeAudioData;
  BaseAudioContext.prototype.decodeAudioData=function(buffer,good,bad){
   // Hash actual Ogg input before decodeAudioData detaches it.
   const sum=crypto.subtle.digest('SHA-256',buffer.slice(0)).then(a=>Array.from(new Uint8Array(a),v=>v.toString(16).padStart(2,'0')).join(''));
   return decode.call(this,buffer).then(async b=>{decoded.set(b,await sum);good?.(b);return b},e=>{bad?.(e);throw e});
  };
  const start=AudioBufferSourceNode.prototype.start,stop=AudioBufferSourceNode.prototype.stop;
  AudioBufferSourceNode.prototype.start=function(...args){
   const r=start.apply(this,args),hash=decoded.get(this.buffer);if(!hash)return r;
   const event={source:this,hash,started:this.context.currentTime,when:args[0],ended:false,stop:null,
     duration:this.buffer.duration,channels:this.buffer.numberOfChannels,loop:this.loop,loopStart:this.loopStart,loopEnd:this.loopEnd};
   sounds.push(event);this.addEventListener('ended',()=>{event.ended=true});return r;
  };
  AudioBufferSourceNode.prototype.stop=function(...args){
   const r=stop.apply(this,args);
   const f=sounds.find(s=>s.source===this);if(f)f.stop=args[0]??this.context.currentTime;return r;
  };
  function path(n,k=5){
   if(!n||!k)return [];
   return [n,...path(nodes.get(n)?.[0],k-1)];
  }
  function automation(n){return targets.get(n)||[]}
  window.__snowPlayback={capture(music,effects){
   return {music:automation(music),effects:automation(effects),sounds:sounds.map(({source,...s})=>{
    const chain=path(nodes.get(source)?.[0]);
    return {...s,music:chain.includes(music),effects:chain.includes(effects),automation:chain.slice(0,3).map(automation)};
   })};
  }};
 });
 await page.goto(origin+'/seed');
 await page.evaluate(()=>{
  localStorage.setItem('world-workshop-audio-v2','{"master":85,"bgm":68,"se":90,"enabled":true}');
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:49,z:127,y:0,facing:2},townLayout:5,townMapHeight:128,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 });
 await page.goto(origin+'/?resume=1&test=1');
 const state=()=>page.evaluate(()=>window.__editorTest?.snowAudioQA());
 const wait=(index,count=1)=>page.waitForFunction(({hash,count})=>window.__editorTest?.snowAudioQA().native.sounds.filter(s=>s.hash===hash).length>=count,{hash:hashes[index],count});
 const area=(region,active)=>page.waitForFunction(({region,active})=>{
  const s=window.__editorTest?.snowAudioQA();return s?.region===region&&s?.active===active;
 },{region,active});
 const set=(id,value)=>page.locator(id).evaluate((e,v)=>{e.value=String(v);e.dispatchEvent(new Event('input',{bubbles:true}))},value);
 await page.locator('#pineStartupCover').waitFor({state:'hidden'});
 const canvas=page.locator('#view');
 // Real user interaction unlocks WebAudio without moving away from the seam.
 await page.keyboard.press('Shift');if(!(await state())?.audioTime)await canvas.click({position:{x:15,y:110}});
 await area('base','outside');await wait(0);
 assert((await state()).native.sounds.every(s=>s.hash===hashes[0]),'no snow audio before crossing');
 where='enter snow';
 await page.keyboard.press('ArrowDown');await area('snowpass','snow');await wait(1);
 const intro=(await state()).native.sounds.find(s=>s.hash===hashes[1]);
 assert(intro.loop&&intro.music&&!intro.effects&&intro.channels===2);
 assert(Math.abs(intro.duration-48)<.06&&intro.loopStart===0&&Math.abs(intro.loopEnd-intro.duration)<.001);
 assert(intro.automation.some(g=>g.some(x=>x.level===1&&x.linear&&x.at>=intro.started)),'native bus fades in');
 where='BGM mute still allows independent wind';
 await set('#poiVolumeBgm',0);await wait(2);
 let s=await state(),gust=s.native.sounds.find(x=>x.hash===hashes[2]);
 assert.equal(s.levels.bgm,0);assert.equal(s.native.music.at(-1).level,0);
 assert(gust.effects&&!gust.music&&!gust.loop&&gust.channels===1&&Math.abs(gust.duration-4.4)<.06);
 assert(gust.started-intro.started>=7,'wind arrives occasionally, not as immediate/constant noise');
 assert.equal(s.native.sounds.filter(v=>v.hash===hashes[1]).length,1,'one loop only');
 await set('#poiVolumeSe',0);s=await state();assert.equal(s.native.effects.at(-1).level,0);
 await set('#poiVolumeBgm',68);
 where='return to field';
 await page.keyboard.press('ArrowUp');await area('base','outside');await wait(0,2);
 await page.waitForFunction(({hashes})=>{const s=window.__editorTest?.snowAudioQA();
  return s.native.sounds.find(x=>x.hash===hashes[1])?.ended&&s.native.sounds.find(x=>x.hash===hashes[2])?.ended;
 },{hashes});
 s=await state();assert.equal(s.native.sounds.filter(x=>x.hash===hashes[1]).length,1);
 assert.equal(s.native.sounds.filter(x=>x.hash===hashes[2]).length,1);
 assert(s.native.sounds.filter(x=>x.hash===hashes[0]).every(x=>x.loop&&x.music&&!x.effects));
 assert.deepEqual(offsite,[]);assert.deepEqual(errors,[]);
 console.log('real offline native Ogg, snow-only BGM fade and intermittent independent SE; original field loop returns');
}catch(e){console.error('Snow audio failed at:',where);throw e}
finally{await browser?.close();server.close()}

