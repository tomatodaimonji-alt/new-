from pathlib import Path
import sys
d=Path(__file__).parent
source,out=map(Path,sys.argv[1:])
h=source.read_text()
def rep(a,b):
 global h
 if h.count(a)!=1: raise ValueError((h.count(a),a))
 h=h.replace(a,b)
rep('function render(){',(d/'snow-horizon.js').read_text()+'\nfunction render(){')
rep(' poiOcclusionEnd();\n poiDrawEditorGhostRoof(p.vp);',' poiOcclusionEnd();\n if(typeof facilityDrawSnowHorizon===\'function\')\n  facilityDrawSnowHorizon(p);\n poiDrawEditorGhostRoof(p.vp);')
out.write_text(h)
