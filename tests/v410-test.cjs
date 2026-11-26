const assert=require('node:assert/strict'), vm=require('node:vm'), fs=require('node:fs');
const s=fs.readFileSync(process.argv[2],'utf8');
const lines=s.split('\n');
const read=name=>{
 const start=lines.findIndex(x=>x.startsWith('function '+name+'('));
 assert.ok(start>=0,'missing '+name);
 const end=lines.findIndex((x,i)=>i>start&&x==='}');
 return lines.slice(start,lines[start].endsWith('}')?start+1:end+1).join('\n');
};
const get=name=>{const from=s.indexOf('const '+name+'=');assert.ok(from>=0);return s.slice(from,s.indexOf(';',from)+1)};
const defs=['FRONTIER_GUARD_STATS','FRONTIER_RESIDENT_WEAPONS','POI_HUMAN_PARTY_IDS'].map(get).join('\n');
vm.runInNewContext(defs+['poiTownNpcMaxHp','frontierResident','frontierLifeDecode','frontierLifeRecord','poiHumanPartyDecode','frontierGuardDuty','poiStatGrade','poiStatStars','poiTownNpcAttackPower'].map(read).join('\n')+`
 for(const [id, hp, base, int, cap] of [['frontiersugimoto',150,5,1,'armorKnitCap'],['frontiermiyamoto',170,3,0,'armorMilitaryCap']]){
  assert.equal(frontierResident(id),true);
  assert.equal(POI_HUMAN_PARTY_IDS['human:'+id],id);
  assert.equal(frontierLifeRecord({},id).hp,hp);
  assert.equal(frontierLifeDecode({[id]:{hp:hp-1,items:[]}})[id].hp,hp-1);
  assert.equal(poiHumanPartyDecode([{id:'human:'+id,hp,mode:'fight'}])[0].hp,hp);
  assert.equal(poiHumanPartyDecode([{id:'human:'+id,hp:hp+1}]).length,0);
  assert.equal(poiTownNpcAttackPower({role:{id},weapon:null}),base);
  assert.equal(poiTownNpcAttackPower({role:{id},weapon:'equipIronSpear'}),base+30);
  assert.equal(FRONTIER_GUARD_STATS[id].intelligence,int);
  assert.equal(FRONTIER_GUARD_STATS[id].head,cap);
 }
 assert.equal(poiStatStars(0),'☆☆☆☆☆☆☆☆☆☆');
 for(const [hour, expected] of [[0,'watch'],[7,'off-duty'],[8,'sleep'],[16,'sleep'],[17,'off-duty'],[19,'off-duty'],[20,'watch']])
  assert.equal(frontierGuardDuty({id:'frontiersugimoto'},{minute:hour*60}),expected);
 assert.equal(frontierGuardDuty({id:'frontierchief'},{minute:480}),null);
 `,{assert,poiInventorySanitizeCell:x=>x,frontierReturnPoint:()=>null,POI_TOWN_RESIDENT_HP:100,poiTownNpcLoadout:a=>a,poiPlayerAttackDamage:()=>14,poiEquipmentItemAttack:w=>w?30:0});
assert.ok(s.includes("text:sleeping?'ZZZ…'"),'sleep starts on a ZZZ page');
assert.ok(s.includes('frontierWatchHouse'),'guards have a shared house');
console.log('guard stats, HP persistence, loadouts, and night rota: OK');
