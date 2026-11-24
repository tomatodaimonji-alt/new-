const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const extract=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)+1));
function setup(baked=true){
 const calls=[];const c={calls,poiAudioLevels:{master:80,se:90},poiWalkActive:true,poiAudioEnabled:true,facilitySite:null,
  poiAudioContext:{state:'running',currentTime:10},poiAudioEffects:{},poiAudioStart(){},poiAudioAllowed:()=>true,
  poiTryRecordedFoley:(...a)=>{calls.push(['recorded',...a]);return baked},
  poiSurfaceFoley:k=>k,poiRecordedFoley:k=>k,poiKitchenKnifeBuffer:k=>'oldKnife:'+k,
  poiPlayImpactBuffer:(...a)=>calls.push(['buffer',...a]),poiAudioNoiseBurst:(...a)=>calls.push(['noise',...a]),
  poiAudioThud:(...a)=>calls.push(['thud',...a]),poiAudioTone:(...a)=>calls.push(['tone',...a])};
 vm.createContext(c);
 vm.runInContext(extract('const POI_WEAPON_SE=','function poiHealSound(')+extract('function poiSound(','function poiAudioSyncLifecycle('),c);
 const play=(...args)=>{calls.length=0;c.poiSound(...args);return calls.slice()};
 return {c,play};
}
test('knife and iron swing stay steel; slime shares the species-neutral recorded cut and normal common defeat',()=>{
 const {play}=setup();
 for(const type of ['kitchenKnife','equipIronSword']){
  assert.deepEqual(play('attack',type).map(v=>v.slice(0,2)),[['recorded','playerSteelSwing']]);
  for(const defeated of [false,true]){
   const hit=play('hit',type,defeated,true,'monsterSlime');
   assert.deepEqual(hit.map(v=>v.slice(0,3)),[['recorded','playerSteelCut',10],...(defeated?[['buffer','defeat',10.018]]:[])]);
  }
  assert.deepEqual(play('hit',type,true,true,'monsterSkeleton').map(v=>v.slice(0,2)),[['recorded','playerSteelCut'],['buffer','defeat']]);
 }
 assert.deepEqual(play('hit','equipWoodSword',false,true,'monsterSlime').map(v=>v.slice(0,2)),[['buffer','wood']]);
});
test('fallback remains a damp pulse before an independent defeated cue, not synthesized steel, and respects mute',()=>{
 const {c,play}=setup(false);
 assert.deepEqual(play('hit','kitchenKnife',true,true,'monsterSlime').map(v=>v.slice(0,2)),
  [['recorded','playerSteelCut'],['thud',10],['buffer','defeat']]);
 c.poiAudioLevels.se=0;
 assert.deepEqual(play('hit','kitchenKnife',true,true,'monsterSlime'),[]);
});
test('real targeted damage and grouped iron sweep send the target material once',()=>{
 const {c,play}=setup();const seen=[];
 Object.assign(c,{poiSound:(...v)=>seen.push(v),terrainY:()=>0,poiDamageNumber(){},pineGameActive:false,
  poiAimWall:()=>()=>true,poiAimUnit:()=>({}),poiAimWallLimit:()=>3,
  poiEquipmentSpendWeapon:()=>true,poiSwordSweepContains:()=>true,POI_AIM_EPS:1e-7,POI_SWORD_HALF_WIDTH:1.5,
  poiAimTargetList:()=>c.targets});
 vm.runInContext(extract('function poiPlayerDamageTarget(','function poiPlayerWeaponResolve(')+
  extract('function poiSwordResolve(','function poiPlayerStartProfile('),c);
 const actor=(type)=>({id:{type},state:{x:2,z:1,hp:100},x:2,z:1});
 const slime=actor('monsterSlime'),hard=actor('monsterSkeleton');
 c.poiPlayerDamageTarget([slime.id,slime.state],2,1,20,'kitchenKnife',7,false,true);
 assert.deepEqual(seen.splice(0),[['hit','kitchenKnife',false,true]]);
 const shot={aim:{x:1,z:1},dx:1,dz:0,type:'equipIronSword',profile:{range:2,damage:30}};
 c.targets=[slime];c.poiSwordResolve(shot,8);
 assert.deepEqual(seen.splice(0),[['hit','equipIronSword',false,true]]);
 c.targets=[slime,hard];c.poiSwordResolve(shot,9);
 assert.equal(seen.length,1);
 assert.deepEqual(seen.pop(),['hit','equipIronSword',false,true]);
});
test('former watery data is gone; shared recorded contact is short, cached and distinct from NPC metal',()=>{
 const c={atob:s=>Buffer.from(s,'base64').toString('latin1'),poiAudioContext:{
  createBuffer:(channels,frames,rate)=>{const data=new Float32Array(frames);return {channels,frames,rate,getChannelData:()=>data}}
 }};
 const f=vm.runInNewContext(extract('const POI_RECORDED_FOLEY=','function poiKitchenKnifePcm(')+
  ';({poiRecordedFoley,POI_RECORDED_FOLEY})',c);
 assert(!Object.hasOwn(f.POI_RECORDED_FOLEY,'slimeImpact'));
 assert.notEqual(f.POI_RECORDED_FOLEY.playerSteelCut,f.POI_RECORDED_FOLEY.steelImpact);
 const b=f.poiRecordedFoley('playerSteelCut');
 assert.equal(b,f.poiRecordedFoley('playerSteelCut'));assert.equal(b.rate,24000);assert.equal(b.channels,1);assert.equal(b.frames,4704);
 assert(Math.max(...b.getChannelData(0).map(Math.abs))<=.521);
});
