const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const html=fs.readFileSync(process.env.QA_HTML||'world-editor.html','utf8');
const a=html.indexOf('const POI_HOTBAR_KEY='),b=html.indexOf('function poiResetCombat(',a);
const plain=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
function launch(raw,{x=109,z=88,y=-1,id='base'}={}){
 let writes=0;
 const c={MAX_MAP:128,POI_PLAYER_MAX_HP:100,poiPlayerHP:100,poiWalkActive:true,pineAIActive:false,poiWalkX:x,poiWalkZ:z,poiWalkLevel:y,poiWalkFacing:1,
  facilitySite:{id,otherworld:{expansion:{guard:[{x:109,z:88,y:-1,type:'monsterSkelArcher'},{x:120,z:82,y:-1,type:'monsterSkelLongStaff'}]}}},world:[],
  document:{querySelectorAll:()=>[]},$(){return null},isFloor:t=>t==='stone',poiWildExterior:()=>true,validPos:()=>true,poiWalkCanStep:()=>true,
  poiWalkAvatar(){},poiSound(){},toast(){},localStorage:{getItem:()=>raw,setItem(k,v){assert.equal(k,'world-workshop-hotbar-v1');raw=v;writes++}}};
 vm.createContext(c);vm.runInContext(html.slice(a,b),c);
 return {c,writes:()=>writes,raw:()=>raw};
}
const bow='equipWoodBow',staff='equipLongStaff';
function seed(weapon=bow){
 const slots=Array(27).fill(null);
 slots[0]={type:'equipWoodSword',count:1,durability:90};slots[2]={type:weapon,count:1,durability:17};
 slots[9]={type:'cannedFood',count:2};
 return {version:1,weapon,potions:0,gold:40,goldHotbarSlot:8,quests:['mine-survey'],weaponDurabilityVersion:2,slots};
}
function expectCore(c,weapon,condition,gold=40){
 const k=c.poiHotbarRead();
 assert.deepEqual(plain(k.slots[0]),{type:'equipWoodSword',count:1,durability:90});
 assert.deepEqual(plain(k.slots[9]),{type:'cannedFood',count:2});
 assert.equal(k.slots.find(s=>s?.type===weapon)?.durability,condition);
 assert.equal(k.gold,gold);assert.equal(k.goldHotbarSlot,8);
 assert.deepEqual(plain(k.quests),['mine-survey']);
}
test('v202 repro: ordinary worn bow, exact east archer replacement, reload, herb purchase, reload again',()=>{
 let f=launch(JSON.stringify(seed())),c=f.c;
 assert.equal(c.poiInventoryDrop(2).ok,true);
 const archer={x:109,z:88,y:-1,type:'monsterSkelArcher'};
 assert.equal(c.poiArmedEnemyLoot(archer,{x:109,z:88,hp:0},()=>.8),true);
 assert.equal(c.poiArmedPickup(109,88),true);
 const stored=JSON.parse(f.raw());
 assert.equal(stored.drops[0].durability,17);
 assert.equal(stored.armedDrops,undefined,'collected source loot is not an ordinary drop');
 expectCore(c,bow,70);
 f=launch(f.raw());c=f.c;assert.equal(f.writes(),0);
 expectCore(c,bow,70);
 assert.equal(c.poiInventoryPickup(110,88),false,'cannot carry two of one non-starter weapon');
 assert.equal(f.writes(),0);assert.equal(c.poiHotbarRead().drops[0].durability,17);
 c.poiWalkLevel=0;
 assert.equal(c.poiEconomyBuyPotion().ok,true);
 assert.equal(f.writes(),1);assert.equal(c.poiHotbarRead().potions,1);
 f=launch(f.raw());expectCore(f.c,bow,70,34);
 assert.equal(f.c.poiHotbarRead().potions,1);assert.equal(f.c.poiHotbarRead().drops[0].durability,17);
});
test('repeatable staff sources keep distinct ordinary drops; can choose one, not both while one is held',()=>{
 let f=launch(JSON.stringify(seed(staff)),{x:120,z:82}),c=f.c;
 const source={type:'monsterSkelLongStaff',x:120,z:82,y:-1};
 assert.equal(c.poiInventoryDrop(2).ok,true);
 assert.equal(c.poiArmedEnemyLoot(source,{x:120,z:82,hp:0},()=>.4),true);
 assert.equal(c.poiArmedPickup(120,82),true);
 const acquired=c.poiHotbarRead().slots.findIndex(s=>s?.type===staff);
 assert.ok(acquired>=0);
 c.poiWalkFacing=2;
 assert.equal(c.poiInventoryDrop(acquired).ok,true);
 assert.equal(c.poiArmedEnemyLoot(source,{x:120,z:82,hp:0},()=>.8),true);
 f=launch(f.raw(),{x:120,z:82});c=f.c;
 assert.deepEqual(plain(c.poiHotbarRead().drops.map(d=>[d.x,d.z,d.durability])),[[121,82,17],[120,83,33]]);
 assert.equal(c.poiHotbarRead().armedDrops[0].id,'otherworld-east-staff');
 assert.equal(c.poiInventoryPickup(120,83),true);
 assert.equal(c.poiInventoryPickup(121,82),false);
 assert.equal(c.poiArmedPickup(120,82),false);
 f=launch(f.raw(),{x:120,z:82});c=f.c;expectCore(c,staff,33);
 assert.equal(c.poiHotbarRead().drops[0].durability,17);
 assert.equal(c.poiHotbarRead().armedDrops,undefined,'the unpickable enemy duplicate was removed after acquiring another staff');
});
test('a chest replacement and independently dropped bow both survive reload',()=>{
 const initial=seed();const replacement=initial.slots[2];
 initial.weapon=null;initial.slots[2]=null;
 initial.kitchenChest={version:1,slots:[replacement,...Array(17).fill(null)]};
 initial.drops=[{type:bow,x:110,z:88,y:-1,durability:55}];
 let f=launch(JSON.stringify(initial)),c=f.c;
 assert.equal(c.poiHotbarRead().kitchenChest.slots[0].durability,17);
 assert.equal(c.poiHotbarRead().drops[0].durability,55);
 assert.equal(c.poiInventoryPickup(110,88),false,'stored weapon counts toward the owned-copy limit');
 assert.equal(f.writes(),0);
});
test('starter sword and kitchen knife retain previous duplicate protections',()=>{
 const f=launch(JSON.stringify(seed())),c=f.c;
 for(const type of ['equipWoodSword','kitchenKnife']){
  const piles=[{type,x:110,z:88,y:-1,durability:17},{type,x:111,z:88,y:-1,durability:18}];
  assert.equal(c.poiInventoryReadDrops(piles).length,1);
 }
});
function replacedBowSave(){
 const f=launch(JSON.stringify(seed())),c=f.c;
 assert.equal(c.poiInventoryDrop(2).ok,true);
 const archer={x:109,z:88,y:-1,type:'monsterSkelArcher'};
 assert.equal(c.poiArmedEnemyLoot(archer,{x:109,z:88,hp:0},()=>.8),true);
 assert.equal(c.poiArmedPickup(109,88),true);
 return f.raw();
}
test('first armor-wear write after affected reload preserves all item slots and the ordinary bow',()=>{
 const affected=replacedBowSave();
 let f=launch(affected),c=f.c;
 assert.equal(c.poiEquipmentWearArmor(),true);
 assert.equal(f.writes(),1);assert.equal(JSON.parse(f.raw()).wornDurability.torso,61);
 assert.deepEqual(JSON.parse(f.raw()).slots,JSON.parse(affected).slots);
 f=launch(f.raw());expectCore(f.c,bow,70);
 assert.equal(f.c.poiHotbarRead().drops[0].durability,17);
});
test('first 3G coin collection after affected reload preserves all slots and the ordinary bow',()=>{
 const affected=replacedBowSave();
 let f=launch(affected,{x:104,z:86,y:0}),c=f.c;
 c.poiEconomyDrop({type:'monsterSlime',y:0},{x:104,z:86,wildSpawn:true,hp:0});
 assert.equal(c.poiEconomyCollect(104,86),true);
 assert.equal(f.writes(),1);assert.equal(JSON.parse(f.raw()).gold,43);
 assert.deepEqual(JSON.parse(f.raw()).slots,JSON.parse(affected).slots);
 f=launch(f.raw());expectCore(f.c,bow,70,43);
 assert.equal(f.c.poiHotbarRead().drops[0].durability,17);
});

test('an equipped wooden bow prevents an automatic duplicate on enemy defeat, but replacing it after discarding still works',()=>{
 const f=launch(JSON.stringify(seed())),c=f.c;
 const archer={type:'monsterSkelArcher',x:109,z:88,y:-1},defeated={x:109,z:88,hp:0};
 assert.equal(c.poiArmedEnemyLoot(archer,defeated,()=>.8),false);
 assert.equal(f.writes(),0);
 assert.equal(c.poiInventoryDrop(2).ok,true);
 assert.equal(c.poiArmedEnemyLoot(archer,defeated,()=>.8),true);
 assert.equal(c.poiArmedPickup(109,88),true);
 assert.equal(c.poiHotbarRead().drops[0].durability,17,'manually dropped original remains a distinct item');
});
test('old duplicate automatic equipment is removed from the live ground on read, without rewriting; genuine ground loot persists',()=>{
 const initial=seed(),held=initial.slots[2];initial.weapon=null;initial.slots[2]=null;
 initial.kitchenChest={version:1,slots:[held,...Array(17).fill(null)]};
 initial.drops=[{type:bow,x:110,z:88,y:-1,durability:55}];
 initial.armedDrops=[{id:'otherworld-east-archer',type:bow,x:109,z:88,y:-1,durability:23},
  {id:'otherworld-east-staff',type:staff,x:120,z:82,y:-1,durability:46}];
 const f=launch(JSON.stringify(initial)),c=f.c,k=c.poiHotbarRead();
 assert.deepEqual(plain(c.poiArmedDrawList(k)),[initial.armedDrops[1]]);
 assert.equal(f.writes(),0);
 assert.equal(k.kitchenChest.slots[0].durability,17);
 assert.equal(k.drops[0].durability,55);
 c.poiWalkLevel=0;assert(c.poiEconomyBuyPotion().ok);
 const reloaded=launch(f.raw());assert.deepEqual(plain(reloaded.c.poiHotbarRead().armedDrops),[initial.armedDrops[1]]);
});
test('a genuinely new bow stays on the ground if all usable slots are full',()=>{
 const initial=seed();initial.weapon=null;initial.goldHotbarSlot=undefined;
 initial.slots=initial.slots.map((c,i)=>i===0?c:{type:'cannedFood',count:1});
 const f=launch(JSON.stringify(initial),{x:105,z:86,y:0}),c=f.c;
 const archer={type:'monsterSkelArcher',x:105,z:86,y:0},defeated={x:104,z:86,hp:0};
 assert.equal(c.poiArmedEnemyLoot(archer,defeated,()=>.8),true);
 assert.equal(c.poiArmedPickup(104,86),false);
 const drops=plain(c.poiHotbarRead().armedDrops);
 assert.equal(drops[0].type,bow);
 assert.deepEqual(plain(launch(f.raw(),{x:105,z:86,y:0}).c.poiHotbarRead().armedDrops),drops);
});
test('the authored watch guard still unlocks after defeat if its weapon is already owned, without a loot sound or duplicate',()=>{
 const f=launch(JSON.stringify(seed('equipBoneSword')),{x:109,z:88,y:0}),c=f.c,sounds=[];
 const guard={type:'monsterSkelWarrior',x:109,z:88,y:0};
 c.facilitySite.northTrail={watchPost:{guard}};
 c.poiSound=(...args)=>sounds.push(args);
 assert.equal(c.poiArmedEnemyLoot(guard,{x:109,z:88,hp:0},()=>.8),true);
 assert.equal(f.writes(),1);
 const stored=JSON.parse(f.raw());assert.equal(stored.northWatchPostGuardLoot,true);
 assert.equal(stored.armedDrops,undefined);assert.deepEqual(sounds,[]);
 assert.equal(c.poiArmedEnemyLoot(guard,{x:109,z:88,hp:0},()=>.8),false);
 assert.equal(f.writes(),1);
 const reloaded=launch(f.raw(),{x:109,z:88,y:0});assert.equal(reloaded.c.poiHotbarRead().northWatchPostGuardLoot,true);
});
