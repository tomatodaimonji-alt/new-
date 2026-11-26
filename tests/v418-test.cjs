const a=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const s=fs.readFileSync(process.argv[2],'utf8'),lines=s.split('\n');
const fn=name=>{const i=lines.findIndex(x=>x.startsWith('function '+name+'('));a.ok(i>=0,name);
 return lines.slice(i,lines[i].endsWith('}')?i+1:lines.findIndex((x,j)=>j>i&&x==='}')+1).join('\n')};
const rock=vm.runInNewContext([fn('frontierSoftPlant'),fn('frontierWalkableProp'),'frontierWalkableProp'].join('\n'),{FRONTIER_WEST_OFFSET:64});
a.equal(rock('rockMossy',117,53,0),true);a.equal(rock('rockCliff',117,53,0),false);a.equal(rock('rockMossy',117,53,1),false);
const p={id:'human:test',site:{id:'frontier'},x:10,z:10,y:0};
const kit={humanParty:[{id:p.id,hp:120}],groundGold:[{x:10,z:11,y:0,amount:4,frontierCave:true},{x:11,z:10,y:0,amount:7}]};
const calls=[];
const c={facilitySite:p.site,poiWalkLevel:0,poiWalkX:11,poiWalkZ:10,frontierPlayCave:true,POI_ECONOMY_GOLD_MAX:999,POI_HUMAN_PARTY_IDS:{[p.id]:'test'},
 poiEconomyDrops:new Map([['13,10',{x:13,z:10,y:0,amount:3,frontierCave:false}]]),poiTownDialogue:null,
 frontierResident:()=>true,poiHotbarRead:()=>kit,frontierVendorStock:()=>({gold:12}),poiHumanPartyDecode:r=>r,
 poiCompanionPosition:a=>a,poiSnowGroundMatch:(o,cave)=>!!o.frontierCave===cave,poiCompanionAttackClear:()=>true,
 poiTownNpcCombatNear:()=>true,poiSound:(...args)=>calls.push(args)};
const goal=vm.runInNewContext([fn('frontierNpcCoinRoom'),fn('frontierNpcCoinGoal'),'frontierNpcCoinGoal'].join('\n'),c);
a.equal(goal(p,p).amount,7,'surface ally can pick up coins even when hero is on the cave layer');
c.frontierPlayCave=false;
a.equal(goal(p,p).amount,3,'reserve coins under the same-layer player');
a.equal(goal({...p,x:2}, {...p,x:2}),null);
console.log('low mossy rocks pass on the surface; nearby coins respect layers, player priority and seek range');
