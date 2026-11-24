const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(x,y)=>{const i=h.indexOf(x),j=h.indexOf(y,i+1);a(i>=0&&j>i,x);return h.slice(i,j)};
function setup({blocked=false,type='monsterSlime',dist=.56,locked=true}={}){
 const id={type,y:0},state={},target={id,state,x:0,z:dist,y:0},hits=[],marks=[];
 let clip=false;
 const c={hits,marks,poiAimTargetList:()=>[target],poiAimPinContains:(s,t)=>s.track?.obj===t.id&&s.track?.state===t.state,
  poiAimWall:()=>()=>true,poiAimWallLimit:(_o,_d,x)=>x,poiAimUnit:(x,z)=>Math.hypot(x,z)?{x:x/Math.hypot(x,z),z:z/Math.hypot(x,z)}:null,
  poiOrvasWallContact:()=>blocked&&clip?{at:.14}:null,poiEquipmentSpendWeapon:()=>true,poiCreekPlayerHeight:()=>0,
  poiPlayerWeaponHands:pose=>({right:{wrist:[.24,.8,.41]}}),poiPlayerDamageTarget:(...v)=>hits.push(v),
  poiOrvasPlayerGroundImpact:(...v)=>marks.push(v),poiEquippedWeapon:()=>'equipOrvasHead',
  POI_AIM_EPS:1e-6,POI_COMBAT_TORSO_HEIGHT:{monsterSlime:.44},poiAimAttack:{started:100}};
 vm.createContext(c);vm.runInContext(cut('function poiDavidArea(','const POI_DAVID_LEAP_LOAD=')+
  cut('const POI_ORVAS_HEAD_BASE=','function poiOrvasHeadGeometry')+
  cut('// BEGIN ORVAS PLAYER BEAM','function poiOrvasCutFoley')+'\nthis.read=()=>poiOrvasPlayerBeam;',c);
 clip=true;
 c.fire=()=>c.poiOrvasBeamResolve({started:100,type:'equipOrvasHead',aim:{x:0,z:0,y:0},dx:0,dz:1,profile:{hit:420,pose:760,range:14,damage:48},
  ...(locked?{track:{state,obj:id}}:{})},520);
 return c;
}
test('locked nearby slime under old eye plane takes one real hit and two genuine descending eye rays',()=>{
 const c=setup();a(c.fire());const q=c.read();a.equal(c.hits.length,1);a.equal(c.hits[0][3],48);
 a.equal(c.marks.length,0,'the close body, not deeper terrain, stops the optical path');
 for(const r of q.rays){
  a(r.z<.56&&r.visualHeight<r.h);
  a(Math.abs(r.x+r.dir.x*r.visualEnd)<1e-8);
  a(Math.abs(r.z+r.dir.z*r.visualEnd-.56)<1e-8);
 }
});
test('close lock never shoots through real wall; unlocked and distant shots keep ordinary behavior',()=>{
 let c=setup({blocked:true});c.fire();a.equal(c.hits.length,0);a(c.read().rays.every(r=>r.visualLimit===0));
 c=setup({locked:false});c.fire();a.equal(c.hits.length,0);a.equal(c.marks.length,1);
 c=setup({dist:5});c.fire();a.equal(c.hits.length,1);a.equal(c.marks.length,1);a(c.read().rays.every(r=>!r.dir));
});
