'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(process.argv[2],'utf8');
const a=html.indexOf('// BEGIN SOUTH DUNGEON PURSUIT'),b=html.indexOf('// END SOUTH DUNGEON PURSUIT',a);
assert(a>0&&b>a,'pursuit feature exists');
const southStart=html.indexOf('const FRONTIER_SOUTH_MAIN='),southEnd=html.indexOf('function frontierSouthOwn(',southStart);
const roomStart=html.indexOf('const FRONTIER_SOUTH_ROOM_CENTRES='),roomEnd=html.indexOf('const FRONTIER_SOUTH_BEDROCK=',roomStart);
const ctx={Math,Map,Set,facilitySite:{id:'frontier'}};
vm.runInNewContext(html.slice(southStart,southEnd)+html.slice(roomStart,roomEnd)+html.slice(a,b)+
 ';globalThis.test={frontierSouthPursuitChoice,frontierSouthPursuitPath,frontierSouthPursuitField,frontierSouthCells,FRONTIER_SOUTH_ENEMIES};',ctx);
const {frontierSouthPursuitChoice:pick,frontierSouthPursuitPath:path,frontierSouthPursuitField:field,frontierSouthCells:cells,FRONTIER_SOUTH_ENEMIES:spawns}=ctx.test;
const first=spawns.filter(({x,z})=>x>=156&&x<=164&&z>=82&&z<=86);
assert.equal(first.length,0,'initial chamber spawns are absent');
assert.equal(new Set(spawns.map(({x,z})=>x+','+z)).size,spawns.length,'stable unique spawn cells');
assert.ok(spawns.every(({x,z})=>cells.has(x+','+z)),'all spawns sit on valid floors');
const hero={key:'player',x:159,z:82},npc={key:'npc/regna',x:158,z:82};
assert.equal(pick({x:160,z:82},null,[hero,npc],6,()=>false),null,'LOS is required for first notice');
assert.equal(pick({x:160,z:82},null,[hero,npc],6,()=>true),hero);
assert.equal(pick({x:160,z:82},npc.key,[hero,npc],6,()=>false),npc,'NPC remains recognized even behind wall');
hero.x=168;hero.z=121;
assert.equal(pick({x:160,z:82},hero.key,[hero,npc],6,()=>false),hero,'hero is remembered across distance/rooms');
assert.equal(pick({x:160,z:82},hero.key,[npc],6,()=>true),npc,'hero leaving floor releases and permits another target');
const allowed=(x,z)=>cells.has(x+','+z);
const goal={x:160,z:80},start={x:160,z:122};
const distances=field(goal,allowed);
assert.ok(distances.get(160*256+122)>42,'route turns through rooms rather than travelling straight through rock');
let count=0,p=start;
while(p.x!==goal.x||p.z!==goal.z){
 const step=path(p,distances,()=>true);
 assert.ok(step&&allowed(step.x,step.z));
 assert.ok(Math.abs(step.x-p.x)+Math.abs(step.z-p.z)===1,'cardinal neighbor per tick');
 p=step;assert.ok(++count<130);
}
assert.ok(count>45);
assert.equal(path(start,distances,()=>false),null,'occupied neighbors not entered');
assert.match(html,/frontierSouthPursuitFrame\(obj,state,now,human\)/);
assert.match(html,/frontierExpeditionEnemyTurn\(o,s,now,target\.actor\)/);
console.log('PASS first room clear, unique valid authored spawn points, long routed chase, LOS acquisition, retained player/NPC memory, dynamic occupancy');
// Runtime step uses the same remembered target for residents while the player
// is upstairs; when the doorway shuts behind the NPC, continue around it.
const rs={x:160,z:122,hp:160,nextAttack:0},ro={y:-1,type:'monsterBasaltHound'};
const target={x:160,z:80,y:-1,kind:'npc',key:'npc/regna',actor:{role:{id:'regna'},y:-1,hp:100}};
Object.assign(ctx,{frontierSouthRuinsOwn:allowed,poiSouthSentinelSpec:()=>({notice:7}),poiCompanionAttackClear:()=>false,
 frontierExpeditionEnemyTurn:()=>false,poiMonsterMeshDirty:false});
vm.runInNewContext('',ctx);
const rt=vm.runInContext('(o,s,now,human)=>frontierSouthPursuitFrame(o,s,now,human)',ctx);
const footprint={people:[target],occupied:new Set([160*256+80]),enemies:new Set([160*256+122])};
rt(ro,rs,10,footprint);assert.equal(rs.southPursuit,null);assert.equal(rs.z,122);
rs.southPursuit=target.key;rt(ro,rs,390,footprint);assert.equal(rs.southPursuit,target.key);
assert.ok(rs.x!==160||rs.z!==122);
const before=[rs.x,rs.z];footprint.people=[];rt(ro,rs,770,footprint);assert.equal(rs.southPursuit,null);
assert.deepEqual([rs.x,rs.z],before,'monster stops tracking after human exits');
console.log('PASS runtime remembered offscreen resident moves, then releases after departure');
// Run both actual parties through real range/LOS, attack begin and footprint
// functions, at opposite ends of the corridor layout (not an adjacent mock).
const block=(begin,end)=>{const lo=html.indexOf(begin),hi=html.indexOf(end,lo);
 assert(lo>=0&&hi>lo);return html.slice(lo,hi)};
const ally={id:'human:frontierregna',y:-1,site:ctx.facilitySite,travel:0};
Object.assign(ctx,{poiWalkLevel:-1,poiWalkX:160,poiWalkZ:82,poiEnemyPending:new Set(),poiMonsterStates:new Map(),
 poiAimWall:()=>allowed,POI_AIM_EPS:1e-7,poiPartyActors:()=>[ally],poiCompanionAllowed:()=>true,
 frontierPlaneMatches:()=>true,poiEnemyThreatEnabled:()=>true});
vm.runInContext(block('// BEGIN SOUTH SENTINEL COMBAT','// END SOUTH SENTINEL COMBAT')+
 block('function poiAimWallLimit(','function poiAimChooseLock(')+
 block('function poiEnemyRangedCovers(','function poiEnemyRangedContact(')+
 block('function poiCompanionPlace(','function poiCompanionSoulFlight(')+
 block('function poiEnemyAllyValid(','function poiEnemyAllyChoice(')+
 block('function poiEnemyBeginPlayer(','function poiEnemyCancelPlayer('),ctx);
const covered=vm.runInContext('(q,p)=>poiSouthSentinelCovered(q,p)',ctx);
for(const kind of ['player','party'])for(const type of ['monsterBasaltHound','monsterRuneWarden','monsterObsidianRegent']){
 const target={key:kind,kind,x:160,z:82,y:-1,...(kind==='party'?{actor:ally}:{})};
 const object={type,y:-1,x:160,z:122,southLeash:[152,116,168,126]};
 const state={x:160,z:122,hp:100,nextAttack:0,southPursuit:target.key};
 ctx.poiWalkX=kind==='party'?147:target.x;ctx.poiWalkZ=kind==='party'?94:target.z;
 ctx.poiMonsterStates=new Map([[object,state]]);
 const occupied=new Set([160*256+82]),enemies=new Set([160*256+122]);
 for(let i=0;i<140&&!state.playerAttack;i++)rt(object,state,i*400,{people:[target],occupied,enemies});
 assert.ok(state.playerAttack&&state.playerAttack.start>8000,`${type} navigates through multiple rooms and attacks ${kind}`);
 assert.equal(state.playerAttack.companionVictim,kind==='party'?ally:undefined);
 assert.ok(covered(state.playerAttack.southSentinel,target),`${type} can land the authored hit after a long ${kind} pursuit`);
}
console.log('PASS actual ally validation, late windup and wall-clipped hit footprint for all three enemy types vs player and human companion across dungeon');
