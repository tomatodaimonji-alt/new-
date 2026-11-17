function blocked(x,z){
 // Stop the player at real wall footprints; leave the entire pedestrian lane open.
 for(const b of townBuildings){
  if(Math.abs(x-b.cx)<b.depth*.5+.26&&Math.abs(z-b.cz)<b.width*.5+.26)return true;
 }
 return convenienceBlocked(x,z);
}
function bind(buffer){gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.vertexAttribPointer(locP,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(locP);gl.vertexAttribPointer(locC,3,gl.FLOAT,false,24,12);gl.enableVertexAttribArray(locC)}
