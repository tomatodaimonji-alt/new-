const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const h=fs.readFileSync(process.env.QA_HTML||'world-editor.html','utf8'),slice=(a,b)=>h.slice(h.indexOf(a),h.indexOf(b,h.indexOf(a)+1));
function fixture(){
 const c={poiWalkLevel:-1,poiWalkX:116,poiWalkZ:62,facilitySite:{id:'base',
  mine:{bounds:{x1:86,x2:125,z1:41,z2:67,y:-1},stairs:{x:116,z:62},earlyRoom:{safe:{x1:114,x2:117,z1:60,z2:62,y:-1}}},
  chapel:{bounds:{x1:60,x2:82,z1:73,z2:90,y:-1},dungeonStand:{x:78,z:88}},otherworld:{bounds:{x1:95,x2:124,z1:72,z2:92,y:-1},dungeonStand:{x:100,z:90}}},
  world:[{x:114,z:59,y:-1,type:'stone'},{x:116,z:59,y:-1,type:'stone'}],
  poiChapelEliteMatch:o=>o.type==='monsterSkeleton'&&o.x===79,poiMineEarlyMayMove:()=>true,poiOtherworldEnemyMayFight:()=>true,poiArmedBound:()=>true,poiMonsterCanMove:()=>true,isFloor:t=>t==='stone'||t==='water',
  poiDungeonPointIn:(b,x,z,y)=>!!b&&b.y===y&&b.x1<=x&&x<=b.x2&&b.z1<=z&&z<=b.z2};
 const code=slice('// BEGIN DUNGEON PATROL','// END DUNGEON PATROL');assert.ok(code.startsWith('// BEGIN DUNGEON PATROL'));
 vm.createContext(c);vm.runInContext(code,c);return c;
}
test('entrance shelter is unattackable to roaming mobs while the three bosses remain untouched',()=>{
 const c=fixture();
 for(const [o,at] of [
  [{x:115,z:59,y:-1,type:'monsterSlime'},[116,60]],
  [{x:76,z:79,y:-1,type:'monsterSlime'},[78,88]],
  [{x:109,z:88,y:-1,type:'monsterSkelArcher'},[101,89]]
 ]){
  assert.ok(c.poiDungeonPatrolSite(o));assert.equal(c.poiDungeonPatrolCanFight(o,...at),false);
 }
 for(const o of [{x:120,z:55,type:'monsterMineGuard'},{x:101,z:79,type:'monsterDragon'},{x:79,z:78,type:'monsterSkeleton'}]){
  o.y=-1;assert.equal(c.poiDungeonPatrolSite(o),null);assert.equal(c.poiDungeonPatrolCanFight(o,116,62),true);
 }
});
test('nearby patrol advances occasionally, never through a door, onto wet/no floor, or outside home tether',()=>{
 const c=fixture(),o={x:115,z:59,y:-1,type:'monsterSlime'},s={x:115,z:59,moveStarted:-10000,nextPatrol:0};
 assert.equal(c.poiDungeonPatrolStep(o,s,1000),true);
 assert.equal(s.z,59);assert.ok([114,116].includes(s.x));assert.equal(s.fromX,115);
 assert.equal(c.poiDungeonPatrolStep(o,s,1100),false);
 c.world=[{x:115,z:59,y:-1,type:'water'},{x:115,z:58,y:-1,type:'stone'},{x:115,z:58,y:-1,type:'ruinDoorBroken'}];
 s.nextPatrol=0;
 assert.equal(c.poiDungeonPatrolStep(o,s,9000),false);
 assert.equal(c.poiDungeonPatrolCanFight(o,107,59),true,'home tether does not rewrite existing pursuit reach');
});
