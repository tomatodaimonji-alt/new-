const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(process.env.HTML||path.join(__dirname,'..','world-editor.html'),'utf8');
function fixture(type='monsterSlime'){
 const js=html.match(/\/\/ BEGIN SLIME ATTACK\n([\s\S]*?)\/\/ END SLIME ATTACK/);assert.ok(js);
 const obj={type,y:0},state={x:4,z:5,hp:20,nextAttack:0,wildSpawn:true},hits=[];
 const c=vm.createContext({poiWalkActive:true,poiWalkLevel:0,poiWalkX:5,poiWalkZ:5,pineAIActive:false,facilitySite:{id:'base'},
  poiMonsterStates:new Map([[obj,state]]),poiWildPlayerOutside:()=>true,poiPlayerDying:()=>false,poiAudioAllowed:()=>true,poiMonsterMeshDirty:false,
  poiMobHitPlayer:(o,now)=>{hits.push([o.type,now]);return false}});
 vm.runInContext(js[1],c);
 return {c,obj,state,hits,tiles:now=>Array.from(c.poiEnemyThreatTiles(now),a=>[a.x,a.z,a.y,a.start,a.hit,a.type])};
}
test('one fixed player tile: visible through windup even after a sidestep, miss never retargets',()=>{
 const {c,obj,state,hits,tiles}=fixture();assert(c.poiEnemyBeginPlayer(obj,state,100));
 assert.deepEqual(tiles(100),[[5,5,0,100,580,'monsterSlime']]);
 c.poiWalkX=4;c.poiWalkZ=6;
 c.poiEnemyResolvePlayer(570);assert.deepEqual(tiles(570),[[5,5,0,100,580,'monsterSlime']]);assert.deepEqual(hits,[]);
 c.poiEnemyResolvePlayer(580);assert.deepEqual(hits,[]);assert.deepEqual(tiles(580),[]);assert.equal(state.nextAttack,2080);
});
test('all player-targeted monsters keep windup and a single hit; only slime recovery is lengthened',()=>{
 for(const [type,windup] of [['monsterSlime',480],['monsterSkeleton',520],['monsterGoblin',550],['monsterDragon',640]]){
  const {c,obj,state,hits,tiles}=fixture(type);
  assert(c.poiEnemyBeginPlayer(obj,state,100));assert(!c.poiEnemyBeginPlayer(obj,state,110));
  assert.deepEqual(tiles(100),[[5,5,0,100,100+windup,type]]);
  c.poiEnemyResolvePlayer(99+windup);assert.deepEqual(hits,[]);
  c.poiEnemyResolvePlayer(100+windup);c.poiEnemyResolvePlayer(130+windup);
  assert.deepEqual(hits,[[type,100+windup]]);
  assert.equal(state.nextAttack,type==='monsterSlime'?2080:1250);
 }
});
test('broken eligibility, removed or relocated source and lifecycle never become attacks',()=>{
 for(const cancel of [(c,o,s)=>{s.hp=0},(c,o)=>c.poiMonsterStates.delete(o),
  (c,o,s)=>{s.x=5;s.z=4},(c)=>{c.poiWalkLevel=1},(c)=>{c.poiAudioAllowed=()=>false},
  (c)=>c.poiEnemyCancelPlayer(),(c)=>{c.poiWildPlayerOutside=()=>false}]){
  const {c,obj,state,hits,tiles}=fixture();c.poiEnemyBeginPlayer(obj,state,100);
  cancel(c,obj,state);c.poiEnemyResolvePlayer(580);
  assert.deepEqual(tiles(580),[]);assert.deepEqual(hits,[]);
 }
 const {c,obj,state,tiles}=fixture();state.townOwned=true;assert(!c.poiEnemyBeginPlayer(obj,state,100));assert.deepEqual(tiles(300),[]);
});
