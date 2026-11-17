function frame(now){
 const dt=Math.min(.05,(now-last)/1000||0);last=now;
 let mx=padX+(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0),
 my=padY+(keys.s||keys.arrowdown?1:0)-(keys.w||keys.arrowup?1:0);
 const tilt=Math.min(1,Math.hypot(mx,my)),active=tilt>.12;
 let running=false;
 if(active){
  const length=Math.hypot(mx,my);
  mx/=length;my/=length;
  // Use camera-relative movement so the stick always matches screen direction.
  // Camera-relative movement: up goes away from the camera, down goes toward it.
  const vx=mx*Math.cos(cameraYaw)+my*Math.sin(cameraYaw);
  const vz=-mx*Math.sin(cameraYaw)+my*Math.cos(cameraYaw);
  running=tilt>.72;
  const metersPerSecond=running?3.15+(tilt-.72)/.28*2.25:1.15+tilt*2.85;
  const dx=vx*dt*metersPerSecond,dz=vz*dt*metersPerSecond;
  const beforeX=player.x,beforeZ=player.z;
  const nx=clamp(player.x+dx,-112,112),nz=clamp(player.z+dz,-112,112);
  if(!blocked(nx,player.z))player.x=nx;
  if(!blocked(player.x,nz))player.z=nz;
  const moved=Math.hypot(player.x-beforeX,player.z-beforeZ);
  if(moved>.0001){
   player.heading=Math.atan2(vx,vz);
   walk+=dt*(running?14:8.5);
   stepDistance+=moved;
   const stride=running?1.12:.78;
   if(stepDistance>=stride){stepDistance%=stride;footstep(running)}
  }
 }

 vertices.length=0;
 // Character geometry is owned by a dedicated, reusable character module.
 renderDetailedPlayer(player.x,player.z,player.heading,walk,tilt,running);
 // Identify the selected building in editor mode without changing the building itself.
 if(editorOpen){
  const picked=selectedShop();
  box(picked.x,picked.height+.28,picked.z,.52,.38,.52,0xffd65c);
 }
 const arr=new Float32Array(vertices);gl.bindBuffer(gl.ARRAY_BUFFER,avatarBuffer);gl.bufferData(gl.ARRAY_BUFFER,arr,gl.DYNAMIC_DRAW);
 const dpr=Math.min(2,window.devicePixelRatio||1),w=Math.round(canvas.clientWidth*dpr),h=Math.round(canvas.clientHeight*dpr);
 if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}gl.viewport(0,0,w,h);gl.enable(gl.DEPTH_TEST);gl.clearColor(.56,.73,.83,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
 // Free-look pitch: remain above the street while allowing an upward view of the sky.
 // Upward pitch does not drag the camera below the ground or underneath buildings.
 const eye=[player.x+Math.sin(cameraYaw)*cameraDistance*.84,
 1.35+cameraDistance*.25,
 player.z+Math.cos(cameraYaw)*cameraDistance*.84];
 const dir=[-Math.sin(cameraYaw)*Math.cos(cameraPitch),
 Math.sin(cameraPitch),
 -Math.cos(cameraYaw)*Math.cos(cameraPitch)];
 const look=[eye[0]+dir[0]*cameraDistance,eye[1]+dir[1]*cameraDistance,
 eye[2]+dir[2]*cameraDistance];
 const vp=mat4.mul(mat4.perspective(1.05,w/h,.1,350),mat4.look(eye,look));
 gl.uniformMatrix4fv(locVP,false,vp);
 bind(staticBuffer);gl.drawArrays(gl.TRIANGLES,0,staticArray.length/6);
 for(const b of townBuildings){bind(b.buffer);gl.drawArrays(gl.TRIANGLES,0,b.count)}
 bind(avatarBuffer);gl.drawArrays(gl.TRIANGLES,0,arr.length/6);
 requestAnimationFrame(frame);
}
resetStick();requestAnimationFrame(frame);
