const assert=require('node:assert/strict'),test=require('node:test'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.env.WORLD_EDITOR||require('node:path').join(__dirname,'../world-editor.html'),'utf8');
function setup(){
 const a=html.indexOf('// BEGIN NORTH MINOTAUR COMBAT');
 assert.ok(a>=0,'authored minotaur combat reducer now exists');
 const obj={x:64,z:13,y:-1,type:'monsterNorthMinotaur'},state={x:64,z:13,hp:224,nextAttack:0};
 const env={obj,state,p:{x:64,z:15,y:-1},wall:false,poiWalkLevel:-1,poiWalkX:64,poiWalkZ:15,poiMonsterStates:new Map([[obj,state]]),poiEnemyPending:new Set(),poiMonsterMeshDirty:false,
 facilitySite:{northFort:{boss:{...obj,room:{minX:57,maxX:71,minZ:10,maxZ:19}}}},poiEnemyThreatEnabled:()=>true,
 poiAimOrigin:()=>env.p,poiAimWall:()=>()=>true,poiAimWallLimit:(_o,_d,l)=>env.wall?0:l,poiMonsterCanMove:()=>true};
 vm.createContext(env);
 vm.runInContext(html.slice(a,html.indexOf('// END NORTH MINOTAUR COMBAT',a)),env);
 return env;
}
test('close axe windup keeps committed angle, sweeps side and grants open window on retreat',()=>{
 const c=setup();assert.equal(c.poiNorthMinotaurBegin(c.obj,c.state,0),true);
 const a=c.state.playerAttack;assert.equal(a.northAttack,'axe');assert.equal(a.hit,850);
 c.p={x:65.5,z:14.5,y:-1};assert.equal(c.poiNorthMinotaurCovered(a,850),true);
 c.p={x:64,z:16,y:-1};assert.equal(c.poiNorthMinotaurCovered(a,850),false);
 a.pending=false;c.poiNorthMinotaurSettle(c.state,a,850,false);
 assert.equal(c.state.northOpenUntil,1970);
 assert.equal(c.poiNorthMinotaurPose(c.state,950).phase,'open');
});
test('far horn pierces confined straight lane, sidestep and new cover both avoid it',()=>{
 const c=setup();c.p.z=16.5;
 assert.ok(c.poiNorthMinotaurBegin(c.obj,c.state,0));const a=c.state.playerAttack;
 assert.equal(a.northAttack,'horn');assert.equal(a.hit,700);
 assert.equal(c.poiNorthMinotaurPose(c.state,350).phase,'windup');
 assert.equal(c.poiNorthMinotaurCovered(a,700),true);
 c.p.x=64.7;assert.equal(c.poiNorthMinotaurCovered(a,700),false);
 c.p.x=64;c.wall=true;assert.equal(c.poiNorthMinotaurCovered(a,700),false);
 c.wall=false;c.p.y=0;assert.equal(c.poiNorthMinotaurCovered(a,700),false);
});
test('only authored boss acts and alternates variants when both ranges reach',()=>{
 const c=setup();
 assert.equal(c.poiNorthMinotaurBegin({...c.obj,x:63},c.state,0),false);
 assert.ok(c.poiNorthMinotaurBegin(c.obj,c.state,0));const a=c.state.playerAttack;
 c.poiNorthMinotaurSettle(c.state,a,850,true);a.pending=false;
 assert.ok(c.poiNorthMinotaurBegin(c.obj,c.state,2000));
 assert.equal(c.state.playerAttack.northAttack,'horn');
 c.state.playerAttack.pending=false;c.p.z=20;
 assert.equal(c.poiNorthMinotaurBegin(c.obj,c.state,4000),false);
});
test('real enemy resolver contacts once with move-specific raw damage and never damages across a newly closed wall',()=>{
 const c=setup(),damage=[];
 c.poiEnemyAttackSourceValid=(state,a)=>state===c.state&&a.obj===c.obj;
 c.poiEnemyContactTolerance=()=>200;
 c.poiEnemyCancelPlayer=()=>{throw new Error('fixture attack is not lethal')};
 c.poiMobHitPlayer=(_obj,now,raw)=>{damage.push([now,raw]);return false};
 const a=html.indexOf('function poiEnemyResolvePlayer(now){');
 vm.runInContext(html.slice(a,html.indexOf('// END SLIME ATTACK',a)),c);
 assert.ok(c.poiNorthMinotaurBegin(c.obj,c.state,0));
 c.poiEnemyResolvePlayer(849);assert.deepEqual(damage,[]);
 c.poiEnemyResolvePlayer(850);c.poiEnemyResolvePlayer(851);
 assert.deepEqual(damage,[[850,33]]);
 c.p.z=16.5;
 assert.ok(c.poiNorthMinotaurBegin(c.obj,c.state,2000));
 c.poiEnemyResolvePlayer(2700);
 assert.deepEqual(damage,[[850,33],[2700,26]]);
 assert.ok(c.poiNorthMinotaurBegin(c.obj,c.state,4000));
 c.wall=true;c.poiEnemyResolvePlayer(4700);
 assert.deepEqual(damage,[[850,33],[2700,26]]);
 assert.equal(c.state.northOpenUntil,5820);
});
test('boss chase uses legal steps inside chamber and never moves in punish window or outside room',()=>{
 const c=setup();c.p.z=19;
 c.poiMonsterCanMove=(x,z,_s,fx,fz)=>[x,z,fx,fz].join()!=='64,14,64,13';
 assert.equal(c.poiNorthMinotaurFrame(c.obj,c.state,0),false);
 c.poiMonsterCanMove=()=>true;
 assert.equal(c.poiNorthMinotaurFrame(c.obj,c.state,10),true);
 assert.equal(c.state.z,14);
 c.state.nextAttack=1200;
 assert.equal(c.poiNorthMinotaurFrame(c.obj,c.state,1000),false);
 c.p.z=20;
 assert.equal(c.poiNorthMinotaurFrame(c.obj,c.state,1300),false);
 assert.equal(c.state.z,14);
});
