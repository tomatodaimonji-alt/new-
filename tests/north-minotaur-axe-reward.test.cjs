const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), vm=require('node:vm');
const src=fs.readFileSync(process.env.GAME||require('node:path').join(__dirname,'../world-editor.html'),'utf8');
const cut=(start,end)=>src.slice(src.indexOf(start),src.indexOf(end,src.indexOf(start)));
const axe='equipNorthMinotaurAxe',dropId='north-minotaur-axe',spawn='northFort.minotaur';
const boss={type:'monsterNorthMinotaur',x:64,z:13,y:-1};
const data=()=>({weapon:null,potions:0,slots:[]});
const expected={id:dropId,type:axe,x:64,z:13,y:-1,durability:180};
function fixture(kit=data()){
 const c=vm.createContext({kit,testNow:120,writeAllowed:true,bagFull:false,writes:0,sounds:[],boss,
  facilitySite:{id:'base',northFort:{boss}},poiWalkActive:true,pineAIActive:false,poiWalkLevel:-1,
  poiHotbarRead:()=>c.kit,poiTownClockRead:()=>{},poiTownClockSave:()=>true,poiTownClockSnapshot:()=>({absoluteMinute:c.testNow}),
  poiEconomyWrite:next=>{c.writes++;if(!c.writeAllowed)return false;c.kit=next;return true},
  poiSound:(...args)=>c.sounds.push(args),poiEconomyRefresh:()=>{},poiMessagePush:()=>true,
  poiInventoryOrdinarySlots:kit=>kit.slots||[],poiAnyChestHas:(kit,type)=>kit.chest?.some(o=>o.type===type),
  poiInventoryAllowed:()=>true,poiInventoryAccept:(kit,type,count,source)=>({slots:c.bagFull?kit.slots:[...kit.slots,{type,count,durability:source.durability}],accepted:c.bagFull?0:1}),
  poiInventoryEdited:(kit,slots)=>({...kit,slots}),validPos:(x,z)=>x>=0&&x<200&&z>=0&&z<200,
  POI_KNIFE_DURABILITY:40,world:[]});
 vm.runInContext(cut('const POI_DUNGEON_COOLDOWN','function poiDungeonArrive')+
 cut('const POI_GAME_WEAPON_NAMES','const POI_STARTER_ARMOR=')+
 cut('const POI_EQUIPMENT_DURABILITY=','function poiEquipmentDurabilityPercent')+
 cut('function poiHotbarWeaponForType','function poiInventoryCellName')+
 cut('// BEGIN ARMED FOES','// END ARMED FOES'),c);
 return c;
}
const call=(c,expr)=>vm.runInContext(expr,c), plain=o=>JSON.parse(JSON.stringify(o));
test('authored kill saves full axe and cooldown atomically; no clone, auto-equip or repeat after cooldown',()=>{
 const c=fixture();
 assert.equal(call(c,`poiHotbarWeaponForType('${axe}')`),axe);
 assert.equal(call(c,`poiInventoryItemName('${axe}')`),'ミノタウロスの長柄斧');
 assert.equal(call(c,'poiDungeonRememberDefeat({...boss,x:63},{hp:0})'),false);
 assert.equal(call(c,'poiDungeonRememberDefeat(boss,{hp:1})'),false);assert.equal(c.writes,0);
 c.writeAllowed=false;assert.equal(call(c,'poiDungeonRememberDefeat(boss,{hp:0})'),false);assert.deepEqual(c.kit,data());assert.deepEqual(c.sounds,[]);
 c.writeAllowed=true;assert.equal(call(c,'poiDungeonRememberDefeat(boss,{hp:0})'),true);assert.equal(c.writes,2);
 assert.equal(c.kit.northMinotaurAxeAwarded,true);assert.equal(c.kit.dungeonPopulation.dead[spawn],120);
 assert.deepEqual(plain(c.kit.armedDrops),[expected]);assert.equal(c.kit.weapon,null);
 assert.equal(call(c,'poiDungeonRememberDefeat(boss,{hp:0})'),false);
 c.testNow+=7*1440;assert.equal(call(c,'poiDungeonRememberDefeat(boss,{hp:0})'),true);
 assert.deepEqual(plain(c.kit.armedDrops),[expected]);assert.equal(c.sounds.length,1);
});
test('exact saved drop decode, full bag/floor/failed save keep pending, pickup only once',()=>{
 const c=fixture();call(c,'poiDungeonRememberDefeat(boss,{hp:0})');
 c.raw=[{...expected,z:14},expected,{...expected,y:0},expected];
 c.kit.armedDrops=call(c,'poiArmedDropDecode(raw)');
 assert.deepEqual(plain(c.kit.armedDrops),[expected]);
 c.poiWalkLevel=0;assert.equal(call(c,'poiArmedPickup(64,13)'),false);
 c.poiWalkLevel=-1;c.bagFull=true;assert.equal(call(c,'poiArmedPickup(64,13)'),false);
 c.bagFull=false;c.writeAllowed=false;assert.equal(call(c,'poiArmedPickup(64,13)'),false);
 assert.deepEqual(plain(c.kit.armedDrops),[expected]);
 c.writeAllowed=true;assert.equal(call(c,'poiArmedPickup(64,13)'),true);
 assert.equal(call(c,'poiArmedPickup(64,13)'),false);assert.equal(c.kit.northMinotaurAxeAwarded,true);
 assert.deepEqual(plain(c.kit.slots),[{type:axe,count:1,durability:180}]);assert.equal(c.kit.weapon,null);
 c.testNow+=7*1440;call(c,'poiDungeonRememberDefeat(boss,{hp:0})');assert.equal(c.kit.armedDrops.length,0);
});
test('legacy well-formed defeat history recovers one pickup; malformed/no history never gifts it',()=>{
 const c=fixture();c.saved={version:1,dead:{[spawn]:100}};
 c.up=call(c,'poiNorthMinotaurRewardRestore(kit,saved, testNow)');
 assert.equal(c.up.northMinotaurAxeAwarded,true);assert.deepEqual(plain(c.up.armedDrops),[expected]);
 assert.equal(call(c,'poiNorthMinotaurRewardRestore(up,saved,testNow)'),c.up);
 c.testNow+=7*1440;assert.equal(call(c,'poiNorthMinotaurRewardRestore(kit,saved,testNow)').armedDrops.length,1);
 c.testNow=10;assert.equal(call(c,'poiNorthMinotaurRewardRestore(kit,saved,testNow)'),c.kit);
 assert.equal(call(c,'poiNorthMinotaurRewardRestore(kit,null,testNow)'),c.kit);
 c.kit.slots=[{type:axe,count:1}];c.testNow=120;
 const owned=call(c,'poiNorthMinotaurRewardRestore(kit,saved,testNow)');
 assert.equal(owned.northMinotaurAxeAwarded,true);assert.equal(owned.armedDrops,undefined);
});
test('all 12 existing kinds plus the reserved unique reward survive reloading together',()=>{
 const c=fixture();
 c.raw=call(c,`[
  ...Object.entries(POI_ARMED_FOES).map(([id,v])=>({...v,id,durability:1})),
  {id:'knight-armor',type:'armorIronTorso',x:106,z:78,y:-1,durability:1},
  {id:'chapel-mace',type:'equipStoneMace',x:79,z:78,y:-1,durability:1},
  {id:'mage-wand',type:'fireWand',x:40,z:88,y:0,charges:2},
  {id:POI_NORTH_WATCH_GUARD_LOOT,type:'equipBoneSword',x:51,z:2,y:0,durability:1},
  ...Object.values(POI_OTHERWORLD_EAST_LOOT).map(([id,type])=>({id,type,x:106,z:89,y:-1,durability:1}))
 ]`);
 assert.equal(call(c,'poiArmedDropDecode(raw)').length,12);
 c.raw.push(expected);
 const out=plain(call(c,'poiArmedDropDecode(raw)'));
 assert.equal(out.length,13);assert.deepEqual(out[12],expected);
 c.raw=[...Array(12).fill(null),c.raw[0]];
 assert.equal(call(c,'poiArmedDropDecode(raw)'),null,'ordinary decode keeps its original 12-record bound');
});
test('actual hotbar JSON survives an old defeat upgrade, full bag, reload, equip and new game',()=>{
 function storage(raw){
  let mem=raw===null?null:JSON.stringify(raw);
  const c=vm.createContext({boss,MAX_MAP:128,facilitySite:{id:'base',northFort:{boss}},poiWalkActive:true,pineAIActive:false,
   poiWalkLevel:-1,poiWalkX:64,poiWalkZ:13,poiWalkFacing:0,world:[],poiWalkCanStep:()=>true,validPos:()=>true,
   poiHotbarRender(){},poiWalkAvatar(){},poiShopIsOpen:()=>false,toast(){},isFloor:()=>true,
   poiTownClockRead:()=>{},poiTownClockSave:()=>true,poiTownClockSnapshot:()=>({absoluteMinute:120}),
   localStorage:{getItem:()=>mem,setItem(_k,v){mem=v}}});
  vm.runInContext(cut('const POI_HOTBAR_KEY=','function poiHotbarSwordIcon('),c);
  return {c,save:()=>JSON.parse(mem)};
 }
 const old={version:1,weapon:null,potions:9,gold:13,dungeonPopulation:{version:1,dead:{[spawn]:100},questEntries:{}}};
 const h=storage(old);
 assert.deepEqual(h.save(),old,'read has no storage side effects');
 assert.deepEqual(plain(call(h.c,'poiHotbarRead().armedDrops')),[expected]);
 assert.equal(call(h.c,'poiHotbarSave()'),true);assert.equal(h.save().northMinotaurAxeAwarded,true);
 assert.deepEqual(h.save().armedDrops,[expected]);
 const full=storage({...h.save(),slots:call(h.c,"Array.from({length:POI_HOTBAR_SIZE+POI_BAG_SAVED},(_,i)=>i===0?{type:'equipWoodSword',count:1}:{type:'healingHerb',count:POI_HOTBAR_POTION_MAX})")});
 assert.equal(call(full.c,'poiArmedPickup(64,13)'),false);assert.deepEqual(full.save().armedDrops,[expected]);
 const fresh=storage(h.save());
 assert.equal(call(fresh.c,'poiArmedPickup(64,13)'),true);
 assert.equal(fresh.save().armedDrops,undefined);assert.equal(fresh.save().weapon,null);
 assert.equal(fresh.save().gold,13);assert.equal(fresh.save().northMinotaurAxeAwarded,true);
 const equipped=storage({...fresh.save(),weapon:axe});
 assert.equal(call(equipped.c,'poiHotbarRead().weapon'),axe);
 assert.deepEqual(plain(call(equipped.c,`poiInventorySlots(poiHotbarRead()).find(c=>c?.type==='${axe}')`)),{type:axe,count:1,durability:180});
 assert.equal(call(equipped.c,'poiArmedPickup(64,13)'),false);
 assert.equal(call(storage(null).c,'poiHotbarRead().northMinotaurAxeAwarded'),undefined);
});
