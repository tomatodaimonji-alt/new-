const assert=require('node:assert/strict'),test=require('node:test'),vm=require('node:vm'),fs=require('node:fs');
const html=fs.readFileSync(process.env.WORKSHOP_HTML||process.argv[2]||'world-editor.html','utf8');
test('David non-beam impacts schedule one real mix path each with separate recorded PCM',()=>{
 const start=html.indexOf('// BEGIN DAVID ATTACK AUDIO'),end=html.indexOf('// END DAVID ATTACK AUDIO');
 assert(start>0&&end>start,'missing David sound runtime');
 const events=[],stops=[],tails=[],guard={allowed:true,walk:true,enabled:true,master:1,se:1,clear:true};
 const ctx={state:'running',currentTime:7};
 const audio=vm.runInNewContext(html.slice(start,end)+';({play:poiDavidAttackFoley,stop:poiDavidStopAttackFoley})',{
  get poiWalkActive(){return guard.walk},get poiAudioEnabled(){return guard.enabled},
  get poiAudioLevels(){return guard},poiAudioAllowed:()=>guard.allowed,
  poiDavidIn:(b,p)=>p.y===b.y&&p.x>=0&&p.x<=15,
  poiDavidLine:()=>guard.clear,poiAudioStart:()=>{},get poiAudioContext(){return ctx},
  poiTryRecordedFoley:(name,when,gain,onSource)=>{
   events.push({name,when,gain});
   onSource({context:ctx,addEventListener(){},stop:when=>stops.push([name,when])},{gain:{setTargetAtTime:(to,when,time)=>tails.push([name,to,when,time])}});
  }
 });
 const b={y:0},p={x:2,z:0,y:0},q={kind:'sweep',sx:0,sz:0};
 const run=(kind,i=0,phase='impact',player=p)=>audio.play({...q,kind},player,b,i,phase);
 run('sweep');run('double');run('double',1);run('stomp');
 audio.play({...q,kind:'stomp',davidLeapImpact:true},p,b,0,'impact');
 assert.equal(events.length,5);
 assert.equal(new Set(events.map(e=>e.name)).size,5);
 assert(events.every(e=>e.when===7&&e.gain>0&&e.gain<=.75));
 for(const [k,v] of [['allowed',false],['master',0],['se',0],['walk',false],['enabled',false]]){
   const old=guard[k];guard[k]=v;run('sweep');guard[k]=old;
 }
 run('sweep',0,'impact',{...p,y:1});run('sweep',0,'impact',{...p,x:20});
 assert.equal(events.length,5);
 run('sweep',0,'impact',{...p,x:6});guard.clear=false;run('sweep');
 assert(events[5].gain<events[0].gain&&events[6].gain<events[0].gain/2);
 audio.stop();audio.stop();assert.equal(stops.length,7);assert(stops.every(s=>s[1]===7.05));
 assert.equal(tails.length,7);assert(tails.every(s=>s[1]===0&&s[3]===.012));
 const table=html.slice(html.indexOf('const POI_RECORDED_FOLEY={'),html.indexOf('const poiRecordedFoleyCache'));
 const pcm=vm.runInNewContext(table+';POI_RECORDED_FOLEY');
 for(const {name} of events.slice(0,5)){
   const raw=Buffer.from(pcm[name],'base64'),n=raw.length/2;
   assert(n>=2400&&n<=({davidHeavyStomp:27600,davidLeapStomp:35040}[name]??18000),name);
   let sq=0,peak=0;
   for(let i=0;i<n;i++){const value=raw.readInt16LE(2*i)/32768;sq+=value**2;peak=Math.max(peak,Math.abs(value));}
   assert(peak>.35&&peak<.86&&Math.sqrt(sq/n)>.022,name);
   assert(Math.abs(raw.readInt16LE(raw.length-2))<10,name+' click-free tail');
 }
 assert.equal((html.match(/poiDavidAttackFoley\(q,p,b,i,'impact'\)/g)||[]).length,1,'only actual impact clock resolves');
});
