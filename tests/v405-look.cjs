const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'candidate.html','utf8');
const cut=(a,b)=>h.slice(h.indexOf(a),h.indexOf(b,h.indexOf(a)));
test('roof-only third person in Frontier trench / vault / ruins / boss room can angle upward, not open cut or non-play views',()=>{
 const c={facilitySite:{id:'frontier'},poiWalkActive:true,poiThirdPerson:true,cameraTopDown:false,pineAIActive:false,poiWalkLevel:0,
 poiWalkViewX:19,poiWalkViewZ:29,poiWalkIndoor:()=>true,frontierSmooth:(a,b,x)=>Math.min(1,Math.max(0,(x-a)/(b-a)))};
 vm.runInNewContext(cut('const FRONTIER_BURROW=','function frontierBurrowWalkEdge(')+cut('const FRONTIER_RUINS=','function frontierRuinsGeometry(')+cut('function frontierRuinsCell(','function frontierRuinsBoss(')+cut('function poiSkyCanLookUp(','const POI_SKY_COLOR='),c);
 for(const [x,z] of [[24,29],[14,29],[7,29],[22,38],[5,42],[5,53]]){
  Object.assign(c,{poiWalkViewX:x,poiWalkViewZ:z});
  a.equal(c.poiOrbitPitchClamp(-1),-.50);
 }
 for(const [x,z] of [[29,29],[40,29],[22,45]]){
  Object.assign(c,{poiWalkViewX:x,poiWalkViewZ:z});
  a.equal(c.poiOrbitPitchClamp(-1),.12);
 }
 Object.assign(c,{poiWalkViewX:5,poiWalkViewZ:42,cameraTopDown:true});a.equal(c.poiOrbitPitchClamp(-1),.12);
 c.cameraTopDown=false;c.facilitySite={id:'base'};a.equal(c.poiOrbitPitchClamp(-1),.12);
});
test('changes actual perspective target only after unchanged collision-constrained eye',()=>{
 const c={};vm.runInNewContext("const POI_ORBIT_LOW_EYE=-.16,POI_ORBIT_DUNGEON_MIN=-.50;"+cut('function poiOrbitHigherLens(','const POI_SKY_COLOR='),c);
 const eye=Object.freeze([4,1.5,4]),target=Object.freeze([4,1.1,7]);
 const lifted=c.poiOrbitHigherLens(eye,target,-.50,true);
 a(lifted[1]>eye[1]+.4&&lifted[1]<eye[1]+.8);a.equal(lifted[0],target[0]);a.equal(lifted[2],target[2]);
 a.equal(c.poiOrbitHigherLens(eye,target,.12,true),target);
 const p=cut('function parameters(){','function cursorAt(');
 a.match(p,/const eye=frontierBurrowCamera\(target,/);
 a.match(p,/const viewTarget=poiOrbitHigherLens\(eye,lensTarget,dungeonLook\?Math.max\(POI_ORBIT_DUNGEON_MIN,poiCameraPitch\):poiCameraPitch,higher\|\|dungeonLook\)/);
 a.match(p,/look\(eye,viewTarget\)/);
});
