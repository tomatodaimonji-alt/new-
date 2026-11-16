function makeScene(){
 const bounds=pineChunkWindow();
 const m=mesh(),visible=[...world,...gameZoneProps,...gameInteriorProps].filter(o=>o.x>=bounds.x0&&o.x<bounds.x1&&o.z>=bounds.z0&&o.z<bounds.z1&&(!hideUpper||o.y<=level)&&!gameNatureHiddenTrees.has(o));
 // All buildings are cached independently by house and story.
 // Entering/exiting or changing camera visibility only changes which buffers are drawn.
 const buildingGroups=new Map();
 const pick=(o)=>{
  const id=gameRoofAt(o.x,o.z);
  if(!id)return m;
  let floors=buildingGroups.get(id);
  if(!floors){floors=new Map();buildingGroups.set(id,floors)}
  if(!floors.has(o.y))floors.set(o.y,mesh());
  return floors.get(o.y);
 };
 // Only build floor lookups for visible chunks and their one-tile edge neighbors.
 const floors=new Map(world.filter(o=>o.y===0&&isFloor(o.type)&&o.x>=bounds.x0-1&&o.x<=bounds.x1&&o.z>=bounds.z0-1&&o.z<=bounds.z1).map(o=>[o.x+','+o.z,o.type]));
 for(let z=bounds.z0;z<bounds.z1;z++)for(let x=bounds.x0;x<bounds.x1;x++){
  const kind=floors.get(x+','+z)||pineGroundKind(x,z);
  const tmp=mesh();
  addFloorTile(tmp,x,z,kind,pineWorldEnabled?96*96:MAP_W*MAP_H,ROAD_DIAGONALS.has(kind)?roadDiagonalConnections(floors,x,z,kind):ROAD_IDS.has(kind)&&!kind.endsWith('Full')?roadConnections(floors,x,z,kind):0);
  if(floors.has(x+','+z))shoreline(tmp,x,z,floors);
  shiftMesh(m,tmp,terrainY(x,z));
  const isWater=['river','water','lake','sea'].includes(kind);
  if(isWater){
   for(const [dx,dz] of [[0,-1],[1,0],[0,1],[-1,0]]){
    const nx=x+dx,nz=z+dz;
    if(nx<0||nz<0||nx>=MAP_W||nz>=MAP_H)continue;
    const neighbor=floors.get(nx+','+nz);
    if(['river','water','lake','sea'].includes(neighbor)&&terrainLevel(x,z)>terrainLevel(nx,nz))
     waterfallFace(m,x,z,dx,dz,terrainLevel(x,z),terrainLevel(nx,nz));
   }
  }
  const h=terrainLevel(x,z);
  if(h)for(const [dx,dz,face] of [[-1,0,3],[1,0,1],[0,-1,0],[0,1,2]]){
   const nx=x+dx,nz=z+dz,nh=validPos(nx,nz)?terrainLevel(nx,nz):0;
   if(validPos(nx,nz)&&h-nh===1&&terrainPassable(x,z,nx,nz))continue;
   terrainSide(m,x,z,h,nh,face);
  }

 }
 // Light scuffed-earth patches appear near grazing sheep, without replacing paths.
 for(const animal of visible.filter(o=>o.y===0&&o.type==='sheep')){
  for(const [dx,dz] of [[0,0],[-1,0],[1,0],[0,-1],[0,1]]){
   const xx=animal.x+dx,zz=animal.z+dz;
   if(!validPos(xx,zz))continue;
   const floor=floors.get(xx+','+zz)||'grass';
   if(!['grass','grassMeadow','grassTrampled','grassPatch','grassWild'].includes(floor))continue;
   if(surfaceNoise(xx*19+11,zz*17+3)<.32)continue;
   const t=mesh();roadRect(t,xx,zz,.20,.39,.46,.54,.019,[.47,.43,.32]);
   roadRect(t,xx,zz,.57,.20,.72,.32,.020,[.40,.49,.34]);
   shiftMesh(m,t,terrainY(xx,zz));
  }
 }
 // Upper-level floors are independent of the ground and share the same
 // road/stone/wood material renderer. Translate a local mesh vertically.
 const raised=visible.filter(o=>o.y>0&&isFloor(o.type));
 const floorLayers=new Map();
 for(const o of raised){
  if(!floorLayers.has(o.y))floorLayers.set(o.y,new Map());
  floorLayers.get(o.y).set(o.x+','+o.z,o.type);
 }
 for(const o of raised){
  const layer=floorLayers.get(o.y),tmp=mesh(),kind=o.type;
  addFloorTile(tmp,o.x,o.z,kind,MAP_W*MAP_H,ROAD_IDS.has(kind)&&!kind.endsWith('Full')?roadConnections(layer,o.x,o.z,kind):0);
  shiftMesh(pick(o),tmp,o.y*1.4+terrainY(o.x,o.z));
 }
 const bridgeLookup=gameBridgeTiles;
 const fenceLookup=new Map(visible.filter(o=>/^fence(Wood|Stone|Iron)/.test(o.type)).map(o=>[o.x+','+o.z+','+o.y,o]));
 const roofs=new Map(visible.filter(o=>roofFamily(o.type)).map(o=>[o.x+','+o.z+','+o.y,o]));
 // Facade trims must follow the same house and floor as their wall objects.
 const facadeBatches=new Map();
 for(const o of visible){
  const key=(gameRoofAt(o.x,o.z)||'world')+'|'+o.y;
  if(!facadeBatches.has(key))facadeBatches.set(key,[]);
  facadeBatches.get(key).push(o);
 }
 for(const batch of facadeBatches.values())houseFacadeDetails(pick(batch[0]),batch);
 const groups=residentialRoofComponents(visible.filter(o=>RESIDENTIAL_ROOFS.has(o.type)));
 const allRoofLookup=new Map(visible.filter(o=>RESIDENTIAL_ROOFS.has(o.type)).map(o=>[o.x+','+o.z+','+o.y,o]));
 for(const group of groups)residentialRoofGeometry(pick(group[0]),group,allRoofLookup);
 for(const o of visible){
  if(isFloor(o.type)||RESIDENTIAL_ROOFS.has(o.type))continue;
  const destination=pick(o);
  if(AUTO_ROOFS.has(o.type)){const temp=mesh();connectedRoofGeometry(temp,o,roofs);shiftMesh(destination,temp,terrainY(o.x,o.z))}
  else if(BRIDGE_IDS.has(o.type))bridgeConnectedGeometry(destination,o,bridgeLookup);
  else if(o.type==='pineLandingCraft')pineLandingCraftGeometry(destination,o.x+.5,o.z+.5);
  else if(o.type.startsWith('pineHarbor'))pineHarborGeometry(destination,o);
  else if(o.type.startsWith('pine'))pineZoneGeometry(destination,o);
  else if(o.type==='terrainStairs')elevationStairGeometry(destination,o.x,o.z,o.y*1.4+terrainY(o.x,o.z),o.rot||0);
  else if(/^fence(Wood|Stone|Iron)/.test(o.type)&&connectedFenceGeometry(destination,o,fenceLookup)){}
  else deco(destination,o.type,o.x+.5,o.y*1.4+terrainY(o.x,o.z),o.z+.5,o.rot||0);
 }
 // Worn paths, loose gravel and flattened soil inside refugee/military zones.
 for(const cell of gameZonePaths){
  if(cell.x<bounds.x0||cell.x>=bounds.x1||cell.z<bounds.z0||cell.z>=bounds.z1)continue;
  const bx=cell.x+.5,bz=cell.z+.5,by=terrainY(cell.x,cell.z)+.025;
  const tint=cell.kind==='camp'?[.49,.42,.31]:cell.kind==='military'?[.48,.46,.37]:[.50,.46,.35];
  cube(m,bx,by,bz,.96,.012,.95,tint);
 }
 // Small, passable woven rugs create comfortable interiors without blocking movement.
 for(const rug of gameInteriorRugs){
  if(hideUpper&&rug.y>level)continue;
  const target=pick(rug),x=rug.x+.5,z=rug.z+.5;
  const base=rug.y*1.4+terrainY(rug.x,rug.z)+.025;
  const tones=[[.49,.23,.19],[.29,.38,.31],[.51,.39,.21],[.28,.34,.49]];
  cube(target,x,base,z,.70,.012,.83,tones[rug.palette]);
  cube(target,x,base+.013,z,.50,.008,.62,[.70,.60,.42]);
  cube(target,x,base+.022,z,.43,.008,.55,tones[rug.palette]);
 }
 // Wall-mounted trim uses a shallow profile and never blocks stairs or passage.
 for(const accent of gameInteriorWallDetails){
  if(hideUpper&&accent.y>level)continue;
  const dst=pick(accent),x=accent.x+.5,z=accent.z+.5,yy=accent.y*1.4+terrainY(accent.x,accent.z);
  const wood=[.45,.29,.19],brass=[.78,.59,.31],paper=[.75,.65,.47];
  cube(dst,x-.39,yy+.69,z,.09,.07,.55,wood);
  cube(dst,x-.39,yy+.72,z-.20,.08,.27,.045,wood);
  cube(dst,x-.39,yy+.72,z+.20,.08,.27,.045,wood);
  if(accent.variant===0){
   cube(dst,x-.38,yy+.77,z-.12,.055,.18,.08,[.36,.40,.29]);
   cube(dst,x-.38,yy+.77,z+.08,.055,.15,.10,[.54,.39,.28]);
  }else if(accent.variant===1){
   cube(dst,x-.38,yy+.78,z,.11,.08,.14,brass);
   cube(dst,x-.38,yy+.87,z,.05,.11,.075,[.92,.69,.34]);
  }else{
   cube(dst,x-.38,yy+.80,z,.07,.16,.17,paper);
   cube(dst,x-.38,yy+.82,z+.13,.07,.11,.025,[.36,.27,.23]);
  }
 }
 // Virtual down stair landings belong to the same prebuilt building story.
 for(const stair of gameLandingMarkers){
  if(gameSolidByLayer.get(stair.y)?.has(gameTileKey(stair.x,stair.z)))continue;
  gameLandingGeometry(pick(stair),stair.x+.5,stair.y*1.4+terrainY(stair.x,stair.z)+.015,stair.z+.5,stair.rot||0);
 }
 // Replace old cached GPU buffers only when the actual world layout changes.
 for(const floors of sceneBuildingMeshes.values())for(const uploaded of floors.values())gl.deleteBuffer(uploaded.buf);
 sceneBuildingMeshes=new Map();
 for(const [id,floors] of buildingGroups){
  const meshes=new Map();
  for(const [story,geometry] of floors)meshes.set(story,upload(geometry));
  sceneBuildingMeshes.set(id,meshes);
 }
 return upload(m);
}
function upload(m){const n=m.p.length/3,data=new Float32Array(n*9);for(let i=0;i<n;i++){const a=i*9,b=i*3;for(let j=0;j<3;j++){data[a+j]=m.p[b+j];data[a+3+j]=m.n[b+j];data[a+6+j]=m.c[b+j]}}const vbo=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);return{buf:vbo,count:n}}
const VERT='precision mediump float;attribute vec3 aPos;attribute vec3 aNorm;attribute vec3 aCol;uniform mat4 uMVP;varying vec3 vCol;void main(){gl_Position=uMVP*vec4(aPos,1.0);float l=.60+.40*max(dot(normalize(aNorm),normalize(vec3(-.4,1.0,.35))),0.0);vCol=aCol*l;}';
const FRAG='precision mediump float;varying vec3 vCol;uniform float uAlpha;void main(){if(uAlpha<.99){float p=mod(floor(gl_FragCoord.x)*3.0+floor(gl_FragCoord.y)*5.0,16.0);if(p>1.0)discard;}gl_FragColor=vec4(pow(max(vCol,vec3(0.0)),vec3(.92)),1.0);}';
function sh(t,src){const s=gl.createShader(t);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s}
let program;try{program=gl.createProgram();gl.attachShader(program,sh(gl.VERTEX_SHADER,VERT));gl.attachShader(program,sh(gl.FRAGMENT_SHADER,FRAG));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program))}catch(e){$('canvasTip').textContent='WebGLシェーダーエラー: '+e.message;return}
gl.useProgram(program);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LESS);gl.clearColor(0,0,0,0);const loc={p:gl.getAttribLocation(program,'aPos'),n:gl.getAttribLocation(program,'aNorm'),c:gl.getAttribLocation(program,'aCol'),mvp:gl.getUniformLocation(program,'uMVP'),alpha:gl.getUniformLocation(program,'uAlpha')};
gl.uniform1f(loc.alpha,1);
try{initSignProgram()}catch(e){console.warn('2D sign textures unavailable',e)}
function mult(a,b){const c=new Float32Array(16);for(let i=0;i<4;i++)for(let j=0;j<4;j++)for(let k=0;k<4;k++)c[j*4+i]+=a[k*4+i]*b[j*4+k];return c}
function ortho(l,r,b,t,n,f){return new Float32Array([2/(r-l),0,0,0,0,2/(t-b),0,0,0,0,-2/(f-n),0,-(r+l)/(r-l),-(t+b)/(t-b),-(f+n)/(f-n),1])}
function look(eye,target){let f=eye.map((v,i)=>v-target[i]),len=Math.hypot(...f);f=f.map(v=>v/len);let right=[f[2],0,-f[0]];len=Math.hypot(...right);right=right.map(v=>v/len);const up=[f[1]*right[2]-f[2]*right[1],f[2]*right[0]-f[0]*right[2],f[0]*right[1]-f[1]*right[0]];return new Float32Array([right[0],up[0],f[0],0,right[1],up[1],f[1],0,right[2],up[2],f[2],0,-right.reduce((s,v,i)=>s+v*eye[i],0),-up.reduce((s,v,i)=>s+v*eye[i],0),-f.reduce((s,v,i)=>s+v*eye[i],0),1])}
function draw(mesh,vp){if(!mesh||!mesh.count)return;gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buf);for(const [a,offset] of [[loc.p,0],[loc.n,12],[loc.c,24]]){gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,3,gl.FLOAT,false,36,offset)}gl.uniformMatrix4fv(loc.mvp,false,vp);gl.drawArrays(gl.TRIANGLES,0,mesh.count)}
function layout(){const dpr=Math.min(devicePixelRatio||1,1.5),w=Math.max(1,Math.round(canvas.clientWidth*dpr)),h=Math.max(1,Math.round(canvas.clientHeight*dpr));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h)}return{w:canvas.clientWidth,h:canvas.clientHeight,aspect:canvas.clientWidth/canvas.clientHeight}}
function zoomForFullMap(){
 const aspect=Math.max(.25,canvas.clientWidth/Math.max(1,canvas.clientHeight));
 const c=Math.abs(Math.cos(yaw)),sn=Math.abs(Math.sin(yaw));
 const horizontal=(MAP_W*c+MAP_H*sn)/2/aspect;
 const vertical=(MAP_W*sn+MAP_H*c)*Math.sin(.86)/2;
 const height=world.reduce((top,o)=>Math.max(top,o.y),0)*1.4+Math.max(0,...terrainHeights.values())*TERRAIN_STEP;return Math.max(.025,Math.min(4,9/(Math.max(horizontal,vertical)+height*.38)*1.18));
}
function showEntireMap(){panX=panZ=0;zoom=zoomForFullMap();cursorDirty=true}
function parameters(){const q=layout(),halfH=9/zoom,halfW=halfH*q.aspect;const centerX=MAP_W/2+panX,centerZ=MAP_H/2+panZ,elev=.86,targetY=gameSurfaceY(gameX,gameZ)+.85;const eye=[centerX+24*Math.sin(yaw)*Math.cos(elev),targetY+24*Math.sin(elev),centerZ+24*Math.cos(yaw)*Math.cos(elev)];return{...q,halfH,halfW,centerX,centerZ,elev,targetY,vp:mult(ortho(-halfW,halfW,-halfH,halfH,.1,100),look(eye,[centerX,targetY,centerZ]))}}
function cursorAt(clientX,clientY){
 const b=canvas.getBoundingClientRect(),p=parameters(),nx=(clientX-b.left)/b.width*2-1,ny=1-(clientY-b.top)/b.height*2,a=nx*p.halfW;
 let x=0,z=0,height=0;
 for(let i=0;i<5;i++){
  const c=(-ny*p.halfH+(level*1.4+height-p.targetY)*Math.cos(p.elev))/Math.sin(p.elev);
  x=Math.floor(p.centerX+a*Math.cos(yaw)+c*Math.sin(yaw));
  z=Math.floor(p.centerZ-a*Math.sin(yaw)+c*Math.cos(yaw));
  height=validPos(x,z)?terrainY(x,z):0;
 }
 return{x,z};
}
function makeCursor(){const m=mesh();if(!hover||!validPos(hover.x,hover.z))return upload(m);const x=hover.x+.5,z=hover.z+.5,y=level*1.4+terrainY(hover.x,hover.z)+.205;const c=[.96,.73,.30],t=.045;cube(m,x,y,z-.45,.95,t,.055,c);cube(m,x,y,z+.45,.95,t,.055,c);cube(m,x-.45,y,z,.055,t,.95,c);cube(m,x+.45,y,z,.055,t,.95,c);return upload(m)}
