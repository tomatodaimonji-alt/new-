const fs=require('node:fs'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function piece(a,b){const i=h.indexOf(a),j=h.indexOf(b,i+1);assert(i>=0&&j>i,a);return h.slice(i,j)}
function run(mode,list){
 const rows=[],wear=[];
 const c={poiAimWall:()=>()=>true,poiAimTargetList:()=>list.value,poiEquipmentSpendWeapon:t=>(wear.push(t),true),
  poiPlayerDamageTarget:(_m,x,z,amount)=>rows.push(amount),POI_DAVID_SWEEP_FORWARD:5.25,POI_DAVID_SWEEP_SIDE:4.2,
  POI_DAVID_PATTERNS:{double:{damage:[28,35],hits:[720,1040]}},poiAimOrigin:()=>({x:0,z:0,y:0}),
  poiPlayerWeaponPending:null,poiEquippedWeapon:()=>mode};
 const standard=piece('const POI_PLAYER_WEAPON_PROFILES=','let poiPlayerWeaponPending');
 const power=h.includes('const POI_ORVAS_JUDGMENT_POWER=')?piece('const POI_ORVAS_JUDGMENT_POWER=','const POI_PLAYER_WEAPON_PROFILES='):'';
 vm.createContext(c);vm.runInContext(power+'const POI_SWORD_PROFILE={};'+standard+piece('function poiDavidArea(','const POI_DAVID_LEAP_LOAD=')+
   piece('const POI_AIM_EPS=', 'function poiAimChooseLock')+piece('function poiOrvasCutResolve(', 'function poiDrawOrvasPlayerBeam'),c);
 const f=s=>vm.runInContext(s,c),profile=f('POI_PLAYER_WEAPON_PROFILES['+JSON.stringify(mode)+']');
 c.shot={type:mode,profile,aim:{x:0,z:0,y:0},dx:1,dz:0,started:0};
 return {rows,wear,profile,c,f};
}
const hit=()=>({value:[{id:{y:0},x:2,z:0,state:{hp:200}}]});
test('single and each actual twin contact use the same raw 46, exactly doubling if both land',()=>{
 const a=run('equipOrvasGreatsword',hit()),b=run('equipOrvasTwinGreatswords',hit());
 a.f("poiOrvasCutResolve(shot,560,'sweep')");
 b.f('poiOrvasTwinFrame(shot,720)');b.f('poiOrvasTwinFrame(shot,1040)');
 assert.equal(a.profile.damage,46);assert.equal(b.profile.damage,46);
 assert.deepEqual(a.rows,[46]);assert.deepEqual(b.rows,[46,46]);assert.equal(b.wear.length,1);
 assert.deepEqual(b.c.POI_DAVID_PATTERNS.double.damage,[28,35],'actual boss remains independently tuned');
});
test('single missed contact does not transfer damage to the landed contact',()=>{
 for(const miss of [0,1]){
  const list=hit(),saved=list.value,q=run('equipOrvasTwinGreatswords',list);
  list.value=miss===0?[]:saved;q.f('poiOrvasTwinFrame(shot,720)');
  list.value=miss===1?[]:saved;q.f('poiOrvasTwinFrame(shot,1040)');
  assert.deepEqual(q.rows,[46]);assert.equal(q.wear.length,1);
 }
});
