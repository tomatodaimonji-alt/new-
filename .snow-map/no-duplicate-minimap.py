from pathlib import Path
import sys
src,dst=map(Path,sys.argv[1:3]);s=src.read_text()
i=s.index('function poiSnowPassApply(');j=s.index('function poiSnowPassVeil(',i)
f=s[i:j]
a=' poiWalkReset(dest.x,dest.z);poiWalkFacing=dest.facing;'
b=' facilityBuildRoofs();poiMiniInvalidate();'
assert f.count(a)==1 and f.count(b)==1
f=f.replace(a,' // Reset renders status on the newly installed map. Invalidate first, so\n // its local topology remains valid for the second (camera/HUD) refresh.\n poiMiniInvalidate();\n'+a).replace(b,' facilityBuildRoofs();')
dst.parent.mkdir(parents=True,exist_ok=True);dst.write_text(s[:i]+f+s[j:])
