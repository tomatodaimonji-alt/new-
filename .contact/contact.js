// BEGIN NEAR CONTACT WALLS
function poiSacredContactWallAmount(site,o,x,z,y){
 const t=site?.id==='base'?site.davidTemple:null,b=t?.bounds;
 if(!b||t.depth!==1||y!==0||o.y!==0||o.x<b.x1||o.x>b.x2||o.z<b.z1||o.z>b.z2||
    !/^poiDavid(?:WallRound|WallTunnel|GatePier)$/.test(o.type))return 0;
 const d=Math.hypot(o.x-x,o.z-z);
 if(d>=4.7)return 0;
 const k=Math.max(0,(d-2.25)/2.45);
 return 1-k*k*(3-2*k);
}
const poiSacredContactWallSources=new WeakMap();
let poiSacredContactWalls=null;
function poiSacredContactWallIndex(site,source){
 let index=poiSacredContactWallSources.get(source);
 if(index)return index;
 index=new Map();
 for(const o of source)if(poiSacredContactWallAmount(site,o,o.x,o.z,0))
  index.set(o.x+','+o.z,o);
 poiSacredContactWallSources.set(source,index);
 return index;
}
function poiSacredContactWallInvalidate(source){
 if(source)poiSacredContactWallSources.delete(source);
 if(poiSacredContactWalls){
  for(const q of poiSacredContactWalls.meshes.values())gl.deleteBuffer(q.buf);
  poiSacredContactWalls=null;
 }
}
function poiSacredContactWallDraw(vp){
 const site=facilitySite,t=site?.id==='base'?site.davidTemple:null,r=t?.ring;
 const x=poiWalkViewX,z=poiWalkViewZ;
 const close=r&&(Math.abs(Math.hypot(x-r.x,z-r.z)-r.radius)<5.8||
  Math.abs(x-t.entrance.x)<8&&z>=t.entrance.z-5&&z<t.interior.exitZ+1);
 const visible=poiWalkActive&&poiWalkLevel===0&&close&&!pineAIActive&&!cameraTopDown&&
  !poiSacredInteriorPlayer()?poiSacredTempleViewAmount():1;
 if(visible>=.98){if(poiSacredContactWalls)poiSacredContactWallInvalidate();return}
 if(poiSacredContactWalls?.source!==world){poiSacredContactWallInvalidate();poiSacredContactWalls={source:world,meshes:new Map()}}
 const q=poiSacredContactWalls,rows=poiSacredContactWallIndex(site,world),local=[];
 for(let iz=Math.floor(z-4.7);iz<=Math.ceil(z+4.7);iz++)for(let ix=Math.floor(x-4.7);ix<=Math.ceil(x+4.7);ix++){
  const o=rows.get(ix+','+iz);
  if(!o)continue;
  const amount=poiSacredContactWallAmount(site,o,x,z,0);
  if(amount>visible+.035)local.push({o,amount});
 }
 local.sort((a,b)=>b.amount-a.amount);local.length=Math.min(local.length,12);
 const keep=new Set(local.map(k=>k.o));
 for(const [o,gpu] of q.meshes)if(!keep.has(o)){gl.deleteBuffer(gpu.buf);q.meshes.delete(o)}
 try{
  for(const {o,amount} of local){
   let gpu=q.meshes.get(o);
   if(!gpu){
    const m=mesh();deco(m,o.type,o.x+.5,terrainY(o.x,o.z),o.z+.5,o.rot||0);
    gpu=upload(m);q.meshes.set(o,gpu);
   }
   gl.uniform1f(loc.sacredTempleHide,1-amount);draw(gpu,vp);
  }
 }finally{gl.uniform1f(loc.sacredTempleHide,0)}
}
// END NEAR CONTACT WALLS
