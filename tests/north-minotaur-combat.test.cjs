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
test('close axe windup keeps committed angle, sweeps side and grants open window after a close rear dodge',()=>{
 const c=setup();assert.equal(c.poiNorthMinotaurBegin(c.obj,c.state,0),true);
 const a=c.state.playerAttack;assert.equal(a.northAttack,'axe');assert.equal(a.hit,850);
 c.p={x:65.5,z:14.5,y:-1};assert.equal(c.poiNorthMinotaurCovered(a,850),true);
 c.p={x:64,z:17.01,y:-1};assert.equal(c.poiNorthMinotaurCovered(a,850),false);
 c.p={x:65.1,z:12.75,y:-1};assert.equal(c.poiNorthMinotaurCovered(a,850),false);
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
 assert.equal(c.state.playerAttack.northAttack,'axe');
 c.wall=true;c.poiEnemyResolvePlayer(4850);
 assert.deepEqual(damage,[[850,33],[2700,26]]);
 assert.equal(c.state.northOpenUntil,0,'cover is safe but does not make the minotaur vulnerable');
 assert.equal(c.state.nextAttack,5970,'old rest still runs after a shielded miss');
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
test('axe is a four-tile semicircle facing the original bearing, with exact side and front boundaries',()=>{
 const c=setup();assert.equal(c.poiNorthMinotaurBegin(c.obj,c.state,0),true);
 const a=c.state.playerAttack;assert.equal(a.northAttack,'axe');
 for(const [x,z,hit] of [[68,13,true],[60,13,true],[64,17,true],[67.98,13.2,true],
  [64,17.001,false],[68.01,13,false],[67.9,12.99,false],[64,12.8,false],[64,13,false]]){
  c.p={x,z,y:-1};assert.equal(c.poiNorthMinotaurCovered(a,850),hit,[x,z].join());
 }
 c.wall=true;c.p={x:68,z:13,y:-1};assert.equal(c.poiNorthMinotaurCovered(a,850),false,'closed wall blocks exact side');
 assert.ok(a.tiles.some(({x,z})=>x===68&&z===13),'exact side is also in debug tiles');
 assert.ok(!a.tiles.some(({z})=>z<13),'no rear debug tiles');
});
test('four-tile outer band selects only axe; at 3.2 and 3.7 horn gets first preference then axe',()=>{
 for(const [dist,kind] of [[3.2,'horn'],[3.7,'horn'],[3.8,'axe'],[4,'axe'],[4.001,null]]){
  const c=setup();c.p.z=13+dist;
  assert.equal(c.poiNorthMinotaurBegin(c.obj,c.state,0),!!kind,dist);
  if(!kind)continue;
  const a=c.state.playerAttack;assert.equal(a.northAttack,kind,dist);
  assert.equal(c.poiNorthMinotaurCovered(a,a.hit),true,dist);
  a.pending=false;c.poiNorthMinotaurSettle(c.state,a,a.hit,true);
  assert.equal(c.poiNorthMinotaurBegin(c.obj,c.state,3000),true,dist);
  assert.equal(c.state.playerAttack.northAttack,'axe',dist);
 }
});
test('oblique axe rotates side boundary with frozen bearing',()=>{
 const c=setup();c.p={x:65,z:14,y:-1};assert.ok(c.poiNorthMinotaurBegin(c.obj,c.state,0));
 const a=c.state.playerAttack,side=Math.SQRT2*2;
 c.p={x:64+side,z:13-side,y:-1};assert.equal(c.poiNorthMinotaurCovered(a,850),true);
 c.p={x:64+side-.01,z:13-side,y:-1};assert.equal(c.poiNorthMinotaurCovered(a,850),false);
});
