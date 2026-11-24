const {test}=require('node:test'),a=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function rig(){
 const i=h.indexOf('// BEGIN COMPANION V2 AI'),j=h.indexOf('// END COMPANION V2 AI');
 a.ok(i>=0&&j>i,'actual companion decision functions');
 const soul={id:'slimeSoul',x:10,z:10,y:0},foe={type:'monsterSlime',y:0},state={x:11,z:10,hp:35},hits=[];
 const c=vm.createContext({poiCompanionActor:soul,poiCompanionTarget:null,poiWalkX:13,poiWalkZ:10,poiWalkLevel:0,
  POI_SLIME_CONTACT_MS:137,POI_SLIME_RECOVERY_MS:1400,poiMonsterStates:new Map([[foe,state]]),
  poiCompanionNormal:(o,s)=>!s.townOwned&&o.type==='monsterSlime',poiCompanionSame:()=>true,poiCompanionPlace:()=>({}),
  poiCompanionAllowed:()=>true,poiCompanionPose:a=>a,poiCompanionAttackClear:()=>true,poiEnemyAdjacent:(_o,s,x,z)=>Math.hypot(s.x-x,s.z-z)<1.5,
  poiCompanionType:()=>({attack:6}),poiPlayerDamageTarget:(_m,_x,_z,d)=>hits.push(d),poiHotbarHasKit:()=>true});
 vm.runInContext(h.slice(i,j),c);return {c,soul,foe,state,hits};
}
test('selection prefers close visible ally but player wins ties; terrain and floor reject',()=>{
 const f=rig(),{c,soul,foe,state}=f;
 a.equal(c.poiCompanionHostileIntent(foe,state,100).actor,soul);
 c.poiWalkX=12;a.equal(c.poiCompanionHostileIntent(foe,state,100),null);
 c.poiWalkX=13;c.poiCompanionAttackClear=()=>false;a.equal(c.poiCompanionHostileIntent(foe,state,100),null);
 c.poiCompanionAttackClear=()=>true;soul.y=1;a.equal(c.poiCompanionHostileIntent(foe,state,100),null);
});
test('an autonomous attack has a true fixed windup, one settled contact, and cannot reach beyond tether',()=>{
 const {c,soul,foe,state,hits}=rig();c.poiWalkX=12;
 const target=c.poiCompanionFindTarget(soul,100);a.equal(target.o,foe);
 a.equal(c.poiCompanionCommit(soul,target,100),true);a.equal(soul.attackMotion.hit,237);
 a.equal(c.poiCompanionResolve(soul,236,'auto'),true);a.deepEqual(hits,[]);
 c.poiCompanionResolve(soul,237,'auto');c.poiCompanionResolve(soul,238,'auto');a.deepEqual(hits,[6]);
 c.poiWalkX=19;a.equal(c.poiCompanionFindTarget(soul,500),null);
});
test('flee/disengage cancels contact without applying damage',()=>{
 const {c,soul,foe,state,hits}=rig();c.poiWalkX=12;
 c.poiCompanionCommit(soul,{o:foe,s:state},100);
 c.poiCompanionResolve(soul,237,'flee');a.deepEqual(hits,[]);a.equal(soul.attackMotion.pending,false);
});
test('physical ally reserves current and next core cells to avoid hostile stacking',()=>{
 const {c,soul}=rig();
 soul.x=11;
 c.poiCompanionPose=()=>({x:10.25,z:10});
 a.equal(c.poiCompanionBlocksHostileTile(10,10,0,100),true);
 a.equal(c.poiCompanionBlocksHostileTile(11,10,0,100),true);
 a.equal(c.poiCompanionBlocksHostileTile(12,10,0,100),false);
 a.equal(c.poiCompanionBlocksHostileTile(11,10,1,100),false);
});
test('mine landing and otherworld patrol rules apply to both actors, not just one endpoint',()=>{
 const {c,soul,foe,state}=rig();
 c.poiMineEarlyMayMove=(_o,x)=>x!==13;
 a.equal(c.poiCompanionHostileIntent(foe,state,100),null);
 a.equal(c.poiCompanionFindTarget(soul,100),null);
 c.poiMineEarlyMayMove=(_o,x)=>x!==10;
 a.equal(c.poiCompanionHostileIntent(foe,state,100),null);
 c.poiMineEarlyMayMove=()=>true;
 c.poiOtherworldEnemyMayFight=(_o,x)=>x!==10;
 a.equal(c.poiCompanionHostileIntent(foe,state,100),null);
 a.equal(c.poiCompanionFindTarget(soul,100),null);
});
