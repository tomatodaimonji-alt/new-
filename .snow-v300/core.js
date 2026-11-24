// BEGIN OVERLAND STREAM PLANNING
const POI_OVERLAND_ORIGINS=Object.freeze({base:[0,0],snowpass:[48,139],milda:[51,168]});
const POI_OVERLAND_CHUNK=8,POI_OVERLAND_RANGE=17,POI_OVERLAND_KEEP=18;
function poiOverlandGlobal(id,x,z){const o=POI_OVERLAND_ORIGINS[id];return o?[x+o[0],z+o[1]]:null}
function poiOverlandLocal(id,x,z){const o=POI_OVERLAND_ORIGINS[id];return o?[x-o[0],z-o[1]]:null}
function poiOverlandQueue(maps,gx,gz,radius=POI_OVERLAND_RANGE,cap=POI_OVERLAND_KEEP){
 const list=[],s=POI_OVERLAND_CHUNK,range=Math.min(24,Math.max(0,radius));
 for(const r of maps){
  const p=poiOverlandLocal(r.id,gx,gz);if(!p)continue;
  const [x,z]=p;
  for(let j=Math.max(0,Math.floor((z-range)/s));j<=Math.min(Math.floor((r.height-1)/s),Math.floor((z+range)/s));j++)
   for(let i=Math.max(0,Math.floor((x-range)/s));i<=Math.min(Math.floor((r.width-1)/s),Math.floor((x+range)/s));i++){
    const x0=i*s,z0=j*s,x1=Math.min(x0+s,r.width),z1=Math.min(z0+s,r.height);
    const d=Math.hypot(x-Math.max(x0,Math.min(x1,x)),z-Math.max(z0,Math.min(z1,z)));
    if(d<=range&&(!r.owns||r.owns(x0,z0)))list.push({id:r.id,i,j,x0,z0,x1,z1,d,key:r.id+':'+i+','+j});
   }
 }
 return list.sort((a,b)=>a.d-b.d||a.key.localeCompare(b.key)).slice(0,Math.min(POI_OVERLAND_KEEP,cap));
}
function poiOverlandIndex(world,ground=t=>/^(road|grass|earth|snow|stone)/i.test(t)){
 const floors=new Map(),bands=new Map(),s=POI_OVERLAND_CHUNK;
 for(const o of world){
  if(!o||o.y!==0)continue;
  const key=Math.floor(o.x/s)+','+Math.floor(o.z/s);
  const row=bands.get(key);
  if(row)row.push(o);else bands.set(key,[o]);
  if(ground(o.type))floors.set(o.x+','+o.z,o.type);
 }
 return {floors,bands};
}
// END OVERLAND STREAM PLANNING
