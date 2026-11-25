const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(x,y)=>{const i=h.indexOf(x),j=h.indexOf(y,i+x.length);a(i>=0&&j>i,x);return h.slice(i,j)};
function init(){
 const nodes=new Map(),c={poiArmorCategory:t=>t==='armorOrvasWaistcloth'?'legs':null,poiArmorDefense:()=>.75,
  poiPlayerWeaponProfile:t=>t==='equipIronSword'?{damage:30}:t==='fireWand'?{damage:34}:null,
  poiHotbarWeaponForType:()=>null,poiPlayerWeaponGrades:()=>({speed:3,reach:2}),poiEquipmentDurabilityMax:t=>({armorOrvasWaistcloth:96,equipIronSword:180})[t]||0,
  poiEquipmentDurabilityPercent:()=>45,poiInventoryStack:()=>1,POI_FIRE_WAND_MAX_CHARGES:5,$:id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id)}};
 vm.createContext(c);
 vm.runInContext(cut('function poiItemDetailDescription(','// BEGIN SOUL ITEM DETAIL STATS'),c);
 return {c,nodes};
}
test('all equipment rows are in requested order with weapon stars separate',()=>{
 const rows=cut('<dl id="poiItemDetailEquipmentStats"','<dl id="poiItemDetailSoulStats"');
 a.deepEqual([...rows.matchAll(/<dt>([^<]+)<\/dt>/g)].map(r=>r[1]),['タイプ','攻撃力','防御力','耐久値','速度','リーチ']);
});
test('waistcloth defense min 1, actual exact durability, no duplicate stats in description; prefer shared adapters',()=>{
 const {c,nodes}=init(),armor={type:'armorOrvasWaistcloth',durability:47};
 c.poiItemDetailRenderEquipment(armor);
 a.equal(nodes.get('poiItemDetailType').textContent,'防具（脚）');
 a.equal(nodes.get('poiItemDetailDefense').textContent,'1');
 a.equal(nodes.get('poiItemDetailAttack').textContent,'0');
 a.equal(nodes.get('poiItemDetailDurability').textContent,'47 / 96');
 a(!/防御力：|耐久：/.test(c.poiItemDetailDescription(armor,false)));
 a.match(c.poiItemDetailDescription(armor),/防御力：1(?![\d.])/);
 c.poiEquipmentDefense=()=>6;c.poiEquipmentItemAttack=()=>3;c.poiItemDetailRenderEquipment(armor);
 a.equal(nodes.get('poiItemDetailDefense').textContent,'6');a.equal(nodes.get('poiItemDetailAttack').textContent,'3');
});
test('weapon stats and wand charge use actual values, stars persist only for weapon, food and souls leave rows hidden',()=>{
 const {c,nodes}=init(),n=k=>nodes.get('poiItemDetail'+k);
 c.poiItemDetailRenderEquipment({type:'equipIronSword',durability:70});c.poiItemDetailRenderWeaponStats('equipIronSword');
 a.equal(n('Type').textContent,'武器');a.equal(n('Attack').textContent,'30');a.equal(n('Defense').textContent,'0');a.equal(n('Durability').textContent,'70 / 180');
 a.equal(n('WeaponSpeed').textContent,'★★★☆☆');a.equal(n('WeaponReach').textContent,'★★☆☆☆');
 c.poiItemDetailRenderEquipment({type:'fireWand',charges:3});a.equal(n('Durability').textContent,'残り3回');
 c.poiItemDetailRenderEquipment({type:'healingHerb',count:1});c.poiItemDetailRenderWeaponStats('healingHerb');
 a.equal(n('EquipmentStats').hidden,true);a.equal(n('WeaponStats').hidden,true);
});
