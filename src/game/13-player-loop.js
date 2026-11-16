function gameTick(){
  const now=performance.now();
  const dt=Math.min(.05,Math.max(0,(now-gameLast)/1000));gameLast=now;
  pineBoatTick(dt,now);
  if(gameMove){
   gameMove.elapsed+=dt;
   const t=Math.min(1,gameMove.elapsed/.16),smooth=t*t*(3-2*t);
   gameX=gameMove.x+(gameMove.nx-gameMove.x)*smooth;
   gameZ=gameMove.z+(gameMove.nz-gameMove.z)*smooth;
   // Switch the visible story as the avatar crosses the doorway's tile boundary,
   // not after the entire walking animation has already ended.
   if(!gameMove.roofChecked&&t>=.5){gameMove.roofChecked=true;gameUpdateRoof()}
   if(t>=1){gameX=gameMove.nx;gameZ=gameMove.nz;gameMove=null;gameUpdateRoof();if(!gameTryAutoStair())gamePersistProgress(true)}
   if(gameAvatar)gl.deleteBuffer(gameAvatar.buf);
   gameAvatar=gameAvatarMesh();
  }
  if(!pineSailing&&!gameMove&&now>=gameNextStep&&gameDirs.size){
   // Last pressed direction takes priority; no accidental diagonal movement.
   const direction=gameLastDir&&gameDirs.has(gameLastDir)?gameLastDir:[...gameDirs].at(-1);
   const [dx,dz,facing]=gameDirSteps[direction]||gameDirSteps.s;
   gameFacing=facing;
   const x=Math.floor(gameX),z=Math.floor(gameZ),nx=x+dx,nz=z+dz;
   gameNextStep=now+175;
   if(gameCanStep(x,z,nx,nz)){
    gameMove={x:x+.5,z:z+.5,nx:nx+.5,nz:nz+.5,elapsed:0};
    gameFootstepSE();
   }else{
    if(gameAvatar)gl.deleteBuffer(gameAvatar.buf);
    gameAvatar=gameAvatarMesh();
   }
  }
  // Animate the blade only during the attack instead of rebuilding static terrain.
  if(now-gameAttackStarted<270&&now>=gameAttackStarted&&!gameMove){
   if(gameAvatar)gl.deleteBuffer(gameAvatar.buf);
   gameAvatar=gameAvatarMesh();
  }
  const zone=gameZoneFor(Math.floor(gameX),Math.floor(gameZ));
  if(zone!==gameLastZone){
   gameLastZone=zone;
   if(zone)toast(zone);
  }
  if(now-gameAmbientLast>1250){gameAmbientLast=now;gameAdjustAmbience()}
  gameSyncCamera();
  const label=$('gameCoords');
  if(label)label.textContent='マス '+Math.floor(gameX)+', '+Math.floor(gameZ)+' · 高さ '+terrainLevel(Math.floor(gameX),Math.floor(gameZ))+(gameRoofHidden?' · 屋内':'')+' · '+(gameLevel===0?'1階':(gameLevel+1)+'階');
 }
 // Stair objects connect matching occupied floor cells on consecutive layers.
 function gamePortalHere(){
  const key=gameLevel+':'+gameTileKey(Math.floor(gameX),Math.floor(gameZ));
  return gameDownPortals.get(key)||gameUpPortals.get(key)||null;
 }
 function gameTryAutoStair(){
  if(gameMove)return false;
  const position=gameLevel+':'+gameTileKey(Math.floor(gameX),Math.floor(gameZ));
  if(gameStairArrivalLock===position)return false;
  gameStairArrivalLock=null;
  const portal=gameDownPortals.get(position)||gameUpPortals.get(position);
  if(!portal)return false;
  const {x,z}=portal.destination;
  if(!gameWalkableTile(x,z,portal.to))return false;
  const oldLevel=gameLevel;
  gameLevel=portal.to;
  // Prefer a normal landing tile next to the staircase, leaving the up/down
  // tiles visibly accessible and avoiding the need to step off and back on.
  let arrival={x,z};
  for(const [dx,dz] of [[0,1],[-1,0],[1,0],[0,-1],[1,1],[-1,1]]){
   const nx=x+dx,nz=z+dz,nkey=gameLevel+':'+gameTileKey(nx,nz);
   if(!gameWalkableTile(nx,nz,gameLevel)||gameRoofAt(nx,nz)!==gameRoofAt(x,z))continue;
   if(gameUpPortals.has(nkey)||gameDownPortals.has(nkey))continue;
   if(Math.abs(dx)+Math.abs(dz)>1)continue;
   arrival={x:nx,z:nz};break;
  }
  gameX=arrival.x+.5;gameZ=arrival.z+.5;
  gameStairArrivalLock=gameLevel+':'+gameTileKey(arrival.x,arrival.z);
  gameNextStep=performance.now()+210;
  gameUpdateRoof();gameSyncCamera(true);
  if(gameAvatar)gl.deleteBuffer(gameAvatar.buf);
  gameAvatar=gameAvatarMesh();
  gamePersistProgress(true);
  toast((gameLevel+1)+'階');
  return true;
 }
 function gameWorldSignature(){
  const n=world.length,last=world[n-1],first=world[0];
  return MAP_W+':'+MAP_H+':'+n+':'+(first?first.type+first.x+first.z:'')+':'+(last?last.type+last.x+last.z:'');
 }
 function gamePersistProgress(force=false){
  if(!gameSessionReady)return;
  const now=performance.now();
  if(!force&&now-gameLastSavedAt<700)return;
  gameLastSavedAt=now;
  try{
   const payload={version:1,world:gameWorldSignature(),x:Math.floor(gameX),z:Math.floor(gameZ),floor:gameLevel,facing:gameFacing,zoom,yaw,sailing:pineSailing,boatX:pineBoatX,boatZ:pineBoatZ,troopCount:pineTroopCount,troopMode:pineTroopMode};
   localStorage.setItem(GAME_PROGRESS_KEY,JSON.stringify(payload));
   const status=$('gameSaveStatus');if(status)status.textContent='自動セーブ済み';
  }catch(e){const status=$('gameSaveStatus');if(status)status.textContent='セーブ不可（保存領域を確認）'}
 }
 function gameRestoreProgress(){
  try{
   const save=JSON.parse(localStorage.getItem(GAME_PROGRESS_KEY)||'null');
   if(!save||save.version!==1)return false;
   const legacy64=gameMapMigrated&&save.world!==gameWorldSignature()&&save.world.startsWith('64:64:');
   const legacy96=pineWorldEnabled&&save.world===pineOldSignature;
   if(save.world!==gameWorldSignature()&&!legacy64&&!legacy96)return false;
   const {floor,facing}=save;
   const x=save.x+(legacy64?16:0),z=save.z+(legacy64?16:0);
   if(!Number.isInteger(x)||!Number.isInteger(z)||!Number.isInteger(floor)||floor<0||floor>MAX_LEVEL)return false;
   if(save.sailing&&pineWorldEnabled&&Number.isFinite(save.boatX)&&Number.isFinite(save.boatZ)){
    pineBoatX=Math.max(110.5,Math.min(142.5,save.boatX));pineBoatZ=Math.max(65.8,Math.min(76.5,save.boatZ));pineSailing=true;
   }else if(!gameWalkableTile(x,z,floor))return false;
   if(Number.isInteger(save.troopCount))pineTroopCount=Math.max(0,Math.min(20,save.troopCount));
   if(['ready','aboard','landed'].includes(save.troopMode))pineTroopMode=save.troopMode;
   else if(pineTroopCount===20)pineTroopMode='aboard';
   gameX=pineSailing?pineBoatX:x+.5;gameZ=pineSailing?pineBoatZ:z+.5;gameLevel=floor;gameFacing=[0,1,2,3].includes(facing)?facing:2;
   if(Number.isFinite(save.zoom))zoom=Math.max(.2,Math.min(3,save.zoom));
   if(Number.isFinite(save.yaw))yaw=save.yaw;
   gameStairArrivalLock=gameLevel+':'+gameTileKey(x,z);
   gameUpdateRoof();gameSyncCamera(true);
   return true;
  }catch(e){return false}
 }
 