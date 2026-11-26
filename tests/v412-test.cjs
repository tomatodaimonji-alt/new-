const a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const s=fs.readFileSync(process.argv[2],'utf8');
const lines=s.split('\n');
function fn(name){
 const i=lines.findIndex(x=>x.startsWith('function '+name+'('));a.ok(i>=0,name);
 return lines.slice(i,lines[i].endsWith('}')?i+1:lines.findIndex((x,j)=>j>i&&x==='}')+1).join('\n');
}
{
 const state={playerAttack:{x:4,z:8,y:0,obj:{type:'monsterGoblin'},start:10,hit:50}};
 const context={state,poiEnemyPending:new Set([state]),poiWalkLevel:0,poiWalkX:4,poiWalkZ:8,poiMonsterMeshDirty:false,poiPlayerHP:100,
  poiEnemyThreatEnabled:()=>true,poiEnemyAttackSourceValid:()=>true,poiEnemyContactTolerance:()=>100,poiAimOrigin:()=>context.point,
  poiHumanWitnessEnemyAttack:()=>{},terrainY:()=>0,poiDamageNumber:()=>{},poiCombatHud:()=>{},poiSound:()=>{},
  POI_MONSTER_STATS:{monsterGoblin:{attack:12}},poiWalkViewX:4,poiWalkViewZ:8,facilitySite:null,poiEnemyLearnKey:()=> 'goblin',poiPlayerAttributes:()=>({intelligence:10}),
  poiHeroLessons:{},poiRecordAttack:()=>{},poiLearnedDodge:()=>true};
 const run=vm.runInNewContext(fn('poiEnemyResolvePlayer')+'\n'+fn('poiMobHitPlayer')+'\npoiEnemyResolvePlayer',context);
 const hit=state.playerAttack;
 context.point={x:4.2,z:8.2,y:0};hit.pending=true;run(55);a.equal(context.poiPlayerHP,88,'being inside a committed warning hits, even with learned evasion');
 state.playerAttack={...hit,pending:true};context.poiEnemyPending.add(state);
 context.point={x:4.7,z:8.2,y:0};run(55);a.equal(context.poiPlayerHP,88,'physically leaving the warning before impact avoids damage');
}

a.ok(!s.includes('poiLearnedDodge('),'no RNG can cancel a resolved contact');
a.match(s,/a\.humanSidestep=\{at:now/);
const rock=vm.runInNewContext(fn('frontierSoftPlant')+'\n'+fn('frontierWalkableProp')+'\nfrontierWalkableProp',{FRONTIER_WEST_OFFSET:64});
a.ok(rock('rockMossy',115,27,0));a.ok(!rock('rockMossy',114,27,0));a.ok(!rock('rockCliff',115,27,0));a.ok(!rock('rockMossy',115,27,1));a.ok(rock('bushFern',22,31,0));
console.log('committed hit inside, miss outside, physical reaction intact, only requested mossy rock passable');
const room={x1:99,x2:102,z1:33,z2:36};
const bedside=vm.runInNewContext(fn('poiTownBedsideScore')+'\npoiTownBedsideScore',{
 poiFreeCell:Math.round,frontierHouseForTile:(x,z)=>x>=99&&x<=102&&z>=33&&z<=36?room:null
});
const bed={x:101,z:35,y:0};
a.ok(Number.isFinite(bedside({x:100,z:34,y:0,dir:{x:1,z:0}},bed,false)));
a.equal(bedside({x:100,z:36.7,y:0,dir:{x:0,z:-1}},bed,false),Infinity);
a.equal(bedside({x:100,z:34,y:1,dir:{x:0,z:1}},bed,false),Infinity);
console.log('bedside dialogue within a room, not through a wall or between floors');
