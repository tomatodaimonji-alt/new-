const {readFileSync}=require('node:fs');
const assert=require('node:assert/strict');
const test=require('node:test');
const vm=require('node:vm');
const html=readFileSync(process.env.HTML||'world-editor.html','utf8');
const extract=(from,to)=>{const a=html.indexOf(from),b=html.indexOf(to,a+from.length);assert(a>=0&&b>a,from);return html.slice(a,b)};
test('facility uses the same default directional pad, center button, and game-region keyboard as ordinary play',()=>{
 assert.doesNotMatch(html,/#app\.facilitySession #poiWalkPad|#app\.facilitySession #poiWalkAction/);
 assert.match(html,/id="poiWalkAction"[^>]*>攻撃<br>決定/);
 assert.match(html,/facilitySite&&e\.target[\s\S]{0,80}\.closest(?:\?\.)?\('button,a\[href\],summary'\)/);
});
test('facility center attack can hit current-floor monsters without writing any save',()=>{
 let now=810,saveCalls=0,avatarCalls=0,damages=[];
 const other={hp:55,x:3,z:1},active={hp:55,x:3,z:1};
 const ctx=vm.createContext({poiChestIsOpen:()=>false,poiKitchenChestReachable:()=>false,poiShopIsOpen:()=>false,poiShopOpen:()=>false,poiWalkActive:true,facilitySite:{},poiWalkLevel:1,
  poiWalkActionWeapon:null,poiEquippedWeapon:()=>null,poiPlayerAttackDamage:()=>20,
  poiWalkFacing:0,poiWalkX:3,poiWalkZ:2,poiAttackReady:0,poiWalkActionStarted:0,
  performance:{now:()=>now},poiWalkAvatar:()=>avatarCalls++,poiSound(){},toast(){},terrainY:()=>0,
  poiMonsterStates:new Map([[{y:0},other],[{y:1},active]]),POI_PLAYER_ATTACK:20,
  poiDamageNumber:(...d)=>damages.push(d),poiMonsterMeshDirty:false,pineGameActive:false,
  pineGameSave(){saveCalls++}});
 const js=extract('function poiMonsterAt(', 'function poiMonsterCanMove(')+
  extract('function poiPlayerDamageTarget(', 'function poiPlayerWeaponResolve(')+extract('function poiWalkAction(', 'function poiWalkReset(');
 vm.runInContext(js+'\npoiWalkAction();',ctx);
 assert.equal(avatarCalls,1);assert.equal(other.hp,55);assert.equal(active.hp,35);
 assert.equal(damages[0][2],3.2);assert.equal(saveCalls,0);
 vm.runInContext('poiWalkAction();',ctx);
 assert.equal(active.hp,35,'cooldown must be shared');
 now+=301;
 vm.runInContext('poiWalkAction();',ctx);
 assert.equal(active.hp,15);
 assert.equal(saveCalls,0);
});

test('wood contact uses the captured equipment and no synthetic swing before contact',()=>{
 const calls=[],actor={hp:50,x:4,z:2};
 let chosen='equipWoodSword';
 const ctx=vm.createContext({poiChestIsOpen:()=>false,poiKitchenChestReachable:()=>false,poiShopIsOpen:()=>false,poiShopOpen:()=>false,poiWalkActive:true,facilitySite:{id:'base'},poiWalkLevel:0,
  poiWalkActionWeapon:null,poiEquippedWeapon:()=>chosen,poiPlayerAttackDamage:weapon=>weapon==='equipWoodSword'?28:20,
  poiWalkFacing:1,poiWalkX:3,poiWalkZ:2,poiAttackReady:0,poiWalkActionStarted:0,
  performance:{now:()=>500},poiWalkAvatar:()=>{chosen=null},poiSound:(...args)=>calls.push(args),
  poiMonsterAt:()=>[{},actor],toast(){},terrainY:()=>0,poiDamageNumber(){},poiMonsterMeshDirty:false,pineGameActive:false});
 const js=extract('function poiPlayerDamageTarget(', 'function poiPlayerWeaponResolve(')+extract('function poiWalkAction(', 'function poiWalkReset(');
 vm.runInContext(js+'\npoiWalkAction();',ctx);
 assert.deepEqual(calls,[['hit','equipWoodSword',false]]);
 assert.equal(actor.hp,22);
});

test('only a lethal contact requests the breakup cue; an empty swing and a rejected repeat do not',()=>{
 const calls=[],actor={hp:35,x:4,z:2},obj={type:'monsterSlime'};
 let now=500,broken=0;
 const ctx=vm.createContext({poiChestIsOpen:()=>false,poiKitchenChestReachable:()=>false,poiShopIsOpen:()=>false,poiShopOpen:()=>false,poiWalkActive:true,facilitySite:{id:'base'},poiWalkLevel:0,
  poiWalkActionWeapon:null,poiEquippedWeapon:()=>null,poiPlayerAttackDamage:()=>20,
  poiWalkFacing:1,poiWalkX:3,poiWalkZ:2,poiAttackReady:0,poiWalkActionStarted:0,
  performance:{now:()=>now},poiWalkAvatar(){},poiSound:(...args)=>calls.push(args),
  poiMonsterAt:()=>actor.hp?[obj,actor]:null,poiMonsterBreak:()=>broken++,
  toast(){},terrainY:()=>0,poiDamageNumber(){},poiMonsterMeshDirty:false,pineGameActive:false});
 vm.runInContext(extract('function poiPlayerDamageTarget(', 'function poiPlayerWeaponResolve(')+extract('function poiWalkAction(', 'function poiWalkReset('),ctx);
 for(const ms of [500,600,820,1200]){now=ms;vm.runInContext('poiWalkAction()',ctx);}
 assert.deepEqual(calls,[['attack',null],['hit',null,false],['attack',null],['hit',null,true],['attack',null]]);
 assert.equal(actor.hp,0);assert.equal(broken,1);
});

test('wood empty swing keeps air only; a finishing contact requests wood then recorded defeat only',()=>{
 const calls=[],actor={hp:15,x:4,z:2},obj={type:'monsterSlime'};
 let now=500,target=null,breaks=0;
 const ctx=vm.createContext({poiChestIsOpen:()=>false,poiKitchenChestReachable:()=>false,poiShopIsOpen:()=>false,poiShopOpen:()=>false,poiWalkActive:true,facilitySite:{id:'base'},poiWalkLevel:0,
  poiWalkActionWeapon:null,poiEquippedWeapon:()=>'equipWoodSword',poiPlayerAttackDamage:()=>28,
  poiWalkFacing:1,poiWalkX:3,poiWalkZ:2,poiAttackReady:0,poiWalkActionStarted:0,
  performance:{now:()=>now},poiWalkAvatar(){},poiSound:(...args)=>calls.push(args),
  poiMonsterAt:()=>target,poiMonsterBreak:()=>breaks++,toast(){},terrainY:()=>0,poiDamageNumber(){},
  poiMonsterMeshDirty:false,pineGameActive:false});
 vm.runInContext(extract('function poiPlayerDamageTarget(', 'function poiPlayerWeaponResolve(')+extract('function poiWalkAction(', 'function poiWalkReset('),ctx);
 vm.runInContext('poiWalkAction()',ctx);now=820;target=[obj,actor];vm.runInContext('poiWalkAction()',ctx);
 assert.deepEqual(calls,[['attack','equipWoodSword'],['hit','equipWoodSword',true]]);
 assert.equal(actor.hp,0);assert.equal(breaks,1);
});
