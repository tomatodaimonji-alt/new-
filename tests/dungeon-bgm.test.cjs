const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const a=html.indexOf('const PINE_AUDIO_SETTINGS_KEY'),b=html.indexOf('const POI_PLAYER_MAX_HP',a);
function fixture(){
 const calls=[],notes=[];
 const f={notes,calls,facilitySite:{id:'base',mine:{bounds:{x1:97,x2:125,z1:41,z2:67,y:-1}},otherworld:{bounds:{x1:95,x2:108,z1:72,z2:92,y:-1}}},
  poiWalkActive:true,poiWalkX:118,poiWalkZ:88,poiWalkLevel:0,
  window:{addEventListener(){}},document:{hidden:false,addEventListener(){}},localStorage:{getItem(){return null}},
  poiRegionAt:(_site,x)=>({name:x>=95?'外':'拠点'})};
 const c=vm.createContext(f),r=s=>vm.runInContext(s,c);
 r(html.slice(a,b)+`;poiAudioMusic={name:'mixer',gain:{setTargetAtTime(){}}};poiAudioContext={currentTime:10,i:0,createGain(){
  const id=++this.i;return{id,gain:{value:null,setTargetAtTime(v,t,d){calls.push([id,v,t,d])}},connect(dest){this.dest=dest}};
 },suspend(){return Promise.resolve()}};
 poiPianoKey=(pitch,at,velocity,dest,plucked)=>notes.push({pitch,at,velocity,bus:dest?.id,plucked});
 poiAudioTone=(pitch,at,duration,velocity,_type,dest)=>notes.push({pitch,at,velocity,bus:dest?.id,drone:true});`);
 return {calls,notes,r,sample(t,x,z,y){Object.assign(f,{poiWalkX:x,poiWalkZ:z,poiWalkLevel:y});return r(`poiAudioContext.currentTime=${t};poiAudioMusicPhrase();poiTownMusicZone`);}};
}
test('real underground regions have distinct motifs, fade naturally and retain old surface cues',()=>{
 const {sample,notes,calls,r}=fixture();
 assert.equal(sample(10,118,88,0),'outside');
 assert.equal(sample(10.2,100,90,-1),'otherworld');
 const star=r('poiTownMusicDeck.otherworld.id');
 assert(notes.some(n=>n.bus===star&&n.velocity>0));
 assert(calls.some(([id,v,t,d])=>id===star&&v===1&&t===10.2&&d>0));
 assert(calls.some(([id,v,t,d])=>id===2&&v===0&&t===10.2&&d>0));
 assert.equal(sample(10.3,118,88,0),'outside');
 assert.equal(sample(10.5,116,62,-1),'mine');
 const mine=r('poiTownMusicDeck.mine.id'),minePitch=notes.find(n=>n.bus===mine)?.pitch;
 assert(minePitch>0);assert.notEqual(minePitch,notes.find(n=>n.bus===star).pitch);
 assert.equal(sample(10.8,116,62,0),'outside');
 assert.equal(sample(11,27,32,-1),'town','a town kitchen basement is not a dungeon');
 assert.equal(r('poiAudioContext.i'),4,'lazy child buses, only one per played region');
});
test('inaudible dungeon deck emits no notes, and lifecycle stop cannot restart a hidden track',()=>{
 const {sample,notes,r}=fixture();
 assert.equal(sample(10,116,62,-1),'mine');
 const mine=r('poiTownMusicDeck.mine.id');
 assert.equal(sample(11,116,62,0),'outside');
 for(let t=11.2;t<13;t+=.2)sample(t,116,62,0);
 const n=notes.filter(row=>row.bus===mine).length;
 for(let t=13;t<24;t+=.2)sample(t,116,62,0);
 assert.equal(notes.filter(row=>row.bus===mine).length,n);
 r('poiAudioStop(true);document.hidden=true');
 assert.equal(sample(25,100,90,-1),null);
 r('document.hidden=false');
 assert.equal(sample(26,100,90,-1),'otherworld');
 assert.equal(r('poiTownMusicDeck.otherworld.gain.value'),1);
});
