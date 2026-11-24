const {test}=require('node:test'),a=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const h=fs.readFileSync(process.env.PRODUCT||'world-editor.html','utf8');
test('only the player beam duration and decay extend and cleanup owns only its very same source',()=>{
 const i=h.indexOf('let poiOrvasPlayerBeam='),j=h.indexOf('function poiOrvasHeadPose(',i);
 const events=[],v={gl:{deleteBuffer:()=>events.push('delete')},ctx:{currentTime:3},source:{stop:t=>events.push(['stop',t])},gain:{gain:{
   value:.24,cancelAndHoldAtTime:t=>events.push(['hold',t]),linearRampToValueAtTime:(g,t)=>events.push(['ramp',g,t])}},buf:{}};
 const s=vm.runInNewContext(h.slice(i,j)+';({ms:POI_ORVAS_BEAM_MS,opacity:poiOrvasBeamAlpha,beam:()=>poiOrvasPlayerBeam,clear:poiOrvasPlayerBeamClear,install:()=>{poiOrvasPlayerBeam={source,gain,ctx};poiOrvasBeamGpu={buf}}})',v);
 a.equal(s.ms,510);a.equal(s.opacity(110),1);a(s.opacity(300)>s.opacity(440)&&s.opacity(440)>.015);a.equal(s.opacity(510),0);
 s.install();s.clear();s.clear();a.equal(s.beam(),null);
 a.deepEqual(events,['delete',['hold',3],['ramp',0,3.032],['stop',3.035]]);
});
