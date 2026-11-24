function poiOverlandAdjacentEdge(regions,region,x,z,y,nx,nz){
 if(y!==0||![x,z,nx,nz].every(Number.isInteger)||Math.abs(nx-x)+Math.abs(nz-z)!==1)return null;
 const from=regions.find(r=>r.id===region);
 if(!from?.owns(x,z)||from.owns(nx,nz))return null;
 const tx=nx+from.ox,tz=nz+from.oz,facing=nx>x?1:nx<x?3:nz>z?2:0;
 for(const to of regions){
  if(to===from)continue;
  const x=tx-to.ox,z=tz-to.oz;
  if(to.owns(x,z))return {region:to.id,x,z,y,facing};
 }
 return null;
}
const POI_SNOW_FRONTAGE=Object.freeze([
 {id:'base',ox:0,oz:0,owns:(x,z)=>x>=0&&x<128&&z>=0&&z<182&&(z<128||x<48||poiSnowSleeveOwn(x,z))},
 {id:'snowpass',ox:48,oz:139,owns:(x,z)=>x>=0&&x<POI_SNOW_PASS.width&&z>=0&&z<POI_SNOW_PASS.height}
]);
function poiSnowPassLink(region,x,z,y,nx,nz){
 return poiOverlandAdjacentEdge(POI_SNOW_FRONTAGE,region,x,z,y,nx,nz);
}
const poiSnowEdgeFloorCache=new WeakMap();
function poiSnowEdgeTiles(source){
 let row=poiSnowEdgeFloorCache.get(source);
 if(row)return row;
 row=new Map();
 for(const o of source){
  if(o.y!==0)continue;
  const onEdge=o.z===0||o.x===0||o.z===138||o.x===47&&o.z>=139&&o.z<168;
  if(!onEdge)continue;
  const k=o.x+','+o.z;
  let group=row.get(k);if(!group)row.set(k,group=[]);group.push(o);
 }
 poiSnowEdgeFloorCache.set(source,row);return row;
}
function poiSnowEdgeWalkable(source,x,z){
 const group=poiSnowEdgeTiles(source).get(x+','+z);
 return !!group&&group.some(o=>isFloor(o.type)&&!/^(water|lake|river|sea)$/.test(o.type))&&
  !group.some(o=>!isFloor(o.type)&&o.type!=='tallGrass'&&o.type!=='flowerField'&&o.type!=='bushFern');
}
