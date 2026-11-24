const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(a,b)=>h.slice(h.indexOf(a),h.indexOf(b,h.indexOf(a)+1));
const c={ROAD_IDS:new Set(['roadMossFull']),roadTile:(m)=>m.push('road unchanged'),
  smoothSurfaceNoise:()=>.5,surfaceNoise:()=>.4,
  quad:(m,...v)=>m.push(v),tri(){},cube(){},diamond(){}};
vm.runInNewContext(cut('function addFloorTile(','const SIGN_TYPES='),c);
function tile(x,z,type,joined=false){
 const m=[];c.addFloorTile(m,x,z,type,16384,0,null,joined);return m;
}
test('adjacent authored Play natural quads meet with no uncovered pixels and retain their base colors',()=>{
 for(const [a,b] of [['earth','grassTrampled'],['grassPebbles','grassWild'],['moss','grass']]){
  const drawA=tile(89,64,a,true),drawB=tile(90,64,b,true);
  assert.equal(drawA[0][3][0],90);assert.equal(drawB[0][0][0],90);
  assert.equal(drawA[0][0][2],64);assert.equal(drawB[0][2][2],65);
  for(const [x,type,draw] of [[89,a,drawA],[90,b,drawB]]){
   const old=tile(x,64,type);
   assert.deepEqual(draw[0][4],old[0][4]);assert.deepEqual(draw.slice(1),old.slice(1));
   assert(Math.abs(old[0][0][0]-x-.006)<1e-8,'preserve the editor inset');
  }
 }
});
test('join is deliberately opted in only for natural y0 Game World Play grade',()=>{
 vm.runInNewContext(cut('function pinePlayJoinedNaturalGrade(','function makeScene('),c);
 for(const kind of ['grass','grassPebbles','grassTrampled','earth','moss'])assert(c.pinePlayJoinedNaturalGrade(kind,{id:'base'},true));
 for(const kind of ['roadMossFull','woodfloor','stone','water','river'])assert(!c.pinePlayJoinedNaturalGrade(kind,{id:'base'},true));
 assert(!c.pinePlayJoinedNaturalGrade('earth',{id:'base'},false));
 assert(!c.pinePlayJoinedNaturalGrade('earth',{id:'kitchen'},true));
 assert.match(h,/ambientTint\|\|eastBlend\),pinePlayJoinedNaturalGrade\(kind,facilitySite,poiWalkActive\)/);
 assert.deepEqual(tile(87,43,'roadMossFull',true),tile(87,43,'roadMossFull',false));
});
