let player={x:0,z:0,heading:0},padX=0,padY=0,keys={},last=0,walk=0;
let cameraYaw=Math.atan2(5.7,9.2),cameraPitch=-.29,cameraDistance=12;
const cameraTouches=new Map();
let pinchActive=false,pinchDistance=0,stepDistance=0,walkingMotion=0;
// Left-hand movement and right-hand camera gestures are independent.
// Pinch has priority only when two fingers are controlling the camera.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// Distinguish a deliberate two-finger spread/pinch from moving with left thumb
// while orbiting with the right. Both fingers must move along the line between them.
const gestureContacts=new Map();
let mixedPinchActive=false,mixedPinchDistance=0;
function touchDistance(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
window.addEventListener('pointerdown',e=>{
 if(e.pointerType!=='touch')return;
 gestureContacts.set(e.pointerId,{
  x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,
  side:e.clientX<innerWidth/2?'left':'right'
 });
},true);
window.addEventListener('pointermove',e=>{
 if(e.pointerType!=='touch'||!gestureContacts.has(e.pointerId))return;
 const item=gestureContacts.get(e.pointerId);
 item.x=e.clientX;item.y=e.clientY;
 if(gestureContacts.size!==2)return;
 const pair=[...gestureContacts.values()],a=pair[0],b=pair[1];
 // Two right-camera fingers use the existing instant pinch handling.
 if(a.side===b.side)return;
 const current=touchDistance(a,b);
 if(!mixedPinchActive){
  const startLength=Math.hypot(b.startX-a.startX,b.startY-a.startY)||1;
  const ux=(b.startX-a.startX)/startLength,uy=(b.startY-a.startY)/startLength;
  const moveA=(a.x-a.startX)*ux+(a.y-a.startY)*uy;
  const moveB=(b.x-b.startX)*ux+(b.y-b.startY)*uy;
  const separation=moveB-moveA;
  // Require both thumbs to contribute in opposite directions and a clear distance change.
  // Holding left movement and swiping only the right camera finger must not zoom.
  if(Math.abs(separation)<18||Math.abs(moveA)<7||Math.abs(moveB)<7||
     Math.sign(moveA)===Math.sign(moveB))return;
  mixedPinchActive=true;
  mixedPinchDistance=current;
  resetStick();
  cameraTouches.clear();
  return;
 }
 if(mixedPinchDistance>0)
  cameraDistance=clamp(cameraDistance*mixedPinchDistance/Math.max(1,current),4.5,26);
 mixedPinchDistance=current;
},true);
for(const name of ['pointerup','pointercancel','lostpointercapture']){
 window.addEventListener(name,e=>{
  if(e.pointerType!=='touch')return;
  gestureContacts.delete(e.pointerId);
  if(mixedPinchActive&&gestureContacts.size<2){
   mixedPinchActive=false;mixedPinchDistance=0;
   resetStick();cameraTouches.clear();pinchActive=false;pinchDistance=0;
  }
 },true);
}
// Touching the left side starts movement; right-side gestures orbit or zoom.
canvas.addEventListener('pointerdown',e=>{
 if(mixedPinchActive)return;
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
 if(mixedPinchActive)return;
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
  // Dragging down looks down; dragging up looks up (non-inverted vertical camera).
  cameraPitch=clamp(cameraPitch-dy*.006,-1.30,1.54);
 }
});
for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,e=>{
 if(mixedPinchActive)return;
 if(e.pointerId===pointer&&floatingOrigin){resetStick();return;}
 cameraTouches.delete(e.pointerId);
 if(cameraTouches.size<2){pinchActive=false;pinchDistance=0;}
});
canvas.addEventListener('wheel',e=>{e.preventDefault();cameraDistance=clamp(cameraDistance*Math.exp(e.deltaY*.001),4.5,26)},{passive:false});
