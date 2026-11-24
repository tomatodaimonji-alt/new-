from pathlib import Path
import sys
source,target=map(Path,sys.argv[1:3]);s=source.read_text()
before=" for(const [x,z] of [[10,104],[38,104],[13,113],[35,113],[22,118],[26,118]])prop(x,z,'lantern');\n"
deep=" for(const [x,z] of [[14,151],[34,151],[13,162],[35,162],[20,169],[28,169]])\n  if(!occupied.has(K(x,z)))prop(x,z,'lantern');\n"
a=s.index('function extendTownWorldDavidTemple(');b=s.index('// END DAVID TEMPLE MAP',a)
f=s[a:b]
old=[anchor for anchor in (before,deep) if f.count(anchor)==1]
if len(old)!=1:raise SystemExit('expected one exact known Orvas temple lantern authoring loop')
out=f.replace(old[0],'',1)
target.parent.mkdir(parents=True,exist_ok=True)
target.write_text(s[:a]+out+s[b:])
