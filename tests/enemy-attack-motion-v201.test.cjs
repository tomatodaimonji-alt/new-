const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const h=fs.readFileSync('world-editor.html','utf8');
function runtime(){
 const a=h.indexOf('// BEGIN ENEMY ATTACK MOTION'),b=h.indexOf('// END ENEMY ATTACK MOTION');
 assert.ok(a>=0&&b>a,'new pose engine deployed');
 const c={poiMineGuardPose:()=>({phase:'windup',dx:0,dz:0,lift:0,squash:1,width:1,facing:3}),poiSlimeAttackPose:()=>7,poiPondSkaterPose:()=>8};
 vm.createContext(c);vm.runInContext(h.slice(a,b),c);return c;
}
test('all ordinary, armed and strong foe types show anticipations, actual release and recovery',()=>{
 const c=runtime();
 for(const type of ['monsterSkeleton','monsterGoblin','monsterSkelWarrior','monsterSkelKnight','monsterSkelArcher','monsterSkelSpearman','monsterSkelMage','monsterSkelLongStaff','monsterDragon']){
  const a={start:100,hit:740,dx:1,dz:0,pending:true},s={playerAttack:a};
  const draw=c.poiEnemyVisualAttack(type,s,390),cast=c.poiEnemyVisualAttack(type,s,728);
  assert.equal(draw.phase,'windup',type);assert.equal(cast.phase,'release',type);
  assert.equal(draw.facing,3);assert.notDeepEqual([draw.dx,draw.pitch,draw.twist],[cast.dx,cast.pitch,cast.twist]);
  a.pending=false;a.visualHitAt=900;
  assert.equal(c.poiEnemyVisualAttack(type,s,900).phase,'impact',type);
  assert.equal(c.poiEnemyVisualAttack(type,s,1030).phase,'recover',type);
  assert.equal(c.poiEnemyVisualAttack(type,s,2000),null);
 }
});
test('strong variants alternate deterministically without changing committed direction or existing critters',()=>{
 const c=runtime();
 for(const type of ['monsterSkelKnight','monsterDragon','monsterMineGuard']){
  const s={playerAttack:{start:100,hit:740,dx:1,dz:0,pending:true}};
  const variants=Array.from({length:3},()=>c.poiEnemyNextVisualVariant(type,s));
  assert.equal(variants[0],0);assert.equal(variants[1],1);assert.equal(variants[2],0);
  s.playerAttack.motion=0;const first=c.poiEnemyVisualAttack(type,s,620);
  s.playerAttack.motion=1;const second=c.poiEnemyVisualAttack(type,s,620);
  assert.notEqual(first.variant,second.variant);
  assert.notDeepEqual([first.pitch,first.twist,first.lift],[second.pitch,second.twist,second.lift]);
  assert.equal(first.facing,second.facing);
 }
 assert.equal(c.poiEnemyVisualAttack('monsterSlime',{},100),7);
 assert.equal(c.poiEnemyVisualAttack('monsterPondSkater',{},100),8);
});
