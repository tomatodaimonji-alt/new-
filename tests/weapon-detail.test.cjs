const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function fixture(){
 const a=h.indexOf('function poiItemDetailDescription('),b=h.indexOf('function poiItemDetailClose(',a);
 const els=new Map();
 const c={$:id=>{if(!els.has(id))els.set(id,{});return els.get(id)},
  poiArmorCategory:t=>t==='armorIronTorso',poiArmorDefense:()=>8,poiEquipmentDurabilityPercent:()=>null,poiEquipmentPrice:()=>null,
  poiInventoryStack:t=>t==='healingHerb'?9:1,poiHotbarWeaponForType:t=>t==='kitchenKnife',
  poiPlayerAttackDamage:()=>30,poiPlayerWeaponProfile:t=>({equipWoodSword:{damage:45,range:1.3,sweep:true},fireWand:{damage:34,range:8}}[t]||null),
  poiPlayerWeaponGrades:t=>({equipWoodSword:{speed:4,reach:1},fireWand:{speed:2,reach:5},kitchenKnife:{speed:5,reach:1}}[t]||null)};
 vm.runInNewContext(h.slice(a,b),c);
 return c;
}
test('separate damage, speed and reach rows are generated from canonical profiles, including wand and fallback weapons',()=>{
 const c=fixture();
 for(const [type,damage,speed,reach] of [['equipWoodSword',45,4,1],['fireWand',34,2,5],['kitchenKnife',30,5,1]]){
  const s=c.poiItemDetailWeaponStats(type);assert.deepEqual([s.damage,s.speed,s.reach],[damage,speed,reach]);
  c.poiItemDetailRenderWeaponStats(type);
  assert.equal(c.$('poiItemDetailAttack').textContent,String(damage));
  assert.equal(c.$('poiItemDetailWeaponSpeed').textContent,'★'.repeat(speed)+'☆'.repeat(5-speed));
  assert.equal(c.$('poiItemDetailWeaponReach').textContent,'★'.repeat(reach)+'☆'.repeat(5-reach));
  assert.equal(c.$('poiItemDetailSpeedAnnounce').textContent,'5段階中'+speed);
 }
});
test('weapon rows clear for consumables and armor; shared description and detail actions are otherwise unchanged',()=>{
 const c=fixture(),sword={type:'equipWoodSword',count:1},herb={type:'healingHerb',count:3};
 assert.match(c.poiItemDetailDescription(sword),/攻撃力：45/);
 assert.doesNotMatch(c.poiItemDetailDescription(sword,false),/攻撃力|攻撃範囲/);
 assert.match(c.poiItemDetailDescription({type:'armorIronTorso'},false),/防御力：8/);
 assert.match(c.poiItemDetailDescription(herb,false),/所持数：3/);
 c.poiItemDetailRenderWeaponStats('equipWoodSword');c.poiItemDetailRenderWeaponStats(herb.type);
 assert.equal(c.$('poiItemDetailWeaponStats').hidden,true);
 assert.equal(c.$('poiItemDetailAttack').textContent,'');
 assert.match(h,/id="poiItemDetailWeaponStats"[^>]*hidden/);
 assert.match(h,/if\(zone==='npc'\)return \['back'\];/);
});
