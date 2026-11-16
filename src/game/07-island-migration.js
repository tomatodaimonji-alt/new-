function gameMigratePineIsland(){
  gameMapMigrated=false;
  if(MAP_W===96&&MAP_H===96&&world.some(o=>o.type.startsWith('bridge')&&o.x>=38&&o.x<=41&&o.z>=66&&o.z<=74)&&
     world.some(o=>o.type.startsWith('oldTown')&&o.x>=20&&o.x<=60)){
    gameMapMigrated=true;return;
  }
  const isOld=MAP_W===64&&MAP_H===64&&
   world.some(o=>o.x===23&&o.z===54&&o.type.startsWith('bridge'))&&
   world.some(o=>o.x>=6&&o.x<=43&&o.type.startsWith('oldTown'));
  if(!isOld)return;
  const delta=16,old=world,oldHeights=terrainHeights;
  MAP_W=96;MAP_H=96;gameMapMigrated=true;
  const coastal=(x,z)=>{
   const a=(x-48)/40.5,b=(z-47)/40.5;
   const n=(smoothSurfaceNoise(x*.14+9,z*.14+2)-.5)*.13;
   return a*a+b*b<1+n;
  };
  const oldGround=new Map();
  for(const o of old)if(o.y===0&&isFloor(o.type))oldGround.set((o.x+delta)+','+(o.z+delta),o.type);
  terrainHeights=new Map();
  for(const [k,h] of oldHeights){
   const [x,z]=k.split(',').map(Number);
   terrainHeights.set(terrainKey(x+delta,z+delta),h);
  }
  const next=[],water=new Set(),land=new Set();
  for(let z=0;z<96;z++)for(let x=0;x<96;x++){
   const k=x+','+z,isLand=coastal(x,z),oldFloor=oldGround.get(k);
   const edge=[[-1,0],[1,0],[0,-1],[0,1]].some(([dx,dz])=>!coastal(x+dx,z+dz));
   if(!isLand){next.push({x,z,y:0,type:'sea',rot:0});water.add(k);terrainHeights.delete(terrainKey(x,z));continue}
   land.add(k);
   const kind=oldFloor|| (edge?'grassDry':surfaceNoise(x*12+2,z*17+5)<.42?'grassPatch':'grassWild');
   next.push({x,z,y:0,type:kind,rot:0});
   if(!oldFloor)terrainHeights.set(terrainKey(x,z),1);
   // New shoreline stays above the water but is flat and walkable.
  }
  // Coastal pines lean in irregular groves around the settled heart of the island.
  const clear=(x,z)=>!(x>=12&&x<=22&&z>=42&&z<=58)&&
   !(x>=76&&x<=88&&z>=40&&z<=59)&&
   !(x>=60&&x<=84&&z>=34&&z<=83);
  for(let z=8;z<88;z+=2)for(let x=8;x<88;x+=2){
   if((x>=16&&x<=79&&z>=16&&z<=79)||!land.has(x+','+z)||!clear(x,z))continue;
   const n=surfaceNoise(x*15+21,z*11+31),grove=smoothSurfaceNoise(x*.12,z*.12);
   if(n<.17+.24*grove)next.push({x,z,y:0,type:'treePine',rot:0});
  }
  // Keep original structures and decorations on the same relative cells.
  for(const o of old){
   if(o.y===0&&isFloor(o.type))continue;
   next.push({...o,x:o.x+delta,z:o.z+delta});
  }
  // Supermarket and hotel have actual walkable interiors, roofs and stairs.
  const building=(x0,z0,w,d,n,kind)=>{
   const front=z0+d-1,door=x0+Math.floor(w/2);
   for(let h=0;h<n;h++)for(let z=z0;z<z0+d;z++)for(let x=x0;x<x0+w;x++){
    if(!land.has(x+','+z))continue;
    next.push({x,z,y:h,type:h===0?'woodfloor':kind==='hotel'?'woodfloorLight':'stone',rot:0});
    const rim=x===x0||x===x0+w-1||z===z0||z===front;
    if(rim){
     const entry=z===front&&x===door&&h===0;
     const type=entry?'plasterwallDoor':kind==='hotel'?'plasterwallWindow':'stonewallWindow';
     next.push({x,z,y:h,type,rot:entry?0:z===z0?2:x===x0?3:x===x0+w-1?1:0});
    }
    if(h===n-1)next.push({x,z,y:n,type:'roofHip',rot:0});
   }
   if(n>1)for(let h=0;h<n-1;h++)next.push({x:x0+2,z:z0+2,y:h,type:'stairSwitchback',rot:0});
  };
  building(13,45,8,9,3,'hotel');
  building(78,45,8,9,1,'market');
  // Functional interior props: hotel rooms and grocery aisles with a clear centre path.
  for(const [x,z,h,t] of [
   [16,47,0,'bed'],[18,47,0,'bed'],[15,50,1,'bed'],[18,50,1,'bed'],
   [15,47,2,'bedLuxury'],[18,47,2,'bedLuxury'],[19,51,0,'chairClassic'],
   [80,47,0,'displayShelf'],[83,47,0,'displayShelf'],
   [80,50,0,'displayShelf'],[83,50,0,'displayShelf'],
   [79,52,0,'counterWood'],[84,52,0,'crate']
  ])next.push({x,z,y:h,type:t,rot:0});
  world=next;
  const dims=[['mapWidth',96],['mapHeight',96],['rangeX2',95],['rangeZ2',95]];
  for(const [id,v] of dims){const el=$(id);if(el)el.value=v}
  for(const id of ['rangeX1','rangeX2','rangeZ1','rangeZ2']){const el=$(id);if(el)el.max=95}
  dirty=true;
 }
 // First phase of Pine Island: scenic facilities derived from the built-in
 // 64x64 settlement. Original world JSON and saved positions remain unchanged.
 