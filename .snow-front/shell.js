// BEGIN NEIGHBOR SACRED EXTERIOR
let poiSnowExteriorShell=null,poiSnowExteriorShown=0;
function poiSnowExteriorBaseRim(x,z){
 return x>=43&&x<48.5&&z>=140&&z<171;
}
function poiSnowExteriorMember(site,o){
 return poiSacredTempleVisualMember(site,o)&&
  /^poiDavid(?:WallRound|WallWing|WallWingTall|GatePier|WallTunnel|WallHeader|TunnelRoof|SacredRoof)$/.test(o.type);
}
function poiSnowExteriorAmount(site,x,z){
 return site?.davidTemple?.depth===1?poiSacredTempleVisibleAmount(site,x,z,0,false):0;
}
function poiSnowExteriorClear(){
 if(poiSnowExteriorShell?.gpu)gl.deleteBuffer(poiSnowExteriorShell.gpu.buf);
 poiSnowExteriorShell=null;poiSnowExteriorShown=0;
}
function poiSnowExteriorRecord(m,o,h=0){
 const x=o.x+.5,z=o.z+.5,rot=o.rot||0;
 if(o.type==='poiDavidSacredRoof')poiDavidSacredRoofGeometry(m,x,z);
 else if(o.type==='poiDavidTunnelRoof'||o.type==='poiDavidWallHeader')poiDavidTunnelArt(m,o.type,x,0,z,rot);
 else deco(m,o.type,x,o.y*1.4+h*TERRAIN_STEP,z,rot);
}
function poiSnowExteriorPrime(){
 const id=facilitySite?.id,active=id==='base'||id==='snowpass',from=active?poiOverlandGlobal(id,poiWalkViewX,poiWalkViewZ):null;
 const warm=from&&from[0]>=40&&from[0]<58&&from[1]>=140&&from[1]<172;
 if(!warm||poiWalkLevel!==0||!poiWalkActive||pineAIActive||cameraTopDown){if(poiSnowExteriorShell)poiSnowExteriorClear();return}
 if(document.hidden)return;
 const saved=id==='snowpass'?poiSnowPassBase:null,site=saved?.site??facilitySite,source=saved?.world??world;
 if(site?.id!=='base'||site.davidTemple?.depth!==1)return;
 if(poiSnowExteriorShell?.source!==source){
  poiSnowExteriorClear();
  const records=source.filter(o=>poiSnowExteriorMember(site,o));
  poiSnowExteriorShell={source,site,records,index:0,mesh:mesh(),gpu:null,terrain:saved?.terrainHeights??terrainHeights,finished:false};
 }
 const q=poiSnowExteriorShell;
 if(q.finished)return;
 const cold=id==='snowpass'&&!!window.pineStartup?.loading,deadline=performance.now()+2;
 for(let n=0;q.index<q.records.length&&(cold||n<16&&performance.now()<deadline);n++){
  const o=q.records[q.index++];
  poiSnowExteriorRecord(q.mesh,o,q.terrain.get(o.x+','+o.z)||0);
 }
 if(q.index===q.records.length){
  // A single bounded allocation; do not ever substitute invented geometry.
  if(q.mesh.p.length&&q.mesh.p.length/3<=42000)q.gpu=upload(q.mesh);
  q.mesh=null;q.finished=true;
 }
}
function poiSnowExteriorReady(dest){
 if(facilitySite?.id!=='base'||dest.region!=='snowpass')return true;
 const p=poiOverlandGlobal('snowpass',dest.x,dest.z);
 return !p||poiSnowExteriorAmount(facilitySite,...p)<=.02||poiSnowExteriorShell?.source===world&&poiSnowExteriorShell.finished;
}
function poiSnowExteriorDraw(vp){
 poiSnowExteriorShown=0;
 const id=facilitySite?.id,activeRim=id==='base'&&poiOverlandDrawing&&poiSnowExteriorBaseRim(poiWalkViewX,poiWalkViewZ);
 if(id!=='snowpass'&&!activeRim||poiWalkLevel!==0||cameraTopDown||pineAIActive)return;
 const q=poiSnowExteriorShell,gpu=q?.gpu,source=id==='base'?world:poiSnowPassBase?.world;
 if(!gpu?.count||q.source!==source)return;
 const p=poiOverlandGlobal(id,poiWalkViewX,poiWalkViewZ);
 const amount=p?poiSnowExteriorAmount(q.site,...p):0;
 if(amount<=0)return;
 gl.uniform1f(loc.sacredTempleHide,1-amount);
 try{draw(gpu,poiOverlandNeighborVP(vp,id,'base'));poiSnowExteriorShown=amount}
 finally{gl.uniform1f(loc.sacredTempleHide,0)}
}
// END NEIGHBOR SACRED EXTERIOR
