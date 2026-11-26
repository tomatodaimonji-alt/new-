const a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const s=fs.readFileSync(process.argv[2],'utf8');
for(const t of ['armorLeatherShoes','armorLeatherTorso','armorLeatherLegs','armorBandana','equipWoodSword'])
 a.match(s.match(/const FRONTIER_COUNTER_GEAR=Object.freeze\(\[[^\n]+/)?.[0]||'',new RegExp(t));
const lines=s.split('\n');
const fn=name=>{const i=lines.findIndex(x=>x.startsWith('function '+name+'('));a.ok(i>=0,name);return lines.slice(i,lines[i].endsWith('}')?i+1:lines.findIndex((x,j)=>j>i&&x==='}')+1).join('\n')};
const context={POI_FRONTIER_SHOP_ID:'shop',frontierGearPart:t=>t==='sword'?'weapon':'torso',
 poiEquipmentItemAttack:t=>({sword:30}[t]??0),poiEquipmentDefense:t=>({tunic:1,leather:2}[t]??0),
 frontierNpcEquipment:()=>({torso:{type:'tunic',count:1,durability:12}})};
const take=vm.runInNewContext(fn('frontierNpcAcquire')+'\nfrontierNpcAcquire',context);
const old={hp:99,items:[]},cell={type:'leather',count:1,durability:12};
const next=take({}, {id:'ren'},old,cell);a.equal(next.worn.torso,cell);a.equal(next.items[0].type,'tunic');a.equal(next.items[0].durability,12);
const shelf=take({}, {id:'shop'},old,cell);a.equal(shelf.worn,undefined);a.equal(shelf.items[0],cell);
a.match(s,/overflow-wrap:anywhere/);
console.log('catalog stocked, gear upgrades preserve moved item durability, shopkeeper does not auto-equip');
const f=s.match(/function frontierDressed\(kit\)\{[\s\S]*?\n\}/)?.[0]||'';
const dressed=vm.runInNewContext(f+'\nfrontierDressed',{poiArmorWorn:k=>k});
a.equal(dressed({torso:'armorLeatherTorso',legs:'armorLeatherLegs'}),true);
a.equal(dressed({torso:'armorLeatherTorso',legs:null}),false);
