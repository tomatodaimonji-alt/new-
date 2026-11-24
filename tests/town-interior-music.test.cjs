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
test('street, lodging, guild, shop and ordinary home keep the same actual town clock and mixer deck',()=>{
 const r=runtime(),steps=[[41,34,false],[41,33,true],[41,32,true],[41,30,true],[41,34,false],
  [56,30,true],[69,33,true],[70,48,true],[45,41,false]];
 let bus,clock,deck;
 for(const [x,z,inside] of steps){
  r.c.poiWalkIndoor=()=>inside;
  a.equal(r.tick(x,z).active,'town',x+','+z);
  const current=r.run('poiOrchestraDecks.get("town")');
  if(!deck){deck=current;bus=current.bus;clock=current.start;}
  a.equal(current,deck);a.equal(current.bus,bus);a.equal(current.start,clock);
 }
 a.equal(r.params.filter(([gain,t,decay])=>gain===1&&(decay===.30||decay===.38)).length,1);
 a(r.starts.length>0);
});
test('cold start in a real town building picks the same town cue; the southern settlement is unchanged',()=>{
 const r=runtime();r.c.poiWalkIndoor=()=>true;
 a.equal(r.tick(41,30).active,'town');
 const room=r.run('poiOrchestraDecks.get("town")');
 a.equal(room.entryDecay,.30);
 r.c.poiWalkIndoor=()=>false;a.equal(r.tick(105,111).active,'southSettlement');
 const s=r.run('poiOrchestraDecks.get("southSettlement")');
 r.c.poiWalkIndoor=()=>true;
 a.equal(r.tick(101,112).active,'southSettlement');
 a.equal(r.tick(109,116).active,'southSettlement');
 a.equal(r.run('poiOrchestraDecks.get("southSettlement")'),s);
});
test('real detached fields, standalone facilities, and mapped mine below town follow original music priorities',()=>{
 const r=runtime();
 r.c.poiWalkIndoor=()=>true;
 a.equal(r.tick(83,108).active,'outside');
 a.equal(r.tick(118,60,-1).active,'mine');
 r.c.facilitySite={...r.c.facilitySite,id:'lodging'};
 a.equal(r.tick(41,30).active,'indoor');
 r.c.facilitySite={id:'snowpass'};
 a.equal(r.tick(41,30).active,'snow');
});
