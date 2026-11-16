function gameRebuildBlock(){
  gameBuildIslandZones();
  gameConfigureNaturalScenery();
  gameBlock.clear();gameDoors.clear();gameFloor.clear();gameRoofTiles.clear();gameRoofGroups.clear();gameRoofsByCell.clear();gameBridge.clear();gameBridgeTiles.clear();gameHarborDeck.clear();bridgeDeckLevels.clear();gameHouseCells.clear();gameIndoorByCell.clear();gameLandingMarkers.length=0;gameInteriorProps.length=0;gameInteriorRugs.length=0;gameInteriorWallDetails.length=0;gameInteriorWallDetails.length=0;gameHouseBoxes.clear();gameOccludedGroups.clear();gameSolidByLayer.clear();gameDoorByLayer.clear();gameFloorsByLayer.clear();gameStairsByLayer.clear();gameUpPortals.clear();gameDownPortals.clear();gameStairArrivalLock=null;
  const groupedRoofs=new Map();
  for(const o of [...world,...gameZoneProps]){
   if(gameNatureHiddenTrees.has(o))continue;
   if(o.y===0&&(/^(?:bridge|pineConcreteDock|pineHarborPier|pineHarborQuay)$/.test(o.type))){
    gameBridge.add(gameTileKey(o.x,o.z));
    if(/^bridge/.test(o.type))gameBridgeTiles.set(gameTileKey(o.x,o.z),o);
    if(/^pineHarbor(?:Pier|Quay)$/.test(o.type))gameHarborDeck.add(gameTileKey(o.x,o.z));
   }
   if(o.y>0&&(RESIDENTIAL_ROOFS.has(o.type)||AUTO_ROOFS.has(o.type))){
    const key=gameRoofKey(o.x,o.z,o.y);
    gameRoofTiles.set(key,o);
    const ck=gameTileKey(o.x,o.z);
    if(!gameRoofsByCell.has(ck)||gameRoofsByCell.get(ck).y>o.y)gameRoofsByCell.set(ck,o);
    const groupKey=o.type+','+o.y+','+(o.rot||0);
    if(!groupedRoofs.has(groupKey))groupedRoofs.set(groupKey,[]);
    groupedRoofs.get(groupKey).push(o);
   }
   const key=gameTileKey(o.x,o.z),t=o.type,h=o.y;
   const fetchLayer=(table)=>{if(!table.has(h))table.set(h,new Map());return table.get(h)};
   if(isFloor(t)){fetchLayer(gameFloorsByLayer).set(key,t);if(h===0)gameFloor.set(key,t);continue}
   if(/^(?:stairs|stairStraight|stairSwitchback|stairSpiral|stairDown)$/.test(t)){
    fetchLayer(gameStairsByLayer).set(key,o);continue;
   }
   // Door blocks are traversable, other wall blocks and windows are solid.
   if(/door/i.test(t)){fetchLayer(gameDoorByLayer).set(key,o);if(h===0)gameDoors.set(key,o);continue}
   const wall=/wall|window|pillar|oldTown.*(?:Plain)|roofSupport|ironGate/i.test(t);
   // Pebbles, ground plants, flowers, mushrooms, and small vegetation remain passable.
   const decorative=/^(?:rockPebble|rockSmall|rockMossy|pebbles|gravel|bush(?:$|Fern|Flower|Berry|Small)|bushFern|bushFlower|flower|grass|tallGrass|fern|moss|mushroom|crop|herb|smallFlower|fallenLeaves|rubble|plant|reed|weed|waterPlant)/i.test(t);
   const solid=/^(?:tree|rock|bush|fence|gate|barrel|crate|chest|bed|table|counter|shelf|statue|well|altar|ruin|fireplace|handcart|bench|wardrobe|displayShelf|anvil|stove|oven|waterWheel|human|monster|pine(?:Tent|Military|Command|Medical|Ration|Supply|Supplies|Generator|Watchtower|Radio|Lighthouse|ScenicPine|Barrier|CityBarrier|Harbor(?:Bollard|Lamp|Pallet|Sign)))/i;
   if(wall||(!decorative&&solid.test(t))){fetchLayer(gameSolidByLayer).set(key,o);if(h===0)gameBlock.add(key)}
  }
  // Group contiguous roofs, so only the house the player enters disappears.
  for(const [base,roofs] of groupedRoofs){
   const lookup=new Map(roofs.map(o=>[gameTileKey(o.x,o.z),o]));
   const visited=new Set();
   for(const root of roofs){
    const first=gameTileKey(root.x,root.z);if(visited.has(first))continue;
    const queue=[root],keys=[],groupId=base+':'+first;visited.add(first);
    while(queue.length){
     const o=queue.pop(),key=gameTileKey(o.x,o.z);keys.push(gameRoofKey(o.x,o.z,o.y));
     for(const [dx,dz] of [[0,-1],[1,0],[0,1],[-1,0]]){
      const nkey=gameTileKey(o.x+dx,o.z+dz),next=lookup.get(nkey);
      if(!next||visited.has(nkey)||terrainLevel(next.x,next.z)!==terrainLevel(o.x,o.z))continue;
      visited.add(nkey);queue.push(next);
     }
    }
    const points=keys.map(k=>gameRoofTiles.get(k)).filter(Boolean);
    if(points.length){
     const xs=points.map(o=>o.x),zs=points.map(o=>o.z);
     gameHouseBoxes.set(groupId,{
      minX:Math.min(...xs)-.06,maxX:Math.max(...xs)+1.06,
      minZ:Math.min(...zs)-.06,maxZ:Math.max(...zs)+1.06,
      top:Math.max(...points.map(o=>terrainY(o.x,o.z)+o.y*1.4+1.7))
     });
    }
    for(const key of keys){gameRoofGroups.set(key,groupId);gameHouseCells.set(key,groupId)}
    for(const roof of roofs)if(keys.includes(gameRoofKey(roof.x,roof.z,roof.y)))gameIndoorByCell.set(gameTileKey(roof.x,roof.z),groupId);
   }
  }
  // Towers can have battlements instead of a pitched roof. Their floorplates
  // supply an independent interior footprint for the same cutaway logic.
  const towerCells=new Map();
  for(const o of world){
   if(o.y<1||!isFloor(o.type)||gameIndoorByCell.has(gameTileKey(o.x,o.z)))continue;
   const k=gameTileKey(o.x,o.z),old=towerCells.get(k);
   if(!old||o.y>old.y)towerCells.set(k,o);
  }
  const towerVisited=new Set();
  for(const [key,root] of towerCells){
   if(towerVisited.has(key))continue;
   const component=[],queue=[root];towerVisited.add(key);
   while(queue.length){
    const o=queue.pop(),k=gameTileKey(o.x,o.z);component.push(k);
    for(const [dx,dz] of [[-1,0],[1,0],[0,-1],[0,1]]){
     const nk=gameTileKey(o.x+dx,o.z+dz),p=towerCells.get(nk);
     if(!p||towerVisited.has(nk)||p.y!==root.y||terrainLevel(p.x,p.z)!==terrainLevel(root.x,root.z))continue;
     towerVisited.add(nk);queue.push(p);
    }
   }
   if(component.length<4)continue;
   // Do not treat elevated roads and bridges as indoor towers.
   const walls=world.some(o=>component.includes(gameTileKey(o.x,o.z))&&/towerWall|towerBattlement|towerWindow/i.test(o.type));
   if(!walls)continue;
   const id='tower:'+key;
   for(const k of component)gameIndoorByCell.set(k,id);
   const coords=component.map(k=>k.split(',').map(Number));
   gameHouseBoxes.set(id,{
    minX:Math.min(...coords.map(c=>c[0]))-.04,maxX:Math.max(...coords.map(c=>c[0]))+1.04,
    minZ:Math.min(...coords.map(c=>c[1]))-.04,maxZ:Math.max(...coords.map(c=>c[1]))+1.04,
    top:Math.max(...component.map(k=>{const [x,z]=k.split(',').map(Number);return terrainY(x,z)+root.y*1.4+1.6}))
   });
  }
  gameBuildStairPortals();
  gameBuildInteriorDecor();
 }
 // Pokemon-style paired staircase tiles. A mapped up flight connects to a
 // distinct down landing on the next story, leaving no menu in the movement loop.
 // The generated down landing is not persisted into the user's world JSON.
 function gameBuildStairPortals(){
  gameUpPortals.clear();gameDownPortals.clear();gameLandingMarkers.length=0;
  const id=(h,x,z)=>h+':'+gameTileKey(x,z);
  const isUp=o=>o&&/^(?:stairs|stairStraight|stairSwitchback|stairSpiral)$/.test(o.type);
  for(const [h,stairs] of [...gameStairsByLayer.entries()]){
   const upper=h+1;
   if(upper>MAX_LEVEL)continue;
   const upperFloors=gameFloorsByLayer.get(upper);
   if(!upperFloors)continue;
   for(const lower of stairs.values()){
    if(!isUp(lower))continue;
    const x=lower.x,z=lower.z,sourceKey=gameTileKey(x,z),house=gameRoofAt(x,z);
    if(!upperFloors.has(sourceKey))continue;
    const upperObjects=gameStairsByLayer.get(upper);
    // The landing is preferably at the side of the stair rather than right
    // on the up-flight, so players can understand which way each stair goes.
    const candidates=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
    let end=null;
    for(const [dx,dz] of candidates){
     const xx=x+dx,zz=z+dz,k=gameTileKey(xx,zz);
     if(!validPos(xx,zz)||!upperFloors.has(k)||gameRoofAt(xx,zz)!==house)continue;
     if(gameSolidByLayer.get(upper)?.has(k)||gameDoorByLayer.get(upper)?.has(k))continue;
     if(upperObjects?.has(k)||gameDownPortals.has(id(upper,xx,zz)))continue;
     if(world.some(o=>o.x===xx&&o.z===zz&&o.y===upper&&!isFloor(o.type)&&!/roof/i.test(o.type)))continue;
     end={x:xx,z:zz};break;
    }
    // Tiny one-cell stairwells cannot support two separate tiles. Keep the
    // same-cell portal as a safe fallback, with arrival protection.
    if(!end)end={x,z};
    const upKey=id(h,x,z),downKey=id(upper,end.x,end.z);
    if(gameUpPortals.has(upKey)||gameDownPortals.has(downKey))continue;
    const downMarker={x:end.x,z:end.z,y:upper,type:'stairLandingDown',rot:lower.rot||0};
    gameUpPortals.set(upKey,{from:h,to:upper,source:{x,z},destination:{x:end.x,z:end.z}});
    gameDownPortals.set(downKey,{from:upper,to:h,source:{x:end.x,z:end.z},destination:{x,z}});
    if(!upperObjects?.has(gameTileKey(end.x,end.z))){
     gameLandingMarkers.push(downMarker);
     if(!gameStairsByLayer.has(upper))gameStairsByLayer.set(upper,new Map());
     gameStairsByLayer.get(upper).set(gameTileKey(end.x,end.z),downMarker);
    }
   }
  }
 }
 // Interior dressing is derived from existing roof/floor data; it is not
 // written to the map JSON, so existing autosaves and editor files survive.
 function gameBuildInteriorDecor(){
  gameInteriorProps.length=0;gameInteriorRugs.length=0;gameInteriorWallDetails.length=0;
  const occupied=new Set();
  for(const o of world)if(o.y>=0&&!isFloor(o.type)&&!/roof|wall|window|door/i.test(o.type))
   occupied.add(gameRoofKey(o.x,o.z,o.y));
  const checked=(x,z,h,id)=>gameRoofAt(x,z)===id&&
   !!gameFloorsByLayer.get(h)?.get(gameTileKey(x,z))&&
   !gameSolidByLayer.get(h)?.has(gameTileKey(x,z))&&
   !gameDoorByLayer.get(h)?.has(gameTileKey(x,z))&&
   !gameStairsByLayer.get(h)?.has(gameTileKey(x,z))&&
   !occupied.has(gameRoofKey(x,z,h));
  const reachable=(cells,blocked,origin)=>{
   const queue=[origin],seen=new Set([origin]);
   while(queue.length){
    const k=queue.pop(),[x,z]=k.split(',').map(Number);
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
     const nk=gameTileKey(x+dx,z+dz);
     if(cells.has(nk)&&!blocked.has(nk)&&!seen.has(nk)){seen.add(nk);queue.push(nk)}
    }
   }
   return seen;
  };
  for(const [id,b] of gameHouseBoxes){
   if(id.startsWith('tower:'))continue;
   const minX=Math.ceil(b.minX),maxX=Math.floor(b.maxX-1.01),
    minZ=Math.ceil(b.minZ),maxZ=Math.floor(b.maxZ-1.01);
   if(minX>maxX||minZ>maxZ)continue;
   const centerX=Math.floor((minX+maxX)/2),centerZ=Math.floor((minZ+maxZ)/2);
   const roof=gameRoofsByCell.get(gameTileKey(centerX,centerZ));
   if(!roof)continue;
   const top=Math.min(MAX_LEVEL,roof.y-1);
   const footprint=new Set();
   for(let z=minZ;z<=maxZ;z++)for(let x=minX;x<=maxX;x++)
    if(gameRoofAt(x,z)===id)footprint.add(gameTileKey(x,z));
   if(footprint.size<9)continue;
   const w=maxX-minX+1,d=maxZ-minZ+1,narrow=w<=3;
   const seed=Math.abs((minX*53+minZ*97+roof.y*7)%11);
   for(let h=0;h<=top;h++){
    const cells=new Set([...footprint].filter(k=>{const [x,z]=k.split(',').map(Number);return !!gameFloorsByLayer.get(h)?.has(k)&&!gameSolidByLayer.get(h)?.has(k)}));
    if(!cells.size)continue;
    // A rug supplies lived-in detail even when a narrow house has no spare tiles.
    const rx=Math.max(minX+1,Math.min(maxX-1,centerX)),rz=Math.max(minZ+1,Math.min(maxZ-1,centerZ+1));
    if(checked(rx,rz,h,id))gameInteriorRugs.push({x:rx,z:rz,y:h,palette:(seed+h)%4});
    // Wall shelves and tiny lanterns decorate narrow row houses without
    // occupying a walkable tile or altering the passage collision map.
    if(w>=3&&d>=4){
     const ax=Math.min(maxX-1,minX+1),az=Math.min(maxZ-1,minZ+2);
     if(checked(ax,az,h,id)){
      gameInteriorWallDetails.push({x:ax,z:az,y:h,variant:(seed+h)%3,side:0});
     }
    }
    const targets=[];
    for(const k of cells){
     const [x,z]=k.split(',').map(Number);
     if(gameStairsByLayer.get(h)?.has(k)||gameDoorByLayer.get(h)?.has(k))targets.push(k);
    }
    if(!targets.length)targets.push(gameTileKey(centerX,centerZ));
    const blocked=new Set();
    const reserved=new Set(targets);
    if(gameInteriorRugs.some(r=>r.x===rx&&r.z===rz&&r.y===h))reserved.add(gameTileKey(rx,rz));
    // Narrow rows need a complete north-south path to the entrance/stairs.
    if(narrow)for(let z=minZ;z<=maxZ;z++)reserved.add(gameTileKey(centerX,z));
    // More room variety on upper floors; avoid placing large objects in a doorway.
    const candidates=[
     [minX+1,minZ+1],[maxX-1,minZ+1],[minX+1,maxZ-1],[maxX-1,maxZ-1],
     [minX+1,centerZ],[maxX-1,centerZ],[centerX,minZ+1],[centerX,maxZ-1]
    ];
    const objects=h===0
     ?['roundTableWood','bookshelf','stoolRound','crate','stoolRound']
     :h===top
      ?['bedLuxury','wardrobe','chest','bookshelf','chairClassic']
      :['bookshelf','bed','smallFlowerVase','stoolRound','chest'];
    const limit=narrow?0:(w*d>=30?3:2);
    let count=0;
    for(let n=0;n<candidates.length&&count<limit;n++){
     const idx=(n+seed+h*3)%candidates.length,[x,z]=candidates[idx],k=gameTileKey(x,z);
     if(!checked(x,z,h,id)||reserved.has(k)||blocked.has(k))continue;
     const nextBlocked=new Set(blocked);nextBlocked.add(k);
     const seen=reachable(cells,nextBlocked,targets[0]);
     if(targets.some(t=>!seen.has(t)))continue;
     // Keep at least half the available interior navigable.
     if(seen.size<Math.max(3,Math.ceil(cells.size*.52)))continue;
     const type=objects[(count+seed+h)%objects.length];
     if(!catalog.has(type))continue;
     gameInteriorProps.push({x,z,y:h,type,rot:(seed+n)%4});
     occupied.add(gameRoofKey(x,z,h));blocked.add(k);count++;
     if(!gameSolidByLayer.has(h))gameSolidByLayer.set(h,new Map());
     gameSolidByLayer.get(h).set(k,{x,z,y:h,type});
    }
   }
  }
 }
 function gameWalkableTile(x,z,h=gameLevel){
  if(!validPos(x,z))return false;
  const key=gameTileKey(x,z),floor=gameFloorsByLayer.get(h)?.get(key);
  if(gameSolidByLayer.get(h)?.has(key))return false;
  if(h===0)return !(['water','river','sea','lake'].includes(floor||pineGroundKind(x,z))&&!gameBridge.has(key));
  // Do not allow stepping into empty air on elevated stories.
  return !!floor||!!gameStairsByLayer.get(h)?.has(key);
 }
 function gameWalkable(x,z){return gameWalkableTile(Math.floor(x),Math.floor(z))}
 function gameBridgeCanStep(x,z,nx,nz){
  if(gameLevel!==0||Math.abs(nx-x)+Math.abs(nz-z)!==1)return false;
  const a=gameTileKey(x,z),b=gameTileKey(nx,nz);
  const onA=gameBridge.has(a),onB=gameBridge.has(b);
  if(!onA&&!onB)return false;
  const dry=k=>{const [x,z]=k.split(',').map(Number);return !['river','water','sea','lake'].includes(gameFloor.get(k)||pineGroundKind(x,z))};
  if(onA&&onB){
   const left=gameBridgeTiles.get(a),right=gameBridgeTiles.get(b);
   if(left&&right)return bridgeAligned(left,right)&&Math.abs(bridgeSpanElevation(left,gameBridgeTiles)-bridgeSpanElevation(right,gameBridgeTiles))<=TERRAIN_STEP;
   if(!left&&!right)return true;
   const deck=left||right;
   return Math.abs(bridgeSpanElevation(deck,gameBridgeTiles)/TERRAIN_STEP-terrainLevel(left?nx:x,left?nz:z))<=1;
  } // Connected deck overrides the riverbed, not disconnected decks.
  if((!onA&&!dry(a))||(!onB&&!dry(b)))return false;
  const bridge=gameBridgeTiles.get(onA?a:b);
  if(bridge){
   // Only enter or exit at a bridge end (never through side railings).
   const dx=nx-x,dz=nz-z;
   if(bridgeDirection(bridge.rot)%2===0&&dx!==0||bridgeDirection(bridge.rot)%2===1&&dz!==0)return false;
   return Math.abs(bridgeSpanElevation(bridge,gameBridgeTiles)/TERRAIN_STEP-terrainLevel(onA?nx:x,onA?nz:z))<=1.05;
  }
  // Shore-to-quay steps are allowed when the quay deck matches the land.
  const pier=gameZoneProps.find(p=>p.y===0&&p.x===(onA?x:nx)&&p.z===(onA?z:nz)&&/^pineHarbor(?:Pier|Quay)$/.test(p.type));
  if(pier)return Math.abs(1-terrainLevel(onA?nx:x,onA?nz:z))<=1;
  return Math.abs(terrainLevel(nx,nz)-terrainLevel(x,z))<=1;
 }
 function gameCanStep(x,z,nx,nz){
  if(Math.abs(nx-x)+Math.abs(nz-z)!==1||!gameWalkableTile(nx,nz))return false;
  const from=gameRoofAt(x,z),to=gameRoofAt(nx,nz);
  if(from!==to&&(from||to)){
   const doors=gameDoorByLayer.get(gameLevel);
   if(!doors?.has(gameTileKey(x,z))&&!doors?.has(gameTileKey(nx,nz)))return false;
  }
  // Prevent leaving a tower from upper floors even without a blocking wall.
  if(gameLevel>0&&(!gameIndoorByCell.has(gameTileKey(nx,nz))||from!==to)&&from)return false;
  return gameLevel>0||terrainPassable(x,z,nx,nz)||gameBridgeCanStep(x,z,nx,nz);
 }
 function gameRoofAt(x,z){
  return gameIndoorByCell.get(gameTileKey(x,z))||null;
 }
 function gameShouldHideLayer(o){
  if(!gameRoofHidden||o.y<=gameLevel)return false;
  // Remove any upper-floor structure above the player's current level,
  // including battlements in roofless towers. Neighboring buildings stay intact.
  return gameRoofAt(o.x,o.z)===gameRoofHidden;
 }
 function gameUpdateRoof(){
  const next=gameRoofAt(Math.floor(gameX),Math.floor(gameZ));
  if(next!==gameRoofHidden)gameRoofHidden=next
  gameCheckOcclusion();
 }
 // Look from the avatar towards the camera along an ascending 3D ray.
 // Only buildings intersecting that sightline fade; the opposite alley facade
 // and all non-occluding houses remain fully opaque.
 function gameCheckOcclusion(){
  const next=new Set(),dx=Math.sin(yaw),dz=Math.cos(yaw),rise=Math.tan(.86);
  const px=gameX,pz=gameZ,py=terrainY(Math.floor(px),Math.floor(pz))+gameLevel*1.4+.9;
  for(const [id,b] of gameHouseBoxes){
   if(id===gameRoofHidden)continue;
   let enter=0,exit=22;
   for(const [p,d,min,max] of [[px,dx,b.minX,b.maxX],[pz,dz,b.minZ,b.maxZ]]){
    if(Math.abs(d)<.0001){if(p<min||p>max){exit=-1;break}continue}
    const t1=(min-p)/d,t2=(max-p)/d;
    enter=Math.max(enter,Math.min(t1,t2));exit=Math.min(exit,Math.max(t1,t2));
   }
   // A camera ray that passes above the roof cannot be occluded by this house.
   if(exit>Math.max(.12,enter)&&enter<12&&py+Math.max(0,enter)*rise<b.top+.18)next.add(id);
  }
  if(next.size!==gameOccludedGroups.size||[...next].some(id=>!gameOccludedGroups.has(id))){
   gameOccludedGroups.clear();for(const id of next)gameOccludedGroups.add(id);
  }
 }
 function gameRetrofitSampleStairs(){
  if(MAP_W!==64||MAP_H!==64||world.some(o=>o.type==='stairSwitchback'&&o.x===7&&o.z===41))return;
  // Only change the original built-in city: verify two landmark walls and roof sections.
  const landmark=(x,z,type)=>world.some(o=>o.x===x&&o.z===z&&o.type===type);
  if(!landmark(7,40,'roofSteep')||!landmark(10,40,'roofDormer'))return;
  const sampleHomes=[[6,40,3],[9,40,4],[12,40,3],[16,40,5],[26,40,3],[29,40,4],
   [32,40,5],[36,40,4],[39,40,3],[7,34,3],[11,34,4],[15,34,3],
   [27,34,3],[31,34,4],[36,34,3],[7,26,2],[14,26,2],[28,26,2],
   [7,18,2],[28,18,2]];
  for(const [x,z,n] of sampleHomes)for(let y=0;y<n-1;y++){
   if(!world.some(o=>o.x===x+1&&o.z===z+1&&o.y===y&&/^stair/.test(o.type)))
    world.push({x:x+1,z:z+1,y,type:'stairSwitchback',rot:0});
  }
  commit();
 }
 function gameSpawn(){
  gameRebuildBlock();gameLevel=0;gameMove=null;gameNextStep=0;let found=false;
  // Keep original island start, not the midpoint of the expanded ocean.
  if(pineWorldEnabled){gameX=55.5;gameZ=48.5;found=gameWalkableTile(55,48)&&!gameRoofAt(55,48)}
  for(let d=0;d<MAP_W+MAP_H&&!found;d++)for(let z=0;z<MAP_H&&!found;z++)for(let x=0;x<MAP_W&&!found;x++){
   if(Math.abs(x-MAP_W/2)+Math.abs(z-MAP_H/2)>d)continue;
   if(!gameWalkableTile(x,z)||gameRoofAt(x,z))continue;
   gameX=x+.5;gameZ=z+.5;found=true;
  }
  if(!found){gameX=.5;gameZ=.5}
  gameFacing=2;gameStairArrivalLock=null;gameUpdateRoof();gameSyncCamera(true);gamePersistProgress(true);
 }
 function gameSyncCamera(force=false){
  const targetX=gameX-MAP_W/2,targetZ=gameZ-MAP_H/2;
  panX+=((targetX-panX)*(force?1:.16));
  panZ+=((targetZ-panZ)*(force?1:.16));
 }
 function gameSurfaceY(x,z){
  if(pineSailing||pinePlayerTransfer)return .92;
  const tx=Math.floor(x),tz=Math.floor(z);
  if(gameLevel===0&&gameBridge.has(gameTileKey(tx,tz))){
   // Match the visual deck height, not the riverbed underneath it.
   const o=gameBridgeTiles.get(gameTileKey(tx,tz));
   if(o)return bridgeSpanElevation(o,gameBridgeTiles)+.11;
   if(gameHarborDeck.has(gameTileKey(tx,tz)))
    return Math.max(1,terrainY(tx,tz))+.19;
  }
  return terrainY(tx,tz)+gameLevel*1.4;
 }
 // WebAudio-only iron-sword sound design, synthesized locally and cached.
 // No external samples, no network, no audio files in the HTML.
 function gameEnsureAudio(){
  if(gameAudio){if(gameAudio.state==='suspended')gameAudio.resume().catch(()=>{});return gameAudio}
  const API=window.AudioContext||window.webkitAudioContext;
  if(!API)return null;
  try{
   gameAudio=new API();
   const sr=gameAudio.sampleRate,buffer=gameAudio.createBuffer(1,Math.round(sr*.8),sr);
   const data=buffer.getChannelData(0);
   // Stable broadband grain. Different offsets create small natural variation.
   let seed=42321;
   for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)|0;data[i]=(seed/2147483648)*.7}
   gameAudioNoise=buffer;
   if(gameAudio.state==='suspended')gameAudio.resume().catch(()=>{});
   return gameAudio;
  }catch(e){gameAudio=null;return null}
 }
 function gameSfxNoise(ctx,when,duration,from,to,gain,filterType='bandpass'){
  if(!gameAudioNoise)return;
  const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),env=ctx.createGain();
  source.buffer=gameAudioNoise;
  source.loop=true;source.loopStart=.013;source.loopEnd=.78;
  source.playbackRate.value=.92+Math.random()*.16;
  filter.type=filterType;filter.Q.value=filterType==='bandpass'?.65:.8;
  filter.frequency.setValueAtTime(Math.max(80,from),when);
  filter.frequency.exponentialRampToValueAtTime(Math.max(80,to),when+duration);
  env.gain.setValueAtTime(.0001,when);
  env.gain.exponentialRampToValueAtTime(Math.max(.0002,gain),when+.012);
  env.gain.exponentialRampToValueAtTime(.0001,when+duration);
  source.connect(filter);filter.connect(env);env.connect(ctx.destination);
  source.start(when,Math.random()*.6);source.stop(when+duration+.012);
 }
 function gameSfxTone(ctx,when,freq,endFreq,duration,gain,type='sine'){
  const osc=ctx.createOscillator(),env=ctx.createGain(),low=ctx.createBiquadFilter();
  osc.type=type;osc.frequency.setValueAtTime(freq,when);
  osc.frequency.exponentialRampToValueAtTime(Math.max(40,endFreq),when+duration);
  low.type='lowpass';low.frequency.value=3500;
  env.gain.setValueAtTime(.0001,when);
  env.gain.exponentialRampToValueAtTime(Math.max(.0002,gain),when+.005);
  env.gain.exponentialRampToValueAtTime(.0001,when+duration);
  osc.connect(low);low.connect(env);env.connect(ctx.destination);
  osc.start(when);osc.stop(when+duration+.01);
 }
 // Quiet living island soundscape: persistent sea surge, pine wind and a
 // faint generator hum; no music melody and no networked audio resources.
 function gameInitAmbience(){
  const ctx=gameEnsureAudio();if(!ctx||gameAmbientMix)return;
  const makeNoise=(frequency,q,gain)=>{
   const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),volume=ctx.createGain();
   source.buffer=gameAudioNoise;source.loop=true;
   filter.type='bandpass';filter.frequency.value=frequency;filter.Q.value=q;
   volume.gain.value=0;
   source.connect(filter);filter.connect(volume);volume.connect(ctx.destination);
   source.start();return volume;
  };
  const sea=makeNoise(430,.30,0),wind=makeNoise(150,.35,0);
  const generator=ctx.createOscillator(),hum=ctx.createGain();
  generator.type='sine';generator.frequency.value=52;
  hum.gain.value=0;generator.connect(hum);hum.connect(ctx.destination);generator.start();
  // Slow sub-audible modulation gives the sea a swell rather than white hiss.
  const wave=ctx.createOscillator(),waveDepth=ctx.createGain();
  wave.frequency.value=.13;waveDepth.gain.value=.008;
  wave.connect(waveDepth);waveDepth.connect(sea.gain);wave.start();
  const breeze=ctx.createOscillator(),breezeDepth=ctx.createGain();
  breeze.frequency.value=.083;breezeDepth.gain.value=.004;
  breeze.connect(breezeDepth);breezeDepth.connect(wind.gain);breeze.start();
  gameAmbientMix={ctx,sea,wind,hum,waveDepth,breezeDepth};
 }
 function gameAdjustAmbience(){
  if(!gameAmbientMix)return;
  const {ctx,sea,wind,hum,waveDepth,breezeDepth}=gameAmbientMix,t=ctx.currentTime;
  const px=Math.floor(gameX),pz=Math.floor(gameZ),
   closeToSea=[[-3,0],[3,0],[0,-3],[0,3]].some(([dx,dz])=>
    ['sea','water','lake','river'].includes(gameFloor.get(gameTileKey(px+dx,pz+dz))));
  const zone=gameZoneFor(px,pz),active=gameAmbientOn&&!document.hidden;
  const target=(v)=>active?v:0;
  waveDepth.gain.setTargetAtTime(target(closeToSea?.008:.004),t,.5);
  breezeDepth.gain.setTargetAtTime(target(.004),t,.5);
  sea.gain.setTargetAtTime(target(closeToSea?.037:.013),t,.45);
  wind.gain.setTargetAtTime(target(zone.includes('松林')?.030:.018),t,.55);
  hum.gain.setTargetAtTime(target(zone.includes('軍')?.009:.002),t,.5);
 }
 function gameFootstepSE(){
  const ctx=gameEnsureAudio();if(!ctx)return;
  if(ctx.currentTime-gameLastFootstep<.235)return;
  gameLastFootstep=ctx.currentTime;
  const t=ctx.currentTime+.003,pitch=(gameStepIndex++%2?1.16:.91);
  const surf=gameFloor.get(gameTileKey(Math.floor(gameX),Math.floor(gameZ)))||'grass';
  const wood=/wood|bridge/i.test(surf)||gameBridge.has(gameTileKey(Math.floor(gameX),Math.floor(gameZ)));
  const stone=/road|stone|brick/i.test(surf);
  const lo=wood?360:stone?690:285,hi=wood?1250:stone?1550:690;
  gameSfxNoise(ctx,t,.066,hi*pitch,lo*pitch,stone?.058:.044);
  gameSfxTone(ctx,t,stone?190:wood?140:94,stone?90:wood?80:55,.07,.024,'triangle');
 }
 function gamePlaySwordSE(variant='miss'){
  const ctx=gameEnsureAudio();if(!ctx)return;
  const t=ctx.currentTime+.005,variation=.97+Math.random()*.06;
  // Layer 1: close, soft but crisp steel whoosh with an airy tail.
  gameSfxNoise(ctx,t,.145,1700*variation,460*variation,.13);
  gameSfxNoise(ctx,t+.016,.108,4400*variation,1050*variation,.038,'highpass');
  gameSfxTone(ctx,t,185*variation,98*variation,.13,.023);
  if(variant==='miss')return;
  const strike=t+.078;
  // Layer 2: impact transient. Short enough to preserve repeated hits.
  gameSfxNoise(ctx,strike,.115,variant==='armor'?2900:2400,variant==='armor'?1000:510,variant==='armor'?.21:.17);
  gameSfxTone(ctx,strike,variant==='armor'?270:165,variant==='armor'?115:65,.105,.12,'triangle');
  if(variant==='armor'){
   // Restrained steel ring, no shrill or long cymbal tail.
   for(const [f,d,g] of [[670,.18,.032],[1030,.15,.020],[1410,.11,.010]])
    gameSfxTone(ctx,strike+.008,f*variation,f*.95,d,g,'sine');
  }else{
   // Soft secondary blade tear gives the hit a short textured finish.
   gameSfxNoise(ctx,strike+.015,.087,3500,670,.058,'bandpass');
  }
 }
 function gameStartSwordAttack(variant='miss'){
  const now=performance.now();
  if(now-gameAttackLast<240)return false;
  gameAttackLast=now;gameAttackStarted=now;gameAttackVariant=variant;
  gamePlaySwordSE(variant);
  if(gameAvatar)gl.deleteBuffer(gameAvatar.buf);
  gameAvatar=gameAvatarMesh();
  return true;
 }
 function gameAvatarMesh(){
  // Reuse exactly the editor's humanBare model instead of a clothed placeholder.
  // The base human model looks toward +Z (south); rotate the entire local mesh.
  const m=mesh(),body=mesh();
  characterHuman(body,0,0,0,false);
  const x=gameX,z=gameZ,y=gameSurfaceY(gameX,gameZ)+.03;
  const rotation=[2,3,0,1][gameFacing]??0;
  const walk=gameMove?Math.sin(gameMove.elapsed/.16*Math.PI*2)*.18:0;
  for(let i=0;i<body.p.length;i+=3){
   const lx=body.p[i],ly=body.p[i+1],lz=body.p[i+2];
   const stride=ly<.54&&Math.abs(lx)<.22?(lx<0?-walk:walk):
    ly>.45&&ly<.85&&Math.abs(lx)>.23?(lx<0?walk:-walk)*.40:0;
   const [rx,rz]=rot2(lx,lz+stride,rotation);
   m.p.push(x+rx,y+ly+(gameMove?.015*Math.abs(walk):0),z+rz);
   const [nx,nz]=rot2(body.n[i],body.n[i+2],rotation);
   m.n.push(nx,body.n[i+1],nz);
   m.c.push(body.c[i],body.c[i+1],body.c[i+2]);
  }
  // Right-hand blade swings in a readable 0.24s arc, in local character space.
  const attackT=(performance.now()-gameAttackStarted)/240;
  if(attackT>=0&&attackT<1){
   const sword=mesh();
   const phase=attackT<.22?attackT/.22*.30:(attackT-.22)/.78;
   const angle=-1.10+phase*2.35;
   const pivotX=.33,pivotZ=.19;
   const bladePart=(ox,oy,oz,w,h,d,color)=>cube(sword,ox,oy,oz,w,h,d,color);
   // Blade runs forward from the fist, with a distinct guard and bright edge.
   bladePart(0,.10,.34,.09,.065,.67,[.77,.82,.82]);
   bladePart(-.045,.115,.35,.021,.07,.66,[.94,.94,.85]);
   bladePart(0,.055,.015,.37,.075,.09,[.64,.52,.31]);
   bladePart(0,.065,-.12,.075,.085,.27,[.29,.21,.16]);
   for(let i=0;i<sword.p.length;i+=3){
    const px=sword.p[i],pz=sword.p[i+2];
    const c=Math.cos(angle),si=Math.sin(angle);
    const sx=pivotX+px*c-pz*si,sz=pivotZ+px*si+pz*c;
    const [rx,rz]=rot2(sx,sz,rotation);
    m.p.push(x+rx,y+.61+sword.p[i+1],z+rz);
    const nx=sword.n[i],nz=sword.n[i+2];
    const [nxr,nzr]=rot2(nx*c-nz*si,nx*si+nz*c,rotation);
    m.n.push(nxr,sword.n[i+1],nzr);
    m.c.push(sword.c[i],sword.c[i+1],sword.c[i+2]);
   }
  }
  // Low, small directional chevron: visible even from a top-down camera.
  const [dx,dz]=[[0,-1],[1,0],[0,1],[-1,0]][gameFacing];
  const fx=x+dx*.30,fz=z+dz*.30,sideX=-dz,sideZ=dx,ay=y+.035;
  tri(m,[fx+dx*.22,ay,fz+dz*.22],[fx-dx*.05+sideX*.13,ay,fz-dz*.05+sideZ*.13],[fx-dx*.05-sideX*.13,ay,fz-dz*.05-sideZ*.13],[.98,.80,.35]);
  return upload(m);
 }
 