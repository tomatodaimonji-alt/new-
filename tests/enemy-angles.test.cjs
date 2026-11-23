const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const open=()=>true;
const cut=(x,y)=>{const i=html.indexOf(x),j=html.indexOf(y,i+1);a(i>=0&&j>i,x);return html.slice(i,j)};
function setup(){
 const ctx={poiWalkLevel:0,poiWalkCanStep:()=>true,poiPlayerRayClear:()=>true,
  poiArmedBound:()=>true,POI_ARMED_FOES:{monsterSkelWarrior:{reach:1},monsterSkelMage:{reach:4}}};
 const math=vm.runInNewContext(cut('// BEGIN ENEMY ANGLES','// END ENEMY ANGLES')+cut('function poiArmedAim(','function poiArmedLootOptions(')+
  ';({trace:poiEnemyAttackTrace,near:poiEnemyAdjacent,aim:poiArmedAim})',ctx);
 return {ctx,...math};
}
test('exact diagonal damages only actual traced cells, with normalized bearing',()=>{
 const {trace}=setup(),v=trace(0,0,2,2,open);
 a(!v.blocked);a(Math.abs(v.fx-Math.SQRT1_2)<1e-8);
 a.deepEqual(Array.from(v.tiles,t=>[t.x,t.z]),[[1,1],[2,2]]);
});
test('closed flank and directed diagonal entry each prevent corner hits',()=>{
 const {trace}=setup();
 a(trace(0,0,1,1,(x,z)=>x!==1||z!==0).blocked);
 a(trace(0,0,1,1,(x,z,fx,fz)=>!(x===1&&z===1&&fx===0&&fz===1)).blocked);
 a(!trace(0,0,1,1,open).blocked);
});
test('ordinary contact and custom dragons attack diagonally but exact Otherworld elite remains cardinal',()=>{
 const {near,ctx}=setup(),s={x:0,z:0},o={type:'monsterSlime'};
 a(near(o,s,1,1));a(!near(o,s,2,1));
 const dragon={type:'monsterDragon',x:101,z:79,y:-1};
 a(near(dragon,s,1,1),'custom/editor dragon uses the same 8-way melee');
 ctx.facilitySite={id:'base',otherworld:{elite:{...dragon}}};
 a(!near(dragon,s,1,1),'exact persisted gate elite keeps authored attack');
 a(near({...dragon,x:100},s,1,1),'different enemy of same type is not the gate elite');
 a(near(dragon,s,0,1));
 ctx.poiPlayerRayClear=(x,z)=>!(x===1&&z===0);
 a(!near(o,s,1,1));
});
test('ordinary armed one-tile melee swings diagonally and mage preserves true maximum range',()=>{
 const {aim,ctx}=setup(),s={x:0,z:0},sword={type:'monsterSkelWarrior'},mage={type:'monsterSkelMage'};
 a(aim(sword,s,1,1));a(!aim(sword,s,2,0));
 a(aim(mage,s,2,3));a(!aim(mage,s,3,3));
 ctx.poiWalkCanStep=(x,z)=>!(x===1&&z===0);a(!aim(mage,s,2,2));
});
test('ordinary diagonal begins, tracks recorded tile, resolves once and grants 1.5-second slime recovery',()=>{
 const monster={type:'monsterSlime',y:0},actor={x:0,z:0,hp:35,nextAttack:0};
 let impacts=0;
 const c={poiWalkX:1,poiWalkZ:1,poiWalkLevel:0,facilitySite:null,
  poiMonsterStates:new Map([[monster,actor]]),POI_ENEMY_WINDUP:{monsterSlime:480},POI_ENEMY_COOLDOWN:1150,POI_SLIME_RECOVERY_MS:1500,
  poiEnemyPending:new Set(),poiEnemyThreatEnabled:()=>true,poiEnemyContactTolerance:()=>170,
  poiEnemyAttackSourceValid:(s,a)=>a?.pending,poiMobHitPlayer:()=>{impacts++;return false},
  poiWalkCanStep:()=>true,poiPlayerRayClear:()=>true};
 const run=vm.runInNewContext(cut('// BEGIN ENEMY ANGLES','// END ENEMY ANGLES')+cut('function poiEnemyBeginPlayer(','// END SLIME ATTACK')+
  ';({begin:poiEnemyBeginPlayer,resolve:poiEnemyResolvePlayer})',c);
 a(run.begin(monster,actor,10));
 a.equal(actor.playerAttack.angular,true);
 a.deepEqual(Array.from(actor.playerAttack.tiles,t=>[t.x,t.z]),[[1,1]]);
 run.resolve(490);run.resolve(491);
 a.equal(impacts,1);a.equal(actor.nextAttack,1990);
 c.poiPlayerRayClear=(x,z)=>x!==1||z!==0;
 a.equal(run.begin(monster,actor,2100),false);
 c.poiPlayerRayClear=()=>true;a(run.begin(monster,actor,2200));
 c.poiWalkX=0;run.resolve(2680);
 a.equal(impacts,1,'moving to an adjacent corner flank evades the actual committed diagonal');
});
test('mage emits visible diagonal bolt only to still-clear covered tiles',()=>{
 const mage={type:'monsterSkelMage'},c={poiWalkActive:true,poiWalkLevel:0,poiEnemyMageBolts:[],
  poiPlayerRayClear:(x,z)=>x!==2||z!==1,poiWalkCanStep:()=>true};
 const run=vm.runInNewContext(cut('// BEGIN ENEMY ANGLES','// END ENEMY ANGLES')+
  cut('function poiEnemyMageBoltRelease(','function poiPlayerProjectileSample(')+';poiEnemyMageBoltRelease',c);
 const action={obj:mage,y:0,sx:0,sz:0,x:2,z:2,angular:true,tiles:[{x:1,z:1},{x:2,z:2}]};
 a.equal(run(action,800),1);
 a.deepEqual(Array.from(action.mageTiles,t=>[t.x,t.z]),[[1,1]]);
 a.equal(c.poiEnemyMageBolts[0].toX,1);a.equal(c.poiEnemyMageBolts[0].toZ,1);
 c.poiPlayerRayClear=()=>true;
 a.equal(run(action,801),2);
 a.equal(c.poiEnemyMageBolts.at(-1).toX,2);a.equal(c.poiEnemyMageBolts.at(-1).toZ,2);
});
