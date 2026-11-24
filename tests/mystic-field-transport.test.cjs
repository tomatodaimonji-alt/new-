const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const html=fs.readFileSync(process.argv[2]||process.env.HTML||'world-editor.html','utf8'),a=html.indexOf('const PINE_AUDIO_SETTINGS_KEY'),b=html.indexOf('const POI_PLAYER_MAX_HP',a);
assert(a>=0&&b>a);
function engine(){
 let settle,reject,calls=0,writes=0;const starts=[],sources=[],gains=[];
 const param=()=>({value:0,events:[],setValueAtTime(...e){this.events.push(['value',...e])},setTargetAtTime(...e){this.events.push(['target',...e])},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}});
 const node=()=>({gain:param(),Q:param(),frequency:param(),detune:param(),connect(n){this.to=n;return n},disconnect(){this.disconnected=true;}});
 const source=()=>Object.assign(node(),{start(t,o){starts.push(this);this.when=t;this.offset=o},stop(t){this.stopAt=t},setPeriodicWave(){}});
 const ctx={state:'running',currentTime:10,sampleRate:24000,
  createGain(){const g=node();gains.push(g);return g;},createBiquadFilter:node,createPeriodicWave:()=>({}),
  createBufferSource(){const n=source();sources.push(n);return n}, createOscillator:source,
  createBuffer:(c,n,r)=>({duration:n/r,getChannelData:()=>new Float32Array(n)}),suspend(){this.state='suspended';return Promise.resolve()},
  decodeAudioData(bytes,ok,err){assert.equal(new Uint8Array(bytes).slice(0,4).join(','),'79,103,103,83');calls++;settle=ok;reject=err;}
 };
 const context=vm.createContext({localStorage:{getItem(){return null},setItem(){writes++}},window:{addEventListener(){}},document:{hidden:false,addEventListener(){}},
  atob,console,ctx,mixer:node(),poiWalkActive:true,poiWalkX:10,poiWalkZ:10,poiWalkLevel:0,facilitySite:{id:'base'},zone:'town'});
 const run=s=>vm.runInContext(s,context);
 run(html.slice(a,b)+';poiAudioMusic=mixer;poiAudioContext=ctx;poiAudioMusicZone=()=>zone;');
 return {ctx,context,run,starts,sources,gains,decode:()=>calls,writes:()=>writes,success(){settle({duration:37,length:888000,sampleRate:24000})},fail(){reject(new Error('unsupported'))},
  tick(t,zone=context.zone){ctx.currentTime=t;context.zone=zone;return run('poiAudioMusicPhrase();poiOrchestraSnapshot()')},loops(){return starts.filter(n=>n.loop)}};
}
test('outdoor only: async old synth fallback, one genuine loop, smooth buffered handover, shared mixer',()=>{
 const x=engine();
 x.tick(10,'town');x.tick(10.2,'chapel');assert.equal(x.decode(),0);
 x.tick(10.4,'outside');assert.equal(x.decode(),1);assert.equal(x.loops().length,0);
 const fallback=x.run("poiOrchestraDecks.get('outside')");assert(fallback.sources.size);
 x.success();x.tick(10.6);const [n]=x.loops();
 assert.equal(x.loops().length,1);assert.equal(n.buffer.duration,37);assert.equal(n.loopStart,0);assert.equal(n.loopEnd,37);
 assert.equal(n.to.to,fallback.bus);assert.equal(fallback.bus.to,x.context.mixer);
 assert(x.gains.some(g=>g.to===fallback.bus&&g.gain.events.some(e=>e[0]==='target'&&e[1]===0)));
 x.tick(11.1);assert.equal(x.loops().length,1);assert.equal(x.writes(),0);
});
test('race on leave or suspend never starts field under another score; retire/reset cancels live source',()=>{
 const x=engine();
 x.tick(10,'outside');x.tick(10.2,'town');x.success();x.tick(10.4);
 assert.equal(x.loops().length,0);
 x.tick(11.4,'outside');const [first]=x.loops();assert(first);
 x.tick(11.6,'town');assert.equal(first.stopAt,undefined);
 x.tick(12.8);assert.equal(first.stopAt,12.8);assert(first.disconnected);
 x.tick(13,'outside');const [,next]=x.loops();assert(next);assert.equal(x.decode(),1);
 x.run('poiAudioStop(true);document.hidden=true');assert.equal(next.stopAt,13);assert(next.disconnected);
 x.tick(15,'outside');assert.equal(x.loops().length,2);
});
test('codec failure memoizes only decode result, original outdoor synth remains available',()=>{
 const x=engine();x.tick(10,'outside');x.fail();x.tick(10.2);x.tick(11);
 assert.equal(x.decode(),1);assert.equal(x.loops().length,0);
 assert(x.run("poiOrchestraDecks.get('outside').sources.size")>0);
 x.tick(11.2,'town');x.tick(13,'outside');assert.equal(x.decode(),1);assert.equal(x.loops().length,0);
});
test('decode finishing while backgrounded is inert; foreground uses cached audio without affecting other tracks',()=>{
 const x=engine();x.tick(10,'outside');assert.equal(x.decode(),1);
 x.run('poiAudioStop(true);document.hidden=true');x.success();
 x.tick(16,'outside');assert.equal(x.loops().length,0);
 x.context.document.hidden=false;x.ctx.state='running';
 x.tick(18,'battle');assert.equal(x.loops().length,0);
 x.tick(19,'outside');assert.equal(x.loops().length,1);assert.equal(x.decode(),1);
 assert.equal(x.writes(),0);
});
test('recording node rejection keeps synth bus audible and does not disturb other scenes',()=>{
 const x=engine();x.tick(10,'outside');x.success();
 const real=x.ctx.createBufferSource;let errors=0;
 x.ctx.createBufferSource=()=>{errors++;throw new Error('unavailable buffer source')};
 assert.equal(x.tick(10.2).active,'outside');
 assert.equal(x.tick(10.4).active,'outside');
 assert.equal(errors,1);assert.equal(x.loops().length,0);
 assert.equal(x.run("poiOrchestraDecks.get('outside').fieldSynth.gain.value"),1);
 x.ctx.createBufferSource=real;
 assert.equal(x.tick(11,'town').active,'town');
});
