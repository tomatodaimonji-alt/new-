const test=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function cut(x,y){const i=h.indexOf(x),j=h.indexOf(y,i+1);a.ok(i>=0&&j>i,x);return h.slice(i,j)}
test('start cue precedes unchanged release and never replays in held/rendered frames or on cancellation',()=>{
 const calls=[],bow={range:5,hit:325,ready:1030,pose:525},knife={range:1,hit:80,ready:225,pose:190};
 const c={poiPlayerWeaponPending:null,poiWalkX:1,poiWalkZ:1,poiWalkLevel:0,poiWalkFacing:0,
  poiWalkActive:true,document:{hidden:false},poiPlayerWeaponProfile:k=>k==='equipWoodBow'?bow:k==='kitchenKnife'?knife:null,
  poiEquippedWeapon:()=>c.weapon,weapon:'equipWoodBow',poiWalkAvatar(){},
  poiSound:(...v)=>calls.push(v),poiPlayerWeaponFlightBegin:()=>{c.poiPlayerWeaponPending.phase='flight';calls.push(['flight'])},
  poiPlayerWeaponFlightFrame:()=>calls.push(['travel']),poiPlayerWeaponCancel:()=>{c.poiPlayerWeaponPending=null}};
 vm.runInNewContext(cut('function poiPlayerStartProfile(','function poiPlayerCastFireWand(')+
  cut('function poiPlayerWeaponFrame(','// A shoulder-led flat cut'),c);
 a.equal(c.poiPlayerStartProfile('bad',0),false);
 a.ok(c.poiPlayerStartProfile('equipWoodBow',100));
 a.deepEqual(calls,[['bow-draw']]);
 for(let t=101;t<100+bow.hit;t+=13)c.poiPlayerWeaponFrame(t);
 a.deepEqual(calls,[['bow-draw']]);
 a.equal(c.poiAttackReady,100+bow.ready);
 c.poiPlayerWeaponFrame(100+bow.hit);
 c.poiPlayerWeaponFrame(100+bow.hit+1);
 a.deepEqual(calls,[['bow-draw'],['flight'],['travel']]);
 calls.length=0;c.poiPlayerStartProfile('equipWoodBow',1800);
 c.poiWalkX=2;c.poiPlayerWeaponFrame(1808);
 a.deepEqual(calls,[['bow-draw']]);a.equal(c.poiPlayerWeaponPending,null);
 calls.length=0;c.poiPlayerStartProfile('kitchenKnife',3000);
 a.deepEqual(calls,[['attack','kitchenKnife']]);
 a.match(cut('function poiWalkAction(){','function poiWalkReset('),/now<poiAttackReady\|\|\(typeof poiPlayerWeaponPending!==[^)]*&&poiPlayerWeaponPending\)\)return/);
});
test('mixer uses its recorded draw buffer only when effects are enabled, without replacing release',()=>{
 const events=[],c={poiWalkActive:true,poiAudioEnabled:true,poiAudioAllowed:()=>true,poiAudioStart(){},
  poiAudioContext:{state:'running',currentTime:7},poiAudioLevels:{master:80,se:90},facilitySite:null,POI_WEAPON_SE:{},
  poiTryRecordedFoley:(...v)=>events.push(['recorded',...v]),poiAudioNoiseBurst(){},poiAudioThud(){}};
 vm.runInNewContext(cut('function poiSound(','function poiAudioSyncLifecycle('),c);
 c.poiSound('bow-draw');a.deepEqual(events.map(v=>v.slice(0,3)),[['recorded','bowDraw',7]]);
 c.poiAudioLevels.se=0;c.poiSound('bow-draw');
 c.poiAudioLevels.se=90;c.poiAudioContext.state='suspended';c.poiSound('bow-draw');
 a.equal(events.length,1);
 a.match(cut('function poiAimFlightBegin(','function poiAimProjectileSample('),/if\(shot.type==='equipWoodBow'\)poiSound\('attack',shot.type\)/);
});
test('shipping draw sample is short distinct 24kHz mono PCM through the existing cache',()=>{
 const c={atob:s=>Buffer.from(s,'base64').toString('latin1'),poiAudioContext:{
  createBuffer:(channels,frames,rate)=>{const data=new Float32Array(frames);return {channels,frames,rate,getChannelData:()=>data}}
 }};
 const f=vm.runInNewContext(cut('const POI_RECORDED_FOLEY=','function poiKitchenKnifePcm(')+';({poiRecordedFoley,POI_RECORDED_FOLEY})',c);
 const baked=Object.hasOwn(f.POI_RECORDED_FOLEY,'bowDraw');
 if(process.env.REQUIRE_BOW_DRAW_RECORDING==='1')a.ok(baked,'release requires the actual licensed recording');
 if(!baked)return;
 const b=f.poiRecordedFoley('bowDraw');
 a.equal(b,f.poiRecordedFoley('bowDraw'));a.equal(b.rate,24000);a.equal(b.channels,1);
 a(b.frames>=1200&&b.frames<=7200);
 a.notEqual(f.POI_RECORDED_FOLEY.bowDraw,f.POI_RECORDED_FOLEY.steelSwing);
 a(b.getChannelData(0).some(v=>Math.abs(v)>.05));
});
