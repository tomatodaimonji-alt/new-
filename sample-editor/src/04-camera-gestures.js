let player={x:0,z:0,heading:0},padX=0,padY=0,keys={},last=0,walk=0;
let cameraYaw=Math.atan2(5.7,9.2),cameraPitch=-.29,cameraDistance=12;
const cameraTouches=new Map();
let pinchActive=false,pinchDistance=0,stepDistance=0,walkingMotion=0;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function cameraPinchDistance(){
 const fingers=[...cameraTouches.values()].slice(0,2);
 return fingers.length<2?0:Math.hypot(fingers[0].x-fingers[1].x,fingers[0].y-fingers[1].y);
}
// v16: Each pointer is permanently assigned when it touches down:
// left = movement, right = camera. Two RIGHT camera pointers = pinch.
// Never reclassify left movement + right camera as zoom during a gesture.
canvas.addEventListener('pointerdown',e=>{
 if(e.pointerType==='mouse'&&e.button!==0)return;
 canvas.setPointerCapture(e.pointerId);
 if(shootState.enabled&&shootState.playing)return;
 const isLeft=e.pointerType==='touch'&&e.clientX<window.innerWidth/2&&!shootState.enabled;
 if(isLeft){
  if(pointer===null){
   pointer=e.pointerId;
   beginFloatingPad(e.clientX,e.clientY);
  }
  // Second left finger is ignored; it must not steal right-side look.
 }else{
  cameraTouches.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(cameraTouches.size>=2){
   pinchActive=true;
   pinchDistance=cameraPinchDistance();
  }
 }
 unlockAudio();
});
canvas.addEventListener('pointermove',e=>{
 if(shootState.enabled&&shootState.playing)return;
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
  const distance=cameraPinchDistance();
  if(pinchDistance>0)cameraDistance=clamp(cameraDistance*pinchDistance/Math.max(1,distance),4.5,26);
  pinchDistance=distance;
 }else{
  // Both thumbs can move concurrently; only this right-hand pointer rotates the camera.
  cameraYaw-=dx*.007;
  cameraPitch=clamp(cameraPitch-dy*.006,-1.30,1.54);
 }
});
for(const name of ['pointerup','pointercancel','lostpointercapture'])
 canvas.addEventListener(name,e=>{
  if(e.pointerId===pointer){resetStick();return;}
  cameraTouches.delete(e.pointerId);
  if(cameraTouches.size<2){pinchActive=false;pinchDistance=0;}
 });
canvas.addEventListener('wheel',e=>{
 e.preventDefault();cameraDistance=clamp(cameraDistance*Math.exp(e.deltaY*.001),4.5,26);
},{passive:false});
