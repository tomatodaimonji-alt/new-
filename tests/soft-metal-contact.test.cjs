const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const slice=(a,b)=>h.slice(h.indexOf(a),h.indexOf(b,h.indexOf(a)+1));
function playHarness(){
 const calls=[],c={poiAudioLevels:{master:80,se:90},poiWalkActive:true,poiAudioEnabled:true,facilitySite:null,
  poiAudioContext:{state:'running',currentTime:10},poiAudioEffects:{},poiAudioStart(){},poiAudioAllowed:()=>true,
  poiTryRecordedFoley:(...a)=>{calls.push(a);return true},poiSurfaceFoley:k=>k,poiRecordedFoley:k=>k,
  poiPlayImpactBuffer:(...a)=>calls.push(a),poiAudioNoiseBurst(){},poiAudioThud(){},poiAudioTone(){}};
 vm.createContext(c);
 vm.runInContext(slice('const POI_WEAPON_SE=','function poiHealSound(')+slice('function poiSound(','function poiAudioSyncLifecycle('),c);
 return {c,calls,play:(...args)=>{calls.length=0;c.poiSound(...args);return calls.slice()}};
}
test('a bladed metal swing plays only quiet air/metal; confirmed contact plays one combined softer cut and retains defeat',()=>{
 const {c,play}=playHarness();
 for(const item of ['kitchenKnife','equipIronSword','equipNorthMinotaurAxe']){
  assert.deepEqual(play('attack',item),[['playerSteelSwing',10.05,.47]]);
  assert.deepEqual(play('hit',item,false,true,'monsterSkeleton'),[['playerSteelCut',10,.57]]);
  assert.deepEqual(play('hit',item,true,true,'monsterSkeleton'),[['playerSteelCut',10,.57],['defeat',10.018,.80]]);
  assert.deepEqual(play('hit',item,true,true,'monsterSlime'),[['slimeImpact',10,.70]]);
  assert.deepEqual(play('hit',item,false,false,null,false),[['steelImpact',10.108,.69]]);
 }
 assert.deepEqual(play('hit','equipWoodSword',false,true),[['wood',10,.78]]);
 assert.deepEqual(play('hit','equipStoneSword',false,true),[]);
 c.poiAudioLevels.se=0;assert.deepEqual(play('hit','equipIronSword',true,true),[]);
});
test('actual multi-enemy sweep schedules exactly one shared contact and no contact on air',()=>{
 const {c,calls}=playHarness();
 Object.assign(c,{terrainY:()=>0,poiDamageNumber(){},pineGameActive:false,poiAimWall:()=>()=>true,poiAimUnit:()=>({}),
  poiAimWallLimit:()=>3,poiEquipmentSpendWeapon:()=>true,poiSwordSweepContains:()=>true,poiPlayerFrontArcContains:()=>true,
  POI_AIM_EPS:1e-7,POI_SWORD_HALF_WIDTH:1.5,poiAimTargetList:()=>c.targets});
 vm.runInContext(slice('function poiPlayerDamageTarget(','function poiPlayerWeaponResolve(')+slice('function poiSwordResolve(','function poiPlayerStartProfile('),c);
 const actor=type=>({id:{type},state:{x:2,z:1,hp:100},x:2,z:1});
 const shot={aim:{x:1,z:1},dx:1,dz:0,type:'equipNorthMinotaurAxe',profile:{range:2.55,damage:30,frontArc:true}};
 c.targets=[];c.poiSwordResolve(shot,8);assert.deepEqual(calls.splice(0),[['playerSteelSwing',10,.47]]);
 c.targets=[actor('monsterSkeleton'),actor('monsterGoblin')];c.poiSwordResolve(shot,9);
 assert.deepEqual(calls.splice(0),[['playerSteelCut',10,.57]]);
 assert.deepEqual(c.targets.map(t=>t.state.hp),[70,70]);
});
test('bundled player clips are distinct short and quieter recordings on the existing mono SE cache',()=>{
 const c={atob,poiAudioContext:{createBuffer(c,n,rate){const data=new Float32Array(n);return {c,n,rate,data,getChannelData:()=>data}}}};
 const meta=vm.runInNewContext(slice('const POI_RECORDED_FOLEY=','function poiKitchenKnifePcm(')+';({poiRecordedFoley})',c);
 for(const [next,old] of [['playerSteelSwing','steelSwing'],['playerSteelCut','steelImpact']]){
  const b=meta.poiRecordedFoley(next),a=meta.poiRecordedFoley(old);
  assert.equal(meta.poiRecordedFoley(next),b);assert.equal(b.rate,24000);assert.equal(b.c,1);
  assert(b.n>=3500&&b.n<=6500&&b.n<a.n);
  const jump=x=>Math.sqrt(x.slice(1).reduce((s,v,i)=>s+(v-x[i])**2,0)/(x.length-1));
  const gains=next==='playerSteelSwing'?[.47,.61]:[.57,.69];assert(jump(b.data)*gains[0]<jump(a.data)*gains[1]*.68);
  assert(Math.max(...b.data.map(Math.abs))>=.15);
  assert(Math.abs(b.data[0])<.001&&Math.abs(b.data.at(-1))<.001);
 }
});
