const fs=require('node:fs'),vm=require('node:vm'),a=require('node:assert/strict'),{test}=require('node:test');
const h=fs.readFileSync(process.argv[2]||'candidate.html','utf8');
function fixture(){
 const p={site:{id:'frontier'},kit:{gold:60,humanParty:[{id:'human:a',hp:55}]},clear:true,fail:false,writes:0};
 const town={role:{id:'town'},x:3,z:3,y:0},party={id:'human:a',x:4,z:3,y:0,site:p.site};
 const c={facilitySite:p.site,poiWalkLevel:0,poiWalkX:2,poiWalkZ:3,poiTownDialogue:null,poiEconomyDrops:new Map(),
  POI_HUMAN_PARTY_IDS:{'human:a':'party'},POI_ECONOMY_GOLD_MAX:99,POI_NPC_TRADE_MAX_STOCK:12,
  frontierResident:id=>['town','party'].includes(id),poiHotbarRead:()=>p.kit,
  frontierVendorStock:(k,id)=>k.stock?.[id]??{gold:0,healingHerb:0,cannedFood:0},
  frontierLifeRecord:(k,id)=>k.life?.[id]??{hp:100,items:[]},
  poiHumanPartyDecode:x=>x,poiCompanionPosition:o=>o,poiTownNpcVisualPosition:o=>o,
  poiSnowGroundMatch:o=>o.region!=='snowpass',poiCompanionAttackClear:()=>p.clear,
  poiLookoutCell:()=>({x:3,z:4,y:0}),poiCompanionType:t=>t.endsWith('Soul'),
  poiInventorySanitizeCell:({type,count,durability})=>type==='invalid'?null:{type,count,...(durability?{durability}:{})},
  frontierLifeStock:(k,id,r)=>({...k,stock:{...k.stock,[id]:r}}),
  frontierLifeEdit:(k,id,r)=>({...k,life:{...k.life,[id]:{hp:100,...r}}}),
  poiEconomyWrite:k=>{if(p.fail)return false;p.writes++;p.kit=k;return true},
 };
 vm.createContext(c);const start=h.indexOf('function frontierNpcCollect('),end=h.indexOf('const frontierNpcHome=',start);vm.runInContext(h.slice(start,end),c);
 return {c,p,town,party,act:(x,t)=>c.frontierNpcCollect(x,t)};
}
test('party and free villagers claim actual same-floor gold once, leaving partial excess and player coins intact',()=>{
 const {c,p,town,party,act}=fixture();
 p.kit.stock={party:{gold:97,healingHerb:0,cannedFood:0}};
 p.kit.groundGold=[{x:4,z:4,y:0,amount:6}];
 a(act(party,0));a.equal(p.kit.stock.party.gold,99);a.equal(p.kit.groundGold[0].amount,4);
 a(!act(party,500));a.equal(p.kit.gold,60);
 c.poiEconomyDrops.set('3,3',{x:3,z:3,amount:5});
 a(act(town,0));a.equal(c.poiEconomyDrops.size,0);a.equal(p.kit.stock.town.gold,5);
 a(!act(town,500));a.equal(p.writes,2);
});
test('persist item durability, split supplies at limits, leave player tile, walls, other floor/region and progression items alone',()=>{
 const {c,p,town,party,act}=fixture();
 p.kit.stock={town:{gold:0,healingHerb:11,cannedFood:0}};
 p.kit.towerFind={kind:'herb'};
 p.kit.drops=[
  {x:2,z:3,y:0,type:'cannedFood'},
  {x:4,z:3,y:-1,type:'cannedFood'},
  {x:3,z:3,y:0,type:'cannedFood',region:'snowpass'},
  {x:4,z:3,y:0,type:'slimeSoul'},
  {x:3,z:4,y:0,type:'healingHerb'},
  {x:3,z:3,y:0,type:'equipOrvasHead'},
  {x:4,z:3,y:0,type:'healingHerb',count:4},
  {x:4,z:4,y:0,type:'equipIronSword',durability:34}];
 a(act(town,0));a.equal(p.kit.stock.town.healingHerb,12);a.equal(p.kit.drops[6].count,3);
 a(act(party,0));a.equal(p.kit.stock.party.healingHerb,3);
 c.poiTownDialogue={actor:party};a(!act(party,500));
 c.poiTownDialogue=null;p.clear=false;a(!act(party,600));
 p.clear=true;a(act(party,1100));
 a.equal(p.kit.life.party.items[0].durability,34);a.equal(p.kit.drops.length,6);
 a.equal(p.kit.life.party.items[0].type,'equipIronSword');
});
test('save failure keeps source; false party contexts cannot steal surface or owned stock',()=>{
 const {c,p,town,party,act}=fixture();p.fail=true;
 c.poiEconomyDrops.set('4,3',{x:4,z:3,amount:5});a(!act(party,0));a.equal(c.poiEconomyDrops.size,1);
 p.fail=false;party.y=-1;a(!act(party,500));party.y=0;
 party.partyDown=true;a(!act(party,1000));party.partyDown=false;p.kit.humanParty[0].hp=0;a(!act(party,1500));
 a(act(town,0));a.equal(p.kit.stock.town.gold,5);a.equal(c.poiEconomyDrops.size,0);
 a(!act(town,500));a.equal(p.writes,1);
});
