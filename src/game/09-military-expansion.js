function pineAddBaseExpansion(props,paths){
  // Preserve authored farmland, old housing, roads, foliage and existing refugee structures.
  const floor=new Map(world.filter(o=>o.y===0&&isFloor(o.type)).map(o=>[gameTileKey(o.x,o.z),o.type]));
  const authored=new Set(world.filter(o=>!isFloor(o.type)).map(o=>gameTileKey(o.x,o.z)));
  const occupied=new Set(props.filter(o=>!isFloor(o.type)&&!/^bridge/.test(o.type)).map(o=>gameTileKey(o.x,o.z)));
  const occupiedByExpansion=new Set();
  const protectedCells=new Set(paths.map(o=>gameTileKey(o.x,o.z)));
  const protectedGround=t=>!t||/^(?:sea|river|lake|water|earth)$/i.test(t)||/^road|^bridge/i.test(t)||
   /farm|field|crop|soil|tilled|plant|wheat|potato|carrot|vegetable|orchard|garden/i.test(t);
  const key=(x,z)=>gameTileKey(x,z);
  const free=(x,z)=>validPos(x,z)&&!protectedGround(floor.get(key(x,z)))&&
   !authored.has(key(x,z))&&!occupied.has(key(x,z))&&
   !occupiedByExpansion.has(key(x,z))&&!protectedCells.has(key(x,z));
  const add=(x,z,type,y=0,rot=0)=>props.push({x,z,y,type,rot});
  const reserve=(x,z)=>occupiedByExpansion.add(key(x,z));
  function building(name,w,d,nearX,nearZ){
   const sites=[];
   for(let z=56;z<=81-d;z++)for(let x=60;x<=85-w;x++)
    sites.push({x,z,dist:Math.abs(x-nearX)+Math.abs(z-nearZ)});
   sites.sort((a,b)=>a.dist-b.dist||a.z-b.z||a.x-b.x);
   for(const {x,z} of sites){
    const h=terrainLevel(x,z);let ok=true;
    // One-cell apron outside the walls guarantees a usable entrance and protects roads.
    for(let dz=-1;dz<=d;dz++)for(let dx=-1;dx<=w;dx++){
     const xx=x+dx,zz=z+dz;
     if(!free(xx,zz)||(dx>=0&&dx<w&&dz>=0&&dz<d&&terrainLevel(xx,zz)!==h)){ok=false;break}
    }
    if(!ok)continue;
    const door=x+Math.floor(w/2);
    for(let dz=0;dz<d;dz++)for(let dx=0;dx<w;dx++){
     const xx=x+dx,zz=z+dz;
     reserve(xx,zz);
     add(xx,zz,'pineRoomFloor');
     if(dx===0||dz===0||dx===w-1||dz===d-1){
      const entrance=xx===door&&dz===d-1;
      add(xx,zz,entrance?'plasterwallDoor':
       (dx>0&&dx<w-1&&dz===0)?'plasterwallWindow':'plasterwall',0,
       dz===d-1?0:dz===0?2:dx===0?3:1);
     }
     add(xx,zz,'roofHip',1);
    }
    // Keep the door's exterior apron accessible. Sign is placed to one side.
    const signX=door+1;
    if(free(signX,z+d))add(signX,z+d,'pineRoomSign:'+name);
    if(name==='作戦会議室')add(x+2,z+2,'table');
    return true;
   }
   return false;
  }
  // Military quarters only on free cells. Never clear tents to make them fit.
  building('軍司令部',6,5,64,62);
  building('作戦会議室',5,5,77,62);
  building('兵舎',6,5,65,72);
  building('物資倉庫',5,5,79,74);
  // The military pier is built by pineAddHarbors, preserving shore objects.
  // A compact pad is allowed ONLY on intact, flat and unused ground near the base.
  const sites=[];
  for(let z=20;z<=36;z++)for(let x=68;x<=83;x++)
   sites.push({x,z,d:Math.abs(x-75)+Math.abs(z-30)});
  sites.sort((a,b)=>a.d-b.d||a.z-b.z||a.x-b.x);
  for(const {x,z} of sites){
   let clear=true;const h=terrainLevel(x,z);
   for(let dz=0;dz<5;dz++)for(let dx=0;dx<5;dx++){
    const xx=x+dx,zz=z+dz;
    if(!free(xx,zz)||terrainLevel(xx,zz)!==h)clear=false;
   }
   if(!clear)continue;
   for(let dz=0;dz<5;dz++)for(let dx=0;dx<5;dx++){
    add(x+dx,z+dz,'pineHelipad');reserve(x+dx,z+dz);
   }
   add(x+2,z+2,'pineHelicopter');break;
  }
  // Ship and cranes are non-interactive scenery until real vehicle movement exists.
  add(85,89,'pineTransportShip');
  add(82,82,'pineDockCrane');
 }

 // A single shared coordinate space: old island x=0..95, strait x=96..155,
 // and a much larger procedurally laid-out mainland x>=156. No map swap.
 const PINE_CHUNK=16;
 function pineMainlandLand(x,z){
  return x>=156&&z>=9&&z<151&&x>=157+Math.max(0,Math.floor((surfaceNoise(z*.19+3,11)-.45)*5));
 }
 function pineGroundKind(x,z){
  if(pineWorldEnabled&&(x>=96||z>=96))
   return pineMainlandLand(x,z)?(x%15<3||z%15<3?'roadStoneFull':'stone'):'sea';
  return 'grass';
 }
 