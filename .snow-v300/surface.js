// Bounded real surface prototype; only enabled on explicit QA launch.
const POI_OVERLAND_SPIKE=new URLSearchParams(location.search).get('overland-stream')==='1';
const POI_OVERLAND_GPU_LIMIT=4*1024*1024;
let poiOverlandMeshes=new Map(),poiOverlandIndexCache=new WeakMap(),poiOverlandSnow=null,poiOverlandMilda=null,poiOverlandCommands=[],poiOverlandDrawn=[],poiOverlandDrawing=false,poiOverlandEngaged=false,poiOverlandBake=null,poiOverlandStats={builds:0,maxBakeMs:0,frames:0};
function poiOverlandScope(id,x,z,pad=0){
 const hasMilda=typeof poiMildaMap==='function';
 return id==='snowpass'&&(z<=17+pad||hasMilda&&z>=17-pad)||
  id==='milda'&&hasMilda&&z<=12+pad||
  id==='base'&&x>=45-pad&&x<=74+pad&&z>=119-pad;
}
function poiOverlandSpecFor(id,layout,mapWorld,width,height){
 if(!layout||!Array.isArray(mapWorld))return null;
 let p=poiOverlandIndexCache.get(mapWorld);
 if(!p){
  const terrain=new Map((layout.map?.terrainHeights||[]).map(o=>[o.x+','+o.z,o.h]));
  const statics=mapWorld.filter(o=>o.y>=0),roofList=statics.filter(o=>facilityIsRoofPiece(o));
  const key=o=>o.x+','+o.z+','+o.y,chunk=o=>Math.floor(o.x/8)+','+Math.floor(o.z/8);
  const signs=new Map(),batches=new Map(),roofGroups=new Map(),townCells=id==='base'?new Map():null;
  for(const o of statics){
   const k=chunk(o),row=batches.get(k)||[];
   if(SIGN_TYPES.includes(o.type)){const list=signs.get(k)||[];list.push(o);signs.set(k,list)}
   row.push(o);batches.set(k,row);
  }
  if(townCells)for(const o of mapWorld){
   const k=poiTownNpcKey(o.x,o.z,o.y),list=townCells.get(k);
   if(list)list.push(o.type);else townCells.set(k,[o.type]);
  }
  for(const group of residentialRoofComponents(roofList.filter(o=>RESIDENTIAL_ROOFS.has(o.type)))){
   const k=chunk(group[0]),row=roofGroups.get(k)||[];
   row.push(group);roofGroups.set(k,row);
  }
  const owns=id==='base'&&width===128&&height===182?(x,z)=>z<128||x<48||poiSnowSleeveOwn(x,z):null;
  p={id,width,height,owns,terrain,townCells,signs,index:poiOverlandIndex(mapWorld,isFloor),batches,roofGroups,
   roofLookup:new Map(roofList.map(o=>[key(o),o])),bridges:new Map(statics.filter(o=>BRIDGE_IDS.has(o.type)).map(o=>[o.x+','+o.z,o])),
   walls:wallExteriorLookup(statics),lights:pineFloorLightingSources(statics)};
  poiOverlandIndexCache.set(mapWorld,p);
 }
 return p;
}
function poiOverlandAreas(){
 const id=facilitySite?.id,base=poiSnowPassBase,res=[];
 const add=(id,site)=>{if(site?.map)res.push(poiOverlandSpecFor(id,site,site.map.world,site.map.width,site.map.height))};
 // Snow remains read-only and enters play through facilityLoadMap's clone.
 // Reuse its exact authored preview input across activation, rather than
 // indexing/render-preparing the same records a second time on the seam.
 if(id==='snowpass'&&facilitySite?.map)add(id,facilitySite);
 else res.push(poiOverlandSpecFor(id,facilitySite,world,MAP_W,MAP_H));
 if(id==='base'||id==='milda'){
  if(!poiOverlandSnow)poiOverlandSnow=poiSnowPassMap();
  add('snowpass',poiOverlandSnow);
 }
 if(id==='snowpass'){
  if(base)res.push(poiOverlandSpecFor('base',base.site,base.world,base.width,base.height));
  // Attach later authored regions only once, when close enough to matter,
  // and never construct them in a build where their map is not registered.
  if(poiWalkViewZ>=9&&typeof poiMildaMap==='function'){
   if(!poiOverlandMilda)poiOverlandMilda=poiMildaMap();
   add('milda',poiOverlandMilda);
  }
 }
 return res.filter(Boolean);
}
function poiOverlandClear(keep=new Set()){
 for(const [k,m] of poiOverlandMeshes)if(!keep.has(k)){gl.deleteBuffer(m.buf);poiOverlandMeshes.delete(k)}
}
function* poiOverlandChunkRows(q,region){
 const m=mesh(),{floors}=region.index,id=q.i+','+q.j;
 const height=(x,z)=>region.terrain.get(x+','+z)||0;
 const local=facilitySite?.id===region.id,offset=region.id==='base'?(local?facilitySite.townOffset:22)||0:0;
 const ambient=region.id==='base'?(x,z)=>pineEastGroundColor(x,z,floors,offset):null;
 for(let z=q.z0;z<q.z1;z++){
  for(let x=q.x0;x<q.x1;x++){
   if(region.owns&&!region.owns(x,z))continue;
   const key=x+','+z,tile=floors.get(key)|| (region.id==='snowpass'?'poiSnowGround':'grass'),t=mesh();
   const tint=ambient&&(!floors.has(key)||x-offset>=72&&Object.hasOwn(PINE_EAST_NATURE_TONES,tile))?ambient:null;
   const area=region.id==='base'&&region.height===182&&z<128?region.width*128:region.width*region.height;
   addFloorTile(t,x,z,tile,area,
    ROAD_DIAGONALS.has(tile)?roadDiagonalConnections(floors,x,z,tile):ROAD_IDS.has(tile)&&!tile.endsWith('Full')?roadConnections(floors,x,z,tile):0,tint,true);
   if(floors.has(key))shoreline(t,x,z,floors);
   pineBakeFloorLighting(t,x,z,0,region.lights.blockers,region.lights.lamps);
   shiftMesh(m,t,height(x,z)*TERRAIN_STEP);
   const h=height(x,z);
   if(h)for(const [dx,dz,face] of [[-1,0,3],[1,0,1],[0,-1,0],[0,1,2]])
    if(height(x+dx,z+dz)<h)terrainSide(m,x,z,h,height(x+dx,z+dz),face);
   yield;
  }
 }
 for(const o of region.batches.get(id)||[]){
  // This outdoor renderer never owns the authored temple's close reveal.
  // A looking-back snow player must not expose its normally hidden facade.
  if(typeof poiSacredTempleVisualMember==='function'&&poiSacredTempleVisualMember(region.layout,o))continue;
  const t=o.type,y=o.y*1.4+height(o.x,o.z)*TERRAIN_STEP;
  if(poiIsMonster(t)||RESIDENTIAL_ROOFS.has(t))continue;
  if(isFloor(t)){if(o.y>0){const q=mesh();addFloorTile(q,o.x,o.z,t,region.width*region.height);shiftMesh(m,q,y)}}
  else if(AUTO_ROOFS.has(t)){const q=mesh();connectedRoofGeometry(q,o,region.roofLookup);shiftMesh(m,q,height(o.x,o.z)*TERRAIN_STEP)}
  else if(BRIDGE_IDS.has(t))bridgeConnectedGeometry(m,o,region.bridges);
  else if(isWallId(t)){
   const sides=wallFaceState(o,region.walls);
   wallBlock(m,t,o.x+.5,y,o.z+.5,o.rot||0,sides.visible,sides.exterior);
  }
  else if(!local||!pineDrawBaseTree(m,o)&&!pineDrawEastNature(m,o))deco(m,t,o.x+.5,y,o.z+.5,o.rot||0);
  yield;
 }
 for(const group of region.roofGroups.get(id)||[]){
  if(!local||!pineGuildFantasyRoof(m,group))residentialRoofGeometry(m,group,region.roofLookup,true);
  yield;
 }
 return m;
}
function poiOverlandUpload(q,m){
 const bytes=m.p.length*12,held=[...poiOverlandMeshes.values()].reduce((n,m)=>n+m.bytes,0);
 if(!bytes||held+bytes>POI_OVERLAND_GPU_LIMIT)return false;
 const r=upload(m);r.bytes=bytes;
 let x0=Infinity,y0=Infinity,z0=Infinity,x1=-Infinity,y1=-Infinity,z1=-Infinity;
 for(let i=0;i<m.p.length;i+=3){
  const x=m.p[i],y=m.p[i+1],z=m.p[i+2];
  x0=Math.min(x0,x);y0=Math.min(y0,y);z0=Math.min(z0,z);x1=Math.max(x1,x);y1=Math.max(y1,y);z1=Math.max(z1,z);
 }
 r.bounds=[x0,y0,z0,x1,y1,z1];poiOverlandMeshes.set(q.key,r);
 poiOverlandStats.builds++;return true;
}
function poiOverlandBakeFrame(list,areas,boot=false){
 if(poiOverlandBake&&!list.some(q=>q.key===poiOverlandBake.q.key))poiOverlandBake=null;
 let work=0;
 const start=performance.now();
 while(work++<(boot?2048:100)&&(boot||performance.now()-start<3)){
  if(!poiOverlandBake){
   const q=list.find(q=>!poiOverlandMeshes.has(q.key));if(!q)break;
   poiOverlandBake={q,g:poiOverlandChunkRows(q,areas.find(a=>a.id===q.id))};
  }
  const r=poiOverlandBake.g.next();
  if(r.done){
   poiOverlandUpload(poiOverlandBake.q,r.value);poiOverlandBake=null;
   break; // A frame may submit at most one fresh GPU chunk.
  }
 }
 poiOverlandStats.maxBakeMs=Math.max(poiOverlandStats.maxBakeMs,performance.now()-start);
}
const poiOverlandPrimedMusic=new WeakMap();
function poiOverlandPrimeMusic(site){
 if(!poiAudioContext||!poiAudioEnabled||!poiAudioAllowed()||poiAudioLevels.master<=0||poiAudioLevels.bgm<=0)return;
 const x=poiWalkViewX,z=poiWalkViewZ;
 const target=site==='base'&&Math.abs(x-60)<=4&&z>=132?'snowpass':
  site==='snowpass'&&Math.abs(x-12)<=3&&z<=6?'base':null;
 if(!target)return;
 const ctx=poiAudioContext,mask=poiOverlandPrimedMusic.get(ctx)||0,bit=target==='base'?1:2;
 if(mask&bit)return;
 poiOverlandPrimedMusic.set(ctx,mask|bit);
 const go=()=>{
  const region=facilitySite?.id,currentX=poiWalkViewX,currentZ=poiWalkViewZ;
  const stillNear=region===target||region===site&&(target==='snowpass'?
   Math.abs(currentX-60)<=4&&currentZ>=132:Math.abs(currentX-12)<=3&&currentZ<=6);
  if(ctx!==poiAudioContext||!poiWalkActive||!stillNear||!poiAudioAllowed()||!poiAudioEnabled||poiAudioLevels.master<=0||poiAudioLevels.bgm<=0){
   poiOverlandPrimedMusic.set(ctx,(poiOverlandPrimedMusic.get(ctx)||0)&~bit);return;
  }
  // Decode only, with the existing caches. Scene ownership still selects
  // playback after the real crossing, never while a neighbor is drawn.
  if(target==='base'&&typeof poiMysticFieldDecode==='function')poiMysticFieldDecode(ctx);
  if(target==='snowpass'&&typeof poiSnowClip==='function')poiSnowClip(ctx,false);
 };
 if(typeof requestIdleCallback==='function')requestIdleCallback(go);
 else setTimeout(go,35);
}
function poiOverlandPreviewTick(){
 if(!POI_OVERLAND_SPIKE)return null;
 poiOverlandCommands=[];poiOverlandDrawn=[];poiOverlandDrawing=false;
 const site=facilitySite?.id;
 const registered=site==='base'||site==='snowpass'||site==='milda'&&typeof poiMildaMap==='function';
 const templeGround=site==='base'&&(poiWalkViewZ>=128&&poiWalkViewX<48||
  typeof poiSacredTempleViewAmount==='function'&&poiSacredTempleViewAmount()>0);
 const eligible=registered&&!templeGround&&poiWalkActive&&poiWalkLevel===0&&!cameraTopDown&&!pineAIActive&&facilityVisibilityOwner()===null;
 if(!eligible){
  poiOverlandSignClear();poiOverlandClear();poiOverlandBake=null;
  if(!poiWalkActive){poiOverlandEngaged=false;poiOverlandIndexCache=new WeakMap()}
  return null;
 }
 const near=poiOverlandScope(site,poiWalkViewX,poiWalkViewZ),prewarm=poiOverlandScope(site,poiWalkViewX,poiWalkViewZ,8);
 if(!prewarm){poiOverlandEngaged=false;poiOverlandClear();poiOverlandBake=null;return null}
 poiOverlandPrimeMusic(site);
 const areas=poiOverlandAreas(),g=poiOverlandGlobal(site,poiWalkViewX,poiWalkViewZ);
 const list=poiOverlandQueue(areas,...g),keep=new Set(list.map(q=>q.key));poiOverlandClear(keep);
 const boot=poiOverlandMeshes.size===0&&facilityScenes.size===0;
 poiOverlandBakeFrame(list,areas,boot);
 if(!poiOverlandEngaged){
  // An ordinary session already has a complete scene; leave it presented
  // until the surrounded local chunks have been built over multiple RAFs.
  if(!near||facilityScenes.size&&list.some(q=>q.d<=8&&!poiOverlandMeshes.has(q.key)))return null;
  poiOverlandEngaged=true;
 }
 for(const q of list){
  const m=poiOverlandMeshes.get(q.key);
  if(m)poiOverlandCommands.push({id:q.id,key:q.key,m});
 }
 if(!poiOverlandCommands.length)return null;
 // Keep each GPU object owned by exactly one world/slot. Retire the active
 // old atlas once switching to the small streamed neighborhood.
 if(facilityScenes.size||facilityRoofMeshes.length)facilityInvalidateScenes();
 poiOverlandStats.frames++;poiOverlandDrawing=true;
 return poiOverlandCommands[0]?.m??null;
}
// Only a few texture quads per active region; no duplicate town atlas.
let poiOverlandSignsWorld=null,poiOverlandSignsKey=null,poiOverlandSigns=null,poiOverlandSignInput=null;
function poiOverlandSignClear(){
 if(poiOverlandSigns){
  for(const o of poiOverlandSigns)gl.deleteBuffer(o.buf);
  if(signOverlays===poiOverlandSigns)signOverlays=[];
 }
 poiOverlandSignsKey=poiOverlandSignsWorld=poiOverlandSigns=null;
}
function poiOverlandSignOverlay(){
 if(!signProgram)return [];
 const spec=poiOverlandIndexCache.get(world)||poiOverlandIndexCache.get(facilitySite?.map?.world);
 const origin=facilitySite?.id,signs=spec?poiOverlandCommands.filter(q=>q.id===origin)
  .flatMap(q=>spec.signs.get(q.key.split(':')[1])||[]):[];
 const key=signs.map(o=>o.x+','+o.z+','+o.y+','+o.rot+','+o.type).sort().join(':');
 if(poiOverlandSignsWorld===world&&poiOverlandSignsKey===key)return poiOverlandSigns;
 poiOverlandSignClear();poiOverlandSignsWorld=world;poiOverlandSignsKey=key;
 if(!signs.length)return poiOverlandSigns=[];
 poiOverlandSignInput=signs;
 try{poiOverlandSigns=buildSignOverlay()}
 finally{poiOverlandSignInput=null}
 return poiOverlandSigns;
}
// The streamed perspective only draws nearby terrain. Leave simulation and
// collision untouched; don't rebuild models whose positions cannot be in it.
function poiOverlandActorVisible(vp,x,z,level){
 if(!poiOverlandDrawing||!vp||Math.abs(x-poiWalkViewX)<=34&&Math.abs(z-poiWalkViewZ)<=34)return true;
 const y=terrainY(x,z)+1.4*level;
 // Pad for interpolated movement, model size and movement across grades.
 return poiOverlandBoxVisible(vp,[x-1.2,y-1.4,z-1.2,x+2.2,y+4.3,z+2.2]);
}
function poiOverlandNeighborVP(vp,active,other){
 if(active===other)return vp;
 const a=POI_OVERLAND_ORIGINS[active],b=POI_OVERLAND_ORIGINS[other];
 const t=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,b[0]-a[0],0,b[1]-a[1],1]);
 return mult(vp,t);
}
function poiOverlandBoxVisible(vp,b){
 for(let a=0;a<3;a++)for(const dir of [-1,1]){
  const x=vp[3]+dir*vp[a],y=vp[7]+dir*vp[4+a],z=vp[11]+dir*vp[8+a],w=vp[15]+dir*vp[12+a];
  if(w+x*b[x>=0?3:0]+y*b[y>=0?4:1]+z*b[z>=0?5:2]<-.001)return false;
 }
 return true;
}
function poiOverlandPresent(vp){
 const all=poiOverlandCommands,active=facilitySite.id,matrices=new Map([[active,vp]]);
 for(const o of all)if(!matrices.has(o.id))matrices.set(o.id,poiOverlandNeighborVP(vp,active,o.id));
 poiOverlandCommands=all.filter(o=>poiOverlandBoxVisible(matrices.get(o.id),o.m.bounds));
 poiOverlandDrawn=poiOverlandCommands;
 try{
 for(const o of poiOverlandCommands)draw(o.m,poiOverlandNeighborVP(vp,facilitySite.id,o.id));
 }finally{poiOverlandCommands=all}
}
function poiOverlandInspect(){
 return {...poiOverlandStats,engaged:poiOverlandEngaged,active:facilitySite?.id,drawing:poiOverlandDrawing,effective:poiOverlandDrawing?poiOverlandDrawn.length:0,contact:poiAnalogContact?.id??null,captured:!!poiAnalogContact&&poiAnalogPad.hasPointerCapture(poiAnalogContact.id),last:poiOverlandDrawn.map(o=>({id:o.id,key:o.key,vertices:o.m.count})),
  bytes:[...poiOverlandMeshes.values()].reduce((n,m)=>n+m.bytes,0),oldVariants:facilityScenes.size};
}
let poiOverlandAnalogOffer=null,poiOverlandAnalogHandoff=null,poiOverlandKeepAnalog=false;
function poiOverlandRealNeighbor(id,x,z){
 return poiOverlandMeshes.has(id+':'+Math.floor(x/POI_OVERLAND_CHUNK)+','+Math.floor(z/POI_OVERLAND_CHUNK));
}
function poiOverlandAnalogSeam(x,z,fromX,fromZ){
 const dest=poiSnowPassEdge(x,z,fromX,fromZ);
 return !!dest&&(!POI_OVERLAND_SPIKE||poiOverlandRealNeighbor(dest.region,dest.x,dest.z));
}
function poiOverlandTransfer(dest,now){
 const pass=poiOverlandAnalogOffer,from=facilitySite?.id;
 if(!POI_OVERLAND_SPIKE||!pass||!poiOverlandRealNeighbor(dest.region,dest.x,dest.z))return null;
 const p=poiOverlandLocal(dest.region,...poiOverlandGlobal(from,pass.x,pass.z));
 if(poiFreeCell(p[0])!==dest.x||poiFreeCell(p[1])!==dest.z)return null;
 poiOverlandKeepAnalog=true;
 try{if(!poiSnowPassChange(dest,now))return false}
 finally{poiOverlandKeepAnalog=false}
 poiOverlandAnalogHandoff={...pass,x:p[0],z:p[1]};
 return true;
}
function poiOverlandResumeAnalog(c,old,now){
 const h=poiOverlandAnalogHandoff;poiOverlandAnalogHandoff=null;
 if(!h||h.contact!==c)return false;
 poiAnalogContact=c;c.last=now;c.failures.clear();
 poiFreePose={x:h.x,z:h.z,level:poiWalkLevel,angle:h.angle,distance:old.distance,walking:true,changed:true};
 poiWalkFromX=poiWalkViewX=h.x;poiWalkFromZ=poiWalkViewZ=h.z;
 poiWalkStarted=now-POI_WALK_MS;poiWalkNextReady=0;
 return true;
}
