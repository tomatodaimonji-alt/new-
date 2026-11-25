const a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.argv[2],'utf8');
const part=(b,e)=>{const x=h.indexOf(b),y=h.indexOf(e,x+1);a(x>=0&&y>x,b);return h.slice(x,y)};
const c=vm.createContext({facilitySite:{id:'frontier'},localStorage:{getItem:()=>null},POI_HOTBAR_KEY:'kit',POI_HOTBAR_POTION_START:3,POI_HOTBAR_POTION_MAX:9,
 POI_HOTBAR_SIZE:9,POI_BAG_SAVED:27,POI_INVENTORY_SWORD:'equipWoodSword',POI_INVENTORY_HERB:'healingHerb',POI_KNIFE_DURABILITY:40,POI_FRESH_ARMOR:{head:null,torso:null,legs:null,feet:null},
 POI_TOWN_ROLE_OUTFITS:{},POI_TOWN_NPC_MERCHANT_GEAR:{},POI_TOWN_NPC_BASE_GEAR:{},poiTownRoleChoice:()=>({}),poiHumanGearType:v=>v?.type??v,
 segments:[], humanRingProfile(m,x,y,z,rows,color){c.segments.push({rows,color});m.p.push(0,0,0)},cube(){}});
vm.runInContext("let poiHotbarState=null;"+part('function poiHotbarRead(){',' poiMigrateWeaponDurability(saved);')+'}\n'+part('function poiInventoryOrdinarySlots(','function poiInventorySlots('),c);
a(vm.runInContext('poiInventoryOrdinarySlots(poiHotbarRead()).every(c=>c===null)',c),'fresh Frontier inventory is truly empty');
vm.runInContext(part('const FRONTIER_HUMANS=','function characterHuman(')+part('function poiTownNpcLoadout(','function poiTownNpcAttackPower('),c);
for(const [id,appearance,weapon] of [['frontierren','kai','equipWoodSpear'],['frontiersera','sera','equipWoodBow']]){
 c.role={id,appearance,type:'humanVillager'};const l=vm.runInContext('poiTownNpcLoadout({role})',c);
 a.equal(l.weapon,weapon);a.deepEqual({...l.gear},{head:null,torso:'starterTunic',legs:'starterTrousers',feet:'armorLeatherShoes'});
}
const get=(who,gear)=>{c.segments.length=0;c.who=who;c.gear=gear;vm.runInContext('frontierHumanShape({p:[],townParts:{}},FRONTIER_HUMANS[who],gear)',c);return c.segments.slice()};
for(const who of ['kai','sera']){
 const bare=get(who,null),dressed=get(who,{head:null,torso:'starterTunic',legs:'starterTrousers',feet:'armorLeatherShoes'});
 a.notDeepEqual(bare.map(x=>x.color),dressed.map(x=>x.color));
 a.equal(bare[0].rows[0][0],dressed[0].rows[0][0],'foot grounding same in both states');
}
a(h.includes("person('frontierren','レン','humanMerchant',75,32,2,'kai')"));
a(h.includes("poiGameReset(facilitySite?.id!=='frontier')"));
console.log('Empty inventory, fitted cloth and leather equipment, and canonical resident loadouts.');
