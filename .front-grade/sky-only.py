"""Keep the time-of-day backdrop visible through the real north aperture."""
import sys
from pathlib import Path
src,dst=map(Path,sys.argv[1:3])
s=src.read_text()
old='  if(skyOutdoor){\n   // Anchor the time-of-day palette'
assert s.count(old)==1, s.count(old)
s=s.replace(old,old.replace('if(skyOutdoor)','if(skyOutdoor||sacredView)'),1)
dst.parent.mkdir(parents=True,exist_ok=True)
dst.write_text(s)
