function extendTownWorldDavidTemple(site){
 const world=site.map.world,index=world.length,y=0,P=(x,z)=>({x,z,y}),K=(x,z,lv=0)=>x+','+z+','+lv;
 const previous=new Set(world.map(o=>K(o.x,o.z,o.y))),height=new Set((site.map.terrainHeights||[]).map(p=>K(p.x,p.z)));
 const floor=new Map(),props=[],occupied=new Set(),footprint=[];
 const ring={x:24,z:158,radius:18},entry=128,exit=142,bounds={x1:6,x2:42,z1:124,z2:176,y};
 const name='白環の大神殿',boss={...P(ring.x,ring.z),type:'monsterStoneDavid',room:{
  minX:7,maxX:41,minZ:exit,maxZ:175,arena:{x:ring.x,z:ring.z,radius:16.95,minZ:exit-.5}
 }};
 const put=(x,z,type)=>{
  const k=K(x,z);if(previous.has(k)||height.has(k))return;
  floor.set(k,{...P(x,z),type,rot:0});
 };
 const prop=(x,z,type,rot=0,y=0)=>{
  const k=K(x,z,y);if(previous.has(k)||height.has(K(x,z)))throw Error('Deep temple prop overlap '+k);
  if(occupied.has(k))return;
  occupied.add(k);props.push({x,z,y,type,rot});
 };
 const corridor=(x,z)=>x>=23&&x<=25&&z>=entry&&z<exit;
 const shell=new Set();
 for(let z=ring.z-ring.radius;z<=bounds.z2;z++)for(let x=bounds.x1;x<=bounds.x2;x++){
  const r=Math.hypot(x-ring.x,z-ring.z);
  if(r>ring.radius+.20)continue;
  const stripe=x===24&&z<=ring.z;
  put(x,z,Math.abs(r-4.8)<.54||Math.abs(r-13.5)<.54||stripe?'roadRoyalFull':
   r<4.25?'roadCutStoneFull':r>15?'roadMossFull':'roadAncientFull');
  footprint.push(P(x,z));
  if(r>=16.95&&!corridor(x,z)){
   prop(x,z,'poiDavidWallRound');shell.add(x+','+z);
  }
 }
 // Real three-tile clear passage. Recessed stone beams continue the radial
 // shell above its opening, rather than leaving a peekable gap over the roof.
 const tunnelPath=[];
 for(let z=entry;z<exit;z++){
  tunnelPath.push(P(24,z));
  for(let x=22;x<=26;x++)put(x,z,x===24?'roadRoyalFull':'roadCutStoneFull');
  for(const x of [22,26]){
   prop(x,z,z===entry?'poiDavidGatePier':'poiDavidWallTunnel',x===22?0:2);
   shell.add(x+','+z);
  }
  for(let x=22;x<=26;x++)prop(x,z,'poiDavidTunnelRoof',0,2);
 }
 for(let x=23;x<=25;x++)prop(x,141,'poiDavidWallHeader',0,3);
 prop(ring.x,ring.z,'poiDavidSacredRoof',0,2);
 for(let z=130;z<=140;z+=2)prop(z%4===0?26:22,z,'poiDavidCandleSconce',z%4===0?2:0,1);
 for(const [x,z,rot] of [[7,158,0],[41,158,2],[10,148,1],[38,148,1],[10,168,0],[38,168,2],[24,175,3]])
  prop(x,z,'poiDavidCandleSconce',rot,1);
 for(const [x,z] of [[14,151],[34,151],[13,162],[35,162],[20,169],[28,169]])
  if(!occupied.has(K(x,z)))prop(x,z,'lantern');
 prop(boss.x,boss.z,boss.type,0);
 const approach=[120,121,122,123,124,125,126,127,128].map(z=>P(24,z));
 for(let z=124;z<entry;z++)for(let x=22;x<=26;x++)put(x,z,x===24?'roadRoyalFull':'roadCutStoneFull');
 for(const x of [21,27])prop(x,126,'poiDavidWaystone');
 world.push(...floor.values(),...props);
 const walk=new Set([boss.x+','+boss.z]),pending=[[boss.x,boss.z]];
 for(let i=0;i<pending.length;i++){
  const [cx,cz]=pending[i];
  for(const [dx,dz] of [[0,-1],[1,0],[0,1],[-1,0]]){
   const x=cx+dx,z=cz+dz,key=x+','+z;
   if(walk.has(key)||shell.has(key)||z<exit||Math.hypot(x-ring.x,z-ring.z)>ring.radius+.20)continue;
   walk.add(key);pending.push([x,z]);
  }
 }
 boss.room.arena.cells=walk;
 const cells=new Set(walk);
 for(let z=entry;z<exit;z++)for(let x=23;x<=25;x++)cells.add(x+','+z);
 const enclosure=[...cells].map(c=>{const [x,z]=c.split(',').map(Number);return P(x,z)});
 const interior={permanent:true,minX:23,maxX:25,enterZ:entry,exitZ:exit,path:tunnelPath};
 site.buildings.push({id:'davidTemple',name,...bounds,footprint,floorFootprints:{0:enclosure},permanentRoof:true});
 return {depth:1,name,difficulty:10,bounds,ring,approach,entrance:P(24,entry),
  threshold:{minX:23,maxX:25,z:entry,y},retreat:P(24,125),boss,interior,enclosure:cells,
  musicArrival:{minX:22,maxX:26,minZ:124,maxZ:exit-1,y},
  resumeSolid:props.filter(o=>o.y===0&&/^poiDavid/.test(o.type)),authored:{index,count:world.length-index}};
}
