from pathlib import Path
import sys
src,out=map(Path,sys.argv[1:]);s=src.read_text()
def rep(a,b):
 global s
 assert s.count(a)==1,(a,s.count(a))
 s=s.replace(a,b,1)
i=s.index('function extendTownWorldDavidTemple(');j=s.index('function poiDavidTempleEnclosedAt(',i)
s=s[:i]+Path(__file__).with_name('placement.js').read_text()+s[j:]
rep(' const theta=Math.atan2(z-104.5,x-24.5),rx='," const ring=facilitySite?.davidTemple?.ring;\n const theta=Math.atan2(z-(ring?.z??158)-.5,x-(ring?.x??24)-.5),rx=")
rep('return !!d&&d.bounds.y===y&&Math.hypot(x-d.ring.x,z-d.ring.z)<=d.ring.radius+pad;',"""return !!d&&d.bounds.y===y&&(Math.hypot(x-d.ring.x,z-d.ring.z)<=d.ring.radius+pad||
  (typeof poiDavidTempleTunnelAt==='function'&&poiDavidTempleTunnelAt(site,x,z,y)));""")
rep('function poiDavidTempleRecoverPosition(p){',"""function poiDavidTempleMigrateResume(s,p){
 const d=facilitySite?.id==='base'?facilitySite.davidTemple:null;
 if(d?.depth!==1||!p||p.y!==0||s?.templeDepth===1)return p;
 const arena=p.z>=94&&Math.hypot(p.x-24,p.z-104)<=18.20;
 const corridor=p.x>=23&&p.x<=25&&p.z>=94&&p.z<=100;
 return arena||corridor?{...p,x:d.retreat.x,z:d.retreat.z,y:d.retreat.y??0}:p;
}
function poiDavidTempleRecoverPosition(p){""")
rep("  ...(typeof poiSnowPassDecode==='function'?poiSnowPassDecode(d,position):{}),","""  ...(typeof poiSnowPassDecode==='function'?poiSnowPassDecode(d,position):{}),
  ...(d.route==='facility'&&d.id==='base'&&d.templeDepth===1?{templeDepth:1}:{}),""")
rep("  tag:route==='editor'||route==='map-play'?workshopResumeTag:null,","""  ...(facilitySite?.id==='base'&&facilitySite.davidTemple?.depth===1?{templeDepth:1}:{}),
  tag:route==='editor'||route==='map-play'?workshopResumeTag:null,""")
rep("   workshopResumeRestorePosition(snow?s.position:facilitySite.id==='base'?workshopResumeTownPosition(s,offset):s.position);","""   const next=snow?s.position:facilitySite.id==='base'?workshopResumeTownPosition(s,offset):s.position;
   workshopResumeRestorePosition(typeof poiDavidTempleMigrateResume==='function'?poiDavidTempleMigrateResume(s,next):next);""")
rep(" return facilityRoofMeshes.flatMap(({count},i)=>count&&(i!==hidden||facilitySite.buildings[i]?.permanentRoof)?[i]:[]);",""" return facilityRoofMeshes.flatMap(({count},i)=>{
  const b=facilitySite.buildings[i],d=facilitySite.davidTemple;
  // Close approach is naturally revealed through the forest. Avoid sending
  // the broad dome to the far view from the town edge (full plan still intact).
  if(b?.id==='davidTemple'&&d?.depth===1&&!cameraTopDown&&
     Math.min(Math.hypot(poiWalkViewX-d.entrance.x,poiWalkViewZ-d.entrance.z),
      Math.hypot(poiWalkViewX-d.ring.x,poiWalkViewZ-d.ring.z))>49)return [];
  return count&&(i!==hidden||b?.permanentRoof)?[i]:[];
 });""")
rep("['davidTemple.david','monsterStoneDavid',24,104]", "['davidTemple.david','monsterStoneDavid',24,158]")
# Only the stable authored reward IDs move. Authoritative old ground
# coordinates are accepted and normalized by the existing decode.
if 'const POI_ORVAS_REWARDS=' in s:
 for a,b in [('x:24,z:103,y:0,bit:1','x:24,z:157,y:0,bit:1'),('x:25,z:104,y:0,bit:2','x:25,z:158,y:0,bit:2'),('x:23,z:104,y:0,bit:4','x:23,z:158,y:0,bit:4')]:rep(a,b)
 rep(' d&&d.type===drop.type&&d.x===drop.x&&d.z===drop.z&&d.y===drop.y?d:null;', ' d&&d.type===drop.type&&d.x===drop.x&&(d.z===drop.z||d.z-54===drop.z)&&d.y===drop.y?d:null;')
rep('function poiInventoryReadDrops(raw){',"""function poiDavidDepthGroundPoint(p){
 // Only the base/snow shared kit can create ordinary ground stacks. The
 // extension is a narrow base surface lobe, never an editor or snow region.
 return !!p&&p.region!=='snowpass'&&p.y===0&&p.x>=0&&p.x<48&&p.z>=128&&p.z<182;
}
function poiInventoryReadDrops(raw){""")
rep("||d.z<0||d.z>=MAX_MAP||d.y< -1||d.y>9", "||d.z<0||(d.z>=MAX_MAP&&(typeof poiDavidDepthGroundPoint!=='function'||!poiDavidDepthGroundPoint(d)))||d.y< -1||d.y>9")
rep("||p.z<0||p.z>=MAX_MAP||p.y< -1||p.y>9||p.amount<1", "||p.z<0||(p.z>=MAX_MAP&&(typeof poiDavidDepthGroundPoint!=='function'||!poiDavidDepthGroundPoint(p)))||p.y< -1||p.y>9||p.amount<1")
out.parent.mkdir(parents=True,exist_ok=True);out.write_text(s)
