import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const html=readFileSync(process.argv[2]||'world-editor.html','utf8');
const a=html.indexOf('const PINE_AUDIO_SETTINGS_KEY'),b=html.indexOf('const POI_PLAYER_MAX_HP',a);
assert(a>=0&&b>a,'isolated source uses the existing real game audio functions');
const audio=html.slice(a,b);
const mixTrim='.58*poiAudioLevels.bgm/100';
assert.equal(audio.split(mixTrim).length,2);
const baseline=audio.replace(mixTrim,'.38*poiAudioLevels.bgm/100');
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--disable-dev-shm-usage']});
 const page=await browser.newPage();
 const results=await page.evaluate(async ({audio,baseline})=>{
  const rate=24000,length=rate*12;
  const stats=(buf)=>{
   const left=buf.getChannelData(0),right=buf.getChannelData(1);
   let peakL=0,peakR=0,settledPeak=0,sumL=0,sumR=0,delta=0,clip=0;
   for(let i=0;i<left.length;i++){
    const l=left[i],r=right[i];
    if(!Number.isFinite(l)||!Number.isFinite(r))throw Error('non-finite PCM');
    peakL=Math.max(peakL,Math.abs(l));peakR=Math.max(peakR,Math.abs(r));
    sumL+=l*l;sumR+=r*r;delta=Math.max(delta,Math.abs(l-r));
    if(i>=rate*.75)settledPeak=Math.max(settledPeak,Math.abs(l),Math.abs(r));
    if(Math.abs(l)>=.999||Math.abs(r)>=.999)clip++;
   }
   return {peakL,peakR,rmsL:Math.sqrt(sumL/left.length),rmsR:Math.sqrt(sumR/right.length),settledPeak,delta,clip};
  };
  async function render(bundle,zone,levels,cues){
   const context=new OfflineAudioContext(2,length,rate),state={time:0,writes:0};
   Object.defineProperty(context,'currentTime',{configurable:true,get:()=>state.time});
   // The timestamp is seeded manually to schedule the unchanged game phrases
   // and sound routines into a native two-channel OfflineAudioContext.
   const launch=new Function('context','state','zone','levels','cues',`
    const window={AudioContext:function(){return context},addEventListener(){}};
    const document={hidden:false,addEventListener(){}};
    const localStorage={getItem(){return JSON.stringify(levels)},setItem(){state.writes++}};
    const facilitySite={id:'base'};
    const poiWalkActive=true,poiWalkX=0,poiWalkZ=0,poiWalkLevel=0;
    const Math=Object.create(globalThis.Math);
    let seed=50;
    Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
    `+bundle+`
    poiAudioInitialize();
    poiAudioMusicZone=()=>zone;
    poiAudioStart=()=>{};
    for(let t=0;t<11.9;t+=.2)poiAudioTownRegionMusic(t);
    if(cues){
     let index=0;
     for(let t=1;t<11;t+=.175){
      state.time=t;
      const voice=['outdoor','indoor','mine-step','wet'][index++%4];
      poiSound(voice==='wet'?'chapel-water-step':'step',voice);
      if(index%12===0){
       poiSound('door-open','wood');state.time+=.175;poiSound('door-close','wood');
      }
     }
     state.time=4;poiSound('attack','equipWoodSword');
     state.time=4.1;poiSound('hit','equipWoodSword');
    }
    state.time=0;
    return {levels:{...poiAudioLevels},render:context.startRendering()};
   `);
   const r=launch(context,state,zone,levels,cues);
   return {...stats(await r.render),writes:state.writes,levels:r.levels};
  }
  const zones=['town','outside','mine','otherworld','chapel','market'],full={master:100,bgm:100,se:100};
  const converted=[];
  for(const zone of zones)converted.push({zone,...await render(audio,zone,full,true)});
  const normal={master:85,bgm:68,se:90};
  return {converted,
   before:await render(baseline,'town',normal,false),after:await render(audio,'town',normal,false),
   muted:await render(audio,'town',{master:0,bgm:100,se:100},true),
   flat:await render(audio,'town',{master:100,bgm:0,se:0},true)};
 },{audio,baseline});
 for(const sample of results.converted){
  assert(sample.peakL>.015&&sample.peakL<.97,sample.zone+' combined render headroom '+JSON.stringify(sample));
  assert.equal(sample.clip,0);
  assert(sample.delta<1e-6,'existing unpanned stereo routing is retained');
  assert.equal(sample.writes,0);assert.deepEqual(sample.levels,{master:100,bgm:100,se:100});
 }
 assert(results.after.rmsL/results.before.rmsL>1.30,'BGM lift is audible on the waveform, not a slider-only change');
 for(const muted of [results.muted,results.flat]){
  assert(muted.settledPeak<1e-5,'master and mute buses are silent after the preexisting gain ramp');
  assert.equal(muted.writes,0);
 }
 console.log('PASS native stereo WebAudio: '+JSON.stringify(results));
}finally{await browser?.close()}
