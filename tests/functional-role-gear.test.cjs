const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const span=(a,b)=>h.slice(h.indexOf(a),h.indexOf(b,h.indexOf(a)+1));
const gear=[['armorMerchantCoat','商人の服','torso'],['armorGuildUniform','ギルド制服','torso'],['armorCookApron','料理人の服','torso'],['armorCookHat','料理人の帽子','head']];
const tools=[['equipFryingPan','フライパン'],['equipLadle','おたま'],['equipBallpointPen','ボールペン']];
function setup(save){
 let raw=save&&JSON.stringify(save),writes=0;
 const c=vm.createContext({$:()=>null,document:{querySelectorAll:()=>[]},facilitySite:{id:'base'},poiWalkActive:true,pineAIActive:false,
  poiWalkLevel:0,poiWalkX:4,poiWalkZ:5,poiWalkFacing:0,poiWalkViewX:4,poiWalkViewZ:5,
  localStorage:{getItem:()=>raw??null,setItem(_k,v){raw=v;writes++}},world:[],poiWalkCanStep:()=>true,
  isFloor:()=>true,poiWalkAvatar(){},toast(){},terrainY:()=>0,poiSound(){},poiCombatHud(){},poiDamageNumber(){},
  poiPlayerHP:100,POI_PLAYER_ATTACK:20,POI_PLAYER_MAX_HP:100,POI_MONSTER_STATS:{monsterSlime:{attack:6}}});
 vm.runInContext(span('const POI_HOTBAR_KEY=','function poiResetCombat(')+span('const POI_PLAYER_WEAPON_PROFILES=','function poiPlayerWeaponCancel(')+span('function poiMobHitPlayer(','function poiMineEarlyMayMove('),c);
 return {c,raw:()=>JSON.parse(raw),writes:()=>writes};
}
test('only a fresh kit starts with explicit empty armor; old saves keep all four legacy pieces without write',()=>{
 const a=setup(),b=setup({version:1,weapon:null,potions:0});
 assert.deepEqual({...a.c.poiHotbarRead().worn},{head:null,torso:null,legs:null,feet:null});assert.equal(a.writes(),0);
 assert.deepEqual({...b.c.poiArmorWorn(b.c.poiHotbarRead())},{head:'starterCap',torso:'starterTunic',legs:'starterTrousers',feet:'starterBoots'});
 for(const [id,name] of [['starterCap','キャップ'],['starterTunic','布の服'],['starterTrousers','布のズボン'],['starterBoots','スニーカー']])assert.equal(b.c.poiInventoryItemName(id),name);
 assert.equal(b.writes(),0);
 assert(a.c.poiEconomyWrite({...a.c.poiHotbarRead(),gold:1}));
 assert.deepEqual(setup(a.raw()).raw(),a.raw());
 assert.equal(setup(a.raw()).c.poiArmorWorn(setup(a.raw()).c.poiHotbarRead()).torso,null);
});
test('new role clothes are recognized, equip and reload exactly, and really reduce incoming damage with durability wear',()=>{
 for(const [type,name,part] of gear){
  const f=setup(),{c}=f;
  assert.equal(c.poiArmorCategory(type),part);assert.equal(c.poiInventoryItemName(type),name);
  assert(c.poiArmorDefense(type)>0);assert(c.poiEquipmentPrice(type)>0);
  const k=c.poiHotbarRead(),{slots,accepted}=c.poiInventoryAccept(k,type,1,{type,count:1,durability:10});
  assert.equal(accepted,1);assert(c.poiEconomyWrite(c.poiInventoryEdited(k,slots)));assert(c.poiEquipArmorFromBag(0).ok);
  const g=setup(f.raw()),q=g.c;
  assert.equal(q.poiArmorWorn(q.poiHotbarRead())[part],type);assert.equal(q.poiArmorSnapshot()[part].durability,10);
  q.poiMobHitPlayer({type:'monsterSlime'},12);
  assert.equal(q.poiPlayerHP,100-q.poiPlayerDamageAfterArmor(6));assert.equal(q.poiArmorSnapshot()[part].durability,9);
  assert.match(q.poiItemDetailDescription({type,count:1}),/防御力/);
 }
 assert.equal(setup().c.poiPlayerDamageAfterArmor(6),6);
 assert.equal(setup({version:1,weapon:null,potions:0}).c.poiPlayerDamageAfterArmor(6),4);
});
test('occupational tools are saved real combat profiles, unique carried weapons with accurate stat text',()=>{
 for(const [type,name] of tools){
  const f=setup(),{c}=f,k=c.poiHotbarRead();
  assert.equal(c.poiInventoryStack(type),1);assert.equal(c.poiInventoryItemName(type),name);
  const {slots,accepted}=c.poiInventoryAccept(k,type,1,{type,count:1,durability:7});assert.equal(accepted,1);
  assert(c.poiEconomyWrite(c.poiInventoryEdited(k,slots)));c.poiHotbarUse(2);assert.equal(c.poiEquippedWeapon(),type);
  const profile=c.poiPlayerWeaponProfile(type);assert.equal(c.poiPlayerAttackDamage(),profile.damage);
  assert(profile.damage!==c.poiPlayerAttackDamage(null));assert(profile.range>=1&&profile.ready>0&&c.poiEquipmentPrice(type)>0);
  assert(c.poiEquipmentSpendWeapon(type));assert.equal(setup(f.raw()).c.poiInventorySnapshot().hotbar[2].durability,6);
  assert.match(c.poiItemDetailDescription({type,count:1}),/攻撃力.*射程.*参考価格/);
 }
});
