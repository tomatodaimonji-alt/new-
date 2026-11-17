let characterMovementBlend=0;
function frame(now){
 const dt=Math.min(.05,(now-last)/1000||0);last=now;
 updateShots(dt);
 updateNPCs(dt);
 let mx=padX+(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0),
 my=padY+(keys.s||keys.arrowdown?1:0)-(keys.w||keys.arrowup?1:0);
 const tilt=Math.min(1,Math.hypot(mx,my)),active=tilt>.12;
 let running=false,movedDistance=0;
 if(active&&!shootState.enabled){
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
  if(!blocked(nx,player.z)&&!npcBlocks(nx,player.z))player.x=nx;
  if(!blocked(player.x,nz)&&!npcBlocks(player.x,nz))player.z=nz;
  const moved=Math.hypot(player.x-beforeX,player.z-beforeZ);
  movedDistance=moved;
  if(moved>.0001){
   player.heading=Math.atan2(vx,vz);
   // Advance one half-stride for each physical footstep, matching the footfall SE.
   walk+=moved*Math.PI/(running?1.12:.78);
   stepDistance+=moved;
   const stride=running?1.12:.78;
   if(stepDistance>=stride){stepDistance%=stride;footstep(running)}
  }
 }

 // Blend to an idle pose when the stick is released or movement is blocked.
 characterMovementBlend+=((movedDistance>.0001?tilt:0)-characterMovementBlend)*Math.min(1,dt*9);
 vertices.length=0;
 // A transparent contact shadow anchors the feet without requiring a shadow map.
 renderPlayerShadow(player.x,player.z,player.heading,characterMovementBlend,walk);
 renderNpcShadows();
 const shadowVertices=vertices.length/6;
 // Reuse the same body, clothes and gait implementation for the player and NPCs.
 renderDetailedPlayer(player.x,player.z,player.heading,walk,characterMovementBlend,running);
 renderNPCs();
 // Identify the selected building in editor mode without changing the building itself.
 if(editorOpen&&!shootState.enabled){
  if(fixtureEditMode){
   const picked=selectedFixture();
   box(picked.x,picked.height+.13,picked.z,.22,.19,.22,0xffd65c);
  }else{
   const picked=selectedShop();
   box(picked.x,picked.height+.28,picked.z,.52,.38,.52,0xffd65c);
  }
 }
 const arr=new Float32Array(vertices);gl.bindBuffer(gl.ARRAY_BUFFER,avatarBuffer);gl.bufferData(gl.ARRAY_BUFFER,arr,gl.DYNAMIC_DRAW);
 const dpr=Math.min(2,window.devicePixelRatio||1),w=Math.round(canvas.clientWidth*dpr),h=Math.round(canvas.clientHeight*dpr);
 if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}
 const portrait=shootState.enabled&&shootState.portrait;
 const viewWidth=portrait?Math.min(w,Math.round(h*9/16)):w;
 const viewX=portrait?Math.floor((w-viewWidth)/2):0;
 gl.viewport(0,0,w,h);
 gl.enable(gl.DEPTH_TEST);
 gl.clearColor(portrait?.075:.56,portrait?.087:.73,portrait?.105:.83,1);
 gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
 gl.viewport(viewX,0,viewWidth,h);
 if(portrait){
  gl.enable(gl.SCISSOR_TEST);gl.scissor(viewX,0,viewWidth,h);
  gl.clearColor(.56,.73,.83,1);
  gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
 }

 // Free-look pitch: remain above the street while allowing an upward view of the sky.
 // Upward pitch does not drag the camera below the ground or underneath buildings.
 const focusX=shootState.enabled?shootState.focusX:player.x;
 const focusZ=shootState.enabled?shootState.focusZ:player.z;
 const idealEye=[focusX+Math.sin(cameraYaw)*cameraDistance*.84,
 1.35+cameraDistance*.25,
 focusZ+Math.cos(cameraYaw)*cameraDistance*.84];
 // v21: exploration alone resolves walls and shelving between player and camera.
 // Shot mode uses the exact stored composition, with no automatic repositioning.
 const eye=shootState.enabled?idealEye:resolveExplorationCamera(
  [player.x,1.35,player.z],idealEye,dt);
 const dir=[-Math.sin(cameraYaw)*Math.cos(cameraPitch),
 Math.sin(cameraPitch),
 -Math.cos(cameraYaw)*Math.cos(cameraPitch)];
 const look=[eye[0]+dir[0]*cameraDistance,eye[1]+dir[1]*cameraDistance,
 eye[2]+dir[2]*cameraDistance];
 const vp=mat4.mul(mat4.perspective(1.05,viewWidth/h,.1,350),mat4.look(eye,look));
 gl.uniformMatrix4fv(locVP,false,vp);
 bind(staticBuffer);gl.drawArrays(gl.TRIANGLES,0,staticArray.length/6);
 for(const b of townBuildings){bind(b.buffer);gl.drawArrays(gl.TRIANGLES,0,b.count)}
 for(const item of convenienceBuffers){bind(item.buffer);gl.drawArrays(gl.TRIANGLES,0,item.count)}
 bind(avatarBuffer);
 // Alpha blend only the ground decal, and keep it out of the depth buffer.
 gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
 gl.depthMask(false);gl.uniform1f(locOpacity,.30);
 gl.drawArrays(gl.TRIANGLES,0,shadowVertices);
 gl.uniform1f(locOpacity,1);gl.depthMask(true);gl.disable(gl.BLEND);
 gl.drawArrays(gl.TRIANGLES,shadowVertices,arr.length/6-shadowVertices);
 if(portrait)gl.disable(gl.SCISSOR_TEST);
 requestAnimationFrame(frame);
}
resetStick();requestAnimationFrame(frame);
