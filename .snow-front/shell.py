from pathlib import Path
import sys
root=Path(__file__).parent;src,dst=map(Path,sys.argv[1:3]);s=src.read_text()
def rep(a,b):
 global s
 if s.count(a)!=1:raise SystemExit(f'expected one anchor ({s.count(a)}): {a}')
 s=s.replace(a,b,1)
rep('function poiSnowTempleNeighborTick(){',(root/'shell.js').read_text()+'\nfunction poiSnowTempleNeighborTick(){')
rep(" const stream=typeof poiOverlandPreviewTick==='function'?poiOverlandPreviewTick():null;",
    " if(typeof poiSnowExteriorPrime==='function')poiSnowExteriorPrime();\n const stream=typeof poiOverlandPreviewTick==='function'?poiOverlandPreviewTick():null;")
draw_anchor=" if(!stream&&typeof poiSacredDrawScene==='function')poiSacredDrawScene(p.vp);"
if draw_anchor not in s:draw_anchor=draw_anchor.replace('!stream&&','')
rep(draw_anchor," if(typeof poiSnowExteriorDraw==='function')poiSnowExteriorDraw(p.vp);\n"+draw_anchor)
rep(' return !!dest&&(!POI_OVERLAND_SPIKE||poiOverlandRealNeighbor(dest.region,dest.x,dest.z));',
    ' return !!dest&&(!POI_OVERLAND_SPIKE||poiOverlandRealNeighbor(dest.region,dest.x,dest.z)&&poiSnowExteriorReady(dest));')
rep("function commit(){poiSnowEdgeFloorCache.delete(world);poiWildInvalidate();",
    "function commit(){poiSnowEdgeFloorCache.delete(world);if(typeof poiSnowExteriorClear==='function')poiSnowExteriorClear();poiWildInvalidate();")
rep(" const templeGround=site==='base'&&(poiWalkViewZ>=128&&poiWalkViewX<48||",
    " const templeGround=site==='base'&&!poiSnowExteriorBaseRim(poiWalkViewX,poiWalkViewZ)&&(poiWalkViewZ>=128&&poiWalkViewX<48||")
dst.parent.mkdir(parents=True,exist_ok=True);dst.write_text(s)
