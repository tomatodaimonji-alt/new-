const fs=require('node:fs'),vm=require('node:vm'),a=require('node:assert/strict'),{test}=require('node:test');
const s=fs.readFileSync(process.argv[2]||process.env.ROLE_GEAR_INPUT||'candidate.html','utf8');
const slice=(begin,end)=>{const i=s.indexOf(begin),j=s.indexOf(end,i+begin.length);a(i>=0&&j>i,begin);return s.slice(i,j)};
function runtime(){
 const boxes=[];const ctx={cube:(m,...args)=>boxes.push(args),diamond:(m,...args)=>boxes.push(args),poiPlayerWeaponProfile:t=>t==='equipWoodSpear'?{damage:24}:t==='equipPlainStaff'?{damage:23}:null,poiPlayerAttackDamage:()=>20,POI_KNIFE_DURABILITY:40};
 const code=slice('const POI_TOWN_ROLE_OUTFIT_IDS=', '// Authored role tools')+
  slice('const POI_STARTER_ARMOR=', 'function poiEquipmentDurabilityPercent(')+
  slice('const POI_TOWN_NPC_BASE_GEAR=', 'const POI_TOWN_INN=')+
  "const POI_TOWN_RESIDENT_MELEE=13;";
 const c=vm.createContext(ctx);new vm.Script(code).runInContext(c);
 return {boxes,run:x=>JSON.parse(JSON.stringify(vm.runInContext(x,c)))};
}
test('roles carry recognizable kits and keep real resident overrides',()=>{
 const {run}=runtime(),equip=(id,role='keeper',type='humanVillager')=>run('poiTownNpcLoadout({role:'+JSON.stringify({id,role,type})+'})');
 a.equal(equip('westpeddler','visitor','humanMerchant').gear.torso,'armorPeddlerMantle');
 a.equal(equip('toolkeeper','keeper','humanMerchant').gear.torso,'armorMerchantCoat');
 a.equal(equip('northgatekeeper','watch','humanKnight').gear.head,'armorWatchHelm');
 a.equal(equip('northgatekeeper','watch','humanKnight').weapon,'equipWoodSpear');
 a.equal(equip('northwatchworker','watch').weapon,'equipPlainStaff');
 a.equal(equip('nightporter','night-porter').gear.torso,'armorWatchJacket');
 a.equal(equip('northscout','scout').gear.torso,'armorScoutMantle');
 a.equal(equip('innkeeper').gear.torso,'armorInnVest');
 a.equal(equip('stablekeeper').gear.torso,'armorWorkerVest');
 a.equal(equip('portfisher','port-local').gear.torso,'armorFisherOilskin');
 a.equal(equip('portfishseller','port-local','humanMerchant').gear.torso,'starterTunic');
 a.equal(equip('resadventurer','adventurer','humanKnight').weapon,'equipWoodSword');
 a.deepEqual(equip('towncook','visitor').tools,['equipLadle']);
 a.equal(run("poiTownNpcLoadout({role:{id:'northgatekeeper',role:'watch'},weapon:null}).weapon"),null);
});
test('each new item uses emitted wearable geometry and real registered integer defense/durability',()=>{
 const {run,boxes}=runtime();
 for(const [id,slot,def,max] of [['armorPeddlerMantle','torso',2,82],['armorWatchHelm','head',2,94],
  ['armorWatchJacket','torso',2,86],['armorScoutMantle','torso',2,80],['armorInnVest','torso',1,64],
  ['armorWorkerVest','torso',2,76],['armorFisherOilskin','torso',2,78]]){
  const args=JSON.stringify(id);
  a.equal(run('poiArmorCategory('+args+')'),slot);
  a.equal(run('poiArmorDefense('+args+')'),def);
  a.equal(run('poiEquipmentDurabilityMax('+args+')'),max);
  a(run('Object.hasOwn(POI_STARTER_ARMOR_NAMES,'+args+')'));
  boxes.length=0;a(run('poiRoleClothingGeometry({},'+args+',0,0,0)'));a(boxes.length>=5);
  a(s.includes("case '"+id+"':")&&s.includes("{id:'"+id+"',"),id);
 }
});
test('stable IDs produce real cloth, work coat and iron options without time or redraw rerolls',()=>{
 const {run}=runtime();
 const role=['toolkeeper','westpeddler','portfishseller','southmerchant'];
 const gear=run(JSON.stringify(role)+".map(id=>poiTownNpcLoadout({role:{id,type:'humanMerchant'}}).gear.torso)");
 a.deepEqual(gear,['armorMerchantCoat','armorPeddlerMantle','starterTunic','armorIronTorso']);
 for(const id of [...role,'resadventurer','guestadventurer','stablekeeper','workshopkeeper']){
  const spec=JSON.stringify({id,type:'humanMerchant'});
  a.deepEqual(run('poiTownNpcLoadout({role:'+spec+',now:1})'),run('poiTownNpcLoadout({role:'+spec+',now:99999999})'));
 }
 a.equal(run("poiTownNpcLoadout({role:{id:'resadventurer',role:'adventurer'}}).gear.torso"),'armorScoutMantle');
 a.equal(run("poiTownNpcLoadout({role:{id:'guestadventurer',role:'adventurer'}}).gear.torso"),'armorIronTorso');
 a.deepEqual(run("poiTownNpcLoadout({role:{id:'southmerchant',type:'humanMerchant'},gear:{head:null,torso:'armorMerchantCoat',legs:null,feet:null}}).gear"),
  {head:null,torso:'armorMerchantCoat',legs:null,feet:null});
});
