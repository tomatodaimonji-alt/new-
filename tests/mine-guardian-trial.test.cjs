const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function cut(x,y){const i=h.indexOf(x),j=h.indexOf(y,i+x.length);a(i>=0&&j>i,x);return h.slice(i,j)}
function game(){
 const boss={type:'monsterMineGuard',x:120,z:55,y:-1},s={x:120,z:55,hp:112,nextAttack:0,facing:0},wear=[],c={
  facilitySite:{id:'base',mine:{guardian:boss,bounds:{x1:108,x2:124,z1:52,z2:61},chamber:{x1:118,x2:123,z1:53,z2:57}}},
  poiWalkLevel:-1,poiWalkX:120,poiWalkZ:56,poiWalkActive:true,pineAIActive:false,
  poiWalkViewX:120,poiWalkViewZ:56,poiPlayerHP:100,poiPlayerNext:0,POI_PLAYER_MAX_HP:100,
  POI_PLAYER_ATTACK:20,POI_HOTBAR_SWORD_BONUS:8,poiAudioAllowed:()=>true,
  poiMonsterStates:new Map([[boss,s]]),poiChapelEliteMatch:()=>false,
  POI_MONSTER_STATS:{monsterMineGuard:{hp:140,attack:18},monsterSlime:{hp:35,attack:6}},
  poiAimOrigin:()=>c.player,player:{x:120,z:56,y:-1},
  poiPlayerDying:()=>c.poiPlayerHP<=0,poiPlayerDeathBegin:()=>true,poiWalkCanStep:()=>true,
  poiAimWall:()=>c.edge,edge:()=>true,poiPlayerDamageAfterArmor:raw=>raw-2,poiHotbarHasKit:()=>true,
  poiSound(){},poiDamageNumber(){},poiMonsterMeshDirty:false,terrainY:()=>0,poiCombatHud(){},pineGameActive:false,
  poiMonsterBreak(){},poiAnnounceDefeat(){},poiMineGuardianDefeat(){c.won=true},
  poiEquipmentSpendWeapon:type=>(wear.push(type),true),
  poiAimTargetList:()=>s.hp>0?[{id:boss,state:s,x:s.x,z:s.z}]:[]
 };
 const api=vm.runInNewContext(cut('// BEGIN SLIME ATTACK','function poiMineEarlyMayMove(')+
  cut('// BEGIN ANGULAR COMBAT MATH','// END ANGULAR COMBAT MATH')+
  cut('function poiMonsterStatsAt(','\n')+cut('// BEGIN PLAYER WEAPON PROFILES','function poiPlayerWeaponCancel(')+
  cut('function poiPlayerDamageTarget(','function poiPlayerStartProfile(')+
  ';({start:poiEnemyBeginPlayer,resolve:poiEnemyResolvePlayer,frame:poiMineGuardFrame,damage:poiPlayerDamageTarget,'+
  'stats:poiMonsterStatsAt,trial:poiMineGuardTrial,pose:poiEnemyVisualAttack,profile:poiPlayerWeaponProfile,sword:poiSwordResolve})',c);
 function player(x,z){c.player={x,z,y:-1};c.poiWalkX=Math.round(x);c.poiWalkZ=Math.round(z)}
 function swing(now){
  const {x,z}=c.player,u=s.x-x,v=s.z-z,len=Math.hypot(u,v);
  api.sword({aim:{...c.player},dx:u/len,dz:v/len,type:'equipWoodSword',profile:api.profile('equipWoodSword')},now);
 }
 return {boss,s,c,api,player,swing,wear};
}
test('only exact authored B1 guardian has calibrated stats/guard; legacy guardian and entry slime unchanged',()=>{
 const {boss,s,c,api}=game();
 a.equal(api.stats(boss).hp,112);a.equal(api.stats(boss).attack,28);
 a.equal(api.stats({type:'monsterSlime'}).hp,35);
 a.equal(api.stats({...boss,x:40,z:40}).hp,140);
 c.facilitySite.mine.guardian={...boss,x:40,z:40};
 a.equal(api.trial(c.facilitySite.mine.guardian),false);
 a.equal(api.stats(c.facilitySite.mine.guardian).hp,140);
});
test('seven hundred ms fixed windup survives incoming strike, exact reach, sideways evasion and 1.05s visible punish',()=>{
 const {boss,s,c,api,player,swing}=game();
 player(120,57.301);a.equal(api.start(boss,s,0),false);
 player(120,57.3);c.edge=(x,z)=>z!==56;a.equal(api.start(boss,s,0),false,'blocked real lane');
 c.edge=()=>true;a(api.start(boss,s,0));a.equal(s.playerAttack.hit,700);
 a.equal(s.playerAttack.guardTrial,true);a(api.pose(boss.type,s,325).tell>0);
 a.equal(s.playerAttack.dx,0);a.equal(s.playerAttack.dz,1);
 player(120.86,55.7);swing(300);
 a.equal(s.hp,84,'flank full even while winding');a(s.playerAttack.pending);
 api.resolve(699);a(s.playerAttack.pending);
 api.resolve(700);a.equal(c.poiPlayerHP,100);a.equal(s.guardOpenUntil,1750);
 a.equal(api.pose(boss.type,s,900).exposed,true);
 player(120,56);swing(1000);a.equal(s.hp,56,'front full only for the meaningful opening');
 swing(1750);a.equal(s.hp,51,'front guard returns at the exact deadline');
});
test('standing front and landing every ready wooden swing is still a loss before a knockout',()=>{
 const {boss,s,c,api,swing}=game(),p=api.profile('equipWoodSword');
 let next=0,contact=Infinity,deadAt=null;
 for(let t=0;t<=10000;t++){
  if(t%380===0)api.frame(boss,s,t);
  if(t===next){contact=t+p.hit;next=t+p.ready}
  if(t===contact)swing(t);
  api.resolve(t);
  if(c.poiPlayerHP===0){deadAt=t;break}
  a(s.hp>0,'frontal stationary spam must not beat all opening cycles');
 }
 a(deadAt!==null);a(s.hp>0);a.equal(s.guardOpenUntil===s.guardRestUntil,false,'successful slam kept its guard closed');
});
test('front dodge, then flank punish with the exact same wooden sword clears four full hits',()=>{
 const {boss,s,c,api,player,swing,wear}=game();
 for(let cycle=0;cycle<2;cycle++){
  const start=cycle*2000;
  player(120,56);a(api.start(boss,s,start));
  player(120.86,55.7);api.resolve(start+700);
  swing(start+810);swing(start+1160);
 }
 a.equal(s.hp,0);a.equal(c.poiPlayerHP,100);a.equal(c.won,true);a.equal(wear.length,4);
});
