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
  atob,console,ctx,mixer:node(),poiEnemyPending:new Set(),poiWalkActive:true,poiWalkX:10,poiWalkZ:10,poiWalkLevel:0,facilitySite:{id:'base'},zone:'town'});
 const run=s=>vm.runInContext(s,context);
 run(html.slice(a,b)+';poiAudioMusic=mixer;poiAudioContext=ctx;poiAudioMusicZone=()=>zone;');
 return {ctx,context,run,starts,sources,gains,decode:()=>calls,writes:()=>writes,success(){settle({duration:37,length:888000,sampleRate:24000})},fail(){reject(new Error('unsupported'))},
  tick(t,zone=context.zone){ctx.currentTime=t;context.zone=zone;return run('poiAudioMusicPhrase();poiOrchestraSnapshot()')},loops(){return starts.filter(n=>n.loop)}};
}
test('outdoor only: silent pending decode, one genuine loop, shared mixer',()=>{
 const x=engine();
 x.tick(10,'town');x.tick(10.2,'chapel');assert.equal(x.decode(),0);
 x.tick(10.4,'outside');assert.equal(x.decode(),1);assert.equal(x.loops().length,0);
 const deck=x.run("poiOrchestraDecks.get('outside')");assert.equal(deck.sources.size,0);
 x.success();x.tick(10.6);const [n]=x.loops();
 assert.equal(x.loops().length,1);assert.equal(n.buffer.duration,37);assert.equal(n.loopStart,0);assert.equal(n.loopEnd,37);
 assert.equal(n.to.to,deck.bus);assert.equal(deck.bus.to,x.context.mixer);
 assert.equal(deck.sources.size,1);
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
test('codec failure remains silent outside and never affects the town score',()=>{
 const x=engine();x.tick(10,'outside');x.fail();x.tick(10.2);x.tick(11);
 assert.equal(x.decode(),1);assert.equal(x.loops().length,0);
 assert.equal(x.run("poiOrchestraDecks.get('outside').sources.size"),0);
 assert(x.tick(11.2,'town').voices>0);x.tick(13,'outside');assert.equal(x.decode(),1);assert.equal(x.loops().length,0);
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
test('recording node rejection is silent outdoors and does not disturb other scenes',()=>{
 const x=engine();x.tick(10,'outside');x.success();
 const real=x.ctx.createBufferSource;let errors=0;
 x.ctx.createBufferSource=()=>{errors++;throw new Error('unavailable buffer source')};
 assert.equal(x.tick(10.2).active,'outside');
 assert.equal(x.tick(10.4).active,'outside');
 assert.equal(errors,1);assert.equal(x.loops().length,0);
 assert.equal(x.run("poiOrchestraDecks.get('outside').sources.size"),0);
 x.ctx.createBufferSource=real;
 assert.equal(x.tick(11,'town').active,'town');
});
test('field windup and real damage-pulse entry preserve the same recording; mine combat is still distinct',()=>{
 const x=engine(),combat={playerAttack:{pending:true,y:0,sx:12,sz:12}};
 assert.equal(x.tick(10,'outside').active,'outside');x.success();x.tick(10.2);
 const [recording]=x.loops();assert(recording);
 x.context.poiEnemyPending.add(combat);x.run('poiOrchestraCombat()');
 assert.deepEqual([...x.tick(10.4).decks],['outside']);
 assert.equal(x.loops().length,1);assert.equal(recording.stopAt,undefined);
 x.context.poiEnemyPending.clear();
 x.run('poiOrchestraCombat()'); // Immediately crossing into a settlement must not carry an outdoor hit.
 assert.equal(x.tick(10.41,'town').active,'town');
 assert.equal(x.tick(11.6,'mine').active,'mine');
 x.context.poiEnemyPending.add(combat);x.run('poiOrchestraCombat()');
 assert.equal(x.tick(11.7).active,'battle');
 assert.equal(x.loops().length,1);
});
test('actual built map marks physical field landmarks as outside while port and settlements keep their music',()=>{
 const x=engine(),s=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i+1);assert(i>=0&&j>i,a);return html.slice(i,j)};
 x.run(s('const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+s('const POI_SAFE_TOWN=Object.freeze(','// BEGIN LOCATION PANEL MOTION')
  +s('function poiSouthPortContains(','function poiSouthPortNear(')+s('function poiSouthTownContains(','function poiSouthMarketRole(')
  +s('function poiNorthTrailRegion(','function poiNorthTrailSupply(')
  +s('function poiDungeonThemeAt(','function poiDungeonEnterEffect(')
  +s('function poiAudioMusicZone(','function poiAudioTownRegionMusic(')+';facilitySite={...buildFacilitySite("base"),id:"base"};');
 // engine() overwrote the earlier runtime selector; restore the real implementation after loading authored definitions.
 x.run('poiAudioMusicZone=('+s('function poiAudioMusicZone(','function poiAudioTownRegionMusic(').trim()+')');
 x.run('function poiDungeonPointIn(b,x,z,y){return b?.y===y&&x>=b.x1&&x<=b.x2&&z>=b.z1&&z<=b.z2}');
 const zone=(px,pz,py)=>{Object.assign(x.context,{poiWalkX:px,poiWalkZ:pz,poiWalkLevel:py});return x.run('poiAudioMusicZone()')};
 for(const r of x.context.facilitySite.northTrail.regions.filter(r=>r.outdoorLandmark)){
  for(let px=r.bounds.x1;px<=r.bounds.x2;px++)for(let pz=r.bounds.z1;pz<=r.bounds.z2;pz++)assert.equal(zone(px,pz,0),'outside',r.name);
 }
 assert.equal(zone(87,2,0),'outside');
 assert.equal(zone(105,123,0),'outside');
 assert.equal(zone(92,123,0),'town');
 assert.equal(zone(105,111,0),'market');
 assert.equal(zone(118,60,-1),'mine');
});
test('only scene changes soften the incoming gain; late field decoding has the same soft attack without start delay',()=>{
 const x=engine();
 const target=bus=>bus.gain.events.filter(e=>e[0]==='target').at(-1);
 x.tick(10,'town');const town=x.run("poiOrchestraDecks.get('town')");
 assert.deepEqual(target(town.bus),['target',1,10,.10]);
 x.tick(10.2,'outside');const outside=x.run("poiOrchestraDecks.get('outside')");
 assert.deepEqual(target(town.bus),['target',0,10.2,.19]);
 assert.deepEqual(target(outside.bus),['target',1,10.2,.38]);
 x.success();x.tick(10.8);
 const [loop]=x.loops();assert(loop&&loop.when>=10.8&&loop.when<10.82,'no deferred start beyond the existing scheduling lookahead');
 assert.deepEqual(target(loop.to),['target',1,loop.when,.38]);
 x.tick(11,'mine');const mine=x.run("poiOrchestraDecks.get('mine')");
 assert.deepEqual(target(mine.bus),['target',1,11,.38]);
 assert.deepEqual(target(outside.bus),['target',0,11,.19]);
});
