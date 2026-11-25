const {readFileSync}=require('node:fs'),vm=require('node:vm'),a=require('node:assert/strict'),{test}=require('node:test');
const h=readFileSync(process.argv[2]||'region-transport.js','utf8');
const flag=h.indexOf('// BEGIN RECORDED ZONE TRANSPORT');
const code=flag>=0?h.slice(flag,h.indexOf('// END RECORDED ZONE TRANSPORT',flag)):(h.startsWith('<!doctype')?'':h);
function setup(){
 const q={decodes:[],sources:[],nodes:[],levels:{master:85,bgm:68}};
 const ctx={decodeAudioData:(bytes,ok,no)=>q.decodes.push({bytes,ok,no}),
  createBufferSource:()=>{const s={connect:g=>({connect:b=>{s.bus=b;}}),disconnect:()=>{}};q.nodes.push(s);return s},
  createGain:()=>({gain:{value:0,setTargetAtTime:(...v)=>q.fade=v},disconnect:()=>{}})};
 const c=vm.createContext({atob,Number,Map,WeakMap,Uint8Array,POI_ZONE_RECORDINGS:{indoor:'T2dnUw==',town:'T2dnUw==',mine:'T2dnUw==',battle:'T2dnUw=='},
  POI_ZONE_ENDS:{indoor:41.999,town:52,mine:40,battle:40},poiAudioLevels:q.levels,poiAudioContext:ctx,poiOrchestraSource:(deck,s,n,when)=>{q.sources.push({deck,s,when});return {source:s}},POI_ORCHESTRA_BOOT_DECAY:.3});
 vm.runInContext(code,c);
 const tick=(zone,deck={},now=2)=>c.poiRecordedZoneTry(zone,deck,now);
 return {q,ctx,tick,c};
}
test('protected/missing keys never decode; pending actual zone cannot start a stale or synthetic loop',()=>{
 const {tick,q}=setup();
 for(const zone of ['outside','snow','davidStill','davidAwake','market'])a.equal(tick(zone),false);
 a.equal(q.decodes.length,0);
 a.equal(tick('town'),true);a.equal(tick('town'),true);
 a.equal(q.decodes.length,1);a.equal(q.sources.length,0);
 q.decodes[0].ok({length:10,duration:52});
 a.equal(q.sources.length,0);
});
test('matching live deck starts a single actual loop, town music mute controls and indoor/conjoined asset reuse',()=>{
 const {tick,q}=setup();const deck={bus:{},entryAt:1,entryDecay:.3};
 q.levels.bgm=0;a.equal(tick('southSettlement',deck),true);a.equal(q.decodes.length,0);
 q.levels.bgm=68;a.equal(tick('southSettlement',deck),true);q.decodes[0].ok({length:10,duration:42});
 a.equal(tick('southSettlement',deck),true);a.equal(tick('southSettlement',deck),true);
 a.equal(q.sources.length,1);a.equal(q.sources[0].s.loop,true);a.equal(q.sources[0].s.loopEnd,41.999);
 a.equal(q.sources[0].s.bus,deck.bus);a.equal(q.fade[2],.3);
 a.equal(tick('indoor',{bus:{}}),true);a.equal(q.decodes.length,1);a.equal(q.sources.length,2);
});
test('exactly one regular clip retained: invalid/failed clip permits fallback, other keys evict without affecting settled audio',()=>{
 const {tick,q}=setup();
 a.equal(tick('town'),true);q.decodes[0].no();a.equal(tick('town'),false);a.equal(q.decodes.length,1);
 tick('mine');a.equal(q.decodes.length,2);
 tick('town');a.equal(q.decodes.length,3);q.decodes[2].ok({length:4,duration:.1});a.equal(tick('town'),false);
});
