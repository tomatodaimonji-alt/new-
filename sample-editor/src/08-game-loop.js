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
 const bob=active?Math.sin(walk)*.045:0;
 // Approximately 1.75 m tall human, with rounded anatomy and gently swinging limbs.
 const px=player.x,pz=player.z,theta=player.heading;
 const sw=active?Math.sin(walk)*(running?.21:.13):0;
 ellipsoid(px,1.00+bob,pz,.34,.48,.23,0x426779,14,9); // fitted torso
 ellipsoid(px,1.51+bob,pz,.16,.12,.17,0xc69d81); // neck
 ellipsoid(px,1.66+bob,pz,.22,.27,.22,0xc69d81,14,10); // head
 ellipsoid(px,1.82+bob,pz-.012,.225,.095,.23,0x2d2927); // hair
 // Face has unmistakable forward direction (local -Z): eyes, nose and upper chest.
 ellipsoid(px-.09,1.69+bob,pz-.211,.035,.025,.026,0x292929,8,5);
 ellipsoid(px+.09,1.69+bob,pz-.211,.035,.025,.026,0x292929,8,5);
 ellipsoid(px,1.61+bob,pz-.244,.052,.066,.075,0xb78c6c,10,6);
 box(px,1.08+bob,pz-.229,.17,.13,.025,0xb5a48c);
 for(const side of [-1,1]){
  const x=px+side*.43;
  ellipsoid(x,1.02+bob+side*sw,pz,.135,.37,.14,0x426779);
  ellipsoid(x, .66+bob+side*sw,pz,.115,.12,.12,0xc69d81);
  ellipsoid(px+side*.175,.43+bob-side*sw,pz,.155,.40,.17,0x293b4a);
  ellipsoid(px+side*.175,.10+bob-side*sw,pz+.09,.16,.105,.27,0x303133);
 }
 // Rotate every avatar vertex around its vertical axis to match walking direction.
 // The mesh is sculpted facing local -Z, so its natural heading is PI.
 const rotation=player.heading-Math.PI,cs=Math.cos(rotation),sn=Math.sin(rotation);
 for(let i=0;i<vertices.length;i+=6){
  const dx=vertices[i]-px,dz=vertices[i+2]-pz;
  vertices[i]=px+dx*cs+dz*sn;
  vertices[i+2]=pz-dx*sn+dz*cs;
 }
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
