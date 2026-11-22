const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const h=fs.readFileSync(process.env.HTML||path.join(__dirname,'..','world-editor.html'),'utf8');
function setup(blocked=[]){
 const m=h.match(/\/\/ BEGIN SLIME ATTACK\n([\s\S]*?)\/\/ END SLIME ATTACK/);assert.ok(m);
 const obj={type:'monsterMineGuard',x:40,z:40,y:-1},s={x:40,z:40,hp:140,nextAttack:0},hits=[];
 const c=vm.createContext({facilitySite:{id:'base',mine:{guardian:{type:'monsterMineGuard',x:40,z:40,y:-1},bounds:{x1:35,x2:47,z1:35,z2:48},chamber:{x1:38,x2:45,z1:37,z2:42}}},poiWalkActive:true,pineAIActive:false,poiWalkLevel:-1,poiWalkX:41,poiWalkZ:40,
  poiAudioAllowed:()=>true,poiPlayerDying:()=>false,poiMonsterStates:new Map([[obj,s]]),poiMonsterMeshDirty:false,
  poiMonsterCanMove:(x,z)=>!blocked.some(([a,b])=>x===a&&z===b),poiWalkCanStep:(x,z)=>!blocked.some(([a,b])=>x===a&&z===b),poiMobHitPlayer:(_o,t)=>hits.push(t)&&false});
 vm.runInContext(m[1],c);return {c,obj,s,hits};
}
test('guardian warns six fixed forward tiles, hits once on any warned tile, and leaves a recovery window',()=>{
 const {c,obj,s,hits}=setup();assert.equal(c.poiEnemyBeginPlayer(obj,s,100),true);
 const first=c.poiEnemyThreatTiles(200);
 assert.equal(first.length,6);assert.ok(first.every(t=>t.x>40&&t.y===-1&&t.hit===1150));
 c.poiWalkX=42;c.poiWalkZ=41;
 assert.deepEqual(c.poiEnemyThreatTiles(1100),first);
 c.poiEnemyResolvePlayer(1149);assert.deepEqual(hits,[]);
 c.poiEnemyResolvePlayer(1150);c.poiEnemyResolvePlayer(1170);assert.deepEqual(hits,[1150]);
 assert.equal(c.poiEnemyBeginPlayer(obj,s,2000),false);
 assert.equal(c.poiMineGuardPose(s,1150).phase,'impact');
});
test('turning a corner or switching floor defeats the warned strike; no wall-behind cells',()=>{
 const {c,obj,s,hits}=setup([[41,41]]);
 assert.equal(c.poiEnemyBeginPlayer(obj,s,100),true);
 assert.ok(!c.poiEnemyThreatTiles(200).some(t=>t.z===41));
 c.poiWalkX=42;c.poiWalkZ=41;c.poiEnemyResolvePlayer(1150);assert.deepEqual(hits,[]);
 c.poiWalkX=41;c.poiWalkZ=40;assert.equal(c.poiEnemyBeginPlayer(obj,s,2600),true);
 c.poiWalkLevel=0;c.poiEnemyResolvePlayer(3650);assert.deepEqual(hits,[]);
});
test('both solid corner tiles stop a diagonal aim',()=>{
 const {c,obj,s}=setup([[40,41],[41,40]]);c.poiWalkX=41;c.poiWalkZ=41;
 assert.equal(c.poiEnemyBeginPlayer(obj,s,100),false);
 assert.equal(c.poiEnemyThreatTiles(200).length,0);
});
test('a dropped foreground frame still resolves the larger sweep once, but a stale sweep never hits',()=>{
 const {c,obj,s,hits}=setup();
 assert(c.poiEnemyBeginPlayer(obj,s,100));
 c.poiEnemyResolvePlayer(1410);c.poiEnemyResolvePlayer(1420);
 assert.deepEqual(hits,[1410]);
 assert(c.poiEnemyBeginPlayer(obj,s,2600));
 c.poiEnemyResolvePlayer(4251);
 assert.deepEqual(hits,[1410]);
});
test('the entrance slime has its own room and cannot enter or block the guardian lanes',()=>{
 const start=h.indexOf('function poiMineEarlyMayMove('),end=h.indexOf('function poiMobFrame(',start);
 assert(start>=0&&end>start);
 const slime={x:115,z:59,y:-1,type:'monsterSlime'};
 const c=vm.createContext({facilitySite:{id:'base',mine:{early:slime,stairs:{x:116,z:62}}}});
 vm.runInContext(h.slice(start,end),c);
 assert.equal(c.poiMineEarlyMayMove(slime,117,59),true);
 assert.equal(c.poiMineEarlyMayMove(slime,116,58),false);
 assert.equal(c.poiMineEarlyMayMove(slime,119,56),false);
 assert.equal(c.poiMineEarlyMayMove({...slime,y:0},119,56),true);
});
test('guardian takes a single cardinal step only inside chamber and cannot aim until the slide finishes',()=>{
 const {c,obj,s}=setup();c.poiWalkX=44;c.poiWalkZ=40;
 assert.equal(typeof c.poiMineGuardFrame,'function');
 assert.equal(c.poiMineGuardFrame(obj,s,100),true);
 assert.deepEqual([s.x,s.z,s.fromX,s.fromZ,s.guardSlideUntil],[41,40,40,40,950]);
 c.poiWalkX=42;
 assert.equal(c.poiEnemyBeginPlayer(obj,s,800),false);
 assert.equal(c.poiEnemyBeginPlayer(obj,s,950),true);
 assert.equal(s.playerAttack.sx,41);assert.equal(s.playerAttack.hit,2000);
 c.poiWalkZ=44;assert.equal(c.poiMineGuardFrame(obj,s,1200),false);
 c.poiEnemyResolvePlayer(2100);
 c.poiWalkX=45;c.poiWalkZ=40;
 assert.equal(c.poiMineGuardFrame(obj,s,2800),false);
 assert.equal(c.poiMineGuardFrame(obj,s,2850),true);
 assert.deepEqual([s.x,s.z],[42,40]);
});
test('reserved doorway, off-floor player, and ordinary attackable position cannot cause a chase',()=>{
 const {c,obj,s}=setup();c.poiWalkX=41;c.poiWalkZ=40;
 assert.equal(c.poiMineGuardFrame(obj,s,100),false);assert.equal(s.playerAttack.hit,1150);
 c.poiEnemyCancelPlayer();c.poiWalkZ=43;c.poiWalkX=40;
 assert.equal(c.poiMineGuardFrame(obj,s,2600),false);
 c.poiWalkX=45;c.poiWalkZ=42;c.poiWalkLevel=0;
 assert.equal(c.poiMineGuardFrame(obj,s,2800),false);
 const g=setup([[41,41]]);g.s.z=41;g.c.poiWalkX=44;g.c.poiWalkZ=42;
 // The remaining direction would land on the reserved exit approach.
 assert.equal(g.c.poiMineGuardFrame(g.obj,g.s,3000),false);assert.deepEqual([g.s.x,g.s.z],[40,41]);
});
test('while sliding melee follows the nearer visible tile but movement reserves both tiles',()=>{
 const start=h.indexOf('function poiMonsterAt('),end=h.indexOf('\n',start);
 const c=vm.createContext({poiWalkLevel:-1,facilitySite:{id:'base'},performance:{now:()=>200},poiMonsterStates:new Map()});
 const actor={type:'monsterMineGuard',y:-1};
 c.poiMonsterStates.set(actor,{hp:140,x:41,z:40,fromX:40,fromZ:40,moveStarted:100,guardSlideUntil:950,guardMoveMs:850});
 const stop=h.indexOf('\nfunction ',end);
 vm.runInContext(h.slice(start,stop),c);
 assert.equal(c.poiMonsterAt(40,40)?.[0],actor);assert.equal(c.poiMonsterAt(41,40),null);
 assert.equal(c.poiMonsterAt(41,40,true)?.[0],actor);
 c.performance.now=()=>650;
 assert.equal(c.poiMonsterAt(40,40),null);assert.equal(c.poiMonsterAt(41,40)?.[0],actor);
 assert.equal(c.poiMonsterAt(40,40,true)?.[0],actor);
 c.performance.now=()=>950;assert.equal(c.poiMonsterAt(40,40,true),null);
 const move=h.slice(h.indexOf('function poiWalkCanStep('),h.indexOf('const POI_SAFE_TOWN='));
 assert.match(move,/poiMonsterAt\(x,z,true\)/);
});
test('the same mine monster is named ゴーレム, remains AI object 340, and has 140 HP / 18 damage',()=>{
 const config=h.match(/const POI_MONSTER_STATS=([^;]+);/);
 assert.deepEqual(vm.runInNewContext('JSON.stringify(('+config[1]+').monsterMineGuard)'),JSON.stringify({hp:140,attack:18}));
 assert.match(h,/\{id:'monsterMineGuard',name:'ゴーレム'/);
 assert.match(h,/"number":"340","id":"monsterMineGuard","name":"ゴーレム"/);
 const external=require('../src/editor/ai-object-numbers.json').objects.find(o=>o.id==='monsterMineGuard');
 assert.deepEqual(external,{number:'340',id:'monsterMineGuard',name:'ゴーレム'});
 assert.doesNotMatch(h,/鉱山の番人/);
});
