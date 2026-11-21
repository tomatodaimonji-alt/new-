const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const block=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i+1);assert(i>=0&&j>i,'missing '+a);return html.slice(i,j)};
const pt=(x,z,type,rot=0,y=0)=>({x,z,y,type,rot});
const site={id:'base',creek:{deep:[{x:2,z:2},{x:3,z:2},{x:2,z:3}],crossings:[pt(2,2,'bridgeStoneEnd',1),pt(3,2,'bridgeStoneEnd',3)],shallows:[pt(1,3,'streamShallow')],terrace:[{x:1,z:4}],sound:{x:2,z:2}}};
const creek=[pt(2,2,'river'),pt(3,2,'river'),pt(2,3,'river'),...site.creek.crossings,pt(1,3,'streamShallow')];
test('deep water and bridge-axis movement are scoped to the authored base, including live edits',()=>{
 const x={Map,Set,world:creek,facilitySite:site,poiWalkLevel:0,poiWalkActive:false,
  validPos:(x,z)=>x>=0&&z>=0&&x<12&&z<12,pineSuperVehicleType:()=>false,poiIsMonster:()=>false,
  poiMonsterAt:()=>false,poiWalkPassableDoor:()=>false,isFloor:t=>t==='river'||t==='grass',isWallId:()=>false,terrainY:()=>0,
  bridgeSpanElevation:()=>0,facilityValidLanding:()=>true,
  terrainPassable:(a,b,c,d)=>{
   if(![[a,b],[c,d]].some(([x,z])=>x===1&&z===4))return true;
   return [[a,b],[c,d]].some(([x,z])=>x===1&&z===3);
  }};
 vm.createContext(x);
 vm.runInContext(block('let facilityCreekIndex=','function poiWalkCanStep(')+block('function poiWalkCanStep(','function poiWalkCamera('),x);
 const go=(a,b,c,d)=>x.poiWalkCanStep(c,d,a,b);
 const change=(world,facilitySite=site)=>{Object.assign(x,{world,facilitySite});x.facilityRefreshCreek()};
 change(creek);
 for(const p of [[1,2,2,2],[2,2,3,2],[3,2,4,2],[4,2,3,2],[3,2,2,2],[2,2,1,2],[1,2,1,3]]) assert(go(...p),p);
 assert(go(1,3,1,4)&&go(1,4,1,3),'terrace stair works both ways');
 assert(!go(0,4,1,4)&&!go(1,4,1,5),'only the stair gives access to the raised terrace');
 for(const p of [[2,1,2,2],[2,2,2,1],[3,3,3,2],[1,3,2,3]]) assert(!go(...p),p);
 change(creek.filter(o=>!(o.x===3&&o.type.startsWith('bridge'))));assert(!go(1,2,2,2));
 change(creek.map(o=>o.x===3&&o.type.startsWith('bridge')?{...o,rot:0}:o));assert(!go(1,2,2,2));
 change(creek.map(o=>o.x===3&&o.type==='river'?{...o,type:'lake'}:o));assert(!go(1,2,2,2));
 change([...creek,pt(2,2,'crate')]);assert(!go(1,2,2,2));
 change(creek.filter(o=>o.x!==2||o.z!==3));assert(go(1,3,2,3));
 change(creek,{id:'kitchen',creek:site.creek});assert(go(1,3,2,3));assert(!go(1,2,2,2));
 change(creek,null);assert(go(1,3,2,3));
});
test('quiet water source fades with proximity and goes away when hidden, above grade, or out of play',()=>{
 const mk=()=>({connect(n){return n},disconnect(){},start(){this.started=true},stop(){this.stopped=true},
  gain:{value:0,setTargetAtTime(a){this.goal=a}},frequency:{value:0},Q:{value:0},playbackRate:{value:0}});
 let allowed=true,serial=0;
 const timers=new Map(),flush=()=>{for(const [id,fn] of timers){timers.delete(id);fn()}};
 const x={setTimeout:(fn,ms)=>{assert(ms>=700&&ms<=1000);timers.set(++serial,fn);return serial},
  clearTimeout:(id)=>timers.delete(id),facilitySite:site,facilityCreekIndex:{hasWater:true},poiWalkX:12,poiWalkZ:2,poiWalkLevel:0,
  poiWalkActive:true,poiAudioEnabled:true,poiAudioAllowed:()=>allowed,poiAudioNoiseBuffer:()=>null,
  poiAudioContext:{createGain:mk,createBiquadFilter:mk,createBufferSource:mk,currentTime:1},
  poiAudioAmbience:mk()};
 vm.createContext(x);
 vm.runInContext(block('let poiCreekAudio=','function poiAudioStart('),x);
 const read=()=>vm.runInContext('({source:poiCreekAudio?.source,level:poiCreekAudio?.level||0})',x);
 x.poiCreekAudioSync();assert.equal(read().source,undefined);
 x.poiWalkX=4;x.poiCreekAudioSync();const near=read();assert(near.source.started&&near.level>0&&near.level<=.2);
 x.poiWalkX=8;x.poiCreekAudioSync();assert(read().level<near.level);
 x.poiWalkX=12;x.poiCreekAudioSync();x.poiCreekAudioSync();assert.equal(read().level,0);
 assert.equal(read().source,near.source);assert.equal(timers.size,1);
 x.poiWalkX=4;x.poiCreekAudioSync();assert.equal(timers.size,0);flush();assert.equal(read().source,near.source);
 x.poiWalkX=12;x.poiCreekAudioSync();flush();assert.equal(read().source,undefined);assert(near.source.stopped);
 x.poiWalkX=4;x.poiCreekAudioSync();const resumed=read();
 x.poiWalkX=12;x.poiCreekAudioSync();allowed=false;x.poiCreekAudioSync();
 assert.equal(timers.size,0);assert.equal(read().source,undefined);assert(resumed.source.stopped);
 x.poiWalkX=2;x.poiCreekAudioSync();assert.equal(read().source,undefined);
 allowed=true;x.poiCreekAudioSync();assert(read().source.started);
 x.poiWalkLevel=1;x.poiCreekAudioSync();assert.equal(read().source,undefined);
 x.poiWalkLevel=0;x.poiWalkActive=false;x.poiCreekAudioSync();assert.equal(read().source,undefined);
 x.poiWalkActive=true;x.facilitySite=null;x.poiCreekAudioSync();assert.equal(read().source,undefined);
});
