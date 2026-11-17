// v21: third-person camera obstruction solver. Uses the same scene registration
// as buildings and store fixtures; it never changes building opacity or player movement.
// The user's requested cameraDistance is never overwritten by collision response.
let cameraCollisionFactor=1;
function cameraSegmentBox(origin,target,b,inflate=.13){
 const min=[b.x-b.w/2-inflate,b.y-inflate,b.z-b.d/2-inflate];
 const max=[b.x+b.w/2+inflate,b.y+b.h+inflate,b.z+b.d/2+inflate];
 let near=0,far=1;
 for(let axis=0;axis<3;axis++){
  const delta=target[axis]-origin[axis];
  if(Math.abs(delta)<1e-7){
   if(origin[axis]<min[axis]||origin[axis]>max[axis])return null;
   continue;
  }
  let enter=(min[axis]-origin[axis])/delta;
  let leave=(max[axis]-origin[axis])/delta;
  if(enter>leave){const hold=enter;enter=leave;leave=hold}
  near=Math.max(near,enter);far=Math.min(far,leave);
  if(near>far)return null;
 }
 // Starting within a thick bounding volume is not treated as a wall;
 // thin individual store walls still stop the camera normally.
 return far>=0&&near<=1?near:null;
}
function cameraObstacles(){
 const objects=[];
 for(const b of townBuildings){
  objects.push({x:b.cx,y:0,z:b.cz,w:b.depth,d:b.width,h:b.height});
 }
 const b=convenience,front=b.z-b.depth/2,back=b.z+b.depth/2;
 // Camera hits physical wall panels, not the whole indoor floor footprint.
 for(const x of [-b.width/2,b.width/2])
  objects.push({x,y:0,z:b.z,w:.18,d:b.depth+.18,h:b.height});
 objects.push({x:0,y:0,z:back,w:b.width+.2,d:.2,h:b.height});
 for(const side of [-1,1]){
  objects.push({x:side*5.25,y:0,z:front,w:7,d:.20,h:3.12});
 }
 // Entrance header is overhead: keep its door opening free beneath 3.1 m.
 objects.push({x:0,y:3.08,z:front,w:3.78,d:.24,h:1.2});
 for(const f of scene.objects){
  if(f.poiId!=='convenience-study'||f.type==='floor-mat'||f.type==='register')continue;
  objects.push({x:f.x,y:0,z:f.z,w:f.width,d:f.depth,h:f.height});
 }
 return objects;
}
function cameraAllowedFactor(origin,ideal){
 const travel=Math.hypot(ideal[0]-origin[0],ideal[1]-origin[1],ideal[2]-origin[2])||1;
 let nearest=1;
 for(const box of cameraObstacles()){
  const t=cameraSegmentBox(origin,ideal,box);
  if(t!==null&&t>0.0001&&t<nearest)nearest=t;
 }
 return nearest===1?1:Math.max(.065,nearest-.22/travel);
}
function resolveExplorationCamera(origin,ideal,dt){
 const desired=cameraAllowedFactor(origin,ideal);
 const gain=desired<cameraCollisionFactor?19:3.6;
 cameraCollisionFactor+=(desired-cameraCollisionFactor)*(1-Math.exp(-gain*Math.max(0,dt)));
 // Keep a small maximum lag when running toward a wall; recede more slowly.
 if(desired<cameraCollisionFactor)cameraCollisionFactor=Math.min(cameraCollisionFactor,desired+.045);
 if(Math.abs(cameraCollisionFactor-1)<.001)cameraCollisionFactor=1;
 return origin.map((value,i)=>value+(ideal[i]-value)*cameraCollisionFactor);
}
