const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),test=require('node:test');
const h=fs.readFileSync(process.env.PRODUCT||'world-editor.html','utf8');
function piece(a,b){const i=h.indexOf(a),j=h.indexOf(b,i+1);assert(i>=0&&j>i,a);return h.slice(i,j)}
const target=(type,x=1.48,z=.4,y=0)=>({id:{type,y},state:{x,z,hp:100},x,z,y,p:{x:x+.5,z:z+.5,y}});
function run(c,{ox=0,wall=false,air=0,heading=0,type='kitchenKnife',sweep=false,arc=false}={}){
 c.p.y=air;c.p.heading=heading;
 const functions=piece('const POI_AIM_EPS=', 'function poiAimChooseLock')+piece('function poiAimTrace(', 'function poiAimFlightBegin(')+piece('function poiSwordResolve(', 'function poiPlayerStartProfile(');
 const rig=piece('function poiDavidRig(', 'function poiDavidSkirt(');
 const helpers=h.includes('// BEGIN OVERSIZED MELEE BODY')?piece('// BEGIN OVERSIZED MELEE BODY','// END OVERSIZED MELEE BODY'):'';
 const scope={c,shot:{type,dx:1,dz:0,profile:{range:1,frontArc:arc,damage:30},aim:{x:ox,z:.6,y:0}},poiAimTargetList:()=>c.id.y===0?[c]:[],
  poiAimWall:()=> (x)=>!wall||x<=0,poiMonsterPose:()=>({...c.p,david:{phase:'idle'}}),
  poiDavidHeadPoint:x=>x,POI_DAVID_EYE_Y:4.5,POI_DAVID_EYE_FRONT:.25,POI_DAVID_BLADE:2,
  POI_WORLD_MELEE_CONTACT_HEIGHT:{kitchenKnife:.76,equipIronSword:.77},terrainY:()=>0,POI_SWORD_HALF_WIDTH:1.5,poiSound:()=>{},poiEquipmentSpendWeapon:()=>true,poiPlayerDamageTarget:()=>c.state.hp-=30};
 return vm.runInNewContext(functions+rig+helpers+(sweep?'\npoiSwordResolve(shot,100);c.state.hp':'\npoiAimTrace(shot,1,100)'),scope);
}
test('real knife trace reaches the pose leg outside center reach, without extending the reach across masonry or air',()=>{
 const david=()=>target('monsterStoneDavid');
 assert(run(david()).monster,'old center at 1.49 is outside 1-tile reach; the visible left shin is inside');
 assert(!run(david(),{wall:true}).monster);
 assert(!run(david(),{ox:-.65}).monster);
 assert(!run(david(),{air:1.15}).monster);
 assert(!run(target('monsterStoneDavid',1.48,.4,1)).monster);
});
test('ordinary actors and projectiles retain old center rule',()=>{
 assert(!run(target('monsterSlime')).monster);
 assert(run(target('monsterSlime',.9,.6)).monster);
 assert(!run(target('monsterStoneDavid'),{type:'equipWoodBow'}).monster);
});

test('actual sweep resolves one group entry per body, checks shared wall/range, and excludes rear-only bodies',()=>{
 for(const arc of [true,false]){
  const david=(x=1.48)=>target('monsterStoneDavid',x,.4);
  assert.equal(run(david(),{sweep:true,arc,type:'equipIronSword'}),70);
  assert.equal(run(david(),{sweep:true,arc,type:'equipIronSword',wall:true}),100);
  assert.equal(run(david(-1.48),{sweep:true,arc,type:'equipIronSword'}),100);
  assert.equal(run(david(),{sweep:true,arc,type:'equipIronSword',ox:-.65}),100);
 }
});
test('body surface rotates with visible facing, not a broad circle',()=>{
 const david=()=>target('monsterStoneDavid');
 assert(run(david()).monster);
 assert(!run(david(),{heading:Math.PI/2}).monster);
});
