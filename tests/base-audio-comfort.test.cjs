const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(process.env.HTML||path.join(__dirname,'../world-editor.html'),'utf8');
const mark='const PINE_AUDIO_SETTINGS_KEY',end='const POI_PLAYER_MAX_HP';
function harness(id) {
 const now=10,nodes=[];
 const param=(value=0)=>({value,events:[],
  setValueAtTime(v,t){this.events.push(['start',v,t])},
  linearRampToValueAtTime(v,t){this.events.push(['peak',v,t])},
  exponentialRampToValueAtTime(v,t){this.events.push(['end',v,t])},
  cancelScheduledValues(){},setTargetAtTime(v){this.value=v}
 });
 const mock=(kind)=>{const n={kind,gain:param(),Q:param(),frequency:param(),playbackRate:param(),
  connect(next){this.next=next;return next},start(t){this.startTime=t},stop(){this.stopped=true},
  disconnect(){this.disconnected=true}};nodes.push(n);return n};
 const context={currentTime:now,state:'running',sampleRate:48,createGain:()=>mock('gain'),
  createOscillator:()=>mock('osc'),createBufferSource:()=>mock('noise'),createBiquadFilter:()=>mock('filter'),
  createBuffer:()=>({getChannelData:()=>new Float32Array(96)}),
  suspend(){this.state='suspended';return Promise.resolve()}};
 const math=Object.create(Math);math.random=()=>.5;
 const writes=[],notes=[],timers=[];
 const x=vm.createContext({console,Math:math,localStorage:{getItem(){return null},setItem(...args){writes.push(args)}},
  facilitySite:id?{id,creek:{sound:{x:68,z:39}}}:null,facilityCreekIndex:{hasWater:true},
  poiWalkX:68,poiWalkZ:39,poiWalkLevel:0,poiWalkActive:true,
  window:{addEventListener(){}},document:{hidden:false,addEventListener(){}},notes,context,mock,
  setInterval(fn,delay){timers.push(delay);return 1},clearInterval(){}});
 const run=(s)=>vm.runInContext(s,x);
 run(html.slice(html.indexOf(mark),html.indexOf(end))+`
  poiAudioContext=context;
  poiAudioMaster=mock('master');poiAudioMusic=mock('music');
  poiAudioAmbience=mock('ambience');poiAudioEffects=mock('effects');
  poiAudioApplyLevels();
  poiPianoKey=(...args)=>notes.push(args);
  poiAudioStart()
 `);
 const fx=(kind,weapon,timing=false)=>{
  const start=nodes.length;run('poiSound('+JSON.stringify(kind)+','+JSON.stringify(weapon)+')');
  return nodes.slice(start).filter(n=>n.kind==='noise'||n.kind==='osc').map(n=>{
   const f=n.next?.kind==='filter'?n.next:null,type=f?'filter':'osc';
   const g=(f||n).next.gain,peak=g.events.find(e=>e[0]==='peak');
   assert.equal((f||n).next.next.kind,'effects');
   const row=[type,f?.frequency.value??n.frequency.events[0][1],peak[1],+((peak[2]-n.startTime)*1000).toFixed(3)];
   if(timing)row.push(+((n.startTime-now)*1000).toFixed(3));
   return row;
  });
 };
 return {nodes,now,notes,timers,writes,fx,run,wind:()=>nodes.find(n=>n.kind==='filter'&&n.type==='lowpass').next.gain.value,
  rustle:()=>nodes.find(n=>n.kind==='filter'&&n.frequency.value===1450).next.gain.value,
  creek:()=>nodes.find(n=>n.kind==='filter'&&n.frequency.value===1050)?.next.gain.value};
}
test('base ambience has a small reduction while the piano, global mixer and stock ambience stay intact',()=>{
 const b=harness('base'),k=harness('kitchen'),e=harness(null);
 assert.deepEqual([b.wind(),b.rustle(),b.creek()],[.14,.039,.145]);
 for(const a of [k,e])assert.deepEqual([a.wind(),a.rustle(),a.creek()],[.17,.05,undefined]);
 for(const a of [b,k,e]){
  assert.deepEqual(a.writes,[]);
  assert.equal(a.nodes.find(n=>n.kind==='music').gain.value,.38*68/100);
  assert.equal(a.nodes.find(n=>n.kind==='ambience').gain.value,.39*68/100);
  assert.equal(a.nodes.find(n=>n.kind==='effects').gain.value,.90*90/100);
 }
 assert.deepEqual(b.notes.map(v=>Array.from(v)),[[130.8127826502993,10.09,.41]]);
 assert.deepEqual(b.timers,[200]);assert.deepEqual(k.timers,[8000]);
});
test('base footsteps and swings have warmer spectrum and rounded attacks; unrelated cues use the exact previous graph',()=>{
 const b=harness('base'),k=harness('kitchen');
 assert.deepEqual(b.fx('step'),[['filter',550,.29,22],['osc',100,.145,16]]);
 assert.deepEqual(b.fx('attack'),[['filter',790,.41,28],['filter',1120,.18,26],['osc',145,.20,19]]);
 assert.deepEqual(k.fx('step'),[['filter',810,.4,8],['osc',117,.21,8]]);
 assert.deepEqual(k.fx('attack'),[['filter',1250,.58,8],['filter',2100,.32,8],['osc',180,.26,8]]);
 for(const cue of ['door','hit','hurt'])assert.deepEqual(b.fx(cue),k.fx(cue),cue);
 b.run('document.hidden=true;poiAudioStop(true)');
 assert.equal(b.run('poiAudioTransient.size'),0);
 assert.equal(b.run('poiCreekAudio===null'),true);
 assert.deepEqual(b.writes,[]);
});

test('wooden sword has a distinct soft cut and woody contact scheduled at the blade crossing',()=>{
 const b=harness('base');
 const swing=b.fx('attack','equipWoodSword',true),hit=b.fx('hit','equipWoodSword',true);
 assert.deepEqual(swing.map(r=>r[1]),[940,1630,126]);
 assert.deepEqual(hit.map(r=>r[1]),[515,870,195]);
 assert.equal(Math.min(...hit.map(r=>r[4])),108);
 assert.ok(swing[0][4]+swing[0][3]>70&&swing[0][4]+swing[0][3]<116,'air peaks during the swing');
 assert.ok([...swing,...hit].every(r=>r[2]<.48));
 assert.deepEqual(b.fx('hit','unrecognizedWeapon'),b.fx('hit'));
});
test('existing weapon materials have different offscreen cue profiles and respect lifecycle and mute',()=>{
 const b=harness('base');
 const weapons=['equipStick','equipClub','equipWoodSword','equipStoneSword','equipIronSword'];
 for(const kind of ['attack','hit']){
  const spectra=weapons.map(id=>JSON.stringify(b.fx(kind,id).map(r=>r[1])));
  assert.equal(new Set(spectra).size,weapons.length);
 }
 b.run('poiAudioLevels.se=0');assert.deepEqual(b.fx('attack','equipWoodSword'),[]);
 b.run('poiAudioLevels.se=90;document.hidden=true');assert.deepEqual(b.fx('hit','equipWoodSword'),[]);
});
