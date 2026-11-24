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
 const context={currentTime:now,state:'running',sampleRate:24000,createGain:()=>mock('gain'),
  createOscillator:()=>mock('osc'),createBufferSource:()=>mock('noise'),createBiquadFilter:()=>mock('filter'),
  createBuffer:(_,count,sampleRate)=>{const mono=new Float32Array(count);return {duration:count/sampleRate,getChannelData:()=>mono}},
  suspend(){this.state='suspended';return Promise.resolve()}};
 const math=Object.create(Math);math.random=()=>.5;
 const writes=[],notes=[],timers=[];
 const x=vm.createContext({console,Math:math,atob:data=>Buffer.from(data,'base64').toString('latin1'),localStorage:{getItem(){return null},setItem(...args){writes.push(args)}},
  facilitySite:id?{id,creek:{sound:{x:68,z:39}}}:null,facilityCreekIndex:{hasWater:true},
  poiWalkX:68,poiWalkZ:39,poiWalkLevel:0,poiWalkActive:true,poiRegionAt:()=>({name:"拠点"}),
  window:{addEventListener(){}},document:{hidden:false,addEventListener(){}},notes,context,mock,
  setInterval(fn,delay){timers.push(delay);return 1},clearInterval(){}});
 const run=(s)=>vm.runInContext(s,x);
 run(html.slice(html.indexOf(mark),html.indexOf(end))+`
  poiAudioContext=context;
  poiAudioMaster=mock('master');poiAudioMusic=mock('music');
  poiAudioAmbience=mock('ambience');poiAudioEffects=mock('effects');
  poiAudioApplyLevels();
  poiPianoKey=(...args)=>notes.push(args);
  poiAudioStart();
  if(facilitySite?.id==='base')poiAudioMusicPhrase();
 `);
 const fx=(kind,weapon,timing=false,defeated=false,player=true)=>{
  const start=nodes.length;run('poiSound('+JSON.stringify(kind)+','+JSON.stringify(weapon)+','+defeated+',false,null,'+player+')');
  return nodes.slice(start).filter(n=>n.kind==='noise'||n.kind==='osc').map(n=>{
   if(n.kind==='noise'&&n.next?.kind==='gain'){
    assert.equal(n.next.next.kind,'effects');
    const row=['buffer',Math.round(n.buffer.duration*1000),n.next.gain.value,0];
    if(timing)row.push(+((n.startTime-now)*1000).toFixed(3));
    return row;
   }
   const f=n.next?.kind==='filter'?n.next:null,type=f?'filter':'osc';
   const g=(f||n).next.gain,peak=g.events.find(e=>e[0]==='peak');
   assert.equal((f||n).next.next.kind,'effects');
   const row=[type,f?.frequency.value??n.frequency.events[0][1],peak[1],+((peak[2]-n.startTime)*1000).toFixed(3)];
   if(timing)row.push(+((n.startTime-now)*1000).toFixed(3));
   return row;
  });
 };
 return {nodes,now,notes,timers,writes,fx,run,wind:()=>nodes.find(n=>n.kind==='filter'&&n.type==='lowpass'&&n.next?.next?.kind==='ambience')?.next.gain.value,
  rustle:()=>nodes.find(n=>n.kind==='filter'&&n.frequency.value===1450)?.next.gain.value,
  creek:()=>nodes.find(n=>n.kind==='filter'&&n.frequency.value===1050)?.next.gain.value};
}
test('continuous wind/rustle are gone while the local creek, orchestra and mixer stay intact',()=>{
 const b=harness('base'),k=harness('kitchen'),e=harness(null);
 assert.deepEqual([b.wind(),b.rustle(),b.creek()],[undefined,undefined,.145]);
 for(const a of [k,e])assert.deepEqual([a.wind(),a.rustle(),a.creek()],[undefined,undefined,undefined]);
 for(const a of [b,k,e]){
  assert.deepEqual(a.writes,[]);
  assert.equal(a.nodes.find(n=>n.kind==='music').gain.value,.58*68/100);
  assert.equal(a.nodes.find(n=>n.kind==='ambience').gain.value,.39*68/100);
  assert.equal(a.nodes.find(n=>n.kind==='effects').gain.value,.90*90/100);
 }
 assert.equal(b.notes.length,0,'the superseded piano transport does not schedule simultaneously');
 assert.equal(b.run('poiOrchestraSnapshot().active'),'town');
 assert(b.run('poiOrchestraSnapshot().voices')>=2,'new music bus has a real chord');
 assert.deepEqual(b.timers,[200]);assert.deepEqual(k.timers,[200]);
});
test('base footsteps and swings have warmer spectrum and rounded attacks; unrelated cues use the exact previous graph',()=>{
 const b=harness('base'),k=harness('kitchen');
 assert.deepEqual(b.fx('step'),[['filter',490,.225,25],['osc',100,.12,20]]);
 assert.deepEqual(b.fx('attack'),[['filter',790,.41,28],['filter',1120,.18,26],['osc',145,.20,19]]);
 assert.deepEqual(k.fx('step'),[['filter',670,.29,16],['osc',117,.16,14]]);
 assert.deepEqual(k.fx('attack'),[['filter',1250,.58,8],['filter',2100,.32,8],['osc',180,.26,8]]);
 for(const cue of ['door-open','door-close','hit','hurt'])assert.deepEqual(b.fx(cue),k.fx(cue),cue);
 b.run('document.hidden=true;poiAudioStop(true)');
 assert.equal(b.run('poiAudioTransient.size'),0);
 assert.equal(b.run('poiCreekAudio===null'),true);
 assert.deepEqual(b.writes,[]);
});

test('wooden sword has a distinct soft cut and woody contact scheduled at the blade crossing',()=>{
 const b=harness('base');
 const swing=b.fx('attack','equipWoodSword',true),hit=b.fx('hit','equipWoodSword',true);
 assert.deepEqual(swing.map(r=>r[1]),[940,1630,126]);
 assert.deepEqual(hit,[['buffer',252,.78,0,108]]);
 assert.equal(Math.min(...hit.map(r=>r[4])),108);
 assert.ok(swing[0][4]+swing[0][3]>70&&swing[0][4]+swing[0][3]<116,'air peaks during the swing');
 assert.ok(swing.every(r=>r[2]<.48));
 assert.deepEqual(b.fx('hit','unrecognizedWeapon'),b.fx('hit'));
});
test('existing weapon materials have different offscreen cue profiles and respect lifecycle and mute',()=>{
 const b=harness('base');
 const weapons=['equipStick','equipClub','equipWoodSword','equipStoneSword','equipIronSword'];
 for(const kind of ['attack','hit']){
  const spectra=weapons.map(id=>JSON.stringify(b.fx(kind,id,false,false,false).map(r=>r[1])));
  assert.equal(new Set(spectra).size,weapons.length);
 }
 const playerSwing=weapons.map(id=>JSON.stringify(b.fx('attack',id).map(r=>r[1])));
 assert.equal(new Set(playerSwing).size,weapons.length,'player miss profiles stay distinct');
 const playerHit=weapons.map(id=>b.fx('hit',id));
 assert.equal(new Set(playerHit.slice(0,3).map(JSON.stringify)).size,3,'stick, club and wood remain distinct');
 assert.deepEqual(playerHit.slice(3),[[['buffer',196,.57,0]],[['buffer',196,.57,0]]]);
 b.run('poiAudioLevels.se=0');assert.deepEqual(b.fx('attack','equipWoodSword'),[]);
 b.run('poiAudioLevels.se=90;document.hidden=true');assert.deepEqual(b.fx('hit','equipWoodSword'),[]);
});

test('defeat adds one common crack-and-tear cue over genuine contact, never over an empty swing',()=>{
 const b=harness('base');
 const wood=b.fx('hit','equipWoodSword',true);
 const lethal=b.fx('hit','equipWoodSword',true,true);
 assert.deepEqual(lethal.slice(0,1),wood,'preserve the wood layer on a killing blow');
 assert.deepEqual(lethal.slice(1),[['buffer',636,.80,0,126]]);
 assert.deepEqual(b.fx('hit',null,true,true).slice(2),[['buffer',636,.80,0,18]]);
 assert.deepEqual(b.fx('attack','equipWoodSword',true,true),b.fx('attack','equipWoodSword',true));
 b.run('poiAudioLevels.master=0');assert.deepEqual(b.fx('hit','equipWoodSword',true,true),[]);
 b.run('poiAudioLevels.master=85;document.hidden=true');
 assert.deepEqual(b.fx('hit',null,true,true),[]);
 b.run('poiAudioStop(true)');assert.equal(b.run('poiAudioTransient.size'),0);
});

test('wood sound uses one cached dry impulse with a short tail',()=>{
 const b=harness('base');b.fx('hit','equipWoodSword');b.fx('hit','equipWoodSword');
 const hits=b.nodes.filter(n=>n.kind==='noise'&&n.buffer?.duration===.252);
 assert.equal(hits.length,2);
 assert.equal(hits[0].buffer,hits[1].buffer);
 const wave=hits[0].buffer.getChannelData(0);
 const rms=a=>Math.sqrt(a.reduce((sum,v)=>sum+v*v,0)/a.length);
 assert.equal(Math.max(...wave.map(Math.abs)),30146/32768);
 assert.ok(rms(wave.slice(120,720))>6*rms(wave.slice(-720)));
 assert.equal(wave[0],0);
 assert.ok(Math.abs(wave[wave.length-1])<.001);
});
test('indoor steps and material-aware door openings use short distinct cached effect buffers',()=>{
 const b=harness('base'),k=harness('kitchen');
 assert.deepEqual(b.fx('step','indoor'),[['buffer',104,.46,0]]);
 assert.deepEqual(b.fx('step','outdoor'),[['filter',490,.225,25],['osc',100,.12,20]]);
 assert.deepEqual(k.fx('step','indoor'),[['filter',670,.29,16],['osc',117,.16,14]]);
 const doorClipMs=(id,old)=>b.run(`Object.hasOwn(POI_RECORDED_FOLEY,'${id}')?Math.round(poiRecordedFoley('${id}').duration*1000):${old}`);
 assert.deepEqual(b.fx('door-open','wood'),[['buffer',doorClipMs('doorOpen',285),.38,0]]);
 assert.deepEqual(b.fx('door-close','wood',true),[['buffer',doorClipMs('doorClose',164),.68,0,24]]);
 assert.deepEqual(b.fx('door-open','stone'),[['buffer',310,.38,0]]);
 assert.deepEqual(b.fx('door-close','stone',true),[['buffer',180,.68,0,24]]);
 b.run('poiAudioLevels.se=0');assert.deepEqual(b.fx('door-open','stone'),[]);assert.deepEqual(b.fx('door-close','wood'),[]);assert.deepEqual(b.fx('step','indoor'),[]);
});
test('only a successful step onto a closed door tile plays the opening cue, using the rendered leaf',()=>{
 const a=html.indexOf('function poiWalkStep('),b=html.indexOf('function poiWalkAction(',a),step=html.slice(a,b);
 assert.match(step,/stairCell\.find\(\(\{type\}\)=>poiWalkPassableDoor\(type\)/);
 assert.match(step,/material:door\.type==='ironwallDoor'\?'iron':facilityHasDiningStoneLeaf\(door\)\?'stone':'wood'/);
 assert.match(step,/if\(after\)\{poiSound\('door-open',after\.material\)/);
 assert.match(step,/poiSound\('door-close',before\.material\)/);
 assert.match(step,/if\(!poiWalkDoorFoley\(door,fromLevel,onDoorCue\)&&!continuous\)poiWalkFootstep\(wet\)/);
 assert.match(step,/else poiSound\('step',poiDungeonThemeAt\(facilitySite,poiWalkX,poiWalkZ,poiWalkLevel\)==='mine'\?'mine-step':\s*facilitySite\?\.id==='base'&&\(poiWalkLevel<0\|\|poiWalkIndoor\(\)\)\?'indoor':'outdoor'\)/);
});

test('saved percentages are preserved, BGM has headroom, and zero mutes each bus independently',()=>{
 const a=harness('base'),gain=name=>a.nodes.find(n=>n.kind===name).gain.value;
 a.run("poiAudioLevels={master:100,bgm:100,se:100};poiAudioApplyLevels()");
 assert.equal(gain('master'),1);assert.equal(gain('music'),.58);assert.equal(gain('ambience'),.39);assert.equal(gain('effects'),.90);
 a.run("poiAudioLevels.bgm=0;poiAudioApplyLevels()");
 assert.equal(gain('music'),0);assert.equal(gain('ambience'),0);assert.equal(gain('effects'),.90);
 a.run("poiAudioLevels.se=0;poiAudioLevels.bgm=68;poiAudioApplyLevels()");
 assert.equal(gain('effects'),0);assert(gain('music')>.38*.68);
 assert.deepEqual(a.writes,[]);
});
test('chapel footsteps retain the wet cues but take the edge off the splash',()=>{
 const a=harness('base');
 assert.deepEqual(a.fx('chapel-water-step',null,true),[['filter',1120,.073,11,0],['filter',560,.055,14,32]]);
 assert.deepEqual(a.fx('skater-splash',null,true),[['filter',1760,.112,8,0],['filter',860,.07,14,26]]);
});
