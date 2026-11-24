const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(x,y)=>{const i=src.indexOf(x),j=src.indexOf(y,i+1);a(i>=0&&j>i,x);return src.slice(i,j)};
function runtime(){
 const music={},params=[],starts=[],param=()=>({value:0,setTargetAtTime(...args){params.push(args)},setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){}});
 const node=()=>({gain:param(),frequency:param(),Q:param(),delayTime:param(),detune:param(),connect(v){this.to=v;return v},disconnect(){},start(){starts.push(this)},stop(){},setPeriodicWave(){}});
 const ctx={state:'running',currentTime:20,createGain:node,createBufferSource:node,createOscillator:node,createBiquadFilter:node,createDelay:node,
  createBuffer:(c,n,r)=>({duration:n/r,getChannelData:()=>new Float32Array(n)}),createPeriodicWave:()=>({})};
 const c=vm.createContext({ctx,music,localStorage:{getItem(){return null}},window:{addEventListener(){}},document:{hidden:false,addEventListener(){}},
  poiEnemyPending:new Set(),poiWalkActive:true,poiWalkLevel:0,poiWalkX:105,poiWalkZ:111,poiWalkIndoor:()=>false});
 const run=s=>vm.runInContext(s,c);
 const geo=cut('const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+
  cut('const POI_SAFE_TOWN=Object.freeze(','// BEGIN LOCATION PANEL MOTION')+
  cut('function poiSouthPortContains(','function poiSouthPortNear(')+cut('function poiSouthTownContains(','function poiSouthMarketRole(')+
  cut('function poiSouthForestContains(','function poiSouthForestMember(')+cut('function poiNorthTrailRegion(','function poiNorthTrailSupply(')+
  'function poiDungeonPointIn(b,x,z,y){return b?.y===y&&x>=b.x1&&x<=b.x2&&z>=b.z1&&z<=b.z2}';
 run(geo+cut('const PINE_AUDIO_SETTINGS_KEY','const POI_PLAYER_MAX_HP')+';this.facilitySite={...buildFacilitySite("base"),id:"base"};poiAudioMusic=music;poiAudioContext=ctx;');
 function set(x,z,y=0){Object.assign(c,{poiWalkX:x,poiWalkZ:z,poiWalkLevel:y})}
 const tick=(x,z,y=0)=>{set(x,z,y);ctx.currentTime+=.19;return run('poiAudioMusicPhrase();poiOrchestraSnapshot()')};
 return {run,c,tick,params,starts};
}
test('real town, screenshot seam, fishing port, and southern road use the same uninterrupted calm deck',()=>{
 const r=runtime();
 const path=[[105,111],[94,109],[93,108],[92,108],[92,109],[84,116],[93,110],[94,109],[105,120],[105,123],
  [104,123],[99,123],[93,123],[92,123],[91,123],[94,122],[93,109],[94,108],[93,108]];
 const decks=[];
 for(const [x,z] of path){
  a.equal(r.tick(x,z).active,'southSettlement',x+','+z);
  decks.push(r.run('poiOrchestraDecks.get("southSettlement")'));
 }
 a(decks.every(d=>d===decks[0]),'one actual native music bus/arrangement clock despite backtracking');
 a.equal(r.run('poiOrchestraScore("southSettlement").duration'),64*60/72);
 a(r.starts.length>0);
 a.equal(r.params.filter(([gain,t,decay])=>gain===1&&decay===.30).length,1);
});
test('seam audio does not alter geographic/danger metadata or consume forest, field, northern town or dungeons',()=>{
 const r=runtime();
 a.equal(r.tick(93,108).active,'southSettlement');
 a.equal(r.run('poiRegionAt(facilitySite,93,108,false,0).name'),'外');
 a.equal(r.run('poiRegionAt(facilitySite,93,108,false,0).difficulty'),1);
 for(const [x,z] of [[83,108],[87,2],[93,103],[104,126],[105,125],[96,104]])
  a.equal(r.tick(x,z).active,'outside',x+','+z);
 a.equal(r.tick(45,41).active,'town');
 a.equal(r.tick(118,60,-1).active,'mine');
});
test('a seam or market fight does not replace the calm deck or spill its cue into the next area',()=>{
 const r=runtime();r.tick(93,110);
 const pending={playerAttack:{pending:true,sx:93,sz:110,y:0}};
 r.c.poiEnemyPending.add(pending);r.run('poiOrchestraCombat()');
 a.equal(r.tick(93,110).active,'southSettlement');
 r.c.poiEnemyPending.clear();r.run('poiOrchestraCombat()');
 a.equal(r.tick(118,60,-1).active,'mine');
 pending.playerAttack={pending:true,sx:118,sz:60,y:-1};r.c.poiEnemyPending.add(pending);
 a.equal(r.tick(118,60,-1).active,'battle');
});
