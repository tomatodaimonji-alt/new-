const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {runInNewContext}=require('node:vm');
const html=readFileSync(process.env.WORKSHOP_HTML||require('node:path').join(__dirname,'../world-editor.html'),'utf8');
const extract=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
function setup(type='monsterSlime',opts={}){
 const obj={type,x:8,z:8,y:0},s={x:8,z:8,hp:35,nextAttack:0,...opts},hits=[];
 const m={s,obj,hits,poiMonsterStates:new Map([[obj,s]]),poiWalkX:9,poiWalkZ:8,poiWalkLevel:0,
  poiWalkActive:true,pineAIActive:false,pineGameActive:false,poiAudioAllowed:()=>true,poiPlayerDying:()=>false,
  facilitySite:null,poiWildPlayerOutside:()=>true,poiMobHitPlayer:(o,now)=>{hits.push(now);return false},
  poiNextMobTick:0,poiMineEarlyMayMove:()=>true,poiMonsterCanMove:()=>true,poiMonsterMeshDirty:false};
 runInNewContext(extract('const POI_FIELD_NOTICE=','const POI_WILD_BIRTH_MARGIN=')+extract('// BEGIN SLIME ATTACK','// END SLIME ATTACK')+
 extract('function poiMobFrame(now)','// Hand-authored standing points'),m);
 return m;
}
test('hit: 480 ms windup and unchanged single damage contact, reattack locked for 1500 ms after contact',()=>{
 const m=setup(),{obj,s}=m;
 assert.equal(m.poiEnemyBeginPlayer(obj,s,100),true);
 assert.equal(s.playerAttack.hit,580);
 m.poiEnemyResolvePlayer(579);assert.deepEqual(m.hits,[]);
 m.poiEnemyResolvePlayer(580);assert.deepEqual(m.hits,[580]);
 m.poiEnemyResolvePlayer(700);assert.deepEqual(m.hits,[580]);
 assert.equal(s.nextAttack,2080);
 assert.equal(m.poiEnemyBeginPlayer(obj,s,2079),false);
 assert.equal(m.poiEnemyBeginPlayer(obj,s,2080),true);
});
test('miss: no damage, chase remains frozen during recovery, then resumes',()=>{
 const m=setup('monsterSlime',{wildSpawn:true}),{obj,s}=m;
 assert(m.poiEnemyBeginPlayer(obj,s,100));
 m.poiWalkX=11;
 m.poiEnemyResolvePlayer(620);assert.deepEqual(m.hits,[]);
 assert.equal(s.nextAttack,2120);
 for(const now of [620,1000,1380,1760,2119]){
  m.poiMobFrame(now);
  // Ignore the global AI cadence to compare exact boundary behavior.
  assert.equal(s.x,8);
  m.poiNextMobTick=0;
 }
 m.poiMobFrame(2120);assert.equal(s.x,9);
});
test('landing keeps original contact geometry, followed by a stationary low pose; other foes keep own cadence',()=>{
 const m=setup(),{obj,s}=m;
 assert(m.poiEnemyBeginPlayer(obj,s,100));m.poiEnemyResolvePlayer(580);
 assert.equal(m.poiSlimeAttackPose(s,580).dx,.60);
 const still=m.poiSlimeAttackPose(s,1000);
 assert.equal(still.phase,'recover-rest');assert.equal(still.dx,0);assert.equal(still.dz,0);assert.equal(still.lift,0);assert(still.squash<1);
 assert.equal(m.poiSlimeAttackPose(s,2080),null);
 const g=setup('monsterGoblin');assert(g.poiEnemyBeginPlayer(g.obj,g.s,100));
 assert.equal(g.s.playerAttack.hit,650);g.poiEnemyResolvePlayer(650);
 assert.equal(g.s.nextAttack,1250);assert.equal(g.s.slimeRecoverUntil,undefined);
});
test('late frames do not resurrect expired damage but grant the full new pause after resolution',()=>{
 const m=setup(),{obj,s}=m;
 assert(m.poiEnemyBeginPlayer(obj,s,100));m.poiEnemyResolvePlayer(800);
 assert.deepEqual(m.hits,[]);assert.equal(s.nextAttack,2300);
 assert.equal(m.poiSlimeAttackPose(s,800).phase,'recover-rest');
});
