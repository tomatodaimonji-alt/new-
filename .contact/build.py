from pathlib import Path
import sys
root=Path(__file__).parent
src,out=map(Path,sys.argv[1:])
s=src.read_text()
def rep(a,b):
 global s
 assert s.count(a)==1,(a,s.count(a))
 s=s.replace(a,b,1)
a=s.index('function poiSacredTunnelSight(')
b=s.index('function poiSacredInteriorPlayer(',a)
rep(s[a:b],"""function poiSacredTunnelPresentation(site,x,z,y){
 const t=site?.id==='base'?site.davidTemple:null,i=t?.interior;
 // Admission is stable at the same feet. The actual opaque tunnel faces
 // and depth buffer decide which portions are visible through the opening.
 if(!i||t.depth!==1||y!==0||z<t.entrance.z-4.45||z>i.exitZ)return false;
 // The real square of stone in front is five tiles wide; once behind
 // the threshold only the walkable three-tile tunnel keeps this access.
 const pad=z<t.entrance.z-.45?1.45:.45;
 return x>=i.minX-pad&&x<=i.maxX+pad;
}
""")
rep(""" const sacredPeek=typeof poiSacredTunnelSight==='function'&&poiWalkActive&&!pineAIActive&&!cameraTopDown&&
  poiSacredTunnelSight(facilitySite,p.eye,poiWalkViewX,poiWalkViewZ,poiWalkLevel);""",
""" const sacredPeek=typeof poiSacredTunnelPresentation==='function'&&poiWalkActive&&!pineAIActive&&
  poiSacredTunnelPresentation(facilitySite,poiWalkViewX,poiWalkViewZ,poiWalkLevel);""")
rep(" if(poiDavidTempleEnclosedAt(site,x,z,y))return 1;",
""" if(poiDavidTempleEnclosedAt(site,x,z,y)||poiSacredTunnelPresentation(site,x,z,y))return 1;""")
rep(" if(typeof poiSacredInteriorDraw==='function')poiSacredInteriorDraw(p.vp,sacredPeek);",
""" if(typeof poiSacredContactWallDraw==='function')poiSacredContactWallDraw(p.vp);
 if(typeof poiSacredInteriorDraw==='function')poiSacredInteriorDraw(p.vp,sacredPeek);""")
rep('function poiSacredTempleVisibleAmount(site,x,z,y,inspect){',
 (root/'contact.js').read_text()+'\nfunction poiSacredTempleVisibleAmount(site,x,z,y,inspect){')
rep("function commit(){poiSnowEdgeFloorCache.delete(world);",
"""function commit(){poiSnowEdgeFloorCache.delete(world);if(typeof poiSacredContactWallInvalidate==='function')poiSacredContactWallInvalidate(world);""")
out.parent.mkdir(parents=True,exist_ok=True);out.write_text(s)
