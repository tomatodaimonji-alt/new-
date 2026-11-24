const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(x,y)=>{const i=h.indexOf(x),j=h.indexOf(y,i+x.length);a(i>=0&&j>i,x);return h.slice(i,j)};
function bind(){
 const o={type:'monsterStoneDavid',x:24,z:104,y:0},b={y:0},s={x:24,z:104,hp:1050,david:{awake:true}},
  ordinary={type:'monsterSkeleton'},ordinaryS={x:24,z:103,hp:100};
 const list=[],sounds=[],c={
  poiDavidMatch:x=>x===o?b:null,poiDavidIncoming:(_o,_s,amount)=>amount>0?Math.round(amount*.35):0,
  poiWalkActive:true,poiAudioEnabled:true,poiAudioAllowed:()=>c.allowed,allowed:true,poiAudioLevels:{master:1,se:1},
  poiDavidIn:()=>true,poiDavidLine:()=>true,poiAimOrigin:()=>({x:24,z:103}),poiAudioStart(){},poiAudioContext:{state:'running',currentTime:7},
  poiTryRecordedFoley:id=>(sounds.push(id),true),poiDavidTrackAttackFoley(){},poiWalkLevel:0,poiSound:(k,w)=>sounds.push([k,w]),
  poiDamageNumber(){},terrainY:()=>0,facilitySite:{id:'base'},pineGameActive:false,poiMonsterMeshDirty:false,
  poiAimTargetList:()=>list,poiAimWall:()=>()=>true,poiSwordSweepContains:()=>true,poiAimUnit:()=>({x:0,z:-1}),
  poiAimWallLimit:(_o,_d,n)=>n,POI_AIM_EPS:1e-7,POI_SWORD_HALF_WIDTH:1.5,poiEquipmentSpendWeapon:()=>true
 };
 const stone=h.includes('// BEGIN DAVID STONE MATERIAL AUDIO')?cut('// BEGIN DAVID STONE MATERIAL AUDIO','// END DAVID STONE MATERIAL AUDIO'):'';
 const api=vm.runInNewContext(stone+cut('function poiPlayerDamageTarget(','function poiPlayerWeaponResolve(')+
  cut('function poiSwordResolve(','function poiPlayerStartProfile(')+
  ';({hit:poiPlayerDamageTarget,swing:poiSwordResolve,extract:typeof poiDavidExtractionFoley==="function"?poiDavidExtractionFoley:null})',c);
 const shot={type:'equipWoodSword',aim:{x:24,z:102},dx:0,dz:1,profile:{range:1.3,damage:28}};
 return {o,b,s,ordinary,ordinaryS,sounds,c,list,shot,api};
}
test('only genuine canonical stone damage replaces flesh, including group/ally contacts; miss and other monsters retain old sound',()=>{
 const {o,s,ordinary,ordinaryS,api,sounds,list,shot}=bind();
 api.hit([o,s],24,104,20,'kitchenKnife',2000,false,true);
 a.deepEqual(sounds.splice(0),['davidRockHit']);a.equal(s.hp,1043);
 api.hit([o,s],24,104,0,'kitchenKnife',2020,false,true);a.equal(sounds.length,0);
 api.hit([o,s],24,104,6,null,2080,true,true,{companion:true});
 a.deepEqual(sounds.splice(0),['davidRockHit']);
 api.swing(shot,2100);a.deepEqual(sounds.splice(0),[['attack','equipWoodSword']]);
 list.push({id:o,state:s,x:24,z:104});
 api.swing(shot,2150);a.deepEqual(sounds.splice(0),['davidRockHit']);
 list.push({id:ordinary,state:ordinaryS,x:24,z:103});
 api.swing(shot,2200);a.deepEqual(sounds.splice(0),[['hit','equipWoodSword'],'davidRockHit']);
 api.hit([ordinary,ordinaryS],24,103,20,'kitchenKnife',2300);
 a.deepEqual(sounds,[['hit','kitchenKnife']]);
});
test('one extraction sample per actual sword contact, cancel-safe and distinct',()=>{
 const {o,s,b,c,api,sounds}=bind();a(api.extract);
 a(api.extract(o,s,b,0,920));a(!api.extract(o,s,b,0,921));
 a(api.extract(o,s,b,1,1840));a(!api.extract(o,s,b,1,1850));
 a.deepEqual(sounds,['davidStoneExtractFirst','davidStoneExtractSecond']);
 s.david={awake:true,returning:true};a(!api.extract(o,s,b,0,1900));
 s.david={awake:true};c.allowed=false;a(!api.extract(o,s,b,0,2700));
 c.allowed=true;a(!api.extract(o,s,b,0,2750),'missed hidden extraction does not replay');
 a.equal(sounds.length,2);
});
test('real CC0 rock hit and each distinct extraction buffer are embedded unchanged',()=>{
 const f=vm.runInNewContext(cut('const POI_RECORDED_FOLEY={','const poiRecordedFoleyCache')+';POI_RECORDED_FOLEY');
 const keys={davidRockHit:[5760,'461be1c340d2357e10d07a7317e3fd444133dce8390c7814fb476786e9b584e5'],
  davidStoneExtractFirst:[11760,'929a9bc674340c6429fbb38700fb22bb715395b52dbc3668aacfe1dd900db98c'],
  davidStoneExtractSecond:[13680,'cebe409d42b1f4bbdfcc5549a3d803cd85c587568cb40366942983425d59ca87']};
 for(const [key,[n,sum]] of Object.entries(keys)){const v=Buffer.from(f[key]||'','base64');a.equal(v.length,n*2);a.equal(crypto.createHash('sha256').update(v).digest('hex'),sum);a.equal(v.readInt16LE(v.length-2),0);}
});
