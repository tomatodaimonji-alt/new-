from pathlib import Path
import sys
src,out=map(Path,sys.argv[1:3]);s=src.read_text()
def rep(a,b):
 global s
 assert s.count(a)==1,(a,s.count(a))
 s=s.replace(a,b,1)
a=s.index('function poiCompanionNavScope(');b=s.index('function poiCompanionNavGroundClear(',a)
rep(s[a:b],Path(__file__).with_name('scope.js').read_text())
rep(""" const nook=scope&&step<.001&&speed>.001&&!poiCompanionNavGroundClear(a,p,to);""",
""" const nook=scope&&step<.001&&speed>.001&&
  !(scope.followOnly?poiCompanionNearGroundClear(a,p,to,now):poiCompanionNavGroundClear(a,p,to));""")
rep(""" if(scope&&next.distance<step*.19&&!waypoint){
  waypoint=poiCompanionNavLeg(a,to,p,now,stop,scope,true);""",
""" const isBlocked=next.distance<step*.19||scope?.followOnly&&next.stopped&&
  len-Math.hypot(to.x-next.x,to.z-next.z)<step*.18;
 if(!scope?.followOnly||!isBlocked||waypoint)a.localStallAt=null;
 else a.localStallAt??=now;
 if(scope&&isBlocked&&!waypoint&&(!scope.followOnly||now-a.localStallAt>=POI_COMPANION_NAV_STALL)){
  waypoint=poiCompanionNavLeg(a,to,p,now,stop,scope,true);""")
rep(""" if(!to||typeof poiFreeAdvance!=='function')return false;""",
""" if(!to||typeof poiFreeAdvance!=='function'){a.localStallAt=null;return false}""")
rep(""" if(q&&(q.world!==world||q.y!==a.y||Math.abs(q.to.x-end.x)+Math.abs(q.to.z-end.z)>2))a.localDetour=q=null;""",
""" if(q&&(q.world!==world||q.y!==a.y||q.followOnly!==!!scope.followOnly||
   Math.abs(q.to.x-end.x)+Math.abs(q.to.z-end.z)>2))a.localDetour=q=null;""")
rep("""   if(n.x===a.x&&n.z===a.z||poiCompanionCell(n.x,n.z,a.y,a.x,a.z))return n;""",
"""   if(scope(n.x,n.z)&&(n.x===a.x&&n.z===a.z||poiCompanionCell(n.x,n.z,a.y,a.x,a.z)))return n;""")
rep(""" if(!allowPlan||now<(a.localPlanAt||0))return null;
 a.localPlanAt=now+650;""",
""" if(!allowPlan||now<(a.localPlanAt||0)||now<poiCompanionSharedNavReady)return null;
 a.localPlanAt=now+650;
 // Single search reservation across all followers, even if a future party
 // can have more than the one live companion supported today.
 poiCompanionSharedNavReady=now+190;""")
rep(""" a.localDetour={world,y:a.y,to:end,path};""",
""" a.localDetour={world,y:a.y,to:end,path,followOnly:!!scope.followOnly};""")
rep("""     typeof poiCompanionNavScope==='function'&&poiCompanionNavScope(a,player)&&
     !poiCompanionNavGroundClear(a,origin,player);""",
"""     !to&&typeof poiCompanionNavScope==='function'&&poiCompanionNavScope(a,player,true)&&
     !poiCompanionNearGroundClear(a,origin,player,now);""")
rep("function commit(){poiSnowEdgeFloorCache.delete(world);",
"""function commit(){poiSnowEdgeFloorCache.delete(world);if(typeof poiCompanionNavWorldChanged==='function')poiCompanionNavWorldChanged(world);""")
rep(" if(next.distance<step*.19&&!waypoint&&typeof poiCompanionPlan==='function'){",
 " if(next.distance<step*.19&&!waypoint&&!scope?.followOnly&&typeof poiCompanionPlan==='function'){")
rep(""" const cells=new Map(),edge=(x,z,fx,fz)=>{
  const key=[x,z,fx,fz].join(',');
  if(!cells.has(key))cells.set(key,poiCompanionCell(x,z,a.y,fx,fz));
  return cells.get(key);
 };""",
""" const cells=new Map(),edge=(x,z,fx,fz)=>{
  const strict=!!(waypoint&&scope?.followOnly),key=[x,z,fx,fz,strict].join(',');
  if(!cells.has(key))cells.set(key,(!strict||scope(x,z))&&poiCompanionCell(x,z,a.y,fx,fz));
  return cells.get(key);
 };""")
out.parent.mkdir(parents=True,exist_ok=True);out.write_text(s)
