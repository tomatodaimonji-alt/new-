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
 const windup=c.poiSlimeAttackPose(mob,420);c.poiEnemyResolvePlayer(520);
 const contact=c.poiSlimeAttackPose(mob,520),land=c.poiSlimeAttackPose(mob,630);
 assert.equal(windup.phase,'lunge');assert.ok(windup.squash<.7);
 assert.equal(contact.phase,'contact');assert.ok(contact.dx>.5&&contact.dz===0&&contact.lift>.15);
 assert.equal(land.phase,'land');assert.ok(land.dx<.1);
 assert.equal(c.poiSlimeAttackPose(mob,710),null);
 assert.deepEqual([mob.x,mob.z,mob.nextAttack],[4,5,1250]);
});
test('only the actual contact hits and only once; dodging and death clear pending hits',()=>{
 const {c,mob,obj,hits}=setup();c.poiEnemyBeginPlayer(obj,mob,100);
 c.poiEnemyResolvePlayer(519);assert.deepEqual(hits,[]);
 c.poiEnemyResolvePlayer(520);c.poiEnemyResolvePlayer(550);assert.deepEqual(hits,[520]);
 c.poiEnemyBeginPlayer(obj,mob,1250);c.poiWalkZ=6;c.poiEnemyResolvePlayer(1670);assert.deepEqual(hits,[520]);
 c.poiWalkZ=5;c.poiEnemyBeginPlayer(obj,mob,2400);mob.hp=0;c.poiEnemyResolvePlayer(2820);assert.deepEqual(hits,[520]);
});
test('NPC counter uses the same contact pose toward its saved target and does not create a player strike',()=>{
 const {c,mob,hits}=setup();
 Object.assign(mob,{townOwned:true,counterAt:50,counterTargetX:4,counterTargetZ:4});
 const attack=c.poiSlimeAttackPose(mob,220);
 assert.equal(attack.phase,'contact');assert.ok(attack.dz<-.5&&attack.dx===0);
 c.poiEnemyResolvePlayer(220);assert.deepEqual(hits,[]);
});
test('foreground loss between frames cancels pending visual and contact without resetting cooldown',()=>{
 const {c,mob,obj,hits}=setup();c.poiEnemyBeginPlayer(obj,mob,100);
 c.poiEnemyCancelPlayer();c.poiEnemyResolvePlayer(520);
 assert.equal(c.poiSlimeAttackPose(mob,520),null);assert.equal(mob.nextAttack,1250);assert.deepEqual(hits,[]);
 const leave=html.slice(html.indexOf('window.__workshopAudioForeground='),html.indexOf('const POI_PLAYER_MAX_HP='));
 assert.match(leave,/if\(!visible\)\{[^}]*poiEnemyCancelPlayer/);
 assert.match(html,/visibilitychange',\(\)=>\{if\(document.hidden\)\{poiWildPause\(\);poiEnemyCancelPlayer\(\)/);
 assert.match(html,/pagehide',\(\)=>\{poiWildPause\(\);poiEnemyCancelPlayer\(\)/);
});
test('slow frames pin the displayed peak to the actual contact, not a later landing',()=>{
 const {c,mob,obj,hits}=setup();c.poiEnemyBeginPlayer(obj,mob,100);
 assert.equal(c.poiSlimeAttackPose(mob,660).phase,'lunge','pending contact cannot animate past the target');
 c.poiEnemyResolvePlayer(661);assert.deepEqual(hits,[661]);
 assert.equal(c.poiSlimeAttackPose(mob,661).phase,'contact');
 assert.equal(c.poiSlimeAttackPose(mob,661).elapsed,170);
 assert.equal(c.poiSlimeAttackPose(mob,851),null);
 assert.equal(mob.nextAttack,1250,'cooldown remains scheduled from initiation');
});
