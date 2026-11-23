const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function cut(x,y){const i=h.indexOf(x),j=h.indexOf(y,i+x.length);a(i>=0&&j>i,x);return h.slice(i,j)}
function duel(){
 const boss={type:'monsterNorthMinotaur',x:64,z:13,y:-1};
 const s={x:64,z:13,hp:0,nextAttack:0,moveStarted:-10000,facing:0};
 const wear=[],sounds=[],c={
  facilitySite:{id:'base',northFort:{boss:{...boss,room:{minX:57,maxX:71,minZ:10,maxZ:19}}}},
  poiWalkLevel:-1,poiWalkX:64,poiWalkZ:14,poiWalkActive:true,pineAIActive:false,
  poiWalkViewX:64,poiWalkViewZ:14,poiPlayerHP:100,POI_PLAYER_MAX_HP:100,POI_WALK_MS:175,
  POI_PLAYER_ATTACK:20,POI_HOTBAR_SWORD_BONUS:8,poiAudioAllowed:()=>true,
  poiMonsterStates:new Map([[boss,s]]),poiChapelEliteMatch:()=>false,
  poiAimOrigin:()=>c.player,player:{x:64,z:14.1,y:-1},
  poiPlayerDying:()=>c.poiPlayerHP<=0,poiPlayerDeathBegin:()=>true,poiWalkCanStep:()=>true,poiMonsterCanMove:()=>false,
  poiAimWall:()=>c.edge,edge:()=>true,poiHotbarHasKit:()=>true,poiArmorWorn:()=>({head:'starterCap',torso:'starterTunic',legs:'starterTrousers',feet:'starterBoots'}),
  poiSound:(...args)=>sounds.push(args),poiDamageNumber(){},poiMonsterMeshDirty:false,terrainY:()=>0,poiCombatHud(){},pineGameActive:false,
  poiMonsterBreak(){},poiAnnounceDefeat(){c.won=true},poiHotbarRead:()=>({}),
  poiEquipmentSpendWeapon:type=>(wear.push(type),true),poiAimTargetList:()=>s.hp>0?[{id:boss,state:s,x:s.x,z:s.z}]:[]
 };
 const api=vm.runInNewContext(cut('const POI_MONSTER_STATS=','\n')+
  cut('const POI_ARMOR_DEFENSE=','function poiEquipmentPrice(')+
  cut('// BEGIN SLIME ATTACK','function poiMineEarlyMayMove(')+cut('// BEGIN ANGULAR COMBAT MATH','// END ANGULAR COMBAT MATH')+
  cut('function poiMonsterStatsAt(','\n')+cut('// BEGIN PLAYER WEAPON PROFILES','function poiPlayerWeaponCancel(')+
  cut('function poiPlayerDamageTarget(','function poiPlayerStartProfile(')+
  ';({start:poiNorthMinotaurBegin,resolve:poiEnemyResolvePlayer,frame:poiNorthMinotaurFrame,damage:poiPlayerDamageTarget,'+
  'stats:poiMonsterStatsAt,pose:poiEnemyVisualAttack,profile:poiPlayerWeaponProfile,sword:poiSwordResolve,covered:poiNorthMinotaurCovered})',c);
 s.hp=api.stats(boss).hp;
 function player(x,z){c.player={x,z,y:-1};c.poiWalkX=c.poiWalkViewX=Math.round(x);c.poiWalkZ=c.poiWalkViewZ=Math.round(z)}
 function swing(now){
  const {x,z}=c.player,u=s.x-x,v=s.z-z,len=Math.hypot(u,v);
  api.sword({aim:{...c.player},dx:u/len,dz:v/len,type:'equipWoodSword',profile:api.profile('equipWoodSword')},now);
 }
 return {boss,s,c,api,player,swing,wear,sounds};
}
function tank(g,offset=0){
 const {boss,s,c,api,swing,wear}=g,p=api.profile('equipWoodSword');
 let next=offset,contact=Infinity,end=0,hits=[];
 for(let t=0;t<=12000;t++){
  if(t%380===0&&s.hp>0&&!s.playerAttack?.pending)api.frame(boss,s,t);
  if(t===next){contact=t+p.hit;next=t+p.ready}
  if(t===contact)swing(t);
  const hp=c.poiPlayerHP;
  api.resolve(t);
  if(c.poiPlayerHP<hp)hits.push([t,hp-c.poiPlayerHP]);
  if(c.poiPlayerHP<=0||s.hp<=0){end=t;break}
 }
 return {end,playerHP:c.poiPlayerHP,bossHP:s.hp,swings:wear.length,hits};
}
test('ideal stationary face-tank with real wood sword does not clear the boss',()=>{
 for(const offset of [0,100,230]){
  const result=tank(duel(),offset);
  if(process.env.PRINT_DUEL==='1')console.log('TANK',offset,result);
  a.equal(result.playerHP,0,JSON.stringify(result));a.ok(result.bossHP>=24,JSON.stringify(result));
 }
});
test('an equally safe far retreat does not mark the boss exposed, including when retreating out of the arena',()=>{
 for(const z of [17.05,19.8]){
  const {boss,s,c,api,player}=duel();
  a(api.start(boss,s,0));a.equal(s.playerAttack.northAttack,'axe');
  player(64,z);api.resolve(850);
  a.equal(c.poiPlayerHP,100);a.equal(s.northOpenUntil,0);a.equal(api.pose(boss.type,s,1000).exposed,false);
  a.equal(s.nextAttack,1970);
 }
});
test('deliberate thumb-paced close dodges and regular wooden sword counters clear the whole fight unhurt',()=>{
 const {boss,s,c,api,player,swing,wear,sounds}=duel(),p=api.profile('equipWoodSword');
 let last=null,orbitStart=0,swingsThisOpening=0,next=0,contact=Infinity,end=0,closeMisses=0;
 const variants=new Set(),r=1.1;
 for(let t=0;t<=14000;t++){
  if(t%380===0&&!s.playerAttack?.pending)api.frame(boss,s,t);
  const attack=s.playerAttack;
  if(attack&&attack!==last){last=attack;orbitStart=Math.atan2(c.player.x-s.x,c.player.z-s.z);swingsThisOpening=0;variants.add(attack.northAttack)}
  if(attack?.pending&&t>=attack.start+78){
   const delta=attack.northAttack==='axe'?1.84:.67;
   const span=attack.northAttack==='axe'?410:180;
   const old=c.player,ang=orbitStart+delta*Math.min(1,(t-attack.start-78)/span);
   player(s.x+r*Math.sin(ang),s.z+r*Math.cos(ang));
   a(Math.hypot(c.player.x-old.x,c.player.z-old.z)<=1/175+1e-6,'path never runs faster than the thumb');
   a(Math.hypot(c.player.x-s.x,c.player.z-s.z)>=.75,'path stays around the body instead of teleporting through it');
  }
  if(contact===t)swing(t);
  const wasPending=attack?.pending;
  api.resolve(t);
  if(wasPending&&!attack.pending){
   a.equal(c.poiPlayerHP,100,'dodge clears actual committed damage');
   a.equal(s.northOpenUntil,t+1120);
   closeMisses++;
  }
  if(t>=next&&swingsThisOpening<2&&s.northOpenUntil>t+p.hit){
   next=t+p.ready;contact=t+p.hit;swingsThisOpening++;
  }
  if(s.hp<=0){end=t;break}
 }
 if(process.env.PRINT_DUEL==='1')console.log('DODGE',{end,playerHP:c.poiPlayerHP,bossHP:s.hp,swings:wear.length,closeMisses});
 a.deepEqual([...variants],['axe','horn']);
 a.equal(c.poiPlayerHP,100);a.equal(s.hp,0);a.equal(wear.length,8);a.equal(closeMisses,4);
 a.equal(sounds.filter(x=>x[0]==='hit'&&x[2]).length,1,'same lethality basis as actual guarded/counter damage');
});
test('guarded hits apply the same chip to the number, HP, and killing-blow sound while the opening gives full damage',()=>{
 const {boss,s,c,api,swing,sounds}=duel();
 const labels=[];c.poiDamageNumber=(...v)=>labels.push(v);
 s.hp=20;swing(0);
 a.equal(s.hp,11);a.equal(labels.at(-1)[3],9);a.equal(labels.at(-1)[6],true);
 a.deepEqual(sounds.at(-1),['hit','equipWoodSword',false,true]);
 s.northOpenUntil=1000;swing(350);
 a.equal(s.hp,0);a.equal(labels.at(-1)[3],28);a.deepEqual(sounds.at(-1),['hit','equipWoodSword',true,true]);
});
