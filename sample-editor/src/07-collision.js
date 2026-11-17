function blocked(x,z){
 // Stop the player at real wall footprints; leave the entire pedestrian lane open.
 for(const b of townBuildings){
  if(Math.abs(x-b.cx)<b.depth*.5+.26&&Math.abs(z-b.cz)<b.width*.5+.26)return true;
 }
 return false;
}
// Hide only buildings between the player and camera; no transparent sorting artifacts.
function obscuresPlayer(b,camera){
 const ax=camera[0]-player.x,az=camera[2]-player.z;
 const bx=b.cx-player.x,bz=b.cz-player.z;
 const len=ax*ax+az*az,t=(bx*ax+bz*az)/(len||1);
 if(t<=0||t>=1)return false;
 const nearX=player.x+ax*t,nearZ=player.z+az*t;
 return Math.abs(nearX-b.cx)<4.4&&Math.abs(nearZ-b.cz)<4.4;
}
function bind(buffer){gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.vertexAttribPointer(locP,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(locP);gl.vertexAttribPointer(locC,3,gl.FLOAT,false,24,12);gl.enableVertexAttribArray(locC)}
