from pathlib import Path
import sys
base,out=map(Path,sys.argv[1:])
s=base.read_text()
def put(a,b):
 global s
 assert s.count(a)==1,a
 s=s.replace(a,b)
put('uniform vec3 uSacredFog;','uniform vec3 uFieldHaze;\nuniform vec3 uFieldHazeColor;\nuniform vec3 uSacredFog;')
put(' if(uSacredFog.z>0.0){',''' if(uFieldHaze.z>0.0){
  float distanceToFoot=length(vLootXZ-uFieldHaze.xy);
  float veil=uFieldHaze.z*smoothstep(18.0,32.0,distanceToFoot);
  color=mix(color,uFieldHazeColor,veil);
 }
 if(uSacredFog.z>0.0){''')
put("sacredFog:gl.getUniformLocation(program,'uSacredFog'),","fieldHaze:gl.getUniformLocation(program,'uFieldHaze'),fieldHazeColor:gl.getUniformLocation(program,'uFieldHazeColor'),sacredFog:gl.getUniformLocation(program,'uSacredFog'),")
put('function poiSacredFrontierFogRegion(region){',Path(__file__).with_name('haze.js').read_text()+'\nfunction poiSacredFrontierFogRegion(region){')
put(" if(typeof poiSacredApplyFog==='function')poiSacredApplyFog(now,daylight);"," if(typeof poiSacredApplyFog==='function')poiSacredApplyFog(now,daylight);\n poiFieldHazePrepare(now);")
put(" if(stream){\n  if(typeof poiSacredClearScene"," poiFieldHazeStart();\n try{if(stream){\n  if(typeof poiSacredClearScene")
put(" facilityDrawRoofs(p.vp);poiDrawGameRoofs(p.vp);if(typeof poiSnowTempleNeighborDraw==='function')poiSnowTempleNeighborDraw(p.vp);}",
    " facilityDrawRoofs(p.vp);poiDrawGameRoofs(p.vp);}}finally{poiFieldHazeStop()}\n if(!stream&&typeof poiSnowTempleNeighborDraw==='function')poiSnowTempleNeighborDraw(p.vp);")
put(" if(typeof poiOutdoorLate==='function')poiOutdoorLate(p.vp,stream);",
    " poiFieldHazeStart();\n try{if(typeof poiOutdoorLate==='function')poiOutdoorLate(p.vp,stream);}finally{poiFieldHazeStop()}")
put("  if(o.id!==fogRegion){if(typeof poiSacredFrontierFogRegion==='function')poiSacredFrontierFogRegion(o.id);fogRegion=o.id}",
    "  if(o.id!==fogRegion){poiFieldHazeRegion(o.id);if(typeof poiSacredFrontierFogRegion==='function')poiSacredFrontierFogRegion(o.id);fogRegion=o.id}")
put(" }finally{poiOverlandCommands=all;if(typeof poiSacredFrontierFogRegion==='function')poiSacredFrontierFogRegion(active)}",
    " }finally{poiOverlandCommands=all;poiFieldHazeRegion(active);if(typeof poiSacredFrontierFogRegion==='function')poiSacredFrontierFogRegion(active)}")
put("   if(e.ground&&!groundBuilt){","   poiFieldHazeRegion(q.a.id);\n   if(e.ground&&!groundBuilt){")
put(" const seam=poiSeamRoleBegin(stream,id,g,areas,poiOutdoorPlan.list);"," poiFieldHazeRegion(id);\n const seam=poiSeamRoleBegin(stream,id,g,areas,poiOutdoorPlan.list);")
put("   poiSeamCompactDraw(e.gpu,v,cropped?e.ground:0,count);","   poiFieldHazeRegion(q.a.id);\n   poiSeamCompactDraw(e.gpu,v,cropped?e.ground:0,count);")
out.write_text(s)
