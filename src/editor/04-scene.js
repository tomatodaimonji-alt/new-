// Editor walk-through uses the same bare avatar and stride/facing rules as PINE gameplay.
let poiWalkActive=false,poiWalkX=0,poiWalkZ=0,poiWalkMesh=null,poiWalkOldRoof=false;
let poiWalkFacing=2,poiWalkStarted=-10000,poiWalkFromX=0,poiWalkFromZ=0;
let poiWalkViewX=0,poiWalkViewZ=0,poiWalkNextReady=0;
const POI_WALK_MS=160;
function poiWalkIndoor(){
 const a=world.filter(o=>o.type==='pineSuperRoof');if(!a.length)return false;
 let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
 for(const p of a){left=Math.min(left,p.x);right=Math.max(right,p.x);top=Math.min(top,p.z);bottom=Math.max(bottom,p.z)}
 return poiWalkX>left&&poiWalkX<right&&poiWalkZ>top&&poiWalkZ<bottom;
}
function poiWalkRoof(){
 if(!poiWalkActive)return;
 const next=poiWalkIndoor();
 if(hideUpper!==next){hideUpper=next;$('hideUpper').checked=next;dirty=true;cursorDirty=true}
 $('poiRoofToggle').textContent=next?'屋根を表示':'屋根を隠す';
}
function poiWalkAvatar(now=performance.now()){
 if(poiWalkMesh){gl.deleteBuffer(poiWalkMesh.buf);poiWalkMesh=null}
 if(!poiWalkActive)return;
 const m=mesh(),body=mesh();
 characterHuman(body,0,0,0,false);
 const t=Math.max(0,Math.min(1,(now-poiWalkStarted)/POI_WALK_MS)),smooth=t*t*(3-2*t);
 const x=poiWalkViewX+.5;
 const z=poiWalkViewZ+.5;
 const y=terrainY(poiWalkX,poiWalkZ)+.03;
 const walking=t<1&&(poiWalkFromX!==poiWalkX||poiWalkFromZ!==poiWalkZ);
 const stride=walking?Math.sin(t*Math.PI*2)*.18:0;
 const r=[2,3,0,1][poiWalkFacing];
 for(let i=0;i<body.p.length;i+=3){
  const lx=body.p[i],ly=body.p[i+1],lz=body.p[i+2];
  const swing=ly<.54&&Math.abs(lx)<.22?(lx<0?-stride:stride):
    ly>.45&&ly<.85&&Math.abs(lx)>.23?(lx<0?stride:-stride)*.40:0;
  const [rx,rz]=rot2(lx,lz+swing,r);
  m.p.push(x+rx,y+ly+(walking?.015*Math.abs(stride):0),z+rz);
  const [nx,nz]=rot2(body.n[i],body.n[i+2],r);
  m.n.push(nx,body.n[i+1],nz);
  m.c.push(body.c[i],body.c[i+1],body.c[i+2]);
 }
 poiWalkMesh=upload(m);
}
function poiWalkFrame(now){
 if(!poiWalkActive)return;
 const t=Math.max(0,Math.min(1,(now-poiWalkStarted)/POI_WALK_MS)),smooth=t*t*(3-2*t);
 poiWalkViewX=poiWalkFromX+(poiWalkX-poiWalkFromX)*smooth;
 poiWalkViewZ=poiWalkFromZ+(poiWalkZ-poiWalkFromZ)*smooth;
 panX=poiWalkViewX+.5-MAP_W/2;panZ=poiWalkViewZ+.5-MAP_H/2;
 if(now-poiWalkStarted<=POI_WALK_MS+32)poiWalkAvatar(now);
}
function poiWalkCanStep(x,z){
 if(!validPos(x,z))return false;
 // Vehicles occupy more than one tile and cannot be walked through.
 if(world.some(o=>pineSuperVehicleType(o.type)&&Math.abs(o.x-x)<=1&&Math.abs(o.z-z)<=1))return false;
 const blocking=world.find(o=>o.y===0&&o.x===x&&o.z===z&&!isFloor(o.type)&&
 !['pineSuperDoor','plasterwallDoor','woodwallDoor','brickwallDoor','pineSuperLogo','pineSuperStripe','pineSuperBayEnd','pineSuperCurb','pineSuperBollard','pineSuperSign'].includes(o.type));
 return !blocking;
}
function poiWalkCamera(){panX=poiWalkViewX+.5-MAP_W/2;panZ=poiWalkViewZ+.5-MAP_H/2;zoom=Math.max(zoom,.82);cursorDirty=true}
function poiWalkStatus(){const e=$('poiWalkCoords');if(e)e.textContent='位置 '+(poiWalkX+1)+','+(poiWalkZ+1)+(poiWalkIndoor()?'・店内':'・屋外')}
function poiWalkStep(dx,dz){
 if(!poiWalkActive)return;
 const now=performance.now();
 if(now<poiWalkNextReady)return;
 poiWalkFacing=dx===1?1:dx===-1?3:dz===-1?0:2;
 if(!poiWalkCanStep(poiWalkX+dx,poiWalkZ+dz)){poiWalkAvatar();return}
 poiWalkFromX=poiWalkX;poiWalkFromZ=poiWalkZ;poiWalkX+=dx;poiWalkZ+=dz;
 poiWalkStarted=now;poiWalkNextReady=now+POI_WALK_MS;
 poiWalkRoof();poiWalkAvatar(poiWalkStarted);poiWalkStatus();
}
function poiWalkReset(x,z){
 poiWalkX=x;poiWalkZ=z;poiWalkFromX=x;poiWalkFromZ=z;poiWalkViewX=x;poiWalkViewZ=z;poiWalkStarted=-10000;poiWalkNextReady=0;
 if(poiWalkActive){poiWalkRoof();poiWalkAvatar();poiWalkCamera();poiWalkStatus()}
}
function poiWalkSet(active){
 if(active===poiWalkActive)return;
 poiWalkActive=active;
 if(active){
  poiWalkOldRoof=hideUpper;
  hideUpper=false;$('hideUpper').checked=false;
  level=0;$('level').value='0';mode='move';
  poiWalkFromX=poiWalkX;poiWalkFromZ=poiWalkZ;poiWalkViewX=poiWalkX;poiWalkViewZ=poiWalkZ;
  poiWalkRoof();poiWalkCamera();
 }else{
  hideUpper=poiWalkOldRoof;$('hideUpper').checked=hideUpper;
  if(poiWalkMesh){gl.deleteBuffer(poiWalkMesh.buf);poiWalkMesh=null}
  showEntireMap();
 }
 $('poiWalkPad').classList.toggle('active',active);
 $('poiWalkToggle').textContent=active?'歩行中':'人型で歩く';
 $('poiRoofToggle').textContent=hideUpper?'屋根を表示':'屋根を隠す';
 poiWalkAvatar();poiWalkStatus();dirty=true;cursorDirty=true;updateSelected();
}
// Exterior cells are flood-filled independently on each floor. A face pointing
// into a closed room is smooth; a face pointing into connected outdoor air is
// decorated. This is recalculated when blocks or dimensions change.
function wallExteriorLookup(visible){
 const layers=new Map(),blocking=t=>isWallId(t)||/^(?:wall|stonewall|woodwall|brickwall|plasterwall|mosswall|ironwall)(?:Window|Door|Counter)$/.test(t)||t==='door'||t==='window';
 for(const o of visible){
  if(!blocking(o.type))continue;
  if(!layers.has(o.y))layers.set(o.y,new Map());
  layers.get(o.y).set(o.x+','+o.z,o);
 }
 const outdoors=new Map(),count=MAP_W*MAP_H;
 for(const [level,blocks] of layers){
  const blocked=new Uint8Array(count),outside=new Uint8Array(count),queue=new Int32Array(count);
  for(const o of blocks.values())if(validPos(o.x,o.z))blocked[o.z*MAP_W+o.x]=1;
  let head=0,tail=0;
  const add=(x,z)=>{
   const i=z*MAP_W+x;
   if(!blocked[i]&&!outside[i]){outside[i]=1;queue[tail++]=i}
  };
  for(let x=0;x<MAP_W;x++){add(x,0);add(x,MAP_H-1)}
  for(let z=0;z<MAP_H;z++){add(0,z);add(MAP_W-1,z)}
  while(head<tail){
   const idx=queue[head++],x=idx%MAP_W,z=(idx-x)/MAP_W;
   if(x>0)add(x-1,z);
   if(x+1<MAP_W)add(x+1,z);
   if(z>0)add(x,z-1);
   if(z+1<MAP_H)add(x,z+1);
  }
  outdoors.set(level,outside);
 }
 return{layers,outdoors};
}
function wallFaceState(o,lookup){
 const neighbors=lookup.layers.get(o.y),outdoor=lookup.outdoors.get(o.y);
 const visible=[],exterior=[];
 for(const [dx,dz] of [[0,1],[-1,0],[0,-1],[1,0]]){
  const x=o.x+dx,z=o.z+dz,inBounds=validPos(x,z);
  const occupied=inBounds&&neighbors.has(x+','+z);
  visible.push(!occupied);
  exterior.push(!occupied&&(!inBounds||outdoor[z*MAP_W+x]===1));
 }
 return{visible,exterior};
}
function makeScene(){
 const m=mesh(),visible=world.filter(o=>!hideUpper||o.y<=level);
 const floors=new Map(world.filter(o=>o.y===0&&isFloor(o.type)).map(o=>[o.x+','+o.z,o.type]));
 for(let z=0;z<MAP_H;z++)for(let x=0;x<MAP_W;x++){
  const kind=floors.get(x+','+z)||'grass';
  const tmp=mesh();
  addFloorTile(tmp,x,z,kind,MAP_W*MAP_H,ROAD_DIAGONALS.has(kind)?roadDiagonalConnections(floors,x,z,kind):ROAD_IDS.has(kind)&&!kind.endsWith('Full')?roadConnections(floors,x,z,kind):0);
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
  shiftMesh(m,tmp,o.y*1.4+terrainY(o.x,o.z));
 }
 const bridgeLookup=new Map(visible.filter(o=>BRIDGE_IDS.has(o.type)).map(o=>[o.x+','+o.z,o]));
 const fenceLookup=new Map(visible.filter(o=>/^fence(Wood|Stone|Iron)/.test(o.type)).map(o=>[o.x+','+o.z+','+o.y,o]));
 const roofs=new Map(visible.filter(o=>roofFamily(o.type)).map(o=>[o.x+','+o.z+','+o.y,o]));
 const wallLookup=wallExteriorLookup(visible);
 houseFacadeDetails(m,visible);
 const groups=residentialRoofComponents(visible.filter(o=>RESIDENTIAL_ROOFS.has(o.type)));
 const allRoofLookup=new Map(visible.filter(o=>RESIDENTIAL_ROOFS.has(o.type)).map(o=>[o.x+','+o.z+','+o.y,o]));
 for(const group of groups)residentialRoofGeometry(m,group,allRoofLookup);
 for(const o of visible){
  if(isFloor(o.type)||RESIDENTIAL_ROOFS.has(o.type))continue;
  if(AUTO_ROOFS.has(o.type)){const temp=mesh();connectedRoofGeometry(temp,o,roofs);shiftMesh(m,temp,terrainY(o.x,o.z))}
  else if(BRIDGE_IDS.has(o.type))bridgeConnectedGeometry(m,o,bridgeLookup);
  else if(o.type==='pineLandingCraft')pineLandingCraftGeometry(m,o.x+.5,o.z+.5);
  else if(o.type.startsWith('pineHarbor'))pineHarborGeometry(m,o);
  else if(o.type.startsWith('pineSuper'))pineSupermarketGeometry(m,o);
  else if(isWallId(o.type)){const faces=wallFaceState(o,wallLookup);wallBlock(m,o.type,o.x+.5,o.y*1.4+terrainY(o.x,o.z),o.z+.5,o.rot||0,faces.visible,faces.exterior)}
  else if(o.type==='terrainStairs')elevationStairGeometry(m,o.x,o.z,o.y*1.4+terrainY(o.x,o.z),o.rot||0);
  else if(/^fence(Wood|Stone|Iron)/.test(o.type)&&connectedFenceGeometry(m,o,fenceLookup)){} 
  else deco(m,o.type,o.x+.5,o.y*1.4+terrainY(o.x,o.z),o.z+.5,o.rot||0);
 }
 return upload(m);
}
function upload(m){const n=m.p.length/3,data=new Float32Array(n*9);for(let i=0;i<n;i++){const a=i*9,b=i*3;for(let j=0;j<3;j++){data[a+j]=m.p[b+j];data[a+3+j]=m.n[b+j];data[a+6+j]=m.c[b+j]}}const vbo=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);return{buf:vbo,count:n}}
const VERT='precision mediump float;attribute vec3 aPos;attribute vec3 aNorm;attribute vec3 aCol;uniform mat4 uMVP;varying vec3 vCol;void main(){gl_Position=uMVP*vec4(aPos,1.0);float l=.60+.40*max(dot(normalize(aNorm),normalize(vec3(-.4,1.0,.35))),0.0);vCol=aCol*l;}';
const FRAG='precision mediump float;varying vec3 vCol;void main(){gl_FragColor=vec4(pow(max(vCol,vec3(0.0)),vec3(.92)),1.0);}';
function sh(t,src){const s=gl.createShader(t);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s}
let program;try{program=gl.createProgram();gl.attachShader(program,sh(gl.VERTEX_SHADER,VERT));gl.attachShader(program,sh(gl.FRAGMENT_SHADER,FRAG));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program))}catch(e){$('canvasTip').textContent='WebGLシェーダーエラー: '+e.message;return}
gl.useProgram(program);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LESS);gl.clearColor(0,0,0,0);const loc={p:gl.getAttribLocation(program,'aPos'),n:gl.getAttribLocation(program,'aNorm'),c:gl.getAttribLocation(program,'aCol'),mvp:gl.getUniformLocation(program,'uMVP')};
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
 const height=world.reduce((top,o)=>Math.max(top,o.y),0)*1.4+Math.max(0,...terrainHeights.values())*TERRAIN_STEP;// Extra margin prevents bottom map corners from being clipped on tall mobile screens.
 return Math.max(.025,Math.min(4,9/(Math.max(horizontal,vertical)+height*.55+1.2)*.84));
}
function showEntireMap(){panX=panZ=0;zoom=zoomForFullMap();cursorDirty=true}
function parameters(){const q=layout(),halfH=9/zoom,halfW=halfH*q.aspect;const centerX=MAP_W/2+panX,centerZ=MAP_H/2+panZ,elev=.86,targetY=poiWalkActive?0:hideUpper?level*1.4:Math.min(8.5,worldMaxLevel*.7+Math.max(0,...terrainHeights.values())*TERRAIN_STEP*.5);const sceneReach=Math.hypot(MAP_W,MAP_H)+Math.max(0,worldMaxLevel)*1.4+TERRAIN_MAX*TERRAIN_STEP;const cameraDistance=Math.max(80,sceneReach*1.6+24);const eye=[centerX+cameraDistance*Math.sin(yaw)*Math.cos(elev),targetY+cameraDistance*Math.sin(elev),centerZ+cameraDistance*Math.cos(yaw)*Math.cos(elev)];return{...q,halfH,halfW,centerX,centerZ,elev,targetY,vp:mult(ortho(-halfW,halfW,-halfH,halfH,.1,cameraDistance+sceneReach*2+80),look(eye,[centerX,targetY,centerZ]))}}
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
