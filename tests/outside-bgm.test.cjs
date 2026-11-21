const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const a=html.indexOf('const PINE_AUDIO_SETTINGS_KEY'),b=html.indexOf('const POI_PLAYER_MAX_HP',a);
function fixture(id='base'){
 const calls=[],notes=[];
 const f={notes,facilitySite:{id},poiWalkActive:true,poiWalkX:1,poiWalkZ:0,
  window:{addEventListener(){}},document:{hidden:false,addEventListener(){}},localStorage:{getItem(){return null}},
  poiRegionAt:(_site,x)=>({name:x>1?'外':'拠点'}),calls};
 const c=vm.createContext(f);
 const r=s=>vm.runInContext(s,c);
 r(html.slice(a,b)+`;poiAudioMusic={name:'mixer',gain:{setTargetAtTime(){}}};
  poiAudioContext={currentTime:10,i:0,createGain(){
   const id=++this.i;
   return {id,gain:{value:null,setTargetAtTime(v,t,c){calls.push([id,v,t,c])}},connect(to){this.to=to},disconnect(){}};
  },suspend(){return Promise.resolve()}};
  poiPianoKey=(pitch,at,touch,dest,pluck)=>notes.push({pitch,at,touch,bus:dest?.id,pluck});`);
 return {r,f,calls,notes,sample:(t,x)=>{f.poiWalkX=x;r('poiAudioContext.currentTime='+t+';poiAudioMusicPhrase()')}};
}
test('town stays on the original title score; outside enters a quiet distinct melody at the existing HUD edge',()=>{
 const {sample,notes,calls,r}=fixture();
 sample(10,1);assert.equal(notes[0].bus,1);assert(Math.abs(notes[0].pitch-130.8128)<.001);
 sample(10.2,2);
 const outdoor=notes.find(n=>n.bus===2);
 assert(outdoor?.pluck);assert(Math.abs(outdoor.pitch-146.8324)<.001);
 assert.deepEqual(calls.map(x=>Array.from(x)),[[1,0,10.2,.46],[2,1,10.2,.46]]);
 assert.equal(r('poiTownMusicDeck.outside.to.name'),'mixer');
});
test('quick reversals retarget shared child gains without resetting either score; suspend clears scheduling',()=>{
 const {sample,notes,calls,r,f}=fixture();
 sample(10,1);sample(10.3,2);
 const before=[r("poiBaseMusicStart"),r("poiOutsideMusicStart")];
 sample(10.4,1);sample(10.5,2);
 assert.deepEqual([r("poiBaseMusicStart"),r("poiOutsideMusicStart")],before);
 assert.equal(notes.filter(n=>n.bus===2&&Math.abs(n.pitch-146.8324)<.001).length,1);
 assert.deepEqual(calls.slice(-4).map(x=>Array.from(x)),[[1,1,10.4,.46],[2,0,10.4,.46],[1,0,10.5,.46],[2,1,10.5,.46]]);
 assert.equal(r('poiAudioContext.i'),2);
 r('poiAudioStop(true)');f.document.hidden=true;
 const count=notes.length;sample(20,2);assert.equal(notes.length,count);
 f.document.hidden=false;sample(21,2);
 assert.equal(notes[count].bus,2);assert.equal(r('poiTownMusicDeck.outside.gain.value'),1);assert.equal(r('poiAudioContext.i'),2);
});
test('facility previews retain legacy music without new regional gains',()=>{
 const {sample,notes,r}=fixture('lodging');sample(10,2);
 assert.deepEqual(notes.map(n=>n.pitch),[73.415,220,174.61,293.66]);
 assert.equal(r('poiAudioContext.i'),0);
});
