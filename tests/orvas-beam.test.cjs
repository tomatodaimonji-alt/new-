const fs=require('node:fs'),assert=require('node:assert/strict'),test=require('node:test'),vm=require('node:vm');
const h=fs.readFileSync(process.env.PRODUCT||'world-editor.html','utf8');
function cut(a,b){const i=h.indexOf(a),j=h.indexOf(b,i+1);return i>=0&&j>=0?h.slice(i,j):''}
function execute({wall=Infinity,targets=[[2.6,0,0],[5,0,0]],wear=true,range=8}={}){
 const hits=[],calls=[];
 const c={range,poiAimWall:()=>((x)=>x<wall),poiAimTargetList:()=>targets.map(([x,z,y],idx)=>({id:{type:'monsterSlime',y,idx},x,z,state:{hp:50}})),
  poiEquipmentSpendWeapon:t=>(calls.push(t),wear),poiPlayerDamageTarget:(pair,x,z,n)=>hits.push([pair[0].idx,n]),
  poiPlayerWeaponHands:()=>({right:{wrist:[0,.71,.31]}}),poiOrvasHeadPose:()=>({}),poiCreekPlayerHeight:()=>0,poiSound:()=>{},
  POI_DAVID_SWEEP_FORWARD:5.25,POI_DAVID_SWEEP_SIDE:4.2,window:{},performance:{now:()=>300}};
 const src=cut('function poiDavidArea(', 'const POI_DAVID_LEAP_LOAD=')+cut('const POI_ORVAS_HEAD_BASE=', 'function poiOrvasHeadGeometry')+cut('const POI_AIM_EPS=', 'function poiAimChooseLock')+cut('// BEGIN ORVAS PLAYER BEAM','function poiDrawOrvasPlayerBeam');
 vm.createContext(c);vm.runInContext(src,c);
 const rays=vm.runInContext("poiOrvasBeamResolve({type:'equipOrvasHead',profile:{range,damage:48},dx:1,dz:0,y:0,aim:{x:0,z:0,y:0}},300); poiOrvasPlayerBeam?.rays",c);
 return {hits,calls,rays};
}
test('equipped trophy emits two real eye rays, first eligible target only, one wear',()=>{
 const {hits,calls,rays}=execute();
 assert.deepEqual(hits,[[0,48]]);assert.deepEqual(calls,['equipOrvasHead']);
 assert.equal(rays.length,2);assert.notEqual(rays[0].z,rays[1].z);assert.equal(rays[0].end,rays[1].end);
});
test('eye rays stop on wall, never hit another floor, no emission if wear write denied',()=>{
 let v=execute({wall:2});assert.deepEqual(v.hits,[]);assert(v.rays.every(r=>r.end<=1.5));
 v=execute({targets:[[2,0,1],[4,0,0]]});assert.deepEqual(v.hits,[[1,48]]);
 v=execute({wear:false});assert(!v.rays);assert.deepEqual(v.hits,[]);
});
test('exact boss shape geometry: wide flank is single sweep only; paired right/left use one input and two contacts',()=>{
 const spans=[];
 const c={poiAimWall:()=>()=>true,poiAimTargetList:()=>[[3.54,1.49],[4.2,1.7],[-1,0],[3.56,0]].map(([x,z],idx)=>({id:{idx,y:0},x,z,state:{hp:100}})),
  poiEquipmentSpendWeapon:()=>{spans.push('wear');return true},poiPlayerDamageTarget:(pair,x,z,n)=>spans.push([pair[0].idx,n]),poiAimOrigin:()=>({x:0,z:0,y:0}),poiEquippedWeapon:()=>c.weapon,
  poiPlayerWeaponPending:null,POI_DAVID_PATTERNS:{double:{hits:[720,1040],damage:[28,35]}},POI_DAVID_SWEEP_FORWARD:5.25,POI_DAVID_SWEEP_SIDE:4.2};
 vm.createContext(c);
 vm.runInContext(cut('function poiDavidArea(', 'const POI_DAVID_LEAP_LOAD=')+cut('const POI_AIM_EPS=', 'function poiAimChooseLock')+cut('// BEGIN ORVAS PLAYER BEAM','function poiDrawOrvasPlayerBeam'),c);
 const run=s=>vm.runInContext(s,c);
 run("poiOrvasCutResolve({type:'equipOrvasGreatsword',profile:{damage:46},dx:1,dz:0,aim:poiAimOrigin()},100,'sweep')");
 assert(spans.some(x=>x[0]===1&&x[1]===46));assert(!spans.some(x=>x[0]===2));
 spans.length=0;c.weapon='equipOrvasTwinGreatswords';
 run("poiPlayerWeaponPending={type:'equipOrvasTwinGreatswords',profile:{damage:46},started:100,dx:1,dz:0};");
 run('poiOrvasTwinFrame(poiPlayerWeaponPending,819)');assert.deepEqual(spans,[]);
 run('poiOrvasTwinFrame(poiPlayerWeaponPending,820)');assert.deepEqual(spans,['wear',[0,46]]);
 run('poiOrvasTwinFrame(poiPlayerWeaponPending,1139)');assert.equal(spans.length,2);
 run('poiOrvasTwinFrame(poiPlayerWeaponPending,1140)');assert.deepEqual(spans,['wear',[0,46],[0,46]]);
 assert.equal(c.poiPlayerWeaponPending,null);
});

test('actual full eye beam reaches 14 from committing player, clipping the same half-width as boss',()=>{
 const empty=execute({targets:[],range:14});
 assert(empty.rays.every(r=>Math.abs(r.x+r.end-14)<1e-6&&r.groundEligible));
 const {rays}=execute({wall:6,targets:[],range:14});assert(rays.every(r=>r.end<6&&!r.groundEligible));
});
