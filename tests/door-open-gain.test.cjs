const {test}=require('node:test'),a=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function harness(baked){
 const calls=[],c={poiAudioLevels:{master:85,se:90},POI_WEAPON_SE:{},poiWalkActive:true,poiAudioEnabled:true,
  poiAudioAllowed:()=>true,poiAudioStart(){},poiAudioContext:{state:'running',currentTime:3},
  poiTryRecordedFoley(...a){calls.push(['recording',...a]);return baked},
  poiSurfaceFoley:k=>k,poiPlayImpactBuffer:(...a)=>calls.push(['fallback',...a])};
 const i=h.indexOf('function poiSound('),j=h.indexOf('function poiAudioSyncLifecycle(',i);a(i>=0&&j>i);
 vm.runInNewContext(h.slice(i,j),c);
 const play=(...args)=>{calls.length=0;c.poiSound(...args);return calls.slice()};
 return {c,play};
}
test('only door opening is 4.5 dB quieter, including unrecorded surfaces and fallback',()=>{
 const {c,play}=harness(true);
 const open=play('door-open','wood'),close=play('door-close','wood');
 a.deepEqual(open,[['recording','doorOpen',3,.38]]);a.deepEqual(close,[['recording','doorClose',3.024,.68]]);
 a(Math.abs(20*Math.log10(open[0][3]/.64)+4.53)<.02);
 for(const material of ['iron','stone']){
  a.deepEqual(play('door-open',material),[['fallback','door-open-'+material,3,.38]]);
  a.deepEqual(play('door-close',material),[['fallback','door-close-'+material,3.024,.68]]);
 }
 const f=harness(false);
 a.deepEqual(f.play('door-open','wood'),[...open,['fallback','door-open-wood',3,.38]]);
 a.deepEqual(f.play('door-close','wood'),[...close,['fallback','door-close-wood',3.024,.68]]);
 c.poiAudioLevels.se=0;a.deepEqual(play('door-open','wood'),[]);
 a.match(h,/poiAudioMusic\.gain\.setTargetAtTime\(\.58\*poiAudioLevels\.bgm\/100/);
 a.match(h,/poiAudioEffects\.gain\.setTargetAtTime\(\.90\*poiAudioLevels\.se\/100/);
});
