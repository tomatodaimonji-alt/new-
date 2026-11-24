const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(x,y)=>{const i=h.indexOf(x),j=h.indexOf(y,i+x.length);a(i>=0&&j>i,x);return h.slice(i,j)};
test('one phase-continuous sound per eye cast, not per impact/growth/fan/followup; early end and global stop are bounded',()=>{
 const starts=[],stops=[],gains=[],sounds=[],transient=new Set();
 const p={x:2,z:0,y:0},b={y:0},q={kind:'beam',sx:0,sz:0};let ctx;
 ctx={state:'running',currentTime:3,createBuffer:(channels,n,rate)=>{
  const data=new Float32Array(n);return {duration:n/rate,data,getChannelData:()=>data};
 },createBufferSource:()=>({
  context:ctx,connect:n=>n,disconnect(){},start(when){starts.push([this,when]);},
  stop(when){stops.push([this,when]);},addEventListener(){},
 }),createGain:()=>({
  connect(){},disconnect(){},gain:{value:0,linearRampToValueAtTime:(...r)=>gains.push(r),
  setValueAtTime(){},cancelScheduledValues(){},setTargetAtTime:(...r)=>gains.push(r)},
 })};
 const c={poiWalkActive:true,poiAudioEnabled:true,poiAudioAllowed:()=>true,poiAudioLevels:{master:1,se:1},
  poiDavidIn:()=>true,poiDavidLine:()=>true,poiAudioStart(){},poiAudioContext:ctx,poiAudioEffects:{},poiAudioTransient:transient,
  poiTryRecordedFoley:(name,when,gain)=>sounds.push([name,when,gain])};
 const f=vm.runInNewContext(cut('function poiPlayImpactBuffer(','// CC0 recorded Foley')+cut('// BEGIN DAVID ATTACK AUDIO','// END DAVID ATTACK AUDIO')+
 ';({play:poiDavidAttackFoley,finish:typeof poiDavidFinishBeamFoley==="function"?poiDavidFinishBeamFoley:null,stop:poiDavidStopAttackFoley})',c);
 f.play(q,p,b,0,'beamOnset');f.play(q,p,b,0,'impact');f.play(q,p,b,0,'extend');
 a.equal(starts.length,1);a.equal(sounds.length,0);a.equal(starts[0][1],3);
 const source=starts[0][0];a.equal(source.loop,true);a.equal(stops[0][1],7);
 const period=source.buffer.data;
 a.equal(period.length,19200);a(Math.abs(period[0]-period.at(-1))<.16,'seam at periodic boundary');
 a(gains[0][0]>.4&&gains[0][0]<.6,'same effects mix');
 ctx.currentTime=4.4;f.finish(q);f.finish(q);f.play(q,p,b,0,'impact');
 a.equal(starts.length,1);a.equal(stops.length,2);a(stops[1][1]>4.4&&stops[1][1]<4.5);
 c.poiAudioLevels.se=0;f.play({...q},p,b,0,'beamOnset');a.equal(starts.length,1);
 c.poiAudioLevels.se=1;f.play({...q},p,b,0,'beamOnset');a.equal(starts.length,2);a.equal(starts[1][0].buffer,source.buffer);
 f.stop();a(stops.at(-1)[1]<4.5);
 f.play({...q,kind:'sweep'},p,b,0,'impact');a.deepEqual(sounds,[['davidBladeSweep',4.4,.60]]);
});
test('heavy metallic sweep is the verified CC0 edit and the Fire Wand master is untouched',()=>{
 const f=vm.runInNewContext(cut('const POI_RECORDED_FOLEY={','const poiRecordedFoleyCache')+';POI_RECORDED_FOLEY');
 const digest=k=>crypto.createHash('sha256').update(Buffer.from(f[k],'base64')).digest('hex');
 a.equal(digest('davidBladeSweep'),'d2460f6fe00ae14e4f6fb7ce908f45cfcb12f47739a07bdd9da21d6ced7dc59a');
 a.equal(digest('wandFlameLaunch'),'104bb2d01a7d706c7ad91377ad3e7f9996950c36596cde1c6ad728d519aa1c14');
 a(!f.davidEyeFire&&!f.davidEyeExtend,'David no longer uses flame recordings');
});
