const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.argv[2]||process.env.HTML||'world-editor.html','utf8');
const cut=(u,v)=>{const i=h.indexOf(u),j=h.indexOf(v,i+u.length);a(i>=0&&j>i,u);return h.slice(i,j)};
function harness(){
 const recorded=[],nodes=[];
 const param=()=>({value:0,events:[],setTargetAtTime(...v){this.events.push(['target',...v]);this.value=v[0]},setValueAtTime(...v){this.events.push(['value',...v]);this.value=v[0]},
 linearRampToValueAtTime(...v){this.events.push(['ramp',...v]);this.value=v[0]},exponentialRampToValueAtTime(...v){this.events.push(['exp',...v]);this.value=v[0]},cancelScheduledValues(){}});
 const node=()=>{const n={gain:param(),frequency:param(),detune:param(),delayTime:param(),Q:param(),connect(to){this.to=to;return to},disconnect(){this.disconnected=true},
  start(t){recorded.push({n:this,t})},stop(t){this.stopped=t},setPeriodicWave(v){this.wave=v}};nodes.push(n);return n};
 const ctx={currentTime:0,state:'running',sampleRate:24000,createGain:node,createBiquadFilter:node,createDelay:node,
  createOscillator:node,createBufferSource:node,createPeriodicWave:(r,i)=>({r,i}),createBuffer:(n,l,rr)=>({duration:l/rr,getChannelData:()=>new Float32Array(l)})};
 const c={poiAudioContext:ctx,poiAudioMusic:node(),poiAudioNotes:new Set(),poiWalkActive:true,poiAudioEnabled:true,pineAIActive:false,poiAudioAllowed:()=>true,
  poiAudioLevels:{master:85,bgm:70},facilitySite:{id:'base'},poiWalkLevel:0,poiWalkX:20,poiWalkZ:20,poiEnemyPending:new Set(),poiPlayerDying:()=>false,
  poiAudioMusicZone:()=>c.zone,zone:'town',poiWalkIndoor:()=>c.indoors,indoors:false,
  poiPlayerHitstop:null};
 const api=vm.runInNewContext(cut('// BEGIN ORIGINAL ORCHESTRA SCORE','// END ORIGINAL ORCHESTRA SCORE')+
  cut('// BEGIN ORCHESTRAL TRANSPORT','// END ORCHESTRAL TRANSPORT')+';({tick:poiOrchestraTick,reset:poiOrchestraReset,pulse:poiOrchestraCombat,scene:poiOrchestraScene,snapshot:poiOrchestraSnapshot})',c);
 return {c,recorded,nodes,ctx,api};
}
test('all maps emit native timbre nodes, with a full fade to silence and only one live score deck',()=>{
 const {c,recorded,ctx,api}=harness();api.tick(0);
 a.equal(api.snapshot().active,'town');a(recorded.length>1);
 a(recorded.every(e=>e.t>=0&&e.t<.5));a(recorded.some(e=>!!e.n.wave));
 c.indoors=true;ctx.currentTime=.3;api.tick(.3);
 a.equal(api.snapshot().active,'town');a.equal(api.snapshot().decks.length,1);
 c.zone='mine';ctx.currentTime=.5;api.tick(.5);
 a.equal(api.snapshot().active,'town');a.equal(api.snapshot().decks.length,1);
 ctx.currentTime=1.23;api.tick(1.23);a.equal(api.snapshot().active,'mine');
 ctx.currentTime=1.6;api.tick(1.6);a.equal(api.snapshot().decks.length,1);
});
test('combat uses nearby committed attacks and fades back, never a transparent idle lock',()=>{
 const {c,api,ctx}=harness();api.tick(0);a.equal(api.snapshot().active,'town');
 c.poiEnemyPending.add({playerAttack:{pending:true,y:0,sx:23,sz:21}});ctx.currentTime=.5;api.tick(.5);
 a.equal(api.snapshot().active,'town');
 ctx.currentTime=1.23;api.tick(1.23);a.equal(api.snapshot().active,'battle');
 c.poiEnemyPending.clear();ctx.currentTime=2;api.tick(2);a.equal(api.snapshot().active,'battle');
 ctx.currentTime=10;api.tick(10);a.equal(api.snapshot().active,'battle');
 ctx.currentTime=10.74;api.tick(10.74);a.equal(api.snapshot().active,'town');
});
test('suspend/reset cancels every scheduled score voice and restarts fresh; stalled frames do not replay past events',()=>{
 const {c,api,ctx,recorded}=harness();api.tick(0);
 const early=recorded.slice();a(early.length>1);
 ctx.currentTime=30;const n=recorded.length;api.tick(30);
 a(recorded.slice(n).every(v=>v.t>=30&&v.t<30.5));a(recorded.length-n<=48);
 api.reset();a.equal(api.snapshot().decks.length,0);a.equal(c.poiAudioNotes.size,0);
 a(early.every(v=>v.n.stopped===30&&v.n.disconnected));
 ctx.currentTime=31;api.tick(31);
 a.equal(api.snapshot().active,'town');a(recorded.at(-1).t>=31);
});
test('real production hooks retain existing effects and volume routing and use orchestral transport lifecycle',()=>{
 a.match(h,/function poiAudioMusicPhrase\(\)[\s\S]{0,700}poiOrchestraTick\(now\)/);
 a.match(h,/function poiAudioStop\(suspend=false\)\{\s*poiCreekAudioStop\(\);[\s\S]{0,70}poiOrchestraReset\(\)/);
 a.match(h,/poiAudioMusic\.gain\.setTargetAtTime\(\.58\*poiAudioLevels\.bgm\/100/);
 a.match(h,/poiAudioEffects\.gain\.setTargetAtTime\(\.90\*poiAudioLevels\.se\/100/);
});
test('named outdoor and existing dungeon/market classifications lead to separate musical arrangements',()=>{
 const {c,api}=harness();
 for(const s of ['outside','market','mine','chapel','otherworld','northFort']){
  c.zone=s;c.indoors=true;a.equal(api.scene(0),s,'dungeon/market/field takes priority over indoor roof test');
 }
 c.facilitySite={id:'guildsaved'};a.equal(api.scene(0),'indoor');
 const tracks=vm.runInNewContext(cut('// BEGIN ORIGINAL ORCHESTRA SCORE','// END ORIGINAL ORCHESTRA SCORE')+';POI_ORCHESTRAL_SCORES');
 a.deepEqual(Array.from(Object.keys(tracks)).sort(),['battle','chapel','indoor','market','mine','northFort','otherworld','outside','town']);
 const signatures=new Set(Object.values(tracks).map(s=>JSON.stringify(s)));
 a.equal(signatures.size,9,'no score aliases');
 for(const [name,s] of Object.entries(tracks)){
  a(s.beats*60/s.bpm>=32&&s.beats*60/s.bpm<=74,name+' complete phrase duration');
  a(Object.keys(s.tracks).length>=3,name+' orchestral arrangement');
 }
});
test('muted BGM and background conditions schedule no new sound, with effects base unchanged',()=>{
 const {c,recorded,api,ctx}=harness();c.poiAudioLevels.bgm=0;api.tick(0);
 a.equal(recorded.length,0);
 c.poiAudioLevels.bgm=70;c.poiAudioAllowed=()=>false;ctx.currentTime=.15;api.tick(.15);
 a.equal(recorded.length,0);
 c.poiAudioAllowed=()=>true;c.poiAudioEnabled=false;ctx.currentTime=.2;api.tick(.2);
 a.equal(recorded.length,0);
 c.poiAudioEnabled=true;ctx.currentTime=1;api.tick(1);a(recorded.length>0);
});

