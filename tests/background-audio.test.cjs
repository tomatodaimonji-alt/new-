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
   connect(other){return other},disconnect(){this.disconnected=true},start(){this.started=true},stop(){this.stopped=true}};
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
 const activeTimers=new Set();let timerId=0,wildPauses=0;const settingWrites=[];
 const window=events({AudioContext}),document=events({hidden:false});
 const ctx=vm.createContext({window,document,localStorage:{getItem(){return null},setItem(...a){settingWrites.push(a)}},
  console,facilitySite:null,poiWalkActive:false,poiWildPause(){wildPauses++;},setInterval(fn){activeTimers.add(++timerId);return timerId},clearInterval(id){activeTimers.delete(id)}});
 vm.runInContext(html.slice(begin,end),ctx);
 return {window,document,sources,activeTimers,settingWrites,wildPauses:()=>wildPauses,
  eval:(s)=>vm.runInContext(s,ctx), situation:()=>vm.runInContext(
  '({context:poiAudioContext?.state,music:poiAudioNotes.size,master:poiAudioMaster?.gain.value,levels:JSON.stringify(poiAudioLevels),effects:typeof poiAudioTransient==="undefined"?null:poiAudioTransient.size})',ctx)};
}
test('background cancels current and scheduled audio, keeps settings, restarts only one music scheduler',()=>{
 const h=audioHarness();
 h.eval('poiWalkActive=true;poiAudioStart();poiSound("attack")');
 assert.equal(h.activeTimers.size,1);
 assert(h.situation().effects>0);
 const original=h.situation().levels,oldSources=[...h.sources];
 h.document.hidden=true;h.document.dispatch('visibilitychange');
 assert.equal(h.activeTimers.size,0);
 assert(h.sources.every(s=>s.stopped));
 assert.equal(h.situation().master,0);
 assert.equal(h.situation().context,'suspended');
 h.eval('poiAudioStart();poiSound("step")');
 assert.equal(h.sources.length,oldSources.length);
 h.document.hidden=false;h.document.dispatch('visibilitychange');
 assert.equal(h.activeTimers.size,1);
 assert.equal(h.situation().context,'running');
 assert.equal(h.situation().effects,0);
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
 assert.equal(h.wildPauses(),1,'native pause also disarms the wilderness frame timer');
 h.document.dispatch('visibilitychange');assert.equal(h.activeTimers.size,0,'native pause still blocks');
 h.eval('poiWalkActive=false;poiAudioStop()');
 h.window.__workshopAudioForeground(true);assert.equal(h.activeTimers.size,0);
});
