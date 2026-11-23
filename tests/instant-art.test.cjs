const {test}=require('node:test'),a=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const h=fs.readFileSync(process.argv[2]||process.env.HTML||'world-editor.html','utf8');
function take(l,r){const i=h.indexOf(l),j=h.indexOf(r,i+l.length);a(i>=0&&j>i,l);return h.slice(i,j)}
function get(){
 let c={POI_AIM_RADIUS:.34};
 return vm.runInNewContext(take('function poiWalkPunchPose(','const POI_AIM_EPS=')+
 take('// BEGIN INSTANT MELEE ART','// END INSTANT MELEE ART')+';({pose:poiWorldInstantPose})',c);
}
test('unprofiled stick, club, stone sword and fist enter actual impact pose at ms 0 and settle',()=>{
 const {pose}=get();
 for(const t of ['equipStick','equipClub','equipStoneSword',null]){
  const start=pose(t,0,1),follow=pose(t,48,1),end=pose(t,225,1);
  a(start?.strike>1.50&&follow?.strike>1.05,'unprofiled contact gesture begins at the real impact');
  a(!end||end.strike<.15);
  if(t)a(start.meleeReach.forward===1&&start.meleeReach.side===0&&start.meleeReach.mix===1);
  else a(Math.abs(start.fistReach.forward-.66)<1e-7&&start.fistReach.mix===1);
 }
 a.equal(pose('equipWoodSpear',0,1),null);
});
test('wall clamp and shot origin affect the visible key without mutating legacy damage and cooldown',()=>{
 const {pose}=get();
 a.equal(pose('equipClub',0,.5).meleeReach.forward,.5);
 a(Math.abs(pose(null,0,.5).fistReach.forward-.16)<1e-7);
 a.match(h,/poiAttackReady=now\+300;poiWalkActionStarted=now/);
 a.match(h,/poiPlayerDamageTarget\(monster,x,z,poiPlayerAttackDamage\(poiWalkActionWeapon\),poiWalkActionWeapon,now\)/);
 a.match(h,/function poiWalkAvatar[\s\S]{0,3200}poiWorldInstantPose\(weapon,ms,/);
});
test('actual fist mesh leading vertex meets the first sphere contact instead of snapping the shoulder',()=>{
 const src='function mesh(){return {p:[],n:[],c:[]}};'+take('function tri(m,','function addPart(m,')+
  take('function characterHuman(','function poiRoleClothingGeometry(')+take('function characterArmRotation(','function roundStack(')+
  take('function poiWalkPunchPose(','const POI_AIM_EPS=')+
  take('// BEGIN INSTANT MELEE ART','// END INSTANT MELEE ART')+take('function poiBuildPlayerMesh(','function poiWalkAvatar(')+
  ';[1,.8].map(range=>{const m=poiBuildPlayerMesh(null,poiWorldInstantPose(null,0,range),null,0,0,0,0,0,0,true);return Math.max(...m.p.filter((v,i)=>i%3===2))})';
 const values=vm.runInNewContext(src,{POI_AIM_RADIUS:.34});
 a(Math.abs(values[0]-.66)<1e-6);
 a(Math.abs(values[1]-.46)<1e-6);
});
