const {test}=require('node:test'),a=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(u,v)=>{const i=html.indexOf(u),j=html.indexOf(v,i+u.length);a(i>=0&&j>i,u);return html.slice(i,j)};
function game(){
 const sounds=[],state={poiAudioContext:{state:'running',currentTime:10},poiWalkActive:true,poiAudioEnabled:true,poiAudioAllowed:()=>true,
  poiAudioLevels:{master:85,se:90},facilitySite:{id:'base'},poiAudioStart(){},poiWalkLevel:0,
  poiAudioNoiseBurst(){sounds.push(['ordinary brush'])},poiAudioThud(){sounds.push(['ordinary thud'])},
  poiTryRecordedFoley(...x){sounds.push(x);return true},poiDefeatSound(t){sounds.push(['defeat',t])},pineGameActive:false,
  poiDamageNumber(){},terrainY:()=>0,poiMonsterBreak(){},poiAnnounceDefeat(){},poiMonsterStates:new Map(),
  poiPlayerWeaponVisual:null,poiPlayerWeaponPending:null,poiPlayerFlightMs:()=>1,poiEquipmentSpendWeapon:()=>true,
  poiAudioEffects:{},POI_WEAPON_SE:{}};
 const c=vm.createContext(state);
 vm.runInContext(cut('function poiSound(','function poiAudioSyncLifecycle(')+cut('function poiPlayerWeaponImpactAngular(','function poiAimProjectileSample(')+
  cut('function poiPlayerDamageTarget(','function poiSwordResolve('),c);
 const impact=(hp,{stale=false,wear=true,hit=true}={})=>{
  sounds.length=0;c.poiEquipmentSpendWeapon=()=>wear;
  const id={type:'monsterGoblin'},s={hp,x:8,z:1};
  c.poiMonsterStates.clear();if(!stale)c.poiMonsterStates.set(id,s);
  c.poiPlayerWeaponImpactAngular({aim:{x:0,z:1},type:'equipWoodBow',phase:'flight',profile:{damage:22}},100,{x:7.67,z:1},7.67,hit?{id,state:s,x:8,z:1}:null);
  return [s.hp,sounds.slice()];
 };
 return {c,sounds,impact};
}
test('native flight damage plays exactly one dedicated contact when an arrow reaches a live target, not during miss/block/stale/wear rejection',()=>{
 const x=game();
 a.deepEqual(x.impact(60),[38,[['arrowPenetration',10,.68]]]);
 a.deepEqual(x.impact(21),[0,[['arrowPenetration',10,.68],['defeat',10.018]]]);
 for(const opts of [{hit:false},{stale:true},{wear:false}])a.deepEqual(x.impact(60,opts),[60,[]]);
 x.c.poiAudioLevels.se=0;a.deepEqual(x.impact(60),[38,[]]);
});
test('draw, launch and other ranged hit paths stay on their existing audio',()=>{
 const {c,sounds}=game();
 c.poiSound('bow-draw');a.deepEqual(sounds.splice(0),[['bowDraw',10,.59]]);
 c.poiSound('attack','equipWoodBow');a.deepEqual(sounds.splice(0),[['ordinary brush'],['ordinary brush'],['ordinary thud']]);
 c.poiSound('hit','fireWand',true);a.deepEqual(sounds.splice(0),[['ordinary brush'],['ordinary thud'],['defeat',10.018]]);
});
test('arrow penetration is a short cached dry separate clip with bounded transient and no hard high ringing',()=>{
 const c={atob,poiAudioContext:{createBuffer(ch,n,rate){const d=new Float32Array(n);return{ch,n,rate,d,getChannelData:()=>d}}}};
 const f=vm.runInNewContext(cut('const POI_RECORDED_FOLEY=','function poiKitchenKnifePcm(')+';poiRecordedFoley',c);
 const clip=f('arrowPenetration');a.equal(clip,f('arrowPenetration'));
 a.equal(clip.ch,1);a.equal(clip.rate,24000);a.equal(clip.n,2640);
 const d=clip.d,peak=Math.max(...d.map(Math.abs));a(peak>.34&&peak<.65);
 a(Math.abs(d[0])<.001&&Math.abs(d.at(-1))<.001);
 const rms=x=>Math.sqrt(x.reduce((s,v)=>s+v*v,0)/x.length);
 a(rms(d.slice(0,900))>5*rms(d.slice(-600)));
 const delta=d.slice(1).map((n,i)=>n-d[i]);a(rms(delta)<rms(d)*.45);
 a.notEqual(clip.n,f('playerSteelCut').n);a.notEqual(clip.n,f('playerHurt').n);
});
