function poiFindLocalDetour(from,to,can,arrived,maxNodes=72,maxDepth=24){
 const key=(x,z)=>x+','+z,heur=(x,z)=>Math.abs(x-to.x)+Math.abs(z-to.z);
 const open=[{x:from.x,z:from.z,d:0,h:heur(from.x,from.z),prev:null}],cost=new Map([[key(from.x,from.z),0]]);
 for(let rank=0;rank<maxNodes&&open.length;rank++){
  let pick=0;
  for(let i=1;i<open.length;i++)if(open[i].d+open[i].h<open[pick].d+open[pick].h||
   open[i].d+open[i].h===open[pick].d+open[pick].h&&open[i].h<open[pick].h)pick=i;
  const p=open.splice(pick,1)[0];
  if(p.d!==cost.get(key(p.x,p.z)))continue;
  if(p.prev&&arrived(p.x,p.z)){
   const path=[];
   for(let q=p;q.prev;q=q.prev)path.push({x:q.x,z:q.z});
   return path.reverse();
  }
  if(p.d>=maxDepth)continue;
  for(const [dx,dz] of [[0,-1],[1,0],[0,1],[-1,0]]){
   const x=p.x+dx,z=p.z+dz,k=key(x,z),d=p.d+1;
   if(d>=(cost.get(k)??Infinity)||!can(x,z,p.x,p.z))continue;
   cost.set(k,d);open.push({x,z,d,h:heur(x,z),prev:p});
  }
 }
 return null;
}
function poiCompanionNavScope(a,to){
 if(facilitySite?.id!=='base'||a.y!==poiWalkLevel)return null;
 if(a.y===-1){
  const b=facilitySite.mine?.bounds,inside=(x,z)=>b&&x>=b.x1&&x<=b.x2&&z>=b.z1&&z<=b.z2;
  return inside(a.x,a.z)&&inside(to.x,to.z)?inside:null;
 }
 if(a.y!==0||!facilityCreekIndex?.parts?.size)return null;
 for(const d of facilityCreekIndex.parts.values()){
  if(Math.abs(a.x-d.x)+Math.abs(a.z-d.z)>15||Math.abs(to.x-d.x)+Math.abs(to.z-d.z)>15)continue;
  return (x,z)=>Math.abs(x-d.x)+Math.abs(z-d.z)<=15;
 }
 return null;
}
function poiCompanionNavGroundClear(a,p,to){
 const dx=to.x-p.x,dz=to.z-p.z,len=Math.hypot(dx,dz);
 if(len<=.72||typeof poiFreeAdvance!=='function')return true;
 const step=len-.70,can=(x,z,fx,fz)=>poiCompanionCell(x,z,a.y,fx,fz);
 const q=poiFreeAdvance(p.x,p.z,dx*step/len,dz*step/len,POI_COMPANION_FREE_RADIUS,can,can);
 return !q.stopped&&Math.hypot(q.x-(p.x+dx*step/len),q.z-(p.z+dz*step/len))<.08;
}
function poiCompanionBridgeLift(a){
 if(a.y!==0||facilitySite?.id!=='base'||!facilityCreekIndex?.parts?.size)return 0;
 const p=poiCompanionPosition(a),key=(x,z)=>x+','+z;
 const {parts,bridgeHeight,water}=facilityCreekIndex;
 const x=a.x,z=a.z,ground=terrainY(x,z),k=key(x,z),own=parts.get(k),h=bridgeHeight.get(k)??ground;
 for(const [dx,dz,offset] of [[1,0,p.x-x],[0,1,p.z-z]]){
  const dir=Math.sign(offset);if(!dir)continue;
  const tx=x+dx*dir,tz=z+dz*dir,k=key(tx,tz),neighbor=parts.get(k),span=own||neighbor;
  if(!span||!(span.rot%2===1?dx:dz)||!neighbor&&water.has(k))continue;
  return h+( (bridgeHeight.get(k)??terrainY(tx,tz))-h)*Math.abs(offset)-ground;
 }
 return h-ground;
}
function poiCompanionNavLeg(a,to,p,now,stop,scope,allowPlan){
 const end={x:Math.round(to.x),z:Math.round(to.z)};
 let q=a.localDetour;
 if(q&&(q.world!==world||q.y!==a.y||Math.abs(q.to.x-end.x)+Math.abs(q.to.z-end.z)>2))a.localDetour=q=null;
 if(q){
  while(q.path.length&&Math.hypot(q.path[0].x-p.x,q.path[0].z-p.z)<.075)q.path.shift();
  if(q.path.length){
   const n=q.path[0];
   if(n.x===a.x&&n.z===a.z||poiCompanionCell(n.x,n.z,a.y,a.x,a.z))return n;
  }
  a.localDetour=q=null;
 }
 if(!allowPlan||now<(a.localPlanAt||0))return null;
 a.localPlanAt=now+650;
 const path=poiFindLocalDetour(a,end,(x,z,fx,fz)=>scope(x,z)&&poiCompanionCell(x,z,a.y,fx,fz),
  (x,z)=>Math.hypot(x-to.x,z-to.z)<=stop+.25&&poiCompanionNavGroundClear(a,{x,z},to));
 if(!path?.length)return null;
 a.localDetour={world,y:a.y,to:end,path};
 return path[0];
}
function poiMineHostileDetour(o,s,patrol,to,now,allowPlan){
 if(patrol?.name!=='mine'||poiWalkLevel!==-1||!poiMonsterCrowdNormal(o))return false;
 const same=s.mineDetour?.goal?.x===to.x&&s.mineDetour.goal.z===to.z;
 if(!same)s.mineDetour=null;
 const can=(x,z,fx,fz)=>poiDungeonPatrolCanFight(o,x,z,patrol)&&poiMineEarlyMayMove(o,x,z)&&
  poiOtherworldEnemyMayFight(o,x,z)&&poiMonsterCanMove(x,z,s,fx,fz);
 if(!s.mineDetour?.path.length&&allowPlan&&now>=(s.minePlanAt||0)){
  s.minePlanAt=now+760;
  const path=poiFindLocalDetour(s,to,can,(x,z)=>Math.abs(x-to.x)+Math.abs(z-to.z)===1,50,14);
  if(path?.length)s.mineDetour={goal:{x:to.x,z:to.z},path};
 }
 const n=s.mineDetour?.path[0];
 if(!n)return false;
 if(!can(n.x,n.z,s.x,s.z)){s.mineDetour=null;return false}
 const dx=n.x-s.x,dz=n.z-s.z;
 s.mineDetour.path.shift();
 s.fromX=s.x;s.fromZ=s.z;s.x=n.x;s.z=n.z;s.moveStarted=now;
 s.facing=dx?(dx>0?3:1):(dz<0?2:0);poiMonsterMeshDirty=true;return true;
}
