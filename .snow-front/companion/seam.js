// BEGIN COMPANION SEAM WALK
// The companion's feet stay in its actual old local map until its own
// swept motion enters the shared next tile. Only rendering is projected.
let poiCompanionSeamWalk=null;
function poiCompanionSeamEdge(region,dest){
 if(!region||region===dest?.region)return null;
 const dir=[[0,-1],[1,0],[0,1],[-1,0]][dest.facing];
 const global=poiOverlandGlobal(dest.region,dest.x,dest.z);
 if(!dir||!global)return null;
 const local=poiOverlandLocal(region,...global);if(!local)return null;
 const [nx,nz]=local,x=nx-dir[0],z=nz-dir[1];
 const link=poiSnowPassLink(region,x,z,0,nx,nz);
 return link?.region===dest.region&&link.x===dest.x&&link.z===dest.z?{x,z,nx,nz}:null;
}
function poiCompanionSeamCapture(dest,now,cold){
 const a=poiCompanionActor,from=facilitySite?.id;
 if(cold||!a||a.y!==0||poiWalkLevel!==0||!poiCompanionAllowed())return null;
 const edge=poiCompanionSeamEdge(from,dest);
 if(!edge)return null;
 const old=poiCompanionSeamWalk;
 if(old?.a===a&&old.to===from&&old.source.id===dest.region)return {a,join:true};
 if(!poiCompanionSame(a,poiCompanionPlace()))return null;
 if(a.id==='orvasSoul'&&typeof poiOrvasAllyStop==='function')poiOrvasAllyStop(a,now,true);
 a.attackMotion=null;a.fightLatch=null;a.davidFocus=null;a.allyTarget=null;
 a.freeGoal=null;a.freeRoute=null;a.freeFollows=false;
 return {a,edge,to:dest.region,dest,source:{id:from,site:facilitySite,world,terrain:terrainHeights,creek:facilityCreekIndex,
  width:MAP_W,height:MAP_H,monsters:poiMonsterStates,rows:null},path:null,planAt:0,last:now};
}
function poiCompanionSeamCommit(ticket,now){
 if(!ticket||ticket.a!==poiCompanionActor)return;
 const a=ticket.a;poiCompanionTarget=null;
 if(ticket.join){
  Object.assign(a,poiCompanionPlace());
  a.freeAt=now;a.next=now;
  poiCompanionSeamWalk=null;poiCompanionMeshKey=null;
 }else{
  ticket.travel=poiCompanionPlace().travel;ticket.nextPlan=now;
  poiCompanionSeamWalk=ticket;poiCompanionMeshKey=null;
 }
}
function poiCompanionSeamOwns(src,x,z){
 if(x<0||z<0||x>=src.width||z>=src.height)return false;
 const spec=typeof POI_SNOW_FRONTAGE!=='undefined'?POI_SNOW_FRONTAGE.find(r=>r.id===src.id):null;
 return spec?spec.owns(x,z):src.id!=='base'||src.width!==128||src.height!==182||z<128||x<48||poiSnowSleeveOwn(x,z);
}
const POI_COMPANION_SEAM_SOFT=new Set(['chairWood','chairClassic','stoolRound','benchWood','flowerField',
 'bushFlower','tallGrass','lantern','rubble','bushFern','poiCanalQuay','guildStairUp','guildStairDown']);
function poiCompanionSeamTiles(src,x,z){
 if(!src.rows){
  src.rows=new Map();
  const spec=typeof poiOverlandIndexCache!=='undefined'?poiOverlandIndexCache.get(src.world):null;
  // Reuse static overland batches if the seamless renderer already warmed them.
  if(spec?.batches)src.batches=spec.batches;
  else for(const o of src.world)if(o.y===0){
   const k=o.x+','+o.z,g=src.rows.get(k);
   if(g)g.push(o);else src.rows.set(k,[o]);
  }
 }
 const k=x+','+z;
 if(src.rows.has(k))return src.rows.get(k);
 if(!src.batches)return [];
 const row=(src.batches.get(Math.floor(x/8)+','+Math.floor(z/8))??[]).filter(o=>o.y===0&&o.x===x&&o.z===z);
 src.rows.set(k,row);return row;
}
function poiCompanionSeamPass(s,x,z,fx,fz){
 const {source:src,edge}=s;
 if(x===edge.nx&&z===edge.nz){
  if(fx!==edge.x||fz!==edge.z)return false;
  if(!poiCompanionSeamEdge(src.id,s.dest))return false;
  // Current authoritative realm still owns the entry: no clipping into
  // a newly occupied tile, changed wall, or the player standing on it.
  if(poiWalkX===s.dest.x&&poiWalkZ===s.dest.z)return false;
  return poiWalkCanStep(s.dest.x,s.dest.z);
 }
 if(!poiCompanionSeamOwns(src,x,z))return false;
 const k=x+','+z,prev=fx+','+fz,tiles=poiCompanionSeamTiles(src,x,z);
 const deck=src.creek?.parts.get(k),crossing=deck??src.creek?.parts.get(prev);
 if(src.creek?.water.has(k)&&!deck||
    crossing&&((crossing.rot%2===1)?fz!==z:fx!==x))return false;
 const grade=(src.terrain.get(k)||0)-(src.terrain.get(prev)||0);
 if(grade){
  if(Math.abs(grade)!==1)return false;
  const low=grade>0?[fx,fz]:[x,z],high=grade>0?[x,z]:[fx,fz];
  const rot=staircaseRotation(...low,...high);
  if(!poiCompanionSeamTiles(src,...low).some(o=>o.type==='terrainStairs'&&o.rot===rot))return false;
 }
 const door=tiles.some(o=>poiWalkPassableDoor(o.type));
 if(tiles.some(o=>{
  if(o===deck||src.creek?.shallows.get(k)===o.type)return false;
  if(isFloor(o.type))return /^(water|lake|river|sea)$/.test(o.type);
  return !poiIsMonster(o.type)&&!poiWalkPassableDoor(o.type)&&!POI_COMPANION_SEAM_SOFT.has(o.type)&&o.type!=='terrainStairs'&&
   !(door&&(isWallId(o.type)||/(?:wall|Wall|Frame|Trim|Lintel|Facade)/.test(o.type)));
 }))return false;
 return !s.occupied?.has(k);
}
function poiCompanionSeamPlan(s,x,z,now){
 // Bounded A* toward the hero's proven connection; no ambient actor/body
 // state is ever installed globally just to query the previous map.
 const goal=s.edge,open=[],cells=new Map(),d=(x,z)=>Math.abs(x-goal.x)+Math.abs(z-goal.z);
 const push=v=>{let i=open.length;open.push(v);while(i){const p=(i-1)>>1;if(open[p].f<=v.f)break;open[i]=open[p];i=p;}open[i]=v;};
 const pop=()=>{
  const a=open[0],v=open.pop();if(!open.length)return a;
  let i=0;for(let k=1;k<open.length;k=i*2+1){if(k+1<open.length&&open[k+1].f<open[k].f)k++;
   if(open[k].f>=v.f)break;open[i]=open[k];i=k;}open[i]=v;return a;
 };
 s.occupied=new Set();
 for(const [o,v] of s.source.monsters??[])if(o.y===0&&v.hp>0)s.occupied.add(v.x+','+v.z);
 const h=d(x,z),start={x,z,g:0,h,f:h};push(start);cells.set(x+','+z,start);
 let best=start,budget=1800;
 while(open.length&&budget-->0){
  const t=pop();if(cells.get(t.x+','+t.z)!==t)continue;
  if(t.h<best.h)best=t;if(t.h===0)break;
  for(const [dx,dz] of [[1,0],[0,1],[-1,0],[0,-1]]){
   const x=t.x+dx,z=t.z+dz,k=x+','+z,g=t.g+1,h=d(x,z);
   if((cells.get(k)?.g??Infinity)<=g||!poiCompanionSeamPass(s,x,z,t.x,t.z))continue;
   const next={x,z,g,h,f:g+h+h*.0001,prev:t};cells.set(k,next);push(next);
  }
 }
 const line=[];
 for(let p=best;p?.prev;p=p.prev)line.push({x:p.x,z:p.z});
 if(best.h===0)line.unshift({x:goal.nx,z:goal.nz});
 s.path=line.reverse();s.index=0;s.nextPlan=now+550;
}
function poiCompanionSeamFrame(now,blocked=false){
 const s=poiCompanionSeamWalk,a=poiCompanionActor;
 if(!s)return false;
 if(s.a!==a||!a||facilitySite?.id!==s.to||poiCompanionPlace().travel!==s.travel||
    poiWalkLevel!==0||!poiCompanionAllowed()){
  poiCompanionSeamWalk=null;return false;
 }
 const dt=Math.max(0,Math.min(64,now-s.last));s.last=now;
 a.freeMoving=false;
 if(blocked||!dt)return true;
 const p=poiCompanionPosition(a),cx=poiFreeCell(p.x),cz=poiFreeCell(p.z);
 const hero=poiCompanionPlayerPoint(now),[hx,hz]=poiOverlandLocal(s.source.id,...poiOverlandGlobal(s.to,hero.x,hero.z));
 const gap=Math.hypot(hx-p.x,hz-p.z);
 if(!poiCompanionFollowWanted(a,gap))return true;
 if(!s.path||s.index>=s.path.length){
  if(s.path&&now<s.nextPlan)return true;
  poiCompanionSeamPlan(s,cx,cz,now);
 }
 let n=s.path[s.index];
 if(!n)return true;
 if(Math.hypot(n.x-p.x,n.z-p.z)<1e-5){
  s.index++;n=s.path[s.index];if(!n)return true;
 }
 const dx=n.x-p.x,dz=n.z-p.z,d=Math.hypot(dx,dz),step=Math.min(d,dt*poiCompanionSpeed(a),Math.max(0,gap-POI_COMPANION_FOLLOW_STOP));
 const pass=(x,z,fx,fz)=>poiCompanionSeamPass(s,x,z,fx,fz);
 const next=poiFreeAdvance(p.x,p.z,dx*step/d,dz*step/d,POI_COMPANION_FREE_RADIUS,pass,pass);
 if(next.distance<1e-6){
  // Waiting at the seam when the player is occupying its arrival tile is
  // intentional. Other terrain changes discard a stale path, never jump.
  if(n.x!==s.edge.nx||n.z!==s.edge.nz){s.path=[];s.nextPlan=now+180;}
  return true;
 }
 a.fx=a.x;a.fz=a.z;a.freeDx=next.x-p.x;a.freeDz=next.z-p.z;
 a.px=next.x;a.pz=next.z;a.x=poiFreeCell(next.x);a.z=poiFreeCell(next.z);
 a.freeMoving=true;a.freeMileage=(a.freeMileage||0)+next.distance;a.stepAt=a.freeAt=now;
 if(a.x!==s.edge.nx||a.z!==s.edge.nz)return true;
 const feet=poiOverlandLocal(s.to,...poiOverlandGlobal(s.source.id,a.px,a.pz));
 const prior=poiOverlandLocal(s.to,...poiOverlandGlobal(s.source.id,a.fx,a.fz));
 a.px=feet[0];a.pz=feet[1];a.x=poiFreeCell(a.px);a.z=poiFreeCell(a.pz);a.fx=prior[0];a.fz=prior[1];
 Object.assign(a,poiCompanionPlace());
 a.next=now;
 poiCompanionSeamWalk=null;poiCompanionMeshKey=null;
 return true;
}
function poiCompanionSeamRender(a,pose){
 const s=poiCompanionSeamWalk;
 if(s?.a!==a||facilitySite?.id!==s.to)return pose;
 const [x,z]=poiOverlandLocal(s.to,...poiOverlandGlobal(s.source.id,pose.x,pose.z));
 const k=a.x+','+a.z;
 const height=s.source.creek?.bridgeHeight.get(k)??(s.source.terrain.get(k)||0)*TERRAIN_STEP;
 return {...pose,x,z,y:pose.y+height-terrainY(a.x,a.z)};
}
function poiCompanionSeamVisible(a){
 const s=poiCompanionSeamWalk;
 if(s?.a!==a||facilitySite?.id!==s.to||!poiCompanionAllowed())return false;
 const [x,z]=poiOverlandLocal(s.to,...poiOverlandGlobal(s.source.id,a.px??a.x,a.pz??a.z));
 return Math.hypot(poiWalkX-x,poiWalkZ-z)<=15&&poiOverlandRealNeighbor(s.source.id,a.x,a.z);
}
// END COMPANION SEAM WALK
