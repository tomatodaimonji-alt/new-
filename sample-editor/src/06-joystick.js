const pad=document.getElementById('pad'),stick=document.getElementById('stick');
let pointer=null,floatingOrigin=null;
function beginFloatingPad(x,y){
 floatingOrigin={x,y};
 // Move the existing visible pad, not a duplicate. Its fixed CSS position is restored on release.
 pad.style.left=(x-pad.offsetWidth/2)+'px';
 pad.style.top=(y-pad.offsetHeight/2)+'px';
 pad.style.bottom='auto';
 padX=padY=0;
 updateStickDisplay();
}
function restorePadPosition(){
 pad.style.left='';pad.style.top='';pad.style.bottom='';
}
function updateStickDisplay(){
 const radius=pad.clientWidth*.32,size=stick.offsetWidth;
 stick.style.left=(pad.clientWidth/2-size/2+padX*radius)+'px';
 stick.style.top=(pad.clientHeight/2-size/2+padY*radius)+'px';
}
function moveStick(e){
 const r=pad.getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2;
 const rad=r.width*.32,scale=Math.min(1,rad/(Math.hypot(dx,dy)||1));
 padX=dx*scale/rad;padY=dy*scale/rad;updateStickDisplay();
}
function resetStick(){pointer=null;floatingOrigin=null;padX=padY=0;restorePadPosition();updateStickDisplay()}
pad.addEventListener('pointerdown',e=>{
 if(mixedPinchActive||pointer!==null)return;
 pointer=e.pointerId;
 pad.setPointerCapture(pointer);
 if(e.pointerType==='touch')beginFloatingPad(e.clientX,e.clientY);
 else moveStick(e);
 unlockAudio();
});pad.addEventListener('pointermove',e=>{
 if(mixedPinchActive||e.pointerId!==pointer)return;
 if(floatingOrigin){
  const radius=Math.max(36,pad.clientWidth*.32);
  const dx=e.clientX-floatingOrigin.x,dy=e.clientY-floatingOrigin.y;
  const scale=Math.min(1,radius/(Math.hypot(dx,dy)||1));
  padX=dx*scale/radius;padY=dy*scale/radius;updateStickDisplay();
 }else moveStick(e);
});for(const ev of ['pointerup','pointercancel','lostpointercapture'])pad.addEventListener(ev,e=>{if(e.pointerId===pointer)resetStick()});
window.addEventListener('keydown',e=>{keys[e.key.toLowerCase()]=true});window.addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=false});window.addEventListener('blur',()=>{resetStick();cameraTouches.clear();pinchActive=false;pinchDistance=0;gestureContacts.clear();mixedPinchActive=false;mixedPinchDistance=0});
