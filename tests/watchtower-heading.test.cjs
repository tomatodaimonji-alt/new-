const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function cut(a,b){
 const i=html.indexOf(a),j=html.indexOf(b,i+a.length);assert(i>=0&&j>i,a);return html.slice(i,j);
}
const site=vm.runInNewContext(cut('const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+";buildFacilitySite('base')");
const offset=site.townOffset??0;
function fixture(){
 const world=site.map.world;
 const ctx=vm.createContext({world,facilitySite:{...site,id:'base'},terrainY:()=>0,
  isWallId:id=>/wall/i.test(id),poiWalkPassableDoor:id=>id.endsWith('Door')||id==='ruinDoorBroken'});
 vm.runInContext(cut('let facilityWatchtowerCameraWalls=','function parameters()'),ctx);
 return {clamp:ctx.facilityWatchtowerCameraEye,fov:ctx.facilityWatchtowerCloseFov,walls:()=>vm.runInContext('facilityWatchtowerCameraWalls',ctx)};
}
function eyeAt(t,yaw,pitch=.35,distance=5.5){
 const span=distance*Math.cos(pitch);
 return [t[0]-span*Math.sin(yaw),t[1]+distance*Math.sin(pitch),t[2]-span*Math.cos(yaw)];
}
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
function assertView(target,desired,eye,context,walls,fov){
 const radial=eye.map((v,i)=>v-target[i]),wanted=desired.map((v,i)=>v-target[i]);
 const azimuth=Math.atan2(radial[0]*wanted[2]-radial[2]*wanted[0],radial[0]*wanted[0]+radial[2]*wanted[2]);
 assert(Math.abs(azimuth)<1e-7,'rendered orbit must not bend away from the movement bearing: '+JSON.stringify({context,target,eye,azimuth}));
 const arm=distance(eye,target);
 if(context.yaw===0||context.yaw===Math.PI)assert(arm>=1.65,'direct front/back stays framed normally');
 else{
  assert(arm>=.42,'a very oblique ray keeps the eye clear of the character: '+JSON.stringify({context,target,eye,arm}));
  assert(arm*Math.tan(fov(arm)/2)>=1,'wide lens retains the minimum vertical scene span for tight rays: '+JSON.stringify({context,target,eye,arm}));
 }
 for(const [lo,hi] of walls())assert(!eye.every((v,i)=>v>lo[i]&&v<hi[i]),'viewpoint remains out of tower stone');
}
test('real front doorway does not steer the camera away from the held bearing',()=>{
 const {clamp,walls,fov}=fixture();
 const doorway=site.map.world.find(o=>o.x===86+offset&&o.z===38+offset&&o.y===0&&o.type==='ruinDoorBroken');
 assert(doorway);
 for(const yaw of [0,.18,-.25,Math.PI,.50,Math.PI-.35])
  for(let k=0;k<=135;k++){
   const target=[doorway.x+.5,1.1,doorway.z+1.7-k*.025],desired=eyeAt(target,yaw);
   assertView(target,desired,clamp(target,desired),{yaw,facing:'front'},walls,fov);
  }
});
test('the rear tower passage keeps the same free orbit and framing',()=>{
 const {clamp,walls,fov}=fixture();
 for(const yaw of [0,.18,-.25,Math.PI,.50,Math.PI-.35])
  for(let k=0;k<=135;k++){
   const target=[86.5+offset,1.1,34+offset-1.1+k*.025],desired=eyeAt(target,yaw);
   assertView(target,desired,clamp(target,desired),{yaw,facing:'rear'},walls,fov);
  }
});
