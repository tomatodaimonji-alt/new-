const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const s=fs.readFileSync(process.argv[2]??'stage.html','utf8');
const cut=(a,b)=>s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)+a.length));
const exported=cut('const POI_ARMOR_DEFENSE=','function poiEquipmentPrice(');
const mocks=`const poiArmorWorn=k=>k.worn,poiTownNpcLoadout=a=>a;
const poiPlayerWeaponProfile=type=>type==='fireWand'?{damage:22}:null;
const poiHotbarWeaponForType=type=>type==='equipWoodSword'?type:null;
const poiPlayerAttackDamage=()=>28;`;
const run=body=>JSON.parse(vm.runInNewContext(mocks+exported+cut('function poiTownNpcDefense','const POI_TOWN_INN=')+'JSON.stringify((()=>{'+body+'})())'));
test('Orvas waistcloth and each positive bonus are integers, zero remains zero',()=>{
 const a=run("return [poiEquipmentDefense('armorOrvasWaistcloth'),poiEquipmentDefense(null),Object.keys(POI_ARMOR_DEFENSE).map(poiEquipmentDefense)]");
 assert(a[0]>=1&&Number.isInteger(a[0]));assert.equal(a[1],0);assert(a[2].every(n=>n===Math.trunc(n)&&n>=1));
});
test('detail and combat read the same item defense, weapons and armor each report attack',()=>{
 const a=run("const gear={legs:'armorOrvasWaistcloth',feet:'starterBoots'};return [poiPlayerDefense({worn:gear}),poiTownNpcDefense({gear,weapon:null}),poiPlayerDamageAfterArmor(10,{worn:gear}),poiEquipmentItemAttack('armorOrvasWaistcloth'),poiEquipmentItemAttack('equipWoodSword'),poiEquipmentItemAttack('fireWand')]");
 assert.equal(a[0],a[1]);assert.equal(a[2],10-a[0]);assert.deepEqual(a.slice(3),[0,28,22]);
});
