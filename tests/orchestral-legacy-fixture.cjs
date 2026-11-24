const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),a=require('node:assert/strict');
const html=fs.readFileSync(process.env.HTML||path.join(__dirname,'../world-editor.html'),'utf8');
const first=html.indexOf('const PINE_AUDIO_SETTINGS_KEY'),last=html.indexOf('const POI_PLAYER_MAX_HP',first);
a(first>=0&&last>first);
function orchestraFixture(id='base'){
 const voices=[],buses=[],calls=[],nowNode=()=>({to:[],connect(n){this.to.push(n);return n},disconnect(){},gain:makeParam(),Q:makeParam(),frequency:makeParam(),detune:makeParam()});
 function makeParam(){return {value:0,setValueAtTime(v,t){this.value=v;this.when=t},setTargetAtTime(v,t,d){calls.push([this,v,t,d]);this.value=v},linearRampToValueAtTime(v,t){calls.push([this,v,t,"linear"]);this.value=v},exponentialRampToValueAtTime(){},cancelScheduledValues(){}}}
 const ctx={state:'running',currentTime:10,sampleRate:24000,createGain(){const n=nowNode();buses.push(n);return n},
  createBiquadFilter:nowNode,createPeriodicWave:()=>({}),createBuffer:(c,n,r)=>({duration:n/r,getChannelData:()=>new Float32Array(n)}),
  createBufferSource:source,createOscillator:source,suspend(){this.state='suspended';return Promise.resolve()}};
 function source(){const n=nowNode();n.setPeriodicWave=()=>{n.instrument=true};n.start=t=>{voices.push(n);n.at=t};n.stop=t=>{n.until=t};return n}
 const f={ctx,mixer:nowNode(),facilitySite:id?{id,mine:{bounds:{x1:97,x2:125,z1:41,z2:67,y:-1}},
  otherworld:{bounds:{x1:95,x2:108,z1:72,z2:92,y:-1}},chapel:{bounds:{x1:60,x2:79,z1:75,z2:90,y:-1}},northFort:{bounds:{x1:55,x2:73,z1:9,z2:27,y:-1}}}:null,
  poiWalkActive:true,poiWalkX:10,poiWalkZ:0,poiWalkLevel:0,pineAIActive:false,
  window:{addEventListener(){}},document:{hidden:false,addEventListener(){}},
  localStorage:{getItem(){return null}},poiWalkIndoor:()=>false,
  poiRegionAt:(_,x)=>({name:x===67?'野営地':x>=95?'外':'拠点',difficulty:x===67||x>=95?1:0})};
 const c=vm.createContext(f),run=s=>vm.runInContext(s,c);
 run(html.slice(first,last)+';poiAudioMusic=mixer;poiAudioContext=ctx;');
 function tick(t,x=f.poiWalkX,z=f.poiWalkZ,y=f.poiWalkLevel){
  ctx.currentTime=t;Object.assign(f,{poiWalkX:x,poiWalkZ:z,poiWalkLevel:y});
  for(const n of voices)if(n.until<=t&&n.onended){const end=n.onended;n.onended=null;end()}
  return run('poiAudioMusicPhrase();poiOrchestraSnapshot()');
 }
 function deck(name){return run('poiOrchestraDecks.get('+JSON.stringify(name)+')')}
 return {f,run,tick,deck,voices,buses,ctx,calls,mixer:f.mixer};
}
module.exports=orchestraFixture;

