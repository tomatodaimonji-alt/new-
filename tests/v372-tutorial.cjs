const a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.argv[2],'utf8'),start=h.indexOf('// BEGIN HUMAN PARTY'),end=h.indexOf('// END HUMAN PARTY');
const mock={facilitySite:{id:'frontier',residents:[{id:'frontiersera',role:'local',job:'村人',name:'セラ',appearance:'sera',type:'humanVillager'},{id:'frontierren',role:'local',job:'村人',name:'レン',appearance:'kai',type:'humanVillager'}]},
 POI_TOWN_RESIDENT_ROLES:[], POI_TOWN_RESIDENT_HP:100,
 poiTownNpcLoadout:({role})=>({gear:{},weapon:role.id==='frontiersera'?'equipWoodBow':'equipWoodSpear'}),poiTownNpcAttackPower:()=>12,poiTownNpcDefense:()=>3,
 poiTownNpcReleaseHunt(){},poiPartyHasRoom:()=>true,poiHotbarRead(){return c.kit},poiEconomyWrite(k){c.kit=k;return true},
 poiArmorWorn:k=>k.worn||{},poiInventorySlots:k=>k.slots||[],poiAnyChestHas:()=>false,
 poiInventoryAccept:(k,t)=>({accepted:1,slots:[...(k.slots||[]),{type:t,count:1}]}),poiInventoryEdited:(k,slots)=>({...k,slots}),
 poiTownNpcVersion:0,poiTownNpcActors:[],kit:{},FRONTIER_FITTED_GEAR:{head:null,torso:'starterTunic',legs:'starterTrousers',feet:'armorLeatherShoes'}};
const c=vm.createContext(mock),api=(s)=>vm.runInContext(s,c);
vm.runInContext(h.slice(start,end),c);
const x=h.indexOf('// BEGIN FRONTIER INTRO'),y=h.indexOf('// END FRONTIER INTRO');
vm.runInContext(h.slice(x,y),c);
a.equal(api("poiHumanPartySpec('human:frontiersera')?.job"),"村人");
a(api("frontierNpcTutorial(facilitySite.residents[0]).pages[0].includes('裸')"));
a.deepEqual(c.kit.slots.map(s=>s.type),['starterTunic','starterTrousers','armorLeatherShoes']);
a(api("frontierNpcTutorial(facilitySite.residents[1]).pages[0].includes('インベントリ')"));
a.equal(c.kit.slots.length,3,'one gift shared between residents');
c.kit.worn={torso:'starterTunic',legs:'starterTrousers'};
a.equal(api("frontierNpcTutorial(facilitySite.residents[0]).pages.length"),2);
a(api("frontierNpcTutorial(facilitySite.residents[0]).pages[1].includes('依頼')"));
c.poiTownNpcActors=c.facilitySite.residents.map(role=>({role,hp:100}));
a(api('poiHumanPartyRecruit(poiTownNpcActors[0]).ok'));
a(api("poiHumanPartyHurt('human:frontiersera',500)"));
a.equal(c.kit.humanParty.length,0,'permadeath also frees up party slot');
a(api("poiHumanPartyAway('frontiersera',kit)"),'fallen resident never returns');
a(!api("poiHumanPartyDismiss('human:frontiersera').ok"));
console.log('Shared one-time clothing, two pages, recruitable villagers, death permanently blocks respawn.');
