const {test}=require('node:test'),a=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const parse=v=>JSON.parse(JSON.stringify(v));
const herb=n=>({type:'healingHerb',count:n}),food=n=>({type:'cannedFood',count:n});
const mace={type:'equipStoneMace',count:1,durability:57},wand={type:'fireWand',count:1,charges:2};
function run({chest,bag=[null,null,null,null],fits=true,allow=true,key='mineTreasureChest',freshWorn={torso:null},other=[]}){
 let kit={slots:[{type:'equipWoodSword',count:1},...bag,{type:'lockedProbe',count:1}],weapon:'equipWoodSword',gold:9,
  [key]:{version:1,slots:chest},other:{version:1,slots:other}};
 const old=parse(kit),calls=[];
 const c=vm.createContext({POI_HOTBAR_SIZE:1,POI_BAG_UNLOCKED:4,POI_INVENTORY_SWORD:'equipWoodSword',poiChestActiveKey:key,
  poiChestTxnAllowed:()=>allow,poiInventorySlots:k=>k.slots,poiHotbarRead:()=>kit,
  poiStorageActionResult:reason=>({ok:!reason,reason}),poiInventoryStack:t=>t==='healingHerb'||t==='cannedFood'?8:1,
  poiInventorySanitizeCell:x=>x?.count>0?x:null,poiHotbarWeaponForType:t=>t?.startsWith('equip')?t:null,
  poiArmorCategory:t=>t?.startsWith('armor')?'torso':null,poiArmorWorn:()=>freshWorn,poiRepeatableMonsterWeapon:t=>t==='equipStoneMace',
  poiAnyChestHas:(k,t)=>[k[key],k.other].some(v=>v?.slots?.some(x=>x?.type===t)),
  poiInventoryEdited:(k,slots)=>({...k,slots}),
  poiEconomyWrite:k=>{calls.push('save');if(fits)kit=k;return fits},poiEconomyRefresh:()=>calls.push('refresh'),
  poiSound:(kind,type)=>calls.push([kind,type]),toast:s=>calls.push(s)});
 const first=html.indexOf('function poiChestTakeAll(');
 a(first>=0,'bulk chest transaction must exist');
 vm.runInContext(html.slice(first,html.indexOf('function poiStorageIndexExists(',first)),c);
 const status=parse(c.poiChestTakeAll());
 return {status,kit:parse(kit),old,calls};
}
test('merges existing bag stacks, saves atomically and preserves durability, charges and shortcut',()=>{
 const t=run({chest:[herb(4),mace,wand],bag:[herb(6),null,null,null]});
 a.equal(t.status.ok,true);a.equal(t.status.moved,6);a.equal(t.status.remaining,0);
 a.deepEqual(t.kit.slots,[t.old.slots[0],herb(8),herb(2),mace,wand,t.old.slots.at(-1)]);
 a.deepEqual(t.kit.mineTreasureChest.slots,[null,null,null]);a.equal(t.kit.weapon,t.old.weapon);a.equal(t.kit.gold,9);
 a.equal(t.calls.filter(x=>x==='save').length,1);a.equal(t.calls.filter(x=>Array.isArray(x)&&x[0]==='chest-pickup').length,1);
});
test('merges when full, keeps overflow and all non-stackables intact, and writes neither side if commit fails',()=>{
 const c={chest:[herb(5),mace,food(2)],bag:[herb(7),food(8),food(8),food(8)]};
 const partial=run(c);a.deepEqual(partial.kit.mineTreasureChest.slots,[herb(4),mace,food(2)]);a.equal(partial.status.remaining,7);
 const failed=run({...c,fits:false});a.deepEqual(failed.kit,failed.old);a.equal(failed.status.reason,'storage');a(!failed.calls.includes('refresh'));
 const closed=run({...c,allow:false});a.deepEqual(closed.kit,closed.old);a.equal(closed.calls.length,0);
 const full=run({...c,bag:Array(4).fill(food(8))});a.deepEqual(full.kit,full.old);a.equal(full.status.reason,'full');a(!full.calls.includes('save'));
});
