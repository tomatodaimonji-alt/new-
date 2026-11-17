let player={x:0,z:0,heading:0},padX=0,padY=0,keys={},last=0,walk=0;
let cameraYaw=Math.atan2(5.7,9.2),cameraPitch=-.29,cameraDistance=12;
const cameraTouches=new Map();
let pinchActive=false,pinchDistance=0,stepDistance=0,walkingMotion=0;
// Left-hand movement and right-hand camera gestures are independent.
// Pinch has priority only when two fingers are controlling the camera.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// Touching the left side starts movement; right-side gestures orbit or zoom.
canvas.addEventListener('pointerdown',e=>{
 if(e.pointerType==='mouse'&&e.button!==0)return;
 canvas.setPointerCapture(e.pointerId);
 if(e.pointerType==='touch'&&e.clientX<window.innerWidth/2&&pointer===null){
  pointer=e.pointerId;
  beginFloatingPad(e.clientX,e.clientY);
  unlockAudio();
  return;
 }
 cameraTouches.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(cameraTouches.size===2){
  pinchActive=true;
  const p=[...cameraTouches.values()];
  pinchDistance=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);
 }
 unlockAudio();
});
canvas.addEventListener('pointermove',e=>{
 if(e.pointerId===pointer&&floatingOrigin){
  const radius=Math.max(36,pad.clientWidth*.32);
  const dx=e.clientX-floatingOrigin.x,dy=e.clientY-floatingOrigin.y;
  const scale=Math.min(1,radius/(Math.hypot(dx,dy)||1));
  padX=dx*scale/radius;
  padY=dy*scale/radius;
  updateStickDisplay();
  return;
 }
 const old=cameraTouches.get(e.pointerId);
 if(!old)return;
 const dx=e.clientX-old.x,dy=e.clientY-old.y;
 cameraTouches.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(cameraTouches.size>=2){
  const p=[...cameraTouches.values()].slice(0,2);
  const distance=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);
  if(pinchDistance>0)cameraDistance=clamp(cameraDistance*pinchDistance/Math.max(1,distance),4.5,26);
  pinchDistance=distance;
 }else{
  cameraYaw-=dx*.007;
  cameraPitch=clamp(cameraPitch+dy*.006,-1.30,1.54);
 }
});
for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,e=>{
 if(e.pointerId===pointer&&floatingOrigin){resetStick();return;}
 cameraTouches.delete(e.pointerId);
 if(cameraTouches.size<2){pinchActive=false;pinchDistance=0;}
});
canvas.addEventListener('wheel',e=>{e.preventDefault();cameraDistance=clamp(cameraDistance*Math.exp(e.deltaY*.001),4.5,26)},{passive:false});
