const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function harness(available=true){
 const calls=[];const env={calls,poiAudioLevels:{master:80,se:90},poiWalkActive:true,poiAudioEnabled:true,facilitySite:{id:'base'},
 poiAudioContext:{state:'running',currentTime:10},poiAudioEffects:{},poiAudioStart(){},poiAudioAllowed:()=>true,
 poiTryRecordedFoley:(...a)=>{calls.push(['recorded',...a]);return available},
 poiSurfaceFoley:k=>k,poiRecordedFoley:k=>k,poiKitchenKnifeBuffer:k=>'oldKnife:'+k,
 poiPlayImpactBuffer:(...a)=>calls.push(['buffer',...a]),poiAudioNoiseBurst:(...a)=>calls.push(['brush',...a]),
 poiAudioThud:(...a)=>calls.push(['thud',...a]),poiAudioTone:(...a)=>calls.push(['tone',...a])};
 const extract=(from,to)=>html.slice(html.indexOf(from),html.indexOf(to,html.indexOf(from)));
 vm.createContext(env);
 vm.runInContext(extract('const POI_WEAPON_SE=','function poiHealSound(')+extract('// BEGIN ITEM FOLEY','// END ITEM FOLEY')+
  extract('function poiSound(','function poiAudioSyncLifecycle('),env);
 const play=(...args)=>{calls.length=0;env.poiSound(...args);return calls.slice()};
 return {env,play};
}
test('wooden door entry and departure play separate recordings; stone and iron retain separate surface audio',()=>{
 const {play}=harness();
 assert.deepEqual(play('door-open','wood').map(x=>x.slice(0,2)),[['recorded','doorOpen']]);
 assert.deepEqual(play('door-close','wood').map(x=>x.slice(0,2)),[['recorded','doorClose']]);
 assert.deepEqual(play('door-open','stone').map(x=>x.slice(0,2)),[['buffer','door-open-stone']]);
 assert.deepEqual(play('door-close','iron').map(x=>x.slice(0,2)),[['buffer','door-close-iron']]);
});
test('only real metallic melee uses recorded attack air; bladed contact uses separate organic Foley; one actual contact can also cue defeat',()=>{
 const {play}=harness();
 for(const type of ['equipIronSword','kitchenKnife']){
  assert.deepEqual(play('attack',type).map(x=>x.slice(0,2)),[['recorded','playerSteelSwing']]);
  const hit=play('hit',type,true,true);
  assert.equal(hit[0][1],'playerSteelCut');assert.equal(hit[0][2],10);
  assert.deepEqual(hit[1].slice(0,2),['buffer','defeat']);
 }
 for(const type of ['equipStoneSword','equipBoneSword']){
  assert.ok(!play('attack',type).some(c=>c[0]==='recorded'),type);
  assert.deepEqual(play('hit',type,false,true),[['recorded','playerSteelCut',10,.57]],type);
 }
 for(const type of ['equipWoodSword','equipWoodSpear','equipStoneMace','equipClub'])
  assert.ok(![...play('attack',type),...play('hit',type)].some(c=>c[0]==='recorded'),type);
});
test('successful pickup and chest route to cloth recording without stealing the separate gold cue or mixer mute',()=>{
 const {env,play}=harness();
 assert.equal(play('item-pickup','ironOre')[0][2],10.068);
 assert.deepEqual(play('chest-pickup')[0].slice(0,3),['recorded','itemPickup',10]);
 assert.ok(play('item-pickup','coin').every(a=>a[0]!=='recorded'));
 assert.ok(play('item-pickup','gold').every(a=>a[0]!=='recorded'));
 assert.ok(play('enemy-loot','coin').some(a=>a[0]==='tone'));
 env.poiAudioLevels.se=0;for(const args of [['item-pickup'],['door-open'],['hit','equipIronSword']])assert.deepEqual(play(...args),[]);
});
test('absent optional recordings preserve door and weapon fallback while noncoin pickup has no oscillator',()=>{
 const {play}=harness(false);
 assert.deepEqual(play('door-open','wood').at(-1).slice(0,2),['buffer','door-open-wood']);
 assert.deepEqual(play('attack','kitchenKnife').at(-1).slice(0,2),['buffer','oldKnife:attack']);
 const item=play('item-pickup','healingHerb');
 assert.ok(item.filter(a=>a[0]==='brush').length>=2);
 assert.ok(!item.some(a=>a[0]==='tone'||a[0]==='thud'));
});
test('bundled recordings decode as 24kHz signed mono PCM on the existing cached buffer and effects path',()=>{
 const calls=[];
 const context={atob:s=>Buffer.from(s,'base64').toString('latin1'),poiAudioContext:{
  createBuffer:(channels,count,rate)=>{const data=new Float32Array(count);return {channels,count,rate,getChannelData:()=>data}}}, poiPlayImpactBuffer:(...args)=>calls.push(args)};
 const i=html.indexOf('const POI_RECORDED_FOLEY='),j=html.indexOf('function poiKitchenKnifePcm(',i);
 const meta=vm.runInNewContext(html.slice(i,j)+';({poiTryRecordedFoley,POI_RECORDED_FOLEY});',context);
 const foley=['doorOpen','doorClose','steelSwing','steelImpact','playerSteelSwing','playerSteelCut','itemPickup'];
 const found=foley.filter(id=>Object.hasOwn(meta.POI_RECORDED_FOLEY,id));
 if(process.env.REQUIRE_RECORDED_INTERACTION_FOLEY==='1')assert.deepEqual(found,foley,'shipping artifact must contain every verified recording');
 for(const id of [...found,'wood','defeat']){
  assert.equal(meta.poiTryRecordedFoley(id,2,.61),true);
  assert.equal(meta.poiTryRecordedFoley(id,3,.61),true);
  const [a,b]=calls.slice(-2),pcm=Buffer.from(meta.POI_RECORDED_FOLEY[id],'base64'),buf=a[0];
  assert.equal(a[0],b[0]);assert.equal(a[1],2);assert.equal(b[1],3);assert.equal(a[2],.61);
  assert.equal(buf.channels,1);assert.equal(buf.rate,24000);assert.equal(buf.count,pcm.length/2);
  const floats=buf.getChannelData(0);
  for(let k=0;k<floats.length;k++)assert.equal(floats[k],pcm.readInt16LE(k*2)/32768);
 }
 assert.equal(meta.poiTryRecordedFoley('noSuchRecording',0,.5),false);
});
