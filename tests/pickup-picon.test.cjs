const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),test=require('node:test');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function asset(name){
 const m=h.match(new RegExp('\\n '+name+':\\s*((?:\'[A-Za-z0-9+/=]+\'\\s*(?:\\+\\s*)?)+)'));assert(m,name);
 return Buffer.from([...m[1].matchAll(/'([^']+)'/g)].map(x=>x[1]).join(''),'base64');
}
test('pickup is a soft crisp ascending two-note one-shot, not coin pitches or rustle',()=>{
 const pcm=asset('itemPickup');assert.equal(pcm.length,7440);
 const x=Array.from({length:3720},(_,i)=>pcm.readInt16LE(i*2)/32768);
 assert.equal(x[0],0);assert.equal(x.at(-1),0);assert(Math.max(...x.map(Math.abs))<=.48);
 const freq=(from,to,f)=>{
  let a=0,b=0;for(let i=from;i<to;i++){a+=x[i]*Math.sin(i*f*Math.PI/12000);b+=x[i]*Math.cos(i*f*Math.PI/12000)}
  return Math.hypot(a,b);
 };
 assert(freq(160,970,587.33)>7*freq(160,970,783.99));
 assert(freq(1520,2470,783.99)>7*freq(1520,2470,587.33));
 continuity: for(const sample of x.slice(-96))assert(Math.abs(sample)<.001);
});
test('item, chest and soul share one voiced sample; coin and mute keep original routing',()=>{
 const calls=[],c={poiAudioLevels:{master:85,se:85},poiAudioNoiseBurst:(...p)=>calls.push(['air',...p]),
  poiAudioTone:(...p)=>calls.push(['tone',...p]),poiAudioEffects:{},
  poiTryRecordedFoley:(...p)=>(calls.push(['asset',...p]),true)};
 const a=h.indexOf('function poiItemSound('),b=h.indexOf('// END ITEM FOLEY',a);
 vm.createContext(c);vm.runInContext(h.slice(a,b),c);
 const cue=(k,t)=>{calls.length=0;c.poiItemSound(k,t,2);return calls.slice();};
 for(const id of ['healingHerb','equipOrvasGreatsword','orvasSoul','slimeSoul'])assert.deepEqual(cue('item-pickup',id),[['asset','itemPickup',2.068,.60]]);
 assert.deepEqual(cue('chest-pickup','healingHerb'),[['asset','itemPickup',2,.60]]);
 assert.deepEqual(cue('item-pickup','coin').filter(x=>x[0]==='tone').map(x=>x[1]),[1480,1976]);
 c.poiAudioLevels.se=0;assert.deepEqual(cue('item-pickup','orvasSoul'),[]);
});
