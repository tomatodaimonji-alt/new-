from pathlib import Path
import sys
src,dst=map(Path,sys.argv[1:3]);s=src.read_text()
def rep(a,b):
 global s
 assert s.count(a)==1,(a,s.count(a))
 s=s.replace(a,b,1)
rep('function poiCompanionDirection(from,to){', Path(__file__).with_name('route.js').read_text()+'\nfunction poiCompanionDirection(from,to){')
rep(""" const dx=to.x-p.x,dz=to.z-p.z,len=Math.hypot(dx,dz);
 const step=Math.min(Math.max(0,len-stop),dt*poiCompanionSpeed(a));
 if(step<.001||!len)return false;""",
""" let dx=to.x-p.x,dz=to.z-p.z,len=Math.hypot(dx,dz);
 const speed=dt*poiCompanionSpeed(a);
 let step=Math.min(Math.max(0,len-stop),speed);
 const scope=typeof poiCompanionNavScope==='function'?poiCompanionNavScope(a,to):null;
 const nook=scope&&step<.001&&speed>.001&&!poiCompanionNavGroundClear(a,p,to);
 let waypoint=scope&&(a.localDetour||nook)?poiCompanionNavLeg(a,to,p,now,stop,scope,nook):null;
 if(!scope)a.localDetour=null;
 if(waypoint){dx=waypoint.x-p.x;dz=waypoint.z-p.z;len=Math.hypot(dx,dz);step=Math.min(len,speed)}
 if(step<.001||!len)return false;""")
rep(""" if(next.distance<step*.19&&typeof poiCompanionPlan==='function'){""",
""" if(scope&&next.distance<step*.19&&!waypoint){
  waypoint=poiCompanionNavLeg(a,to,p,now,stop,scope,true);
  if(waypoint){
   const rx=waypoint.x-p.x,rz=waypoint.z-p.z,leg=Math.hypot(rx,rz);
   if(leg>.001){
    const t=Math.min(1,speed/leg),d=solve(rx*t,rz*t);
    if(!clip(d)&&d.distance>next.distance)next=d;
   }
  }
 }
 if(next.distance<step*.19&&!waypoint&&typeof poiCompanionPlan==='function'){""")
rep("""  if(!slides.length)return false;
  next=slides.sort((a,b)=>b.distance-a.distance)[0];""",
"""  if(!slides.length){if(!scope)return false;next=solve(0,0)}
  else next=slides.sort((a,b)=>b.distance-a.distance)[0];""")
rep("    const follow=poiCompanionFollowWanted(a,distance);",
"""    const blockedNear=distance>1.1&&distance<POI_COMPANION_FOLLOW_BEGIN&&
     typeof poiCompanionNavScope==='function'&&poiCompanionNavScope(a,player)&&
     !poiCompanionNavGroundClear(a,origin,player);
    const follow=poiCompanionFollowWanted(a,distance)||blockedNear||!!a.localDetour;""")
rep("  const pose=poiCompanionOrvasPose(a,now,facing);",
"""  const pose=poiCompanionOrvasPose(a,now,facing);
  if(typeof poiCompanionBridgeLift==='function')pose.y+=poiCompanionBridgeLift(a);""")
rep(" const pose={...art,facing};",
""" const pose={...art,facing};
 if(typeof poiCompanionBridgeLift==='function')pose.y+=poiCompanionBridgeLift(a);""")
# Prioritize a complete B1 detour over returning to a misleading greedy wall.
rep(""" if(s.actorFree&&poiMonsterActorSettle(o,s,now))return true;
 for(const [dx,dz] of poiCompanionDirection(s,goal)){""",
""" if(s.actorFree&&poiMonsterActorSettle(o,s,now))return true;
 if(s.mineDetour&&poiMineHostileDetour(o,s,patrol,goal,now,false))return true;
 for(const [dx,dz] of poiCompanionDirection(s,goal)){""")
rep(""" }
 return false;
}
// BEGIN COMPANION DAVID""",""" }
 return typeof poiMineHostileDetour==='function'&&poiMineHostileDetour(o,s,patrol,goal,now,true);
}
// BEGIN COMPANION DAVID""")
rep(""" if(typeof poiMonsterChaseFree==='function'&&poiMonsterChaseFree(obj,state,now,patrol,armed)){changed=true;continue}""",
""" if(state.mineDetour&&typeof poiMineHostileDetour==='function'&&poiMineHostileDetour(obj,state,patrol,{x:poiWalkX,z:poiWalkZ},now,false)){changed=true;continue}
 if(typeof poiMonsterChaseFree==='function'&&poiMonsterChaseFree(obj,state,now,patrol,armed)){changed=true;continue}""")
rep(""" if(state.moveStarted!==now&&typeof poiMonsterCrowdNormal==='function'&&poiMonsterCrowdNormal(obj)){""",
""" if(state.moveStarted!==now&&typeof poiMineHostileDetour==='function'&&poiMineHostileDetour(obj,state,patrol,{x:poiWalkX,z:poiWalkZ},now,true))changed=true;
 if(state.moveStarted!==now&&typeof poiMonsterCrowdNormal==='function'&&poiMonsterCrowdNormal(obj)){""")
dst.parent.mkdir(parents=True,exist_ok=True);dst.write_text(s)
