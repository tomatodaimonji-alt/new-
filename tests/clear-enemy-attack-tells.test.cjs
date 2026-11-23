const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {runInNewContext}=require('node:vm');
const html=readFileSync(process.env.WORKSHOP_HTML||require('node:path').join(__dirname,'../world-editor.html'),'utf8');
const cut=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
const vm={};
runInNewContext(cut('function poiPondSkaterPose(','// END POND SKATER')+
 cut('// BEGIN SLIME ATTACK','// END SLIME ATTACK'),vm);
const attack=()=>({start:0,hit:600,dx:1,dz:0,pending:true});
test('normal play does not paint ground attack tiles but keeps canonical threat telemetry and hit validation',()=>{
 const renderer=cut('function render(){','function draw(');
 assert(!renderer.includes('poiDrawEnemyThreatTiles('));
 assert.match(html,/function poiEnemyThreatTiles\(now\)\{/);
 const resolve=cut('function poiEnemyResolvePlayer(','// END SLIME ATTACK');
 assert.match(resolve,/if\(now<a.hit\)continue/);
 assert.match(resolve,/!timely\|\|!covered/);
 assert.match(resolve,/s.slimeRecoverUntil=now\+POI_SLIME_RECOVERY_MS/);
});
test('foes pre-load a distinct readable pose early, hold, then contact only when resolved',()=>{
 for(const type of ['monsterSkeleton','monsterGoblin','monsterSkelWarrior','monsterSkelKnight','monsterSkelArcher','monsterSkelSpearman','monsterSkelMage','monsterSkelLongStaff','monsterDragon','monsterMineGuard']){
  const a=attack(),s={playerAttack:a};
  const drawn=vm.poiEnemyVisualAttack(type,s,250),released=vm.poiEnemyVisualAttack(type,s,597);
  assert.equal(drawn.phase,'windup',type);
  assert(drawn.tell>.55,type);
  assert(released.tell<drawn.tell,type);
  assert(Math.abs(drawn.pitch)+Math.abs(drawn.twist)>.53,type);
  assert.equal(released.phase,'release',type);
  assert(Math.abs(released.dx)<.62,type);
  a.pending=false;a.visualHitAt=650;
  const contact=vm.poiEnemyVisualAttack(type,s,650);
  assert.equal(contact.phase,'impact',type);
  assert(released.dx<contact.dx,type);
  assert.equal(vm.poiEnemyVisualAttack(type,s,800).phase,'recover',type);
 }
});
test('slime and skater have their own readable tells while keeping contact locations and distinct recoveries',()=>{
 const a=attack(),s={playerAttack:a};
 const slime=vm.poiSlimeAttackPose(s,250),skater=vm.poiPondSkaterPose(s,250);
 assert(slime.tell>.55&&slime.squash<.63);
 assert(skater.tell>.55&&skater.squash<.77);
 a.pending=false;a.visualHitAt=600;s.slimeRecoverUntil=2100;
 assert(vm.poiSlimeAttackPose(s,600).dx===.60);
 assert(vm.poiPondSkaterPose(s,600).dx===.55);
 assert.equal(vm.poiSlimeAttackPose(s,920).phase,'recover-rest');
});
