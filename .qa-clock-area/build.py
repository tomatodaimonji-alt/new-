from pathlib import Path
from sys import argv
src,out=map(Path,argv[1:3]);s=src.read_text()
def p(a,b):
 global s
 assert s.count(a)==1,(a,s.count(a));s=s.replace(a,b)
tag='/* END WIDE HUD MAP */'
assert s.count(tag)==1
p(tag,tag+"""
/* CLOCK THEN AREA: give both map cards the same visual lane. */
#poiClockHud{box-sizing:border-box;width:var(--poi-area-width)}
#poiLocationPanel{transform-origin:top left}
""")
area='<div id="poiLocationPanel"><strong id="poiLocationName"></strong><span id="poiLocationStars"></span></div>'
clock='<div id="poiClockHud" hidden><span id="poiClockDay">1日目</span><strong id="poiClockValue">08:00</strong></div>'
p(' '+area+'\n '+clock,' '+clock+'\n '+area)
start='// BEGIN LOCATION PANEL MOTION\n';end='// END LOCATION PANEL MOTION'
i=s.index(start)+len(start);j=s.index(end,i)
assert 'function poiLocationMotion(' in s[i:j] and "Flash the card's inner edge" in s[i:j]
s=s[:i]+(Path(__file__).parent/'area-grow.js').read_text()+s[j:]
p(' poiLocationMotion(panel,area);\n const last=poiMiniLast;', ' const last=poiMiniLast;')
p(' const hud=poiLocalCapture(', ' poiLocationMotion(panel,area);\n const hud=poiLocalCapture(') if s.count(' const hud=poiLocalCapture(')==1 else p(' poiLocalFrame=poiLocalCapture(poiWalkX,poiWalkZ,floor,',' poiLocationMotion(panel,area);\n poiLocalFrame=poiLocalCapture(poiWalkX,poiWalkZ,floor,')
out.parent.mkdir(parents=True,exist_ok=True);out.write_text(s)
