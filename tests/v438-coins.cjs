const fs=require('node:fs'),vm=require('node:vm'),a=require('node:assert/strict');
const s=fs.readFileSync(process.argv[2]||'candidate.html','utf8');
for(const m of s.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
const fn=name=>{const m=s.match(new RegExp('^function '+name+'\\([^]*?^}','m'));a.ok(m,name);return m[0]};
const kit={gold:0,groundGold:[],drops:[]};
const c={facilitySite:{id:'frontier'},poiWalkX:199,poiWalkZ:30,poiWalkLevel:0,frontierPlayCave:false,poiSnowGroundMatch:()=>true,
 poiFieldCoinsAllowed:()=>true,poiWildExterior:()=>true,poiWalkCanStep:()=>true,poiEconomyDropActors:new WeakSet(),poiEconomyDrops:new Map(),
 POI_ECONOMY_GOLD_MAX:9999,POI_ECONOMY_COIN:3,poiSound:()=>{},frontierResident:()=>true,poiHotbarRead:()=>kit,
 frontierVendorStock:(k,id)=>k[id]??{gold:0},frontierLifeStock:(k,id,stock)=>({...k,[id]:stock}),poiEconomyWrite:k=>Object.assign(kit,k),
 frontierLifeRecord:()=>({items:[]}),poiCompanionAttackClear:()=>true,poiTownNpcVisualPosition:a=>a,
 POI_HUMAN_PARTY_IDS:{},poiTownNpcCombatNear:()=>true,FRONTIER_EXPEDITION_NPCS:['frontierregna','frontierlyzel']};
vm.createContext(c);
for(const n of ['poiEconomyDrop','frontierNpcCoinRoom','frontierNpcCoinGoal','frontierNpcCollect','frontierNpcCoinFoley'])vm.runInContext(fn(n),c);
const npc=(id,x)=>({role:{id},x,z:30,y:0});
const lyzel=npc('frontierlyzel',142),regna=npc('frontierregna',141),other=npc('frontierroan',142);
c.poiEconomyDrop({type:'monsterSlime',y:0},{wildSpawn:true,hp:0,x:149,z:30},lyzel.role.id);
c.poiEconomyDrop({type:'monsterSlime',y:0},{wildSpawn:true,hp:0,x:147,z:30});
a.equal(c.frontierNpcCoinGoal(lyzel,lyzel,true)?.x,149,'Lyzel sees a 7-tile coin pile from her kill, not a nearer unmarked pile');
a.equal(c.frontierNpcCoinGoal(regna,regna,true)?.x,149,'partner can recover the party kill');
a.equal(c.frontierNpcCoinGoal(other,other,true),null);
lyzel.x=148.1;
a.equal(c.frontierNpcCollect(lyzel,2000),true);
a.equal(kit.frontierlyzel.gold,3);a.equal(kit.gold,0);a.equal(c.poiEconomyDrops.has('149,30'),false);
a.equal(c.poiEconomyDrops.has('147,30'),true,'nearby other pile untouched on the same tick');
a.match(s,/if\(frontierExpeditionCollectCoin\(a,now,budget\)\)return;\n if\(expedition/);
a.match(s,/poiEconomyDrop\(obj,state,source\?\.actorId\)/);
console.log('PASS ranged kill coin targeting, partner approach, actual NPC balance credit and no touching player wallet');
