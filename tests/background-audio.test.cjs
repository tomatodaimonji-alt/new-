const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function audioHarness(){
 const begin=html.indexOf('const PINE_AUDIO_SETTINGS_KEY'),end=html.indexOf('const POI_PLAYER_MAX_HP',begin);
 assert(begin>=0&&end>begin);
 const events=(props={})=>({...props,dispatch(name){for(const fn of this[name]||[])fn()},addEventListener(name,fn){(this[name]??=[]).push(fn)}});
 const field=()=>({value:0,setTargetAtTime(v){this.value=v},setValueAtTime(v){this.value=v},cancelScheduledValues(){},exponentialRampToValueAtTime(){},linearRampToValueAtTime(){}});
 const sources=[];
 const node=(source=false)=>{
  const n={gain:field(),frequency:field(),Q:field(),threshold:field(),knee:field(),ratio:field(),attack:field(),release:field(),
   connect(other){return other},disconnect(){this.disconnected=true},start(){this.started=true},stop(){this.stops=(this.stops??0)+1}};
  if(source)sources.push(n);
  return n;
 };
 class AudioContext {
  state='running';currentTime=1;sampleRate=12;destination=node();
  createGain(){return node()}createDynamicsCompressor(){return node()}createBiquadFilter(){return node()}
  createOscillator(){return node(true)}createBufferSource(){return node(true)}
  createBuffer(){return {getChannelData:()=>new Float32Array(24)}}
  suspend(){this.state='suspended';return Promise.resolve()}resume(){this.state='running';return Promise.resolve()}
 }
 const activeTimers=new Set();let timerId=0,saves=0;const settingWrites=[];
 const window=events({AudioContext,pineStartup:{ready:true},performance:{now:()=>1}}),document=events({hidden:false});
 const ctx=vm.createContext({window,document,localStorage:{getItem(){return null},setItem(...a){settingWrites.push(a)}},
  console,poiWalkX:0,poiWalkZ:0,poiWalkLevel:0,facilitySite:null,poiWalkActive:false,workshopResumeWrite(){saves++;},setInterval(fn){activeTimers.add(++timerId);return timerId},clearInterval(id){activeTimers.delete(id)}});
 const start=html.indexOf('// BEGIN WORKSHOP SUSPENDABLE GAME CLOCK'),stop=html.indexOf('// END WORKSHOP SUSPENDABLE GAME CLOCK',start);
 vm.runInContext(html.slice(start,stop)+html.slice(begin,end)+';poiPauseInput=()=>{};poiPauseMounted=true;',ctx);
 return {window,document,sources,activeTimers,settingWrites,saves:()=>saves,
  eval:(s)=>vm.runInContext(s,ctx), situation:()=>vm.runInContext(
  '({context:poiAudioContext?.state,music:poiAudioNotes.size,master:poiAudioMaster?.gain.value,levels:JSON.stringify(poiAudioLevels),effects:typeof poiAudioTransient==="undefined"?null:poiAudioTransient.size})',ctx)};
}
test('background suspends current and scheduled audio in place, keeps settings, restarts only one scheduler',()=>{
 const h=audioHarness();
 h.eval('poiWalkActive=true;poiAudioStart();poiSound("attack")');
 assert.equal(h.activeTimers.size,1);
 assert(h.situation().effects>0);
 const original=h.situation().levels,oldSources=[...h.sources],oldEffects=h.situation().effects,oldStops=h.sources.map(s=>s.stops);
 h.document.hidden=true;h.document.dispatch('visibilitychange');
 assert.equal(h.activeTimers.size,0);
 assert.deepEqual(h.sources.map(s=>s.stops),oldStops);
 assert.equal(h.saves(),1);
 assert.equal(h.situation().context,'suspended');
 h.eval('poiAudioStart();poiSound("step")');
 assert.equal(h.sources.length,oldSources.length);
 h.document.hidden=false;h.document.dispatch('visibilitychange');
 assert.equal(h.activeTimers.size,1);
 assert.equal(h.situation().context,'running');
 assert.equal(h.situation().effects,oldEffects);
 assert.equal(h.situation().levels,original);assert.deepEqual(h.settingWrites,[]);
 h.document.dispatch('visibilitychange');assert.equal(h.activeTimers.size,1);
 h.eval('poiWalkActive=false;poiAudioStop()');
 h.document.dispatch('visibilitychange');assert.equal(h.activeTimers.size,0);
});
test('pagehide and native background guards are independent and cannot restart editor audio',()=>{
 const h=audioHarness();
 h.eval('poiWalkActive=true;poiAudioStart()');
 h.window.dispatch('pagehide');assert.equal(h.activeTimers.size,0);
 h.window.__workshopAudioForeground(true);assert.equal(h.activeTimers.size,0,'pagehide still blocks');
 h.window.dispatch('pageshow');assert.equal(h.activeTimers.size,1);
 h.window.__workshopAudioForeground(false);assert.equal(h.activeTimers.size,0);
 assert.equal(h.saves(),2,'native pause saves location once without altering world timers');
 h.document.dispatch('visibilitychange');assert.equal(h.activeTimers.size,0,'native pause still blocks');
 h.eval('poiWalkActive=false;poiAudioStop()');
 h.window.__workshopAudioForeground(true);assert.equal(h.activeTimers.size,0);
});
