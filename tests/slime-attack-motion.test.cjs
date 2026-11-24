const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(process.env.HTML||path.join(__dirname,'..','world-editor.html'),'utf8');
function setup(){
 const m=html.match(/\/\/ BEGIN SLIME ATTACK\n([\s\S]*?)\/\/ END SLIME ATTACK/);assert.ok(m,'slime attack animation and contact runtime');
 const obj={type:'monsterSlime',y:0},mob={x:4,z:5,hp:20,nextAttack:0},hits=[];
 const c=vm.createContext({poiWalkActive:true,poiWalkLevel:0,poiWalkX:5,poiWalkZ:5,pineAIActive:false,facilitySite:{id:'base'},
  poiMonsterStates:new Map([[obj,mob]]),poiWildPlayerOutside:()=>true,poiPlayerDying:()=>false,poiAudioAllowed:()=>true,poiMonsterMeshDirty:false,
  poiMobHitPlayer:(_obj,now)=>{hits.push(now);return false}});
 vm.runInContext(m[1],c);return {obj,mob,hits,c};
}
test('a clear squash, directed contact pose, and settled recovery leave grid coordinates unchanged',()=>{
 const {c,mob,obj}=setup();c.poiEnemyBeginPlayer(obj,mob,100);
 const windup=c.poiSlimeAttackPose(mob,480);c.poiEnemyResolvePlayer(580);
 const contact=c.poiSlimeAttackPose(mob,580),land=c.poiSlimeAttackPose(mob,690);
 assert.equal(windup.phase,'lunge');assert.ok(windup.squash<.7);
 assert.equal(contact.phase,'contact');assert.ok(contact.dx>.5&&contact.dz===0&&contact.lift>.15);
 assert.equal(land.phase,'land');assert.ok(land.dx<.1);
 assert.equal(c.poiSlimeAttackPose(mob,770).phase,'recover-rest');
 assert.equal(c.poiSlimeAttackPose(mob,1060),null);
 assert.deepEqual([mob.x,mob.z,mob.nextAttack],[4,5,2080]);
});
test('only the actual contact hits and only once; dodging and death clear pending hits',()=>{
 const {c,mob,obj,hits}=setup();c.poiEnemyBeginPlayer(obj,mob,100);
 c.poiEnemyResolvePlayer(579);assert.deepEqual(hits,[]);
 c.poiEnemyResolvePlayer(580);c.poiEnemyResolvePlayer(610);assert.deepEqual(hits,[580]);
 assert(c.poiEnemyBeginPlayer(obj,mob,2080));c.poiWalkZ=6;c.poiEnemyResolvePlayer(2560);assert.deepEqual(hits,[580]);
 c.poiWalkZ=5;assert(c.poiEnemyBeginPlayer(obj,mob,4060));mob.hp=0;c.poiEnemyResolvePlayer(4540);assert.deepEqual(hits,[580]);
});
test('NPC counter uses the same contact pose toward its saved target and does not create a player strike',()=>{
 const {c,mob,hits}=setup();
 Object.assign(mob,{townOwned:true,counterAt:50,counterTargetX:4,counterTargetZ:4});
 const attack=c.poiSlimeAttackPose(mob,220);
 assert.equal(attack.phase,'contact');assert.ok(attack.dz<-.5&&attack.dx===0);
 c.poiEnemyResolvePlayer(220);assert.deepEqual(hits,[]);
});
test('foreground loss preserves the same resolved slime contact and cooldown',()=>{
 const {c,mob,obj,hits}=setup();c.poiEnemyBeginPlayer(obj,mob,100);
 const a=html.indexOf('// BEGIN WORKSHOP SUSPENDABLE GAME CLOCK'),b=html.indexOf('// END WORKSHOP SUSPENDABLE GAME CLOCK',a);
 c.wall=410;c.window={performance:{now:()=>c.wall},pineStartup:{},addEventListener(){}};
 c.document={hidden:false,addEventListener(){}};
 const frame=vm.runInContext(html.slice(a,b)+';()=>{if(!poiGameFrozen())poiEnemyResolvePlayer(performance.now())}',c);
 const pending=mob.playerAttack,ready=mob.nextAttack;
 c.window.__workshopForegroundChanged(false);c.wall+=10000;frame();
 assert.equal(mob.playerAttack,pending);assert.equal(mob.nextAttack,ready);assert.deepEqual(hits,[]);
 c.window.__workshopForegroundChanged(true);c.wall+=169;frame();assert.deepEqual(hits,[]);
 c.wall+=1;frame();assert.deepEqual(hits,[580]);assert.equal(mob.playerAttack,pending);
});
test('slow frames pin the displayed peak to the actual contact, not a later landing',()=>{
 const {c,mob,obj,hits}=setup();c.poiEnemyBeginPlayer(obj,mob,100);
 assert.equal(c.poiSlimeAttackPose(mob,720).phase,'lunge','pending contact cannot animate past the target');
 c.poiEnemyResolvePlayer(721);assert.deepEqual(hits,[721]);
 assert.equal(c.poiSlimeAttackPose(mob,721).phase,'contact');
 assert.equal(c.poiSlimeAttackPose(mob,721).elapsed,170);
 assert.equal(c.poiSlimeAttackPose(mob,911).phase,'recover-rest');
 assert.equal(mob.nextAttack,2221,'recovery begins from actual resolution');
});
