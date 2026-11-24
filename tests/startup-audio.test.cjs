const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8'),slice=(a,b)=>h.slice(h.indexOf(a),h.indexOf(b,h.indexOf(a)+1));
function harness({running=true}={}){
 const hints=[],sounds=[],intervals=new Map(),listeners={},frames=[],el={},gain=()=>({events:[],value:0,setTargetAtTime(...v){this.events.push(v)},setValueAtTime(){},cancelScheduledValues(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}});
 const node=()=>({gain:gain(),frequency:gain(),Q:gain(),delayTime:gain(),detune:gain(),connect(v){this.sink=v;return v},disconnect(){},start(t){sounds.push(this);this.startAt=t},stop(t){this.stopAt=t},setPeriodicWave(){}});
 const ctx={state:running?'running':'suspended',currentTime:3,createGain:node,createBiquadFilter:node,createDelay:node,createOscillator:node,createBufferSource:node,
  createPeriodicWave:()=>({}),createBuffer:(x,y,f)=>({duration:y/f,getChannelData:()=>new Float32Array(y)}),resume(){return Promise.resolve()},suspend(){this.state='suspended';return Promise.resolve()}};
 const ev=(name,cb)=>(listeners[name]??=[]).push(cb);
 const fire=(name)=>{for(const cb of listeners[name]??[])cb({type:name});};
 const c=vm.createContext({console,atob,ctx,mixer:node(),effects:node(),ambience:node(),poiWalkActive:true,facilitySite:{id:'base'},
  poiWalkLevel:0,poiWalkX:20,poiWalkZ:20,localStorage:{getItem(){return null}},
  window:{addEventListener:ev,dispatchEvent:e=>{hints.push(e.type);fire(e.type)}},
  document:{hidden:false,addEventListener:ev,getElementById:id=>(el[id]??={hidden:false,dataset:{},addEventListener(){}})},
  Event:class{constructor(type){this.type=type;}},requestAnimationFrame(fn){frames.push(fn)},setTimeout:()=>1,clearTimeout(){},
  setInterval:(fn,n)=>{const id=intervals.size+1;intervals.set(id,{fn,n});return id},clearInterval:id=>intervals.delete(id)});
 const run=s=>vm.runInContext(s,c);
 run(slice('// BEGIN PINE STARTUP COVER','// END PINE STARTUP COVER'));
 run(slice('const PINE_AUDIO_SETTINGS_KEY','const POI_PLAYER_MAX_HP')+`
 ;poiAudioMusic=mixer;poiAudioEffects=effects;poiAudioAmbience=ambience;poiAudioContext=ctx;
 poiAudioMusicZone=()=>'town';poiSound=(kind)=>{if(kind==='probe')effects.start(0)};`);
 async function paints(n){for(let i=0;i<n;i++){await Promise.resolve();for(const frame of frames.splice(0))frame();await Promise.resolve();await new Promise(r=>setImmediate(r));}}
 async function initialized(){const job=c.window.pineStartup.start(async()=>{});await paints(4);await job;}
 async function ready(){const job=c.window.pineStartup.rendered();await paints(2);await job;}
 return {c,run,node,ctx,hints,sounds,el,intervals,initialized,ready,fire};
}
test('after initialization but through the first-frame cover: no score timer, score deck or notes; ready immediately arms once',async()=>{
 const f=harness();await f.initialized();f.run('poiAudioStart();poiOrchestraTick(ctx.currentTime)');
 a.equal(f.el.pineStartupCover.hidden,false);
 a.equal(f.intervals.size,0);
 a.equal(f.run('poiOrchestraSnapshot().active'),null);
 a.equal(f.sounds.length,0);
 await f.ready();
 a(f.el.pineStartupCover.hidden);a(f.c.window.pineStartup.ready);a.equal(f.intervals.size,1);
 a.equal(f.run('poiOrchestraSnapshot().active'),'town');a(f.sounds.length>0);
 a.deepEqual(f.run('poiOrchestraDecks.get("town").output.gain.events.at(-1)'),[1,3,.30]);
 const count=f.sounds.length;f.run('poiAudioStart();poiAudioStart(true)');f.fire('pineWorkshopReady');
 a.equal(f.sounds.length,count);a.equal(f.intervals.size,1);
});
test('cold ready while backgrounded cannot play; first actual foreground unlock fades only once',async()=>{
 const f=harness();await f.initialized();
 f.c.document.hidden=true;await f.ready();
 a.equal(f.intervals.size,0);a.equal(f.sounds.length,0);
 f.c.document.hidden=false;f.run('poiAudioStart(true)');a.equal(f.intervals.size,1);
 a.deepEqual(f.run('poiOrchestraDecks.get("town").output.gain.events.at(-1)'),[1,3,.30]);
 f.run('poiAudioStop(true)');f.ctx.state='running';f.ctx.currentTime=5;f.run('poiAudioStart(true)');
 a.deepEqual(f.run('poiOrchestraDecks.get("town").output.gain.events.at(-1)'),[1,5,.10]);
});
test('failed cover stays muted; readiness without running AudioContext does not fake an unlock',async()=>{
 const f=harness({running:false});await f.initialized();await f.ready();
 a.equal(f.intervals.size,0);a.equal(f.sounds.length,0);
 f.ctx.state='running';f.run('poiAudioStart(true)');
 a.equal(f.intervals.size,1);a(f.sounds.length>0);
 const failed=harness();await failed.initialized();failed.c.window.pineStartup.fail();
 failed.run('poiAudioStart(true);poiOrchestraTick(ctx.currentTime)');await failed.ready();
 a(failed.c.window.pineStartup.failed);a.equal(failed.el.pineStartupCover.hidden,false);
 a.equal(failed.intervals.size,0);a.equal(failed.sounds.length,0);
});

