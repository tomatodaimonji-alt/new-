const fs=require('node:fs'),vm=require('node:vm'),a=require('node:assert/strict'),{test}=require('node:test');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(x,y)=>{const i=h.indexOf(x),j=h.indexOf(y,i+1);if(i<0||j<0)throw Error('missing '+x);return h.slice(i,j)};
test('only active surface snow gets its score and wind, with independent volume, lazy decode and no duplicates',()=>{
 const notes=[],decode=[];
 const out={},music={};
 const ctx=vm.createContext({facilitySite:{id:'snowpass'},poiWalkActive:true,poiWalkLevel:0,poiWalkX:0,poiWalkZ:0,
  poiAudioLevels:{master:85,bgm:68,se:90},poiAudioEffects:out,poiAudioMusic:music,POI_ORCHESTRA_BOOT_DECAY:.30,
  poiAudioMusicZone:()=> 'outside',atob,Uint8Array,WeakMap,poiOrchestraBattleUntil:-Infinity,
  poiAudioContext:{decodeAudioData(bytes,ready){a.equal(Buffer.from(bytes).subarray(0,4).toString(),'OggS');decode.push(ready)},
   createBufferSource(){return {playbackRate:{value:1},connect(g){return g},stop(t){this.stopped=t}}},
   createGain(){return {gain:{value:0,setTargetAtTime(...v){this.target=v}},connect(to){this.to=to;return to}}}},
  poiOrchestraSource(deck,source,nodes,when,end){const event={source,nodes,when,end};notes.push(event);deck.sources.add(event);return event}});
 const settlement=h.includes('function poiSouthSettlementContains(')?cut('function poiSouthSettlementContains(','function poiOrchestraCombat('):'';
 vm.runInContext(settlement+cut('// BEGIN SNOW AUDIO','// END SNOW AUDIO')+cut('function poiOrchestraScene(now){','function poiOrchestraScore(scene){'),ctx);
 const deck={bus:music,sources:new Set(),entryDecay:.30,entryAt:0};
 a.equal(ctx.poiOrchestraScene(0),'snow');
 ctx.poiSnowAudioTick(deck,0);a.equal(decode.length,2);a.equal(notes.length,0);
 decode[0]({duration:48,length:1000});decode[1]({duration:4.4,length:500});
 ctx.poiSnowAudioTick(deck,.5);ctx.poiSnowAudioTick(deck,1);a.equal(notes.length,1);a.equal(notes[0].source.loop,true);a.equal(notes[0].nodes[0].to,music);
 ctx.poiAudioLevels.bgm=0;ctx.poiSnowAudioTick(deck,30);
 a.equal(notes.length,2);a(!notes[1].source.loop);a.equal(notes[1].nodes[0].to,out);
 ctx.poiSnowAudioTick(deck,31);a.equal(notes.length,2);
 ctx.poiSnowAudioLeave(deck,31);a(notes[1].source.stopped>31);
 ctx.facilitySite={id:'base'};a.equal(ctx.poiOrchestraScene(40),'outside');ctx.facilitySite={id:'snowpass'};
 ctx.poiWalkActive=false;a.notEqual(ctx.poiOrchestraScene(40),'snow');ctx.poiWalkActive=true;ctx.poiWalkLevel=-1;a.notEqual(ctx.poiOrchestraScene(40),'snow');
});
