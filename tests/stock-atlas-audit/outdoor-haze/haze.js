// Ordinary outdoor geometry only. Feet remain in the common world frame;
// any draw using a different region-local VBO gets the corresponding origin.
let poiFieldHazeFrame=null,poiFieldHazeActive=false,poiFieldHazeRegionId=null;
function poiFieldHazeEligible(site,p){
 return poiWalkActive&&!cameraTopDown&&!pineAIActive&&p?.y===0&&!facilitySurfaceEdited&&
  (site?.id==='base'?poiSquareFieldSite(site):site?.id==='snowpass'&&site===poiOverlandSnow&&poiSnowPassBase?.edited===false)&&
  !poiWalkIndoor()&&facilityVisibilityOwner()===null&&!poiSacredFogOn&&!poiSacredEdgeOn&&
  !poiDavidTempleEnclosedAt(site,p.x,p.z,p.y)&&
  (site.id!=='base'||!(poiSacredTempleViewAmount()>0));
}
function poiFieldHazePrepare(now){
 const site=facilitySite,p=poiWalkActive?poiAimOrigin(now):null;
 poiFieldHazeFrame=null;
 if(!poiFieldHazeEligible(site,p))return;
 const world=poiOverlandGlobal(site.id,p.x,p.z);
 if(!world?.every(Number.isFinite))return;
 const minute=Math.floor(poiTownClockGameMs/POI_TOWN_MINUTE_MS%1440);
 poiFieldHazeFrame={id:site.id,world,color:poiSacredEdgeHorizon(minute)};
}
function poiFieldHazeRegion(id){
 if(!poiFieldHazeActive||poiFieldHazeRegionId===id)return;
 const [x,z]=id==='base'||id==='snowpass'?poiOverlandLocal(id,...poiFieldHazeFrame.world)??[]:[];
 if(!Number.isFinite(x)||!Number.isFinite(z)){
  gl.uniform3f(loc.fieldHaze,0,0,0);poiFieldHazeRegionId=null;return;
 }
 gl.uniform3f(loc.fieldHaze,x+.5,z+.5,.38);
 poiFieldHazeRegionId=id;
}
function poiFieldHazeStart(){
 if(!poiFieldHazeFrame)return;
 poiFieldHazeActive=true;
 gl.uniform3f(loc.fieldHazeColor,...poiFieldHazeFrame.color);
 poiFieldHazeRegion(poiFieldHazeFrame.id);
}
function poiFieldHazeStop(){
 if(!poiFieldHazeActive)return;
 gl.uniform3f(loc.fieldHaze,0,0,0);
 poiFieldHazeActive=false;poiFieldHazeRegionId=null;
}
