from pathlib import Path
import sys
src,dst=map(Path,sys.argv[1:3]);s=src.read_text()
def rep(a,b):
 global s
 assert s.count(a)==1,a
 s=s.replace(a,b,1)
rep('function poiSacredForestMember(o){\n const f=poiSacredForestOf(facilitySite);',
    'function poiSacredForestMember(o,site=facilitySite){\n const f=poiSacredForestOf(site);')
rep('function poiSacredTreeGeometry(m,o){\n const ox=o.x+.5,oz=o.z+.5,y=terrainY(o.x,o.z);',
    'function poiSacredTreeGeometry(m,o,ground=terrainY(o.x,o.z),treeSite=typeof facilitySite===\'undefined\'?null:facilitySite){\n const ox=o.x+.5,oz=o.z+.5,y=ground;')
rep("poiSacredForestOf(typeof facilitySite==='undefined'?null:facilitySite)?.undergrowth",
    "poiSacredForestOf(treeSite)?.undergrowth")
rep('p={id,width,height,owns,terrain,townCells,signs,index:poiOverlandIndex(mapWorld,isFloor)',
    'p={id,width,height,owns,layout,terrain,townCells,signs,index:poiOverlandIndex(mapWorld,isFloor)')
rep('  else if(!local||!pineDrawBaseTree(m,o)&&!pineDrawEastNature(m,o))deco(m,t,o.x+.5,y,o.z+.5,o.rot||0);',
    """  else if(typeof poiSacredForestMember==='function'&&poiSacredForestMember(o,region.layout))
   poiSacredTreeGeometry(m,o,height(o.x,o.z)*TERRAIN_STEP,region.layout);
  else if(!local||!pineDrawBaseTree(m,o)&&!pineDrawEastNature(m,o))deco(m,t,o.x+.5,y,o.z+.5,o.rot||0);""")
rep(' if(stream)poiOverlandPresent(p.vp);else{draw(sceneMesh?.ground,p.vp);',
    """ if(stream){
  if(typeof poiSacredClearScene==='function')poiSacredClearScene();
  poiOverlandPresent(p.vp);
 }else{draw(sceneMesh?.ground,p.vp);""")
dst.write_text(s)
