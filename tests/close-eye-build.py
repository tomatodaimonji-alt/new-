from pathlib import Path
import sys
src,dst=map(Path,sys.argv[1:])
s=src.read_text()
def replace(a,b):
 global s
 if s.count(a)!=1: raise ValueError((s.count(a),a[:145]))
 s=s.replace(a,b,1)
replace('function poiOrvasBeamResolve(shot,now){','''function poiOrvasNearSlimeMount(p,dx,dz,d){
 const dist=Math.hypot(dx,dz),front=dx*d.x+dz*d.z;
 if(dist<.20||dist>1.16||front<dist*.85)return null;
 const w=poiPlayerWeaponHands(poiOrvasHeadPose(p,p.hit),0).right.wrist;
 // Carry the trophy beside the shoulder while pulling it back.
 return {side:Math.max(0,.56-w[0]),back:Math.max(0,w[2]+POI_ORVAS_EYE_AHEAD+.303-Math.max(.10,front-.42))};
}
function poiOrvasCloseLockedSlime(shot,targets,pass,now){
 if(!shot.track||shot.lockedMiss)return null;
 const o=shot.aim,d={x:shot.dx,z:shot.dz};
 const t=targets.find(t=>t.id.type==='monsterSlime'&&t.id.y===o.y&&poiAimPinContains(shot,t));
 if(!t)return null;
 const dx=t.x-o.x,dz=t.z-o.z,dist=Math.hypot(dx,dz),mount=poiOrvasNearSlimeMount(shot.profile,dx,dz,d);
 if(!mount)return null;
 const w=poiPlayerWeaponHands(poiOrvasHeadPose(shot.profile,shot.profile.hit),0).right.wrist;
 const base=poiOrvasTrophyBase([w[0]+mount.side,w[1],w[2]-mount.back]);
 const ground=poiCreekPlayerHeight(now)+o.y*1.4+.03,h=t.y+(typeof POI_COMBAT_TORSO_HEIGHT==='object'?POI_COMBAT_TORSO_HEIGHT.monsterSlime:.44);
 const rays=POI_ORVAS_EYES.map(e=>{
  const u=base[0]+e[0],v=base[2]+e[2]+.013;
  const x=o.x+u*d.z+v*d.x,z=o.z-u*d.x+v*d.z,y=o.y,from={x,z,y,h:ground+base[1]+e[1]};
  const lead=Math.hypot(x-o.x,z-o.z),enter=poiAimUnit(x-o.x,z-o.z),length=Math.hypot(t.x-x,t.z-z);
  const dir=poiAimUnit(t.x-x,t.z-z),rise=length?(h-from.h)/length:0;
  const bodyLine=poiAimUnit(dx,dz);
  const face=dir&&typeof poiOrvasWallContact==='function'?poiOrvasWallContact(x,from.h,z,dir,length,rise):null;
  const through=dir&&length>.10&&(!enter||poiAimWallLimit(o,enter,lead,pass)+POI_AIM_EPS>=lead)&&
   poiAimWallLimit(o,bodyLine,dist,pass)+POI_AIM_EPS>=dist&&
   poiAimWallLimit(from,dir,length,pass)+POI_AIM_EPS>=length&&(!face||face.at>=length-.012);
  const end=through?length:0;
  return {...from,dir,end,visualLimit:end,visualEnd:end,visualHeight:h,groundEligible:false};
 });
 return {target:t,rays,mount};
}
function poiOrvasBeamResolve(shot,now){''')
replace(' const rays=eyes.map(e=>{',''' const close=poiOrvasCloseLockedSlime(shot,targets,pass,now);
 const rays=close?.rays??eyes.map(e=>{''')
replace(' for(const t of targets){\n  if(t.id.y!==o.y||!poiDavidArea(q,{...t,y:t.id.y}))continue;',''' if(close){
  if(typeof poiAimAttack!=='undefined'&&poiAimAttack?.started===shot.started)poiAimAttack.orvasNearMount=close.mount;
  hitRay=rays.findIndex(r=>r.end>POI_AIM_EPS);
  if(hitRay>=0){
   const t=close.target;
   poiPlayerDamageTarget([t.id,t.state],Math.round(t.x),Math.round(t.z),shot.profile.damage,shot.type,now,true);
  }
 }
 for(const t of close?[]:targets){
  if(t.id.y!==o.y||!poiDavidArea(q,{...t,y:t.id.y}))continue;''')
replace(" if(typeof poiOrvasPlayerGroundImpact==='function')poiOrvasPlayerGroundImpact(o,rays,d,now,pass,poiOrvasPlayerBeam.centerEnd);",
 " if(!close&&typeof poiOrvasPlayerGroundImpact==='function')poiOrvasPlayerGroundImpact(o,rays,d,now,pass,poiOrvasPlayerBeam.centerEnd);")
replace('const x=p[0]-.5,z=p[2]-.5,dx=r.x+a.d.x*end-x,dz=r.z+a.d.z*end-z;',
 '''const ray=r.dir??a.d,x=p[0]-.5,z=p[2]-.5,dx=r.x+ray.x*end-x,dz=r.z+ray.z*end-z;''')
replace('  return poiPlayerBlockArm(rot(side*.272,.965*.90,0),rot(side*.272+x,(.965+y)*.90,z-(pose?0:side*stride*.36)),side);',
 '''  const close=side>0&&pose?.orvasNearMount;
  return poiPlayerBlockArm(rot(side*.272,.965*.90,0),rot(side*.272+x+(close?close.side:0),( .965+y)*.90,z-(pose?0:side*stride*.36)-(close?close.back:0)),side);'''.replace('( .965','(.965'))
replace(' if(aim?.track&&!aim.track.sealed&&typeof poiAimTrack===\'function\'){',''' if(weapon==='equipOrvasHead'&&pose&&aim?.track&&profile){
  let mount=aim.orvasNearMount;
  if(!mount&&ms<profile.hit&&!aim.track.lost&&aim.track.obj?.type==='monsterSlime'&&aim.track.state?.hp>0&&
    poiMonsterStates.get(aim.track.obj)===aim.track.state){
   const p=poiMonsterPose(aim.track.obj,aim.track.state,now,true),dx=p.x-x,dz=p.z-z,len=Math.hypot(dx,dz);
   if(len)mount=poiOrvasNearSlimeMount(profile,dx,dz,{x:dx/len,z:dz/len});
  }
  if(mount){
   const end=profile.hit+POI_ORVAS_BEAM_POSE_MS,lower=Math.max(0,Math.min(1,(poseMs-ms)/Math.max(1,poseMs-end)));
   const rise=Math.max(0,Math.min(1,(ms-profile.hit*.45)/(profile.hit*.55))),k=lower*rise*rise*(3-2*rise);
   pose.orvasNearMount={side:mount.side*k,back:mount.back*k};
  }
 }
 if(aim?.track&&!aim.track.sealed&&typeof poiAimTrack==='function'){''')
replace("poiOrvasPlayerBeam={rays,d,start:now,level:o.y,hitRay};","poiOrvasPlayerBeam={rays,d,start:now,level:o.y,hitRay,near:!!close};")
replace('if(age>=POI_ORVAS_BEAM_MS){','if(age>=(a.near?325:POI_ORVAS_BEAM_MS)){')
replace('const alpha=poiOrvasBeamAlpha(age);','const alpha=poiOrvasBeamAlpha(a.near?110+Math.max(0,age-72)*(POI_ORVAS_BEAM_MS-110)/(325-72):age);')
dst.write_text(s)
